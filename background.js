console.log("AlgoSync AI: Background service worker running");

const WORKER_URL = "https://cool-mode-3295.algosync-svk.workers.dev";

function notifyTab(tabId, toastState, text, sub) {
  if (!tabId) return; // no tab to notify (shouldn't normally happen, but don't crash if so)
  chrome.tabs.sendMessage(tabId, {
    type: "SHOW_TOAST",
    state: toastState,
    text,
    sub,
  }).catch(() => {
    // Tab might be closed/navigated away — safe to ignore, nothing to show anyway
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "KEEPALIVE_PING") {
    sendResponse({ alive: true });
    return true;
  }

  // if (message.type === "GENERATE_EXPLANATION") {
  //   generateExplanation(message.data)
  //     .then((explanation) => sendResponse({ success: true, explanation }))
  //     .catch((error) => sendResponse({ success: false, error: error.message }));
  //   return true;
  // }

  if (message.type === "GENERATE_EXPLANATION") {
    const tabId = sender.tab?.id;
    generateExplanation(message.data, tabId)
      .then((explanation) => sendResponse({ success: true, explanation }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // if (message.type === "PUSH_TO_GITHUB") {
  //   pushToGithub(message.data)
  //     .then(() => sendResponse({ success: true }))
  //     .catch((error) => sendResponse({ success: false, error: error.message }));
  //   return true;
  // }
  if (message.type === "PUSH_TO_GITHUB") {
    pushToGithub(message.data)
      .then(() => sendResponse({ success: true, pushStatus: "complete" }))
      .catch((error) => {
        if (error.partial) {
          sendResponse({
            success: false,
            partial: true,
            failedFiles: error.failedFiles,
            error: error.message,
            pushStatus: "partial",
          });
        } else {
          sendResponse({ success: false, error: error.message, pushStatus: "failed" });
        }
      });
    return true;
  }
});

// async function generateExplanation(problemData) {
//   const response = await fetch(WORKER_URL, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(problemData),
//   });

//   const data = await response.json();

//   if (!response.ok) {
//   console.error("Worker error details:", data);
//   const status = (data.error?.status || "").toUpperCase();
//   const msg = (data.error?.message || "").toLowerCase();
//   let friendlyMessage = "Please try again";

//   if (status === "UNAVAILABLE" || msg.includes("high demand")) {
//     friendlyMessage = "Gemini is busy right now";
//   } else if (status === "RESOURCE_EXHAUSTED" || msg.includes("quota")) {
//     friendlyMessage = "Daily AI limit reached";
//   } else if (data.error?.message) {
//     friendlyMessage = data.error.message.slice(0, 60);
//   }
//   throw new Error(friendlyMessage);
// }

//   return data.explanation;
// }


const MODEL_PRIORITY = [
  { id: "gemini-3.6-flash", label: "Gemini 3.6" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Lite" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Lite" },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10); // "2026-08-03"
}

async function generateExplanation(problemData, tabId) {
  const { modelQuotaStatus = {} } = await chrome.storage.local.get("modelQuotaStatus");
  const today = todayKey();

  let lastFriendlyError = "Please try again";

  for (let i = 0; i < MODEL_PRIORITY.length; i++) {
    const { id: modelId, label } = MODEL_PRIORITY[i];
    const status = modelQuotaStatus[modelId];

    // Already known exhausted today — skip without wasting a request.
    if (status?.exhaustedOn === today) continue;

    // If this isn't the first model we're trying, it means an earlier one
    // just failed — let the user know we're switching.
    if (i > 0) {
      notifyTab(tabId, "generating", "Writing notes", `Using backup model (${label})`);
    }

    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...problemData, model: modelId }),
    });

    const data = await response.json();

    if (response.ok) {
      // Success — clear any stale exhausted flag for this model.
      if (modelQuotaStatus[modelId]?.exhaustedOn) {
        delete modelQuotaStatus[modelId].exhaustedOn;
        await chrome.storage.local.set({ modelQuotaStatus });
      }
      return data.explanation;
    }

    console.error(`Worker error details (${modelId}):`, data);
    const status_ = (data.error?.status || "").toUpperCase();
    const msg = (data.error?.message || "").toLowerCase();
    const isQuotaError = status_ === "RESOURCE_EXHAUSTED" || msg.includes("quota");

    // if (isQuotaError) {
    //   modelQuotaStatus[modelId] = { exhaustedOn: today };
    //   await chrome.storage.local.set({ modelQuotaStatus });

    //   const isLastModel = i === MODEL_PRIORITY.length - 1;
    //   if (!isLastModel) {
    //     notifyTab(tabId, "generating", `Daily limit reached for ${label}`, "Switching to backup model");
    //     await new Promise((resolve) => setTimeout(resolve, 1500)); // let the user actually read this before it's overwritten
    //   }
    //   lastFriendlyError = "All models hit today's limit — try again tomorrow";
    //   continue; // try next model
    // }

    if (isQuotaError) {
      modelQuotaStatus[modelId] = { exhaustedOn: today };
      await chrome.storage.local.set({ modelQuotaStatus });

      // TEMP DEBUG — remove once we've confirmed the real error message
      // format via a live quota hit. Lets us check the exact error later
      // even after the service worker restarts and its console is wiped.
      await chrome.storage.local.set({
        lastQuotaError: {
          modelId,
          message: data.error?.message || null,
          status: data.error?.status || null,
          code: data.error?.code || null,
          time: new Date().toISOString(),
        },
      });

      const isLastModel = i === MODEL_PRIORITY.length - 1;
      if (!isLastModel) {
        notifyTab(tabId, "generating", `Daily limit reached for ${label}`, "Switching to backup model");
        await new Promise((resolve) => setTimeout(resolve, 1500)); // let the user actually read this before it's overwritten
      }
      lastFriendlyError = "All models hit today's limit — try again tomorrow";
      continue; // try next model
    }

    // Non-quota error (busy, network, etc.) — don't burn through fallbacks
    // for an unrelated failure, just report it directly.
    if (status_ === "UNAVAILABLE" || msg.includes("high demand")) {
      throw new Error("Gemini is busy right now");
    }
    throw new Error(data.error?.message?.slice(0, 60) || "Please try again");
  }

  // Fell through the whole loop — every model was exhausted today.
  throw new Error(lastFriendlyError);
}




