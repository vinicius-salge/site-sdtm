# Pagination Pattern

> **Purpose**: Efficient pagination strategies for large result sets
> **MCP Validated**: 2026-02-06

## When to Use

- Displaying large lists in pages
- API endpoints with pagination
- Infinite scroll implementations
- Data export with batching

## Implementation

### Offset-Based Pagination (Skip/Limit)

```javascript
// Simple but slow for large offsets
async function getPageOffset(collection, page, pageSize) {
  const skip = (page - 1) * pageSize;
  
  return await collection
    .find({})
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize)
    .toArray();
}

// Usage
const page1 = await getPageOffset(db.collection('posts'), 1, 20);
const page2 = await getPageOffset(db.collection('posts'), 2, 20);
```

### Cursor-Based Pagination (Recommended)

```javascript
// Efficient for large datasets - uses index
async function getPageCursor(collection, lastId, pageSize) {
  const query = lastId 
    ? { _id: { $gt: lastId } }  // Next page
    : {};  // First page
  
  return await collection
    .find(query)
    .sort({ _id: 1 })
    .limit(pageSize)
    .toArray();
}

// For APIs - encode cursor
async function getPageWithCursor(collection, cursor, pageSize) {
  const query = cursor 
    ? { _id: { $gt: ObjectId(Buffer.from(cursor, 'base64').toString()) } }
    : {};
  
  const docs = await collection
    .find(query)
    .sort({ _id: 1 })
    .limit(pageSize + 1)  // Get one extra to check if there's more
    .toArray();
  
  const hasMore = docs.length > pageSize;
  const results = hasMore ? docs.slice(0, -1) : docs;
  
  return {
    data: results,
    nextCursor: hasMore 
      ? Buffer.from(results[results.length - 1]._id.toString()).toString('base64')
      : null,
    hasMore
  };
}
```

### Range-Based Pagination (Date/Number)

```javascript
// Paginate by date - good for time-series
async function getPostsByDate(collection, lastDate, pageSize) {
  const query = lastDate 
    ? { createdAt: { $lt: new Date(lastDate) } }
    : {};
  
  return await collection
    .find(query)
    .sort({ createdAt: -1 })
    .limit(pageSize)
    .toArray();
}

// For ranked/scored content
async function getRankedPosts(collection, lastScore, pageSize) {
  const query = lastScore !== undefined 
    ? { score: { $lt: lastScore } }
    : {};
  
  return await collection
    .find(query)
    .sort({ score: -1, _id: -1 })  // Tie-breaker for consistent ordering
    .limit(pageSize)
    .toArray();
}
```

### Keyset Pagination with Multiple Fields

```javascript
// For complex sorting (e.g., sort by date, then by _id)
async function getPageKeyset(collection, lastDate, lastId, pageSize) {
  let query = {};
  
  if (lastDate && lastId) {
    query = {
      $or: [
        { createdAt: { $lt: new Date(lastDate) } },
        { 
          createdAt: new Date(lastDate),
          _id: { $lt: ObjectId(lastId) }
        }
      ]
    };
  }
  
  return await collection
    .find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(pageSize)
    .toArray();
}
```

## Configuration

| Approach | Best For | Limitation |
|----------|----------|------------|
| **Skip/Limit** | Small datasets (< 10k docs) | Slow for large offsets |
| **Cursor (_id)** | Large datasets, consistent order | Can't jump to arbitrary page |
| **Range (date/number)** | Time-series, sorted data | Requires appropriate index |
| **Search (text)** | Full-text search results | Requires text index |

## Example Usage

```javascript
// Express.js API with cursor pagination
app.get('/api/posts', async (req, res) => {
  const pageSize = parseInt(req.query.limit) || 20;
  const cursor = req.query.cursor;
  
  try {
    const result = await getPageWithCursor(
      db.collection('posts'),
      cursor,
      pageSize
    );
    
    res.json({
      posts: result.data,
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Client usage
// GET /api/posts?limit=20
// Response: { posts: [...], pagination: { nextCursor: "abc123", hasMore: true } }
// GET /api/posts?limit=20&cursor=abc123
```

## Required Indexes

```javascript
// For cursor-based (_id) - automatic, _id is always indexed

// For date-based pagination
await db.collection('posts').createIndex({ createdAt: -1 });

// For compound sorting
await db.collection('posts').createIndex({ score: -1, _id: -1 });
await db.collection('posts').createIndex({ createdAt: -1, _id: -1 });
```

## See Also

- [indexes.md](../concepts/indexes.md)
- [crud-operations.md](../concepts/crud-operations.md)
- [aggregation-framework.md](../concepts/aggregation-framework.md)
