# Documents

> **Purpose**: BSON document structure and data types
> **Confidence**: 0.95
> **MCP Validated**: 2026-02-06

## Overview

MongoDB documents are composed of field-and-value pairs stored as BSON (Binary JSON). BSON extends JSON with additional data types like Date, ObjectId, and binary data. Documents have a flexible schema where fields can vary across documents within the same collection.

## The Pattern

```javascript
// Basic document structure
{
  _id: ObjectId("5099803df3f4948bd2f98391"),
  name: { first: "Alan", last: "Turing" },
  birth: new Date('Jun 23, 1912'),
  tags: ["mathematician", "logician"],
  views: NumberLong(1250000),
  metadata: {
    created: new Date(),
    updated: new Date()
  }
}
```

## BSON Data Types

| Type | Example | Use Case |
|------|---------|----------|
| `String` | `"Hello"` | Text content |
| `Number` / `NumberInt` | `42` / `NumberInt(42)` | Integer values |
| `NumberLong` | `NumberLong(12345678901)` | 64-bit integers |
| `NumberDecimal` | `NumberDecimal("99.99")` | High-precision decimals |
| `Double` | `3.14159` | Floating point |
| `Boolean` | `true` | Flags |
| `Date` | `new Date()` | Timestamps |
| `ObjectId` | `ObjectId()` | Document IDs |
| `Array` | `[1, 2, 3]` | Lists |
| `Object` / `Document` | `{nested: true}` | Embedded documents |
| `Binary` | `BinData(0, "...")` | Raw binary |
| `Null` | `null` | Empty values |

## Quick Reference

| Feature | Syntax | Notes |
|-------|--------|-------|
| Auto-generated ID | `_id: ObjectId()` | Required, unique per document |
| Dot notation | `user.name.first` | Access nested fields |
| Array access | `tags.0` | Access array elements |
| Document size limit | 16MB | Maximum document size |

## Common Mistakes

### Wrong

```javascript
// Using string IDs inconsistently
{ _id: "user123", name: "John" }
{ _id: ObjectId("..."), name: "Jane" }

// Storing dates as strings
{ created: "2024-01-15T10:30:00Z" }

// Unbounded arrays
{
  userId: "user123",
  comments: [/* millions of comments */]
}
```

### Correct

```javascript
// Consistent ObjectId usage
{ _id: ObjectId("..."), name: "John" }
{ _id: ObjectId("..."), name: "Jane" }

// Proper Date objects
{ created: new Date() }

// Bounded documents with pagination
{
  userId: "user123",
  commentCount: 15000,
  recentComments: [/* limited set */]
}
```

## Field Naming Rules

```javascript
// Valid field names
{ name: "John", "first-name": "John", "_private": true }

// Invalid (reserved prefix and characters)
{ "$invalid": 1 }  // $ prefix reserved
{ "a.b": 1 }       // Dot notation conflict
{ "a$b": 1 }       // $ in name
```

## Related

- [collections.md](collections.md)
- [schema-design.md](../patterns/schema-design.md)
- [crud-operations.md](crud-operations.md)
