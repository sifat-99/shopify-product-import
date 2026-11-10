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
 * Exchange Client ID and Client Secret for an Admin API Access Token
 * via Shopify Client Credentials Grant
 */
async function exchangeClientCredentials(store, clientId, clientSecret) {
  const canonicalDomain = await resolveShopifyDomain(store);
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', (clientId || '').trim());
  params.append('client_secret', (clientSecret || '').trim());

  const res = await fetch(`https://${canonicalDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: params
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || `Client credentials exchange failed (HTTP ${res.status})`);
  }

  return {
    accessToken: data.access_token,
    scope: data.scope,
    expiresIn: data.expires_in
  };
}

/**
 * Verify Store credentials (supports direct token or clientId + clientSecret)
 */
async function verifyStore(store, authInput) {
  let token = typeof authInput === 'string' ? authInput : authInput.token;
  const clientId = typeof authInput === 'object' ? authInput.clientId : null;
  const clientSecret = typeof authInput === 'object' ? authInput.clientSecret : null;

  if (!token && clientId && clientSecret) {
    const exchanged = await exchangeClientCredentials(store, clientId, clientSecret);
    token = exchanged.accessToken;
  }

  if (!token) {
    throw new Error('Either Admin API Access Token or (Client ID + Client Secret) must be provided.');
  }

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
    resolvedDomain: canonicalDomain,
    effectiveToken: token
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

/**
 * Check if any of the given handles already exist in the target store
 */
async function checkExistingProducts(store, token, handles = []) {
  if (!handles || handles.length === 0) return [];
  const existing = [];
  const BATCH_SIZE = 25;

  for (let i = 0; i < handles.length; i += BATCH_SIZE) {
    const chunk = handles.slice(i, i + BATCH_SIZE);
    const queryString = chunk.map(h => `handle:${h}`).join(' OR ');

    const query = `
      query checkExisting($query: String!) {
        products(first: 50, query: $query) {
          edges {
            node {
              id
              handle
              title
              status
            }
          }
        }
      }
    `;

    try {
      const data = await shopifyGraphql(store, token, query, { query: queryString });
      const nodes = (data.products.edges || []).map(e => e.node);
      existing.push(...nodes);
    } catch (e) {
      console.warn('Existing product check warning:', e.message);
    }
  }

  return existing;
}

module.exports = {
  resolveShopifyDomain,
  exchangeClientCredentials,
  shopifyGraphql,
  verifyStore,
  checkExistingProducts,
  createStagedUploads,
  createFiles,
  setProduct
};
