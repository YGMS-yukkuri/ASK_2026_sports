require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const Filter = require('bad-words');
const { Pool } = require('pg');

const DATA_DIR = path.join(__dirname, 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

fs.ensureDirSync(IMAGES_DIR);

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use('/images', express.static(IMAGES_DIR));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

const filter = new Filter();

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.POSTGRES_USER||process.env.PGUSER||'postgres'}:${process.env.POSTGRES_PASSWORD||process.env.PGPASSWORD||'example'}@${process.env.POSTGRES_HOST||process.env.PGHOST||'db'}:${process.env.POSTGRES_PORT||process.env.PGPORT||5432}/${process.env.POSTGRES_DB||process.env.PGDATABASE||'ask2026'}`
});

async function initDb(){
  await pool.query(`CREATE TABLE IF NOT EXISTS posts (
    id serial PRIMARY KEY,
    post_id uuid UNIQUE,
    device_id text,
    nickname text NOT NULL,
    content text NOT NULL,
    timestamp timestamptz NOT NULL,
    imageurl text,
    reactions jsonb NOT NULL DEFAULT '{"like":0,"heart":0,"fire":0,"surprise":0}',
    deleted boolean NOT NULL DEFAULT false
  )`);
  // If table empty, try to load from posts.json for initial data
  try {
    const { rowCount } = await pool.query('SELECT 1 FROM posts LIMIT 1');
    if (rowCount === 0) {
      const initialFile = path.join(__dirname, 'data', 'posts.json');
      if (await fs.pathExists(initialFile)) {
        const initial = await fs.readJson(initialFile);
        for (const p of initial) {
          const insertText = `INSERT INTO posts (post_id, device_id, nickname, content, timestamp, imageurl, reactions, deleted) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (post_id) DO NOTHING`;
          const values = [p.post_id || uuidv4(), p.device_id || null, p.nickname, p.content, p.timestamp || new Date().toISOString(), p.imageUrl || null, p.reactions || { like:0, heart:0, fire:0, surprise:0 }, p.deleted || false];
          await pool.query(insertText, values);
        }
        console.log('Initial posts loaded into DB');
      }
    }
  } catch (err) {
    console.error('Failed to load initial posts:', err);
  }
}

initDb().catch(err=>{ console.error('DB init failed', err); process.exit(1) });

io.on('connection', (socket) => {
  console.log('client connected');
});

app.get('/api/posts', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT post_id, device_id, nickname, content, timestamp, imageurl, reactions, deleted FROM posts WHERE deleted = false ORDER BY timestamp DESC');
    const posts = rows.map(r=>({
      post_id: r.post_id,
      device_id: r.device_id,
      nickname: r.nickname,
      content: r.content,
      timestamp: r.timestamp,
      imageUrl: r.imageurl,
      reactions: r.reactions,
      deleted: r.deleted
    }));
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to read posts' });
  }
});

// admin: list all posts (including deleted)
app.get('/api/admin/posts', async (req, res) => {
  const adminPass = process.env.ADMIN_PASSWORD || '';
  const provided = req.headers['x-admin-password'] || '';
  if (!adminPass || provided !== adminPass) return res.status(401).json({ error: 'unauthorized' });
  try {
    const { rows } = await pool.query('SELECT post_id, device_id, nickname, content, timestamp, imageurl, reactions, deleted FROM posts ORDER BY timestamp DESC');
    const posts = rows.map(r=>({
      post_id: r.post_id,
      device_id: r.device_id,
      nickname: r.nickname,
      content: r.content,
      timestamp: r.timestamp,
      imageUrl: r.imageurl,
      reactions: r.reactions,
      deleted: r.deleted
    }));
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to read posts' });
  }
});

app.post('/api/posts', upload.single('image'), async (req, res) => {
  try {
    const { nickname, content, device_id } = req.body;
    if (!nickname || !content) return res.status(400).json({ error: 'nickname and content required' });
    if (content.length > 200) return res.status(400).json({ error: 'content too long' });

    // simple text NSFW check
    if (filter.isProfane(content)) return res.status(400).json({ error: 'content flagged as inappropriate' });

    let imageUrl = null;
    if (req.file) {
      const ext = path.extname(req.file.originalname) || '.jpg';
      const filename = uuidv4() + ext;
      const outPath = path.join(IMAGES_DIR, filename);
      await fs.writeFile(outPath, req.file.buffer);
      imageUrl = `/images/${filename}`;
    }

    const postId = uuidv4();
    const timestamp = new Date().toISOString();
    const reactions = { like:0, heart:0, fire:0, surprise:0 };

    const insertText = `INSERT INTO posts (post_id, device_id, nickname, content, timestamp, imageurl, reactions, deleted) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING post_id, device_id, nickname, content, timestamp, imageurl, reactions, deleted`;
    const values = [postId, device_id || null, nickname, content, timestamp, imageUrl, reactions, false];
    const { rows } = await pool.query(insertText, values);
    const post = rows[0];

    const mapped = {
      post_id: post.post_id,
      device_id: post.device_id,
      nickname: post.nickname,
      content: post.content,
      timestamp: post.timestamp,
      imageUrl: post.imageurl,
      reactions: post.reactions,
      deleted: post.deleted
    };

    io.emit('new_post', mapped);
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to save post' });
  }
});

// admin delete
app.delete('/api/posts/:id', async (req, res) => {
  const adminPass = process.env.ADMIN_PASSWORD || '';
  const provided = req.headers['x-admin-password'] || '';
  if (!adminPass || provided !== adminPass) return res.status(401).json({ error: 'unauthorized' });

  try {
    const id = req.params.id;
    const { rows } = await pool.query('SELECT imageurl FROM posts WHERE post_id=$1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'not found' });
    const imageurl = rows[0].imageurl;

    await pool.query('DELETE FROM posts WHERE post_id=$1', [id]);

    if (imageurl) {
      const filename = path.basename(imageurl);
      const p = path.join(IMAGES_DIR, filename);
      if (await fs.pathExists(p)) await fs.remove(p);
    }

    io.emit('delete_post', { post_id: id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to delete' });
  }
});

const PORT = process.env.PORT || 4000;
http.listen(PORT, () => console.log('Server listening on', PORT));
