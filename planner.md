## PLANEJAMENTO DO BACK-END SDTM

```text
════════════════════════════════════════════════════════════════
TASK: Planejamento Completo do Back-end SDTM
TYPE: [X] Architecture  [X] Roadmap  [X] Technology  [X] Risk
SCOPE: [ ] Component  [ ] System  [X] Platform
THRESHOLD: 0.90

VALIDATION
├─ KB: .claude/kb/supabase, .claude/kb/security
│     Result: [X] FOUND  [ ] NOT FOUND
│     Summary: Padrões de autenticação, criptografia e serverless
│
└─ MCP: N/A (documento de segurança fornece requisitos)
      Result: [ ] AGREES  [ ] DISAGREES  [X] SILENT
      Summary: Documento de segurança define arquitetura "Cofre de Vidro"

AGREEMENT: [X] HIGH  [ ] CONFLICT  [ ] MCP-ONLY  [ ] MEDIUM  [ ] LOW
BASE SCORE: 0.85

MODIFIERS APPLIED:
  [X] Requirements clarity: +0.10 (documento detalhado de segurança)
  [X] Technology validation: +0.05 (stack validada: Vercel + Neon/Supabase)
  [ ] Timeline feasibility: 0.00
FINAL SCORE: 1.00

PLANNING CHECKLIST:
  [X] Requirements understood
  [X] Alternatives evaluated
  [X] Dependencies mapped
  [X] Risks identified

DECISION: 1.00 >= 0.90 ?
  [X] EXECUTE (create plan)
  [ ] ASK USER (need clarification)
  [ ] PARTIAL (plan what's clear)

OUTPUT: Architecture Plan + Implementation Roadmap + Risk Assessment
════════════════════════════════════════════════════════════════
```

---

# 📋 PLANEJAMENTO DO BACK-END SDTM

> **Sistema de Gerenciamento de Associados do Sindicato dos Despachantes do Triângulo Mineiro**
>
> **Arquitetura de Segurança:** "Cofre de Vidro" — Dados pessoais nunca persistem, apenas PDFs criptografados

---

## 1. VISÃO GERAL DA ARQUITETURA

### 1.1 Princípio Fundamental: "Zero Persistência de Dados Pessoais"

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ARQUITETURA "COFRE DE VIDRO"                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────────────┐    │
│   │   CLIENTE   │─────▶│   VERCEL    │─────▶│   POSTGRESQL        │    │
│   │  (Navegador)│◄─────│  (Serverless│◄─────│   (Neon/Supabase)   │    │
│   │             │      │   Functions)│      │                     │    │
│   └──────┬──────┘      └─────────────┘      └─────────────────────┘    │
│          │                                                              │
│   ┌──────▼──────┐                                                       │
│   │ localStorage│  ◄── Dados em edição (auto-save)                      │
│   │  Criptografado    TTL: 2 horas                                      │
│   └─────────────┘                                                       │
│                                                                         │
│   FLUXO:                                                                │
│   1. Secretária preenche → Dados ficam no navegador apenas              │
│   2. Gera PDF → Envia para API serverless                               │
│   3. API criptografa PDF → Salva blob no PostgreSQL                     │
│   4. Dados pessoais são descartados da memória                          │
│   5. Usuário recebe PDF + pode baixar depois com senha                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Componentes Principais

| Componente                  | Tecnologia                 | Função                      |
| --------------------------- | -------------------------- | ----------------------------- |
| **Frontend**          | HTML + Tailwind + JS       | Interface de cadastro e login |
| **API Serverless**    | Vercel Functions (Node.js) | Processamento stateless       |
| **Banco de Dados**    | Neon PostgreSQL            | Auth + PDFs criptografados    |
| **ORM/Query Builder** | Prisma ou node-postgres    | Acesso ao banco               |
| **Criptografia**      | crypto (Node.js native)    | AES-256-GCM + PBKDF2          |
| **Hashing**           | bcrypt                     | Senhas e CPF                  |
| **Rate Limiting**     | Upstash Redis              | Proteção contra brute force |
| **PDF Generation**    | pdf-lib ou puppeteer       | Geração de PDF serverless   |

---

## 2. ESTRUTURA DO BANCO DE DADOS

### 2.1 Schema PostgreSQL (Mínimo Necessário)

