// public/app.js
(function() {
  // App State
  const state = {
    storeDomain: '',
    storeToken: '',
    isVerified: false,
    shopInfo: null,
    csvRaw: '',
    csvProducts: [],
    imagesMap: new Map(), // filename -> File object
    mappingData: [],
    uploadedFilesMap: new Map(), // filename -> { id, url }
    finalCsvString: '',
    isProcessing: false
  };

  // DOM Elements
  const el = {
    storeDomain: document.getElementById('storeDomain'),
    resolvedDomainInfo: document.getElementById('resolvedDomainInfo'),
    storeToken: document.getElementById('storeToken'),
    btnVerify: document.getElementById('btnVerify'),
    storeVerifyMsg: document.getElementById('storeVerifyMsg'),
    storeBadge: document.getElementById('storeBadge'),
    badgeStoreName: document.getElementById('badgeStoreName'),
    badgeStoreCurrency: document.getElementById('badgeStoreCurrency'),

    btnToggleGuide: document.getElementById('btnToggleGuide'),
    tokenGuideBox: document.getElementById('tokenGuideBox'),
    guideArrow: document.getElementById('guideArrow'),
    linkDirectAppDev: document.getElementById('linkDirectAppDev'),

    fileCsv: document.getElementById('fileCsv'),
    csvBadge: document.getElementById('csvBadge'),
    csvFileInfo: document.getElementById('csvFileInfo'),

    fileImages: document.getElementById('fileImages'),
    imgBadge: document.getElementById('imgBadge'),
    imgFolderInfo: document.getElementById('imgFolderInfo'),

    fileMap: document.getElementById('fileMap'),
    mapBadge: document.getElementById('mapBadge'),
    mapFileInfo: document.getElementById('mapFileInfo'),

    chkCreateProducts: document.getElementById('chkCreateProducts'),
    selStatus: document.getElementById('selStatus'),
    btnStart: document.getElementById('btnStart'),
    btnDownloadCsv: document.getElementById('btnDownloadCsv'),

    progressArea: document.getElementById('progressArea'),
    progressStatus: document.getElementById('progressStatus'),
    progressPct: document.getElementById('progressPct'),
    progressBar: document.getElementById('progressBar'),

    consoleLog: document.getElementById('consoleLog'),
    btnClearLogs: document.getElementById('btnClearLogs')
  };

  // Logger
  function log(type, msg) {
    const time = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.className = 'font-mono text-xs';

    let prefix = `<span class="text-slate-500">[${time}]</span> `;
    if (type === 'SUCCESS') prefix += `<span class="text-emerald-400 font-bold">[SUCCESS]</span> `;
    else if (type === 'INFO') prefix += `<span class="text-blue-400 font-bold">[INFO]</span> `;
    else if (type === 'WARN') prefix += `<span class="text-amber-400 font-bold">[WARN]</span> `;
    else if (type === 'ERROR') prefix += `<span class="text-rose-400 font-bold">[ERROR]</span> `;
    else prefix += `<span class="text-slate-400">[SYSTEM]</span> `;

    div.innerHTML = prefix + msg;
    el.consoleLog.appendChild(div);
    el.consoleLog.scrollTop = el.consoleLog.scrollHeight;
  }

  el.btnClearLogs.addEventListener('click', () => {
    el.consoleLog.innerHTML = '';
  });

  // Toggle Admin Token Guide
  if (el.btnToggleGuide && el.tokenGuideBox) {
    el.btnToggleGuide.addEventListener('click', () => {
      const isHidden = el.tokenGuideBox.classList.toggle('hidden');
      el.guideArrow.textContent = isHidden ? '▼' : '▲';
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
        el.linkDirectAppDev.href = 'https://admin.shopify.com/store/le-velair-w6ickwvy/settings/apps/development';
        return;
      }

      if (val.endsWith('.myshopify.com') || !val.includes('.')) {
        const handle = val.replace('.myshopify.com', '');
        el.linkDirectAppDev.href = `https://admin.shopify.com/store/${handle}/settings/apps/development`;
        if (el.resolvedDomainInfo) {
          el.resolvedDomainInfo.textContent = `✓ Shopify Store: ${handle}.myshopify.com`;
          el.resolvedDomainInfo.classList.remove('hidden');
        }
      } else {
        // Custom domain (e.g. shopify-jewelry.bssoln.com)
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
                el.resolvedDomainInfo.innerHTML = `✓ Resolved: <span class="text-amber-300 font-bold">${data.resolved}</span>`;
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

  // Check Ready State
  function updateReadyState() {
    const canStart = state.isVerified && state.csvProducts.length > 0 && state.imagesMap.size > 0 && !state.isProcessing;
    el.btnStart.disabled = !canStart;
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
    const token = el.storeToken.value.trim();

    if (!domain || !token) {
      el.storeVerifyMsg.textContent = 'Please provide both store domain and Admin token.';
      el.storeVerifyMsg.className = 'mt-3 text-xs text-rose-400 block';
      return;
    }

    el.btnVerify.disabled = true;
    el.btnVerify.innerHTML = '<span class="animate-spin">🔄</span> Connecting...';
    log('INFO', `Verifying connection to ${domain}...`);

    try {
      const res = await fetch('/api/shopify/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store: domain, token })
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to authenticate');
      }

      // Canonical domain from Shopify API
      const canonicalDomain = data.resolvedDomain || (data.shop && data.shop.myshopifyDomain) || domain;
      state.storeDomain = canonicalDomain;
      state.storeToken = token;
      state.isVerified = true;
      state.shopInfo = data.shop;

      // Update link and hint with resolved handle
      const handle = canonicalDomain.replace('.myshopify.com', '');
      if (el.linkDirectAppDev) {
        el.linkDirectAppDev.href = `https://admin.shopify.com/store/${handle}/settings/apps/development`;
      }
      if (el.resolvedDomainInfo) {
        el.resolvedDomainInfo.innerHTML = `✓ Connected Store: <span class="text-amber-300 font-bold">${canonicalDomain}</span>`;
        el.resolvedDomainInfo.classList.remove('hidden');
      }

      el.storeBadge.classList.remove('hidden');
      el.storeBadge.classList.add('flex');
      el.badgeStoreName.textContent = data.shop.name;
      el.badgeStoreCurrency.textContent = data.shop.currencyCode;

      el.storeVerifyMsg.textContent = `Connected to ${data.shop.name} (${canonicalDomain} • ${data.shop.currencyCode})`;
      el.storeVerifyMsg.className = 'mt-3 text-xs text-emerald-400 block';

      log('SUCCESS', `Authenticated successfully with ${data.shop.name} (${canonicalDomain}) [Currency: ${data.shop.currencyCode}, Plan: ${data.shop.plan ? data.shop.plan.displayName : 'Standard'}]`);
    } catch (err) {
      state.isVerified = false;
      el.storeVerifyMsg.textContent = `Authentication failed: ${err.message}`;
      el.storeVerifyMsg.className = 'mt-3 text-xs text-rose-400 block';
      log('ERROR', `Store verification failed: ${err.message}`);
    } finally {
      el.btnVerify.disabled = false;
      el.btnVerify.innerHTML = '<span>Connect</span>';
      updateReadyState();
    }
  });

  // 2. Select Product CSV
  el.fileCsv.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      state.csvRaw = evt.target.result;
      const parsed = Papa.parse(state.csvRaw, { header: true, skipEmptyLines: 'greedy' });
      const handles = new Set();
      parsed.data.forEach(r => { if (r['Handle']) handles.add(r['Handle'].trim()); });

      state.csvProducts = Array.from(handles);

      el.csvBadge.textContent = `${state.csvProducts.length} Products`;
      el.csvBadge.className = 'text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold';
      el.csvFileInfo.textContent = `${file.name} (${parsed.data.length} rows, ${state.csvProducts.length} unique handles)`;
      el.csvFileInfo.classList.remove('hidden');

      log('SUCCESS', `Loaded Product CSV: ${file.name} with ${state.csvProducts.length} products (${parsed.data.length} total rows)`);
      updateReadyState();
    };
    reader.readAsText(file);
  });

  // 3. Select Product Images Folder
  el.fileImages.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    state.imagesMap.clear();
    let validImgCount = 0;

    files.forEach(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      if (['webp', 'png', 'jpg', 'jpeg'].includes(ext)) {
        // Map by filename and by relative path
        state.imagesMap.set(f.name, f);
        if (f.webkitRelativePath) {
          state.imagesMap.set(f.webkitRelativePath, f);
        }
        validImgCount++;
      }
    });

    el.imgBadge.textContent = `${validImgCount} Images`;
    el.imgBadge.className = 'text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold';
    el.imgFolderInfo.textContent = `${validImgCount} valid image files loaded from folder selection`;
    el.imgFolderInfo.classList.remove('hidden');

    log('SUCCESS', `Indexed ${validImgCount} images from local folder.`);
    updateReadyState();
  });

  // 4. Select Mapping CSV (Optional)
  el.fileMap.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const parsed = Papa.parse(evt.target.result, { header: true, skipEmptyLines: 'greedy' });
      state.mappingData = parsed.data;

      el.mapBadge.textContent = `${parsed.data.length} Mappings`;
      el.mapBadge.className = 'text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold';
      el.mapFileInfo.textContent = `${file.name} (${parsed.data.length} position mappings)`;
      el.mapFileInfo.classList.remove('hidden');

      log('INFO', `Loaded Image Position Mapping CSV: ${file.name} (${parsed.data.length} entries)`);
    };
    reader.readAsText(file);
  });

  // Helper: Direct Upload to S3/GCS Target
  async function uploadToStagedTarget(target, file) {
    const formData = new FormData();
    // Append all signed parameters from Shopify
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

  // 5. Start Staged Uploads & Import Pipeline
  el.btnStart.addEventListener('click', async () => {
    if (!state.isVerified || state.isProcessing) return;

    state.isProcessing = true;
    el.btnStart.disabled = true;
    el.btnDownloadCsv.classList.add('hidden');

    log('INFO', '=== Starting Staged Uploads & Processing Pipeline ===');

    try {
      // Step A: Determine all unique images needed
      const imagesToUpload = [];
      const imageKeyToFilename = new Map(); // "handle_position" -> filename

      if (state.mappingData.length > 0) {
        // Use mapping CSV
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
        // Fallback: Smart matching by product handle/title in folder
        state.csvProducts.forEach(handle => {
          [1, 2, 3].forEach(pos => {
            // Check common naming patterns: [handle]_[pos], [handle]_0[pos]
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

      // Step B: Upload Images in Batches of 5 to avoid Shopify rate limits
      const BATCH_SIZE = 5;
      const uploadedFileResults = new Map(); // filename -> { id, url }

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
      const productFileIdsMap = new Map(); // handle -> [fileId1, fileId2, fileId3]

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
        const groupedProducts = new Map();

        parsedProducts.data.forEach(row => {
          const h = (row['Handle'] || '').trim();
          if (!h) return;
          if (!groupedProducts.has(h)) {
            groupedProducts.set(h, {
              handle: h,
              title: row['Title'] || h,
              bodyHtml: row['Body (HTML)'] || '',
              vendor: row['Vendor'] || 'Aurelle Fine Jewelry',
              productType: row['Type'] || 'Jewellery',
              tags: (row['Tags'] || '').split(',').map(t => t.trim()).filter(Boolean),
              status: el.selStatus.value,
              variants: []
            });
          }
          if (row['Variant Price']) {
            groupedProducts.get(h).variants.push({
              price: row['Variant Price'],
              sku: row['Variant SKU'] || '',
              compareAtPrice: row['Variant Compare At Price'] || null,
              optionValues: [
                row['Option1 Value'] ? { name: row['Option1 Name'] || 'Option 1', value: row['Option1 Value'] } : null
              ].filter(Boolean)
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
              log('SUCCESS', `Created Product: "${p.title}" [Handle: ${p.handle}, Status: ${p.status}, Media: ${p.fileIds.length}]`);
            } else {
              log('WARN', `Issue with product "${p.handle}": ${prodData.error}`);
            }
          } catch (pErr) {
            log('ERROR', `Failed creating "${p.handle}": ${pErr.message}`);
          }
        }
        log('SUCCESS', `Finished creating ${productList.length} products in ${state.storeDomain}!`);
      }

      updateProgress(100, 100, 'Processing Complete! All products & images are staged.');
      log('SUCCESS', '🎉 PIPELINE COMPLETE! You can now download the enriched CSV or view products in your Shopify Admin.');

    } catch (err) {
      log('ERROR', `Pipeline error: ${err.message}`);
    } finally {
      state.isProcessing = false;
      el.btnStart.disabled = false;
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

})();
