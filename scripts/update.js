// scripts/update.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// paths
const CONFIG_PATH = path.join(__dirname, '..', 'baseline.json');
const DATA_PATH   = path.join(__dirname, '..', 'docs', 'data.json');

// load config
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const { TEAM_NAME, START_DATE } = config;

// browser-like headers
const axiosInstance = axios.create({
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/114.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/json,*/*;q=0.1'
  }
});

/** scrape NitroType team page for all member usernames */
async function fetchTeamMembers() {
  const url = `https://www.nitrotype.com/team/${TEAM_NAME}`;
  const html = (await axiosInstance.get(url)).data;
  const $ = cheerio.load(html);
  const raw = $('#__NEXT_DATA__').html();
  const json = JSON.parse(raw);
  return json
    .props
    .pageProps
    .team
    .leaderboard
    .map(e => e.racer.racerName);
}

/** fetch total races for a given username */
async function fetchRaces(username) {
  // lookup userID
  const searchRes = (await axiosInstance.get(
    'https://www.nitrotype.com/api/players-search',
    { params: { term: username } }
  )).data;
  if (!searchRes[0]) throw new Error(`User "${username}" not found`);
  const userId = searchRes[0].userID;

  // fetch profile
  const profileRes = (await axiosInstance.get(
    `https://www.nitrotype.com/api/players/${userId}`
  )).data;
  return profileRes.races;
}

async function main() {
  // 1) discover & save new members
  const members = await fetchTeamMembers();
  config.members = members;

  // 2) record any missing baselines
  config.baseline = config.baseline || {};
  for (let m of members) {
    if (!Number.isInteger(config.baseline[m])) {
      const val = await fetchRaces(m);
      config.baseline[m] = val;
      console.log(`Baseline[${m}] = ${val}`);
    }
  }
  // write updated baseline.json
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  // 3) compute deltas
  const delta = {};
  for (let m of members) {
    const now = await fetchRaces(m);
    delta[m] = now - config.baseline[m];
    console.log(`Delta[${m}] = ${delta[m]}`);
  }

  // 4) output docs/data.json
  const out = { TEAM_NAME, START_DATE, delta };
  fs.writeFileSync(DATA_PATH, JSON.stringify(out, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
