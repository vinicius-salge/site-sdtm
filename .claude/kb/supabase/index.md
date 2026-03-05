# Supabase Knowledge Base

> **Purpose**: Open-source Firebase alternative providing PostgreSQL database, authentication, realtime subscriptions, storage, and Edge Functions
> **MCP Validated**: 2026-02-05

## Quick Navigation

### Concepts (< 150 lines each)

| File | Purpose |
|------|---------|
| [concepts/database.md](concepts/database.md) | PostgreSQL features, RLS, extensions |
| [concepts/auth.md](concepts/auth.md) | Authentication, JWT, providers |
| [concepts/realtime.md](concepts/realtime.md) | Realtime subscriptions |
| [concepts/storage.md](concepts/storage.md) | Object storage |
| [concepts/edge-functions.md](concepts/edge-functions.md) | Deno serverless functions |

### Patterns (< 200 lines each)

| File | Purpose |
|------|---------|
| [patterns/rls-policies.md](patterns/rls-policies.md) | Row Level Security patterns |
| [patterns/client-setup.md](patterns/client-setup.md) | Supabase client initialization |
| [patterns/migrations.md](patterns/migrations.md) | Database migration patterns |

---

## Quick Reference

- [quick-reference.md](quick-reference.md) - Fast lookup tables

---

## Key Concepts

| Concept | Description |
|---------|-------------|
| **PostgreSQL** | Full SQL database with JSON support, extensions |
| **Row Level Security** | Fine-grained access control per row |
| **Auth** | JWT-based auth with multiple providers |
| **Realtime** | WebSocket subscriptions for live data |
| **Storage** | S3-compatible object storage |
| **Edge Functions** | Deno-based serverless functions |

---

## Learning Path

| Level | Files |
|-------|-------|
| **Beginner** | concepts/database.md, concepts/auth.md |
| **Intermediate** | patterns/client-setup.md, patterns/rls-policies.md |
| **Advanced** | concepts/edge-functions.md, patterns/migrations.md |

---

## Agent Usage

| Agent | Primary Files | Use Case |
|-------|---------------|----------|
| python-developer | patterns/client-setup.md, patterns/rls-policies.md | Backend integration |
| infra-deployer | concepts/database.md, patterns/migrations.md | Database setup |

---

## Project Context

This KB supports projects requiring:
- PostgreSQL database with real-time capabilities
- Authentication and authorization
- File storage and management
- Serverless function execution
- Vector/AI support via pgvector
