import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';

async function migrateInscricao() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL nao configurada');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // 1. Criar sequencia para numeros de inscricao
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS seq_numero_inscricao
        START WITH 1000
        INCREMENT BY 1
        NO MAXVALUE
    `);
    console.log('✓ Sequencia seq_numero_inscricao criada');

    // 2. Criar tabela de configuracoes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS configuracoes (
        chave VARCHAR(50) PRIMARY KEY,
        valor TEXT NOT NULL,
        descricao TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ Tabela configuracoes criada');

    // 3. Inserir prefixo padrao
    await pool.query(`
      INSERT INTO configuracoes (chave, valor, descricao)
      VALUES ('prefixo_inscricao', 'SDTM', 'Prefixo para numeros de inscricao')
      ON CONFLICT (chave) DO NOTHING
    `);
    console.log('✓ Prefixo padrao inserido');

    // 4. Adicionar coluna numero_inscricao na tabela users (se nao existir)
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'numero_inscricao'
    `);
    
    if (checkColumn.rows.length === 0) {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN numero_inscricao VARCHAR(20) UNIQUE
      `);
      console.log('✓ Coluna numero_inscricao adicionada na tabela users');
    } else {
      console.log('✓ Coluna numero_inscricao ja existe');
    }

    // 5. Criar indice para numero_inscricao
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_numero_inscricao 
      ON users(numero_inscricao)
    `);
    console.log('✓ Indice idx_users_numero_inscricao criado');

    console.log('\n✅ Migration de inscricao executada com sucesso!');
  } catch (err) {
    console.error('❌ Erro na migration:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateInscricao();
