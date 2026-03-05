# Replica Sets

> **Purpose**: High availability and replication
> **Confidence**: 0.95
> **MCP Validated**: 2026-02-06

## Overview

A replica set is a group of MongoDB servers (mongod processes) that maintain identical data sets. It provides redundancy, high availability, and failover capabilities. A replica set requires a minimum of 3 nodes (1 primary + 2 secondaries, or 1 primary + 1 secondary + 1 arbiter).

## The Pattern

```javascript
// Connection string for replica set
const uri = 'mongodb://host1:27017,host2:27017,host3:27017/mydb?replicaSet=myRepl';

const client = new MongoClient(uri, {
  readPreference: 'primaryPreferred',  // Read from primary, fallback to secondary
  w: 'majority',                        // Write concern
  retryWrites: true
});

// Read preferences
const db = client.db('myapp');

// Primary only (default)
const primaryData = await db.collection('users').find({}).toArray();

// Secondary (eventual consistency)
const secondaryColl = db.collection('users').withReadPreference('secondary');
const secondaryData = await secondaryColl.find({}).toArray();
```

## Replica Set Members

| Role | Description | Use Case |
|------|-------------|----------|
| **Primary** | Accepts all writes | Default read/write |
| **Secondary** | Replicates from primary | Read scaling, failover |
| **Arbiter** | Votes in elections | Odd member count without data |
| **Hidden** | Invisible to apps | Dedicated analytics |
| **Delayed** | Lagged replication | Point-in-time recovery |

## Write Concerns

| Level | Description | Use Case |
|-------|-------------|----------|
| `w: 1` | Acknowledged by primary only | Fast, less safe |
| `w: 'majority'` | Acknowledged by majority | Balanced safety/speed |
| `w: <n>` | Acknowledged by n members | Specific durability |
| `j: true` | Journaled to disk | Crash safety |

## Quick Reference

| Command | Purpose |
|---------|---------|
| `rs.status()` | Check replica set status |
| `rs.conf()` | View configuration |
| `rs.stepDown()` | Force primary step down |
| `rs.reconfig()` | Modify configuration |

## Common Mistakes

### Wrong

```javascript
// Reading from primary under high load
const client = new MongoClient(uri);  // Defaults to primary

// Weak write concern for critical data
await db.collection('payments').insertOne(doc, { w: 0 });  // No acknowledgment!
```

### Correct

```javascript
// Use secondary for read-heavy workloads
const client = new MongoClient(uri, {
  readPreference: 'secondaryPreferred',
  retryWrites: true
});

// Strong write concern for critical operations
await db.collection('payments').insertOne(doc, { w: 'majority', j: true });
```

## Read Preference Modes

```javascript
// Primary only (default)
const client = new MongoClient(uri, { readPreference: 'primary' });

// Secondary preferred
const client = new MongoClient(uri, { readPreference: 'secondaryPreferred' });

// Nearest (lowest latency)
const client = new MongoClient(uri, { readPreference: 'nearest' });

// Per-operation override
const result = await db.collection('users')
  .find({})
  .readPref('secondary')
  .toArray();
```

## Failover Handling

```javascript
const client = new MongoClient(uri, {
  retryWrites: true,
  retryReads: true,
  serverSelectionTimeoutMS: 5000,
  heartbeatFrequencyMS: 10000
});

// Handle failover in application
try {
  await db.collection('users').updateOne({ id: 1 }, { $set: { name: 'John' } });
} catch (err) {
  if (err.codeName === 'NotPrimaryError') {
    // Primary changed, operation will be retried automatically if retryWrites: true
  }
}
```

## Related

- [transactions.md](../patterns/transactions.md)
- [connection-pooling.md](../patterns/connection-pooling.md)
