const CLIENT_ID = "Ov23lifLLTVFkjurvntP";
const WORKER_URL = "https://cool-mode-3295.algosync-svk.workers.dev";
const RING_CIRCUMFERENCE = 2 * Math.PI * 62;
const RING_GAP = 6;

// Views
const viewDisconnected = document.getElementById("view-disconnected");
const viewConnected = document.getElementById("view-connected");
const viewRepoSelect = document.getElementById("view-repo-select");
const viewEmpty = document.getElementById("view-empty");
const viewStats = document.getElementById("view-stats");
const viewRepoMissing = document.getElementById("view-repo-missing");
const reconnectRepoBtn = document.getElementById("reconnect-repo-btn");

// Connect elements
const connectBtn = document.getElementById("connect-btn");
const btnText = document.getElementById("btn-text");
const statusText = document.getElementById("status-text");
const disconnectBtn = document.getElementById("disconnect-btn");
const backfillStartBtn = document.getElementById("backfill-start-btn");
const backfillStartBtnEmpty = document.getElementById("backfill-start-btn-empty");
const viewBackfillPicker = document.getElementById("view-backfill-picker");
const backfillPickerLoading = document.getElementById("backfill-picker-loading");
const backfillPickerContent = document.getElementById("backfill-picker-content");
const backfillPickerError = document.getElementById("backfill-picker-error");
const backfillPickerErrorText = document.getElementById("backfill-picker-error-text");
const backfillErrorBackBtn = document.getElementById("backfill-error-back-btn");
const backfillFoundCount = document.getElementById("backfill-found-count");
const backfillCountOptions = document.getElementById("backfill-count-options");
const backfillConfirmBtn = document.getElementById("backfill-confirm-btn");
const backfillConfirmBtnText = document.getElementById("backfill-confirm-btn-text");
const backfillCancelBtn = document.getElementById("backfill-cancel-btn");

const viewBackfillProgress = document.getElementById("view-backfill-progress");
const backfillProgressCurrentName = document.getElementById("backfill-progress-current-name");
const backfillProgressSub = document.getElementById("backfill-progress-sub");
const backfillProgressFill = document.getElementById("backfill-progress-fill");
const backfillProgressDone = document.getElementById("backfill-progress-done");
const backfillProgressFailed = document.getElementById("backfill-progress-failed");
const backfillProgressCancelBtn = document.getElementById("backfill-progress-cancel-btn");
let backfillPollInterval = null;

const viewBackfillSummary = document.getElementById("view-backfill-summary");
const backfillSummaryHeadline = document.getElementById("backfill-summary-headline");
const backfillSummarySubtext = document.getElementById("backfill-summary-subtext");
const backfillSummaryFailedList = document.getElementById("backfill-summary-failed-list");
const backfillSummaryRetryBtn = document.getElementById("backfill-summary-retry-btn");
const backfillSummaryRetryBtnText = document.getElementById("backfill-summary-retry-btn-text");
const backfillSummaryDoneBtn = document.getElementById("backfill-summary-done-btn");

let backfillNewProblems = [];
let backfillSelectedCount = null;
const accountName = document.getElementById("account-name");
const recentList = document.getElementById("recent-list");

// Repo selection elements
const repoSelectAccountName = document.getElementById("repo-select-account-name");

// API key elements
const viewApiKey = document.getElementById("view-api-key");
const apiKeyInvalidOverlay = document.getElementById("api-key-invalid-overlay");
const apiKeyInvalidBtn = document.getElementById("api-key-invalid-btn");
const apiKeyAccountName = document.getElementById("api-key-account-name");
const apiKeyInput = document.getElementById("api-key-input");
const apiKeyToggleVisibility = document.getElementById("api-key-toggle-visibility");
const eyeIconShow = document.getElementById("eye-icon-show");
const eyeIconHide = document.getElementById("eye-icon-hide");
const apiKeyError = document.getElementById("api-key-error");
const apiKeyConfirmBtn = document.getElementById("api-key-confirm-btn");
const apiKeyConfirmBtnText = document.getElementById("api-key-confirm-btn-text");
const apiKeyStatus = document.getElementById("api-key-status");
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
const repoConfirmBtnText = document.getElementById("repo-confirm-btn-text");
const repoSelectStatus = document.getElementById("repo-select-status");

