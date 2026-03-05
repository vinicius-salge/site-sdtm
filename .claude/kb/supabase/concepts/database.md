# Database

> **Purpose**: PostgreSQL database with extensions, RLS, and advanced features
> **Confidence**: 0.95
> **MCP Validated**: 2026-02-05

## Overview

Supabase provides a full PostgreSQL database with additional features like Row Level Security (RLS), realtime subscriptions, and extensions. Every Supabase project is a dedicated PostgreSQL instance with superuser access.

## The Pattern

```sql
-- Create a table with RLS enabled
CREATE TABLE public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    vendor_name TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    invoice_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Enable Row Level Security
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create policy for users to see only their own data
CREATE POLICY "Users can view own invoices"
    ON public.invoices
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create policy for users to insert their own data
CREATE POLICY "Users can insert own invoices"
    ON public.invoices
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
```

## Quick Reference

| Feature | SQL/Command | Notes |
|---------|-------------|-------|
| UUID generation | `gen_random_uuid()` | Cryptographically secure |
| Timestamps | `NOW()` or `TIMESTAMPTZ` | UTC with timezone |
| JSON data | `JSONB` | Binary JSON, indexable |
| Full text search | `to_tsvector()` | Built-in search |
| Vector extension | `CREATE EXTENSION vector` | For AI/ML embeddings |

## Common Mistakes

### Wrong

```sql
-- No RLS enabled - all data is public
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    data TEXT
);
```

### Correct

```sql
-- RLS enabled with proper policies
CREATE TABLE invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    data TEXT
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own data" ON invoices
    FOR SELECT USING (auth.uid() = user_id);
```

## Extensions

```sql
-- Enable pgvector for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable PostGIS for geospatial data
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- List all extensions
SELECT * FROM pg_extension;
```

## Indexes

```sql
-- B-tree index for exact matches
CREATE INDEX idx_invoices_user_id ON invoices(user_id);

-- GIN index for JSONB queries
CREATE INDEX idx_invoices_metadata ON invoices USING GIN(metadata);

-- Partial index for common queries
CREATE INDEX idx_invoices_recent ON invoices(created_at)
    WHERE created_at > NOW() - INTERVAL '30 days';

-- Vector index for similarity search
CREATE INDEX idx_embeddings_vector ON embeddings
    USING ivfflat (embedding vector_cosine_ops);
```

## Related

- [auth.md](auth.md)
- [realtime.md](realtime.md)
- [rls-policies.md](../patterns/rls-policies.md)
- [migrations.md](../patterns/migrations.md)
