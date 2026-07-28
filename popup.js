// const CLIENT_ID = "Ov23lifLLTVFkjurvntP";
// const WORKER_URL = "https://cool-mode-3295.algosync-svk.workers.dev";
// const RING_CIRCUMFERENCE = 2 * Math.PI * 54; // r=54
// const RING_GAP = 6; // visual gap between arc segments, in stroke-dasharray units

// const viewDisconnected = document.getElementById("view-disconnected");
// const viewConnected = document.getElementById("view-connected");
// const viewEmpty = document.getElementById("view-empty");
// const viewStats = document.getElementById("view-stats");

// const connectBtn = document.getElementById("connect-btn");
// const btnText = document.getElementById("btn-text");
// const statusText = document.getElementById("status-text");
// const disconnectBtn = document.getElementById("disconnect-btn");
// const accountName = document.getElementById("account-name");
// const recentList = document.getElementById("recent-list");

// function showView(view) {
//   [viewDisconnected, viewConnected].forEach((v) => v.classList.remove("active"));
//   view.classList.add("active");
// }

// function showSubView(view) {
//   [viewEmpty, viewStats].forEach((v) => v.classList.remove("active"));
//   view.classList.add("active");
// }

// /* =========================================================================
//  * MAIN ENTRY
//  * ========================================================================= */
// async function init() {
//   const result = await chrome.storage.local.get(["githubToken", "githubUsername", "submissions"]);

//   if (!result.githubToken || !result.githubUsername) {
//     showView(viewDisconnected);
//     return;
//   }

//   accountName.textContent = result.githubUsername;
//   showView(viewConnected);

//   const submissions = result.submissions || {};
//   const entries = Object.values(submissions);

//   if (entries.length === 0) {
//     showSubView(viewEmpty);
//     return;
//   }

//   renderStats(entries);
//   showSubView(viewStats);
// }

// /* =========================================================================
//  * STATS RENDERING
//  * ========================================================================= */
// function renderStats(entries) {
//   const total = entries.length;
//   const totalEl = document.getElementById("total-solved");
//   totalEl.textContent = total;

//   const digits = String(total).length;
//   const sizeMap = { 1: 34, 2: 34, 3: 27, 4: 21 };
//   totalEl.style.fontSize = `${sizeMap[digits] || 19}px`;

//   const easy = entries.filter((e) => e.difficulty === "Easy").length;
//   const medium = entries.filter((e) => e.difficulty === "Medium").length;
//   const hard = entries.filter((e) => e.difficulty === "Hard").length;

//   document.getElementById("count-easy").textContent = easy;
//   document.getElementById("count-medium").textContent = medium;
//   document.getElementById("count-hard").textContent = hard;

//   // Build ring arcs with a small gap between each segment
//   const easyLen = Math.max((easy / total) * RING_CIRCUMFERENCE - RING_GAP, 0);
//   const mediumLen = Math.max((medium / total) * RING_CIRCUMFERENCE - RING_GAP, 0);
//   const hardLen = Math.max((hard / total) * RING_CIRCUMFERENCE - RING_GAP, 0);

//   const easyStart = 0;
//   const mediumStart = (easy / total) * RING_CIRCUMFERENCE;
//   const hardStart = ((easy + medium) / total) * RING_CIRCUMFERENCE;

//   const ringEasy = document.getElementById("ring-easy");
//   const ringMedium = document.getElementById("ring-medium");
//   const ringHard = document.getElementById("ring-hard");

//   ringEasy.setAttribute("stroke-dasharray", `${easyLen} ${RING_CIRCUMFERENCE}`);
//   ringEasy.setAttribute("stroke-dashoffset", `${-easyStart}`);

//   ringMedium.setAttribute("stroke-dasharray", `${mediumLen} ${RING_CIRCUMFERENCE}`);
//   ringMedium.setAttribute("stroke-dashoffset", `${-mediumStart}`);