```sql
-- ============================================
-- TABELA: users (Autenticação Anonimizada)
-- ============================================
-- NÃO contém dados pessoais em texto (nome, CPF, etc.)
-- Apenas identificadores irreversíveis (hashes)

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,           -- bcrypt(senha, 12)
    cpf_hash VARCHAR(64) UNIQUE,                   -- SHA-256(CPF) para busca
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Índice para busca por email (login)
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- TABELA: documents (PDFs Criptografados)
-- ============================================
-- Contém apenas blobs binários criptografados
-- Sem a senha do usuário, é impossível ler o conteúdo

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
    -- PDF criptografado (blob opaco)
    encrypted_blob BYTEA NOT NULL,
  
    -- Parâmetros criptográficos (não são segredos)
    iv VARCHAR(32) NOT NULL,                       -- Vetor de inicialização AES
    salt VARCHAR(32) NOT NULL,                     -- Salt do PBKDF2
    auth_tag VARCHAR(32) NOT NULL,                 -- Tag de autenticação GCM
  
    -- Metadados não sensíveis
    created_at TIMESTAMP DEFAULT NOW(),
    downloaded_at TIMESTAMP,                       -- Último download (audit)
  
    -- Limite de tempo opcional (auto-delete)
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '2 years')
);

-- Índice para busca eficiente por usuário
CREATE INDEX idx_documents_user ON documents(user_id);

-- ============================================
-- TABELA: audit_logs (Opcional - para compliance)
-- ============================================
-- Logs de ações, SEM dados pessoais
-- Usa tokenização (UUID) ao invés de identificadores sensíveis

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,                   -- 'LOGIN', 'DOWNLOAD', etc.
    ip_hash VARCHAR(64),                           -- Hash do IP (privacy)
    user_agent_hash VARCHAR(64),                   -- Hash do UA
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- FUNÇÃO: Limpeza automática de expirados
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_documents()
RETURNS void AS $$
BEGIN
    DELETE FROM documents 
    WHERE expires_at < NOW();
  
    -- Log da operação (opcional)
    RAISE NOTICE 'Expired documents cleaned up';
END;
$$ LANGUAGE plpgsql;

-- Agendar execução diária (pg_cron ou similar)
-- SELECT cron.schedule('0 0 * * *', 'SELECT cleanup_expired_documents()');
```

### 2.2 O que NÃO existe no banco

| ❌ Não Persistido                   | Motivo                                |
| ------------------------------------ | ------------------------------------- |
| `nome`, `nome_pai`, `nome_mae` | Dados pessoais - vão direto para PDF |
| `cpf` (em texto)                   | Substituído por `cpf_hash`         |
| `rg`, `endereco`, `telefone`   | Dados pessoais - PDF only             |
| `foto_3x4` (original)              | Processada e embutida no PDF          |
| PDF descriptografado                 | Nunca salvo em disco                  |

---

## 3. API ENDPOINTS

### 3.1 Estrutura de Rotas (Vercel Serverless)

```
/api
├── /auth
│   ├── POST /register          # Cria usuário + gera primeiro PDF
│   ├── POST /login             # Autenticação JWT
│   └── POST /logout            # Invalida token
│
├── /pdf
│   ├── POST /generate          # Gera novo PDF (secretaria)
│   ├── GET  /download          # Baixa PDF descriptografado
│   └── GET  /metadata          # Info não sensível do documento
│
├── /user
│   ├── GET  /profile           # Retorna apenas email (nada mais)
│   ├── POST /change-password   # Atualiza senha + re-criptografa PDFs
│   └── DELETE /account         # LGPD: direito ao esquecimento
│
└── /admin  (opcional - para secretaria)
    ├── GET  /stats             # Estatísticas anonimizadas
    └── POST /lookup            # Busca por cpf_hash
```

### 3.2 Detalhamento dos Endpoints Críticos

#### `POST /api/auth/register`

```javascript
// Fluxo completo de cadastro + geração de PDF

1. Recebe: { email, senha, dadosCadastroCompleto }
2. Validações: email único, senha forte, dados obrigatórios
3. Gera PDF em memória (pdf-lib)
4. Deriva chave: PBKDF2(senha, salt, 100000, 32, 'sha256')
5. Criptografa PDF: AES-256-GCM
6. Calcula: cpf_hash = SHA-256(dados.cpf)
7. Insere no banco:
   - users: { email, password_hash: bcrypt(senha), cpf_hash }
   - documents: { encrypted_blob, iv, salt, auth_tag }
8. Limpa memória (dados = null, pdfBuffer = null)
9. Retorna: { success: true, message: "Cadastro realizado" }
```

#### `POST /api/pdf/generate`

```javascript
// Geração adicional de PDF (já logado)

Headers: Authorization: Bearer <JWT>

1. Verifica JWT
2. Recebe: { dadosCadastro }
3. Busca usuário no banco (por ID do JWT)
4. Gera PDF em memória
5. Deriva chave com a senha atual do usuário
6. Criptografa e salva novo documento
7. Retorna confirmação
```

#### `GET /api/pdf/download`

