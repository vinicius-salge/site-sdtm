# Schema Design Pattern

> **Purpose**: Embedding vs referencing patterns for optimal data modeling
> **MCP Validated**: 2026-02-06

## When to Use

- Designing new collections and relationships
- Optimizing read vs write performance
- Deciding between data duplication and references
- Modeling one-to-many and many-to-many relationships

## Implementation

### Embedding Pattern (1:1 and 1:Few)

```javascript
// User with embedded addresses (1:few relationship)
const userSchema = {
  _id: ObjectId(),
  name: "John Doe",
  email: "john@example.com",
  // Embedded - accessed together
  addresses: [
    {
      street: "123 Main St",
      city: "Boston",
      state: "MA",
      zip: "02101",
      isDefault: true
    },
    {
      street: "456 Oak Ave",
      city: "Cambridge",
      state: "MA",
      zip: "02139"
    }
  ],
  preferences: {
    newsletter: true,
    notifications: { email: true, sms: false }
  }
};

// Query - single read gets all data
const user = await db.collection('users').findOne({ _id: userId });
```

### Referencing Pattern (1:Many and Many:Many)

```javascript
// Users collection
const user = {
  _id: ObjectId(),
  name: "John Doe",
  email: "john@example.com"
};

// Orders collection - references user
const order = {
  _id: ObjectId(),
  userId: ObjectId("507f1f77bcf86cd799439011"),  // Reference to user
  items: [...],
  total: 150.00,
  createdAt: new Date()
};

// Query with $lookup (join)
const userOrders = await db.collection('orders').aggregate([
  { $match: { userId: ObjectId("507f1f77bcf86cd799439011") } },
  { $lookup: {
    from: 'users',
    localField: 'userId',
    foreignField: '_id',
    as: 'user'
  }},
  { $unwind: '$user' }
]).toArray();
```

### Bucketing Pattern (Large Arrays)

```javascript
// Instead of unbounded comments array in post
// Use separate bucket documents

// posts collection
const post = {
  _id: ObjectId(),
  title: "My Post",
  content: "...",
  commentCount: 150,
  commentBuckets: 3  // Number of buckets
};

// comments collection with bucketing
const commentBucket = {
  _id: ObjectId(),
  postId: ObjectId("..."),
  bucketNumber: 1,
  count: 50,
  comments: [
    { userId: ObjectId("..."), text: "...", createdAt: new Date() },
    // ... up to 50 comments per bucket
  ]
};

// Query specific bucket
const bucket = await db.collection('comments').findOne({
  postId: postId,
  bucketNumber: 1
});
```

## Configuration

| Pattern | When to Use | Trade-off |
|---------|-------------|-----------|
| **Embedding** | Data accessed together, < 16MB | Fast reads, larger documents |
| **Referencing** | Data accessed separately, many-to-many | Flexible, requires joins |
| **Bucketing** | Large arrays, pagination needed | Balanced size vs queries |
| **Subset** | Frequently + rarely accessed data | Fast common queries |

## Example Usage

```javascript
// E-commerce schema combining patterns

// Product (mostly static, embedded reviews summary)
const product = {
  _id: ObjectId(),
  sku: "PROD-001",
  name: "Laptop",
  price: 999.99,
  // Embedded summary
  reviewStats: {
    averageRating: 4.5,
    count: 127
  },
  // Referenced detailed reviews (too many to embed)
  topReviews: [
    { reviewId: ObjectId("..."), rating: 5, summary: "Great!" }
  ]
};

// Full reviews in separate collection
const review = {
  _id: ObjectId(),
  productId: ObjectId("..."),
  userId: ObjectId("..."),
  rating: 5,
  text: "Detailed review text...",
  helpful: 42,
  createdAt: new Date()
};
```

## Decision Matrix

| Scenario | Pattern | Reason |
|----------|---------|--------|
| User profile + addresses | Embed | Always viewed together |
| User + orders | Reference | Orders grow indefinitely |
| Blog post + comments | Bucket | Many comments, paginated |
| Product + inventory | Embed | Real-time stock needed |
| Product + reviews | Hybrid | Summary embed, details reference |

## See Also

- [documents.md](../concepts/documents.md)
- [collections.md](../concepts/collections.md)
- [pagination.md](pagination.md)
