// scripts/update.js

const fs      = require('fs');
const path    = require('path');
const axios   = require('axios');

// ─── config paths ──────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(__dirname, '..', 'baseline.json');
const DATA_PATH   = path.join(__dirname, '..', 'docs',     'data.json');

// ─── load or initialize your config ────────────────────────────────────────
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const { TEAM_NAME, START_DATE } = config;

// ─── 1) Fetch the team’s JSON via ScraperAPI ────────────────────────────────
async function fetchLeaderboard() {
  const targetUrl = `https://www.nitrotype.com/api/v2/teams/${TEAM_NAME}`;
  const proxyUrl  = `http://api.scraperapi.com`
                  + `?api_key=${process.env.SCRAPERAPI_KEY}`
                  + `&url=${encodeURIComponent(targetUrl)}`;

  const res  = await axios.get(proxyUrl);
  const body = res.data;

  // sanity check
  if (!body.data || !Array.isArray(body.data.members)) {
    console.error('⚠️  Unexpected JSON from team API:', JSON.stringify(body).slice(0,200), '\n');
    throw new Error('Invalid team JSON');
  }

  // map to an array of { user, races }
  // each member object has an alltime_races field with their total races
  return body.data.members.map(m => ({
    user:  m.racerName || m.username,
    races: m.alltime_races
  }));
}

// ─── 2) On first-ever run: record each member’s baseline ────────────────────
async function ensureBaseline() {
  const board = await fetchLeaderboard();
  config.baseline = config.baseline || {};
  for (let { user, races } of board) {
    if (!Number.isInteger(config.baseline[user])) {
      config.baseline[user] = races;
      console.log(`Baseline[${user}] = ${races}`);
    }
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ─── 3) On every run: compute delta = current – baseline ───────────────────
async function updateDelta() {
  const board = await fetchLeaderboard();
  const delta = {};
  for (let { user, races } of board) {
    delta[user] = races - config.baseline[user];
    console.log(`Delta[${user}] = ${delta[user]}`);
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify({
    TEAM_NAME,
    START_DATE,
    delta
  }, null, 2));
}

// ─── 4) Kick it off ────────────────────────────────────────────────────────
(async () => {
  try {
    await ensureBaseline();
    await updateDelta();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
