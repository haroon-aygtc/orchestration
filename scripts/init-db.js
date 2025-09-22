// Simple database initialization script
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', '001_init.sql');

// Create database directory if it doesn't exist
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Read migration SQL
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Initialize database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Run migration
db.exec(migrationSQL, (err) => {
  if (err) {
    console.error('Error running migration:', err);
    process.exit(1);
  }
  console.log('✅ Database tables created successfully');
  
  // Close database
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('✅ Database initialization complete');
    }
  });
});
