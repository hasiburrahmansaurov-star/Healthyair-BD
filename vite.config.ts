import express from 'express';
import { createServer as createViteServer } from 'vite';
import db from './db';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/products', (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM products');
      const products = stmt.all();
      res.json(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/orders', (req, res) => {
    try {
      const { productId, quantity, customerName, customerPhone } = req.body;
      
      if (!productId || !quantity) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const stmt = db.prepare(`
        INSERT INTO orders (product_id, quantity, customer_name, customer_phone)
        VALUES (?, ?, ?, ?)
      `);
      
      const info = stmt.run(productId, quantity, customerName || 'Guest', customerPhone || '');
      
      res.json({ 
        success: true, 
        orderId: info.lastInsertRowid,
        message: 'Order placed successfully' 
      });
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Admin Routes
  app.get('/api/admin/orders', (req, res) => {
    try {
      // In a real app, add authentication middleware here
      const stmt = db.prepare(`
        SELECT orders.*, products.name as product_name 
        FROM orders 
        JOIN products ON orders.product_id = products.id 
        ORDER BY created_at DESC
      `);
      const orders = stmt.all();
      res.json(orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.patch('/api/admin/orders/:id/status', (req, res) => {
    try {
      const { status } = req.body;
      const { id } = req.params;
      
      const stmt = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
      stmt.run(status, id);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating order:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving would go here
    // app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
