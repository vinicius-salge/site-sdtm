-- ============================================
-- SDTM Backend - Database Schema
-- Arquitetura "Cofre de Vidro"
-- ============================================

-- TABELA: users (Autenticacao Anonimizada)
-- NAO contem dados pessoais em texto
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(30) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    cpf_hash VARCHAR(64) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- TABELA: documents (PDFs Criptografados)
-- Contem apenas blobs binarios criptografados
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    encrypted_blob BYTEA NOT NULL,
    iv VARCHAR(32) NOT NULL,
    salt VARCHAR(32) NOT NULL,
    auth_tag VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    downloaded_at TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '2 years')
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);

-- TABELA: audit_logs (Compliance)
-- Logs de acoes SEM dados pessoais
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    ip_hash VARCHAR(64),
    user_agent_hash VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW()
);

-- FUNCAO: Limpeza automatica de documentos expirados
CREATE OR REPLACE FUNCTION cleanup_expired_documents()
RETURNS void AS $$
BEGIN
    DELETE FROM documents WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
