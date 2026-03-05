# MongoDB Knowledge Base

> **Purpose**: Document-oriented NoSQL database for modern applications with flexible schema, powerful querying, and horizontal scalability
> **MCP Validated**: 2026-02-06

## Quick Navigation

### Concepts (< 150 lines each)

| File | Purpose |
|------|---------|
| [concepts/documents.md](concepts/documents.md) | BSON document structure and data types |
| [concepts/collections.md](concepts/collections.md) | Collections and schema design |
| [concepts/crud-operations.md](concepts/crud-operations.md) | Create, Read, Update, Delete operations |
| [concepts/aggregation-framework.md](concepts/aggregation-framework.md) | Pipeline stages and operators |
| [concepts/indexes.md](concepts/indexes.md) | Index types and optimization |
| [concepts/replica-sets.md](concepts/replica-sets.md) | High availability and replication |

### Patterns (< 200 lines each)

| File | Purpose |
|------|---------|
| [patterns/schema-design.md](patterns/schema-design.md) | Embedding vs referencing patterns |
| [patterns/pagination.md](patterns/pagination.md) | Efficient pagination strategies |
| [patterns/transactions.md](patterns/transactions.md) | Multi-document ACID transactions |
| [patterns/full-text-search.md](patterns/full-text-search.md) | Text search implementation |
| [patterns/connection-pooling.md](patterns/connection-pooling.md) | Connection management best practices |
| [patterns/mongoose-integration.md](patterns/mongoose-integration.md) | ODM patterns with Mongoose |

---

## Quick Reference

- [quick-reference.md](quick-reference.md) - Fast lookup tables

---

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Documents** | BSON-based flexible records with rich data types |
| **Collections** | Groups of documents with optional schema validation |
| **CRUD** | Create, Read, Update, Delete with powerful query operators |
| **Aggregation** | Multi-stage data processing pipelines |
| **Indexes** | Optimized data access through B-tree and specialized indexes |
| **Replica Sets** | Automatic failover with primary-secondary replication |

---

## Learning Path

| Level | Files |
|-------|-------|
| **Beginner** | concepts/documents.md, concepts/collections.md, concepts/crud-operations.md |
| **Intermediate** | patterns/schema-design.md, concepts/indexes.md, patterns/pagination.md |
| **Advanced** | concepts/aggregation-framework.md, patterns/transactions.md, concepts/replica-sets.md |

---

## Agent Usage

| Agent | Primary Files | Use Case |
|-------|---------------|----------|
| backend-developer | patterns/schema-design.md, patterns/mongoose-integration.md | Data modeling |
| database-admin | concepts/indexes.md, concepts/replica-sets.md | Performance tuning |
| api-developer | concepts/crud-operations.md, patterns/pagination.md | API implementation |

---

## Project Context

This KB supports projects requiring:
- Flexible document-based data storage
- High-performance read/write operations
- Horizontal scaling through sharding
- Real-time analytics with aggregation pipelines
- Full-text search capabilities
- ACID transactions for complex operations
