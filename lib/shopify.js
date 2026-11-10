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

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    if (text.includes('application_cannot_be_found')) {
      throw new Error(`Client ID "${clientId}" was not found on store "${canonicalDomain}". Please check if Client ID and Secret were copied correctly.`);
    }
    if (text.includes('invalid_client')) {
      throw new Error('Invalid Client Secret. Please check your Client Secret.');
    }
    const cleanMsg = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(`Shopify OAuth error (${res.status}): ${cleanMsg.slice(0, 160)}`);
  }

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
 * Fetch the primary inventory location ID of the store
 */
async function getPrimaryLocation(store, token) {
  const query = `
    query getPrimaryLocation {
      locations(first: 1) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `;
  try {
    const data = await shopifyGraphql(store, token, query);
    return data?.locations?.edges?.[0]?.node?.id || null;
  } catch (err) {
    return null;
  }
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
 * Get existing collections for a product by handle
 */
async function getExistingProductCollections(store, token, handle) {
  if (!handle) return [];
  const query = `
    query getProductByHandle($handle: String!) {
      productByHandle(handle: $handle) {
        id
        collections(first: 50) {
          edges {
            node {
              id
            }
          }
        }
      }
    }
  `;
  try {
    const data = await shopifyGraphql(store, token, query, { handle });
    if (data && data.productByHandle && data.productByHandle.collections) {
      return (data.productByHandle.collections.edges || []).map(e => e.node.id);
    }
  } catch (err) {
    // Non-fatal
  }
  return [];
}

/**
 * Create or Update Product via productSet GraphQL mutation
 */
async function setProduct(store, token, productInput) {
  // If product already exists and collections are provided, merge collections so previous memberships are preserved
  if (productInput.handle && Array.isArray(productInput.collections) && productInput.collections.length > 0) {
    const existingColIds = await getExistingProductCollections(store, token, productInput.handle);
    if (existingColIds.length > 0) {
      productInput.collections = Array.from(new Set([...existingColIds, ...productInput.collections]));
    }
  }

  const mutation = `
    mutation productSet($input: ProductSetInput!) {
      productSet(input: $input) {
        product {
          id
          title
          handle
          status
          category {
            id
            fullName
          }
          collections(first: 10) {
            edges {
              node {
                id
                title
              }
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

  let data = await shopifyGraphql(store, token, mutation, { input: productInput });
  let errors = data.productSet.userErrors || [];

  // Graceful fallback if any constraint is rejected by Shopify
  if (errors.length > 0) {
    let currentInput = { ...productInput };
    let retried = false;

    // 1. Fallback for collections (e.g. automated/smart collection constraint)
    const isColErr = errors.some(e => 
      (e.message && (e.message.toLowerCase().includes('automated') || e.message.toLowerCase().includes('smart collection'))) ||
      (e.field && e.field.includes('collections'))
    );
    if (isColErr && currentInput.collections) {
      console.warn(`Collection constraint for "${productInput.handle}", retrying with tags-only...`);
      delete currentInput.collections;
      retried = true;
    }

    // 2. Fallback for metafields (e.g. reserved namespace, type or schema constraints)
    const isMetafieldErr = errors.some(e => 
      (e.field && e.field.includes('metafields')) || 
      (e.message && (e.message.toLowerCase().includes('metafield') || e.message.toLowerCase().includes('namespace')))
    );
    if (isMetafieldErr && currentInput.metafields) {
      console.warn(`Metafield constraint for "${productInput.handle}", retrying without conflicting metafields...`);
      delete currentInput.metafields;
      retried = true;
    }

    // 3. Fallback for category (e.g. invalid taxonomy ID or unsupported by store plan)
    const isCatErr = errors.some(e => 
      (e.field && e.field.includes('category')) || 
      (e.message && e.message.toLowerCase().includes('category'))
    );
    if (isCatErr && currentInput.category) {
      console.warn(`Category constraint for "${productInput.handle}", retrying without category GID...`);
      delete currentInput.category;
      retried = true;
    }

    if (retried) {
      data = await shopifyGraphql(store, token, mutation, { input: currentInput });
      errors = data.productSet.userErrors || [];

      // Last-resort fallback: if still erroring, strip optional enhancements to ensure product is created
      if (errors.length > 0 && (currentInput.metafields || currentInput.category || currentInput.collections)) {
        console.warn(`Retrying with minimal payload for "${productInput.handle}"...`);
        delete currentInput.metafields;
        delete currentInput.category;
        delete currentInput.collections;
        data = await shopifyGraphql(store, token, mutation, { input: currentInput });
        errors = data.productSet.userErrors || [];
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.map(e => `${e.field ? e.field.join('.') + ': ' : ''}${e.message}`).join(', '));
  }

  return data.productSet.product;
}

/**
 * Standard Shopify Product Taxonomy Category resolution
 */
function resolveTaxonomyCategory(categoryInput) {
  if (!categoryInput) return null;
  const str = String(categoryInput).trim();
  if (str.startsWith('gid://shopify/TaxonomyCategory/')) return str;

  const lower = str.toLowerCase();
  if (lower.includes('charms & pendants > charms') || lower === 'charms') {
    return 'gid://shopify/TaxonomyCategory/aa-6-5-2';
  }
  if (lower.includes('charms & pendants > pendants') || lower === 'pendants') {
    return 'gid://shopify/TaxonomyCategory/aa-6-5-1';
  }
  if (lower.includes('charms & pendants') || lower.includes('charm') || lower.includes('locket') || lower.includes('holder')) {
    return 'gid://shopify/TaxonomyCategory/aa-6-5';
  }
  if (lower.includes('necklace') || lower.includes('chain')) {
    return 'gid://shopify/TaxonomyCategory/aa-6-3';
  }
  if (lower.includes('ring')) {
    return 'gid://shopify/TaxonomyCategory/aa-6-4';
  }
  if (lower.includes('bracelet') || lower.includes('bangle') || lower.includes('handchain')) {
    return 'gid://shopify/TaxonomyCategory/aa-6-1';
  }
  if (lower.includes('earring') || lower.includes('piercing')) {
    return 'gid://shopify/TaxonomyCategory/aa-6-2';
  }
  if (lower.includes('brooch') || lower.includes('lapel')) {
    return 'gid://shopify/TaxonomyCategory/aa-6-6';
  }
  if (lower.includes('jewelry') || lower.includes('jewellery')) {
    return 'gid://shopify/TaxonomyCategory/aa-6';
  }

  return 'gid://shopify/TaxonomyCategory/aa-6-5'; // Default safe for jewelry charms/pendants
}

/**
 * Fetch all collections from store with full pagination
 */
async function getCollections(store, token) {
  const all = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const query = `
      query getCollections($cursor: String) {
        collections(first: 250, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              title
              handle
              productsCount {
                count
              }
              ruleSet {
                appliedDisjunctively
              }
            }
          }
        }
      }
    `;
    const data = await shopifyGraphql(store, token, query, { cursor });
    const edges = data?.collections?.edges || [];
    for (const edge of edges) {
      if (edge && edge.node) {
        all.push({
          id: edge.node.id,
          title: edge.node.title,
          handle: edge.node.handle,
          productsCount: edge.node.productsCount ? edge.node.productsCount.count : 0,
          isSmart: !!edge.node.ruleSet
        });
      }
    }

    hasNextPage = data?.collections?.pageInfo?.hasNextPage || false;
    cursor = data?.collections?.pageInfo?.endCursor || null;
    if (!cursor || edges.length === 0) break;
  }

  return all;
}

/**
 * Targeted query search for a collection by title or handle
 */
async function findCollectionByNameOrHandle(store, token, nameOrHandle) {
  if (!nameOrHandle) return null;
  const clean = String(nameOrHandle).trim();
  if (!clean) return null;
  const cleanLower = clean.toLowerCase();
  const cleanAlpha = cleanLower.replace(/[^a-z0-9]/g, '');

  const query = `
    query searchCollection($q: String!) {
      collections(first: 10, query: $q) {
        edges {
          node {
            id
            title
            handle
            ruleSet {
              appliedDisjunctively
            }
          }
        }
      }
    }
  `;

  try {
    const data = await shopifyGraphql(store, token, query, { q: `title:${clean}` });
    const edges = data?.collections?.edges || [];
    for (const edge of edges) {
      const node = edge.node;
      const titleLower = (node.title || '').trim().toLowerCase();
      const handleLower = (node.handle || '').trim().toLowerCase();
      const titleAlpha = titleLower.replace(/[^a-z0-9]/g, '');

      if (titleLower === cleanLower || handleLower === cleanLower || (cleanAlpha && titleAlpha === cleanAlpha)) {
        return {
          id: node.id,
          title: node.title,
          handle: node.handle,
          isSmart: !!node.ruleSet
        };
      }
    }
  } catch (err) {
    // Non-fatal search failure
  }

  return null;
}

/**
 * Create a new collection in Shopify ONLY if it does not already exist
 * If collection already exists, returns existing collection with reused: true
 */
async function createCollection(store, token, { title, handle, descriptionHtml }) {
  const cleanTitle = (title || '').trim();
  if (!cleanTitle) throw new Error('Collection title is required.');

  // 1. Check in memory list first
  const existingList = await getCollections(store, token);
  const targetLower = cleanTitle.toLowerCase();
  const targetHandle = (handle || cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim().toLowerCase();
  const targetAlpha = targetLower.replace(/[^a-z0-9]/g, '');

  const existingMatch = existingList.find(c => {
    const cTitleLower = (c.title || '').trim().toLowerCase();
    const cHandleLower = (c.handle || '').trim().toLowerCase();
    const cAlpha = cTitleLower.replace(/[^a-z0-9]/g, '');
    return cTitleLower === targetLower || cHandleLower === targetHandle || (targetAlpha && cAlpha === targetAlpha);
  });

  if (existingMatch) {
    return {
      id: existingMatch.id,
      title: existingMatch.title,
      handle: existingMatch.handle,
      isSmart: existingMatch.isSmart,
      reused: true
    };
  }

  // 2. Targeted search check
  const searchMatch = await findCollectionByNameOrHandle(store, token, cleanTitle);
  if (searchMatch) {
    return {
      id: searchMatch.id,
      title: searchMatch.title,
      handle: searchMatch.handle,
      isSmart: searchMatch.isSmart,
      reused: true
    };
  }

  // 3. Truly does not exist -> Create it
  const mutation = `
    mutation collectionCreate($input: CollectionCreateInput!) {
      collectionCreate(input: $input) {
        collection {
          id
          title
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const input = {
    title: cleanTitle,
    descriptionHtml: descriptionHtml || `<p>${cleanTitle} collection</p>`
  };
  if (handle) input.handle = handle.trim();

  const data = await shopifyGraphql(store, token, mutation, { input });
  const errors = data.collectionCreate.userErrors || [];
  if (errors.length > 0) {
    throw new Error(errors.map(e => `${e.field ? e.field.join('.') + ': ' : ''}${e.message}`).join(', '));
  }

  return {
    ...data.collectionCreate.collection,
    isSmart: false,
    reused: false
  };
}

/**
 * Ensure an array of collection names exist in the store (find or create)
 * Never duplicates existing collections!
 * Returns a map: { [name]: { id: collectionGid, title: string, handle: string, isSmart: boolean, reused: boolean } }
 */
async function ensureCollections(store, token, collectionNames = []) {
  if (!Array.isArray(collectionNames) || collectionNames.length === 0) return {};

  const existingList = await getCollections(store, token);
  const result = {};

  // Build multi-index lookup of existing collections
  const lookup = new Map();
  existingList.forEach(c => {
    const titleKey = (c.title || '').trim().toLowerCase();
    const handleKey = (c.handle || '').trim().toLowerCase();
    const alphaKey = titleKey.replace(/[^a-z0-9]/g, '');

    if (titleKey) lookup.set(titleKey, c);
    if (handleKey) lookup.set(handleKey, c);
    if (alphaKey) lookup.set(`alpha:${alphaKey}`, c);
  });

  for (const rawName of collectionNames) {
    const name = (rawName || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const alphaKey = `alpha:${key.replace(/[^a-z0-9]/g, '')}`;

    let match = lookup.get(key) || lookup.get(alphaKey);

    if (!match) {
      // Fallback targeted search
      match = await findCollectionByNameOrHandle(store, token, name);
      if (match) {
        lookup.set(key, match);
        lookup.set(alphaKey, match);
      }
    }

    if (match) {
      result[name] = {
        id: match.id,
        title: match.title,
        handle: match.handle,
        isSmart: !!match.isSmart,
        reused: true
      };
    } else {
      // Truly not found -> Create once
      try {
        const created = await createCollection(store, token, {
          title: name,
          descriptionHtml: `<p>Curated collection: ${name}</p>`
        });
        const colInfo = {
          id: created.id,
          title: created.title,
          handle: created.handle,
          isSmart: false,
          reused: created.reused || false
        };
        result[name] = colInfo;
        lookup.set(key, colInfo);
        lookup.set(alphaKey, colInfo);
      } catch (err) {
        console.warn(`Could not ensure collection "${name}":`, err.message);
      }
    }
  }

  return result;
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
  getPrimaryLocation,
  checkExistingProducts,
  createStagedUploads,
  createFiles,
  setProduct,
  resolveTaxonomyCategory,
  getCollections,
  createCollection,
  ensureCollections
};
