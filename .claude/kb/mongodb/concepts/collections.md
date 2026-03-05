# Collections

> **Purpose**: Collections and schema design
> **Confidence**: 0.95
> **MCP Validated**: 2026-02-06

## Overview

Collections are groups of MongoDB documents, analogous to tables in relational databases. Unlike tables, collections have a flexible schema by default, but can enforce validation rules using JSON Schema.

## The Pattern

```javascript
// Create collection with validation
await db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "createdAt"],
      properties: {
        email: {
          bsonType: "string",
          pattern: "^.+@.+$",
          description: "must be a valid email"
        },
        age: {
          bsonType: "int",
          minimum: 0,
          maximum: 150
        },
        status: {
          enum: ["active", "inactive", "pending"],
          description: "can only be one of the enum values"
        }
      }
    }
  },
  validationLevel: "strict",  // strict | moderate | off
  validationAction: "error"   // error | warn
});
```

## Collection Methods

| Method | Purpose | Example |
|--------|---------|---------|
| `createCollection()` | Create with options | `db.createCollection("logs", {capped: true, size: 10000})` |
| `collection.drop()` | Delete collection | `db.collection("temp").drop()` |
| `renameCollection()` | Rename | `db.collection("old").rename("new")` |
| `getCollectionInfos()` | View metadata | `db.getCollectionInfos({name: "users"})` |

## Schema Validation Levels

| Level | Behavior |
|-------|----------|
| `strict` | All inserts/updates must pass validation |
| `moderate` | Existing invalid docs can be updated, new must pass |
| `off` | No validation performed |

## Quick Reference

| Feature | Command | Notes |
|---------|---------|-------|
| Capped collection | `{capped: true, size: N, max: M}` | Fixed size, FIFO |
| Time-series | `{timeseries: {timeField: "timestamp"}}` | Optimized for time data |
| View | `{viewOn: "source", pipeline: [...]}` | Read-only aggregation |
| Check validation | `db.getCollectionInfos()` | Returns validator config |

## Common Mistakes

### Wrong

```javascript
// No validation - accepts any data
db.createCollection("users")

// Too strict validation blocking valid updates
{
  validationLevel: "strict",
  validator: { $jsonSchema: { required: ["fieldThatMightNotExistYet"] } }
}
```

### Correct

```javascript
// Validation with appropriate level
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email"],
      properties: {
        email: { bsonType: "string" }
      }
    }
  },
  validationLevel: "moderate"  // Allows gradual migration
});
```

## Collection Types

```javascript
// Standard collection
db.createCollection("products")

// Capped collection (circular buffer)
db.createCollection("logs", {
  capped: true,
  size: 5242880,  // 5MB
  max: 5000       // max documents
})

// Time-series collection
db.createCollection("sensorData", {
  timeseries: {
    timeField: "timestamp",
    metaField: "metadata",
    granularity: "hours"
  }
})
```

## Related

- [documents.md](documents.md)
- [schema-design.md](../patterns/schema-design.md)
- [indexes.md](indexes.md)
