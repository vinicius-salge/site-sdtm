# CRUD Operations

> **Purpose**: Create, Read, Update, Delete operations
> **Confidence**: 0.95
> **MCP Validated**: 2026-02-06

## Overview

MongoDB provides a rich set of CRUD operations through the Node.js driver. Operations are asynchronous and return promises, supporting both single-document and bulk operations.

## The Pattern

```javascript
const { MongoClient, ObjectId } = require('mongodb');

async function crudExamples(client) {
  const db = client.db('myapp');
  const users = db.collection('users');

  // CREATE
  const insertResult = await users.insertOne({
    name: "John Doe",
    email: "john@example.com",
    createdAt: new Date()
  });
  console.log(`Inserted: ${insertResult.insertedId}`);

  // READ
  const user = await users.findOne({ _id: insertResult.insertedId });
  const activeUsers = await users
    .find({ status: 'active' })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  // UPDATE
  const updateResult = await users.updateOne(
    { _id: user._id },
    { 
      $set: { lastLogin: new Date() },
      $inc: { loginCount: 1 }
    }
  );

  // DELETE
  const deleteResult = await users.deleteOne({ _id: user._id });
}
```

## Quick Reference

| Operation | Method | Returns |
|-----------|--------|---------|
| Insert One | `insertOne(doc)` | `{insertedId, acknowledged}` |
| Insert Many | `insertMany(docs)` | `{insertedIds, insertedCount}` |
| Find One | `findOne(filter)` | Document or null |
| Find Many | `find(filter).toArray()` | Array of documents |
| Update One | `updateOne(filter, update)` | `{matchedCount, modifiedCount}` |
| Update Many | `updateMany(filter, update)` | Same as updateOne |
| Replace | `replaceOne(filter, doc)` | Same as update |
| Delete One | `deleteOne(filter)` | `{deletedCount}` |
| Delete Many | `deleteMany(filter)` | Same as deleteOne |

## Update Operators

| Operator | Purpose | Example |
|----------|---------|---------|
| `$set` | Set field value | `{$set: {name: "Jane"}}` |
| `$unset` | Remove field | `{$unset: {tempField: ""}}` |
| `$inc` | Increment number | `{$inc: {views: 1}}` |
| `$mul` | Multiply | `{$mul: {price: 1.1}}` |
| `$push` | Add to array | `{$push: {tags: "new"}}` |
| `$pull` | Remove from array | `{$pull: {tags: "old"}}` |
| `$addToSet` | Add unique | `{$addToSet: {tags: "unique"}}` |
| `$pop` | Remove first/last | `{$pop: {queue: 1}}` |

## Common Mistakes

### Wrong

```javascript
// Not awaiting the promise
const users = db.collection('users').find({}).toArray(); // Returns Promise!

// Using wrong operator - replaces entire document
await users.updateOne({id: 1}, {name: "New Name"}); // Wrong!

// No error handling
await users.insertOne({data: largeBuffer}); // May fail silently
```

### Correct

```javascript
// Properly awaiting
const users = await db.collection('users').find({}).toArray();

// Using $set operator
await users.updateOne({id: 1}, {$set: {name: "New Name"}});

// With error handling
try {
  await users.insertOne({data: largeBuffer});
} catch (err) {
  console.error('Insert failed:', err.message);
}
```

## Bulk Operations

```javascript
const bulkOps = [
  { insertOne: { document: { name: "User1" } } },
  { updateOne: { 
    filter: { name: "User2" }, 
    update: { $set: { updated: true } },
    upsert: true 
  }},
  { deleteOne: { filter: { name: "User3" } } },
  { replaceOne: { 
    filter: { name: "User4" }, 
    replacement: { name: "User4", new: true }
  }}
];

const result = await users.bulkWrite(bulkOps, { ordered: true });
```

## Related

- [documents.md](documents.md)
- [pagination.md](../patterns/pagination.md)
- [transactions.md](../patterns/transactions.md)
