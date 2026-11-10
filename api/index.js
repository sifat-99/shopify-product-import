// api/index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { verifyStore, createStagedUploads, createFiles, setProduct, resolveShopifyDomain, checkExistingProducts } = require('../lib/shopify');
const { enrichCsvWithImageUrls } = require('../lib/csvHelper');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static dashboard UI
app.use(express.static(path.join(__dirname, '../public')));

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Shopify Catalog Importer' });
});

/**
 * Preflight validation check (Store currency, permissions, existing product handles)
 */
app.post('/api/shopify/preflight', async (req, res) => {
  try {
    const { store, token, handles, expectedCurrency } = req.body;
    if (!store || !token) {
      return res.status(400).json({ error: 'Store domain and Admin token are required for preflight check.' });
    }

    // 1. Verify store & read-only shop info
    const shop = await verifyStore(store, token);
    const storeCurrency = shop.currencyCode;
    const currencyMismatch = expectedCurrency && storeCurrency && expectedCurrency.toUpperCase() !== storeCurrency.toUpperCase();

    // 2. Check if handles exist in store
    const existing = await checkExistingProducts(store, token, handles || []);

    res.json({
      success: true,
      shop,
      storeCurrency,
      currencyMismatch,
      existingProducts: existing
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Resolve domain (supports custom domains like shopify-jewelry.bssoln.com)
 */
app.get('/api/shopify/resolve-domain', async (req, res) => {
  try {
    const domain = req.query.domain;
    if (!domain) return res.status(400).json({ error: 'Domain query parameter is required.' });
    const resolved = await resolveShopifyDomain(domain);
    res.json({ success: true, original: domain, resolved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Verify Store credentials
 */
app.post('/api/shopify/verify', async (req, res) => {
  try {
    const { store, token, clientId, clientSecret } = req.body;
    if (!store || (!token && (!clientId || !clientSecret))) {
      return res.status(400).json({ error: 'Store domain and either Admin Access Token or (Client ID + Client Secret) are required.' });
    }
    const shop = await verifyStore(store, { token, clientId, clientSecret });
    res.json({
      success: true,
      shop,
      resolvedDomain: shop.resolvedDomain,
      effectiveToken: shop.effectiveToken
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Create Staged Upload targets for batch of images
 */
app.post('/api/shopify/staged-uploads', async (req, res) => {
  try {
    const { store, token, files } = req.body;
    if (!store || !token || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Store, token, and files array are required.' });
    }
    const targets = await createStagedUploads(store, token, files);
    res.json({ success: true, targets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Register files in Shopify Files API
 */
app.post('/api/shopify/files-create', async (req, res) => {
  try {
    const { store, token, files } = req.body;
    if (!store || !token || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Store, token, and files array are required.' });
    }
    const createdFiles = await createFiles(store, token, files);
    res.json({ success: true, files: createdFiles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Create or update product via productSet
 */
app.post('/api/shopify/create-product', async (req, res) => {
  try {
    const { store, token, product } = req.body;
    if (!store || !token || !product || !product.handle) {
      return res.status(400).json({ error: 'Store, token, and product object with handle are required.' });
    }

    // Build ProductSetInput
    const input = {
      handle: product.handle,
      title: product.title || product.handle,
      descriptionHtml: product.bodyHtml || '',
      vendor: product.vendor || 'Aurelle Fine Jewelry',
      productType: product.productType || '',
      tags: product.tags || [],
      status: (product.status || 'DRAFT').toUpperCase()
    };

    // Attach file IDs (Hero, Lifestyle, Macro)
    if (Array.isArray(product.fileIds) && product.fileIds.length > 0) {
      input.files = product.fileIds.map(id => ({ id }));
    }

    // Attach productOptions and variants if present
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      // Build productOptions map to satisfy Shopify GraphQL requirement
      const optionsMap = new Map();

      product.variants.forEach(v => {
        if (Array.isArray(v.optionValues) && v.optionValues.length > 0) {
          v.optionValues.forEach(ov => {
            const optName = ov.optionName || ov.name || 'Title';
            const optVal = ov.value || ov.name || 'Default Title';
            if (!optionsMap.has(optName)) optionsMap.set(optName, new Set());
            optionsMap.get(optName).add(optVal);
          });
        }
      });

      if (optionsMap.size === 0) {
        optionsMap.set('Title', new Set(['Default Title']));
      }

      input.productOptions = Array.from(optionsMap.entries()).map(([name, valSet]) => ({
        name: name,
        values: Array.from(valSet).map(val => ({ name: val }))
      }));

      input.variants = product.variants.map((v, i) => {
        const variantObj = {
          price: v.price ? String(v.price) : '0.00'
        };
        if (v.sku) variantObj.sku = v.sku;
        if (v.compareAtPrice) variantObj.compareAtPrice = String(v.compareAtPrice);

        if (Array.isArray(v.optionValues) && v.optionValues.length > 0) {
          variantObj.optionValues = v.optionValues.map(ov => ({
            optionName: ov.optionName || ov.name || 'Title',
            name: ov.value || ov.name || 'Default Title'
          }));
        } else {
          variantObj.optionValues = [{
            optionName: 'Title',
            name: 'Default Title'
          }];
        }
        return variantObj;
      });
    }

    const result = await setProduct(store, token, input);
    res.json({ success: true, product: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Ingest image URLs into CSV
 */
app.post('/api/csv/enrich', (req, res) => {
  try {
    const { csvString, imageMap } = req.body;
    if (!csvString || !imageMap) {
      return res.status(400).json({ error: 'csvString and imageMap object are required.' });
    }
    const enriched = enrichCsvWithImageUrls(csvString, imageMap);
    res.json({ success: true, enrichedCsv: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;
