import express from 'express';
import { query } from '../db/index.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
      GROUP BY p.id
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

// DELETE post
router.post('/posts/:postId/delete', adminAuth, async (req, res) => {
  try {
    const { postId } = req.params;

    // Get post to find image
    const post = await query('SELECT * FROM posts WHERE id = $1', [postId]);
    
    if (post.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Delete image file if exists
    if (post.rows[0].image_url) {
      const imagePath = path.join(__dirname, '../../data/images', path.basename(post.rows[0].image_url));
      try {
        await fs.unlink(imagePath);
      } catch (err) {
        console.error('Error deleting image file:', err);
      }
    }

    // Delete post from database
    await query('DELETE FROM posts WHERE id = $1', [postId]);

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
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
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
