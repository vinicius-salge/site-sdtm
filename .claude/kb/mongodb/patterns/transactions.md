# Transactions Pattern

> **Purpose**: Multi-document ACID transactions for complex operations
> **MCP Validated**: 2026-02-06

## When to Use

- Transferring data between accounts/collections
- Updating multiple related documents atomically
- Maintaining data consistency across collections
- Processing payments or inventory updates

## Implementation

### Basic Transaction Pattern

```javascript
const { MongoClient } = require('mongodb');

async function transferFunds(fromAccountId, toAccountId, amount) {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const session = client.startSession();
    
    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }
      });
      
      const accounts = client.db('bank').collection('accounts');
      
      const debitResult = await accounts.updateOne(
        { _id: fromAccountId, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { session }
      );
      
      if (debitResult.matchedCount === 0) {
        throw new Error('Insufficient funds');
      }
      
      await accounts.updateOne(
        { _id: toAccountId },
        { $inc: { balance: amount } },
        { session }
      );
      
      await session.commitTransaction();
      return { success: true };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  } finally {
    await client.close();
  }
}
```

### Retry Logic for Transient Errors

```javascript
async function runTransactionWithRetry(txnFunc, client, maxRetries = 3) {
  const session = client.startSession();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }
      });
      
      const result = await txnFunc(session);
      await session.commitTransaction();
      return result;
      
    } catch (error) {
      const isTransient = error.errorLabels?.includes('TransientTransactionError');
      
      if (isTransient && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 100 * attempt));
        continue;
      }
      
      await session.abortTransaction();
      throw error;
    }
  }
  session.endSession();
}

await runTransactionWithRetry(async (session) => {
  const db = client.db('shop');
  await db.collection('inventory').updateOne(
    { productId: 'PROD-1' },
    { $inc: { quantity: -1 } },
    { session }
  );
  await db.collection('orders').insertOne({ productId: 'PROD-1' }, { session });
}, client);
```

### Multi-Collection Operations

```javascript
async function createOrderWithItems(orderData, items, session) {
  const db = session.client.db('ecommerce');
  
  const orderResult = await db.collection('orders').insertOne({
    customerId: orderData.customerId,
    total: orderData.total,
    status: 'pending',
    createdAt: new Date()
  }, { session });
  
  const orderItems = items.map(item => ({
    orderId: orderResult.insertedId,
    productId: item.productId,
    quantity: item.quantity,
    price: item.price
  }));
  
  await db.collection('orderItems').insertMany(orderItems, { session });
  
  for (const item of items) {
    const result = await db.collection('inventory').updateOne(
      { productId: item.productId, quantity: { $gte: item.quantity } },
      { $inc: { quantity: -item.quantity } },
      { session }
    );
    if (result.matchedCount === 0) {
      throw new Error(`Insufficient inventory for product ${item.productId}`);
    }
  }
  
  return orderResult.insertedId;
}
```

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `readConcern.level` | `local` | `snapshot` for consistent reads |
| `writeConcern.w` | `1` | `majority` for durability |
| `writeConcern.j` | `false` | `true` to wait for journal |

## Constraints

- Transactions cannot write to capped collections
- Maximum transaction time: 60 seconds by default
- Requires replica set (even single-node for development)

## Example Usage

```javascript
async function reserveInventory(orderId, items) {
  return await runTransactionWithRetry(async (session) => {
    const db = client.db('warehouse');
    
    for (const item of items) {
      const result = await db.collection('inventory').updateOne(
        { sku: item.sku, available: { $gte: item.quantity } },
        { $inc: { available: -item.quantity, reserved: item.quantity } },
        { session }
      );
      if (result.modifiedCount === 0) {
        throw new Error(`Cannot reserve ${item.sku}`);
      }
    }
    
    await db.collection('orders').updateOne(
      { _id: orderId },
      { $set: { status: 'reserved', reservedAt: new Date() } },
      { session }
    );
  }, client);
}
```

## See Also

- [replica-sets.md](../concepts/replica-sets.md)
- [crud-operations.md](../concepts/crud-operations.md)