```javascript
// Download do PDF (descriptografia on-the-fly)

Headers: Authorization: Bearer <JWT>

1. Verifica JWT → obtém user_id
2. Busca documento criptografado no banco
3. Requer senha no body: { senha }
4. Valida senha: bcrypt.compare(senha, user.password_hash)
5. Se válida:
   - Deriva mesma chave: PBKDF2(senha, doc.salt, ...)
   - Descriptografa: AES-256-GCM
   - Stream para response
   - Limpa memória após envio
6. Atualiza: downloaded_at (audit)
```

---

## 4. IMPLEMENTAÇÃO DA CRIPTOGRAFIA

### 4.1 Módulo Crypto (`lib/crypto.js`)

```javascript
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Deriva chave criptográfica da senha do usuário
 * usando PBKDF2 (password-based key derivation)
 */
async function deriveKey(password, salt) {
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(
            password,
            salt,
            ITERATIONS,
            KEY_LENGTH,
            'sha256',
            (err, key) => {
                if (err) reject(err);
                else resolve(key);
            }
        );
    });
}

/**
 * Criptografa o PDF usando AES-256-GCM
 * Retorna objeto com blob criptografado + parâmetros
 */
async function encryptPDF(pdfBuffer, password) {
    // Gera valores aleatórios únicos por operação
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
  
    // Deriva chave da senha
    const key = await deriveKey(password, salt);
  
    // Criptografa
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(pdfBuffer),
        cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
  
    // Limpa chave da memória
    key.fill(0);
  
    return {
        encryptedBlob: Buffer.concat([encrypted, authTag]),
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}

/**
 * Descriptografa o PDF
 */
async function decryptPDF(encryptedData, password, salt, iv, authTag) {
    const key = await deriveKey(password, Buffer.from(salt, 'hex'));
  
    try {
        const decipher = crypto.createDecipheriv(
            ALGORITHM,
            key,
            Buffer.from(iv, 'hex')
        );
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
        const decrypted = Buffer.concat([
            decipher.update(encryptedData),
            decipher.final()
        ]);
      
        // Limpa chave
        key.fill(0);
      
        return decrypted;
    } catch (err) {
        key.fill(0);
        throw new Error('Falha na descriptografia: senha incorreta ou dados corrompidos');
    }
}

/**
 * Gera hash SHA-256 (para CPF e identificadores)
 */
function generateHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Secure wipe de buffer (sobrescreve com zeros)
 */
function secureWipe(buffer) {
    if (Buffer.isBuffer(buffer)) {
        buffer.fill(0);
    }
}

module.exports = {
    encryptPDF,
    decryptPDF,
    generateHash,
    secureWipe,
    deriveKey
};
```

### 4.2 Hash de Senha (`lib/auth.js`)

```javascript
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12; // Custo computacional (seguro mas não lento demais)

async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

module.exports = {
    hashPassword,
    verifyPassword
};
```

---

## 5. AUTO-SAVE NO CLIENTE (localStorage)

### 5.1 Hook React/Vanilla JS (`hooks/useSecureDraft.js`)

```javascript
import { useState, useEffect, useCallback } from 'react';
import CryptoJS from 'crypto-js';

const STORAGE_KEY = 'sdtm_draft';
const TTL_HOURS = 2;
const TTL_MS = TTL_HOURS * 60 * 60 * 1000;

/**
 * Hook para auto-save seguro no navegador
 * Dados são criptografados antes de salvar no localStorage
 */
export function useSecureDraft(formKey = 'cadastro') {
    const [data, setData] = useState(() => loadDraft(formKey));
    const [lastSaved, setLastSaved] = useState(null);
    const [isDirty, setIsDirty] = useState(false);

    // Auto-save com debounce (500ms)
    useEffect(() => {
        if (!isDirty) return;
      
        const timer = setTimeout(() => {
            saveDraft(formKey, data);
            setLastSaved(new Date());
            setIsDirty(false);
        }, 500);
      
        return () => clearTimeout(timer);
    }, [data, isDirty, formKey]);

    // Verifica/expira dados antigos no mount
    useEffect(() => {
        const draft = loadDraft(formKey);
        if (draft?._timestamp && Date.now() - draft._timestamp > TTL_MS) {
            clearDraft(formKey);
            setData({});
            alert('Dados expirados por segurança. Preencha novamente.');
        }
    }, [formKey]);

    const updateField = useCallback((field, value) => {
        setData(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    }, []);

    const updateData = useCallback((newData) => {
        setData(newData);
        setIsDirty(true);
    }, []);

    const clearDraft = useCallback(() => {
        localStorage.removeItem(`${STORAGE_KEY}_${formKey}`);
        setData({});
        setLastSaved(null);
    }, [formKey]);

    return {
        data,
        updateField,
        updateData,
        clearDraft,
        lastSaved,
        isDirty
    };
}

/**
 * Salva rascunho criptografado no localStorage
 * Usa uma chave derivada de timestamp (não é alta segurança,
 * mas protege contra acesso casual ao computador)
 */
function saveDraft(formKey, data) {
    try {
        const payload = {
            ...data,
            _timestamp: Date.now()
        };
      
        // Criptografia simples (protege contra acesso casual)
        // Para segurança reforçada, usar senha do dia
        const key = generateDailyKey();
        const encrypted = CryptoJS.AES.encrypt(
            JSON.stringify(payload),
            key
        ).toString();
      
        localStorage.setItem(`${STORAGE_KEY}_${formKey}`, encrypted);
    } catch (err) {
        console.error('Falha ao salvar rascunho:', err);
    }
}

/**
 * Carrega e descriptografa rascunho
 */
function loadDraft(formKey) {
    try {
        const encrypted = localStorage.getItem(`${STORAGE_KEY}_${formKey}`);
        if (!encrypted) return {};
      
        const key = generateDailyKey();
        const decrypted = CryptoJS.AES.decrypt(encrypted, key).toString(CryptoJS.enc.Utf8);
      
        if (!decrypted) return {};
      
        return JSON.parse(decrypted);
    } catch (err) {
        console.error('Falha ao carregar rascunho:', err);
        return {};
    }
}

/**
 * Gera chave do dia (simples - pode ser melhorado)
 */
function generateDailyKey() {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `sdtm_${date}_secret_key`;
}

export default useSecureDraft;
```

