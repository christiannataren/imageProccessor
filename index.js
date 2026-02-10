const bot = require('./src/bot/bot');

console.log('🚀 Starting Image Processor Bot...');

console.log('🤖 Bot is running. Press Ctrl+C to stop.');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  bot.stop();
  console.log('👋 Goodbye!');
  process.exit(0);
});