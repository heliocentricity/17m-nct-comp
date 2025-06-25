// scripts/update.js

const fs    = require('fs');
const path  = require('path');
const axios = require('axios');

const CONFIG_PATH = path.join(__dirname, '..', 'baseline.json');
const DATA_PATH   = path.join(__dirname, '..', 'docs',     'data.json');

// load your existing config
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const { TEAM_NAME, START_DATE } = config;

// 1) fetch every member via the v2 JSON API (proxied)
async function fetchLeaderboard() {
  const targetUrl = `https://www.nitrotype.com/api/v2/teams/${TEAM_NAME}`;
  const proxyUrl  = `http://api.scraperapi.com`
                  + `?api_key=${process.env.SCRAPERAPI_KEY}`
                  + `&url=${encodeURIComponent(targetUrl)}`;

  const res  = await axios.get(proxyUrl);
  const body = res.data;

  if (body.status !== 'OK'
    || !body.results
    || !Array.isArray(body.results.members)
  ) {
    console.error(
      '⚠️  Unexpected JSON from team API:',
      JSON.stringify(body).slice(0,200),
      '\n'
    );
    throw new Error('Invalid team JSON');
  }

  // extract exactly what we need
  return body.results.members.map(m => ({
    username:    m.username,
    displayName: m.displayName || m.racerName || m.username,
    racesPlayed: m.racesPlayed
  }));
}

// 2) on first-ever run, record baseline for each username
async function ensureBaseline() {
  const board = await fetchLeaderboard();
  config.baseline = config.baseline || {};

  board.forEach(({ username, racesPlayed }) => {
    if (!Number.isInteger(config.baseline[username])) {
      config.baseline[username] = racesPlayed;
      console.log(`Baseline[${username}] = ${racesPlayed}`);
    }
  });

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// 3) on every run, compute delta and write a sorted `board` array
async function updateData() {
  const board = await fetchLeaderboard();

  // compute delta and sort descending
  const results = board
    .map(({ username, displayName, racesPlayed }) => ({
      username,
      displayName,
      delta: racesPlayed - config.baseline[username]
    }))
    .sort((a, b) => b.delta - a.delta);

  // log for sanity
  results.forEach(r => console.log(`Delta[${r.username}] = ${r.delta}`));

  // **write the `board` array** into data.json
  fs.writeFileSync(
    DATA_PATH,
    JSON.stringify(
      { TEAM_NAME, START_DATE, board: results },
      null,
      2
    )
  );
}

// 4) drive it
;(async () => {
  try {
    await ensureBaseline();
    await updateData();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