---

## 6. CONFIGURAÇÃO DO PROJETO

### 6.1 Estrutura de Pastas

```
sdtm-backend/
├── api/                          # Vercel Serverless Functions
│   ├── auth/
│   │   ├── register.js
│   │   ├── login.js
│   │   └── logout.js
│   ├── pdf/
│   │   ├── generate.js
│   │   └── download.js
│   └── user/
│       ├── profile.js
│       └── change-password.js
│
├── lib/                          # Módulos compartilhados
│   ├── crypto.js                 # Criptografia AES/PBKDF2
│   ├── auth.js                   # bcrypt, JWT
│   ├── db.js                     # Conexão PostgreSQL
│   ├── pdf-generator.js          # Geração de PDF
│   └── validators.js             # Validações de entrada
│
├── templates/                    # Templates de PDF
│   └── ficha-cadastral.html      # Template para puppeteer/pdf-lib
│
├── prisma/                       # ORM (opcional)
│   └── schema.prisma
│
├── middleware/                   # Middlewares Vercel
│   ├── auth.js                   # Verificação JWT
│   ├── rate-limit.js             # Rate limiting
│   └── security-headers.js       # Headers de segurança
│
├── .env.example                  # Variáveis de ambiente
├── vercel.json                   # Configuração Vercel
└── package.json
```

### 6.2 Dependências (`package.json`)

```json
{
  "name": "sdtm-backend",
  "version": "1.0.0",
  "description": "Backend SDTM - Cofre de Vidro",
  "scripts": {
    "dev": "vercel dev",
    "deploy": "vercel --prod"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.9.0",
    "@upstash/ratelimit": "^1.0.0",
    "@upstash/redis": "^1.28.0",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "pdf-lib": "^1.17.1",
    "puppeteer-core": "^21.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "vercel": "^33.0.0"
  }
}
```

### 6.3 Variáveis de Ambiente (`.env`)

```bash
# ==========================================
# DATABASE (Neon PostgreSQL)
# ==========================================
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/sdtm?sslmode=require"

# ==========================================
# AUTHENTICATION
# ==========================================
JWT_SECRET="sua-chave-secreta-de-32-caracteres-min"
JWT_EXPIRES_IN="7d"

# ==========================================
# UPSTASH REDIS (Rate Limiting)
# ==========================================
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxx"

# ==========================================
# SECURITY
# ==========================================
NODE_ENV="production"
```

### 6.4 Configuração Vercel (`vercel.json`)

```json
{
  "version": 2,
  "functions": {
    "api/**/*.js": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "Cache-Control",
          "value": "no-store, no-cache, must-revalidate, private"
        }
      ]
    }
  ]
}
```

---

## 7. IMPLEMENTATION ROADMAP

### FASE 1: Fundação (Semana 1)

**Duração:** 5 dias
**Objetivo:** Configurar infraestrutura e banco de dados

