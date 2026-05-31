import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { query } from '../db/index.js';
import { checkNSFW } from '../utils/nsfw.js';
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

// GET all posts
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

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
      WHERE p.deleted = false
      GROUP BY p.id
      ORDER BY p.timestamp DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      posts: result.rows,
      total: (await query('SELECT COUNT(*) FROM posts WHERE deleted = false')).rows[0].count
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// POST new post
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { nickname, content, device_id } = req.body;

    // Validation
    if (!nickname || !content || !device_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (content.length > 200) {
      return res.status(400).json({ error: 'Content exceeds 200 characters' });
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
    const imageUrl = req.file ? `/images/${req.file.filename}` : null;

    const result = await query(
      `INSERT INTO posts (id, device_id, nickname, content, image_url, timestamp)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *`,
      [postId, device_id, nickname, content, imageUrl]
    );

    const post = result.rows[0];

    // Notify WebSocket clients
    const wss = req.app.locals.wss;
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
          client.send(JSON.stringify({
            type: 'new_post',
            data: {
              ...post,
              reactions: {}
            }
          }));
        }
      });
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

    // Notify WebSocket clients
    const wss = req.app.locals.wss;
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
          client.send(JSON.stringify({
            type: 'reaction_update',
            data: {
              postId,
              reactions: reactionsObj
            }
          }));
        }
      });
    }

    res.json({
      message: existing.rows.length > 0 ? 'Reaction removed' : 'Reaction added',
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
