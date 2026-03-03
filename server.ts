import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDB } from './db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize DB
  await initDB();

  app.use(express.json());

  // API Routes
  app.get('/api/products', async (req, res) => {
    try {
      const rs = await db.execute('SELECT * FROM products');
      res.json(rs.rows);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/orders', async (req, res) => {
    try {
      const { productId, quantity, customerName, customerPhone } = req.body;
      
      if (!productId || !quantity) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const rs = await db.execute({
        sql: `INSERT INTO orders (product_id, quantity, customer_name, customer_phone) VALUES (?, ?, ?, ?)`,
        args: [productId, quantity, customerName || 'Guest', customerPhone || '']
      });
      
      res.json({ 
        success: true, 
        orderId: rs.lastInsertRowid,
        message: 'Order placed successfully' 
      });
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Admin Routes
  app.get('/api/admin/orders', async (req, res) => {
    try {
      const rs = await db.execute(`
        SELECT orders.*, products.name as product_name 
        FROM orders 
        JOIN products ON orders.product_id = products.id 
        ORDER BY created_at DESC
      `);
      res.json(rs.rows);
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.patch('/api/admin/orders/:id/status', async (req, res) => {
    try {
      const { status } = req.body;
      const { id } = req.params;
      
      await db.execute({
        sql: 'UPDATE orders SET status = ? WHERE id = ?',
        args: [status, id]
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating order:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
