# MongoDB Quick Reference

> Fast lookup tables. For code examples, see linked files.
> **MCP Validated**: 2026-02-06

## Connection

| Driver | Install | Connect |
|--------|---------|---------|
| Node.js | `npm install mongodb` | `new MongoClient(uri)` |
| Mongoose | `npm install mongoose` | `mongoose.connect(uri)` |
| Python | `pip install pymongo` | `MongoClient(uri)` |

## CRUD Operations

| Operation | Method | Example |
|-----------|--------|---------|
| Create | `insertOne()` | `db.collection('users').insertOne({name: 'John'})` |
| Create Many | `insertMany()` | `insertMany([{a:1}, {a:2}])` |
| Read | `find()` | `find({status: 'active'}).toArray()` |
| Read One | `findOne()` | `findOne({_id: ObjectId('...')})` |
| Update | `updateOne()` | `updateOne({id: 1}, {$set: {name: 'Jane'}})` |
| Update Many | `updateMany()` | `updateMany({}, {$inc: {views: 1}})` |
| Delete | `deleteOne()` | `deleteOne({_id: id})` |
| Delete Many | `deleteMany()` | `deleteMany({status: 'archived'})` |

## Query Operators

| Operator | Purpose | Example |
|----------|---------|---------|
| `$eq` | Equal | `{age: {$eq: 25}}` |
| `$ne` | Not equal | `{status: {$ne: 'deleted'}}` |
| `$gt` / `$gte` | Greater than | `{score: {$gt: 100}}` |
| `$lt` / `$lte` | Less than | `{age: {$lt: 18}}` |
| `$in` | In array | `{status: {$in: ['active', 'pending']}}` |
| `$regex` | Pattern match | `{name: {$regex: /^John/i}}` |
| `$exists` | Field exists | `{email: {$exists: true}}` |

## Index Types

| Type | Creation | Use Case |
|------|----------|----------|
| Single Field | `createIndex({field: 1})` | Exact matches, sorting |
| Compound | `createIndex({a: 1, b: -1})` | Multi-field queries |
| Text | `createIndex({content: 'text'})` | Full-text search |
| Multikey | Auto on arrays | Array element queries |
| Unique | `createIndex({email: 1}, {unique: true})` | Prevent duplicates |

## Decision Matrix

| Use Case | Choose |
|----------|--------|
| Flexible schema | Documents without strict validation |
| Complex relationships | Embedding for 1:1/1:few, referencing for 1:many |
| High read performance | Compound indexes + projection |
| Full-text search | Text index with `$text` operator |
| Pagination | Skip/limit for small, cursor for large |
| ACID operations | Multi-document transactions |

## Common Pitfalls

| Don't | Do Instead |
|-------|------------|
| Store unbounded arrays | Use bucketing or referencing patterns |
| Query without indexes | Create indexes for frequent queries |
| Use `skip()` for large offsets | Use cursor-based pagination |
| Store large files in documents | Use GridFS for files > 16MB |
| Ignore write concern | Use appropriate `w` and `j` settings |

## Related Documentation

| Topic | Path |
|-------|------|
| Full Index | `index.md` |
| Schema Design | `patterns/schema-design.md` |
| CRUD Operations | `concepts/crud-operations.md` |
| Indexes | `concepts/indexes.md` |