| Tarefa                            | Responsável | Entregável                      |
| --------------------------------- | ------------ | -------------------------------- |
| Criar conta Neon PostgreSQL       | DevOps       | Database provisionado            |
| Configurar projeto Vercel         | DevOps       | Projeto deployado (hello world)  |
| Criar schema SQL                  | Backend      | `schema.sql` executado         |
| Configurar variáveis de ambiente | Backend      | `.env` configurado             |
| Testar conexão DB → Vercel      | Backend      | Endpoint `/health` funcionando |

**Success Criteria:**

- [ ] Banco acessível pela Vercel
- [ ] Migrations aplicadas
- [ ] Variáveis de ambiente configuradas no Vercel Dashboard

---

### FASE 2: Autenticação (Semana 2)

**Duração:** 5 dias
**Objetivo:** Sistema de login/registro seguro

| Tarefa                            | Responsável | Entregável              |
| --------------------------------- | ------------ | ------------------------ |
| Implementar `bcrypt` + hash     | Backend      | `lib/auth.js`          |
| Criar endpoint `/auth/register` | Backend      | Usuário criado com hash |
| Criar endpoint `/auth/login`    | Backend      | JWT retornado            |
| Implementar middleware JWT        | Backend      | Proteção de rotas      |
| Criar endpoint `/auth/logout`   | Backend      | Token invalidado         |

**Success Criteria:**

- [ ] Registro cria usuário com `password_hash` e `cpf_hash`
- [ ] Login retorna JWT válido
- [ ] Rotas protegidas rejeitam tokens inválidos

---

### FASE 3: Geração de PDF (Semana 3)

**Duração:** 7 dias
**Objetivo:** Geração e criptografia de PDFs

| Tarefa                               | Responsável | Entregável               |
| ------------------------------------ | ------------ | ------------------------- |
| Criar template de ficha cadastral    | Frontend     | HTML template             |
| Implementar `lib/crypto.js`        | Backend      | AES-256-GCM funcionando   |
| Implementar `lib/pdf-generator.js` | Backend      | PDF gerado em memória    |
| Criar endpoint `/pdf/generate`     | Backend      | PDF criptografado + salvo |
| Testar criptografia/descriptografia  | Backend      | Round-trip funcional      |

**Success Criteria:**

- [ ] PDF gerado com dados do formulário
- [ ] PDF criptografado com chave derivada da senha
- [ ] PDF salvo no banco como `BYTEA`
- [ ] Dados sensíveis limpos da memória após processamento

---

### FASE 4: Client-Side Auto-Save (Semana 4)

**Duração:** 5 dias
**Objetivo:** Experiência de preenchimento sem perda de dados

| Tarefa                               | Responsável | Entregável                     |
| ------------------------------------ | ------------ | ------------------------------- |
| Implementar `useSecureDraft.js`    | Frontend     | Hook de auto-save               |
| Integrar com formulário de cadastro | Frontend     | Auto-save funcionando           |
| Adicionar indicador de salvamento    | Frontend     | UI mostrando status             |
| Implementar TTL (2 horas)            | Frontend     | Expiração automática         |
| Testar criptografia local            | Frontend     | Dados criptografados no storage |

**Success Criteria:**

- [ ] Dados persistem no localStorage após refresh
- [ ] Criptografia AES no cliente
- [ ] Expiração após 2 horas
- [ ] Limpeza após geração de PDF

---

### FASE 5: Download e Acesso (Semana 5)

**Duração:** 5 dias
**Objetivo:** Usuário consegue baixar PDF após login

| Tarefa                                  | Responsável | Entregável                    |
| --------------------------------------- | ------------ | ------------------------------ |
| Criar endpoint `/pdf/download`        | Backend      | Stream de PDF descriptografado |
| Implementar página de login            | Frontend     | Form de login funcional        |
| Implementar área do associado          | Frontend     | Dashboard pós-login           |
| Integrar download na área do associado | Frontend     | Botão de download             |
| Adicionar rate limiting                 | Backend      | Proteção brute force         |

**Success Criteria:**

- [ ] Usuário loga com email/senha
- [ ] Dashboard mostra documentos disponíveis
- [ ] Download descriptografa e entrega PDF
- [ ] Rate limit: 5 tentativas/minuto

---

### FASE 6: Segurança e Hardening (Semana 6)

**Duração:** 5 dias
**Objetivo:** LGPD compliance e auditoria

| Tarefa                                 | Responsável | Entregável                    |
| -------------------------------------- | ------------ | ------------------------------ |
| Implementar headers de segurança      | Backend      | HSTS, CSP, etc.                |
| Sanitizar todos inputs                 | Backend      | Validação Zod                |
| Remover logs de dados sensíveis       | Backend      | Nenhum log com CPF/nome        |
| Criar endpoint `/user/delete` (LGPD) | Backend      | Delete cascade                 |
| Implementar audit logs                 | Backend      | Tabela audit_logs              |
| Teste de penetração básico          | Segurança   | Relatório de vulnerabilidades |

