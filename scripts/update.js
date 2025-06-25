// scripts/update.js
const fs      = require('fs');
const path    = require('path');
const axios   = require('axios');
const cheerio = require('cheerio');

const CONFIG_PATH = path.join(__dirname, '..', 'baseline.json');
const DATA_PATH   = path.join(__dirname, '..', 'docs', 'data.json');

// load or initialize
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const { TEAM_NAME, START_DATE } = config;

// our proxy‐backed single fetch of the whole team page
async function fetchLeaderboard() {
  const targetUrl = `https://www.nitrotype.com/team/${TEAM_NAME}`;
  const proxyUrl  = `http://api.scraperapi.com?api_key=${process.env.SCRAPERAPI_KEY}`
                  + `&url=${encodeURIComponent(targetUrl)}`;
  const html = (await axios.get(proxyUrl)).data;
  const $    = cheerio.load(html);

  // NitroType injects all the data here
  const raw  = $('#__NEXT_DATA__').text();
  const json = JSON.parse(raw);
  const board = json.props.pageProps.team.leaderboard;

  // pull out { user, races } for each member
  return board.map(entry => ({
    user:  entry.racer.racerName,
    races: entry.racer.races
  }));
}

async function main() {
  const board = await fetchLeaderboard();

  // 1) record any missing baseline
  config.baseline = config.baseline || {};
  for (let { user, races } of board) {
    if (!Number.isInteger(config.baseline[user])) {
      config.baseline[user] = races;
      console.log(`Baseline[${user}] = ${races}`);
    }
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  // 2) compute deltas
  const delta = {};
  for (let { user, races } of board) {
    delta[user] = races - config.baseline[user];
    console.log(`Delta[${user}] = ${delta[user]}`);
  }

  // 3) write the JSON that your static page will consume
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
