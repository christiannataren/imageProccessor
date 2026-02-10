# Image Processor Bot 🤖🎨

A Telegram bot that processes images into framed artwork with perspective mockups.

## Features

- 🖼️ Process any image into framed artwork with fluorescent green borders
- 🔄 Generate 3 different perspective mockups using template backgrounds
- 📸 Simple usage: just send a photo to the bot
- ⚡ Automatic cleanup of temporary files
- 🐍 Python-powered image processing with Pillow and numpy
- 🔒 Access control: Restrict image processing to specific user IDs (optional)

## Prerequisites

### Node.js Requirements
- Node.js (v14 or higher)
- npm or yarn
- A Telegram bot token from [@BotFather](https://t.me/botfather)

### Python Requirements (for image processing)
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

2. **Install Node.js dependencies**
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
    - Optional: Add comma-separated user IDs to restrict access:
      ```
      ALLOWED_USER_IDS=123456789,987654321
      ```
      Leave empty to allow everyone. Use `/id` command to get user IDs.

4. **Get a Telegram bot token**
   - Open Telegram and search for [@BotFather](https://t.me/botfather)
   - Send `/newbot` and follow instructions
   - Copy the token provided by BotFather
   - Paste it in your `.env` file

5. **Add template files**
   - Ensure `show.png`, `show2.jpg`, and `show3.png` are in the project root directory
   - These are background templates for perspective transformations

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

 3. **Process images**
    - Send any image directly to the bot (as a photo, not a file)
    - The bot will process it and return 3 different perspective mockups:
      - `show.png` - Primary mockup
      - `show2.png` - Secondary mockup  
      - `show3.png` - Tertiary mockup
    
    ⚠️ **Note**: If `ALLOWED_USER_IDS` is configured in `.env`, only listed users can process images.
    All users can still use `/start`, `/help`, and `/id` commands.

 4. **Available commands**
   - `/start` - Welcome message and brief introduction
   - `/help` - Show all available commands with examples
   - `/id` - Get your Telegram user ID and chat information

## How It Works

1. **Image reception**: When you send a photo, the bot:
   - Downloads the image from Telegram servers
   - Creates a unique session directory
   - Saves the image for processing

2. **Image processing**: The bot uses Python script (`image_processor.py`) to:
   - Create a bordered print-ready image (3900x5700 @ 300DPI)
   - Apply perspective transformations using template backgrounds
   - Generate 3 different mockups with multiply blend mode

3. **Result delivery**: The bot:
   - Sends all processed images back to you
   - Cleans up temporary files automatically

## Project Structure

```
├── index.js              # Main application entry point
├── src/
│   └── bot/
│       └── bot.js       # Telegram bot commands and logic
├── image_processor.py    # Python image processing script
├── show.png             # Primary template background
├── show2.jpg            # Secondary template background
├── show3.png            # Tertiary template background
├── .env.example         # Example environment variables
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## Image Processing Pipeline

1. **Bordered image creation**:
   - Resizes and crops image to fit within borders
   - Adds fluorescent green borders (3900x5700 canvas)
   - Saves as print-ready PNG with 300 DPI

2. **Perspective transformations**:
   - Applies perspective warp using custom coordinate mappings
   - Uses multiply blend mode to composite onto templates
   - Generates 3 variants with different perspectives

## Troubleshooting

### Common Issues

1. **Bot doesn't start**
   - Check if `.env` file exists and contains `TELEGRAM_BOT_TOKEN`
   - Verify the bot token is correct
   - Check if port is already in use

2. **Missing template files**
   ```
   ❌ Missing background template files: show.png, show2.jpg, show3.png
   ```
   - Ensure `show.png`, `show2.jpg`, and `show3.png` are in the project root directory
   - These are NOT your input images! They are background templates for perspective effects.

3. **Python dependencies not installed**
   ```
   ModuleNotFoundError: No module named 'PIL'
   ```
   - Install required Python packages: `pip install Pillow numpy`

4. **Python not found**
   ```
   Failed to start Python process
   ```
   - Install Python 3.7+ and ensure it's in your system PATH
   - Verify with `python --version` in terminal

5. **Image format issues**
   - Ensure you're sending JPEG, PNG, or other supported image formats
   - Some image formats (like WebP) may not work correctly

### Error Messages

The bot provides user-friendly error messages for common issues:
- Missing template files
- Python not installed
- Missing Python dependencies (Pillow, numpy)
- Unsupported image formats

## Limitations

- Requires Python 3.7+ with Pillow and numpy installed
- Template files must be provided by the user
- Large images may take longer to process
- Some image formats may not be supported

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

**Happy image processing!** 🎨