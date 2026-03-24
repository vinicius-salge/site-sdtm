import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';

async function migrateCadastroData() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL nao configurada');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const columns = [
      { name: 'data_encrypted_blob', type: 'BYTEA' },
      { name: 'data_iv', type: 'VARCHAR(32)' },
      { name: 'data_salt', type: 'VARCHAR(32)' },
      { name: 'data_auth_tag', type: 'VARCHAR(32)' },
      { name: 'version', type: 'INTEGER DEFAULT 1' },
      { name: 'updated_at', type: 'TIMESTAMP' },
    ];

    for (const col of columns) {
      const exists = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = $1
      `, [col.name]);

      if (exists.rows.length === 0) {
        await pool.query(`ALTER TABLE documents ADD COLUMN ${col.name} ${col.type}`);
        console.log(`✓ Coluna ${col.name} adicionada na tabela documents`);
      } else {
        console.log(`✓ Coluna ${col.name} ja existe`);
      }
    }

    console.log('\n✅ Migration de dados cadastrais executada com sucesso!');
  } catch (err) {
    console.error('❌ Erro na migration:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateCadastroData();
