console.log("AlgoSync AI: Background service worker running");

const WORKER_URL = "https://cool-mode-3295.algosync-svk.workers.dev";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "KEEPALIVE_PING") {
    sendResponse({ alive: true });
    return true;
  }

  if (message.type === "GENERATE_EXPLANATION") {
    generateExplanation(message.data)
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

async function generateExplanation(problemData) {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(problemData),
  });

  const data = await response.json();

  if (!response.ok) {
  console.error("Worker error details:", data);
  const status = (data.error?.status || "").toUpperCase();
  const msg = (data.error?.message || "").toLowerCase();
  let friendlyMessage = "Please try again";

  if (status === "UNAVAILABLE" || msg.includes("high demand")) {
    friendlyMessage = "Gemini is busy right now";
  } else if (status === "RESOURCE_EXHAUSTED" || msg.includes("quota")) {
    friendlyMessage = "Daily AI limit reached";
  } else if (data.error?.message) {
    friendlyMessage = data.error.message.slice(0, 60);
  }
  throw new Error(friendlyMessage);
}

  return data.explanation;
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