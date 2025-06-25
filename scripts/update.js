// scripts/update.js

const fs        = require('fs');
const path      = require('path');
const puppeteer = require('puppeteer');

const CONFIG_PATH = path.join(__dirname, '..', 'baseline.json');
const DATA_PATH   = path.join(__dirname, '..', 'docs', 'data.json');

// load config
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const { TEAM_NAME, START_DATE } = config;

async function fetchLeaderboard() {
  const url = `https://www.nitrotype.com/team/${TEAM_NAME}`;

  // launch headless Chrome
  const browser = await puppeteer.launch({
    args: ['--no-sandbox','--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // go to the team page and wait for it to fully render
  await page.goto(url, { waitUntil: 'networkidle0' });

  // pull the JSON out of the Next.js data blob
  const raw = await page.$eval(
    '#__NEXT_DATA__',
    el => el.textContent
  );
  await browser.close();

  const json = JSON.parse(raw);
  return json.props.pageProps.team.leaderboard.map(entry => ({
    user:  entry.racer.racerName,
    races: entry.racer.races
  }));
}

async function main() {
  const board = await fetchLeaderboard();

  // 1) initialize any missing baselines
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

  // 3) write out the JSON your static page consumes
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