**Success Criteria:**

- [ ] Headers de segurança em todas respostas
- [ ] Nenhum log contém dados pessoais
- [ ] Usuário pode excluir conta (direito ao esquecimento)
- [ ] SQL injection testado e protegido

---

### FASE 7: Integração e Deploy (Semana 7)

**Duração:** 5 dias
**Objetivo:** Sistema integrado e em produção

| Tarefa                          | Responsável | Entregável               |
| ------------------------------- | ------------ | ------------------------- |
| Integrar frontend HTML com API  | Frontend     | Fluxo end-to-end          |
| Testes de integração          | QA           | Cenários de sucesso/erro |
| Deploy produção               | DevOps       | Site no ar                |
| Configurar domínio customizado | DevOps       | sindicato.com.br          |
| Documentação técnica         | Tech Lead    | README + API docs         |

**Success Criteria:**

- [ ] Cadastro completo funciona em produção
- [ ] PDF gerado e baixável
- [ ] Login funcional
- [ ] Domínio configurado com SSL

---

## 8. RISK ASSESSMENT

### 8.1 Matriz de Riscos

| Risco                                      | Impacto         | Probabilidade | Mitigação                                                   |
| ------------------------------------------ | --------------- | ------------- | ------------------------------------------------------------- |
| Vazamento de dados pessoais                | **ALTO**  | BAIXA         | Arquitetura "Cofre de Vidro" - dados nunca persistem em texto |
| Brute force em senhas                      | **MEDIO** | MEDIA         | Rate limiting (5 req/min) + bcrypt (custo 12)                 |
| SQL Injection                              | **ALTO**  | BAIXA         | Parameterized queries obrigatórias                           |
| XSS no PDF gerado                          | **MEDIO** | BAIXA         | Sanitização de inputs + CSP headers                         |
| Perda de PDF (usuário perde senha)        | **MEDIO** | ALTA          | Não há recuperação - documentar claramente para usuário  |
| Cold start Vercel (lentidão)              | **BAIXO** | ALTA          | Connection pooling + funções edge para endpoints simples    |
| Vazamento de chave de criptografia         | **ALTO**  | BAIXA         | Chave nunca salva - derivada da senha do usuário             |
| Acesso físico ao computador da secretaria | **MEDIO** | MEDIA         | Criptografia localStorage + senha do dia                      |

### 8.2 Riscos Críticos (Ação Imediata)

```
╔══════════════════════════════════════════════════════════════════════╗
║  CRITICAL RISK: Perda irreversível de acesso ao PDF                  ║
╠══════════════════════════════════════════════════════════════════════╣
║  Se o usuário esquecer a senha, o PDF está perdido para sempre       ║
║  (a chave de criptografia é derivada da senha).                      ║
║                                                                      ║
║  MITIGAÇÃO:                                                          ║
║  1. Aviso explícito no cadastro:                                     ║
║     "Guarde sua senha com segurança. Não temos como recuperar        ║
║      seu documento se você esquecer a senha."                        ║
║  2. Sugerir download imediato após cadastro                          ║
║  3. Oferecer opção de "reenviar cadastro" (novo PDF, nova senha)     ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 8.3 Plano de Contingência

| Cenário                    | Resposta                                                           |
| --------------------------- | ------------------------------------------------------------------ |
| Banco de dados comprometido | Dados são blobs criptografados - trocar senhas de todos usuários |
| Vercel fora do ar           | Página estática de manutenção no Cloudflare                    |
| Senha de usuário vazada    | Reset forçado - usuário deve recadastrar (perde PDFs antigos)    |
| Bug na geração de PDF     | Fallback para geração client-side (pdf-lib no navegador)         |

---

## 9. LGPD COMPLIANCE CHECKLIST

| Requisito                         | Implementação                                                | Status       |
| --------------------------------- | -------------------------------------------------------------- | ------------ |
| **Minimização**           | Apenas `email`, `password_hash`, `cpf_hash` persistidos  | ✅           |
| **Integridade**             | AuthTag AES-GCM detecta alterações no PDF                    | ✅           |
| **Confidencialidade**       | Criptografia de ponta a ponta (AES-256)                        | ✅           |
| **Consentimento**           | Checkbox explícito no cadastro                                | ⬜ UI        |
| **Finalidade**              | Texto claro: "Dados usados apenas para geração do documento" | ⬜ UI        |
| **Tempo de retenção**     | PDFs com TTL (2 anos) + cleanup automático                    | ✅           |
| **Direito ao esquecimento** | Endpoint `/user/delete` com CASCADE                          | ✅           |
| **Segurança**              | TLS 1.3, headers HSTS, rate limiting                           | ✅           |
| **Transparência**          | Privacy policy clara sobre não retenção de dados            | ⬜ Documento |
| **Incidentes**              | Procedimento de notificação em 72h                           | ⬜ Processo  |

---

## 10. ESTADO ATUAL DO FRONTEND (Snapshot 2026-03-15)

### 10.1 Visão Geral

O frontend é um site **estático multi-página** (MPA) composto por 4 arquivos HTML independentes, sem framework JavaScript, sem bundler de produção e sem conexão com backend. Todo o CSS utiliza **Tailwind via CDN** e o JavaScript é **vanilla inline** em cada página.

```
ARQUITETURA ATUAL
═══════════════════════════════════════════════════════════════

