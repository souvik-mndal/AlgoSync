const CLIENT_ID = "Ov23lifLLTVFkjurvntP";
const WORKER_URL = "https://cool-mode-3295.algosync-svk.workers.dev";

const statusEl = document.getElementById("github-status");
const connectBtn = document.getElementById("connect-btn");

// Check current login state when popup opens
async function checkGithubStatus() {
  const result = await chrome.storage.local.get(["githubToken", "githubUsername"]);

  if (result.githubToken && result.githubUsername) {
    statusEl.textContent = `✅ Connected as ${result.githubUsername}`;
    statusEl.className = "connected";
    connectBtn.textContent = "Reconnect GitHub";
  } else {
    statusEl.textContent = "Not connected to GitHub";
    statusEl.className = "";
    connectBtn.textContent = "Connect GitHub";
  }
}

// Start the OAuth flow
function startGithubAuth() {
  connectBtn.disabled = true;
  statusEl.textContent = "Opening GitHub login...";
  statusEl.className = "";

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
        statusEl.textContent = "❌ Login failed. Try again.";
        statusEl.className = "error";
        return;
      }

      const url = new URL(redirectedTo);
      const code = url.searchParams.get("code");

      if (!code) {
        statusEl.textContent = "❌ No code received. Try again.";
        statusEl.className = "error";
        return;
      }

      statusEl.textContent = "Verifying with GitHub...";
      await exchangeCodeForToken(code);
    }
  );
}

// Send the code to our Worker, get back a real access token
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
      statusEl.textContent = "❌ Couldn't connect. Try again.";
      statusEl.className = "error";
      return;
    }

    // Fetch the GitHub username using the new token
    const userResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const userData = await userResponse.json();

    await chrome.storage.local.set({
      githubToken: data.access_token,
      githubUsername: userData.login || "GitHub user",
    });

    statusEl.textContent = `✅ Connected as ${userData.login}`;
    statusEl.className = "connected";
    connectBtn.textContent = "Reconnect GitHub";
  } catch (error) {
    console.error("Token exchange error:", error);
    statusEl.textContent = "❌ Something went wrong. Try again.";
    statusEl.className = "error";
  }
}

connectBtn.addEventListener("click", startGithubAuth);
checkGithubStatus();