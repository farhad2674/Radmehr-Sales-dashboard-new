import express from 'express';
import path from 'path';
import cors from 'cors';
import pg from 'pg'; 
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Reconstruct __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
// Increase payload limit for large Excel files - essential for 40K records
app.use(express.json({ limit: '100mb' }));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// 1. Database Setup (PostgreSQL)

// Helper to determine config
const getDbConfig = () => {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  
  // Fallback to individual variables if DATABASE_URL is not provided
  return {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
  };
};

const dbConfig = getDbConfig();

const pool = new Pool({
  ...dbConfig,
  // SSL is often required in production cloud environments
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Log connection attempt (masking password)
const hostLog = process.env.DATABASE_URL ? 'DATABASE_URL provided' : dbConfig.host;
console.log(`🔌 Attempting to connect to PostgreSQL at host: ${hostLog}`);

// Start Server Immediately to satisfy health checks
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`💾 Storage Mode: PostgreSQL`);
});

// Database Connection Logic with Retry
const connectDB = async (retries = 10) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔌 Connecting to database (Attempt ${i + 1}/${retries})...`);
      const client = await pool.connect();
      console.log("✅ Successfully connected to PostgreSQL database!");
      
      await initDB(client);
      client.release();
      return; // Success
    } catch (err) {
      console.error(`❌ Database connection failed: ${err.message}`);
      if (i < retries - 1) {
        console.log("⏳ Retrying in 5 seconds...");
        await new Promise(res => setTimeout(res, 5000));
      }
    }
  }
  console.error("❌ Could not connect to database after multiple attempts. API endpoints requiring DB will fail.");
};

// Start DB connection in background
connectDB();

// 2. Initialize Table Schema
async function initDB(client) {
  try {
    // Note: In Postgres, use SERIAL for auto-incrementing IDs instead of AUTOINCREMENT
    await client.query(`
      CREATE TABLE IF NOT EXISTS uploads (
        id TEXT PRIMARY KEY,
        filename TEXT,
        upload_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        record_count INTEGER,
        total_amount DOUBLE PRECISION
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS cheques (
        id SERIAL PRIMARY KEY,
        upload_id TEXT,
        doc_number TEXT,
        series TEXT,
        amount DOUBLE PRECISION,
        due_date TEXT,
        operation_date TEXT,
        received_from TEXT,
        paid_to TEXT,
        status TEXT,
        bank TEXT,
        description TEXT,
        FOREIGN KEY(upload_id) REFERENCES uploads(id) ON DELETE CASCADE
      );
    `);
    
    // Creating indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cheques_upload_id ON cheques(upload_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cheques_due_date ON cheques(due_date);`);

    console.log("✅ Database schema verified.");
  } catch (err) {
    console.error("Failed to initialize database schema:", err);
  }
}

// 3. API Endpoints

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', database: 'postgres', time: result.rows[0].now });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// GET: Fetch cheques
app.get('/api/cheques', async (req, res) => {
  const { datasetId } = req.query;
  if (!datasetId) return res.json([]);
  
  try {
    // Postgres uses $1, $2 syntax for parameters
    const query = `
      SELECT 
        doc_number as "docNumber", 
        series,
        amount, 
        due_date as "dueDate", 
        operation_date as "operationDate",
        received_from as "receivedFrom", 
        paid_to as "paidTo",
        status, 
        bank, 
        description 
       FROM cheques 
       WHERE upload_id = $1 
       ORDER BY due_date ASC
    `;
    
    const result = await pool.query(query, [datasetId]);

    const formattedRows = result.rows.map((r, index) => ({
        ...r, 
        id: `${datasetId}-${index}`,
        amount: Number(r.amount)
    }));
    
    res.json(formattedRows);
  } catch (e) {
    console.error("Fetch Error:", e.message);
    res.status(500).json({ error: "Database fetch failed" });
  }
});

// POST: Bulk upload cheques
app.post('/api/cheques/bulk', async (req, res) => {
  const { cheques, datasetId, filename } = req.body;
  
  console.log(`📥 Received bulk upload request for ID: ${datasetId}, Count: ${cheques?.length}`);

  if (!datasetId || !Array.isArray(cheques)) {
    return res.status(400).json({ error: "Invalid Data received" });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN'); // Start Transaction

    // Clean up old upload if exists
    await client.query('DELETE FROM uploads WHERE id = $1', [datasetId]);

    const recordCount = cheques.length;
    const totalAmount = cheques.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    // Insert into uploads
    await client.query(`
      INSERT INTO uploads (id, filename, record_count, total_amount) 
      VALUES ($1, $2, $3, $4)
    `, [datasetId, filename || 'Unknown.xlsx', recordCount, totalAmount]);

    // Insert cheques loop
    const insertQuery = `
      INSERT INTO cheques (
        upload_id, doc_number, series, amount, due_date, operation_date, 
        received_from, paid_to, status, bank, description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    for (const c of cheques) {
      await client.query(insertQuery, [
        datasetId,
        c.docNumber || '',
        c.series || '',
        c.amount || 0,
        c.dueDate || '',
        c.operationDate || '',
        c.receivedFrom || '',
        c.paidTo || '',
        c.status || '',
        c.bank || '',
        c.description || ''
      ]);
    }

    await client.query('COMMIT'); // Commit Transaction
    
    console.log(`✅ Successfully imported ${recordCount} records.`);
    res.json({ success: true, count: recordCount });

  } catch (e) {
    await client.query('ROLLBACK'); // Rollback on error
    console.error("Bulk Upload Error:", e.message);
    res.status(500).json({ error: `Database Error: ${e.message}` });
  } finally {
    client.release();
  }
});

// 4. Serve Frontend (Must be AFTER API routes)
app.use(express.static(path.join(__dirname, 'dist')));

// Handle client-side routing for SPA
// Express 5 / path-to-regexp v6+ regex match for all routes
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});