// server.js
const app = require('./api/index');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 Shopify Catalog Importer is running!`);
  console.log(`👉 Open http://localhost:${PORT} in your browser.`);
  console.log(`📡 Ready to connect and import into any Shopify store.\n`);
});