//   ringHard.setAttribute("stroke-dasharray", `${hardLen} ${RING_CIRCUMFERENCE}`);
//   ringHard.setAttribute("stroke-dashoffset", `${-hardStart}`);

//   // Recent list — up to 3 most recent, works fine with fewer
//   const sorted = [...entries].sort(
//     (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
//   );
//   const recent = sorted.slice(0, 3);

//   recentList.innerHTML = "";
//   recent.forEach((entry) => {
//     const row = document.createElement("a");
//     row.className = "recent-row";
//     row.href = entry.url || "#";
//     row.target = "_blank";
//     row.rel = "noopener noreferrer";

//     const nameSpan = document.createElement("span");
//     nameSpan.className = "recent-name";
//     nameSpan.textContent = entry.problemName || "Unknown";
//     nameSpan.title = entry.problemName || "Unknown";

//     const timeSpan = document.createElement("span");
//     timeSpan.className = "recent-time";
//     timeSpan.innerHTML = `${timeAgo(entry.timestamp)} <i class="ti ti-external-link"></i>`;

//     row.appendChild(nameSpan);
//     row.appendChild(timeSpan);
//     recentList.appendChild(row);
//   });
// }

// function timeAgo(isoString) {
//   if (!isoString) return "";
//   const diffMs = Date.now() - new Date(isoString).getTime();
//   const mins = Math.floor(diffMs / 60000);
//   if (mins < 1) return "just now";
//   if (mins < 60) return `${mins}m ago`;
//   const hours = Math.floor(mins / 60);
//   if (hours < 24) return `${hours}h ago`;
//   const days = Math.floor(hours / 24);
//   return `${days}d ago`;
// }

// /* =========================================================================
//  * OAUTH FLOW
//  * ========================================================================= */
// function startGithubAuth() {
//   connectBtn.disabled = true;
//   statusText.textContent = "Opening GitHub login...";
//   statusText.className = "";

//   const redirectUri = chrome.identity.getRedirectURL();
//   const authUrl =
//     `https://github.com/login/oauth/authorize` +
//     `?client_id=${CLIENT_ID}` +
//     `&redirect_uri=${encodeURIComponent(redirectUri)}` +
//     `&scope=repo`;

//   chrome.identity.launchWebAuthFlow(
//     { url: authUrl, interactive: true },
//     async (redirectedTo) => {
//       connectBtn.disabled = false;

//       if (chrome.runtime.lastError || !redirectedTo) {
//         console.error("GitHub auth failed:", chrome.runtime.lastError);
//         statusText.textContent = "Login failed. Try again.";
//         statusText.className = "error";
//         return;
//       }

//       const url = new URL(redirectedTo);
//       const code = url.searchParams.get("code");

//       if (!code) {
//         statusText.textContent = "No code received. Try again.";
//         statusText.className = "error";
//         return;
//       }

//       statusText.textContent = "Verifying with GitHub...";
//       await exchangeCodeForToken(code);
//     }
//   );
// }

// async function exchangeCodeForToken(code) {
//   try {
//     const response = await fetch(`${WORKER_URL}/github-auth`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ code }),
//     });

//     const data = await response.json();

//     if (!response.ok || data.error) {
//       console.error("Token exchange failed:", data);
//       statusText.textContent = "Couldn't connect. Try again.";
//       statusText.className = "error";
//       return;
//     }

//     const userResponse = await fetch("https://api.github.com/user", {
//       headers: { Authorization: `Bearer ${data.access_token}` },
//     });
//     const userData = await userResponse.json();

//     await chrome.storage.local.set({
//       githubToken: data.access_token,
//       githubUsername: userData.login || "GitHub user",
//     });

//     statusText.textContent = "";
//     init();
//   } catch (error) {
//     console.error("Token exchange error:", error);
//     statusText.textContent = "Something went wrong. Try again.";
//     statusText.className = "error";
//   }
// }

// /* =========================================================================
//  * DISCONNECT
//  * ========================================================================= */
// async function disconnectGithub() {
//   await chrome.storage.local.remove(["githubToken", "githubUsername"]);
//   init();
// }

