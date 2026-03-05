# Indexes

> **Purpose**: Index types and optimization
> **Confidence**: 0.95
> **MCP Validated**: 2026-02-06

## Overview

Indexes support efficient query execution. Without indexes, MongoDB performs collection scans. Proper indexing is critical for performance at scale.

## The Pattern

```javascript
// Single field index
await db.collection('users').createIndex({ email: 1 });

// Compound index
await db.collection('orders').createIndex({ userId: 1, createdAt: -1 });

// Text index for search
await db.collection('articles').createIndex({ title: 'text', content: 'text' });

// Unique index
await db.collection('users').createIndex({ email: 1 }, { unique: true });

// Partial index
await db.collection('orders').createIndex(
  { userId: 1 },
  { partialFilterExpression: { status: 'pending' } }
);

// TTL index (auto-delete after 30 days)
await db.collection('sessions').createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 2592000 }
);
```

## Index Types

| Type | Use Case | Example |
|------|----------|---------|
| Single Field | Equality matches, sorting | `{field: 1}` |
| Compound | Multi-field queries | `{a: 1, b: -1}` |
| Multikey | Array fields | Auto-created on arrays |
| Text | Full-text search | `{content: 'text'}` |
| Hashed | Sharding | `{_id: 'hashed'}` |
| Geospatial | Location queries | `{location: '2dsphere'}` |
| Unique | Prevent duplicates | `{field: 1}, {unique: true}` |
| Sparse | Skip nulls | `{field: 1}, {sparse: true}` |
| Partial | Conditional index | With `partialFilterExpression` |
| TTL | Auto-expiry | With `expireAfterSeconds` |

## Quick Reference

| Command | Purpose |
|---------|---------|
| `createIndex()` | Create new index |
| `dropIndex()` | Remove index |
| `listIndexes()` | View all indexes |
| `explain()` | Analyze query plan |

## Index Properties

```javascript
// Compound index with options
await db.collection('products').createIndex(
  { category: 1, price: -1, name: 1 },
  {
    name: 'category_price_name_idx',
    background: true,           // Build in background
    unique: false,
    sparse: false,
    partialFilterExpression: { price: { $gt: 0 } }
  }
);
```

## Common Mistakes

### Wrong

```javascript
// Indexing low-cardinality field
await db.collection('users').createIndex({ status: 1 });  // Only 3 values

// Wrong sort order for query
// Query: find({a: 1, b: 2}).sort({b: 1})
await db.collection('data').createIndex({ a: 1, b: -1 });  // Wrong direction

// Too many indexes
// Each index adds write overhead and storage
```

### Correct

```javascript
// Index high-cardinality fields
await db.collection('users').createIndex({ email: 1 });

// Match query pattern
// Query: find({a: 1, b: 2}).sort({b: 1})
await db.collection('data').createIndex({ a: 1, b: 1 });  // Same direction

// Compound index: equality fields first, sort last
// Query: find({status: 'active'}).sort({createdAt: -1})
await db.collection('orders').createIndex({ status: 1, createdAt: -1 });
```

## Query Analysis

```javascript
// Check if query uses index
const explain = await db.collection('users')
  .find({ email: 'test@example.com' })
  .explain('executionStats');

console.log(explain.executionStats.totalDocsExamined);
console.log(explain.executionStats.executionTimeMillis);
```

## Related

- [crud-operations.md](crud-operations.md)
- [pagination.md](../patterns/pagination.md)
- [full-text-search.md](../patterns/full-text-search.md)
