// lib/shopify.js
const https = require('https');

/**
 * Resolve any input domain (custom domain, handle, or full myshopify url)
 * to canonical .myshopify.com domain
 */
async function resolveShopifyDomain(store) {
  let clean = (store || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (!clean) return '';

  // If user only typed handle: e.g. "le-velair-w6ickwvy"
  if (!clean.includes('.')) {
    return `${clean}.myshopify.com`;
  }

  // If already ends with .myshopify.com
  if (clean.endsWith('.myshopify.com')) {
    return clean;
  }

  // If it's a custom domain (e.g. shopify-jewelry.bssoln.com or aurelle.com),
  // query https://${clean}/admin to get the 301/302 redirect location
  try {
    const res = await fetch(`https://${clean}/admin`, { method: 'HEAD', redirect: 'manual' });
    const loc = res.headers.get('location');
    if (loc) {
      const u = new URL(loc, `https://${clean}`);
      if (u.hostname && u.hostname.includes('.myshopify.com')) {
        return u.hostname;
      }
    }
  } catch (err) {
    try {
      const res = await fetch(`https://${clean}/admin`, { method: 'GET', redirect: 'manual' });
      const loc = res.headers.get('location');
      if (loc) {
        const u = new URL(loc, `https://${clean}`);
        if (u.hostname && u.hostname.includes('.myshopify.com')) {
          return u.hostname;
        }
      }
    } catch (e) {
      // fallback
    }
  }

  return clean;
}

/**
 * Execute Shopify GraphQL query or mutation
 */
async function shopifyGraphql(store, token, query, variables = {}) {
  const canonicalDomain = await resolveShopifyDomain(store);

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ query, variables });

    const options = {
      hostname: canonicalDomain,
      port: 443,
      path: '/admin/api/2024-01/graphql.json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token.trim(),
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.errors && json.errors.length > 0) {
            return reject(new Error(json.errors.map(e => e.message).join(' | ')));
          }
          resolve(json.data);
        } catch (err) {
          reject(new Error(`Failed to parse Shopify response (HTTP ${res.statusCode}): ${data.slice(0, 300)}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

/**
 * Verify Store credentials
 */
async function verifyStore(store, token) {
  const canonicalDomain = await resolveShopifyDomain(store);
  const query = `
    query {
      shop {
        name
        myshopifyDomain
        currencyCode
        billingAddress {
          country
          countryCodeV2
        }
        plan {
          displayName
        }
      }
    }
  `;
  const data = await shopifyGraphql(canonicalDomain, token, query);
  return {
    ...data.shop,
    resolvedDomain: canonicalDomain
  };
}

/**
 * Create Staged Upload targets for images
 * files: [{ filename: "ring.webp", mimeType: "image/webp", size: 12345 }]
 */
async function createStagedUploads(store, token, files) {
  const input = files.map(f => ({
    resource: 'FILE',
    filename: f.filename,
    mimeType: f.mimeType || 'image/webp',
    httpMethod: 'POST'
  }));

  const mutation = `
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyGraphql(store, token, mutation, { input });
  const errors = data.stagedUploadsCreate.userErrors || [];
  if (errors.length > 0) {
    throw new Error(errors.map(e => e.message).join(', '));
  }

  return data.stagedUploadsCreate.stagedTargets;
}

/**
 * Register uploaded files in Shopify Files API
 * files: [{ originalSource: "https://...", alt: "..." }]
 */
async function createFiles(store, token, files) {
  const mutation = `
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          fileStatus
          alt
          createdAt
          ... on MediaImage {
            id
            image {
              url
              width
              height
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyGraphql(store, token, mutation, { files });
  const errors = data.fileCreate.userErrors || [];
  if (errors.length > 0) {
    throw new Error(errors.map(e => e.message).join(', '));
  }

  return data.fileCreate.files;
}

/**
 * Create or Update Product via productSet GraphQL mutation
 */
async function setProduct(store, token, productInput) {
  const mutation = `
    mutation productSet($input: ProductSetInput!) {
      productSet(input: $input) {
        product {
          id
          title
          handle
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyGraphql(store, token, mutation, { input: productInput });
  const errors = data.productSet.userErrors || [];
  if (errors.length > 0) {
    throw new Error(errors.map(e => `${e.field ? e.field.join('.') + ': ' : ''}${e.message}`).join(', '));
  }

  return data.productSet.product;
}

module.exports = {
  resolveShopifyDomain,
  shopifyGraphql,
  verifyStore,
  createStagedUploads,
  createFiles,
  setProduct
};
