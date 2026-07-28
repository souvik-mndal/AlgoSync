const CLIENT_ID = "Ov23lifLLTVFkjurvntP";
const WORKER_URL = "https://cool-mode-3295.algosync-svk.workers.dev";
const RING_CIRCUMFERENCE = 2 * Math.PI * 54; // r=54
const RING_GAP = 6; // visual gap between arc segments, in stroke-dasharray units

const viewDisconnected = document.getElementById("view-disconnected");
const viewConnected = document.getElementById("view-connected");
const viewEmpty = document.getElementById("view-empty");
const viewStats = document.getElementById("view-stats");

const connectBtn = document.getElementById("connect-btn");
const btnText = document.getElementById("btn-text");
const statusText = document.getElementById("status-text");
const disconnectBtn = document.getElementById("disconnect-btn");
const accountName = document.getElementById("account-name");
const recentList = document.getElementById("recent-list");

function showView(view) {
  [viewDisconnected, viewConnected].forEach((v) => v.classList.remove("active"));
  view.classList.add("active");
}

function showSubView(view) {
  [viewEmpty, viewStats].forEach((v) => v.classList.remove("active"));
  view.classList.add("active");
}

/* =========================================================================
 * MAIN ENTRY
 * ========================================================================= */
async function init() {
  const result = await chrome.storage.local.get(["githubToken", "githubUsername", "submissions"]);

  if (!result.githubToken || !result.githubUsername) {
    showView(viewDisconnected);
    return;
  }

  accountName.textContent = result.githubUsername;
  showView(viewConnected);

  const submissions = result.submissions || {};
  const entries = Object.values(submissions);

  if (entries.length === 0) {
    showSubView(viewEmpty);
    return;
  }

  renderStats(entries);
  showSubView(viewStats);
}

/* =========================================================================
 * STATS RENDERING
 * ========================================================================= */
function renderStats(entries) {
  const total = entries.length;
  const totalEl = document.getElementById("total-solved");
  totalEl.textContent = total;

  const digits = String(total).length;
  const sizeMap = { 1: 34, 2: 34, 3: 27, 4: 21 };
  totalEl.style.fontSize = `${sizeMap[digits] || 19}px`;

  const easy = entries.filter((e) => e.difficulty === "Easy").length;
  const medium = entries.filter((e) => e.difficulty === "Medium").length;
  const hard = entries.filter((e) => e.difficulty === "Hard").length;

  document.getElementById("count-easy").textContent = easy;
  document.getElementById("count-medium").textContent = medium;
  document.getElementById("count-hard").textContent = hard;

  // Build ring arcs with a small gap between each segment
  const easyLen = Math.max((easy / total) * RING_CIRCUMFERENCE - RING_GAP, 0);
  const mediumLen = Math.max((medium / total) * RING_CIRCUMFERENCE - RING_GAP, 0);
  const hardLen = Math.max((hard / total) * RING_CIRCUMFERENCE - RING_GAP, 0);

  const easyStart = 0;
  const mediumStart = (easy / total) * RING_CIRCUMFERENCE;
  const hardStart = ((easy + medium) / total) * RING_CIRCUMFERENCE;

  const ringEasy = document.getElementById("ring-easy");
  const ringMedium = document.getElementById("ring-medium");
  const ringHard = document.getElementById("ring-hard");

  ringEasy.setAttribute("stroke-dasharray", `${easyLen} ${RING_CIRCUMFERENCE}`);
  ringEasy.setAttribute("stroke-dashoffset", `${-easyStart}`);

  ringMedium.setAttribute("stroke-dasharray", `${mediumLen} ${RING_CIRCUMFERENCE}`);
  ringMedium.setAttribute("stroke-dashoffset", `${-mediumStart}`);

  ringHard.setAttribute("stroke-dasharray", `${hardLen} ${RING_CIRCUMFERENCE}`);
  ringHard.setAttribute("stroke-dashoffset", `${-hardStart}`);

  // Recent list — up to 3 most recent, works fine with fewer
  const sorted = [...entries].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
  const recent = sorted.slice(0, 3);

  recentList.innerHTML = "";
  recent.forEach((entry) => {
    const row = document.createElement("a");
    row.className = "recent-row";
    row.href = entry.url || "#";
    row.target = "_blank";
    row.rel = "noopener noreferrer";

    const nameSpan = document.createElement("span");
    nameSpan.className = "recent-name";
    nameSpan.textContent = entry.problemName || "Unknown";
    nameSpan.title = entry.problemName || "Unknown";

    const timeSpan = document.createElement("span");
    timeSpan.className = "recent-time";
    timeSpan.innerHTML = `${timeAgo(entry.timestamp)} <i class="ti ti-external-link"></i>`;

    row.appendChild(nameSpan);
    row.appendChild(timeSpan);
    recentList.appendChild(row);
  });
}

function timeAgo(isoString) {
  if (!isoString) return "";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* =========================================================================
 * OAUTH FLOW
 * ========================================================================= */
function startGithubAuth() {
  connectBtn.disabled = true;
  statusText.textContent = "Opening GitHub login...";
  statusText.className = "";

  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=repo`;

  chrome.identity.launchWebAuthFlow(
    { url: authUrl, interactive: true },
    async (redirectedTo) => {
      connectBtn.disabled = false;

      if (chrome.runtime.lastError || !redirectedTo) {
        console.error("GitHub auth failed:", chrome.runtime.lastError);
        statusText.textContent = "Login failed. Try again.";
        statusText.className = "error";
        return;
      }

      const url = new URL(redirectedTo);
      const code = url.searchParams.get("code");

      if (!code) {
        statusText.textContent = "No code received. Try again.";
        statusText.className = "error";
        return;
      }

      statusText.textContent = "Verifying with GitHub...";
      await exchangeCodeForToken(code);
    }
  );
}

async function exchangeCodeForToken(code) {
  try {
    const response = await fetch(`${WORKER_URL}/github-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("Token exchange failed:", data);
      statusText.textContent = "Couldn't connect. Try again.";
      statusText.className = "error";
      return;
    }

    const userResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const userData = await userResponse.json();

    await chrome.storage.local.set({
      githubToken: data.access_token,
      githubUsername: userData.login || "GitHub user",
    });

    statusText.textContent = "";
    init();
  } catch (error) {
    console.error("Token exchange error:", error);
    statusText.textContent = "Something went wrong. Try again.";
    statusText.className = "error";
  }
}

/* =========================================================================
 * DISCONNECT
 * ========================================================================= */
async function disconnectGithub() {
  await chrome.storage.local.remove(["githubToken", "githubUsername"]);
  init();
}

connectBtn.addEventListener("click", startGithubAuth);
disconnectBtn.addEventListener("click", disconnectGithub);
init();