// scripts/update.js

const fs      = require('fs');
const path    = require('path');
const axios   = require('axios');
const cheerio = require('cheerio');

const CONFIG_PATH = path.join(__dirname, '..', 'baseline.json');
const DATA_PATH   = path.join(__dirname, '..', 'docs', 'data.json');

// Load your config
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const { TEAM_NAME, START_DATE } = config;

// Fetch the team page via ScraperAPI proxy
async function fetchLeaderboard() {
  const targetUrl = `https://www.nitrotype.com/team/${TEAM_NAME}`;
    // ask ScraperAPI to render JS so __NEXT_DATA__ is present
  const proxyUrl  = `http://api.scraperapi.com`
                  + `?api_key=${process.env.SCRAPERAPI_KEY}`
                  + `&url=${encodeURIComponent(targetUrl)}`
                  + `&render=true`;

  const res  = await axios.get(proxyUrl);
  const html = res.data;

  if (!html || !html.includes('__NEXT_DATA__')) {
    console.error('⚠️  fetchLeaderboard got back unexpected HTML:');
    console.error(html.slice(0, 200).replace(/\n/g, ' '), '\n');
    throw new Error('Did not find __NEXT_DATA__ in fetched HTML');
  }

  const $    = cheerio.load(html);
  const raw  = $('#__NEXT_DATA__').html();
  const json = JSON.parse(raw);
  return json.props.pageProps.team.leaderboard.map(entry => ({
    user:  entry.racer.racerName,
    races: entry.racer.races
  }));
}

async function main() {
  const board = await fetchLeaderboard();

  // 1) Populate any missing baselines
  config.baseline = config.baseline || {};
  for (let { user, races } of board) {
    if (!Number.isInteger(config.baseline[user])) {
      config.baseline[user] = races;
      console.log(`Baseline[${user}] = ${races}`);
    }
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  // 2) Compute deltas
  const delta = {};
  for (let { user, races } of board) {
    delta[user] = races - config.baseline[user];
    console.log(`Delta[${user}] = ${delta[user]}`);
  }

  // 3) Write data.json
  fs.writeFileSync(DATA_PATH, JSON.stringify({
    TEAM_NAME,
    START_DATE,
    delta
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
