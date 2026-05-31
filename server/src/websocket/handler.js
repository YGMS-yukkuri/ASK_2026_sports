import { query } from '../db/index.js';

export function handleWebSocket(ws, wss) {
  let isAlive = true;

  ws.on('pong', () => {
    isAlive = true;
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
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