let currentMode = "new"; // "new" or "existing"
let currentVisibility = "public";
let fetchedRepos = [];
let selectedExistingRepo = null;


/* =========================================================================
 * API KEY INVALID OVERLAY — button navigates to key-entry screen
 * ========================================================================= */
apiKeyInvalidBtn.addEventListener("click", async () => {
  const { githubUsername } = await chrome.storage.local.get("githubUsername");
  apiKeyAccountName.textContent = githubUsername;
  apiKeyError.textContent = "";
  apiKeyStatus.textContent = "";
  apiKeyStatus.className = "repo-status";
  apiKeyInput.value = "";
  apiKeyConfirmBtn.disabled = false;
  apiKeyConfirmBtnText.textContent = "Save & Continue";
  updateApiKeyButtonState();
  showTopView(viewApiKey);
});


/* =========================================================================
 * API KEY — SHOW/HIDE TOGGLE
 * ========================================================================= */
function updateApiKeyButtonState() {
  if (!apiKeyInput.value.trim()) {
    apiKeyConfirmBtn.classList.add("muted");
  } else {
    apiKeyConfirmBtn.classList.remove("muted");
  }
}

apiKeyInput.addEventListener("input", updateApiKeyButtonState);

apiKeyToggleVisibility.addEventListener("click", () => {
  const isPassword = apiKeyInput.type === "password";
  apiKeyInput.type = isPassword ? "text" : "password";
  eyeIconShow.style.display = isPassword ? "none" : "block";
  eyeIconHide.style.display = isPassword ? "block" : "none";
});

/* =========================================================================
 * API KEY — CONFIRM (VALIDATE + SAVE)
 * ========================================================================= */
