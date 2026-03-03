import { createClient, Client } from '@libsql/client';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

// Safety Check: If the URL is missing OR looks like a token (starts with 'eyJ'), fallback to local DB
const isUrlValid = url && (url.startsWith('libsql://') || url.startsWith('https://'));
let finalUrl = isUrlValid ? url : 'file:store.db';

if (!isUrlValid && url) {
  console.warn('⚠️ WARNING: TURSO_DATABASE_URL appears invalid (it might be a token). Switching to local database mode (file:store.db).');
}

// Helper to ensure local DB file exists
function ensureLocalDbFile() {
  try {
    const dbPath = path.resolve('store.db');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, '');
    }
    console.log('✅ Local database file ensured at:', dbPath);
  } catch (err) {
    console.error('Failed to prepare local database file:', err);
  }
}

// Initialize the client instance (mutable so we can swap it if it fails)
let dbInstance: Client;

// Initial attempt setup
if (finalUrl === 'file:store.db') {
  ensureLocalDbFile();
}

dbInstance = createClient({
  url: finalUrl!,
  authToken: authToken,
});

async function createTables(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      discountPercent INTEGER DEFAULT 0,
      image TEXT NOT NULL
    )
  `);

  await client.execute(`
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
  const rs = await client.execute('SELECT count(*) as count FROM products');
  const count = rs.rows[0].count as number;

  if (count === 0) {
    await client.execute({
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

export async function initDB() {
  try {
    console.log(`Attempting to connect to database at: ${finalUrl}`);
    await createTables(dbInstance);
    console.log('✅ Database connected and initialized successfully.');
  } catch (error: any) {
    console.error('❌ Database initialization failed:', error.message);

    // If we are not already using local DB, try to fallback
    if (finalUrl !== 'file:store.db') {
      console.warn('⚠️ Remote DB connection failed. Falling back to local SQLite database (file:store.db) to keep server running.');
      console.warn('⚠️ NOTE: Data in local DB on Render is ephemeral and will be lost on restart.');
      
      try {
        finalUrl = 'file:store.db';
        ensureLocalDbFile();
        
        // Re-initialize the client with local file
        dbInstance = createClient({ url: finalUrl });
        
        // Try creating tables again on the new local instance
        await createTables(dbInstance);
        console.log('✅ Fallback to local database successful.');
      } catch (fallbackError) {
        console.error('❌ Critical: Fallback to local database also failed:', fallbackError);
        throw fallbackError; // Nothing else we can do
      }
    } else {
      throw error; // Already local, just fail
    }
