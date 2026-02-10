const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();

class ImageProcessorBot {
  constructor(options = {}) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    // In test mode, we don't need a valid token
    if (!options.testMode) {
      if (!botToken) {
        console.error('❌ TELEGRAM_BOT_TOKEN is not set in environment variables');
        console.error('   Please create a .env file with TELEGRAM_BOT_TOKEN=your_bot_token');
        process.exit(1);
      }
    }
    
    // Parse allowed user IDs from environment variable
    // Three states:
    // 1. ALLOWED_USER_IDS not set (undefined) -> allow everyone
    // 2. ALLOWED_USER_IDS set but empty string -> no users allowed
    // 3. ALLOWED_USER_IDS set with comma-separated IDs -> only those users allowed
     const allowedIdsStr = process.env.ALLOWED_USER_IDS;
    
    if (allowedIdsStr === undefined) {
      // Variable not set - allow everyone
      this.allowedUserIds = null;
      console.log(`🤖 Bot initialized. Access: ALLOWED_USER_IDS not set - allowing everyone`);
    } else {
      // Variable is set (could be empty string or contains IDs)
      this.allowedUserIds = new Set();
      if (allowedIdsStr.trim() !== '') {
        const ids = allowedIdsStr.split(',').map(id => id.trim()).filter(id => id);
        ids.forEach(id => {
          const numId = parseInt(id, 10);
          if (!isNaN(numId)) {
            this.allowedUserIds.add(numId);
          } else {
            console.log(`⚠️ WARNING: Invalid user ID in ALLOWED_USER_IDS: "${id}"`);
          }
        });
      }
      
      if (this.allowedUserIds.size > 0) {
        console.log(`🤖 Bot initialized. Allowed users: ${Array.from(this.allowedUserIds).join(', ')}`);
      } else {
        console.log(`🤖 Bot initialized. Access: ALLOWED_USER_IDS is empty - no users allowed`);
      }
    }
    
    // Only create bot and start polling if not in test mode
    if (!options.testMode) {
      const tokenForBot = botToken || 'dummy-token-for-testing';
      this.bot = new TelegramBot(tokenForBot, { polling: true });
      this.setupCommands();
    } else {
      this.bot = null;
    }
  }
  
  isUserAllowed(userId) {
    // Convert userId to number for consistent comparison (same as parsing from env)
    const userIdNum = parseInt(userId, 10);
    
    // Check if userId is a valid number
    if (isNaN(userIdNum)) {
      return false;
    }
    
    // Case 1: Variable not set - allow everyone
    if (this.allowedUserIds === null) {
      return true;
    }
    
    // Case 2: Variable set but empty - no users allowed
    if (this.allowedUserIds.size === 0) {
      return false;
    }
    
    // Case 3: Check against allowed list
    return this.allowedUserIds.has(userIdNum);
  }

  setupCommands() {
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      this.bot.sendMessage(chatId,
        `👋 Welcome to Image Processor Bot!\n\n` +
        `I can process your images into framed artwork with perspective mockups.\n\n` +
        `📸 How to use:\n` +
        `1. Send me any image directly (as a photo, not a file)\n` +
        `2. I'll process it and generate 3 different perspective mockups\n` +
        `3. You'll receive all processed images back\n\n` +
        `Use /help for more information.`
      );
    });

    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      this.bot.sendMessage(chatId,
        `📚 Image Processor Bot Help\n\n` +
        `I create framed artwork with perspective transformations from your images.\n\n` +
        `📸 Usage:\n` +
        `• Send any image directly to the bot (as a photo)\n` +
        `• I'll generate 3 different mockups:\n` +
        `  - show.png: Primary perspective mockup\n` +
        `  - show2.png: Secondary perspective mockup\n` +
        `  - show3.png: Tertiary perspective mockup\n\n` +
        `Requirements:\n` +
        `• Python 3.7+ with Pillow and numpy installed\n` +
        `• Template files (show.png, show2.jpg, show3.png) in project root\n\n` +
        `🔒 Access Control:\n` +
        `• Use /id to get your User ID\n` +
        `• Bot admin can configure ALLOWED_USER_IDS in .env:\n` +
        `  - Omit variable: allow everyone\n` +
        `  - Set empty (ALLOWED_USER_IDS=): no users allowed\n` +
        `  - Set with IDs: only listed users allowed\n\n` +
        `Commands:\n` +
        `/start - Welcome message\n` +
        `/help - This help message\n` +
        `/id - Get your Telegram user ID`
      );
    });

    this.bot.onText(/\/id/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const username = msg.from.username ? `@${msg.from.username}` : 'Not set';
      const firstName = msg.from.first_name || 'Not set';
      const lastName = msg.from.last_name || 'Not set';
      
      this.bot.sendMessage(chatId,
        `📋 Your Telegram Information:\n\n` +
        `👤 User ID: ${userId}\n` +
        `💬 Chat ID: ${chatId}\n` +
        `👤 Username: ${username}\n` +
        `📛 First Name: ${firstName}\n` +
        `📛 Last Name: ${lastName}\n\n` +
        `This information can be useful for debugging or specific bot features.`
      );
    });

    // Handle photo messages
    this.bot.on('photo', async (msg) => {
      const chatId = msg.chat.id;
      
      // Check if message has from field (user information)
      if (!msg.from) {
        console.log(`⚠️ Photo received without 'from' field, denying access. Chat ID: ${chatId}`);
        this.bot.sendMessage(chatId,
          `⛔ Access Denied\n\n` +
          `Cannot identify user. Image processing is not available in this context.`
        );
        return;
      }
      
      const userId = msg.from.id;
      console.log(`📷 Photo received from user ${userId}`);

      // Check if user is allowed to use image processing
      if (!this.isUserAllowed(userId)) {
        this.bot.sendMessage(chatId,
          `⛔ Access Denied\n\n` +
          `You are not authorized to use the image processing feature.\n` +
          `Your User ID: ${userId}\n\n` +
          `Use /id to see your Telegram information.`
        );
        return;
      }

      try {
        // Get the largest photo (last in the array)
        const photo = msg.photo[msg.photo.length - 1];
        const fileId = photo.file_id;

        this.bot.sendMessage(chatId, '📷 Image received! Processing...');

        // Get file path from Telegram
        const file = await this.bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

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
            'Please ensure these 3 files are in the project root directory:\n' +
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

      // Respond to any other text messages
      this.bot.sendMessage(chatId,
        '🤖 I\'m an image processing bot! Send me a photo to create framed artwork.\n' +
        'Use /help for instructions.'
      );
    });

    console.log('Image Processor Bot started and listening for commands...');
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

module.exports = ImageProcessorBot;
module.exports.ImageProcessorBot = ImageProcessorBot;