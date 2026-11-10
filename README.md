# ⚡ Shopify Catalog Importer & CDN Stager Web App

> **A Universal, Zero-Error Shopify Product & Media Importer Application built with Node.js & Express.**  
> Hostable on **Vercel** or runnable locally on any computer. Connects to **any Shopify store worldwide** via the official Admin GraphQL API.

---

## 🌟 Key Highlights & Why It Was Built

Traditional product importers crash on large image batches due to server timeouts or payload limits (e.g. Vercel's 4.5 MB serverless limit). 

This app uses an **Enterprise Staged Upload Architecture**:
1. **Direct CDN Streaming:** The browser requests upload credentials from Shopify GraphQL, then streams local image files directly into Shopify's Amazon S3 / Google Cloud Storage targets. Large batches (1,000+ images / 100MB+) upload seamlessly without overloading the server.
2. **Shopify Files Registration:** Automatically registers uploaded files in Shopify Files API and captures the real `cdn.shopify.com` URLs and File IDs.
3. **CSV Enrichment & Download:** Automatically replaces empty `Image Src` fields in your CSV with newly minted CDN URLs for Hero, Lifestyle, and Macro positions, allowing 1-click download of the complete CSV.
4. **Direct GraphQL Product Creation (`productSet`):** Can directly create/update all products as `DRAFT` or `ACTIVE` in your Shopify store with images, variants, and EUR prices attached.
5. **Universal Store Support:** Works with any store—just provide the `store.myshopify.com` domain and Admin Access Token (`shpat_...`).

---

## 📁 Project Structure

```
shopify-catalog-importer/
├── api/
│   └── index.js             # Express API & Vercel serverless entry point
├── lib/
│   ├── shopify.js           # Shopify GraphQL client (stagedUploadsCreate, fileCreate, productSet)
│   └── csvHelper.js         # PapaParse CSV reader, group mapper, & URL injector
├── public/
│   ├── index.html           # Modern Tailwind CSS Dark Dashboard UI
│   └── app.js               # Reactive client-side pipeline & real-time terminal logger
├── package.json             # Dependencies & start scripts
├── vercel.json              # Vercel deployment configuration
├── server.js                # Local development server (http://localhost:3000)
└── README.md                # Master documentation
```

---

## 🚀 How to Run Locally

### 1. Install Dependencies
```bash
cd /Users/sifat/Project/shopify-catalog-importer
npm install
```

### 2. Start the Server
```bash
npm start
```
The console will display:
```
🚀 Shopify Catalog Importer is running!
👉 Open http://localhost:3000 in your browser.
📡 Ready to connect and import into any Shopify store.
```

### 3. Open in Browser
Visit `http://localhost:3000` in Chrome, Safari, or Helium.

---

## ☁️ How to Deploy to Vercel

### Method 1: Using the Vercel CLI (1 Minute)
```bash
# In the project directory:
cd /Users/sifat/Project/shopify-catalog-importer

# Deploy to Vercel production:
npx vercel --prod
```
Follow the interactive prompts:
- **Set up and deploy?** [Y]
- **Which scope?** (Select your personal or team account)
- **Link to existing project?** [N]
- **Project name:** `shopify-catalog-importer`
- **Directory:** `./`

Your live production URL (e.g. `https://shopify-catalog-importer.vercel.app`) will be printed immediately!

### Method 2: Via GitHub & Vercel Dashboard
1. Initialize git and push this folder to your GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: initial shopify catalog importer app"
   git remote add origin https://github.com/<your-username>/shopify-catalog-importer.git
   git push -u origin main
   ```
2. Open [vercel.com/new](https://vercel.com/new).
3. Import the `shopify-catalog-importer` repository.
4. Click **Deploy**. Vercel will automatically build and deploy it with zero configuration needed.

---

## 📖 Step-by-Step Usage Guide

### Step 1: Connect your Shopify Store
1. Enter your **Store Domain** (e.g. `le-velair-w6ickwvy.myshopify.com` or `your-store.myshopify.com`).
2. Enter your **Admin API Access Token** (`shpat_xxxxxxxxxxxxxxxxxxxxxx`).
   *(Requires scopes: `write_products`, `read_products`, `write_files`, `read_files`)*.
3. Click **Connect**. The app will verify credentials and display the store name, currency, and plan badge.

### Step 2: Upload Assets
1. **Product CSV (Step 2.A):** Select your CSV (e.g. `shopify_products_eur_webp_pending_urls.csv`). The card will show the total product handle count.
2. **Product Images Folder (Step 2.B):** Click "Choose Images Folder" and select your folder containing images (e.g. `shopify_webp_images_342_products/`). The browser will index all WebP/PNG/JPG files.
3. **Position Map (Step 2.C - Optional):** Select your `shopify_webp_image_url_map.csv`. If omitted, the app automatically matches filenames containing `_01-Hero`, `_02-Lifestyle`, `_03-Macro`.

### Step 3: Run the Pipeline
1. Choose whether to **Directly Create Products via GraphQL** (checked by default) and choose default status (`DRAFT` or `ACTIVE`).
2. Click **🚀 Start Import & Staging**.
3. Watch the real-time progress bar and live terminal console:
   - Staged upload creation on Shopify.
   - S3/GCS image binaries stream directly from the browser.
   - File registration in Shopify Files API.
   - CSV enrichment with live CDN URLs.
   - `productSet` GraphQL execution creating drafts in Shopify.
4. When finished, click **⬇ Download Enriched CSV** to save the final populated CSV to your computer!

---

*Developed by Bangladesh Software Solutions (BSS).*
