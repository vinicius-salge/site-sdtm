# Mongoose Integration Pattern

> **Purpose**: ODM patterns with Mongoose for structured MongoDB development
> **MCP Validated**: 2026-02-06

## When to Use

- Structured data modeling with validation
- Application requiring schemas
- Middleware/hooks for data processing
- TypeScript projects needing type safety

## Implementation

### Schema Definition

```javascript
const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const userSchema = new Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^.+@.+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  name: {
    first: { type: String, required: true },
    last: { type: String, required: true }
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  addresses: [{
    street: String,
    city: String,
    state: String,
    zip: String,
    isDefault: { type: Boolean, default: false }
  }]
}, { timestamps: true });

// Virtuals
userSchema.virtual('fullName').get(function() {
  return `${this.name.first} ${this.name.last}`;
});

// Indexes
userSchema.index({ email: 1 }, { unique: true });

// Middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const bcrypt = require('bcrypt');
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  const bcrypt = require('bcrypt');
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = model('User', userSchema);
```

### Connection Setup

```javascript
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 100,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});

module.exports = connectDB;
```

### CRUD Operations

```javascript
// Create
const createUser = async (userData) => {
  return await User.create(userData);
};

// Read with population
const getUserWithOrders = async (userId) => {
  return await User.findById(userId)
    .populate('orders', 'total status createdAt')
    .select('-password');
};

// Update
const updateUser = async (userId, updateData) => {
  return await User.findByIdAndUpdate(
    userId,
    updateData,
    { new: true, runValidators: true }
  );
};

// Delete
const deleteUser = async (userId) => {
  return await User.findByIdAndDelete(userId);
};
```

### Subdocuments and References

```javascript
const orderSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true }
  }],
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'shipped', 'delivered'],
    default: 'pending'
  },
  total: { type: Number, required: true }
}, { timestamps: true });

orderSchema.pre('save', function(next) {
  this.total = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  next();
});

const Order = model('Order', orderSchema);

const getOrderDetails = async (orderId) => {
  return await Order.findById(orderId)
    .populate('user', 'email name')
    .populate('items.product', 'name sku');
};
```

## Configuration

| Option | Type | Description |
|--------|------|-------------|
| `timestamps` | Boolean | Auto-add createdAt/updatedAt |
| `toJSON` | Object | JSON serialization options |
| `strict` | Boolean | Enforce schema fields |

## Example Usage

```javascript
app.post('/api/users', async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, errors: messages });
    }
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Email already exists' });
    }
    res.status(500).json({ success: false, error: 'Server error' });
  }
});
```

## See Also

- [schema-design.md](schema-design.md)
- [crud-operations.md](../concepts/crud-operations.md)
- [connection-pooling.md](connection-pooling.md)
