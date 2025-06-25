// scripts/update.js

const fs    = require('fs');
const path  = require('path');
const axios = require('axios');

const CONFIG_PATH = path.join(__dirname, '..', 'baseline.json');
const DATA_PATH   = path.join(__dirname, '..', 'docs',     'data.json');

// load config
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const { TEAM_NAME, START_DATE } = config;

// Fetch team via NitroType’s JSON API (proxied)
async function fetchLeaderboard() {
  const targetUrl = `https://www.nitrotype.com/api/v2/teams/${TEAM_NAME}`;
  const proxyUrl  = `http://api.scraperapi.com`
                  + `?api_key=${process.env.SCRAPERAPI_KEY}`
                  + `&url=${encodeURIComponent(targetUrl)}`;
  const res  = await axios.get(proxyUrl);
  const body = res.data;

  if (body.status !== 'OK' || !body.results || !Array.isArray(body.results.members)) {
    console.error('⚠️  Unexpected JSON from team API:', JSON.stringify(body).slice(0,200));
    throw new Error('Invalid team JSON');
  }

  // extract what we need
  return body.results.members.map(m => ({
    username:    m.username,
    displayName: m.displayName || m.racerName || m.username,
    racesPlayed: m.racesPlayed
  }));
}

// Record any missing baselines
async function ensureBaseline() {
  const board = await fetchLeaderboard();
  config.baseline = config.baseline || {};
  for (let { username, racesPlayed } of board) {
    if (!Number.isInteger(config.baseline[username])) {
      config.baseline[username] = racesPlayed;
      console.log(`Baseline[${username}] = ${racesPlayed}`);
    }
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Compute deltas, sort, and write out data.json
async function updateData() {
  const board = await fetchLeaderboard();
  const results = board
    .map(({ username, displayName, racesPlayed }) => ({
      username,
      displayName,
      delta: racesPlayed - config.baseline[username]
    }))
    .sort((a, b) => b.delta - a.delta);

  results.forEach(r => console.log(`Delta[${r.username}] = ${r.delta}`));

  // compute a Pacific-time timestamp
  const now = new Date();
  const lastUpdated = now.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'long',
    day:   'numeric',
    year:  'numeric',
    hour:        'numeric',
    minute:      '2-digit',
    timeZoneName:'short'
  });

  fs.writeFileSync(
    DATA_PATH,
    JSON.stringify(
      {
        TEAM_NAME,
        START_DATE,
        last_updated: lastUpdated,
        board: results
      },
      null,
      2
    )
  );
}

// run it
;(async () => {
  try {
    await ensureBaseline();
    await updateData();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