function getFileExtension(language) {
  const map = {
    "c++": "cpp",
    "java": "java",
    "python3": "py",
    "python": "py",
    "javascript": "js",
    "typescript": "ts",
    "c#": "cs",
    "c": "c",
    "go": "go",
    "kotlin": "kt",
    "swift": "swift",
    "rust": "rs",
    "ruby": "rb",
    "php": "php",
    "dart": "dart",
    "scala": "scala",
    "elixir": "ex",
    "erlang": "erl",
    "racket": "rkt",
  };
  return map[(language || "").toLowerCase().trim()] || "txt";
}

function padProblemNumber(num) {
  const n = String(num);
  return n.length === 1 ? `0${n}` : n;
}

function slugifyForFolder(name) {
  return (name || "untitled")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getBeatsColor(beatsPercent) {
  if (!beatsPercent || beatsPercent === "Unknown") return "lightgrey";
  const num = parseFloat(beatsPercent);
  if (isNaN(num)) return "lightgrey";
  if (num >= 80) return "brightgreen";
  if (num >= 60) return "green";
  if (num >= 40) return "yellow";
  if (num >= 20) return "orange";
  return "red";
}

function buildBadge(label, value, color) {
  const text = encodeURIComponent(value).replace(/-/g, "--");
  return `![${label}](https://img.shields.io/badge/${label}-${text}-${color}?style=for-the-badge)`;
}

function buildStatsHeader(runtime, runtimeBeats, memory, memoryBeats) {
  const runtimeBadge = buildBadge("Runtime", `${runtime} (beats ${runtimeBeats})`, getBeatsColor(runtimeBeats));
  const memoryBadge = buildBadge("Memory", `${memory} (beats ${memoryBeats})`, getBeatsColor(memoryBeats));
  return `${runtimeBadge}\n${memoryBadge}\n`;
}



function buildProblemMd(data) {
  const lines = [`# ${data.problemNumber}. ${data.problemName}`, ""];
  lines.push(`**Difficulty:** ${data.difficulty || "Unknown"}`);
  lines.push(`**Topics:** ${(data.tags || []).join(", ") || "N/A"}`);
  lines.push("");
  lines.push("## Description");
  lines.push(data.description || "N/A");
  lines.push("");

  if (data.examples && data.examples.length) {
    lines.push("## Examples");
    data.examples.forEach((ex, i) => {
      lines.push(`**Example ${i + 1}:**`);
      lines.push("```");
      lines.push(ex);
      lines.push("```");
      lines.push("");
    });
  }

  if (data.constraints && data.constraints.length) {
    lines.push("## Constraints");
    data.constraints.forEach((c) => lines.push(`- ${c}`));
    lines.push("");
  }

  if (data.followUp) {
    lines.push(data.followUp);
  }

  return lines.join("\n").trim() + "\n";
}

function buildApproachMd(data) {
  const stats = buildStatsHeader(data.runtime, data.runtimeBeats, data.memory, data.memoryBeats);
  return `${stats}\n---\n\n${data.explanation || "No explanation available."}\n`;
}




// async function getFileSha(token, owner, repo, path) {
//   try {
//     const response = await fetch(
//       `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
//       { headers: { Authorization: `Bearer ${token}` } }
//     );
//     if (response.status === 404) return null; // doesn't exist yet
//     const data = await response.json();
//     return data.sha || null;
//   } catch (error) {
//     console.error("Failed to check file existence:", error);
//     return null;
//   }
// }


async function getFileSha(token, owner, repo, path) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.status === 404) return { sha: null, confirmed: true }; // genuinely doesn't exist yet
    if (!response.ok) {
      // Rate limit, 5xx, auth hiccup — we couldn't actually check.
      throw new Error(`Unexpected status ${response.status} while checking ${path}`);
    }
    const data = await response.json();
    return { sha: data.sha || null, confirmed: true };
  } catch (error) {
    console.error(`Couldn't verify existing sha for ${path}:`, error.message);
    // Network failure or unexpected status — we genuinely don't know.
    // Don't guess; let the caller decide how to handle uncertainty.
    return { sha: null, confirmed: false };
  }
}

