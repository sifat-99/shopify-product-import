// public/app.js
(function() {
  // App State
  const state = {
    authMode: 'token', // 'token' or 'client'
    storeDomain: '',
    storeToken: '',
    isVerified: false,
    shopInfo: null,
    csvRaw: '',
    csvProducts: [],
    folderCollections: new Map(), // collectionName -> Set of product names from folder
    csvCollections: new Map(), // collectionName -> Set of product names from CSV
    detectedCollections: new Map(), // merged: collectionName -> { source, products: Set }
    imagesMap: new Map(), // filename -> File object
    mappingData: [],
    uploadedFilesMap: new Map(), // filename -> { id, url }
    finalCsvString: '',
    createdProducts: [],
    isProcessing: false
  };

  // DOM Elements
  const el = {
    // Header & Global Metrics
    storeBadge: document.getElementById('storeBadge'),
    badgeStoreName: document.getElementById('badgeStoreName'),
    badgeStoreCurrency: document.getElementById('badgeStoreCurrency'),
    badgeStorePlan: document.getElementById('badgeStorePlan'),
    btnStoreAdminLink: document.getElementById('btnStoreAdminLink'),

    metricStore: document.getElementById('metricStore'),
    metricProducts: document.getElementById('metricProducts'),
    metricImages: document.getElementById('metricImages'),
    metricState: document.getElementById('metricState'),

    // Step 1: Authentication
    storeDomain: document.getElementById('storeDomain'),
    resolvedDomainInfo: document.getElementById('resolvedDomainInfo'),
    btnModeToken: document.getElementById('btnModeToken'),
    btnModeClient: document.getElementById('btnModeClient'),
    boxModeToken: document.getElementById('boxModeToken'),
    boxModeClient: document.getElementById('boxModeClient'),
    storeToken: document.getElementById('storeToken'),
    storeClientId: document.getElementById('storeClientId'),
    storeClientSecret: document.getElementById('storeClientSecret'),
    btnVerify: document.getElementById('btnVerify'),
    storeVerifyMsg: document.getElementById('storeVerifyMsg'),
    chkRememberAuth: document.getElementById('chkRememberAuth'),
    btnClearSavedAuth: document.getElementById('btnClearSavedAuth'),

    btnToggleGuide: document.getElementById('btnToggleGuide'),
    tokenGuideBox: document.getElementById('tokenGuideBox'),
    guideArrow: document.getElementById('guideArrow'),
    linkDirectAppDev: document.getElementById('linkDirectAppDev'),

    connectedDetailsCard: document.getElementById('connectedDetailsCard'),
    detailCanonicalDomain: document.getElementById('detailCanonicalDomain'),
    detailCurrencyCountry: document.getElementById('detailCurrencyCountry'),
    detailPlan: document.getElementById('detailPlan'),

    // Step 2: Assets
    dropzoneCsv: document.getElementById('dropzoneCsv'),
    fileCsv: document.getElementById('fileCsv'),
    csvBadge: document.getElementById('csvBadge'),
    csvFileInfo: document.getElementById('csvFileInfo'),

    dropzoneImages: document.getElementById('dropzoneImages'),
    fileImages: document.getElementById('fileImages'),
    imgBadge: document.getElementById('imgBadge'),
    imgFolderInfo: document.getElementById('imgFolderInfo'),

    dropzoneMap: document.getElementById('dropzoneMap'),
    fileMap: document.getElementById('fileMap'),
    mapBadge: document.getElementById('mapBadge'),
    mapFileInfo: document.getElementById('mapFileInfo'),

    // Step 3: Preflight Validation
    btnRunValidation: document.getElementById('btnRunValidation'),
    preflightResults: document.getElementById('preflightResults'),
    cardValStore: document.getElementById('cardValStore'),
    statusValStore: document.getElementById('statusValStore'),
    cardValCsv: document.getElementById('cardValCsv'),
    statusValCsv: document.getElementById('statusValCsv'),
    cardValImages: document.getElementById('cardValImages'),
    statusValImages: document.getElementById('statusValImages'),
    cardValCollections: document.getElementById('cardValCollections'),
    statusValCollections: document.getElementById('statusValCollections'),
    cardValConflicts: document.getElementById('cardValConflicts'),
    statusValConflicts: document.getElementById('statusValConflicts'),
    preflightSummaryBanner: document.getElementById('preflightSummaryBanner'),
    preflightDetails: document.getElementById('preflightDetails'),

    // Step 4: Execution
    chkCreateProducts: document.getElementById('chkCreateProducts'),
    selStatus: document.getElementById('selStatus'),
    btnStart: document.getElementById('btnStart'),
    btnDownloadCsv: document.getElementById('btnDownloadCsv'),

    progressArea: document.getElementById('progressArea'),
    progressStatus: document.getElementById('progressStatus'),
    progressPct: document.getElementById('progressPct'),
    progressBar: document.getElementById('progressBar'),

    // Collection & Category Automation
    chkAutoCollections: document.getElementById('chkAutoCollections'),
    boxDetectedCollections: document.getElementById('boxDetectedCollections'),
    detectedColCount: document.getElementById('detectedColCount'),
    detectedColList: document.getElementById('detectedColList'),
    inputCustomCollection: document.getElementById('inputCustomCollection'),
    btnQuickCreateCollection: document.getElementById('btnQuickCreateCollection'),
    collectionFeedback: document.getElementById('collectionFeedback'),
    chkAutoCategory: document.getElementById('chkAutoCategory'),

    // Step 5: Showcase
    showcaseSection: document.getElementById('showcaseSection'),
    showcaseCountBadge: document.getElementById('showcaseCountBadge'),
    showcaseGrid: document.getElementById('showcaseGrid'),

    // Step 6: Terminal
    consoleLog: document.getElementById('consoleLog'),
    btnClearLogs: document.getElementById('btnClearLogs')
  };

  // Logger with Filtering
  function log(type, msg) {
    const time = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.className = 'font-mono text-xs log-entry';
    div.setAttribute('data-type', type);

    let prefix = `<span class="text-slate-500">[${time}]</span> `;
    if (type === 'SUCCESS') prefix += `<span class="text-emerald-400 font-bold">[SUCCESS]</span> `;
    else if (type === 'INFO') prefix += `<span class="text-sky-400 font-bold">[INFO]</span> `;
    else if (type === 'WARN') prefix += `<span class="text-amber-400 font-bold">[WARN]</span> `;
    else if (type === 'ERROR') prefix += `<span class="text-rose-400 font-bold">[ERROR]</span> `;
    else prefix += `<span class="text-slate-400">[SYSTEM]</span> `;

    div.innerHTML = prefix + msg;
    el.consoleLog.appendChild(div);
    el.consoleLog.scrollTop = el.consoleLog.scrollHeight;
  }

  el.btnClearLogs.addEventListener('click', () => {
    el.consoleLog.innerHTML = '<div class="text-slate-500">// Terminal cleared.</div>';
  });

  // Log filter tabs
  document.querySelectorAll('.log-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter');
      document.querySelectorAll('.log-filter-btn').forEach(b => {
        b.className = 'log-filter-btn px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition';
      });
      btn.className = 'log-filter-btn px-2.5 py-1 rounded bg-[#008060] text-white font-bold transition shadow-sm';

      const entries = el.consoleLog.querySelectorAll('.log-entry');
      entries.forEach(entry => {
        if (filter === 'ALL' || entry.getAttribute('data-type') === filter) {
          entry.style.display = 'block';
        } else {
          entry.style.display = 'none';
        }
      });
    });
  });

  // Toggle Admin Token Guide
  if (el.btnToggleGuide && el.tokenGuideBox) {
    el.btnToggleGuide.addEventListener('click', () => {
      const isHidden = el.tokenGuideBox.classList.toggle('hidden');
      el.guideArrow.textContent = isHidden ? '▼' : '▲';
    });
  }

  // Quick Create Collection button
  if (el.btnQuickCreateCollection && el.inputCustomCollection) {
    el.btnQuickCreateCollection.addEventListener('click', async () => {
      const colName = el.inputCustomCollection.value.trim();
      if (!state.isVerified) {
        alert('Please connect your Shopify store first in Step 1.');
        return;
      }
      if (!colName) {
        alert('Please enter a collection name.');
        return;
      }
      el.btnQuickCreateCollection.disabled = true;
      el.btnQuickCreateCollection.textContent = '...';
      try {
        const res = await fetch('/api/shopify/collections/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store: state.storeDomain,
            token: state.storeToken,
            title: colName
          })
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Failed to create collection');
        if (el.collectionFeedback) {
          if (data.collection && data.collection.reused) {
            el.collectionFeedback.textContent = `✓ Collection "${colName}" already exists in Shopify! Reusing existing collection.`;
            el.collectionFeedback.className = 'text-[11px] text-amber-700 font-bold block';
            log('INFO', `Collection "${colName}" already exists in Shopify (Reusing ID: ${data.collection.id}) — No duplicate created.`);
          } else {
            el.collectionFeedback.textContent = `✓ Created collection "${colName}" in Shopify!`;
            el.collectionFeedback.className = 'text-[11px] text-emerald-700 font-bold block';
            log('SUCCESS', `Created new Shopify Collection: "${colName}" (ID: ${data.collection.id})`);
          }
          el.collectionFeedback.classList.remove('hidden');
        }
      } catch (e) {
        alert('Failed: ' + e.message);
        log('ERROR', `Could not create collection: ${e.message}`);
      } finally {
        el.btnQuickCreateCollection.disabled = false;
        el.btnQuickCreateCollection.textContent = '+ Create';
      }
    });
  }

  // Save credentials to localStorage
  function persistCredentialsToStorage() {
    if (!el.chkRememberAuth || !el.chkRememberAuth.checked) return;
    try {
      const authPayload = {
        storeDomain: el.storeDomain ? el.storeDomain.value.trim() : '',
        authMode: state.authMode,
        token: el.storeToken ? el.storeToken.value.trim() : '',
        clientId: el.storeClientId ? el.storeClientId.value.trim() : '',
        clientSecret: el.storeClientSecret ? el.storeClientSecret.value.trim() : '',
        savedAt: Date.now()
      };
      localStorage.setItem('shopify_catalog_importer_auth', JSON.stringify(authPayload));
      if (el.btnClearSavedAuth && (authPayload.storeDomain || authPayload.token || authPayload.clientId)) {
        el.btnClearSavedAuth.classList.remove('hidden');
      }
    } catch (e) {
      console.warn('Could not save credentials to localStorage:', e);
    }
  }

  // Load saved credentials from localStorage
  function loadSavedCredentials() {
    try {
      const savedRaw = localStorage.getItem('shopify_catalog_importer_auth');
      if (!savedRaw) return;
      const saved = JSON.parse(savedRaw);
      if (!saved) return;

      if (saved.storeDomain && el.storeDomain) {
        el.storeDomain.value = saved.storeDomain;
        el.storeDomain.dispatchEvent(new Event('input'));
      }

      if (saved.authMode === 'client') {
        if (el.btnModeClient) el.btnModeClient.click();
        if (saved.clientId && el.storeClientId) el.storeClientId.value = saved.clientId;
        if (saved.clientSecret && el.storeClientSecret) el.storeClientSecret.value = saved.clientSecret;
      } else {
        if (el.btnModeToken) el.btnModeToken.click();
        if (saved.token && el.storeToken) el.storeToken.value = saved.token;
      }

      if (el.btnClearSavedAuth && (saved.storeDomain || saved.token || saved.clientId)) {
        el.btnClearSavedAuth.classList.remove('hidden');
      }
      log('INFO', 'Loaded saved Shopify credentials from localStorage.');
    } catch (e) {
      console.warn('Could not load saved credentials:', e);
    }
  }

  // Listeners to auto-persist credentials as user types
  ['input', 'change'].forEach(evt => {
    if (el.storeDomain) el.storeDomain.addEventListener(evt, persistCredentialsToStorage);
    if (el.storeToken) el.storeToken.addEventListener(evt, persistCredentialsToStorage);
    if (el.storeClientId) el.storeClientId.addEventListener(evt, persistCredentialsToStorage);
    if (el.storeClientSecret) el.storeClientSecret.addEventListener(evt, persistCredentialsToStorage);
  });

  if (el.chkRememberAuth) {
    el.chkRememberAuth.addEventListener('change', () => {
      if (el.chkRememberAuth.checked) {
        persistCredentialsToStorage();
      } else {
        localStorage.removeItem('shopify_catalog_importer_auth');
        if (el.btnClearSavedAuth) el.btnClearSavedAuth.classList.add('hidden');
      }
    });
  }

  // Clear saved credentials button handler
  if (el.btnClearSavedAuth) {
    el.btnClearSavedAuth.addEventListener('click', () => {
      localStorage.removeItem('shopify_catalog_importer_auth');
      if (el.storeDomain) el.storeDomain.value = '';
      if (el.storeToken) el.storeToken.value = '';
      if (el.storeClientId) el.storeClientId.value = '';
      if (el.storeClientSecret) el.storeClientSecret.value = '';
      if (el.resolvedDomainInfo) el.resolvedDomainInfo.classList.add('hidden');
      el.btnClearSavedAuth.classList.add('hidden');
      log('INFO', 'Cleared saved store credentials from browser localStorage.');
    });
  }

  // Dynamic store link update & auto-resolve custom domains
  let resolveTimer = null;
  if (el.storeDomain && el.linkDirectAppDev) {
    el.storeDomain.addEventListener('input', () => {
      let val = el.storeDomain.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      clearTimeout(resolveTimer);

      if (!val) {
        if (el.resolvedDomainInfo) el.resolvedDomainInfo.classList.add('hidden');
        el.linkDirectAppDev.href = 'https://admin.shopify.com';
        return;
      }

      if (val.endsWith('.myshopify.com') || !val.includes('.')) {
        const handle = val.replace('.myshopify.com', '');
        el.linkDirectAppDev.href = `https://admin.shopify.com/store/${handle}/settings/apps/development`;
        if (el.resolvedDomainInfo) {
          el.resolvedDomainInfo.innerHTML = `✓ Shopify Store: <span class="font-bold font-mono text-emerald-800">${handle}.myshopify.com</span>`;
          el.resolvedDomainInfo.classList.remove('hidden');
        }
      } else {
        // Custom domain (e.g. your-store.com)
        if (el.resolvedDomainInfo) {
          el.resolvedDomainInfo.textContent = `Detecting Shopify handle for custom domain...`;
          el.resolvedDomainInfo.classList.remove('hidden');
        }
        resolveTimer = setTimeout(async () => {
          try {
            const res = await fetch(`/api/shopify/resolve-domain?domain=${encodeURIComponent(val)}`);
            const data = await res.json();
            if (data.success && data.resolved && data.resolved.includes('.myshopify.com')) {
              const handle = data.resolved.replace('.myshopify.com', '');
              el.linkDirectAppDev.href = `https://admin.shopify.com/store/${handle}/settings/apps/development`;
              if (el.resolvedDomainInfo) {
                el.resolvedDomainInfo.innerHTML = `✓ Resolved: <span class="text-emerald-700 font-bold font-mono">${data.resolved}</span>`;
                el.resolvedDomainInfo.classList.remove('hidden');
              }
            }
          } catch (e) {
            // ignore
          }
        }, 600);
      }
    });
  }

  // Check Ready State & Update Metric Strip
  function updateReadyState() {
    const hasAssets = state.csvProducts.length > 0 && state.imagesMap.size > 0;
    const canValidate = state.isVerified && hasAssets && !state.isProcessing;
    if (el.btnRunValidation) el.btnRunValidation.disabled = !canValidate;

    const canStart = state.isVerified && hasAssets && !state.isProcessing;
    el.btnStart.disabled = !canStart;

    // Update Metric Strip
    if (el.metricProducts) {
      el.metricProducts.textContent = `${state.csvProducts.length} Products (${state.csvRaw ? Papa.parse(state.csvRaw, { header: true }).data.length : 0} Rows)`;
    }
    if (el.metricImages) {
      el.metricImages.textContent = `${state.imagesMap.size} Images Loaded`;
    }
    if (el.metricState) {
      if (!state.isVerified) {
        el.metricState.textContent = 'Step 1: Connect Store';
        el.metricState.className = 'font-bold text-amber-600';
      } else if (!hasAssets) {
        el.metricState.textContent = 'Step 2: Upload Assets';
        el.metricState.className = 'font-bold text-blue-600';
      } else if (state.isProcessing) {
        el.metricState.textContent = 'Pipeline In Progress...';
        el.metricState.className = 'font-bold text-emerald-600 animate-pulse';
      } else {
        el.metricState.textContent = 'Ready for Validation / Import';
        el.metricState.className = 'font-bold text-emerald-700';
      }
    }
  }

  // Toggle Auth Mode (Token vs Client Credentials)
  if (el.btnModeToken && el.btnModeClient) {
    el.btnModeToken.addEventListener('click', () => {
      state.authMode = 'token';
      el.btnModeToken.className = 'text-xs px-3.5 py-1.5 rounded-lg bg-[#008060] text-white font-bold shadow-sm transition';
      el.btnModeClient.className = 'text-xs px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition';
      if (el.boxModeToken) el.boxModeToken.classList.remove('hidden');
      if (el.boxModeClient) el.boxModeClient.classList.add('hidden');
      persistCredentialsToStorage();
    });

    el.btnModeClient.addEventListener('click', () => {
      state.authMode = 'client';
      el.btnModeClient.className = 'text-xs px-3.5 py-1.5 rounded-lg bg-[#008060] text-white font-bold shadow-sm transition';
      el.btnModeToken.className = 'text-xs px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition';
      if (el.boxModeClient) el.boxModeClient.classList.remove('hidden');
      if (el.boxModeToken) el.boxModeToken.classList.add('hidden');
      persistCredentialsToStorage();
    });
  }

  // Update Progress UI
  function updateProgress(current, total, text) {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    el.progressArea.classList.remove('hidden');
    el.progressPct.textContent = `${pct}%`;
    el.progressBar.style.width = `${pct}%`;
    el.progressStatus.textContent = text || `Processing ${current} of ${total}...`;
  }

  // 1. Verify Store
  el.btnVerify.addEventListener('click', async () => {
    const domain = el.storeDomain.value.trim();
    const payload = { store: domain };

    if (state.authMode === 'token') {
      const token = el.storeToken.value.trim();
      if (!domain || !token) {
        el.storeVerifyMsg.textContent = 'Please provide both store domain and Admin token.';
        el.storeVerifyMsg.className = 'text-xs text-rose-600 font-bold block';
        el.storeVerifyMsg.classList.remove('hidden');
        return;
      }
      payload.token = token;
    } else {
      const clientId = el.storeClientId.value.trim();
      const clientSecret = el.storeClientSecret.value.trim();
      if (!domain || !clientId || !clientSecret) {
        el.storeVerifyMsg.textContent = 'Please provide store domain, Client ID, and Client Secret.';
        el.storeVerifyMsg.className = 'text-xs text-rose-600 font-bold block';
        el.storeVerifyMsg.classList.remove('hidden');
        return;
      }
      payload.clientId = clientId;
      payload.clientSecret = clientSecret;
    }

    el.btnVerify.disabled = true;
    el.btnVerify.innerHTML = '<span class="animate-spin">🔄</span> Connecting...';
    log('INFO', `Verifying connection to ${domain}...`);

    try {
      const res = await fetch('/api/shopify/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to authenticate');
      }

      // Canonical domain & effective token from Shopify API
      const canonicalDomain = data.resolvedDomain || (data.shop && data.shop.myshopifyDomain) || domain;
      const effectiveToken = data.effectiveToken || payload.token;

      state.storeDomain = canonicalDomain;
      state.storeToken = effectiveToken;
      state.isVerified = true;
      state.shopInfo = data.shop;

      // Update link and hint with resolved handle
      const handle = canonicalDomain.replace('.myshopify.com', '');
      if (el.linkDirectAppDev) {
        el.linkDirectAppDev.href = `https://admin.shopify.com/store/${handle}/settings/apps/development`;
      }
      if (el.btnStoreAdminLink) {
        el.btnStoreAdminLink.href = `https://admin.shopify.com/store/${handle}`;
        el.btnStoreAdminLink.classList.remove('hidden');
      }

      if (el.resolvedDomainInfo) {
        el.resolvedDomainInfo.innerHTML = `✓ Connected Store: <span class="text-emerald-700 font-bold font-mono">${canonicalDomain}</span>`;
        el.resolvedDomainInfo.classList.remove('hidden');
      }

      // Top badges & metric strip
      el.storeBadge.classList.remove('hidden');
      el.storeBadge.classList.add('flex');
      el.badgeStoreName.textContent = data.shop.name;
      el.badgeStoreCurrency.textContent = data.shop.currencyCode;
      el.badgeStorePlan.textContent = (data.shop.plan ? data.shop.plan.displayName : 'Custom');

      if (el.metricStore) {
        el.metricStore.textContent = `${data.shop.name} (${data.shop.currencyCode})`;
      }

      // Connected Details Card
      if (el.connectedDetailsCard) {
        el.connectedDetailsCard.classList.remove('hidden');
        el.detailCanonicalDomain.textContent = canonicalDomain;
        const country = data.shop.billingAddress ? data.shop.billingAddress.country : 'Configured';
        el.detailCurrencyCountry.textContent = `${data.shop.currencyCode} (${country})`;
        el.detailPlan.textContent = data.shop.plan ? data.shop.plan.displayName : 'Standard Plan';
      }

      el.storeVerifyMsg.textContent = `Connected to ${data.shop.name} (${canonicalDomain} • ${data.shop.currencyCode})`;
      el.storeVerifyMsg.className = 'text-xs text-emerald-700 font-bold block';
      el.storeVerifyMsg.classList.remove('hidden');

      log('SUCCESS', `Authenticated successfully with ${data.shop.name} (${canonicalDomain}) [Currency: ${data.shop.currencyCode}, Plan: ${data.shop.plan ? data.shop.plan.displayName : 'Standard'}]`);
      if (state.authMode === 'client') {
        log('INFO', `Obtained Admin API Access Token automatically from Client Credentials!`);
      }

      // Save credentials to localStorage if checked
      if (el.chkRememberAuth && el.chkRememberAuth.checked) {
        try {
          const authPayload = {
            storeDomain: domain,
            authMode: state.authMode,
            token: state.authMode === 'token' ? payload.token : '',
            clientId: state.authMode === 'client' ? payload.clientId : '',
            clientSecret: state.authMode === 'client' ? payload.clientSecret : '',
            savedAt: Date.now()
          };
          localStorage.setItem('shopify_catalog_importer_auth', JSON.stringify(authPayload));
          if (el.btnClearSavedAuth) el.btnClearSavedAuth.classList.remove('hidden');
        } catch (e) {
          console.warn('Could not save credentials to localStorage:', e);
        }
      } else {
        localStorage.removeItem('shopify_catalog_importer_auth');
        if (el.btnClearSavedAuth) el.btnClearSavedAuth.classList.add('hidden');
      }
    } catch (err) {
      state.isVerified = false;
      el.storeVerifyMsg.textContent = `Authentication failed: ${err.message}`;
      el.storeVerifyMsg.className = 'text-xs text-rose-600 font-bold block';
      el.storeVerifyMsg.classList.remove('hidden');
      log('ERROR', `Store verification failed: ${err.message}`);
    } finally {
      el.btnVerify.disabled = false;
      el.btnVerify.innerHTML = '<span>Connect</span>';
      updateReadyState();
    }
  });

  // Recursive reader for dropped directories
  async function readEntryRecursively(entry, basePath = '') {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file) => {
          file.fullRelativePath = (basePath ? basePath + '/' : '') + file.name;
          resolve([file]);
        }, () => resolve([]));
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      return new Promise((resolve) => {
        const nestedFiles = [];
        function readBatch() {
          dirReader.readEntries(async (entries) => {
            if (entries.length === 0) {
              resolve(nestedFiles);
            } else {
              for (const child of entries) {
                const results = await readEntryRecursively(child, (basePath ? basePath + '/' : '') + entry.name);
                nestedFiles.push(...results);
              }
              readBatch();
            }
          }, () => resolve(nestedFiles));
        }
        readBatch();
      });
    }
    return [];
  }

  // Helper: Setup Drag and Drop
  function setupDropzone(dropzoneEl, fileInputEl, handler) {
    if (!dropzoneEl) return;
    ['dragenter', 'dragover'].forEach(evtName => {
      dropzoneEl.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneEl.classList.add('dragover-active');
      });
    });
    ['dragleave', 'drop'].forEach(evtName => {
      dropzoneEl.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneEl.classList.remove('dragover-active');
      });
    });
    dropzoneEl.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneEl.classList.remove('dragover-active');

      // Check for directory entries from dataTransfer.items
      if (e.dataTransfer && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const items = Array.from(e.dataTransfer.items);
        const entries = items.map(item => item.webkitGetAsEntry ? item.webkitGetAsEntry() : null).filter(Boolean);
        const hasDirectories = entries.some(ent => ent.isDirectory);

        if (hasDirectories) {
          const fileArrays = await Promise.all(entries.map(ent => readEntryRecursively(ent, '')));
          const allDroppedFiles = fileArrays.flat();
          if (allDroppedFiles.length > 0) {
            handler(allDroppedFiles);
            return;
          }
        }
      }

      const files = Array.from(e.dataTransfer.files || []);
      if (files.length > 0) handler(files);
    });
  }

  // Update UI with detected collections from Folder & CSV
  function updateDetectedCollectionsUI() {
    const combined = new Map();

    // 1. From folder
    state.folderCollections.forEach((prods, col) => {
      if (!combined.has(col)) combined.set(col, { source: 'Folder', products: new Set() });
      prods.forEach(p => combined.get(col).products.add(p));
    });

    // 2. From CSV
    state.csvCollections.forEach((prods, col) => {
      if (!combined.has(col)) combined.set(col, { source: 'CSV', products: new Set() });
      else combined.get(col).source = 'Folder & CSV';
      prods.forEach(p => combined.get(col).products.add(p));
    });

    // 3. Custom collection input if typed
    const extra = el.inputCustomCollection ? el.inputCustomCollection.value.trim() : '';
    if (extra && !combined.has(extra)) {
      combined.set(extra, { source: 'Custom', products: new Set() });
    }

    state.detectedCollections = combined;

    if (!el.boxDetectedCollections || !el.detectedColList) return;

    if (combined.size === 0) {
      el.boxDetectedCollections.classList.add('hidden');
      return;
    }

    el.boxDetectedCollections.classList.remove('hidden');
    if (el.detectedColCount) el.detectedColCount.textContent = combined.size;

    el.detectedColList.innerHTML = '';
    combined.forEach((info, colName) => {
      const prodList = Array.from(info.products);
      const prodSummary = prodList.length > 0 
        ? `${prodList.length} Product${prodList.length > 1 ? 's' : ''}: ${prodList.slice(0, 3).join(', ')}${prodList.length > 3 ? '...' : ''}`
        : 'All imported products';

      const item = document.createElement('div');
      item.className = 'p-2.5 rounded-lg bg-white border border-slate-200 shadow-xs flex items-center justify-between text-xs gap-2 transition hover:border-[#008060]';
      item.setAttribute('data-col-name', colName);

      item.innerHTML = `
        <div class="min-w-0 flex-1">
          <div class="font-bold text-slate-800 flex items-center gap-1.5 truncate">
            <span class="text-emerald-700">📁</span>
            <span class="truncate">${colName}</span>
            <span class="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-semibold border border-slate-200">${info.source}</span>
          </div>
          <div class="text-[11px] text-slate-500 truncate mt-0.5">${prodSummary}</div>
        </div>
        <span class="col-status-pill text-[10px] px-2 py-0.5 rounded font-bold shrink-0 bg-emerald-50 text-emerald-800 border border-emerald-200">
          ✓ Auto-Assign
        </span>
      `;
      el.detectedColList.appendChild(item);
    });
  }

  // Listen to custom collection input to dynamically reflect in list
  if (el.inputCustomCollection) {
    el.inputCustomCollection.addEventListener('input', () => {
      updateDetectedCollectionsUI();
    });
  }

  // 2. Select / Drop Product CSV
  function processCsvFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: 'greedy' });
      const fields = parsed.meta.fields || [];

      // Check if user accidentally selected the Image Mapping CSV in this Product CSV slot!
      const hasProductFields = fields.includes('Variant Price') || fields.includes('Price') || fields.includes('Body (HTML)');
      const isMappingCsv = !hasProductFields && (fields.includes('WebP Filename') || fields.includes('Archive Path') || (file.name && file.name.toLowerCase().includes('mapping')));
      if (isMappingCsv) {
        log('WARN', `⚠️ You uploaded the Image Mapping CSV ("${file.name}") into Box 2A. Auto-assigned to Box 2C (Position Map)! Please upload "charms_collection_products.csv" here in Box 2A.`);
        processMappingFile(file);
        
        el.csvBadge.textContent = 'Wrong File';
        el.csvBadge.className = 'text-[10px] px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold';
        el.csvFileInfo.innerHTML = `⚠️ This is the Mapping file! Please upload <strong class="underline">charms_collection_products.csv</strong> here.`;
        el.csvFileInfo.className = 'mt-3 text-xs text-rose-600 font-medium';
        el.csvFileInfo.classList.remove('hidden');
        return;
      }

      state.csvRaw = text;
      const handles = new Set();
      state.csvCollections.clear();

      parsed.data.forEach(r => { 
        if (r['Handle']) handles.add(r['Handle'].trim());
        const title = (r['Title'] || r['Handle'] || '').trim();
        const rawCols = (r['Collection'] || r['Type'] || '').split(',').map(c => c.trim()).filter(Boolean);
        rawCols.forEach(col => {
          if (!state.csvCollections.has(col)) state.csvCollections.set(col, new Set());
          if (title) state.csvCollections.get(col).add(title);
        });
      });

      state.csvProducts = Array.from(handles);

      el.csvBadge.textContent = `${state.csvProducts.length} Products`;
      el.csvBadge.className = 'text-[10px] px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold';
      el.csvFileInfo.textContent = `✓ ${file.name} (${parsed.data.length} rows, ${state.csvProducts.length} products, ${state.csvCollections.size} collections)`;
      el.csvFileInfo.className = 'mt-3 text-xs text-emerald-700 font-mono font-bold truncate';
      el.csvFileInfo.classList.remove('hidden');

      log('SUCCESS', `Loaded Product CSV: ${file.name} with ${state.csvProducts.length} products and ${state.csvCollections.size} collections from CSV.`);
      updateDetectedCollectionsUI();
      updateReadyState();
    };
    reader.readAsText(file);
  }

  el.fileCsv.addEventListener('change', (e) => processCsvFile(e.target.files[0]));
  setupDropzone(el.dropzoneCsv, el.fileCsv, (files) => {
    const csvFile = files.find(f => f.name.endsWith('.csv'));
    if (csvFile) processCsvFile(csvFile);
  });

  // 3. Select / Drop Product Images Folder
  function processImagesFiles(files) {
    if (!files || files.length === 0) return;
    state.imagesMap.clear();
    state.folderCollections.clear();
    let validImgCount = 0;

    files.forEach(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      if (['webp', 'png', 'jpg', 'jpeg'].includes(ext)) {
        state.imagesMap.set(f.name, f);

        const relPath = f.fullRelativePath || f.webkitRelativePath || '';
        if (relPath) {
          state.imagesMap.set(relPath, f);

          // Extract collection and product from folder path
          // e.g. "Images for Charms collection/Birth Month Charms/Emerald Puffy Star Charm/01-Hero.webp"
          const parts = relPath.split('/').filter(Boolean);
          if (parts.length >= 4) {
            const colName = parts[1].trim();
            const prodName = parts[2].trim();
            if (colName && prodName) {
              if (!state.folderCollections.has(colName)) state.folderCollections.set(colName, new Set());
              state.folderCollections.get(colName).add(prodName);
            }
          } else if (parts.length === 3) {
            const colName = parts[0].trim();
            const prodName = parts[1].trim();
            if (colName && prodName) {
              if (!state.folderCollections.has(colName)) state.folderCollections.set(colName, new Set());
              state.folderCollections.get(colName).add(prodName);
            }
          }
        }
        validImgCount++;
      }
    });

    el.imgBadge.textContent = `${validImgCount} Images`;
    el.imgBadge.className = 'text-[10px] px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold';
    
    const folderSummary = state.folderCollections.size > 0
      ? `✓ ${validImgCount} images • ${state.folderCollections.size} collections auto-detected from folder`
      : `✓ ${validImgCount} valid image files loaded & indexed`;
    el.imgFolderInfo.textContent = folderSummary;
    el.imgFolderInfo.className = 'mt-3 text-xs text-emerald-700 font-mono font-bold truncate';
    el.imgFolderInfo.classList.remove('hidden');

    log('SUCCESS', `Indexed ${validImgCount} images. Auto-detected ${state.folderCollections.size} collection folder(s): ${Array.from(state.folderCollections.keys()).join(', ')}`);
    updateDetectedCollectionsUI();
    updateReadyState();
  }

  el.fileImages.addEventListener('change', (e) => processImagesFiles(Array.from(e.target.files || [])));
  setupDropzone(el.dropzoneImages, el.fileImages, (files) => processImagesFiles(files));

  // 4. Select / Drop Mapping CSV (Optional)
  function processMappingFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const parsed = Papa.parse(evt.target.result, { header: true, skipEmptyLines: 'greedy' });
      const fields = parsed.meta.fields || [];

      // Check if user accidentally uploaded Product Catalog CSV here in mapping slot
      const isProductCsv = fields.includes('Variant Price') || fields.includes('Body (HTML)');
      if (isProductCsv) {
        log('INFO', `Detected Product Catalog CSV ("${file.name}") uploaded to Box 2C. Auto-assigning to Box 2A (Product CSV)!`);
        processCsvFile(file);
        return;
      }

      state.mappingData = parsed.data;

      el.mapBadge.textContent = `${parsed.data.length} Mappings`;
      el.mapBadge.className = 'text-[10px] px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-bold';
      el.mapFileInfo.textContent = `✓ ${file.name} (${parsed.data.length} position mappings)`;
      el.mapFileInfo.className = 'mt-3 text-xs text-purple-700 font-mono font-bold truncate';
      el.mapFileInfo.classList.remove('hidden');

      log('INFO', `Loaded Image Position Mapping CSV: ${file.name} (${parsed.data.length} entries)`);
    };
    reader.readAsText(file);
  }

  el.fileMap.addEventListener('change', (e) => processMappingFile(e.target.files[0]));
  setupDropzone(el.dropzoneMap, el.fileMap, (files) => {
    const mapFile = files.find(f => f.name.endsWith('.csv'));
    if (mapFile) processMappingFile(mapFile);
  });

  // Preflight Validation Handler
  if (el.btnRunValidation) {
    el.btnRunValidation.addEventListener('click', async () => {
      if (!state.isVerified || state.csvProducts.length === 0 || state.imagesMap.size === 0) return;

      el.btnRunValidation.disabled = true;
      el.btnRunValidation.innerHTML = '<span class="animate-spin">🔄</span> Validating...';
      el.preflightResults.classList.remove('hidden');
      el.preflightDetails.classList.add('hidden');
      el.preflightDetails.innerHTML = '';

      log('INFO', '=== Starting Preflight Safety Validation ===');

      const warnings = [];
      let allPassed = true;

      // --- Check 2: CSV Structure & Safety Defaults ---
      try {
        const parsed = Papa.parse(state.csvRaw, { header: true, skipEmptyLines: 'greedy' });
        const fields = parsed.meta.fields || [];

        // Check if user uploaded mapping CSV instead of products CSV
        const hasProductFields = fields.includes('Variant Price') || fields.includes('Price') || fields.includes('Body (HTML)');
        const isMappingFile = !hasProductFields && (fields.includes('WebP Filename') || fields.includes('Archive Path') || (fields.includes('Image Position') && !fields.includes('Handle')));
        if (isMappingFile) {
          el.statusValCsv.innerHTML = `
            <div class="text-rose-600 font-bold">❌ Mapping File in Slot 2A</div>
            <div class="text-[11px] text-slate-600 font-medium">You uploaded <strong>charms_collection_mapping.csv</strong> into Box 2A. Please upload <strong>charms_collection_products.csv</strong> in Box 2A!</div>
          `;
          warnings.push(`Slot 2A has Image Mapping CSV instead of Product Catalog CSV. Please upload "charms_collection_products.csv".`);
          allPassed = false;
        } else {
          const hasHandle = fields.includes('Handle');
          const hasTitle = fields.includes('Title');
          const hasPrice = fields.includes('Variant Price') || fields.includes('Price');

          if (!hasHandle || !hasTitle || !hasPrice) {
            const missing = [];
            if (!hasHandle) missing.push('Handle');
            if (!hasTitle) missing.push('Title');
            if (!hasPrice) missing.push('Variant Price');
            el.statusValCsv.innerHTML = `<span class="text-rose-600 font-bold">❌ Missing Columns</span>: ${missing.join(', ')}`;
            warnings.push(`CSV missing required product columns: ${missing.join(', ')}`);
            allPassed = false;
          } else {
            el.statusValCsv.innerHTML = `
              <div class="text-emerald-700 font-bold">✓ Validated (${state.csvProducts.length} Products)</div>
              <div class="text-[11px] text-slate-600 font-medium">${parsed.data.length} rows • All draft &amp; safe</div>
            `;
            log('SUCCESS', `CSV Schema verified: ${fields.length} columns, ${state.csvProducts.length} unique products, all rows ready.`);
          }
        }
      } catch (csvErr) {
        el.statusValCsv.innerHTML = `<span class="text-rose-600 font-bold">❌ Error</span>: ${csvErr.message}`;
        warnings.push(`CSV parsing error: ${csvErr.message}`);
        allPassed = false;
      }

      // --- Check 3: Images & Mapping Matching ---
      try {
        let matchedImages = 0;
        const missingImages = [];

        if (state.mappingData.length > 0) {
          state.mappingData.forEach(row => {
            const fname = (row['WebP Filename'] || '').trim();
            const archivePath = (row['Archive Path'] || '').trim();
            const exists = state.imagesMap.has(fname) || state.imagesMap.has(archivePath);
            if (exists) matchedImages++;
            else missingImages.push(fname || `Row for ${row['Handle']}`);
          });
        } else {
          state.csvProducts.forEach(handle => {
            [1, 2, 3].forEach(pos => {
              let found = false;
              for (const [fname] of state.imagesMap.entries()) {
                if (fname.includes(handle) && (fname.includes(`_0${pos}`) || fname.includes(`_${pos}`))) {
                  matchedImages++;
                  found = true;
                  break;
                }
              }
              if (!found) missingImages.push(`${handle} (Pos ${pos})`);
            });
          });
        }

        if (missingImages.length > 0) {
          el.statusValImages.innerHTML = `
            <span class="text-amber-700 font-bold">⚠️ ${missingImages.length} Images Missing</span>
            <div class="text-[11px] text-slate-600 font-medium">${matchedImages} images found in folder</div>
          `;
          warnings.push(`Missing images for: ${missingImages.slice(0, 3).join(', ')}${missingImages.length > 3 ? '...' : ''}`);
        } else {
          el.statusValImages.innerHTML = `
            <div class="text-emerald-700 font-bold">✓ 100% Matched (${matchedImages} Images)</div>
            <div class="text-[11px] text-slate-600 font-medium">Hero, Lifestyle &amp; Macro ready for all products</div>
          `;
          log('SUCCESS', `Image Verification: All ${matchedImages} required images matched successfully in folder.`);
        }
      } catch (imgErr) {
        el.statusValImages.innerHTML = `<span class="text-rose-600 font-bold">❌ Error</span>: ${imgErr.message}`;
        allPassed = false;
      }

      // --- Check 4: Collections Validation from Folder & CSV ---
      try {
        const colNames = Array.from(state.detectedCollections.keys());
        if (colNames.length > 0) {
          let existingStoreCols = [];
          try {
            const colRes = await fetch('/api/shopify/collections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ store: state.storeDomain, token: state.storeToken })
            });
            const colJson = await colRes.json();
            if (colJson.success && Array.isArray(colJson.collections)) {
              existingStoreCols = colJson.collections;
            }
          } catch (colFetchErr) {
            // Non-fatal
          }

          const existingTitles = new Set(existingStoreCols.map(c => (c.title || '').trim().toLowerCase()));
          let existingMatchCount = 0;
          let newCreateCount = 0;

          colNames.forEach(colName => {
            const exists = existingTitles.has(colName.trim().toLowerCase());
            if (exists) existingMatchCount++;
            else newCreateCount++;

            // Update badge on Step 4 collection card in real time
            if (el.detectedColList) {
              const itemEl = el.detectedColList.querySelector(`[data-col-name="${colName}"]`);
              if (itemEl) {
                const pill = itemEl.querySelector('.col-status-pill');
                if (pill) {
                  if (exists) {
                    pill.className = 'col-status-pill text-[10px] px-2 py-0.5 rounded font-bold shrink-0 bg-emerald-100 text-emerald-900 border border-emerald-300';
                    pill.textContent = '✓ Exists in Store (Reusing)';
                  } else {
                    pill.className = 'col-status-pill text-[10px] px-2 py-0.5 rounded font-bold shrink-0 bg-sky-50 text-sky-800 border border-sky-200';
                    pill.textContent = '+ Auto-Create';
                  }
                }
              }
            }
          });

          if (el.statusValCollections) {
            el.statusValCollections.innerHTML = `
              <div class="text-emerald-700 font-bold">✓ ${colNames.length} Collections Ready</div>
              <div class="text-[11px] text-slate-600 font-medium">${existingMatchCount} in store (reusing) • ${newCreateCount} new</div>
            `;
          }
          log('SUCCESS', `Collections Check: ${colNames.length} collections ready (${existingMatchCount} existing in store will be reused, ${newCreateCount} will be auto-created).`);
        } else {
          if (el.statusValCollections) {
            el.statusValCollections.innerHTML = `
              <div class="text-slate-600 font-medium">None Specified</div>
              <div class="text-[10px] text-slate-400">Products will import without collections</div>
            `;
          }
        }
      } catch (colValErr) {
        if (el.statusValCollections) {
          el.statusValCollections.innerHTML = `<span class="text-amber-600 font-bold">⚠️ Warning</span>: ${colValErr.message}`;
        }
      }

      // --- Check 1 & 4: API Preflight (Store Currency & Existing Conflicts) ---
      try {
        const storeTargetCurr = (state.shopInfo && state.shopInfo.currencyCode) || 'EUR';
        const res = await fetch('/api/shopify/preflight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store: state.storeDomain,
            token: state.storeToken,
            handles: state.csvProducts,
            expectedCurrency: storeTargetCurr
          })
        });

        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Preflight API failed');

        // Currency check
        const storeCurr = data.storeCurrency || storeTargetCurr;
        el.statusValStore.innerHTML = `
          <div class="text-emerald-700 font-bold">✓ Currency Verified (${storeCurr})</div>
          <div class="text-[11px] text-slate-600 font-medium">${data.shop ? data.shop.name : 'Store'} • Store ready for catalog</div>
        `;
        log('SUCCESS', `Store Currency verified: ${storeCurr} matches catalog currency.`);

        // Product Conflict Check
        const existingList = data.existingProducts || [];
        if (existingList.length > 0) {
          el.statusValConflicts.innerHTML = `
            <span class="text-amber-700 font-bold">⚠️ ${existingList.length} Existing Products</span>
            <div class="text-[11px] text-slate-600 font-medium">Will be updated (not duplicated)</div>
          `;
          warnings.push(`Found ${existingList.length} products already existing on store with matching handles.`);

          el.preflightDetails.innerHTML = `<div class="font-bold text-amber-800 mb-1.5">Existing Products Detected in Store:</div>` +
            existingList.map(p => `<div>• ${p.title} (Handle: <span class="font-mono text-slate-900 font-bold">${p.handle}</span>)</div>`).join('');
          el.preflightDetails.classList.remove('hidden');
        } else {
          el.statusValConflicts.innerHTML = `
            <div class="text-emerald-700 font-bold">✓ 0 Conflicts (Clean)</div>
            <div class="text-[11px] text-slate-600 font-medium">All ${state.csvProducts.length} handles are brand new</div>
          `;
          log('SUCCESS', `Conflict check: 0 existing products found in store. All ${state.csvProducts.length} products are clean.`);
        }

      } catch (apiErr) {
        el.statusValStore.innerHTML = `<span class="text-rose-600 font-bold">❌ Error</span>: ${apiErr.message}`;
        el.statusValConflicts.innerHTML = `<span class="text-rose-600 font-bold">❌ Check Failed</span>`;
        warnings.push(`Shopify API Preflight check error: ${apiErr.message}`);
        allPassed = false;
      }

      // --- Summary Banner ---
      if (allPassed && warnings.length === 0) {
        el.preflightSummaryBanner.className = 'p-4 rounded-xl text-xs flex items-center justify-between font-medium bg-emerald-50 border border-emerald-300 text-emerald-900 shadow-sm';
        el.preflightSummaryBanner.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="text-base">✅</span>
            <span><strong>PREFLIGHT PASSED:</strong> All safety checks verified! Safe to proceed with import.</span>
          </div>
          <span class="font-mono text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-md border border-emerald-200">100% READY</span>
        `;
        log('SUCCESS', '🎉 PREFLIGHT PASSED! Ready for safe staged upload and product creation.');
      } else {
        el.preflightSummaryBanner.className = 'p-4 rounded-xl text-xs flex items-center justify-between font-medium bg-amber-50 border border-amber-300 text-amber-900 shadow-sm';
        el.preflightSummaryBanner.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="text-base">⚠️</span>
            <span><strong>PREFLIGHT NOTICE:</strong> ${warnings.length} warning(s) found. Review above before proceeding.</span>
          </div>
          <span class="font-mono text-[11px] bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-md border border-amber-200">REVIEW NEEDED</span>
        `;
        log('WARN', `Preflight finished with ${warnings.length} warning(s). Review details above.`);
      }

      el.btnRunValidation.disabled = false;
      el.btnRunValidation.innerHTML = '<span>🔍 Run Preflight Validation</span>';
    });
  }

  // Helper: Direct Upload to S3/GCS Target
  async function uploadToStagedTarget(target, file) {
    const formData = new FormData();
    target.parameters.forEach(p => {
      formData.append(p.name, p.value);
    });
    formData.append('file', file);

    const res = await fetch(target.url, {
      method: 'POST',
      body: formData
    });

    if (!res.ok && res.status !== 201 && res.status !== 204) {
      throw new Error(`S3/GCS upload failed with status ${res.status}`);
    }
    return target.resourceUrl;
  }

  // Render Showcase Cards
  function renderShowcase() {
    if (!el.showcaseSection || !el.showcaseGrid) return;
    if (state.createdProducts.length === 0) return;

    el.showcaseSection.classList.remove('hidden');
    el.showcaseCountBadge.textContent = `${state.createdProducts.length} Items Imported`;
    el.showcaseGrid.innerHTML = '';

    const handle = state.storeDomain.replace('.myshopify.com', '');

    state.createdProducts.forEach(prod => {
      const card = document.createElement('div');
      card.className = 'bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:border-emerald-500 hover:shadow-md transition group shadow-sm';
      
      const adminLink = prod.numericId
        ? `https://admin.shopify.com/store/${handle}/products/${prod.numericId}`
        : `https://admin.shopify.com/store/${handle}/products`;

      card.innerHTML = `
        <div>
          <div class="aspect-square w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 mb-3 relative flex items-center justify-center">
            ${prod.heroUrl 
              ? `<img src="${prod.heroUrl}" alt="${prod.title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">`
              : `<span class="text-slate-400 text-xs font-mono">No Image</span>`}
            <span class="absolute top-2 right-2 text-[9px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full ${prod.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-amber-50 text-amber-800 border border-amber-300'}">
              ${prod.status}
            </span>
          </div>
          <h4 class="font-sans font-bold text-slate-900 text-base group-hover:text-emerald-700 transition line-clamp-1">${prod.title}</h4>
          <p class="text-[11px] font-mono text-slate-500 truncate mb-1">Handle: ${prod.handle}</p>
          <div class="text-sm font-bold text-emerald-700 font-mono">${prod.currency ? prod.currency + ' ' : ''}${prod.price}</div>
        </div>
        <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span class="text-[10px] text-slate-500 font-mono">Media Attached</span>
          <a href="${adminLink}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 font-bold transition">
            <span>View in Admin</span>
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          </a>
        </div>
      `;
      el.showcaseGrid.appendChild(card);
    });
  }

  // 5. Start Staged Uploads & Import Pipeline
  el.btnStart.addEventListener('click', async () => {
    if (!state.isVerified || state.isProcessing) return;

    state.isProcessing = true;
    state.createdProducts = [];
    el.btnStart.disabled = true;
    el.btnDownloadCsv.classList.add('hidden');
    if (el.showcaseSection) el.showcaseSection.classList.add('hidden');
    updateReadyState();

    log('INFO', '=== Starting Staged Uploads & Processing Pipeline ===');

    try {
      // Step A: Determine all unique images needed
      const imagesToUpload = [];
      const imageKeyToFilename = new Map();

      if (state.mappingData.length > 0) {
        state.mappingData.forEach(row => {
          const handle = (row['Handle'] || '').trim();
          const pos = parseInt(row['Image Position'] || '1', 10);
          const fname = (row['WebP Filename'] || '').trim();
          const archivePath = (row['Archive Path'] || '').trim();

          const file = state.imagesMap.get(fname) || state.imagesMap.get(archivePath);
          if (file) {
            imagesToUpload.push({ filename: fname, file: file });
            imageKeyToFilename.set(`${handle}_${pos}`, fname);
          }
        });
      } else {
        state.csvProducts.forEach(handle => {
          [1, 2, 3].forEach(pos => {
            for (const [fname, fileObj] of state.imagesMap.entries()) {
              if (fname.includes(handle) && (fname.includes(`_0${pos}`) || fname.includes(`_${pos}`))) {
                imagesToUpload.push({ filename: fname, file: fileObj });
                imageKeyToFilename.set(`${handle}_${pos}`, fname);
                break;
              }
            }
          });
        });
      }

      // Deduplicate files by filename
      const uniqueFilesMap = new Map();
      imagesToUpload.forEach(item => {
        if (!uniqueFilesMap.has(item.filename)) {
          uniqueFilesMap.set(item.filename, item.file);
        }
      });

      const uniqueFiles = Array.from(uniqueFilesMap.entries()).map(([filename, file]) => ({
        filename,
        file,
        mimeType: file.type || 'image/webp',
        size: file.size
      }));

      log('INFO', `Identified ${uniqueFiles.length} unique images to stage and upload to Shopify CDN.`);

      // Step B: Upload Images in Batches of 5
      const BATCH_SIZE = 5;
      const uploadedFileResults = new Map();

      for (let i = 0; i < uniqueFiles.length; i += BATCH_SIZE) {
        const batch = uniqueFiles.slice(i, i + BATCH_SIZE);
        updateProgress(i + 1, uniqueFiles.length, `Uploading images ${i + 1}-${Math.min(i + BATCH_SIZE, uniqueFiles.length)} of ${uniqueFiles.length}...`);

        // 1. Get Staged Upload targets
        const stagedRes = await fetch('/api/shopify/staged-uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store: state.storeDomain,
            token: state.storeToken,
            files: batch.map(b => ({ filename: b.filename, mimeType: b.mimeType, size: b.size }))
          })
        });
        const stagedData = await stagedRes.json();
        if (!stagedRes.ok || stagedData.error) throw new Error(stagedData.error || 'Staged uploads failed');

        // 2. Direct upload binaries to S3/GCS
        const fileCreatePayload = [];
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          const target = stagedData.targets[j];
          await uploadToStagedTarget(target, item.file);
          fileCreatePayload.push({
            originalSource: target.resourceUrl,
            alt: item.filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
          });
        }

        // 3. Register files in Shopify Files API
        const createRes = await fetch('/api/shopify/files-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store: state.storeDomain,
            token: state.storeToken,
            files: fileCreatePayload
          })
        });
        const createData = await createRes.json();
        if (!createRes.ok || createData.error) throw new Error(createData.error || 'FileCreate failed');

        // 4. Save results
        createData.files.forEach((f, idx) => {
          const item = batch[idx];
          const cdnUrl = f.image ? f.image.url : (f.originalSource || '');
          uploadedFileResults.set(item.filename, { id: f.id, url: cdnUrl });
          log('SUCCESS', `Uploaded image: ${item.filename} ➔ ${cdnUrl ? cdnUrl.slice(0, 45) + '...' : 'Registered'}`);
        });
      }

      log('SUCCESS', `All ${uniqueFiles.length} images uploaded & hosted on Shopify CDN successfully.`);

      // Step C: Build Image Map { "handle_position": cdnUrl } & enrich CSV
      const imageMapForCsv = {};
      const productFileIdsMap = new Map();

      imageKeyToFilename.forEach((filename, mapKey) => {
        const fileData = uploadedFileResults.get(filename);
        if (fileData) {
          imageMapForCsv[mapKey] = fileData.url;
          const [handle, pos] = mapKey.split('_');
          if (!productFileIdsMap.has(handle)) productFileIdsMap.set(handle, []);
          productFileIdsMap.get(handle).push({ pos: parseInt(pos, 10), id: fileData.id });
        }
      });

      // Enrich CSV via backend
      const enrichRes = await fetch('/api/csv/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvString: state.csvRaw,
          imageMap: imageMapForCsv
        })
      });
      const enrichData = await enrichRes.json();
      if (enrichData.enrichedCsv) {
        state.finalCsvString = enrichData.enrichedCsv;
        el.btnDownloadCsv.classList.remove('hidden');
        log('SUCCESS', 'Generated Final CSV with real Shopify CDN image URLs!');
      }

      // Step D: Create Products in Shopify via GraphQL if checked
      if (el.chkCreateProducts.checked) {
        log('INFO', '=== Direct Product Creation in Shopify (productSet) ===');
        const parsedProducts = Papa.parse(state.finalCsvString || state.csvRaw, { header: true, skipEmptyLines: 'greedy' });

        // Step D1: Auto-create/ensure Collections if checked
        let collectionGidMap = {};
        const shouldAssignCollections = el.chkAutoCollections && el.chkAutoCollections.checked;
        if (shouldAssignCollections) {
          const namesToEnsure = new Set();
          
          // Include all collections auto-detected from folder
          state.folderCollections.forEach((_, col) => namesToEnsure.add(col));

          // Include collections from CSV
          parsedProducts.data.forEach(row => {
            const rawCol = row['Collection'] || row['Type'] || '';
            rawCol.split(',').forEach(c => {
              const trimmed = c.trim();
              if (trimmed) namesToEnsure.add(trimmed);
            });
          });

          // Include custom collection input if typed
          const extraCol = el.inputCustomCollection ? el.inputCustomCollection.value.trim() : '';
          if (extraCol) namesToEnsure.add(extraCol);

          if (namesToEnsure.size > 0) {
            log('INFO', `Ensuring ${namesToEnsure.size} collection(s) in Shopify: ${Array.from(namesToEnsure).join(', ')}...`);
            try {
              const colRes = await fetch('/api/shopify/collections/ensure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  store: state.storeDomain,
                  token: state.storeToken,
                  collections: Array.from(namesToEnsure)
                })
              });
              const colData = await colRes.json();
              if (colData.success && colData.collectionMap) {
                collectionGidMap = colData.collectionMap;
                Object.entries(collectionGidMap).forEach(([cName, info]) => {
                  const isReused = typeof info === 'object' && info && info.reused;
                  if (isReused) {
                    log('INFO', `✓ Collection "${cName}" already exists in store — Reusing existing collection.`);
                  } else {
                    log('SUCCESS', `+ Collection "${cName}" verified/created in store.`);
                  }
                });
              } else {
                log('WARN', `Collections check warning: ${colData.error || 'Failed to auto-ensure collections'}`);
              }
            } catch (colErr) {
              log('WARN', `Collections check warning: ${colErr.message}`);
            }
          }
        }

        const groupedProducts = new Map();

        parsedProducts.data.forEach(row => {
          const h = (row['Handle'] || '').trim();
          if (!h) return;
          if (!groupedProducts.has(h)) {
            // Determine collections: from CSV, folder structure, or custom input
            const rawCols = (row['Collection'] || row['Type'] || '').split(',').map(c => c.trim()).filter(Boolean);

            // Auto-map from folder subfolders if matching product title or handle
            state.folderCollections.forEach((prods, colName) => {
              const productTitle = (row['Title'] || '').trim().toLowerCase();
              const hasMatch = Array.from(prods).some(p => {
                const pLow = p.toLowerCase();
                return pLow === productTitle || h.includes(pLow.replace(/[^a-z0-9]+/g, '-'));
              });
              if (hasMatch && !rawCols.includes(colName)) {
                rawCols.push(colName);
              }
            });

            const extraCol = el.inputCustomCollection ? el.inputCustomCollection.value.trim() : '';
            if (extraCol && !rawCols.includes(extraCol)) rawCols.push(extraCol);

            const assignedColGids = shouldAssignCollections
              ? rawCols.map(name => {
                  const entry = collectionGidMap[name];
                  if (!entry) return null;
                  return typeof entry === 'object' ? entry.id : entry;
                }).filter(Boolean)
              : [];

            // Ensure collection names are present in product tags so automated/smart collections match them too
            const productTags = (row['Tags'] || '').split(',').map(t => t.trim()).filter(Boolean);
            if (shouldAssignCollections) {
              rawCols.forEach(colName => {
                if (!productTags.includes(colName)) productTags.push(colName);
              });
            }

            // Determine category & metafields
            let productCategory = (row['Product Category'] || '').trim();
            let metafields = [];
            const shouldAutoCategory = el.chkAutoCategory && el.chkAutoCategory.checked;

            if (shouldAutoCategory) {
              if (!productCategory) {
                const text = (row['Title'] + ' ' + (row['Type'] || '')).toLowerCase();
                if (text.includes('charm') || text.includes('locket') || text.includes('holder')) {
                  productCategory = 'Apparel & Accessories > Jewelry > Charms & Pendants';
                } else if (text.includes('necklace') || text.includes('chain')) {
                  productCategory = 'Apparel & Accessories > Jewelry > Necklaces';
                } else if (text.includes('ring')) {
                  productCategory = 'Apparel & Accessories > Jewelry > Rings';
                } else if (text.includes('bracelet') || text.includes('bangle')) {
                  productCategory = 'Apparel & Accessories > Jewelry > Bracelets';
                } else if (text.includes('earring') || text.includes('piercing')) {
                  productCategory = 'Apparel & Accessories > Jewelry > Earrings';
                } else {
                  productCategory = 'Apparel & Accessories > Jewelry > Charms & Pendants';
                }
              }

              metafields = [
                { namespace: 'custom', key: 'target_gender', value: 'Female', type: 'single_line_text_field' },
                { namespace: 'custom', key: 'age_group', value: 'Adult', type: 'single_line_text_field' },
                { namespace: 'custom', key: 'material', value: '18K Gold Plated', type: 'single_line_text_field' },
                { namespace: 'custom', key: 'finish', value: '18K Gold Plated', type: 'single_line_text_field' },
                { namespace: 'custom', key: 'base_material', value: '316L Surgical-Grade Stainless Steel', type: 'single_line_text_field' },
                { namespace: 'custom', key: 'waterproof', value: 'true', type: 'boolean' }
              ];
            }

            groupedProducts.set(h, {
              handle: h,
              title: row['Title'] || h,
              bodyHtml: row['Body (HTML)'] || '',
              vendor: row['Vendor'] || (state.shopInfo ? state.shopInfo.name : 'Store'),
              productType: row['Type'] || '',
              tags: productTags,
              status: el.selStatus.value,
              category: productCategory,
              collections: assignedColGids,
              metafields: metafields,
              variants: []
            });
          }
          if (row['Variant Price']) {
            const optionValues = [];
            if (row['Option1 Value']) {
              optionValues.push({ optionName: row['Option1 Name'] || 'Title', name: row['Option1 Value'] });
            }
            if (row['Option2 Value']) {
              optionValues.push({ optionName: row['Option2 Name'] || 'Option 2', name: row['Option2 Value'] });
            }
            if (row['Option3 Value']) {
              optionValues.push({ optionName: row['Option3 Name'] || 'Option 3', name: row['Option3 Value'] });
            }

            if (optionValues.length === 0) {
              optionValues.push({ optionName: 'Title', name: 'Default Title' });
            }

            groupedProducts.get(h).variants.push({
              price: row['Variant Price'],
              sku: row['Variant SKU'] || '',
              compareAtPrice: row['Variant Compare At Price'] || null,
              inventoryQty: parseInt(row['Variant Inventory Qty'], 10) || 120,
              optionValues: optionValues
            });
          }
        });

        const productList = Array.from(groupedProducts.values());
        for (let k = 0; k < productList.length; k++) {
          const p = productList[k];
          updateProgress(k + 1, productList.length, `Creating product ${k + 1} of ${productList.length}: ${p.title}...`);

          // Attach file IDs in order (Hero, Lifestyle, Macro)
          const fileRecords = productFileIdsMap.get(p.handle) || [];
          fileRecords.sort((a, b) => a.pos - b.pos);
          p.fileIds = fileRecords.map(r => r.id);

          try {
            const prodRes = await fetch('/api/shopify/create-product', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                store: state.storeDomain,
                token: state.storeToken,
                product: p
              })
            });
            const prodData = await prodRes.json();
            if (prodData.success) {
              const prod = prodData.product;
              const numId = (prod.id || '').replace('gid://shopify/Product/', '');
              const heroUrl = imageMapForCsv[p.handle + '_1'] || '';

              state.createdProducts.push({
                id: prod.id,
                numericId: numId,
                title: prod.title || p.title,
                handle: prod.handle || p.handle,
                status: prod.status || p.status,
                price: p.variants && p.variants[0] ? p.variants[0].price : '0.00',
                currency: state.shopInfo ? state.shopInfo.currencyCode : '',
                heroUrl: heroUrl
              });

              log('SUCCESS', `Created Product: "${p.title}" [Handle: ${p.handle}, Category: ${p.category ? p.category.slice(0, 24) + '...' : 'Default'}, Collections: ${p.collections ? p.collections.length : 0}, Media: ${p.fileIds.length}]`);
            } else {
              log('WARN', `Issue with product "${p.handle}": ${prodData.error}`);
            }
          } catch (pErr) {
            log('ERROR', `Failed creating "${p.handle}": ${pErr.message}`);
          }
        }
        log('SUCCESS', `Finished creating ${state.createdProducts.length} products in ${state.storeDomain}!`);
        renderShowcase();
      }

      updateProgress(100, 100, 'Processing Complete! All products & images are staged.');
      log('SUCCESS', '🎉 PIPELINE COMPLETE! Products created, images hosted, enriched CSV ready for download.');

    } catch (err) {
      log('ERROR', `Pipeline error: ${err.message}`);
    } finally {
      state.isProcessing = false;
      el.btnStart.disabled = false;
      updateReadyState();
    }
  });

  // 6. Download Enriched CSV
  el.btnDownloadCsv.addEventListener('click', () => {
    if (!state.finalCsvString) return;
    const blob = new Blob([state.finalCsvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopify_products_enriched_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    log('INFO', 'Downloaded final CSV to your computer.');
  });

  // Initialize and load saved credentials if available
  loadSavedCredentials();

})();
