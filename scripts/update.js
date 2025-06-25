--- scripts/update.js
+++ scripts/update.js
@@ top
- const fs      = require('fs');
+ require('dotenv').config();       // optional locally, but harmless in Actions
+ const fs      = require('fs');
   const path    = require('path');
   const axios   = require('axios');
   const cheerio = require('cheerio');
@@ async function fetchLeaderboard() {
-  const proxyUrl  = `http://api.scraperapi.com?api_key=${process.env.SCRAPERAPI_KEY}`
-                  + `&url=${encodeURIComponent(targetUrl)}`;
-  const html = (await axios.get(proxyUrl)).data;
+  const proxyUrl = `http://api.scraperapi.com`
+                 + `?api_key=${process.env.SCRAPERAPI_KEY}`
+                 + `&url=${encodeURIComponent(targetUrl)}`;
+  const res = await axios.get(proxyUrl);
+  const html = res.data;
+
+  // ----- DEBUG LOGGING -----
+  if (!html || !html.includes('__NEXT_DATA__')) {
+    // dump the first 200 chars so you can inspect in the Action log
+    console.error('⚠️  fetchLeaderboard got back unexpected HTML:');
+    console.error(html.slice(0, 200).replace(/\n/g, ' '), '\n');
+    throw new Error('Did not find __NEXT_DATA__ in fetched HTML');
+  }
+  // -------------------------
 
   const $    = cheerio.load(html);
   const raw  = $('#__NEXT_DATA__').html() || '';
