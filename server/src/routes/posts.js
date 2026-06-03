import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { query } from '../db/index.js';
import { checkNSFW } from '../utils/nsfw.js';
import { cacheGet, cacheSet, cacheInvalidatePrefix } from '../utils/cache.js';
import { broadcastStats } from '../utils/stats.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Multer configuration for file upload
const uploadDir = path.join(__dirname, '../../data/images');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 20971520 // 20MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// GET all posts — cursor-based pagination (keyset) to avoid OFFSET degradation.
// Query params: limit, before (ISO timestamp), beforeId (UUID) for the cursor.
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const before = req.query.before || null;
    const beforeId = req.query.beforeId || null;

    const cacheKey = `posts:${limit}:${before || ''}:${beforeId || ''}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const params = [limit];
    let whereClause = 'WHERE p.deleted = false';

    if (before && beforeId) {
      whereClause += ` AND (
        p.timestamp < $2::timestamptz
        OR (p.timestamp = $2::timestamptz AND p.id::text < $3::text)
      )`;
      params.push(before, beforeId);
    }

    const result = await query(
      `SELECT
        p.id,
        p.device_id,
        p.nickname,
        p.content,
        p.image_url,
        p.timestamp,
        p.deleted,
        COALESCE(
          (SELECT json_object_agg(reaction_type, count)
           FROM (
             SELECT reaction_type, COUNT(*) as count
             FROM reactions
             WHERE post_id = p.id
             GROUP BY reaction_type
           ) reaction_counts),
          '{}'::json
        ) as reactions
      FROM posts p
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.timestamp DESC, p.id DESC
      LIMIT $1`,
      params
    );

    const total = (await query('SELECT COUNT(*) FROM posts WHERE deleted = false')).rows[0].count;
    const payload = { posts: result.rows, total };

    await cacheSet(cacheKey, payload, 5); // 5-second TTL
    res.json(payload);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Strip HTML tags and null bytes to prevent stored XSS / injection.
function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\0/g, '')              // null bytes
    .replace(/<[^>]*>/g, '')         // HTML tags
    .replace(/javascript:/gi, '')    // inline JS protocol
    .trim();
}

// Post creation via the API is disabled. This short-circuit route is
// registered before the real handler below, so Express answers it first and
// no upload/DB work happens. Remove this block to re-enable posting.
router.post('/', (req, res) => {
  res.status(403).json({ error: '投稿は現在無効化されています' });
});

// POST new post
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const nickname = sanitizeText(req.body.nickname);
    const content  = sanitizeText(req.body.content);
    const { device_id } = req.body;

    // Validation
    if (!nickname || !content || !device_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (content.length > 200) {
      return res.status(400).json({ error: 'Content exceeds 200 characters' });
    }

    if (nickname.length > 50) {
      return res.status(400).json({ error: 'Nickname exceeds 50 characters' });
    }

    // NSFW check
    const nsfwResult = await checkNSFW(content, req.file);
    if (nsfwResult.isNSFW) {
      // Clean up uploaded file if exists
      if (req.file) {
        await fs.unlink(req.file.path);
      }
      return res.status(400).json({
        error: 'Your post contains inappropriate content. Please revise and try again.',
        reason: nsfwResult.reason
      });
    }

    const postId = uuidv4();
    const imageUrl = req.file ? `/api/images/${req.file.filename}` : null;

    const result = await query(
      `INSERT INTO posts (id, device_id, nickname, content, image_url, timestamp)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *`,
      [postId, device_id, nickname, content, imageUrl]
    );

    const post = result.rows[0];

    // Invalidate posts cache so next GET reflects the new post
    await cacheInvalidatePrefix('posts:');

    // Notify WebSocket clients — serialize once and reuse the same string for
    // every client (avoids re-stringifying the identical payload per connection,
    // which is the dominant CPU cost when broadcasting to thousands of clients).
    const wss = req.app.locals.wss;
    if (wss) {
      const payload = JSON.stringify({
        type: 'new_post',
        data: {
          ...post,
          reactions: {}
        }
      });
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
          client.send(payload);
        }
      });
      broadcastStats(wss); // live admin stats (totalPosts / uniqueDevices)
    }

    res.status(201).json({
      message: 'Post created successfully',
      post: {
        ...post,
        reactions: {}
      }
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// POST reaction
router.post('/:postId/reactions', async (req, res) => {
  try {
    const { postId } = req.params;
    const { device_id, reaction_type } = req.body;

    if (!['like', 'heart', 'fire', 'surprise'].includes(reaction_type)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    // Check if post exists
    const post = await query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (post.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user already has this reaction
    const existing = await query(
      'SELECT * FROM reactions WHERE post_id = $1 AND device_id = $2 AND reaction_type = $3',
      [postId, device_id, reaction_type]
    );

    if (existing.rows.length > 0) {
      // Delete reaction
      await query(
        'DELETE FROM reactions WHERE post_id = $1 AND device_id = $2 AND reaction_type = $3',
        [postId, device_id, reaction_type]
      );
    } else {
      // Add reaction
      await query(
        `INSERT INTO reactions (post_id, device_id, reaction_type)
        VALUES ($1, $2, $3)`,
        [postId, device_id, reaction_type]
      );
    }

    // Get updated reactions count
    const reactions = await query(
      `SELECT reaction_type, COUNT(*) as count
      FROM reactions
      WHERE post_id = $1
      GROUP BY reaction_type`,
      [postId]
    );

    const reactionsObj = {};
    reactions.rows.forEach(r => {
      reactionsObj[r.reaction_type] = parseInt(r.count);
    });

    const added = existing.rows.length === 0;

    // Notify WebSocket clients — include which reaction changed so clients
    // can trigger the emoji scatter effect for all viewers. Serialize once and
    // reuse the same string for every client (see note in the new-post handler).
    const wss = req.app.locals.wss;
    if (wss) {
      const payload = JSON.stringify({
        type: 'reaction_update',
        data: {
          postId,
          reactions: reactionsObj,
          changedReaction: reaction_type,
          added
        }
      });
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
          client.send(payload);
        }
      });
      broadcastStats(wss); // live admin stats (totalReactions)
    }

    res.json({
      message: added ? 'Reaction added' : 'Reaction removed',
      reactions: reactionsObj
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Get user's reactions for a specific post
router.get('/:postId/user-reactions', async (req, res) => {
  try {
    const { postId } = req.params;
    const { device_id } = req.query;

    if (!device_id) {
      return res.status(400).json({ error: 'device_id is required' });
    }

    // Get all reactions this user has added for this post
    const userReactions = await query(
      `SELECT reaction_type FROM reactions 
       WHERE post_id = $1 AND device_id = $2`,
      [postId, device_id]
    );

    const reactionMap = {};
    userReactions.rows.forEach(r => {
      reactionMap[r.reaction_type] = true;
    });

    res.json(reactionMap);
  } catch (error) {
    console.error('Error fetching user reactions:', error);
    res.status(500).json({ error: 'Failed to fetch user reactions' });
  }
});

export default router;