// connectBtn.addEventListener("click", startGithubAuth);
// disconnectBtn.addEventListener("click", disconnectGithub);
// init();
























const CLIENT_ID = "Ov23lifLLTVFkjurvntP";
const WORKER_URL = "https://cool-mode-3295.algosync-svk.workers.dev";
const RING_CIRCUMFERENCE = 2 * Math.PI * 54;
const RING_GAP = 6;

// Views
const viewDisconnected = document.getElementById("view-disconnected");
const viewConnected = document.getElementById("view-connected");
const viewRepoSelect = document.getElementById("view-repo-select");
const viewEmpty = document.getElementById("view-empty");
const viewStats = document.getElementById("view-stats");

// Connect elements
const connectBtn = document.getElementById("connect-btn");
const btnText = document.getElementById("btn-text");
const statusText = document.getElementById("status-text");
const disconnectBtn = document.getElementById("disconnect-btn");
const accountName = document.getElementById("account-name");
const recentList = document.getElementById("recent-list");

// Repo selection elements
const repoSelectAccountName = document.getElementById("repo-select-account-name");
const tabNew = document.getElementById("tab-new");
const tabExisting = document.getElementById("tab-existing");
const newRepoMode = document.getElementById("new-repo-mode");
const existingRepoMode = document.getElementById("existing-repo-mode");
const newRepoNameInput = document.getElementById("new-repo-name");
const visPublic = document.getElementById("vis-public");
const visPrivate = document.getElementById("vis-private");
const repoSearchInput = document.getElementById("repo-search");
const repoListEl = document.getElementById("repo-list");
const repoConfirmBtn = document.getElementById("repo-confirm-btn");
const repoSelectStatus = document.getElementById("repo-select-status");

let currentMode = "new"; // "new" or "existing"
let currentVisibility = "public";
let fetchedRepos = [];
let selectedExistingRepo = null;

/* =========================================================================
 * VIEW SWITCHING
 * ========================================================================= */
