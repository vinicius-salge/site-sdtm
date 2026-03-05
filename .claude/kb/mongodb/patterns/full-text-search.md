# Full-Text Search Pattern

> **Purpose**: Text search implementation with indexes and queries
> **MCP Validated**: 2026-02-06

## When to Use

- Searching article/blog content
- Product catalog search
- Document search functionality
- Autocomplete implementations

## Implementation

### Text Index Creation

```javascript
// Single field text index
await db.collection('articles').createIndex({ content: 'text' });

// Compound text index (multiple fields)
await db.collection('products').createIndex({
  name: 'text',
  description: 'text',
  tags: 'text'
}, {
  weights: {
    name: 10,        // Name matches are more important
    description: 5,
    tags: 3
  },
  default_language: 'english',
  name: 'ProductTextIndex'
});

// Compound index with text (text + regular field)
await db.collection('articles').createIndex({
  category: 1,
  content: 'text'
});
```

### Text Search Queries

```javascript
// Basic text search
const results = await db.collection('articles').find({
  $text: { $search: 'mongodb database' }
}).toArray();

// Text search with relevance scoring
const results = await db.collection('articles')
  .find({ $text: { $search: 'mongodb tutorial' } })
  .project({
    title: 1,
    content: 1,
    score: { $meta: 'textScore' }
  })
  .sort({ score: { $meta: 'textScore' } })
  .limit(10)
  .toArray();

// Phrase search (exact phrase)
const results = await db.collection('articles').find({
  $text: { $search: '"mongodb atlas"' }
}).toArray();

// Exclude terms
const results = await db.collection('articles').find({
  $text: { $search: 'mongodb -atlas' }  // Contains mongodb but NOT atlas
}).toArray();
```

### Advanced Text Search

```javascript
// Case and diacritic sensitive search
const results = await db.collection('articles').find({
  $text: {
    $search: 'café',
    $caseSensitive: true,
    $diacriticSensitive: true,
    $language: 'french'
  }
}).toArray();

// Aggregation with text search
const results = await db.collection('articles').aggregate([
  { $match: { $text: { $search: 'tutorial' } } },
  { $addFields: { score: { $meta: 'textScore' } } },
  { $sort: { score: -1 } },
  { $project: {
    title: 1,
    excerpt: { $substr: ['$content', 0, 200] },
    score: 1
  }},
  { $limit: 20 }
]).toArray();
```

### Autocomplete with Prefix Index

```javascript
// For autocomplete - create regular index on lowercase field
await db.collection('products').createIndex({ name_lower: 1 });

// Update documents to have lowercase field
await db.collection('products').updateMany(
  { name_lower: { $exists: false } },
  [{ $set: { name_lower: { $toLower: '$name' } } }]
);

// Autocomplete query
async function autocompleteProducts(prefix, limit = 10) {
  return await db.collection('products')
    .find({
      name_lower: { $regex: '^' + prefix.toLowerCase() }
    })
    .project({ name: 1, category: 1 })
    .limit(limit)
    .toArray();
}
```

## Configuration

| Option | Type | Description |
|--------|------|-------------|
| `weights` | Object | Field importance weights |
| `default_language` | String | Language for stemming |
| `language_override` | String | Field specifying document language |
| `textIndexVersion` | Number | Index version (3 is current) |

## Text Search Limitations

- One text index per collection
- Cannot sort by `$meta: 'textScore'` with other sort keys
- Text indexes can be large
- Stop words are ignored (the, a, an, etc.)
- Stemming reduces words to root form

## Example Usage

```javascript
// Blog search API
async function searchPosts(query, category, page = 1, pageSize = 20) {
  const matchStage = { $text: { $search: query } };
  
  if (category) {
    matchStage.category = category;
  }
  
  const pipeline = [
    { $match: matchStage },
    { $addFields: { searchScore: { $meta: 'textScore' } } },
    { $sort: { searchScore: -1, createdAt: -1 } },
    { $skip: (page - 1) * pageSize },
    { $limit: pageSize },
    { $project: {
      title: 1,
      slug: 1,
      excerpt: { $substr: ['$content', 0, 300] },
      author: 1,
      createdAt: 1,
      searchScore: 1
    }}
  ];
  
  const [posts, countResult] = await Promise.all([
    db.collection('posts').aggregate(pipeline).toArray(),
    db.collection('posts').countDocuments(matchStage)
  ]);
  
  return {
    posts,
    total: countResult,
    page,
    pageSize,
    totalPages: Math.ceil(countResult / pageSize)
  };
}
```

## See Also

- [indexes.md](../concepts/indexes.md)
- [aggregation-framework.md](../concepts/aggregation-framework.md)
- [pagination.md](pagination.md)
