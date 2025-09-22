// Quick PostgreSQL Connection Test
const { Pool } = require('pg');

async function checkPostgreSQL() {
  console.log('🔍 Checking PostgreSQL connection...\n');

  // Try to connect with the DATABASE_URL from .env
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ai_agent_system';
  
  console.log('📡 Connection string:', connectionString.replace(/:[^:@]*@/, ':***@'));

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ PostgreSQL connection successful!');

    // Test basic query
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('⏰ Current time:', result.rows[0].current_time);
    console.log('🐘 PostgreSQL version:', result.rows[0].pg_version.split(' ')[0] + ' ' + result.rows[0].pg_version.split(' ')[1]);

    // Check if our tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('tasks', 'memories', 'agents', 'workflows')
      ORDER BY table_name
    `);

    if (tablesResult.rows.length > 0) {
      console.log('📋 Existing tables:', tablesResult.rows.map(r => r.table_name).join(', '));
    } else {
      console.log('⚠️  No AI agent tables found - run setup script to create them');
    }

    client.release();
    await pool.end();

    console.log('\n🎉 PostgreSQL is ready for your AI Agent System!');
    console.log('💡 Next steps:');
    console.log('   1. Run: node scripts/setup-postgresql.js');
    console.log('   2. Start your AI agents: npm run dev');

  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    
    if (error.code === 'ECONNREFUSED') {
      console.log('   • PostgreSQL server is not running');
      console.log('   • Start PostgreSQL service or check if it\'s installed');
    } else if (error.code === 'ENOTFOUND') {
      console.log('   • Check hostname in DATABASE_URL');
      console.log('   • Ensure PostgreSQL is accessible');
    } else if (error.message.includes('authentication')) {
      console.log('   • Check username/password in DATABASE_URL');
      console.log('   • Verify PostgreSQL user permissions');
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.log('   • Database doesn\'t exist - run setup script to create it');
    }
    
    console.log('\n📖 See POSTGRESQL_SETUP.md for detailed setup instructions');
    process.exit(1);
  }
}

// Load environment variables
require('dotenv').config();

// Run check
checkPostgreSQL().catch(console.error);
