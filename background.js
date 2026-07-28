console.log("AlgoSync AI: Background service worker running");

const WORKER_URL = "https://cool-mode-3295.algosync-svk.workers.dev";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GENERATE_EXPLANATION") {
    generateExplanation(message.data)
      .then((explanation) => sendResponse({ success: true, explanation }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === "PUSH_TO_GITHUB") {
    pushToGithub(message.data)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
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
    python: "py", python3: "py", java: "java", cpp: "cpp", c: "c",
    javascript: "js", typescript: "ts", csharp: "cs", go: "go",
    kotlin: "kt", swift: "swift", rust: "rs", ruby: "rb",
    scala: "scala", php: "php", dart: "dart", racket: "rkt",
    erlang: "erl", elixir: "ex",
  };
  return map[(language || "").toLowerCase()] || "txt";
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
  return `![${label}](https://img.shields.io/badge/${label}-${text}-${color})`;
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




async function getFileSha(token, owner, repo, path) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.status === 404) return null; // doesn't exist yet
    const data = await response.json();
    return data.sha || null;
  } catch (error) {
    console.error("Failed to check file existence:", error);
    return null;
  }
}

function toBase64Unicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

async function putFile(token, owner, repo, path, content, commitMessage) {
  const sha = await getFileSha(token, owner, repo, path);

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

  await putFile(
    githubToken, githubUsername, repoName,
    `${folderName}/problem.md`,
    buildProblemMd(submissionData),
    commitMsg
  );

  await putFile(
    githubToken, githubUsername, repoName,
    `${folderName}/approach.md`,
    buildApproachMd(submissionData),
    commitMsg
  );

  await putFile(
    githubToken, githubUsername, repoName,
    `${folderName}/solution.${ext}`,
    submissionData.code,
    commitMsg
  );
}