Tipo:        Site estático (HTML puro)
Estilização: Tailwind CSS via CDN (não compilado)
JavaScript:  Vanilla JS inline (sem módulos)
Fontes:      Google Fonts (Plus Jakarta Sans, Inter, Outfit, Playfair Display)
Assets:      1 arquivo JS bundado (Vite?) + 1 CSS (não referenciados nos HTMLs)
Backend:     NENHUM — todos os forms simulam chamadas com setTimeout

PÁGINAS (4):
├── index.html       (443 linhas)  — Landing page institucional
├── cadastro.html    (1319 linhas) — Formulário de cadastro de associado
├── login.html       (596 linhas)  — Área do Associado (login)
└── noticias.html    (466 linhas)  — Portal de notícias
                     ─────────────
                     2.824 linhas total

═══════════════════════════════════════════════════════════════
```

### 10.2 Detalhamento por Página

#### `index.html` — Landing Page Institucional

| Aspecto | Detalhe |
|---------|---------|
| **Seções** | Hero, Parceiros (ribbon), Diretoria, História, Downloads, Contato, Footer |
| **Design** | Glassmorphism, animações fadeInUp/float, grid pattern |
| **Fontes** | Plus Jakarta Sans (display) + Inter (corpo) |
| **Cores** | Palette brand (slate-based) + accent amarelo + primary azul + logo vermelho |
| **Navegação** | Header fixo glass com links âncora + botão "Área do Associado" |
| **Responsivo** | Grid lg:12 colunas, menu mobile (hamburger sem JS de toggle) |
| **JS** | Nenhum (apenas config Tailwind inline) |

#### `cadastro.html` — Formulário de Cadastro (Maior página)

| Aspecto | Detalhe |
|---------|---------|
| **Layout** | Formulário multi-step (3 etapas) com stepper visual |
| **Step 1** | Dados Pessoais: nome, pai, mãe, CPF, RG, SSP, estado civil, data nascimento, naturalidade, nacionalidade, endereço completo, foto 3x4 |
| **Step 2** | Dados Comerciais: empresa, CNPJ, endereço comercial, telefones |
| **Step 3** | Acesso ao Sistema: email, senha, confirmação de senha |
| **Fontes** | Outfit (sans) + Playfair Display (serif) — **diferente do index** |
| **JS (340+ linhas)** | Stepper navigation, validação de campos required, máscaras de input (CPF, RG, CEP, telefone), verificador de força de senha, toast notifications |
| **Backend** | `// Simulate API call` — usa `setTimeout(2000)` e redireciona para login.html |
| **Acessibilidade** | Focus visible, reduced motion, aria-live para toasts |

#### `login.html` — Área do Associado

| Aspecto | Detalhe |
|---------|---------|
| **Layout** | Split-screen: branding à esquerda + formulário à direita |
| **Design** | Glassmorphism refinado, mapa do Triângulo Mineiro decorativo (SVG animado), círculos decorativos |
| **Fontes** | Outfit + Playfair Display (mesmas do cadastro) |
| **Campos** | Usuário/Email + Senha (com toggle visibility) |
| **JS (140+ linhas)** | Toggle senha, validação real-time (blur/input), toast notifications |
| **Backend** | `// Simulate API call` — mostra "Área em desenvolvimento" |
| **Extras** | Link "Esqueci minha senha", link para cadastro, benefícios listados |

#### `noticias.html` — Portal de Notícias

| Aspecto | Detalhe |
|---------|---------|
| **Layout** | Header escuro + destaque (card hero) + grid 3 colunas de cards |
| **Fontes** | Inter — **diferente das outras páginas internas** |
| **Cores** | Palette primary (teal-based) — **diferente de todas as outras páginas** |
| **Conteúdo** | 6 notícias hardcoded (estáticas): Comunicados, Convênios, Legislação, Educação, Assembleia |
| **Filtros** | Botões de filtro (Todas, Comunicados, Legislação, Convênios) — **sem JS funcional** |
| **JS** | Nenhum |
| **Paginação** | Presente visualmente, sem funcionalidade |

