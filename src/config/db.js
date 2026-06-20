// config/database.js
const mongoose = require('mongoose');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

const mongoOptions = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 2,
  retryWrites: true,
  w: 'majority',
};

let retryCount = 0;

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }

    await mongoose.connect(uri, mongoOptions);

    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
    retryCount = 0;
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);

    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(
        `🔄 Retrying connection (${retryCount}/${MAX_RETRIES}) in ${RETRY_DELAY_MS / 1000}s...`
      );
      setTimeout(connectDB, RETRY_DELAY_MS);
    } else {
      console.error('💀 Max MongoDB retries reached. Shutting down.');
      process.exit(1);
    }
  }
};

// Connection lifecycle events
mongoose.connection.on('connected', () => console.log('📡 Mongoose connected'));
mongoose.connection.on('disconnected', () => console.warn('⚠️ Mongoose disconnected'));
mongoose.connection.on('reconnected', () => console.log('🔁 Mongoose reconnected'));
mongoose.connection.on('error', (err) => console.error('Mongoose error:', err));

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Closing MongoDB connection...`);
  await mongoose.connection.close();
  console.log('MongoDB connection closed.');
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = connectDB;