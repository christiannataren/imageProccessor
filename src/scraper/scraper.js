const axios = require('axios');
const cheerio = require('cheerio');

class Scraper {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  }

  async fetchPrice(url) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      const domain = new URL(url).hostname;
      
      let price = null;
      let title = null;

      // Try domain-specific selectors
      if (domain.includes('amazon.')) {
        price = this.extractAmazonPrice($);
        title = this.extractAmazonTitle($);
      } else if (domain.includes('ebay.')) {
        price = this.extractEbayPrice($);
        title = this.extractEbayTitle($);
      } else if (domain.includes('aliexpress.')) {
        price = this.extractAliexpressPrice($);
        title = this.extractAliexpressTitle($);
      } else {
        // Generic fallback: look for meta tags or common price patterns
        price = this.extractGenericPrice($);
        title = this.extractGenericTitle($);
      }

      return { price, title, url };
    } catch (error) {
      console.error(`Error fetching ${url}:`, error.message);
      return { price: null, title: null, url, error: error.message };
    }
  }

  extractAmazonPrice($) {
    // Amazon price selectors
    const selectors = [
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price-whole',
      '.a-offscreen',
      '[data-a-color="price"] span',
      '.priceToPay span'
    ];
    return this.findPrice($, selectors);
  }

  extractAmazonTitle($) {
    return $('#productTitle').text().trim() || $('meta[name="title"]').attr('content') || '';
  }

  extractEbayPrice($) {
    const selectors = [
      '.x-price-primary span',
      '.vi-price',
      '.notranslate',
      '#prcIsum'
    ];
    return this.findPrice($, selectors);
  }

  extractEbayTitle($) {
    return $('#itemTitle').text().replace('Details about', '').trim() || $('h1.it-ttl').text().trim() || '';
  }

  extractAliexpressPrice($) {
    const selectors = [
      '.product-price-value',
      '.uniform-banner-box-price',
      '.sku-price'
    ];
    return this.findPrice($, selectors);
  }

  extractAliexpressTitle($) {
    return $('h1.product-title-text').text().trim() || '';
  }

  extractGenericPrice($) {
    // Look for common price patterns in meta tags
    const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
                     $('meta[property="og:price:amount"]').attr('content') ||
                     $('meta[name="price"]').attr('content');
    if (metaPrice) return this.cleanPrice(metaPrice);

    // Look for price in JSON-LD
    const jsonLd = $('script[type="application/ld+json"]').html();
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd);
        if (data.offers && data.offers.price) return this.cleanPrice(data.offers.price);
        if (data.price) return this.cleanPrice(data.price);
      } catch (e) {}
    }

    // Common CSS classes
    const selectors = [
      '.price',
      '.product-price',
      '.current-price',
      '.sale-price',
      '.value',
      '[class*="price"]',
      '[itemprop="price"]'
    ];
    return this.findPrice($, selectors);
  }

  extractGenericTitle($) {
    return $('h1').first().text().trim() || 
           $('title').text().trim() ||
           $('meta[property="og:title"]').attr('content') || '';
  }

  findPrice($, selectors) {
    for (const selector of selectors) {
      const element = $(selector);
      if (element.length) {
        const text = element.text();
        const price = this.extractPriceFromText(text);
        if (price) return price;
      }
    }
    return null;
  }

  extractPriceFromText(text) {
    // Match numbers with decimal points and optional currency symbols
    const priceMatch = text.match(/(\$|€|£|¥)?\s?(\d+[.,]\d+)/);
    if (priceMatch) {
      return parseFloat(priceMatch[2].replace(',', '.'));
    }
    // Match integer prices
    const intMatch = text.match(/(\$|€|£|¥)?\s?(\d+)/);
    if (intMatch) {
      return parseFloat(intMatch[2]);
    }
    return null;
  }

  cleanPrice(priceStr) {
    if (typeof priceStr === 'number') return priceStr;
    const num = parseFloat(priceStr.replace(/[^\d.,]/g, '').replace(',', '.'));
    return isNaN(num) ? null : num;
  }
}

module.exports = new Scraper();