const config = require('./src/config');
const db = require('./src/db/database');
const bot = require('./src/bot/bot');
const priceChecker = require('./src/services/priceChecker');

console.log('🚀 Starting Price Monitor Bot...');

// Initialize database
db.init().then(() => {
  console.log('✅ Database initialized');
  
  // Start price checking scheduler
  priceChecker.startChecking(config.checkIntervalMinutes);
  
  // Bot is already started via its constructor
  
  console.log('🤖 Bot is running. Press Ctrl+C to stop.');
}).catch(error => {
  console.error('❌ Failed to initialize database:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  priceChecker.stopChecking();
  bot.stop();
  db.close();
  console.log('👋 Goodbye!');
  process.exit(0);
});