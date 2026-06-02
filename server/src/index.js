import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Routes
import postRoutes from './routes/posts.js';
import adminRoutes from './routes/admin.js';
import imageRoutes from './routes/images.js';

// Database
import { initializeDatabase } from './db/index.js';

// Cache (Redis with in-memory fallback)
import { initCache } from './utils/cache.js';

// WebSocket Handler
import { handleWebSocket, startHeartbeat } from './websocket/handler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for images
app.use('/images', express.static(path.join(__dirname, '../data/images')));

// Routes
app.use('/api/posts', postRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/images', imageRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve client build files as static assets
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  ws.isAlive = true;
  // Suppress ECONNRESET and other low-level socket errors that occur when
  // a client disconnects abruptly without a proper TCP close handshake.
  ws._socket.on('error', (err) => {
    if (err.code === 'ECONNRESET' || err.code === 'EPIPE') return;
    console.error('WebSocket socket error:', err);
  });
  handleWebSocket(ws, wss);
});

startHeartbeat(wss);

// Store WebSocket server in app for use in routes
app.locals.wss = wss;

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Initialize database and start server
async function start() {
  try {
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized successfully');
    initCache();

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 WebSocket server running on ws://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('⚠️  Make sure PostgreSQL is installed and running!');
    console.error('📖 See README.md for setup instructions');
    process.exit(1);
  }
}

start();

export default app;
