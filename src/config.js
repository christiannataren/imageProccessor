require('dotenv').config();

module.exports = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  databasePath: process.env.DATABASE_PATH || './prices.db',
  checkIntervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES) || 30,
  logLevel: process.env.LOG_LEVEL || 'info'
};