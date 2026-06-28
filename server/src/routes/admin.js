import express from 'express';
import { query } from '../db/index.js';
import { cacheInvalidatePrefix } from '../utils/cache.js';
import { broadcastStats } from '../utils/stats.js';

const router = express.Router();

// Admin authentication middleware
const adminAuth = (req, res, next) => {
  const password = req.body.password || req.query.password;
  
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// GET all posts (including deleted)
router.post('/posts', adminAuth, async (req, res) => {
  try {
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
      ORDER BY p.timestamp DESC`
    );

    res.json({
      posts: result.rows
    });
  } catch (error) {
    console.error('Error fetching admin posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// DELETE post (soft delete) — per spec (docs/data.md), deletion sets the
// `deleted` flag to true rather than removing the row. The post stays in the
// DB (and its image file is retained) so the admin page can still show it with
// a red background, while the main page hides it (GET filters deleted = false).
router.post('/posts/:postId/delete', adminAuth, async (req, res) => {
  try {
    const { postId } = req.params;

    // Flag the post as deleted; returns nothing if the post doesn't exist.
    const result = await query(
      'UPDATE posts SET deleted = true WHERE id = $1 RETURNING id',
      [postId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    await cacheInvalidatePrefix('posts:');

    // Notify WebSocket clients
    const wss = req.app.locals.wss;
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
          client.send(JSON.stringify({
            type: 'post_deleted',
            data: {
              postId
            }
          }));
        }
      });
      broadcastStats(wss); // live admin stats after deletion
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// RESTORE post — reverses a soft delete by clearing the `deleted` flag. The
// post reappears on the main page (broadcast as post_restored with its full
// data, including reactions, so clients can re-insert it in order).
router.post('/posts/:postId/restore', adminAuth, async (req, res) => {
  try {
    const { postId } = req.params;

    // Clear the flag and return the post with its aggregated reactions in one
    // round-trip, mirroring the shape the main page expects for a post.
    const result = await query(
      `UPDATE posts SET deleted = false WHERE id = $1
       RETURNING id, device_id, nickname, content, image_url, timestamp, deleted`,
      [postId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = result.rows[0];

    const reactionsResult = await query(
      `SELECT reaction_type, COUNT(*) as count
       FROM reactions WHERE post_id = $1 GROUP BY reaction_type`,
      [postId]
    );
    const reactions = {};
    reactionsResult.rows.forEach(r => {
      reactions[r.reaction_type] = parseInt(r.count);
    });

    await cacheInvalidatePrefix('posts:');

    // Notify WebSocket clients
    const wss = req.app.locals.wss;
    if (wss) {
      const payload = JSON.stringify({
        type: 'post_restored',
        data: { ...post, reactions }
      });
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
          client.send(payload);
        }
      });
      broadcastStats(wss); // live admin stats after restore
    }

    res.json({ message: 'Post restored successfully', post: { ...post, reactions } });
  } catch (error) {
    console.error('Error restoring post:', error);
    res.status(500).json({ error: 'Failed to restore post' });
  }
});

// GET statistics
router.post('/statistics', adminAuth, async (req, res) => {
  try {
    const totalPosts = await query('SELECT COUNT(*) FROM posts');
    const totalReactions = await query('SELECT COUNT(*) FROM reactions');
    const uniqueDevices = await query('SELECT COUNT(DISTINCT device_id) FROM posts');

    res.json({
      totalPosts: parseInt(totalPosts.rows[0].count),
      totalReactions: parseInt(totalReactions.rows[0].count),
      uniqueDevices: parseInt(uniqueDevices.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