apiKeyConfirmBtn.addEventListener("click", async () => {
  const keyValue = apiKeyInput.value.trim();

  apiKeyError.textContent = "";
  apiKeyStatus.textContent = "";
  apiKeyStatus.className = "repo-status";

  if (!keyValue) {
    apiKeyError.textContent = "Please enter your API key.";
    return;
  }

  const { githubUsername } = await chrome.storage.local.get("githubUsername");

  apiKeyConfirmBtn.disabled = true;
  apiKeyConfirmBtnText.textContent = "Validating...";

  try {
    const response = await fetch(`${WORKER_URL}/validate-gemini-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: keyValue, userId: githubUsername }),
    });

    const data = await response.json();

    if (!data.valid) {
      apiKeyInput.value = "";
      apiKeyError.textContent = data.reason || "That doesn't look like a valid key — check it and try again.";
      apiKeyConfirmBtn.disabled = false;
      apiKeyConfirmBtnText.textContent = "Save & Continue";
      return;
    }

    await AlgoSyncKeyVault.saveApiKey(githubUsername, keyValue);
    await chrome.storage.local.set({ apiKeyInvalid: false });

    apiKeyStatus.textContent = "Key saved!";
    apiKeyStatus.className = "repo-status";
    apiKeyConfirmBtnText.textContent = "Saved";

    await new Promise((resolve) => setTimeout(resolve, 1200));
    init();
  } catch (error) {
    console.error("API key validation error:", error);
    apiKeyError.textContent = "Couldn't check your key right now — try again.";
    apiKeyConfirmBtn.disabled = false;
    apiKeyConfirmBtnText.textContent = "Save & Continue";
  }
});

/* =========================================================================
 * VIEW SWITCHING
 * ========================================================================= */
function showTopView(view) {
  [viewDisconnected, viewConnected, viewRepoSelect, viewApiKey, viewBackfillPicker, viewBackfillProgress, viewBackfillSummary].forEach((v) => v.classList.remove("active"));
  view.classList.add("active");
}

function showSubView(view) {
  [viewEmpty, viewStats, viewRepoMissing].forEach((v) => v.classList.remove("active"));
  view.classList.add("active");
}

/* =========================================================================
 * MAIN ENTRY
 * ========================================================================= */
// async function init() {
//   const result = await chrome.storage.local.get([
//     "githubToken",
//     "githubUsername",
//     "repoName",
//     "submissions",
//   ]);

//   if (!result.githubToken || !result.githubUsername) {
//     showTopView(viewDisconnected);
//     return;
//   }

//   if (!result.repoName) {
//   repoSelectAccountName.textContent = result.githubUsername;
//   repoSelectStatus.textContent = "";
//   repoSelectStatus.className = "repo-status";
//   repoConfirmBtn.disabled = false;
//   showTopView(viewRepoSelect);
//   loadExistingRepos(result.githubToken);
//   return;
// }

//   accountName.textContent = `${result.githubUsername} · ${result.repoName}`;
//   showTopView(viewConnected);

//   const submissions = result.submissions || {};
//   const entries = Object.values(submissions);

//   if (entries.length === 0) {
//     showSubView(viewEmpty);
//     return;
//   }

//   renderStats(entries);
//   showSubView(viewStats);
// }

async function init() {
  // If a batch is genuinely still running, jump straight to the progress
  // screen and resume polling instead of resetting to the normal view.
  // Only clear backfillInProgress when it's stale (no active loop) — the
  // loop itself always clears this flag when it finishes, so if it's
  // still true here, background.js is still actively processing.
  const { backfillInProgress, backfillProgress } = await chrome.storage.local.get(["backfillInProgress", "backfillProgress"]);

  if (backfillInProgress && backfillProgress) {
    showTopView(viewBackfillProgress);
    backfillProgressCancelBtn.disabled = false;
    backfillProgressCancelBtn.textContent = "Cancel import";
    startBackfillProgressPolling();
    return;
  }

  // No batch running — safe to clear any stale flag left over from a
  // crash or interrupted session.
  await chrome.storage.local.set({ backfillInProgress: false });

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

  const hasKey = await AlgoSyncKeyVault.hasApiKey(result.githubUsername);
  if (!hasKey) {
    apiKeyAccountName.textContent = result.githubUsername;
    apiKeyError.textContent = "";
    apiKeyStatus.textContent = "";
    apiKeyStatus.className = "repo-status";
    apiKeyInput.value = "";
    apiKeyConfirmBtn.disabled = false;
    apiKeyConfirmBtnText.textContent = "Save & Continue";
    updateApiKeyButtonState();
    showTopView(viewApiKey);
    return;
  }

  accountName.textContent = `${result.githubUsername} · ${result.repoName}`;
  showTopView(viewConnected);

const repoCheck = await verifyRepoExists(result.githubToken, result.githubUsername, result.repoName);

  if (repoCheck === "missing") {
    // Confirmed via GitHub API that the repo genuinely doesn't exist (e.g. 404).
    // Only wipe the repo link here — submissions are your solve history and
    // should survive even if the repo itself was deleted/renamed.
    await chrome.storage.local.remove(["repoName"]);
    showSubView(viewRepoMissing);
    return;
  }
  // repoCheck === "exists" or "unknown" (network error) — proceed normally.
  // An "unknown" result means we couldn't verify, not that the repo is gone,
  // so we don't punish the user for a flaky connection.

  const submissions = result.submissions || {};
  const entries = Object.values(submissions);

  if (entries.length === 0) {
    showSubView(viewEmpty);
    return;
  }

  renderStats(entries);
  showSubView(viewStats);

  const { apiKeyInvalid } = await chrome.storage.local.get("apiKeyInvalid");
  apiKeyInvalidOverlay.classList.toggle("active", !!apiKeyInvalid);
}

// async function verifyRepoExists(token, owner, repoName) {
//   try {
//     const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
//       headers: { Authorization: `Bearer ${token}` },
//     });
//     return response.ok;
//   } catch (error) {
//     console.error("Repo verification failed:", error);
//     return true;
//   }
// }


async function verifyRepoExists(token, owner, repoName) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) return "missing";
    if (response.ok) return "exists";
    // Any other status (rate limit, 5xx, auth hiccup) — treat as unknown,
    // not a confirmed deletion.
    return "unknown";
  } catch (error) {
    console.error("Repo verification failed:", error);
    return "unknown";
  }
}

/* =========================================================================
 * STATS RENDERING (unchanged from before)
 * ========================================================================= */
function renderStats(entries) {
  const total = entries.length;
  const totalEl = document.getElementById("total-solved");
  totalEl.textContent = total;

  const digits = String(total).length;
  const sizeMap = { 1: 40, 2: 40, 3: 32, 4: 24 };
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
    timeSpan.innerHTML = `<span>${timeAgo(entry.timestamp)}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

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
  repoConfirmBtnText.textContent = "Create & Connect";
  repoSelectStatus.textContent = "";
  repoConfirmBtn.classList.remove("muted");
}

function switchToExistingMode() {
  currentMode = "existing";
  tabExisting.classList.add("active");
  tabNew.classList.remove("active");
  newRepoMode.style.display = "none";
  existingRepoMode.style.display = "block";
  repoConfirmBtnText.textContent = "Connect Repo";
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
  repoListEl.innerHTML = '<div class="repo-list-empty">Loading repos...</div>';
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
    repoListEl.innerHTML = '<div class="repo-list-empty">Couldn\'t load repos. Try again.</div>';
  }
}

function renderRepoList(repos) {
  repoListEl.innerHTML = "";

  if (repos.length === 0) {
    const empty = document.createElement("div");
    empty.className = "repo-list-empty";
    empty.textContent = fetchedRepos.length === 0
      ? "No repos exist"
      : "No repo found";
    repoListEl.appendChild(empty);
    return;
  }

  repos.forEach((repo) => {
    const item = document.createElement("div");
    item.className = "repo-list-item";
    if (selectedExistingRepo === repo.name) item.classList.add("selected");

    const nameSpan = document.createElement("span");
    nameSpan.textContent = repo.name;

    const visSpan = document.createElement("span");
const icon = repo.private
  ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`
  : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
visSpan.innerHTML = `${icon}<span>${repo.private ? "Private" : "Public"}</span>`;
visSpan.className = repo.private ? "repo-visibility-tag private" : "repo-visibility-tag";


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
    repoConfirmBtnText.textContent = "Connecting...";
    repoSelectStatus.textContent = "Connecting repository...";
    repoSelectStatus.className = "repo-status";

    await chrome.storage.local.set({ repoName: selectedExistingRepo });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    init();
  }
});

async function createNewRepo(token, name, isPrivate) {
  repoConfirmBtn.disabled = true;
  repoConfirmBtnText.textContent = "Creating...";
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
      repoConfirmBtnText.textContent = "Create & Connect";
      return;
    }

    await chrome.storage.local.set({ repoName: data.name });
    init();
  } catch (error) {
    console.error("Repo creation error:", error);
    repoSelectStatus.textContent = "Something went wrong. Try again.";
    repoSelectStatus.className = "repo-status error";
    repoConfirmBtn.disabled = false;
    repoConfirmBtnText.textContent = "Create & Connect";
  }
}

/* =========================================================================
 * OAUTH FLOW
 * ========================================================================= */
// function startGithubAuth() {
//   connectBtn.disabled = true;
//   btnText.textContent = "Connecting to GitHub";
//   statusText.textContent = "Opening GitHub login...";
//   statusText.className = "";

//   const redirectUri = chrome.identity.getRedirectURL();
//   const authUrl =
//     `https://github.com/login/oauth/authorize` +
//     `?client_id=${CLIENT_ID}` +
//     `&redirect_uri=${encodeURIComponent(redirectUri)}` +
//     `&scope=repo`;

//   chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (redirectedTo) => {
//     connectBtn.disabled = false;
//     btnText.textContent = "Connect GitHub";
//     if (chrome.runtime.lastError || !redirectedTo) {
//       console.error("GitHub auth failed:", chrome.runtime.lastError);
//       statusText.textContent = "Login failed. Try again.";
//       statusText.className = "error";
//       return;
//     }

//     const url = new URL(redirectedTo);
//     const code = url.searchParams.get("code");

//     if (!code) {
//       statusText.textContent = "No code received. Try again.";
//       statusText.className = "error";
//       return;
//     }

//     statusText.textContent = "Verifying with GitHub...";
//     await exchangeCodeForToken(code);
//   });
// }
function startGithubAuth() {
  connectBtn.disabled = true;
  btnText.textContent = "Connecting to GitHub";
  statusText.textContent = "Opening GitHub login...";
  statusText.className = "";

  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=repo`;

  chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (redirectedTo) => {
    if (chrome.runtime.lastError || !redirectedTo) {
      console.error("GitHub auth failed:", chrome.runtime.lastError);
      connectBtn.disabled = false;
      btnText.textContent = "Connect GitHub";
      statusText.textContent = "Login failed. Try again.";
      statusText.className = "error";
      return;
    }

    const url = new URL(redirectedTo);
    const code = url.searchParams.get("code");

    if (!code) {
      connectBtn.disabled = false;
      btnText.textContent = "Connect GitHub";
      statusText.textContent = "No code received. Try again.";
      statusText.className = "error";
      return;
    }

    statusText.textContent = "Verifying with GitHub...";
    btnText.textContent = "Verifying...";
    await exchangeCodeForToken(code);
  });
}

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
      connectBtn.disabled = false;
      btnText.textContent = "Connect GitHub";
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
    connectBtn.disabled = false;
    btnText.textContent = "Connect GitHub";
    statusText.textContent = "Something went wrong. Try again.";
    statusText.className = "error";
  }
}
/* =========================================================================
 * DISCONNECT
 * ========================================================================= */
// async function disconnectGithub() {
//   await chrome.storage.local.remove(["githubToken", "githubUsername", "repoName"]);
//   init();
// }

// async function disconnectGithub() {
//   await chrome.storage.local.remove(["githubToken", "githubUsername", "repoName"]);
//   connectBtn.disabled = false;
//   btnText.textContent = "Connect GitHub";
//   statusText.textContent = "";
//   repoConfirmBtn.disabled = false;
//   repoConfirmBtnText.textContent = currentMode === "existing" ? "Connect Repo" : "Create & Connect";
//   repoSelectStatus.textContent = "";
//   repoSelectStatus.className = "repo-status";
//   init();
// }

async function disconnectGithub() {
  await chrome.storage.local.remove(["githubToken", "githubUsername", "repoName"]);
  connectBtn.disabled = false;
  btnText.textContent = "Connect GitHub";
  statusText.textContent = "";
  selectedExistingRepo = null;
  fetchedRepos = [];
  currentVisibility = "public";
  visPublic.classList.add("selected");
  visPrivate.classList.remove("selected");
  repoConfirmBtn.disabled = false;
  repoConfirmBtnText.textContent = "Create & Connect";
  repoSelectStatus.textContent = "";
  repoSelectStatus.className = "repo-status";
  switchToNewMode();
  repoSearchInput.value = "";
  init();
}

/* =========================================================================
 * BACKFILL — picker screen
 * ========================================================================= */

function resetBackfillPickerView() {
  backfillPickerLoading.style.display = "block";
  backfillPickerContent.style.display = "none";
  backfillPickerError.style.display = "none";
  backfillSelectedCount = null;

  // Reset the confirm button's visual state too — it's not recreated
  // between opens, so without this it kept showing the previous
  // selection ("Import 10") even though backfillSelectedCount was
  // correctly cleared underneath.
  backfillConfirmBtn.classList.add("muted");
  backfillConfirmBtn.style.display = "flex";
  backfillConfirmBtnText.textContent = "Select a number";
}

async function handleBackfillStartClick() {
  showTopView(viewBackfillPicker);
  resetBackfillPickerView();

  chrome.runtime.sendMessage({ type: "BACKFILL_FETCH_LIST" }, (response) => {
    if (!response || !response.success) {
      backfillPickerLoading.style.display = "none";
      backfillPickerError.style.display = "block";
      backfillPickerErrorText.textContent = response?.error || "Couldn't fetch your LeetCode history. Try again.";
      return;
    }

    backfillNewProblems = response.newProblems || [];
    renderBackfillPicker();
  });
}

backfillStartBtn.addEventListener("click", handleBackfillStartClick);
backfillStartBtnEmpty.addEventListener("click", handleBackfillStartClick);

function renderBackfillPicker() {
  backfillPickerLoading.style.display = "none";
  backfillPickerContent.style.display = "block";

  const total = backfillNewProblems.length;
  backfillFoundCount.textContent = total === 0
    ? "You're all caught up!"
    : `${total} new problem${total === 1 ? "" : "s"} found`;

  backfillCountOptions.innerHTML = "";

  if (total === 0) {
    backfillConfirmBtn.style.display = "none";
    return;
  }

    const MAX_CAP = 50;
  // Exclude MAX_CAP itself from the step list — the "All/Max" button
  // below already represents that value, so including it here created
  // a visible duplicate (e.g. "50" and "Max (50)" side by side).
  const steps = [10, 20, 30, 40].filter((n) => n < total);
  const cappedTotal = Math.min(total, MAX_CAP);

  steps.forEach((n) => {
    const btn = createCountOptionButton(n, `${n}`);
    backfillCountOptions.appendChild(btn);
  });

  // Always offer "All" (capped at MAX_CAP) as the final option, labeled
  // with however many that actually is.
  const allLabel = cappedTotal < total ? `Max (${MAX_CAP})` : `All (${total})`;
  const allBtn = createCountOptionButton(cappedTotal, allLabel);
  backfillCountOptions.appendChild(allBtn);
}

function createCountOptionButton(count, label) {
  const btn = document.createElement("div");
  btn.className = "visibility-option";
  btn.style.flex = "0 0 auto";
  btn.style.padding = "10px 16px";
  btn.textContent = label;
  btn.addEventListener("click", () => {
    document.querySelectorAll("#backfill-count-options .visibility-option").forEach((el) => el.classList.remove("selected"));
    btn.classList.add("selected");
    backfillSelectedCount = count;
    backfillConfirmBtn.classList.remove("muted");
    backfillConfirmBtnText.textContent = `Import ${count}`;
  });
  return btn;
}

backfillCancelBtn.addEventListener("click", () => {
  init();
});

backfillErrorBackBtn.addEventListener("click", () => {
  init();
});

function startBackfillProgressPolling() {
  updateBackfillProgressUI();
  backfillPollInterval = setInterval(updateBackfillProgressUI, 1000);
}

function stopBackfillProgressPolling() {
  if (backfillPollInterval) {
    clearInterval(backfillPollInterval);
    backfillPollInterval = null;
  }
}

async function updateBackfillProgressUI() {
  const { backfillProgress, backfillInProgress } = await chrome.storage.local.get(["backfillProgress", "backfillInProgress"]);

  if (!backfillProgress) return;

  const { current, total, currentProblem, done, failed } = backfillProgress;

  backfillProgressCurrentName.textContent = currentProblem || "Working...";
  backfillProgressSub.textContent = `Importing ${current} of ${total}`;

  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  backfillProgressFill.style.width = `${percent}%`;

  backfillProgressDone.textContent = done ?? 0;
  backfillProgressFailed.textContent = failed ?? 0;

    if (!backfillInProgress && current >= total) {
    stopBackfillProgressPolling();

    setTimeout(async () => {
      const { backfillLastRunSummary } = await chrome.storage.local.get("backfillLastRunSummary");

      if (backfillLastRunSummary && backfillLastRunSummary.failed > 0) {
        renderBackfillSummary(backfillLastRunSummary);
        showTopView(viewBackfillSummary);
      } else {
        init();
      }
    }, 1200);
  }
}

function renderBackfillSummary(summary) {
  const { total, done, failed, failedItems } = summary;

  backfillSummaryHeadline.textContent = `${done} of ${total} imported`;
    backfillSummarySubtext.textContent = failed === 1 ? "1 problem needs a retry" : `${failed} problems need a retry`;
  backfillSummaryRetryBtnText.textContent = `Retry failed (${failed})`;

  backfillSummaryFailedList.innerHTML = "";
  failedItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "summary-failed-row";

    const titleLine = document.createElement("div");
    titleLine.className = "summary-failed-title";
    titleLine.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/><circle cx="12" cy="12" r="10"/></svg>
      <span>${item.title} (${item.langSlug})</span>
    `;

    const errorLine = document.createElement("div");
    errorLine.className = "summary-failed-error";
    errorLine.textContent = item.error;

    row.appendChild(titleLine);
    row.appendChild(errorLine);

    if (item.titleSlug) {
      const link = document.createElement("a");
      link.className = "summary-failed-link";
      link.href = `https://leetcode.com/problems/${item.titleSlug}/`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "View on LeetCode →";
      row.appendChild(link);
    }

    backfillSummaryFailedList.appendChild(row);
  });
}

backfillProgressCancelBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({ backfillCancelRequested: true });
  backfillProgressCancelBtn.disabled = true;
  backfillProgressCancelBtn.textContent = "Cancelling...";
});

backfillSummaryDoneBtn.addEventListener("click", () => {
  init();
});

backfillSummaryRetryBtn.addEventListener("click", async () => {
  const { backfillLastRunSummary } = await chrome.storage.local.get("backfillLastRunSummary");
  const retryQueue = (backfillLastRunSummary?.failedItems || []).map((item) => ({
    id: item.id,
    titleSlug: item.titleSlug,
    title: item.title,
    langSlug: item.langSlug,
  }));

  if (retryQueue.length === 0) {
    init();
    return;
  }

  await chrome.storage.local.set({
    backfillCancelRequested: false,
    backfillProgress: { current: 0, total: retryQueue.length, currentProblem: "Starting...", done: 0, failed: 0 },
  });

  chrome.runtime.sendMessage({ type: "BACKFILL_START", queue: retryQueue });

  backfillProgressCancelBtn.disabled = false;
  backfillProgressCancelBtn.textContent = "Cancel import";
  showTopView(viewBackfillProgress);
  startBackfillProgressPolling();
});

backfillConfirmBtn.addEventListener("click", async () => {
  if (!backfillSelectedCount) return;

  const queue = backfillNewProblems.slice(0, backfillSelectedCount);

  await chrome.storage.local.set({
    backfillCancelRequested: false,
    backfillProgress: { current: 0, total: queue.length, currentProblem: "Starting...", done: 0, failed: 0 },
  });

  chrome.runtime.sendMessage({ type: "BACKFILL_START", queue });

  backfillProgressCancelBtn.disabled = false;
  backfillProgressCancelBtn.textContent = "Cancel import";
  showTopView(viewBackfillProgress);
  startBackfillProgressPolling();
});

connectBtn.addEventListener("click", startGithubAuth);
disconnectBtn.addEventListener("click", disconnectGithub);
reconnectRepoBtn.addEventListener("click", async () => {
  // Repo is confirmed gone — wipe local solve history since it's tied to
  // the dead repo, before taking the user to pick/connect a new one.
  await chrome.storage.local.remove(["submissions"]);
  const { githubToken, githubUsername } = await chrome.storage.local.get(["githubToken", "githubUsername"]);
repoSelectAccountName.textContent = githubUsername;
  repoSelectStatus.textContent = "";
  repoSelectStatus.className = "repo-status";
  repoConfirmBtn.disabled = false;
  showTopView(viewRepoSelect);
  loadExistingRepos(githubToken);
});
init();