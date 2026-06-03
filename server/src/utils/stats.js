import { query } from '../db/index.js';

// Broadcasts live admin statistics (total posts, total reactions, unique
// devices) to authenticated admin sockets only. Debounced so a burst of
// posts/reactions collapses into a single recompute + broadcast.
let pending = null;

export function broadcastStats(wss) {
  if (!wss || pending) return;
  pending = setTimeout(async () => {
    pending = null;
    try {
      const [posts, reactions, devices] = await Promise.all([
        query('SELECT COUNT(*) FROM posts'),
        query('SELECT COUNT(*) FROM reactions'),
        query('SELECT COUNT(DISTINCT device_id) FROM posts'),
      ]);
      const payload = JSON.stringify({
        type: 'stats_update',
        data: {
          totalPosts: parseInt(posts.rows[0].count),
          totalReactions: parseInt(reactions.rows[0].count),
          uniqueDevices: parseInt(devices.rows[0].count),
        },
      });
      wss.clients.forEach(client => {
        if (client.readyState === 1 && client.isAdmin) client.send(payload);
      });
    } catch (error) {
      console.error('Error broadcasting stats:', error);
    }
  }, 400);
}
