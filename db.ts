import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

// Safety Check: If the URL is missing OR looks like a token (starts with 'eyJ'), fallback to local DB
const isUrlValid = url && (url.startsWith('libsql://') || url.startsWith('https://'));
const finalUrl = isUrlValid ? url : 'file:store.db';

if (!isUrlValid && url) {
  console.warn('⚠️ WARNING: TURSO_DATABASE_URL appears invalid (it might be a token). Switching to local database mode (file:store.db).');
}

// Ensure local DB file can be created if needed
if (finalUrl === 'file:store.db') {
  try {
    const dbPath = path.resolve('store.db');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    // Create empty file if it doesn't exist to avoid potential issues with some drivers
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, '');
    }
  } catch (err) {
    console.error('Failed to prepare local database file:', err);
  }
}

const db = createClient({
  url: finalUrl,
  authToken: authToken,
});

export async function initDB() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        price INTEGER NOT NULL,
        discountPercent INTEGER DEFAULT 0,
        image TEXT NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id)
      )
    `);

    // Seed data if empty
    const rs = await db.execute('SELECT count(*) as count FROM products');
    const count = rs.rows[0].count as number;

    if (count === 0) {
      await db.execute({
        sql: `INSERT INTO products (name, description, price, discountPercent, image) VALUES (?, ?, ?, ?, ?)`,
        args: [
          'Shark HP072 Air Purifier',
          'Keep your home fresh and healthy with this powerful yet compact air purifier.',
          35000,
          5,
          'https://m.media-amazon.com/images/I/71-MxuNK6GL._AC_SL1000__.jpg'
        ]
      });
      console.log('Database seeded with initial product.');
    }
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error; // Re-throw to let the server know startup failed
  }
}

export default db;
