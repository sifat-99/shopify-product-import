// lib/csvHelper.js
const Papa = require('papaparse');

/**
 * Parse a Shopify Product CSV string into structured product objects
 */
function parseShopifyCsv(csvString) {
  const result = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: 'greedy'
  });

  const rows = result.data;
  const productsMap = new Map();

  for (const row of rows) {
    const handle = (row['Handle'] || '').trim();
    if (!handle) continue;

    if (!productsMap.has(handle)) {
      productsMap.set(handle, {
        handle: handle,
        title: (row['Title'] || '').trim(),
        bodyHtml: (row['Body (HTML)'] || '').trim(),
        vendor: (row['Vendor'] || '').trim() || 'Default Vendor',
        productType: (row['Type'] || '').trim(),
        tags: (row['Tags'] || '').split(',').map(t => t.trim()).filter(Boolean),
        status: (row['Status'] || 'DRAFT').toUpperCase(),
        options: [],
        variants: [],
        images: []
      });

      // Extract options from the first row
      const prod = productsMap.get(handle);
      ['Option1 Name', 'Option2 Name', 'Option3 Name'].forEach((optKey, idx) => {
        const name = (row[optKey] || '').trim();
        if (name && name.toLowerCase() !== 'title') {
          prod.options.push({ name, position: idx + 1, values: new Set() });
        }
      });
    }

    const prod = productsMap.get(handle);

    // If this row has a title, update title & body if previously blank
    if (!prod.title && row['Title']) prod.title = row['Title'].trim();
    if (!prod.bodyHtml && row['Body (HTML)']) prod.bodyHtml = row['Body (HTML)'].trim();
    if (!prod.productType && row['Type']) prod.productType = row['Type'].trim();

    // Extract Variant info if present
    const price = (row['Variant Price'] || '').trim();
    if (price) {
      const opt1Val = (row['Option1 Value'] || '').trim();
      const opt2Val = (row['Option2 Value'] || '').trim();
      const opt3Val = (row['Option3 Value'] || '').trim();

      const optionValues = [];
      if (opt1Val && opt1Val.toLowerCase() !== 'default title') optionValues.push({ name: row['Option1 Name'] || 'Option 1', value: opt1Val });
      if (opt2Val) optionValues.push({ name: row['Option2 Name'] || 'Option 2', value: opt2Val });
      if (opt3Val) optionValues.push({ name: row['Option3 Name'] || 'Option 3', value: opt3Val });

      prod.variants.push({
        sku: (row['Variant SKU'] || '').trim(),
        price: price,
        compareAtPrice: (row['Variant Compare At Price'] || '').trim() || null,
        inventoryQuantity: parseInt(row['Variant Inventory Qty'] || '0', 10),
        inventoryPolicy: (row['Variant Inventory Policy'] || 'deny').toUpperCase(),
        requiresShipping: row['Variant Requires Shipping'] ? String(row['Variant Requires Shipping']).toUpperCase() === 'TRUE' : true,
        taxable: row['Variant Taxable'] ? String(row['Variant Taxable']).toUpperCase() === 'TRUE' : true,
        optionValues: optionValues
      });
    }

    // Extract Image info if present
    const imgSrc = (row['Image Src'] || '').trim();
    const imgPos = parseInt(row['Image Position'] || '0', 10);
    const imgAlt = (row['Image Alt Text'] || '').trim();
    if (imgSrc) {
      prod.images.push({
        src: imgSrc,
        position: imgPos || prod.images.length + 1,
        alt: imgAlt
      });
    }
  }

  return Array.from(productsMap.values());
}

/**
 * Injects CDN URLs into CSV rows based on imageMap { "handle_position": cdnUrl }
 */
function enrichCsvWithImageUrls(csvString, imageMap) {
  const parsed = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: false
  });

  const rows = parsed.data;
  let currentHandle = '';
  let imageCounterForHandle = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const handle = (row['Handle'] || '').trim();
    if (!handle) continue;

    if (handle !== currentHandle) {
      currentHandle = handle;
      imageCounterForHandle = 1;
    } else {
      imageCounterForHandle++;
    }

    const pos = parseInt(row['Image Position'] || String(imageCounterForHandle), 10);
    const mapKey = `${handle}_${pos}`;

    if (imageMap[mapKey]) {
      row['Image Src'] = imageMap[mapKey];
      row['Image Position'] = String(pos);
    }
  }

  return Papa.unparse(rows);
}

module.exports = {
  parseShopifyCsv,
  enrichCsvWithImageUrls
};
