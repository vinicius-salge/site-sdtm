# Realtime

> **Purpose**: WebSocket-based subscriptions for live database changes and broadcast events
> **Confidence**: 0.95
> **MCP Validated**: 2026-02-05

## Overview

Supabase Realtime enables live database subscriptions via WebSockets. Clients receive instant updates when data changes, supporting INSERT, UPDATE, DELETE events on tables and custom broadcast channels.

## The Pattern

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, anonKey)

// Subscribe to database changes
const channel = supabase
  .channel('invoices-changes')
  .on(
    'postgres_changes',
    {
      event: '*', // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'invoices',
      filter: 'user_id=eq.' + userId
    },
    (payload) => {
      console.log('Change received:', payload)
      // payload.new, payload.old, payload.eventType
    }
  )
  .subscribe()

// Unsubscribe when done
channel.unsubscribe()
```

## Quick Reference

| Event | Filter | Description |
|-------|--------|-------------|
| `INSERT` | None | New row created |
| `UPDATE` | `id=eq.123` | Row updated, matches filter |
| `DELETE` | `status=eq.active` | Row deleted |
| `*` | Any | All events |

## Broadcast Channels

```typescript
// Custom broadcast (not database-related)
const room = supabase.channel('room-1')

room
  .on('broadcast', { event: 'message' }, (payload) => {
    console.log('Received:', payload.payload)
  })
  .subscribe()

// Send broadcast
room.send({
  type: 'broadcast',
  event: 'message',
  payload: { text: 'Hello!' }
})
```

## Presence (Online Users)

```typescript
const room = supabase.channel('online-users')

room
  .on('presence', { event: 'sync' }, () => {
    const users = room.presenceState()
    console.log('Online users:', Object.keys(users).length)
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    console.log('User joined:', newPresences)
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await room.track({ user_id: currentUser.id, online_at: new Date() })
    }
  })
```

## Common Mistakes

### Wrong

```typescript
// Not handling subscription status
supabase.channel('table').on('postgres_changes', {}, callback).subscribe()
// May miss connection errors
```

### Correct

```typescript
// Always check subscription status
supabase
  .channel('table')
  .on('postgres_changes', {}, callback)
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Connected')
    } else if (status === 'CHANNEL_ERROR') {
      console.error('Connection failed')
    }
  })
```

## Configuration

```sql
-- Enable realtime for a table
ALTER TABLE public.invoices REPLICA IDENTITY FULL;

-- Check replication status
SELECT * FROM pg_publication_tables WHERE tablename = 'invoices';
```

## Related

- [database.md](database.md)
- [client-setup.md](../patterns/client-setup.md)
