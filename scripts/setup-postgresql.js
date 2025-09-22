// PostgreSQL Database Setup Script for AI Agent System
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupPostgreSQL() {
  console.log('🐘 Setting up PostgreSQL for AI Agent System...\n');

  // Database configuration
  const dbConfig = {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password', // Change this to your PostgreSQL password
    database: 'postgres' // Connect to default database first
  };

  const targetDatabase = 'ai_agent_system';

  try {
    // Step 1: Connect to PostgreSQL server
    console.log('1️⃣ Connecting to PostgreSQL server...');
    const client = new Client(dbConfig);
    await client.connect();
    console.log('✅ Connected to PostgreSQL server');

    // Step 2: Create database if it doesn't exist
    console.log('2️⃣ Creating database...');
    try {
      await client.query(`CREATE DATABASE ${targetDatabase}`);
      console.log(`✅ Database '${targetDatabase}' created successfully`);
    } catch (error) {
      if (error.code === '42P04') {
        console.log(`ℹ️  Database '${targetDatabase}' already exists`);
      } else {
        throw error;
      }
    }

    await client.end();

    // Step 3: Connect to the target database
    console.log('3️⃣ Connecting to target database...');
    const targetClient = new Client({
      ...dbConfig,
      database: targetDatabase
    });
    await targetClient.connect();
    console.log('✅ Connected to target database');

    // Step 4: Create tables using migration SQL
    console.log('4️⃣ Creating tables...');
    const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', '001_init.sql');
    
    if (fs.existsSync(migrationPath)) {
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      // Convert SQLite SQL to PostgreSQL SQL
      const postgresSQL = migrationSQL
        .replace(/TEXT NOT NULL PRIMARY KEY/g, 'TEXT PRIMARY KEY')
        .replace(/DATETIME/g, 'TIMESTAMP')
        .replace(/CURRENT_TIMESTAMP/g, 'NOW()')
        .replace(/INTEGER/g, 'INT')
        .replace(/BOOLEAN/g, 'BOOLEAN');
      
      await targetClient.query(postgresSQL);
      console.log('✅ Tables created successfully');
    } else {
      console.log('⚠️  Migration file not found, creating basic tables...');
      
      // Create basic tables
      await targetClient.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          status TEXT NOT NULL,
          input JSONB NOT NULL,
          output JSONB,
          error TEXT,
          "startedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "completedAt" TIMESTAMP,
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "agentId" TEXT,
          "parentId" TEXT,
          metadata JSONB
        );
      `);

      await targetClient.query(`
        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          key TEXT UNIQUE NOT NULL,
          value JSONB NOT NULL,
          context TEXT,
          "expiresAt" TIMESTAMP,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      await targetClient.query(`
        CREATE TABLE IF NOT EXISTS agents (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          type TEXT NOT NULL,
          status TEXT NOT NULL,
          config JSONB,
          state JSONB,
          "lastActive" TIMESTAMP NOT NULL DEFAULT NOW(),
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      console.log('✅ Basic tables created');
    }

    // Step 5: Create indexes for performance
    console.log('5️⃣ Creating indexes...');
    await targetClient.query('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);');
    await targetClient.query('CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);');
    await targetClient.query('CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks("createdAt");');
    await targetClient.query('CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);');
    await targetClient.query('CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);');
    await targetClient.query('CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);');
    console.log('✅ Indexes created');

    // Step 6: Insert sample data
    console.log('6️⃣ Inserting sample data...');
    await targetClient.query(`
      INSERT INTO agents (id, name, type, status, config, "createdAt", "updatedAt", "lastActive")
      VALUES 
        ('agent-intent-1', 'Intent Analysis Agent', 'intent', 'idle', '{"capabilities": ["nlp", "intent_classification"]}', NOW(), NOW(), NOW()),
        ('agent-retriever-1', 'Data Retrieval Agent', 'retriever', 'idle', '{"capabilities": ["db_search", "web_search"]}', NOW(), NOW(), NOW()),
        ('agent-workflow-1', 'Workflow Orchestration Agent', 'workflow', 'idle', '{"capabilities": ["process_design", "automation"]}', NOW(), NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    await targetClient.query(`
      INSERT INTO memories (id, key, value, context, "createdAt", "updatedAt")
      VALUES 
        ('mem-1', 'system_status', '{"initialized": true, "version": "1.0.0"}', 'system', NOW(), NOW()),
        ('mem-2', 'last_startup', '{"timestamp": "${new Date().toISOString()}"}', 'system', NOW(), NOW())
      ON CONFLICT (key) DO NOTHING;
    `);

    console.log('✅ Sample data inserted');

    await targetClient.end();

    console.log('\n🎉 PostgreSQL setup complete!');
    console.log('📋 Summary:');
    console.log(`   Database: ${targetDatabase}`);
    console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`   Tables: tasks, memories, agents, workflows, tool_executions, api_calls, sessions, config`);
    console.log(`   Connection URL: postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${targetDatabase}`);
    console.log('\n✅ Your AI Agent System now has a REAL PostgreSQL database!');

  } catch (error) {
    console.error('❌ PostgreSQL setup failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure PostgreSQL is installed and running');
    console.log('   2. Check your PostgreSQL credentials');
    console.log('   3. Ensure PostgreSQL is accepting connections on localhost:5432');
    process.exit(1);
  }
}

// Run setup
setupPostgreSQL().catch(console.error);
