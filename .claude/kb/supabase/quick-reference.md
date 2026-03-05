# Supabase Quick Reference

> Fast lookup tables. For code examples, see linked files.
> **MCP Validated**: 2026-02-05

## Client Setup

| Library | Install | Purpose |
|---------|---------|---------|
| `@supabase/supabase-js` | `npm install @supabase/supabase-js` | JavaScript/TypeScript client |
| `supabase-py` | `pip install supabase` | Python client |
| `supabase-flutter` | `flutter pub add supabase_flutter` | Flutter client |

## CRUD Operations

| Operation | Method | Example |
|-----------|--------|---------|
| Select | `.select()` | `supabase.from('users').select('*')` |
| Insert | `.insert()` | `supabase.from('users').insert({name: 'John'})` |
| Update | `.update()` | `supabase.from('users').update({name: 'Jane'}).eq('id', 1)` |
| Delete | `.delete()` | `supabase.from('users').delete().eq('id', 1)` |
| Upsert | `.upsert()` | `supabase.from('users').upsert({id: 1, name: 'John'})` |

## Auth Methods

| Operation | Method | Notes |
|-----------|--------|-------|
| Sign up | `supabase.auth.signUp({email, password})` | Creates user + optional confirmation |
| Sign in | `supabase.auth.signInWithPassword({email, password})` | Email/password auth |
| Sign out | `supabase.auth.signOut()` | Ends session |
| Get user | `supabase.auth.getUser()` | Current authenticated user |
| Reset password | `supabase.auth.resetPasswordForEmail(email)` | Sends reset link |

## Storage Operations

| Operation | Method | Example |
|-----------|--------|---------|
| Upload | `.upload()` | `supabase.storage.from('bucket').upload('path', file)` |
| Download | `.download()` | `supabase.storage.from('bucket').download('path')` |
| List | `.list()` | `supabase.storage.from('bucket').list('folder')` |
| Delete | `.remove()` | `supabase.storage.from('bucket').remove(['path'])` |
| Get URL | `.getPublicUrl()` | `supabase.storage.from('bucket').getPublicUrl('path')` |

## Realtime Channels

| Operation | Method | Example |
|-----------|--------|---------|
| Subscribe | `.channel()` | `supabase.channel('table-changes').on(...).subscribe()` |
| Unsubscribe | `.unsubscribe()` | `channel.unsubscribe()` |
| Broadcast | `.send()` | `channel.send({type: 'broadcast', event: 'message', payload: {}})` |

## Decision Matrix

| Use Case | Choose |
|----------|--------|
| Simple queries | `.select()` with filters |
| Complex joins | `.select('*, related_table(*)')` |
| Real-time updates | `.subscribe()` on channel |
| File uploads | Storage API with RLS policies |
| Server-side logic | Edge Functions |
| Vector search | pgvector extension |

## Common Pitfalls

| Do Not | Do Instead |
|--------|------------|
| Disable RLS for convenience | Write proper RLS policies |
| Store secrets in client code | Use Edge Functions for secrets |
| Query all columns always | Use `.select('col1, col2')` for efficiency |
| Ignore auth errors | Wrap auth calls in try/catch |
| Use service role key in frontend | Use anon key + RLS policies |

## SQL Quick Reference

| Task | SQL |
|------|-----|
| Enable RLS | `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;` |
| Create policy | `CREATE POLICY policy_name ON table_name FOR SELECT USING (auth.uid() = user_id);` |
| Create index | `CREATE INDEX idx_name ON table_name(column);` |
| Add column | `ALTER TABLE table_name ADD COLUMN column_name type;` |
| Create extension | `CREATE EXTENSION IF NOT EXISTS vector;` |

## Related Documentation

| Topic | Path |
|-------|------|
| Database Concepts | `concepts/database.md` |
| Auth Concepts | `concepts/auth.md` |
| RLS Patterns | `patterns/rls-policies.md` |
| Full Index | `index.md` |