function toBase64Unicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

// async function putFile(token, owner, repo, path, content, commitMessage) {
//   const sha = await getFileSha(token, owner, repo, path);

//   const body = {
//     message: commitMessage,
//     content: toBase64Unicode(content),
//   };
//   if (sha) body.sha = sha;

async function putFile(token, owner, repo, path, content, commitMessage) {
  const { sha, confirmed } = await getFileSha(token, owner, repo, path);

  if (!confirmed) {
    // We couldn't determine whether this file already exists — pushing
    // blind here risks either a rejected PUT (safe but confusing) or,
    // worse, silently overwriting something we shouldn't have. Fail
    // loud and let the existing partial-push retry logic handle it
    // on the next submit, instead of guessing.
    throw new Error(`Couldn't verify file state for ${path} — skipping to avoid an unsafe write`);
  }

  const body = {
    message: commitMessage,
    content: toBase64Unicode(content),
  };
  if (sha) body.sha = sha;

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    console.error(`Failed to push ${path}:`, data);
    throw new Error(data.message || `Failed to push ${path}`);
  }
  return data;
}




// async function pushToGithub(submissionData) {
//   const { githubToken, githubUsername, repoName } = await chrome.storage.local.get([
//     "githubToken",
//     "githubUsername",
//     "repoName",
//   ]);

//   if (!githubToken || !githubUsername || !repoName) {
//     throw new Error("GitHub not fully connected");
//   }

//   const folderName = `${padProblemNumber(submissionData.problemNumber)}-${slugifyForFolder(submissionData.problemName)}`;
//   const ext = getFileExtension(submissionData.language);
//   const isUpdate = submissionData._isUpdate; // passed in from caller

//   const commitVerb = isUpdate ? "Update" : "Add";
//   const commitMsg = `${commitVerb} solution: ${submissionData.problemName}`;

//   await putFile(
//     githubToken, githubUsername, repoName,
//     `${folderName}/problem.md`,
//     buildProblemMd(submissionData),
//     commitMsg
//   );

//   await putFile(
//     githubToken, githubUsername, repoName,
//     `${folderName}/approach.md`,
//     buildApproachMd(submissionData),
//     commitMsg
//   );

//   await putFile(
//     githubToken, githubUsername, repoName,
//     `${folderName}/solution.${ext}`,
//     submissionData.code,
//     commitMsg
//   );
// }


async function pushToGithub(submissionData) {
  const { githubToken, githubUsername, repoName } = await chrome.storage.local.get([
    "githubToken",
    "githubUsername",
    "repoName",
  ]);

  if (!githubToken || !githubUsername || !repoName) {
    throw new Error("GitHub not fully connected");
  }

  const folderName = `${padProblemNumber(submissionData.problemNumber)}-${slugifyForFolder(submissionData.problemName)}`;
  const ext = getFileExtension(submissionData.language);
  const isUpdate = submissionData._isUpdate; // passed in from caller

  const commitVerb = isUpdate ? "Update" : "Add";
  const commitMsg = `${commitVerb} solution: ${submissionData.problemName}`;

  const files = [
    { path: `${folderName}/problem.md`, content: buildProblemMd(submissionData) },
    { path: `${folderName}/approach.md`, content: buildApproachMd(submissionData) },
    { path: `${folderName}/solution.${ext}`, content: submissionData.code },
  ];

  const failed = [];

  for (const file of files) {
    try {
      await putFile(githubToken, githubUsername, repoName, file.path, file.content, commitMsg);
    } catch (error) {
      console.error(`Push failed for ${file.path}:`, error.message);
      failed.push(file.path);
    }
  }

  if (failed.length > 0) {
    // Some files pushed, some didn't — caller needs to know this isn't a clean success.
    const err = new Error(`Partial push — failed: ${failed.join(", ")}`);
    err.partial = true;
    err.failedFiles = failed;
    throw err;
  }
}