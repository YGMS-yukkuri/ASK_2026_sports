import { query } from '../db/index.js';
import { addDevice, removeDevice, broadcastPresence } from './presence.js';
import { broadcastStats } from '../utils/stats.js';

export function handleWebSocket(ws, wss) {
  // ws.isAlive is set to true in the connection handler before this is called,
  // and is reset by the heartbeat interval.
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        case 'identify':
          // First identify for this socket registers the device for presence.
          if (message.deviceId && !ws.deviceId) {
            ws.deviceId = message.deviceId;
            addDevice(ws.deviceId);
            broadcastPresence(wss);
          }
          // Grant admin role only with a valid password, then push live stats.
          if (message.role === 'admin' && message.password === process.env.ADMIN_PASSWORD) {
            ws.isAdmin = true;
            broadcastStats(wss);
          } else if (message.role === 'user') {
            ws.isAdmin = false;
          }
          break;

        case 'sync_posts':
          await handleSyncPosts(ws);
          break;

        case 'get_reactions':
          await handleGetReactions(ws, message);
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    if (ws.deviceId) {
      removeDevice(ws.deviceId);
      broadcastPresence(wss);
    }
    console.log('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Send initial connection message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to server'
  }));
}

async function handleSyncPosts(ws) {
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
        COALESCE(json_object_agg(r.reaction_type, r.count), '{}'::json) as reactions
      FROM posts p
      LEFT JOIN (
        SELECT post_id, reaction_type, COUNT(*) as count
        FROM reactions
        GROUP BY post_id, reaction_type
      ) r ON p.id = r.post_id
      WHERE p.deleted = false
      GROUP BY p.id
      ORDER BY p.timestamp DESC`
    );

    ws.send(JSON.stringify({
      type: 'posts_sync',
      data: result.rows
    }));
  } catch (error) {
    console.error('Error syncing posts:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to sync posts'
    }));
  }
}

async function handleGetReactions(ws, message) {
  try {
    const { postId } = message;

    const result = await query(
      `SELECT reaction_type, COUNT(*) as count
      FROM reactions
      WHERE post_id = $1
      GROUP BY reaction_type`,
      [postId]
    );

    const reactions = {};
    result.rows.forEach(r => {
      reactions[r.reaction_type] = parseInt(r.count);
    });

    ws.send(JSON.stringify({
      type: 'reactions',
      data: {
        postId,
        reactions
      }
    }));
  } catch (error) {
    console.error('Error getting reactions:', error);
  }
}

// Heartbeat to keep connections alive
export function startHeartbeat(wss) {
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  return interval;
}
