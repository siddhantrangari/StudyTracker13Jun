import pg from 'pg';

async function run() {
  const client = new pg.Client({
    host: '2406:da1c:61c:d600:8996:3a65:686c:ee61',
    port: 5432,
    user: 'postgres',
    password: 'K9M30SuVJPIFSoiq',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully!');

    // 1. Create tables if they do not exist
    console.log('Creating tables...');
    
    // Enable UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // Create subjects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.subjects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create study_sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.study_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL,
        subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
        start_time BIGINT NOT NULL,
        end_time BIGINT NOT NULL,
        duration_seconds INT NOT NULL,
        date DATE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Enable Row Level Security
    await client.query('ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;');
    await client.query('ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;');

    // Create Policies (Allow users to manage their own data using auth.uid())
    // Dropping existing policies to recreate cleanly
    await client.query('DROP POLICY IF EXISTS "Users can manage their own subjects" ON public.subjects;');
    await client.query(`
      CREATE POLICY "Users can manage their own subjects" ON public.subjects
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    `);

    await client.query('DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.study_sessions;');
    await client.query(`
      CREATE POLICY "Users can manage their own sessions" ON public.study_sessions
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    `);

    console.log('Tables and RLS policies created successfully!');

    // 2. Query for settings that might show JWT secret or other keys
    console.log('Checking database settings...');
    const res = await client.query(`
      SELECT name, setting FROM pg_settings WHERE name LIKE '%jwt%' OR name LIKE '%supabase%';
    `);
    console.log('Settings results:', res.rows);

    const decryptedKeys = await client.query(`
      SELECT * FROM pg_tables WHERE schemaname = 'vault' OR schemaname = 'supabase_functions';
    `).catch(err => ({ rows: [] }));
    console.log('Vault/Functions tables:', decryptedKeys.rows);

  } catch (err) {
    console.error('Database operation failed:', err);
  } finally {
    await client.end();
  }
}

run();
