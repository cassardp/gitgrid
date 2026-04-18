// Mock mode — activates with ?mock in URL
// Simulates a logged-in GitHub user with fake repos, persists edits to localStorage.
// Usage: /cassardp?mock  (reset with ?mock=reset)

const LS_KEY = "gitgrid-mock-v1";

const MOCK_USER = {
  login: "cassardp",
  name: "Patrice Cassard",
  bio: "Indie maker. Ships small, useful tools. Currently building GitGrid.",
  avatar_url: "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#d4d4d8"/><stop offset="1" stop-color="#71717a"/>
      </linearGradient></defs>
      <rect width="96" height="96" fill="url(#g)"/>
      <text x="50%" y="57%" text-anchor="middle" font-family="Geist,Inter,sans-serif" font-weight="500" font-size="38" fill="#fafafa">P</text>
    </svg>`
  ),
  html_url: "https://github.com/cassardp",
  twitter_username: "patricecassard",
  blog: "cassardp.com",
  followers: 842,
};

const now = Date.now();
const daysAgo = (n) => new Date(now - n * 86400000).toISOString();

const MOCK_REPOS = [
  {
    name: "gitgrid",
    description: "Your GitHub repos, beautifully displayed.",
    language: "TypeScript",
    stargazers_count: 142,
    updated_at: daysAgo(1),
    html_url: "https://github.com/cassardp/gitgrid",
    homepage: "https://gitgrid.app",
    private: false,
    fork: false,
  },
  {
    name: "slowread",
    description: "A Markdown-first reading app that respects your attention.",
    language: "Swift",
    stargazers_count: 89,
    updated_at: daysAgo(4),
    html_url: "https://github.com/cassardp/slowread",
    homepage: "https://apps.apple.com/us/app/slowread/id000000",
    private: false,
    fork: false,
  },
  {
    name: "atlas-type",
    description: "A small, opinionated type system for editorial websites.",
    language: "TypeScript",
    stargazers_count: 2431,
    updated_at: daysAgo(3),
    html_url: "https://github.com/cassardp/atlas-type",
    homepage: "https://atlas-type.dev",
    private: false,
    fork: false,
  },
  {
    name: "cartograph",
    description: "Declarative map projections for the web. Tiny, fast, ugly by default.",
    language: "Rust",
    stargazers_count: 894,
    updated_at: daysAgo(2),
    html_url: "https://github.com/cassardp/cartograph",
    homepage: "",
    private: false,
    fork: false,
  },
  {
    name: "plumb",
    description: "Unix-style piping for browser tabs. Weekend project that got out of hand.",
    language: "Go",
    stargazers_count: 612,
    updated_at: daysAgo(21),
    html_url: "https://github.com/cassardp/plumb",
    homepage: "https://plumb.sh",
    private: false,
    fork: false,
  },
  {
    name: "marginalia",
    description: "A footnote-first writing tool for long-form researchers.",
    language: "TypeScript",
    stargazers_count: 328,
    updated_at: daysAgo(5),
    html_url: "https://github.com/cassardp/marginalia",
    homepage: "",
    private: false,
    fork: false,
  },
  {
    name: "fieldnotes",
    description: "Personal knowledge log. 2,400+ entries since 2019.",
    language: "MDX",
    stargazers_count: 189,
    updated_at: daysAgo(2),
    html_url: "https://github.com/cassardp/fieldnotes",
    homepage: "https://fieldnotes.cassardp.com",
    private: false,
    fork: false,
  },
  {
    name: "pigment",
    description: "Colour tools for designers working with paper, pigment, and the physical world.",
    language: "Swift",
    stargazers_count: 1056,
    updated_at: daysAgo(62),
    html_url: "https://github.com/cassardp/pigment",
    homepage: "",
    private: false,
    fork: false,
  },
  {
    name: "letterpress-css",
    description: "A CSS baseline for print-like typography on the web.",
    language: "CSS",
    stargazers_count: 512,
    updated_at: daysAgo(32),
    html_url: "https://github.com/cassardp/letterpress-css",
    homepage: "",
    private: false,
    fork: false,
  },
  {
    name: "dotfiles",
    description: "My personal dotfiles. Nothing special, kept public for reference.",
    language: "Shell",
    stargazers_count: 47,
    updated_at: daysAgo(1),
    html_url: "https://github.com/cassardp/dotfiles",
    homepage: "",
    private: false,
    fork: false,
  },
  {
    name: "stanza",
    description: "Syntax-highlighted poetry reader. A tribute to Project Gutenberg.",
    language: "Python",
    stargazers_count: 98,
    updated_at: daysAgo(180),
    html_url: "https://github.com/cassardp/stanza",
    homepage: "",
    private: false,
    fork: false,
  },
  {
    name: "private-playground",
    description: "Private experiments. Not for public view.",
    language: "JavaScript",
    stargazers_count: 0,
    updated_at: daysAgo(8),
    html_url: "https://github.com/cassardp/private-playground",
    homepage: "",
    private: true,
    fork: false,
  },
  {
    name: "secret-launch",
    description: "Upcoming project. Has a public homepage so visitors see it.",
    language: "TypeScript",
    stargazers_count: 3,
    updated_at: daysAgo(6),
    html_url: "https://github.com/cassardp/secret-launch",
    homepage: "https://secret-launch.dev",
    private: true,
    fork: false,
  },
  { name: "internal-tools", description: "", language: "TypeScript", stargazers_count: 0, updated_at: daysAgo(12), html_url: "", homepage: "", private: true, fork: false },
  { name: "client-contract-2024", description: "", language: "TypeScript", stargazers_count: 0, updated_at: daysAgo(40), html_url: "", homepage: "", private: true, fork: false },
  { name: "draft-portfolio-v2", description: "", language: "CSS", stargazers_count: 0, updated_at: daysAgo(3), html_url: "", homepage: "", private: true, fork: false },
  { name: "sketch-ideas", description: "", language: "JavaScript", stargazers_count: 0, updated_at: daysAgo(17), html_url: "", homepage: "", private: true, fork: false },
  { name: "archived-api", description: "", language: "Go", stargazers_count: 0, updated_at: daysAgo(210), html_url: "", homepage: "", private: true, fork: false },
  { name: "legacy-scraper", description: "", language: "Python", stargazers_count: 0, updated_at: daysAgo(95), html_url: "", homepage: "", private: true, fork: false },
  { name: "nda-nordic", description: "", language: "Swift", stargazers_count: 0, updated_at: daysAgo(28), html_url: "", homepage: "", private: true, fork: false },
  { name: "personal-finance", description: "", language: "TypeScript", stargazers_count: 0, updated_at: daysAgo(9), html_url: "", homepage: "", private: true, fork: false },
  { name: "auth-experiments", description: "", language: "Rust", stargazers_count: 0, updated_at: daysAgo(54), html_url: "", homepage: "", private: true, fork: false },
  { name: "scratchpad", description: "", language: "JavaScript", stargazers_count: 0, updated_at: daysAgo(1), html_url: "", homepage: "", private: true, fork: false },
  { name: "vault-cli", description: "", language: "Go", stargazers_count: 0, updated_at: daysAgo(130), html_url: "", homepage: "", private: true, fork: false },
  { name: "old-landing", description: "", language: "CSS", stargazers_count: 0, updated_at: daysAgo(320), html_url: "", homepage: "", private: true, fork: false },
];

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { config: {}, images: {} };
}

function saveState(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
}

export function installMock() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("mock") === "reset") {
    localStorage.removeItem(LS_KEY);
    const url = new URL(window.location.href);
    url.searchParams.set("mock", "");
    window.location.replace(url.toString());
    return false;
  }

  let state = loadState();

  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  });

  const realFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input.url;
    const method = (init && init.method) || (typeof input === "object" && input.method) || "GET";

    // Auth
    if (url.startsWith("/api/auth/me")) {
      return json({ user: { username: MOCK_USER.login } });
    }
    if (url.startsWith("/api/auth/delete")) {
      localStorage.removeItem(LS_KEY);
      return json({ ok: true });
    }

    // Portfolio
    if (url.startsWith("/api/portfolio/")) {
      return json({
        user: MOCK_USER,
        repos: MOCK_REPOS,
        config: state.config,
        views: { today: 12, week: 84 },
      });
    }

    // Sync
    if (url.startsWith("/api/sync") && method === "POST") {
      return json({ user: MOCK_USER, repos: MOCK_REPOS });
    }

    // Config
    if (url.startsWith("/api/config")) {
      if (method === "PUT") {
        const body = await (init && init.body ? JSON.parse(init.body) : {});
        state.config = body;
        saveState(state);
        return json({ ok: true });
      }
      return json(state.config);
    }

    // Images
    if (url.startsWith("/api/images")) {
      if (method === "POST") {
        const formData = init.body;
        const file = formData.get("file");
        const repo = formData.get("repo");
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        const key = `mock-${repo}-${Date.now()}`;
        state.images[key] = dataUrl;
        saveState(state);
        return json({ key });
      }
      if (method === "DELETE") {
        const { key } = await JSON.parse(init.body);
        delete state.images[key];
        saveState(state);
        return json({ ok: true });
      }
    }

    // Screenshot capture (mock: just fail so placeholder shows upload button)
    if (url.startsWith("/api/screenshots/capture")) {
      return json({ error: "capture disabled in mock" }, 503);
    }

    return realFetch(input, init);
  };

  // Expose image resolver so main.js/dev-config.js can turn mock keys into dataURLs
  window.__gitgridMock = {
    resolveImg: (key) => state.images[key] || null,
    reload: () => { state = loadState(); },
  };

  return true;
}
