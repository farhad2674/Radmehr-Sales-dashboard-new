const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
// Increase payload limit for large Excel files
app.use(express.json({ limit: '50mb' }));

// 1. Database Connection Configuration
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.warn("WARNING: DATABASE_URL environment variable is not set. Database features will not work.");
}

// Detect if we are using an internal Railway URL (postgres.railway.internal)
// Internal connections inside Railway's private network usually require SSL to be disabled or handled differently than public connections.
const isRailwayInternal = dbUrl && dbUrl.includes('railway.internal');

console.log(`Database Config: ${dbUrl ? 'URL Set' : 'URL Missing'} | Mode: ${isRailwayInternal ? 'Railway Internal' : 'Public/Standard'}`);

const pool = new Pool({
  connectionString: dbUrl,
  // If internal, disable SSL to prevent "server does not support SSL" errors.
  // If public (e.g. connecting from local to cloud), strictly require valid SSL.
  ssl: dbUrl ? (isRailwayInternal ? false : { rejectUnauthorized: false }) : undefined
});

// Test Connection on Startup
pool.connect()
  .then(client => {
    console.log("✅ Successfully connected to PostgreSQL database!");
    client.release();
    // Initialize Schema only if connected
    initDB();
  })
  .catch(err => {
    console.error("❌ Failed to connect to database on startup.");
    console.error(`Error: ${err.message}`);
    if (isRailwayInternal && err.code === 'ENOTFOUND') {
      console.error("HINT: You are using a 'railway.internal' URL locally. This URL only works when the app is deployed on Railway. For local development, use the Public Proxy URL provided in Railway dashboard.");
    }
  });

// 2. Initialize Table Schema
const initDB = async () => {
  let client;
  try {
    client = await pool.connect();
    await client.query(`
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
    console.log("Database schema verified.");
  } catch (err) {
    console.error("Failed to initialize database schema:", err);
  } finally {
    if (client) client.release();
  }
};

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
    console.error("Fetch Error:", e.message);
    res.status(500).json({ error: "Database fetch failed" });
  }
});

// POST: Bulk upload cheques
app.post('/api/cheques/bulk', async (req, res) => {
  const { cheques, datasetId } = req.body;
  if (!datasetId || !Array.isArray(cheques)) return res.status(400).json({ error: "Invalid Data received" });

  let client;
  try {
    // Attempt connection
    client = await pool.connect();
    
    await client.query('BEGIN');
    
    // Clean up old data for this datasetId
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
    console.log(`Saved ${cheques.length} records for dataset ${datasetId}`);
    res.json({ success: true, count: cheques.length });
  } catch (e) {
    if (client) {
        try { await client.query('ROLLBACK'); } catch(err) { console.error("Rollback error", err); }
    }
    console.error("Bulk Upload Error:", e.message);
    res.status(500).json({ error: `Database Error: ${e.message}` });
  } finally {
    if (client) client.release();
  }
});

// 4. Serve Frontend
app.use(express.static(path.join(__dirname, 'dist')));

// Handle client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});