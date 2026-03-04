#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Read config.js and extract the default export
const src = fs.readFileSync(path.join(__dirname, "config.js"), "utf-8");
const CONFIG = new Function(src.replace("export default", "return"))();

const API = "https://api.github.com";

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "github-portfolio-sync" },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchAllRepos(username) {
  let page = 1, all = [];
  while (true) {
    const repos = await fetchJSON(
      `${API}/users/${username}/repos?per_page=100&page=${page}`
    );
    all = all.concat(repos);
    if (repos.length < 100) break;
    page++;
  }
  return all;
}

function pickUserFields(user) {
  return {
    login: user.login,
    name: user.name,
    avatar_url: user.avatar_url,
    html_url: user.html_url,
    bio: user.bio,
    blog: user.blog,
    twitter_username: user.twitter_username,
    location: user.location,
  };
}

function pickRepoFields(repo) {
  return {
    name: repo.name,
    description: repo.description,
    html_url: repo.html_url,
    homepage: repo.homepage,
    language: repo.language,
    stargazers_count: repo.stargazers_count,
    fork: repo.fork,
    updated_at: repo.updated_at,
  };
}

async function main() {
  const username = CONFIG.username;
  console.log(`Fetching data for @${username}...`);

  const [user, repos] = await Promise.all([
    fetchJSON(`${API}/users/${username}`),
    fetchAllRepos(username),
  ]);

  const data = {
    user: pickUserFields(user),
    repos: repos.filter(r => r.name !== username).map(pickRepoFields),
    synced_at: new Date().toISOString(),
  };

  const out = path.join(__dirname, "data.json");
  fs.writeFileSync(out, JSON.stringify(data, null, 2));
  console.log(`Wrote ${data.repos.length} repos to data.json`);
}

main().catch((err) => {
  console.error("Sync failed:", err.message);
  process.exit(1);
});
