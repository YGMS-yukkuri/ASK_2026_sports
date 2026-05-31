import pkg from 'pg';
const { Pool } = pkg;

let pool;

export function getPool() {
  if (!pool) {
    const config = {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'ask_2026_sports',
    };

    // Only add password if it's not empty
    if (process.env.DB_PASSWORD && process.env.DB_PASSWORD.trim()) {
      config.password = process.env.DB_PASSWORD;
    }

    pool = new Pool(config);

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return pool;
}

export async function initializeDatabase() {
  const pool = getPool();

  try {
    // Read and execute schema
    const schemaPath = new URL('../../schema.sql', import.meta.url);
    const fs = await import('fs').then(m => m.promises);
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    const statements = schema.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
      }
    }

    console.log('Database schema initialized');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export async function query(text, params) {
  const pool = getPool();
  return pool.query(text, params);
}

export async function closePool() {
  if (pool) {
    await pool.end();
  }
}
