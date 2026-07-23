const express = require('express');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON requests & serving static files from public/
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// PostgreSQL connection pool (Connects to Neon DB)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// GET Endpoint: Fetches all products (including is_special and stock attributes)
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching products from DB:', err.stack);
        res.status(500).json({ error: 'Database query failed' });
    }
});

// POST Endpoint: Handles checkout and logs orders to Neon DB
app.post('/api/orders', async (req, res) => {
    const { name, room, phone, total, items } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO orders (customer_name, room_no, phone_no, total_amount, order_details) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [name, room, phone, total, JSON.stringify(items)]
        );
        res.json({ success: true, orderId: result.rows[0].id });
    } catch (err) {
        console.error('Error saving order to DB:', err.stack);
        res.status(500).json({ success: false, error: 'Database write failed' });
    }
});
// PATCH Endpoint: Updates stock quantity for a product
app.patch('/api/items/:id/stock', async (req, res) => {
  const { id } = req.params;
  const { stock } = req.body;

  try {
    const newStock = parseInt(stock, 10);
    const isAvailable = newStock > 0;

    const result = await pool.query(
      `UPDATE products SET stock = $1, is_available = $2 WHERE id = $3 RETURNING *`,
      [newStock, isAvailable, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    res.json({ success: true, item: result.rows[0] });
  } catch (err) {
    console.error('Error updating stock:', err.stack);
    res.status(500).json({ success: false, error: 'Database update failed' });
  }
});
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
