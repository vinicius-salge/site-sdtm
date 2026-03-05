# Auth

> **Purpose**: JWT-based authentication with multiple providers and Row Level Security integration
> **Confidence**: 0.95
> **MCP Validated**: 2026-02-05

## Overview

Supabase Auth provides secure JWT-based authentication with support for email/password, OAuth providers, magic links, and phone auth. JWTs are automatically validated by PostgreSQL RLS policies for secure data access.

## The Pattern

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

// Sign up with email/password
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password-123'
})

// Sign in
const { data: { session }, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password-123'
})

// Get current user
const { data: { user } } = await supabase.auth.getUser()

// Sign out
await supabase.auth.signOut()
```

## Quick Reference

| Provider | Method | Notes |
|----------|--------|-------|
| Email/Password | `signUp()` / `signInWithPassword()` | Requires email confirmation by default |
| OAuth | `signInWithOAuth({provider: 'google'})` | Redirects to provider |
| Magic Link | `signInWithOtp({email})` | Passwordless login |
| Phone | `signInWithOtp({phone})` | SMS verification |

## JWT Structure

```json
{
  "sub": "user-uuid",
  "aud": "authenticated",
  "role": "authenticated",
  "email": "user@example.com",
  "exp": 1234567890,
  "iat": 1234567800
}
```

## RLS Integration

```sql
-- Get current user ID in PostgreSQL
SELECT auth.uid();

-- Check if user is authenticated
SELECT auth.role() = 'authenticated';

-- Policy using JWT claims
CREATE POLICY "Users access own data"
    ON public.profiles
    FOR ALL
    USING (auth.uid() = id);

-- Policy for admin access
CREATE POLICY "Admins access all data"
    ON public.profiles
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');
```

## Common Mistakes

### Wrong

```typescript
// Storing session in localStorage without security considerations
const session = await supabase.auth.getSession()
localStorage.setItem('session', JSON.stringify(session))
```

### Correct

```typescript
// Let Supabase handle session persistence securely
// Configure in client creation
const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    storageKey: 'app-session',
    storage: localStorage // or custom storage
  }
})
```

## Server-Side Auth

```python
from supabase import create_client

# Initialize with service role for admin operations
supabase = create_client(url, service_role_key)

# Create user (admin only)
auth_response = supabase.auth.admin.create_user({
    "email": "user@example.com",
    "password": "temp-password",
    "email_confirm": True
})

# Get user by ID
user = supabase.auth.admin.get_user_by_id(user_id)
```

## Related

- [database.md](database.md)
- [rls-policies.md](../patterns/rls-policies.md)
- [client-setup.md](../patterns/client-setup.md)