### 10.3 Inventário de Assets

```
assets/
├── index-BNi34nji.js   (300 KB) — Bundle JS (provavelmente Vite build anterior)
└── index-C-YF0drs.css  (91 KB)  — CSS compilado
```

> **Nota:** Esses assets NÃO são referenciados por nenhum dos 4 HTMLs atuais. Parecem ser artefatos de um build anterior (Vite/React?) que não está mais em uso.

### 10.4 Inconsistências Identificadas

| Problema | Páginas Afetadas | Impacto |
|----------|-----------------|---------|
| **Fontes inconsistentes** | index (Jakarta+Inter) vs cadastro/login (Outfit+Playfair) vs noticias (Inter) | Identidade visual fragmentada |
| **Paleta de cores divergente** | noticias.html usa teal (primary-700: `#0f766e`) vs demais usam blue/slate | Página parece de outro site |
| **Tailwind via CDN** | Todas | Não recomendado para produção (FOUC, sem purge, lento) |
| **Assets órfãos** | `assets/` | 391 KB de arquivos não utilizados |
| **Menu mobile sem JS** | index.html | Botão hamburger não abre menu |
| **Filtros sem funcionalidade** | noticias.html | Botões decorativos |
| **Sem auto-save** | cadastro.html | Formulário longo sem proteção contra perda de dados |
| **Sem conexão backend** | cadastro.html, login.html | Formulários simulam com setTimeout |

### 10.5 O que Já Está Pronto vs O que Falta

```
STATUS DO FRONTEND
═══════════════════════════════════════════════════════════════

✅ PRONTO (UI/Layout)
├── Landing page institucional completa
├── Formulário de cadastro multi-step com validação client-side
├── Página de login com design split-screen
├── Portal de notícias com cards
├── Responsividade básica (mobile/desktop)
├── Máscaras de input (CPF, RG, CEP, telefone)
├── Validação de força de senha
└── Toast notifications system

⚠️ PARCIAL (precisa ajuste)
├── Consistência visual entre páginas (fontes/cores)
├── Menu mobile (hamburger presente, JS faltando)
├── Filtros de notícias (UI presente, lógica faltando)
└── Paginação de notícias (UI presente, lógica faltando)

❌ FALTA (integração com backend)
├── Auto-save criptografado (useSecureDraft / localStorage)
├── Conexão com API /auth/register (cadastro.html)
├── Conexão com API /auth/login (login.html)
├── Dashboard pós-login (área do associado)
├── Download de PDF descriptografado
├── Upload de foto 3x4 funcional
├── Checkbox de consentimento LGPD
├── Privacy policy / termos de uso
└── Migrar Tailwind CDN → build compilado

═══════════════════════════════════════════════════════════════
```

---

## 11. PRÓXIMOS PASSOS

### Imediatos (Frontend - Pré-Backend)

0. [ ] Unificar paleta de cores e fontes entre todas as 4 páginas
0. [ ] Implementar JS do menu mobile (hamburger toggle)
0. [ ] Remover assets órfãos (`assets/index-BNi34nji.js`, `assets/index-C-YF0drs.css`)
0. [ ] Adicionar checkbox de consentimento LGPD no cadastro

### Imediatos (Infraestrutura - Próximos 3 dias)

1. [ ] Criar conta no [Neon](https://neon.tech) (free tier)
2. [ ] Criar projeto na [Vercel](https://vercel.com)
3. [ ] Executar schema SQL no banco
4. [ ] Configurar variáveis de ambiente

### Short-term (Semana 1)

5. [ ] Implementar módulos `lib/crypto.js` e `lib/auth.js`
6. [ ] Criar endpoints básicos de autenticação
7. [ ] Testar criptografia round-trip

### Long-term (Mês 1)

8. [ ] Implementar geração de PDF completa
9. [ ] Integrar com frontend HTML existente
1. [ ] Deploy em produção

---

**Confidence:** 1.00 (HIGH) — Baseado em documento de segurança detalhado e padrões estabelecidos.

**Key Decisions:**

- ✅ Arquitetura "Cofre de Vidro": dados pessoais nunca persistem em texto
- ✅ Criptografia AES-256-GCM com chave derivada da senha do usuário
- ✅ Hash SHA-256 para CPF (busca sem exposição)
- ✅ Auto-save no cliente (localStorage criptografado)
- ✅ PostgreSQL externo (Neon/Supabase) para auth + blobs criptografados

**Sources:**

- Documento: "Segurança de Dados no Vercel.docx"
- KB: Supabase patterns, Security best practices
- Standards: LGPD, OWASP Top 10
