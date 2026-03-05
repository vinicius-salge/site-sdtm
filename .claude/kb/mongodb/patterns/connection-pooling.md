# Connection Pooling Pattern

> **Purpose**: Connection management best practices for production applications
> **MCP Validated**: 2026-02-06

## When to Use

- Production applications with concurrent requests
- High-throughput services
- Microservices architecture
- Applications with variable load

## Implementation

### Production Connection Setup

```javascript
const { MongoClient } = require('mongodb');

const client = new MongoClient(process.env.MONGODB_URI, {
  minPoolSize: 10,
  maxPoolSize: 100,
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 30000,
  waitQueueTimeoutMS: 5000,
  retryWrites: true,
  retryReads: true,
  readPreference: 'primaryPreferred',
  w: 'majority',
  tls: process.env.NODE_ENV === 'production'
});

let clientInstance = null;

async function getClient() {
  if (!clientInstance) {
    clientInstance = client;
    await client.connect();
  }
  return clientInstance;
}

process.on('SIGINT', async () => {
  if (clientInstance) {
    await clientInstance.close();
  }
  process.exit(0);
});
```

### Connection Middleware Pattern

```javascript
const mongoMiddleware = (dbName) => {
  return async (req, res, next) => {
    try {
      const client = await getClient();
      req.db = client.db(dbName);
      next();
    } catch (err) {
      res.status(500).json({ error: 'Database connection failed' });
    }
  };
};

app.use(mongoMiddleware('myapp'));

app.get('/users', async (req, res) => {
  const users = await req.db.collection('users').find({}).toArray();
  res.json(users);
});
```

### Health Check Pattern

```javascript
app.get('/health', async (req, res) => {
  try {
    const client = await getClient();
    await client.db('admin').command({ ping: 1 });
    res.json({ status: 'healthy', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});
```

## Configuration

| Setting | Default | Production | Development |
|---------|---------|------------|-------------|
| `minPoolSize` | 0 | 10-25 | 0 |
| `maxPoolSize` | 100 | 50-200 | 10 |
| `connectTimeoutMS` | 10000 | 10000 | 5000 |
| `waitQueueTimeoutMS` | 0 | 5000 | 0 |
| `maxIdleTimeMS` | 0 | 60000 | 0 |

## Connection String Options

```
mongodb://user:pass@host1:27017,host2:27017/dbname?
  replicaSet=myRepl&w=majority&retryWrites=true&
  readPreference=primaryPreferred&maxPoolSize=100
```

## Common Mistakes

### Wrong

```javascript
// Creating new client per request
app.get('/users', async (req, res) => {
  const client = new MongoClient(uri);  // Don't do this!
  await client.connect();
  await client.close();
});
```

### Correct

```javascript
// Single client instance
const client = new MongoClient(uri, options);
await client.connect();

app.get('/users', async (req, res) => {
  const users = await client.db('myapp').collection('users').find({}).toArray();
  res.json(users);
});
```

## Monitoring

```javascript
client.on('connectionPoolCreated', (event) => {
  console.log('Pool created:', event.address);
});

client.on('connectionClosed', (event) => {
  console.log('Connection closed:', event.connectionId, event.reason);
});
```

## See Also

- [replica-sets.md](../concepts/replica-sets.md)
- [transactions.md](transactions.md)
