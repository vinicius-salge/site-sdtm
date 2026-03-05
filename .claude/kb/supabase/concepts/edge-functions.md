# Edge Functions

> **Purpose**: Deno-based serverless functions for server-side logic and API endpoints
> **Confidence**: 0.95
> **MCP Validated**: 2026-02-05

## Overview

Supabase Edge Functions are Deno-based serverless functions that run close to your database. They provide a secure environment for server-side logic, third-party API calls, and operations requiring elevated privileges.

## The Pattern

```typescript
// supabase/functions/process-invoice/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { invoiceId } = await req.json()

    // Process with service role for elevated access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data, error } = await supabaseAdmin
      .from('invoices')
      .update({ status: 'processed' })
      .eq('id', invoiceId)

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
```

## Quick Reference

| Task | Code | Notes |
|------|------|-------|
| HTTP handler | `serve(async (req) => {...})` | Entry point |
| Env vars | `Deno.env.get('VAR')` | Set in dashboard |
| JSON response | `new Response(JSON.stringify(data))` | With content-type header |
| CORS | Add headers to response | Required for browser calls |
| Auth context | Pass Authorization header | User context from client |

## Common Mistakes

### Wrong

```typescript
// Exposing service role key in client-side code
const supabase = createClient(url, serviceRoleKey) // NEVER do this
```

### Correct

```typescript
// Use Edge Function for privileged operations
// Client calls:
const { data } = await supabase.functions.invoke('process-invoice', {
  body: { invoiceId: '123' }
})

// Edge Function uses service role internally
const supabaseAdmin = createClient(url, serviceRoleKey)
```

## Deployment

```bash
# Deploy function
supabase functions deploy process-invoice

# Deploy with secrets
supabase secrets set MY_API_KEY=xxx

# Invoke locally
supabase functions serve process-invoice

# Invoke via HTTP
curl -L -X POST 'https://<project>.supabase.co/functions/v1/process-invoice' \
  -H 'Authorization: Bearer <token>' \
  -d '{"invoiceId":"123"}'
```

## Related

- [auth.md](auth.md)
- [database.md](database.md)
- [client-setup.md](../patterns/client-setup.md)
