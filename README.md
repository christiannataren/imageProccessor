# Telegram Price Monitor Bot 🤖💰

A Telegram bot that monitors product prices from various online stores and notifies you when prices change.

## Features

- 📦 Monitor prices from Amazon, eBay, AliExpress, and other e-commerce sites
- 🔔 Get notified when prices change by more than 1%
- 📊 Track price history over time
- 🛠️ Simple commands to add, remove, and list monitored products
- ⏰ Automatic periodic price checks (default: every 30 minutes)
- 💾 SQLite database for data persistence
- 🖼️ **Image Processing**: Send images to create framed artwork with perspective mockups (3 variants)

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A Telegram bot token from [@BotFather](https://t.me/botfather)

### For Image Processing (Optional)

To use the image processing feature, you need:

1. **Python 3.7+** installed on your system
2. **Python dependencies**:
   ```bash
   pip install Pillow numpy
   ```
3. **Template files** in the project root directory:
   - `show.png` - Primary template background
   - `show2.jpg` - Secondary template background  
   - `show3.png` - Tertiary template background
   
   *(You'll need to provide these template files yourself)*

## Setup

1. **Clone or download the project**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and add your Telegram bot token:
     ```
     TELEGRAM_BOT_TOKEN=your_bot_token_here
     ```
   - Optional: Adjust other settings:
     - `DATABASE_PATH`: Path to SQLite database file (default: `./prices.db`)
     - `CHECK_INTERVAL_MINUTES`: How often to check prices (default: `30`)
     - `LOG_LEVEL`: Logging level (default: `info`)

4. **Get a Telegram bot token**
   - Open Telegram and search for [@BotFather](https://t.me/botfather)
   - Send `/newbot` and follow instructions
   - Copy the token provided by BotFather
   - Paste it in your `.env` file

## Usage

1. **Start the bot**
   ```bash
   npm start
   ```
   or
   ```bash
   node index.js
   ```

2. **Open Telegram and find your bot**
   - Search for your bot's username (the one you created with @BotFather)
   - Start a conversation with `/start`

3. **Available commands**
   - `/start` - Welcome message and brief introduction
   - `/help` - Show all available commands with examples
   - `/add <url>` - Add a product URL to monitor
     - Example: `/add https://www.amazon.com/dp/B08N5WRWNW`
   - `/list` - List all products you're monitoring
    - `/remove <url>` - Remove a product from monitoring
    - `/check <url>` - Check price immediately without adding to monitor list

4. **Image Processing**
   - Send any image directly to the bot (as a photo, not a file)
   - The bot will process it and return 3 different perspective mockups:
     - `show.png` - Primary mockup
     - `show2.png` - Secondary mockup  
     - `show3.png` - Tertiary mockup
   - Processing includes:
     - Adding fluorescent green borders
     - Perspective transformation
     - Blending with template backgrounds

## How It Works

1. **Adding a product**: When you add a URL, the bot:
   - Validates the URL
   - Fetches the product page
   - Extracts product title and current price
   - Stores the information in the database
   - Starts monitoring for price changes

2. **Price monitoring**: The bot periodically checks all monitored products:
   - Default: every 30 minutes (configurable in `.env`)
   - Compares current price with previous price
   - Sends notification if price changes by more than 1%
   - Updates price history in database

3. **Price extraction**: The bot uses intelligent scraping to extract prices:
   - Domain-specific selectors for Amazon, eBay, AliExpress
   - Fallback to generic price detection using meta tags and common patterns
   - Handles different currency formats

## Project Structure

```
├── index.js              # Main application entry point
├── src/
│   ├── config.js        # Environment configuration
│   ├── db/
│   │   └── database.js  # SQLite database operations
│   ├── scraper/
│   │   └── scraper.js   # Price extraction from websites
│   ├── bot/
│   │   └── bot.js       # Telegram bot commands and logic
│   └── services/
│       └── priceChecker.js # Scheduled price checking service
├── .env.example         # Example environment variables
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## Supported Websites

- **Amazon** (`amazon.com`, `amazon.co.uk`, etc.)
- **eBay** (`ebay.com`, `ebay.co.uk`, etc.)
- **AliExpress** (`aliexpress.com`)
- **Generic websites** with price meta tags or common price patterns

## Troubleshooting

### Common Issues

1. **Bot doesn't start**
   - Check if `.env` file exists and contains `TELEGRAM_BOT_TOKEN`
   - Verify the bot token is correct
   - Check if port is already in use

2. **Price not detected**
   - The website might have anti-bot measures
   - Price might be loaded dynamically with JavaScript
   - Try using `/check` command to test the URL

3. **Database errors**
   - Ensure write permissions in the project directory
   - Delete `prices.db` file to start fresh

### Logs

The bot outputs logs to console with timestamps and log levels. Check the console output for errors.

## Troubleshooting

### Image Processing Errors

**Missing template files**
```
❌ Missing template files: show.png, show2.jpg, show3.png
```
- Ensure `show.png`, `show2.jpg`, and `show3.png` are in the project root directory
- These template files are required for perspective transformations

**Python dependencies not installed**
```
ModuleNotFoundError: No module named 'PIL'
```
- Install required Python packages: `pip install Pillow numpy`

**Python not found**
```
Failed to start Python process
```
- Install Python 3.7+ and ensure it's in your system PATH
- Verify with `python --version` in terminal

**Unicode encoding errors**
- The script now uses ASCII-only error messages (fixed in latest version)

**No valid image files**
- Ensure you're sending JPEG, PNG, or other supported image formats
- Some image formats (like WebP) may not work correctly

### Price Monitoring Errors

**Cannot extract price from URL**
- The website may have changed its structure
- Try using `/check` command to test price extraction
- Some sites require JavaScript rendering (not supported)

**Bot not responding to commands**
- Ensure the bot is running (`npm start`)
- Check your Telegram bot token in `.env` file
- Verify internet connection

## Limitations

- Price extraction depends on website structure and may break if sites change their layout
- Some websites may block automated requests
- JavaScript-rendered content (React, Angular, Vue.js sites) may not work
- Rate limiting: The bot adds 2-second delays between requests to avoid being blocked

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC

## Support

If you encounter issues or have questions:
1. Check the troubleshooting section above
2. Review the code comments
3. Open an issue on the GitHub repository

---

**Happy price monitoring!** 🎯