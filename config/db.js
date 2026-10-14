const mongoose = require('mongoose');

let mongodInstance = null;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://arehman1632:E7hPfX0mp65uR65r@cluster0.uuxrj.mongodb.net/expense_tracker';
  
  try {
    // Attempt connecting to the configured MongoDB URI with a short timeout
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log(`[MongoDB] Connected successfully to: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    console.warn(`[MongoDB] Could not connect to primary URI (${uri}). Falling back to MongoMemoryServer for development...`);
    
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongodInstance = await MongoMemoryServer.create({
        instance: {
          dbName: 'expense_tracker'
        }
      });
      const memoryUri = mongodInstance.getUri();
      await mongoose.connect(memoryUri);
      console.log(`[MongoDB] Connected successfully to in-memory instance: ${memoryUri}`);
    } catch (memErr) {
      console.error('[MongoDB] In-memory server startup failed:', memErr.message);
      throw new Error(`Database connection failed: ${err.message}`);
    }
  }

  mongoose.connection.on('error', (err) => {
    console.error(`[MongoDB] Connection runtime error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Database disconnected');
  });
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
};

module.exports = { connectDB, disconnectDB };
