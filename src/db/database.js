const sqlite3 = require('sqlite3').verbose();
const config = require('../config');

class Database {
  constructor() {
    this.db = new sqlite3.Database(config.databasePath);
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(`
          CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            name TEXT,
            current_price REAL,
            last_check DATETIME,
            chat_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(url, chat_id)
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            price REAL NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
          )
        `);

        this.db.run('CREATE INDEX IF NOT EXISTS idx_products_chat_id ON products(chat_id)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id)');

        console.log('Database initialized');
        resolve();
      });
    });
  }

  async addProduct(url, chatId, name = null) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO products (url, chat_id, name)
        VALUES (?, ?, ?)
      `);
      stmt.run(url, chatId, name, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
      stmt.finalize();
    });
  }

  async removeProduct(url, chatId) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM products WHERE url = ? AND chat_id = ?', [url, chatId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async getProductsByChat(chatId) {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM products WHERE chat_id = ?', [chatId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getAllProducts() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM products', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async updateProductPrice(productId, price) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('UPDATE products SET current_price = ?, last_check = CURRENT_TIMESTAMP WHERE id = ?', [price, productId]);
        this.db.run('INSERT INTO price_history (product_id, price) VALUES (?, ?)', [productId, price], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });
    });
  }

  async getPriceHistory(productId, limit = 10) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM price_history WHERE product_id = ? ORDER BY timestamp DESC LIMIT ?',
        [productId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  close() {
    this.db.close();
  }
}

module.exports = new Database();