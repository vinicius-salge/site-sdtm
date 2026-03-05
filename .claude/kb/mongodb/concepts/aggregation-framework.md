# Aggregation Framework

> **Purpose**: Pipeline stages and operators
> **Confidence**: 0.95
> **MCP Validated**: 2026-02-06

## Overview

The aggregation framework processes data through multi-stage pipelines. Each stage transforms documents and passes results to the next stage. It's MongoDB's powerful alternative to SQL GROUP BY with support for complex data transformations.

## The Pattern

```javascript
// Sales analysis pipeline
const pipeline = [
  // Match stage - filter documents
  { $match: { status: 'completed', orderDate: { $gte: new Date('2024-01-01') } } },
  
  // Group stage - aggregate data
  { $group: {
    _id: { month: { $month: '$orderDate' }, category: '$category' },
    totalSales: { $sum: '$amount' },
    orderCount: { $sum: 1 },
    avgOrderValue: { $avg: '$amount' }
  }},
  
  // Sort stage
  { $sort: { '_id.month': 1, totalSales: -1 } },
  
  // Project stage - reshape output
  { $project: {
    _id: 0,
    month: '$_id.month',
    category: '$_id.category',
    totalSales: { $round: ['$totalSales', 2] },
    orderCount: 1,
    avgOrderValue: 1
  }},
  
  // Limit results
  { $limit: 100 }
];

const results = await db.collection('orders').aggregate(pipeline).toArray();
```

## Common Stages

| Stage | Purpose | Example |
|-------|---------|---------|
| `$match` | Filter documents | `{ $match: { status: 'active' } }` |
| `$group` | Aggregate by key | `{ $group: { _id: '$category', count: { $sum: 1 } } }` |
| `$project` | Reshape fields | `{ $project: { name: 1, total: { $add: ['$a', '$b'] } } }` |
| `$sort` | Order results | `{ $sort: { date: -1 } }` |
| `$limit` | Limit output | `{ $limit: 10 }` |
| `$skip` | Skip documents | `{ $skip: 20 }` |
| `$unwind` | Deconstruct array | `{ $unwind: '$tags' }` |
| `$lookup` | Left outer join | `{ $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } }` |
| `$facet` | Multi-sub-pipelines | `{ $facet: { byCategory: [...], byDate: [...] } }` |

## Accumulator Operators

| Operator | Purpose |
|----------|---------|
| `$sum` | Sum values |
| `$avg` | Average |
| `$min` / `$max` | Min/Max values |
| `$push` | Create array |
| `$addToSet` | Unique array |
| `$first` / `$last` | First/last in group |
| `$count` | Document count |

## Quick Reference

| Feature | Syntax | Notes |
|---------|--------|-------|
| Expression | `$field` or `$expression` | Access values |
| Literal | `{ $literal: '$price' }` | Escape $ |
| Condition | `{ $cond: { if: {}, then: {}, else: {} } }` | If-else |
| Date | `{ $month: '$date' }` | Extract date part |
| Array | `{ $size: '$array' }` | Array operations |

## Common Mistakes

### Wrong

```javascript
// $match after $group - inefficient
[
  { $group: { _id: '$category', total: { $sum: '$amount' } } },
  { $match: { status: 'active' } }  // Status filtered after grouping!
]

// Wrong accumulator syntax
{ $group: { _id: '$cat', total: '$amount' } }  // Missing $sum
```

### Correct

```javascript
// $match first for efficiency (uses indexes)
[
  { $match: { status: 'active' } },
  { $group: { _id: '$category', total: { $sum: '$amount' } } }
]

// Proper accumulator syntax
{ $group: { _id: '$category', total: { $sum: '$amount' } } }
```

## Related

- [indexes.md](indexes.md)
- [pagination.md](../patterns/pagination.md)
- [full-text-search.md](../patterns/full-text-search.md)
