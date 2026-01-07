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
const isRailwayInternal = dbUrl && dbUrl.includes('railway.internal');

console.log(`Database Config: ${dbUrl ? 'URL Set' : 'URL Missing'} | Mode: ${isRailwayInternal ? 'Railway Internal' : 'Public/Standard'}`);

const pool = new Pool({
  connectionString: dbUrl,
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
  });

// 2. Initialize Table Schema (Normalized)
const initDB = async () => {
  let client;
  try {
    client = await pool.connect();
    
    // 1. Create Uploads Table (Header Info)
    await client.query(`
      CREATE TABLE IF NOT EXISTS uploads (
        id TEXT PRIMARY KEY,           -- The Unique 9-digit code
        filename TEXT,
        upload_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        record_count INTEGER,
        total_amount NUMERIC
      );
    `);

    // 2. Create Cheques Table (Detail Info)
    // Note: We use upload_id as a Foreign Key linking to uploads.id
    // ON DELETE CASCADE means if we delete the upload record, all its cheques are auto-deleted.
    await client.query(`
      CREATE TABLE IF NOT EXISTS cheques (
        id SERIAL PRIMARY KEY,         -- Auto-incrementing internal ID
        upload_id TEXT REFERENCES uploads(id) ON DELETE CASCADE, 
        doc_number TEXT,
        series TEXT,
        amount NUMERIC,
        due_date TEXT,
        operation_date TEXT,
        received_from TEXT,
        paid_to TEXT,
        status TEXT,
        bank TEXT,
        description TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_cheques_upload_id ON cheques(upload_id);
      CREATE INDEX IF NOT EXISTS idx_cheques_due_date ON cheques(due_date);
    `);

    console.log("Database schema verified: 'uploads' and 'cheques' tables ready.");
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
    // We join with uploads table just to ensure the upload exists, 
    // effectively fetching the lines for this header.
    const result = await pool.query(
      `SELECT 
        c.doc_number as "docNumber", 
        c.series,
        c.amount, 
        c.due_date as "dueDate", 
        c.operation_date as "operationDate",
        c.received_from as "receivedFrom", 
        c.paid_to as "paidTo",
        c.status, 
        c.bank, 
        c.description 
       FROM cheques c
       WHERE c.upload_id = $1 
       ORDER BY c.due_date ASC`,
      [datasetId]
    );

    // Convert numeric strings back to numbers for the frontend
    // Generate a temporary ID for React keys since we don't send the DB ID to frontend
    const rows = result.rows.map((r, index) => ({
        ...r, 
        id: `${datasetId}-${index}`,
        amount: Number(r.amount)
    }));
    
    res.json(rows);
  } catch (e) {
    console.error("Fetch Error:", e.message);
    res.status(500).json({ error: "Database fetch failed" });
  }
});

// POST: Bulk upload cheques (Transactional)
app.post('/api/cheques/bulk', async (req, res) => {
  const { cheques, datasetId, filename } = req.body;
  
  if (!datasetId || !Array.isArray(cheques)) {
    return res.status(400).json({ error: "Invalid Data received" });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Start Transaction
    await client.query('BEGIN');
    
    // 1. Remove existing data if this ID is being re-uploaded (Idempotency)
    // Because of ON DELETE CASCADE, deleting from 'uploads' also deletes from 'cheques'
    await client.query('DELETE FROM uploads WHERE id = $1', [datasetId]);

    // 2. Calculate Aggregates
    const recordCount = cheques.length;
    const totalAmount = cheques.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    // 3. Insert into Uploads (Header)
    await client.query(
      `INSERT INTO uploads (id, filename, record_count, total_amount) 
       VALUES ($1, $2, $3, $4)`,
      [datasetId, filename || 'Unknown.xlsx', recordCount, totalAmount]
    );
    
    // 4. Insert into Cheques (Details)
    const queryText = `
      INSERT INTO cheques (
        upload_id, doc_number, series, amount, due_date, operation_date, 
        received_from, paid_to, status, bank, description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;
    
    for (const c of cheques) {
      await client.query(queryText, [
        datasetId, // Links to uploads.id
        c.docNumber, 
        c.series,
        c.amount, 
        c.dueDate, 
        c.operationDate,
        c.receivedFrom, 
        c.paidTo,
        c.status, 
        c.bank, 
        c.description
      ]);
    }

    // Commit Transaction
    await client.query('COMMIT');
    
    console.log(`Successfully imported Dataset ${datasetId}: ${recordCount} records.`);
    res.json({ success: true, count: recordCount });

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