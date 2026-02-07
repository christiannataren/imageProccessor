const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const config = require('../config');
const db = require('../db/database');
const scraper = require('../scraper/scraper');

// State management for pending product additions
const pendingAdditions = new Map(); // chatId -> { url, title, price, state }
const STATE = {
  VERIFY_PRICE: 'verify_price',
  RECHECK_OR_MANUAL: 'recheck_or_manual',
  AWAIT_MANUAL_PRICE: 'await_manual_price'
};

class PriceMonitorBot {
  constructor() {
    this.bot = new TelegramBot(config.telegramBotToken, { polling: true });
    this.setupCommands();
  }

  setupCommands() {
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      this.bot.sendMessage(chatId,
        `👋 Welcome to Price Monitor Bot!\n\n` +
        `I can monitor product prices from various online stores and notify you when prices change.\n\n` +
        `Available commands:\n` +
        `/add <url> - Add a product URL to monitor\n` +
        `/list - List your monitored products\n` +
        `/remove <url> - Remove a product from monitoring\n` +
        `/check <url> - Check price immediately\n` +
        `/help - Show this help message\n\n` +
        `📷 You can also send me an image directly to process it into framed artwork!`
      );
    });

    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      this.bot.sendMessage(chatId,
        `📚 Help\n\n` +
        `I support these commands:\n` +
        `/add <url> - Add a product URL to monitor\n` +
        `/list - List your monitored products\n` +
        `/remove <url> - Remove a product from monitoring\n` +
        `/check <url> - Check price immediately\n` +
        `/help - Show this help message\n\n` +
        `📸 Image Processing:\n` +
        `Send me any image directly (not as a file) to process it into framed artwork.\n` +
        `I'll generate 3 different perspective mockups for you.\n\n` +
        `Examples:\n` +
        `/add https://www.amazon.com/dp/B08N5WRWNW\n` +
        `/remove https://www.amazon.com/dp/B08N5WRWNW\n` +
        `/check https://www.amazon.com/dp/B08N5WRWNW`
      );
    });

    this.bot.onText(/\/add (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const url = match[1].trim();

      // Basic URL validation
      if (!url.startsWith('http')) {
        this.bot.sendMessage(chatId, '❌ Please provide a valid URL starting with http:// or https://');
        return;
      }

      try {
        // Check if product already exists for this user
        const products = await db.getProductsByChat(chatId);
        const existing = products.find(p => p.url === url);
        if (existing) {
          this.bot.sendMessage(chatId, '⚠️ This URL is already being monitored.');
          return;
        }

        // Fetch initial price and title
        this.bot.sendMessage(chatId, '🔍 Fetching product information...');
        const result = await scraper.fetchPrice(url);

        if (!result.price) {
          this.bot.sendMessage(chatId, '❌ Could not extract price from this URL. Please make sure it\'s a valid product page.');
          return;
        }

        // Store pending addition
        pendingAdditions.set(chatId, {
          url,
          title: result.title,
          price: result.price,
          state: STATE.VERIFY_PRICE
        });

        // Ask for verification
        const keyboard = {
          inline_keyboard: [
            [{ text: '✅ Yes', callback_data: 'verify_yes' }],
            [{ text: '❌ No', callback_data: 'verify_no' }]
          ]
        };

        this.bot.sendMessage(chatId,
          `🔍 Found product:\n\n` +
          `📦 ${result.title || 'Unknown product'}\n` +
          `💰 Price: $${result.price.toFixed(2)}\n\n` +
          `Is this price correct?`,
          { reply_markup: keyboard }
        );
      } catch (error) {
        console.error('Error adding product:', error);
        this.bot.sendMessage(chatId, '❌ An error occurred while adding the product. Please try again later.');
      }
    });

    this.bot.onText(/\/list/, async (msg) => {
      const chatId = msg.chat.id;

      try {
        const products = await db.getProductsByChat(chatId);

        if (products.length === 0) {
          this.bot.sendMessage(chatId, '📭 You are not monitoring any products yet.\nUse /add <url> to start monitoring.');
          return;
        }

        let message = `📋 Your monitored products (${products.length}):\n\n`;
        products.forEach((product, index) => {
          const priceStr = product.current_price ? `$${product.current_price.toFixed(2)}` : 'Not checked yet';
          message += `${index + 1}. ${product.name || 'Unknown product'}\n`;
          message += `   Price: ${priceStr}\n`;
          message += `   Last check: ${product.last_check || 'Never'}\n`;
          message += `   URL: ${product.url}\n\n`;
        });

        this.bot.sendMessage(chatId, message);
      } catch (error) {
        console.error('Error listing products:', error);
        this.bot.sendMessage(chatId, '❌ An error occurred while fetching your products.');
      }
    });

    this.bot.onText(/\/remove (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const url = match[1].trim();

      try {
        const removed = await db.removeProduct(url, chatId);

        if (removed > 0) {
          this.bot.sendMessage(chatId, `✅ Product removed from monitoring.\n${url}`);
        } else {
          this.bot.sendMessage(chatId, `❌ Product not found in your monitoring list.\n${url}`);
        }
      } catch (error) {
        console.error('Error removing product:', error);
        this.bot.sendMessage(chatId, '❌ An error occurred while removing the product.');
      }
    });

    this.bot.onText(/\/check (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const url = match[1].trim();

      try {
        this.bot.sendMessage(chatId, '🔄 Checking current price...');
        const result = await scraper.fetchPrice(url);

        if (!result.price) {
          this.bot.sendMessage(chatId, '❌ Could not extract price from this URL.');
          return;
        }

        this.bot.sendMessage(chatId,
          `📊 Price check result:\n\n` +
          `📦 ${result.title || 'Unknown product'}\n` +
          `💰 Current price: $${result.price.toFixed(2)}\n` +
          `🔗 ${url}`
        );
      } catch (error) {
        console.error('Error checking price:', error);
        this.bot.sendMessage(chatId, '❌ An error occurred while checking the price.');
      }
    });

    // Handle callback queries for inline keyboards
    this.bot.on('callback_query', async (callbackQuery) => {
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;
      const pending = pendingAdditions.get(chatId);

      if (!pending) {
        this.bot.answerCallbackQuery(callbackQuery.id, { text: 'Session expired. Please start over.' });
        return;
      }

      if (pending.state === STATE.VERIFY_PRICE) {
        if (data === 'verify_yes') {
          // Save product with scraped price
          await db.addProduct(pending.url, chatId, pending.title);
          // Also need to store the price in current_price field
          // We'll need to update the product's price after adding (since addProduct doesn't set price)
          // We'll fetch the product ID and update price using updateProductPrice
          const products = await db.getProductsByChat(chatId);
          const product = products.find(p => p.url === pending.url);
          if (product) {
            await db.updateProductPrice(product.id, pending.price);
          }
          pendingAdditions.delete(chatId);

          this.bot.sendMessage(chatId,
            `✅ Product added successfully!\n\n` +
            `📦 ${pending.title || 'Unknown product'}\n` +
            `💰 Current price: $${pending.price.toFixed(2)}\n` +
            `🔗 ${pending.url}\n\n` +
            `I will monitor this product and notify you of price changes.`
          );
          this.bot.answerCallbackQuery(callbackQuery.id);
        } else if (data === 'verify_no') {
          pending.state = STATE.RECHECK_OR_MANUAL;
          pendingAdditions.set(chatId, pending);

          const keyboard = {
            inline_keyboard: [
              [{ text: '🔄 Recheck price', callback_data: 'recheck' }],
              [{ text: '✏️ Enter manually', callback_data: 'manual' }]
            ]
          };

          this.bot.sendMessage(chatId,
            `Would you like to recheck the price or enter it manually?`,
            { reply_markup: keyboard }
          );
          this.bot.answerCallbackQuery(callbackQuery.id);
        }
      } else if (pending.state === STATE.RECHECK_OR_MANUAL) {
        if (data === 'recheck') {
          // Re-fetch price
          this.bot.sendMessage(chatId, '🔍 Rechecking price...');
          const result = await scraper.fetchPrice(pending.url);
          if (!result.price) {
            this.bot.sendMessage(chatId, '❌ Could not extract price. Please enter manually.');
            pending.state = STATE.AWAIT_MANUAL_PRICE;
            pendingAdditions.set(chatId, pending);
            this.bot.sendMessage(chatId, 'Please enter the price (e.g., 29.99):');
          } else {
            pending.price = result.price;
            pending.title = result.title || pending.title;
            pending.state = STATE.VERIFY_PRICE;
            pendingAdditions.set(chatId, pending);

            const keyboard = {
              inline_keyboard: [
                [{ text: '✅ Yes', callback_data: 'verify_yes' }],
                [{ text: '❌ No', callback_data: 'verify_no' }]
              ]
            };

            this.bot.sendMessage(chatId,
              `🔍 Found price: $${result.price.toFixed(2)}\n\nIs this price correct?`,
              { reply_markup: keyboard }
            );
          }
          this.bot.answerCallbackQuery(callbackQuery.id);
        } else if (data === 'manual') {
          pending.state = STATE.AWAIT_MANUAL_PRICE;
          pendingAdditions.set(chatId, pending);
          this.bot.sendMessage(chatId, 'Please enter the price (e.g., 29.99):');
          this.bot.answerCallbackQuery(callbackQuery.id);
        }
      }
    });

    // Handle photo messages
    this.bot.on('photo', async (msg) => {
      const chatId = msg.chat.id;

      try {
        // Get the largest photo (last in the array)
        const photo = msg.photo[msg.photo.length - 1];
        const fileId = photo.file_id;

        this.bot.sendMessage(chatId, '📷 Image received! Processing...');

        // Get file path from Telegram
        const file = await this.bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;

        // Generate unique session directory
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        const sessionId = `session_${timestamp}_${random}`;
        const sessionDir = path.join(__dirname, '../../input_png', sessionId);
        
        // Ensure session directory exists
        if (!fs.existsSync(sessionDir)) {
          fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        const filename = `input.jpg`;
        const inputPath = path.join(sessionDir, filename);

        // Download the image
        this.bot.sendMessage(chatId, '⬇️ Downloading image...');
        await this.downloadImage(fileUrl, inputPath);

        // Check for required template files
        const projectRoot = path.join(__dirname, '../..');
        const requiredTemplates = ['show.png', 'show2.jpg', 'show3.png'];
        const missingTemplates = requiredTemplates.filter(template => 
          !fs.existsSync(path.join(projectRoot, template))
        );
        
        if (missingTemplates.length > 0) {
          this.bot.sendMessage(chatId, 
            `❌ Missing background template files: ${missingTemplates.join(', ')}\n\n` +
            'These are NOT your input images! Template files are required backgrounds for the perspective effects.\n\n' +
            'Please download/add these 3 files to the project root directory:\n' +
            '• show.png - Primary template background\n' +
            '• show2.jpg - Secondary template background\n' +
            '• show3.png - Tertiary template background\n\n' +
            'Your input images should be sent directly to the bot as photos.'
          );
          // Clean up session directory
          const sessionDir = path.dirname(inputPath);
          if (fs.existsSync(sessionDir)) {
            // Delete all files in directory first
            const files = fs.readdirSync(sessionDir);
            for (const file of files) {
              const filePath = path.join(sessionDir, file);
              try {
                fs.unlinkSync(filePath);
              } catch (err) {
                console.log(`Could not delete ${filePath}: ${err.message}`);
              }
            }
            
            // Delete the directory itself
            try {
              fs.rmdirSync(sessionDir);
            } catch (err) {
              console.log(`Could not delete directory ${sessionDir}: ${err.message}`);
            }
          }
          return;
        }

        // Process the image with Python script
        this.bot.sendMessage(chatId, '🔄 Processing image...');
        const outputFiles = await this.processImageWithPython(inputPath);

        if (outputFiles && outputFiles.length > 0) {
          this.bot.sendMessage(chatId, `✅ Processed ${outputFiles.length} image(s). Sending results...`);

          // Send each output image
          for (const outputFile of outputFiles) {
            if (fs.existsSync(outputFile)) {
              await this.bot.sendPhoto(chatId, outputFile);
            }
          }

          // Clean up temporary files
          this.cleanupTempFiles(inputPath, outputFiles);

          this.bot.sendMessage(chatId, '🎉 All images sent!');
        } else {
          this.bot.sendMessage(chatId, '❌ Failed to process image. Please try again.');
        }

       } catch (error) {
        console.error('Error processing photo:', error);
        
        // Extract user-friendly error message
        let userMessage = '❌ An error occurred while processing the image.';
        
        if (error.message.includes('Missing template file')) {
          userMessage = '❌ Template files are missing. Please ensure show.png, show2.jpg, and show3.png are in the project root directory.';
        } else if (error.message.includes('Python script not found')) {
          userMessage = '❌ Image processor script not found. Please ensure image_processor.py is in the project root.';
        } else if (error.message.includes('Failed to start Python process') || error.message.includes('Tried commands:')) {
          userMessage = '❌ Python is not installed or not in PATH. Please install Python 3.7+ and ensure Pillow and numpy are installed.';
        } else if (error.message.includes('ModuleNotFoundError') || error.message.includes('ImportError')) {
          if (error.message.includes('PIL') || error.message.includes('Pillow')) {
            userMessage = '❌ Pillow library not found. Please install Python Pillow package: pip install Pillow';
          } else if (error.message.includes('numpy')) {
            userMessage = '❌ NumPy library not found. Please install NumPy: pip install numpy';
          } else {
            userMessage = '❌ Python dependencies missing. Please install required packages: pip install Pillow numpy';
          }
        } else if (error.message.includes('Error opening image')) {
          userMessage = '❌ Could not read the image file. Please try with a different image format (JPEG, PNG, etc.).';
        } else if (error.message.includes('No valid image files found')) {
          userMessage = '❌ No valid image found. Please send a JPEG, PNG, or other supported image format.';
        }
        
        this.bot.sendMessage(chatId, userMessage);
        
        // Clean up session directory if it exists
        if (inputPath) {
          const sessionDir = path.dirname(inputPath);
          if (fs.existsSync(sessionDir)) {
            try {
              // Delete all files in directory first
              const files = fs.readdirSync(sessionDir);
              for (const file of files) {
                const filePath = path.join(sessionDir, file);
                try {
                  fs.unlinkSync(filePath);
                } catch (err) {
                  console.log(`Could not delete ${filePath}: ${err.message}`);
                }
              }
              
              // Delete the directory itself
              try {
                fs.rmdirSync(sessionDir);
              } catch (err) {
                console.log(`Could not delete directory ${sessionDir}: ${err.message}`);
              }
              console.log(`Cleaned up session directory after error: ${sessionDir}`);
            } catch (cleanupError) {
              console.error('Error during cleanup:', cleanupError);
            }
          }
        }
      }
    });

    // Handle any other messages
    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      // If message has no text (e.g., photo, sticker), ignore it
      if (!text) {
        return;
      }

      if (text.startsWith('/')) {
        return; // Let other handlers process commands
      }

      const pending = pendingAdditions.get(chatId);
      if (pending && pending.state === STATE.AWAIT_MANUAL_PRICE) {
        // Try to parse price from text
        const priceMatch = text.match(/(\$|€|£|¥)?\s?(\d+[.,]\d+)/) || text.match(/(\$|€|£|¥)?\s?(\d+)/);
        if (priceMatch) {
          const price = parseFloat(priceMatch[2].replace(',', '.'));
          pending.price = price;
          pending.state = STATE.VERIFY_PRICE;
          pendingAdditions.set(chatId, pending);

          const keyboard = {
            inline_keyboard: [
              [{ text: '✅ Yes', callback_data: 'verify_yes' }],
              [{ text: '❌ No', callback_data: 'verify_no' }]
            ]
          };

          this.bot.sendMessage(chatId,
            `You entered: $${price.toFixed(2)}\n\nIs this price correct?`,
            { reply_markup: keyboard }
          );
        } else {
          this.bot.sendMessage(chatId, '❌ Could not parse price. Please enter a valid number (e.g., 29.99):');
        }
      } else {
        this.bot.sendMessage(chatId,
          '🤖 I\'m a price monitoring bot! Use /help to see available commands.'
        );
      }
    });

    console.log('Bot started and listening for commands...');
  }

  async notifyPriceChange(chatId, product, oldPrice, newPrice) {
    const changePercent = ((newPrice - oldPrice) / oldPrice * 100).toFixed(1);
    const changeEmoji = newPrice < oldPrice ? '📉' : '📈';
    const changeText = newPrice < oldPrice ? 'dropped' : 'increased';

    const message =
      `${changeEmoji} Price alert!\n\n` +
      `📦 ${product.name || 'Product'}\n` +
      `💰 Old price: $${oldPrice.toFixed(2)}\n` +
      `💰 New price: $${newPrice.toFixed(2)}\n` +
      `📊 Change: ${changeText} by ${Math.abs(changePercent)}%\n` +
      `🔗 ${product.url}`;

    this.bot.sendMessage(chatId, message);
  }

  async downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const file = fs.createWriteStream(filepath);

      https.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(filepath, () => { }); // Delete the file async
        reject(err);
      });
    });
  }

  async processImageWithPython(inputImagePath) {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, '../../image_processor.py');
      const outputFolder = path.dirname(inputImagePath);
      
      if (!fs.existsSync(pythonScript)) {
        reject(new Error(`Python script not found: ${pythonScript}`));
        return;
      }

      const pythonCommands = ['py', 'python'];
      let currentCommandIndex = 0;
      
      const trySpawn = () => {
        if (currentCommandIndex >= pythonCommands.length) {
          reject(new Error(`Failed to start Python process. Tried commands: ${pythonCommands.join(', ')}. Please install Python or ensure it's in your PATH.`));
          return null;
        }
        
        const cmd = pythonCommands[currentCommandIndex];
        currentCommandIndex++;
        
        console.log(`Trying Python command: ${cmd}`);
        const pythonProcess = spawn(cmd, [pythonScript, inputImagePath]);
        
        let stdout = '';
        let stderr = '';
        
        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
          console.log(`Python stdout: ${data}`);
        });
        
        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
          console.error(`Python stderr: ${data}`);
        });
        
        pythonProcess.on('close', (code) => {
          console.log(`Python process (${cmd}) exited with code ${code}`);
          
          if (code === 0) {
            // Success - look for output files
            const outputFiles = [
              path.join(outputFolder, 'show.png'),
              path.join(outputFolder, 'show2.png'),
              path.join(outputFolder, 'show3.png')
            ];
            
            // Filter to only existing files
            const existingFiles = outputFiles.filter(file => fs.existsSync(file));
            resolve(existingFiles);
          } else {
            reject(new Error(`Python script failed with code ${code} (command: ${cmd}): ${stderr}`));
          }
        });
        
        pythonProcess.on('error', (err) => {
          console.log(`Python command ${cmd} failed: ${err.message}`);
          // Try next command
          trySpawn();
        });
        
        return pythonProcess;
      };
      
      trySpawn();
    });
  }

  cleanupTempFiles(inputPath, outputFiles) {
    try {
      const sessionDir = path.dirname(inputPath);
      
      // Delete entire session directory
      if (fs.existsSync(sessionDir)) {
        // Delete all files in directory first
        const files = fs.readdirSync(sessionDir);
        for (const file of files) {
          const filePath = path.join(sessionDir, file);
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            console.log(`Could not delete ${filePath}: ${err.message}`);
          }
        }
        
        // Delete the directory itself
        try {
          fs.rmdirSync(sessionDir);
        } catch (err) {
          console.log(`Could not delete directory ${sessionDir}: ${err.message}`);
        }
      }

      console.log(`Cleaned up session directory: ${sessionDir}`);
    } catch (error) {
      console.error('Error cleaning up files:', error);
    }
  }

  stop() {
    this.bot.stopPolling();
  }
}

module.exports = new PriceMonitorBot();