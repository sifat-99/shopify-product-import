# Shopify Sample Import Pack

এই ফোল্ডারে আপনার **Shopify Catalog Importer** অ্যাপটি পরীক্ষা (Test) করার জন্য ৩টি জুয়েলারি প্রোডাক্টের পরিপূর্ণ স্যাম্পল ডেটা তৈরি করা আছে।

---

## 📂 এই প্যাকের ভেতরের ফাইলসমূহ:

1. **`sample_products.csv`**
   - ৩টি পরিপূর্ণ জুয়েলারি পণ্য:
     1. `Alina Cuban Necklace` (Chains)
     2. `Alina Classic Bangle` (Bangles)
     3. `Alina Birthstone Ring` (The Ring)
   - শপিফাইয়ের অফিসিয়াল ৪৭টি কলাম ফরম্যাট।
   - দাম EUR কারেন্সিতে দেওয়া।
   - Status: `draft`, Inventory: `0`, Published: `FALSE`।
   - `Image Src` কলাম ফাঁকা রাখা হয়েছে (যাতে অ্যাপ নিজে আপলোড করে CDN URL বসাতে পারে)।

2. **`sample_mapping.csv`**
   - প্রতিটি প্রোডাক্টের Handle-এর সাথে ৩টি করে ছবির পজিশন ম্যাপিং:
     - `Position 1`: Hero
     - `Position 2`: Lifestyle
     - `Position 3`: Macro

3. **`sample_images/`** (ফোল্ডার)
   - মোট ৯টি হাই-কোয়ালিটি WebP ছবি (প্রতি পণ্যে ৩টি করে):
     - `Alina Birthstone Ring_01-Hero.webp`
     - `Alina Birthstone Ring_02-Lifestyle.webp`
     - `Alina Birthstone Ring_03-Macro.webp`
     - `Alina Classic Bangle_01-Hero.webp`
     - `Alina Classic Bangle_02-Lifestyle.webp`
     - `Alina Classic Bangle_03-Macro.webp`
     - `Alina Cuban Necklace_01-Hero.webp`
     - `Alina Cuban Necklace_02-Lifestyle.webp`
     - `Alina Cuban Necklace_03-Macro.webp`

---

## 🚀 কীভাবে Importer অ্যাপে টেস্ট করবেন (Step by Step):

1. **লোকাল বা ভেরসেল অ্যাপটি খুলুন:** (যেমন: `http://localhost:3000`)
2. **Step 1 (Store Connection):**
   - আপনার স্টোর ডোমেন দিন (যেমন: `le-velair-w6ickwvy` বা `shopify-jewelry.bssoln.com`)।
   - Admin Access Token (বা Client ID & Secret) দিয়ে **Connect** বাটনে চাপ দিন।
3. **Step 2 (Assets Upload):**
   - **Step 2.A:** `sample_products.csv` ফাইলটি সিলেক্ট করুন। (দেখাবে: `3 Products`)
   - **Step 2.B:** `sample_images` পুরো ফোল্ডারটি সিলেক্ট করুন। (দেখাবে: `9 Images`)
   - **Step 2.C:** `sample_mapping.csv` ফাইলটি সিলেক্ট করুন। (দেখাবে: `9 Mappings`)
4. **Step 3 (Execute):**
   - **"Create / Update Products directly in Shopify"** টিক দেওয়া রাখুন এবং Status **Draft** রাখুন।
   - **"Start Staged Upload & Processing"** বাটনে চাপ দিন!
5. **ফলাফল:**
   - অ্যাপ স্বয়ংক্রিয়ভাবে ৯টি ছবি শপিফাই স্টেজিং সার্ভারে আপলোড করবে এবং CDN URL নেবে।
   - সবগুলো ছবি পণ্যে Hero, Lifestyle, Macro ক্রমে যুক্ত করে ৩টি প্রোডাক্ট শপিফাই স্টোরে Draft হিসেবে তৈরি করবে।
   - কাজ শেষে **"Download Enriched CSV"** বাটনে ক্লিক করে সব ইমেজ লিংকসহ ফাইনাল CSV ডাউনলোড করে দেখতে পারবেন!
