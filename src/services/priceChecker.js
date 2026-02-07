const db = require('../db/database');
const scraper = require('../scraper/scraper');
const bot = require('../bot/bot');

class PriceChecker {
  constructor() {
    this.checkInterval = null;
  }

  async checkAllProducts() {
    try {
      const products = await db.getAllProducts();
      console.log(`Checking ${products.length} products...`);

      for (const product of products) {
        await this.checkProduct(product);
        // Add small delay between requests to avoid being blocked
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error('Error checking products:', error);
    }
  }

  async checkProduct(product) {
    try {
      console.log(`Checking: ${product.url}`);
      const result = await scraper.fetchPrice(product.url);

      if (!result.price) {
        console.log(`Could not extract price for ${product.url}`);
        return;
      }

      // If this is the first check, just store the price
      if (product.current_price === null) {
        await db.updateProductPrice(product.id, result.price);
        console.log(`Initial price stored: $${result.price.toFixed(2)} for ${product.name || product.url}`);
        return;
      }

      // Compare with previous price
      const oldPrice = product.current_price;
      const newPrice = result.price;
      const priceDifference = Math.abs(newPrice - oldPrice);
      const changePercent = (priceDifference / oldPrice) * 100;

      // Update price in database
      await db.updateProductPrice(product.id, newPrice);

      // Notify if price changed by more than 1%
      if (changePercent >= 1) {
        console.log(`Price change detected: $${oldPrice.toFixed(2)} -> $${newPrice.toFixed(2)} (${changePercent.toFixed(1)}%)`);
        await bot.notifyPriceChange(product.chat_id, product, oldPrice, newPrice);
      } else {
        console.log(`Price unchanged: $${newPrice.toFixed(2)} (${changePercent.toFixed(1)}% change)`);
      }

      // Update product name if we got a better one
      if (result.title && (!product.name || product.name === 'Unknown product')) {
        // In a real implementation, you'd update the product name
        console.log(`Better title found: ${result.title}`);
      }

    } catch (error) {
      console.error(`Error checking product ${product.url}:`, error.message);
    }
  }

  startChecking(intervalMinutes) {
    const intervalMs = intervalMinutes * 60 * 1000;
    
    // Run initial check
    this.checkAllProducts();
    
    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.checkAllProducts();
    }, intervalMs);

    console.log(`Price checking scheduled every ${intervalMinutes} minutes`);
  }

  stopChecking() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('Price checking stopped');
    }
  }
}

module.exports = new PriceChecker();