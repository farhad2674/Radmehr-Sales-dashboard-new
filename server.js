import express from 'express';
import path from 'path';
import cors from 'cors';
import fs from 'fs';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

// Reconstruct __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
// Increase payload limit for large Excel files - essential for 40K records
app.use(express.json({ limit: '100mb' }));

// Request Logger (Helps debug if requests are actually hitting this server)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// 1. Database Setup (SQLite)
// We store the DB in a 'data' folder. On Railway, mount a Volume to /app/data to persist this.
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`✅ Created data directory at: ${DATA_DIR}`);
  } catch (err) {
    console.error(`❌ Could not create data directory: ${err.message}`);
  }
}

const DB_PATH = path.join(DATA_DIR, 'cheques.db');
console.log(`📂 Database Path: ${DB_PATH}`);

let db;
try {
  db = new Database(DB_PATH);
  // Enable WAL mode for better concurrency and performance
  db.pragma('journal_mode = WAL'); 
  // Enable Foreign Keys enforcement
  db.pragma('foreign_keys = ON');
  
  console.log("✅ Successfully connected to SQLite database!");
  initDB();
} catch (err) {
  console.error("❌ Failed to initialize SQLite database.");
  console.error(`Error: ${err.message}`);
}

// 2. Initialize Table Schema
function initDB() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS uploads (
        id TEXT PRIMARY KEY,
        filename TEXT,
        upload_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        record_count INTEGER,
        total_amount REAL
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS cheques (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        upload_id TEXT,
        doc_number TEXT,
        series TEXT,
        amount REAL,
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
    
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cheques_upload_id ON cheques(upload_id);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cheques_due_date ON cheques(due_date);`);

    console.log("✅ Database schema verified.");
  } catch (err) {
    console.error("Failed to initialize database schema:", err);
  }
}

// 3. API Endpoints

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: 'sqlite' });
});

// GET: Fetch cheques
app.get('/api/cheques', (req, res) => {
  const { datasetId } = req.query;
  if (!datasetId) return res.json([]);
  
  try {
    const stmt = db.prepare(`
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
       WHERE upload_id = ? 
       ORDER BY due_date ASC
    `);
    
    const rows = stmt.all(datasetId);

    const formattedRows = rows.map((r, index) => ({
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
app.post('/api/cheques/bulk', (req, res) => {
  const { cheques, datasetId, filename } = req.body;
  
  console.log(`📥 Received bulk upload request for ID: ${datasetId}, Count: ${cheques?.length}`);

  if (!datasetId || !Array.isArray(cheques)) {
    return res.status(400).json({ error: "Invalid Data received" });
  }

  try {
    const runTransaction = db.transaction((data, id, file) => {
      db.prepare('DELETE FROM uploads WHERE id = ?').run(id);

      const recordCount = data.length;
      const totalAmount = data.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

      db.prepare(`
        INSERT INTO uploads (id, filename, record_count, total_amount) 
        VALUES (?, ?, ?, ?)
      `).run(id, file || 'Unknown.xlsx', recordCount, totalAmount);

      const insertStmt = db.prepare(`
        INSERT INTO cheques (
          upload_id, doc_number, series, amount, due_date, operation_date, 
          received_from, paid_to, status, bank, description
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const c of data) {
        insertStmt.run(
          id,
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
        );
      }
      
      return recordCount;
    });

    const count = runTransaction(cheques, datasetId, filename);
    console.log(`✅ Successfully imported ${count} records.`);
    res.json({ success: true, count });

  } catch (e) {
    console.error("Bulk Upload Error:", e.message);
    res.status(500).json({ error: `Database Error: ${e.message}` });
  }
});

// 4. Serve Frontend (Must be AFTER API routes)
app.use(express.static(path.join(__dirname, 'dist')));

// Handle client-side routing for SPA
// FIX: Express 5 / path-to-regexp v6+ does not support '*' as a wildcard. 
// We use a regex /.*/ match all remaining routes.
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`💾 Storage Mode: SQLite (Local)`);
});