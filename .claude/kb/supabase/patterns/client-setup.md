# Client Setup Pattern

> **Purpose**: Initialize and configure Supabase clients for different environments
> **MCP Validated**: 2026-02-05

## When to Use

- Initializing Supabase in web applications
- Server-side rendering with auth context
- React Native / mobile apps
- Python backend services
- Testing environments

## Implementation

### Browser/SPA

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'app-auth-token',
    storage: localStorage
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})
```

### Server-Side (Next.js/App Router)

```typescript
// lib/supabase-server.ts
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createServerClient() {
  const cookieStore = cookies()

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false
      },
      global: {
        headers: {
          cookie: cookieStore.toString()
        }
      }
    }
  )
}
```

### Python

```python
# supabase_client.py
from supabase import create_client, Client
import os

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

# Admin operations (server only)
service_key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
admin_client: Client = create_client(url, service_key)
```

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `persistSession` | true | Store session in storage |
| `autoRefreshToken` | true | Auto-refresh JWT before expiry |
| `detectSessionInUrl` | true | Parse auth callback URLs |
| `storageKey` | 'supabase.auth.token' | LocalStorage key |
| `eventsPerSecond` | 10 | Realtime rate limit |

## Example Usage

```typescript
// React hook pattern
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading, signOut: () => supabase.auth.signOut() }
}
```

## See Also

- [auth.md](../concepts/auth.md)
- [realtime.md](../concepts/realtime.md)
- [edge-functions.md](../concepts/edge-functions.md)
