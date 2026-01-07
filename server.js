const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
// Increase payload limit for large Excel files
app.use(express.json({ limit: '50mb' }));

// 1. Database Connection
// Railway automatically provides DATABASE_URL in the environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for most cloud Postgres connections
});

// 2. Initialize Table Schema
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cheques (
        id TEXT PRIMARY KEY,
        doc_number TEXT,
        amount NUMERIC,
        due_date TEXT,
        received_from TEXT,
        status TEXT,
        bank TEXT,
        dataset_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_dataset_id ON cheques(dataset_id);
    `);
    console.log("Database schema initialized.");
  } catch (err) {
    console.error("Failed to initialize database:", err);
  }
};
initDB();

// 3. API Endpoints

// GET: Fetch cheques for a specific dataset ID
app.get('/api/cheques', async (req, res) => {
  const { datasetId } = req.query;
  if (!datasetId) return res.json([]);
  
  try {
    const result = await pool.query(
      'SELECT id, doc_number as "docNumber", amount, due_date as "dueDate", received_from as "receivedFrom", status, bank FROM cheques WHERE dataset_id = $1 ORDER BY due_date ASC',
      [datasetId]
    );
    // Convert numeric strings back to numbers
    const rows = result.rows.map(r => ({...r, amount: Number(r.amount)}));
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST: Bulk upload cheques
app.post('/api/cheques/bulk', async (req, res) => {
  const { cheques, datasetId } = req.body;
  if (!datasetId || !Array.isArray(cheques)) return res.status(400).send("Invalid Data");

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Clean up old data for this datasetId to prevent duplicates on re-upload
    await client.query('DELETE FROM cheques WHERE dataset_id = $1', [datasetId]);
    
    const queryText = `
      INSERT INTO cheques (id, doc_number, amount, due_date, received_from, status, bank, dataset_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    // Insert new records
    for (const c of cheques) {
      await client.query(queryText, [
        c.id, c.docNumber, c.amount, c.dueDate, c.receivedFrom, c.status, c.bank, datasetId
      ]);
    }

    await client.query('COMMIT');
    res.json({ success: true, count: cheques.length });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// 4. Serve Frontend
// Serve static files from the 'dist' directory (Vite build output)
app.use(express.static(path.join(__dirname, 'dist')));

// Handle client-side routing by returning index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});