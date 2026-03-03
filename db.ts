import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:store.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function initDB() {
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
}

export default db;
