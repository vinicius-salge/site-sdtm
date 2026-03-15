import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Pool } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL nao configurada');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');

  try {
    await pool.query(sql);
    console.log('Migration executada com sucesso');
  } catch (err) {
    console.error('Erro na migration:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