function showTopView(view) {
  [viewDisconnected, viewConnected, viewRepoSelect].forEach((v) => v.classList.remove("active"));
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
  const result = await chrome.storage.local.get([
    "githubToken",
    "githubUsername",
    "repoName",
    "submissions",
  ]);

  if (!result.githubToken || !result.githubUsername) {
    showTopView(viewDisconnected);
    return;
  }

  if (!result.repoName) {
  repoSelectAccountName.textContent = result.githubUsername;
  repoSelectStatus.textContent = "";
  repoSelectStatus.className = "repo-status";
  repoConfirmBtn.disabled = false;
  showTopView(viewRepoSelect);
  loadExistingRepos(result.githubToken);
  return;
}

  accountName.textContent = `${result.githubUsername} · ${result.repoName}`;
  showTopView(viewConnected);

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
 * STATS RENDERING (unchanged from before)
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

  const sorted = [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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
 * REPO SELECTION — TAB SWITCHING
 * ========================================================================= */
function switchToNewMode() {
  currentMode = "new";
  tabNew.classList.add("active");
  tabExisting.classList.remove("active");
  newRepoMode.style.display = "block";
  existingRepoMode.style.display = "none";
  repoConfirmBtn.textContent = "Create & Connect";
  repoSelectStatus.textContent = "";
  repoConfirmBtn.classList.remove("muted");
}

function switchToExistingMode() {
  currentMode = "existing";
  tabExisting.classList.add("active");
  tabNew.classList.remove("active");
  newRepoMode.style.display = "none";
  existingRepoMode.style.display = "block";
  repoConfirmBtn.textContent = "Connect Repo";
  repoSelectStatus.textContent = "";
  updateConfirmButtonState();
}

tabNew.addEventListener("click", switchToNewMode);
tabExisting.addEventListener("click", switchToExistingMode);

visPublic.addEventListener("click", () => {
  currentVisibility = "public";
  visPublic.classList.add("selected");
  visPrivate.classList.remove("selected");
});
visPrivate.addEventListener("click", () => {
  currentVisibility = "private";
  visPrivate.classList.add("selected");
  visPublic.classList.remove("selected");
});

/* =========================================================================
 * REPO SELECTION — FETCH EXISTING REPOS
 * ========================================================================= */
async function loadExistingRepos(token) {
  try {
    const response = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (Array.isArray(data)) {
      fetchedRepos = data;
      renderRepoList(fetchedRepos);
    }
  } catch (error) {
    console.error("Failed to load repos:", error);
  }
}

function renderRepoList(repos) {
  repoListEl.innerHTML = "";
  repos.forEach((repo) => {
    const item = document.createElement("div");
    item.className = "repo-list-item";
    if (selectedExistingRepo === repo.name) item.classList.add("selected");

    const nameSpan = document.createElement("span");
    nameSpan.textContent = repo.name;

    const visSpan = document.createElement("span");
    visSpan.className = "repo-visibility-tag";
    visSpan.textContent = repo.private ? "Private" : "Public";

    item.appendChild(nameSpan);
    item.appendChild(visSpan);

    item.addEventListener("click", () => {
      selectedExistingRepo = repo.name;
      renderRepoList(fetchedRepos.filter(matchesSearch));
      updateConfirmButtonState();
    });

    repoListEl.appendChild(item);
  });
}

function updateConfirmButtonState() {
  if (currentMode === "existing" && !selectedExistingRepo) {
    repoConfirmBtn.classList.add("muted");
  } else {
    repoConfirmBtn.classList.remove("muted");
  }
}

function matchesSearch(repo) {
  const query = repoSearchInput.value.trim().toLowerCase();
  if (!query) return true;
  return repo.name.toLowerCase().includes(query);
}

repoSearchInput.addEventListener("input", () => {
  renderRepoList(fetchedRepos.filter(matchesSearch));
});

/* =========================================================================
 * REPO SELECTION — CONFIRM
 * ========================================================================= */
repoConfirmBtn.addEventListener("click", async () => {
  const { githubToken } = await chrome.storage.local.get("githubToken");

  if (currentMode === "new") {
    const name = newRepoNameInput.value.trim();
    if (!name) {
      repoSelectStatus.textContent = "Please enter a repo name.";
      repoSelectStatus.className = "repo-status error";
      return;
    }
    await createNewRepo(githubToken, name, currentVisibility === "private");
  } else {
    if (!selectedExistingRepo) {
      repoSelectStatus.textContent = "Please select a repo.";
      repoSelectStatus.className = "repo-status error";
      return;
    }
    repoConfirmBtn.disabled = true;
    repoSelectStatus.textContent = "Connecting repository...";
    repoSelectStatus.className = "repo-status";

    await chrome.storage.local.set({ repoName: selectedExistingRepo });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    init();
  }
});

async function createNewRepo(token, name, isPrivate) {
  repoConfirmBtn.disabled = true;
  repoSelectStatus.textContent = "Creating repository...";
  repoSelectStatus.className = "repo-status";

  try {
    const response = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        private: isPrivate,
        auto_init: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Repo creation failed:", data);
      const message = data.message === "Repository creation failed."
        ? "That name is already taken. Try another."
        : (data.message || "Couldn't create repo. Try again.");
      repoSelectStatus.textContent = message;
      repoSelectStatus.className = "repo-status error";
      repoConfirmBtn.disabled = false;
      return;
    }

    await chrome.storage.local.set({ repoName: data.name });
    init();
  } catch (error) {
    console.error("Repo creation error:", error);
    repoSelectStatus.textContent = "Something went wrong. Try again.";
    repoSelectStatus.className = "repo-status error";
    repoConfirmBtn.disabled = false;
  }
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

  chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (redirectedTo) => {
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
  });
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
  await chrome.storage.local.remove(["githubToken", "githubUsername", "repoName"]);
  init();
}

connectBtn.addEventListener("click", startGithubAuth);
disconnectBtn.addEventListener("click", disconnectGithub);
init();