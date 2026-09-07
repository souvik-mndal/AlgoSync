importScripts("keyVault.js");
console.log("AlgoSync AI: Background service worker running");

const WORKER_URL = "https://cool-mode-3295.algosync-svk.workers.dev";

// Safety net: if the service worker restarts (browser restart, extension
// reload, or MV3 idle-kill) while backfillInProgress was left "true" from
// a crashed/interrupted batch, clear it so live submissions never stay
// permanently blocked. Once the real backfill queue exists, this should
// be refined to check the queue's actual state instead of clearing blindly.
chrome.storage.local.get("backfillInProgress", ({ backfillInProgress }) => {
  if (backfillInProgress) {
    console.warn("⚠️ backfillInProgress was stuck 'true' on startup — clearing it.");
    chrome.storage.local.set({ backfillInProgress: false });
  }
});

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

    if (message.type === "BACKFILL_FETCH_SUBMISSION") {
    fetchSubmissionFromAPI(message.submissionId, message.titleSlug)
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

    if (message.type === "BACKFILL_FETCH_LIST") {
    backfillFetchList()
      .then((newProblems) => sendResponse({ success: true, newProblems }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === "BACKFILL_START") {
    // Fire-and-forget: this can run for minutes, so we don't make the
    // popup wait on a response. Progress is reported via
    // chrome.storage.local.backfillProgress, which the popup polls.
    backfillRunImportLoop(message.queue);
    sendResponse({ started: true });
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
  const { githubUsername } = await chrome.storage.local.get("githubUsername");
  const userApiKey = await AlgoSyncKeyVault.getApiKey(githubUsername);

  if (!userApiKey) {
    notifyTab(tabId, "failed", "Insert your key to generate explanations");
    throw new Error("No Gemini API key saved");
  }

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
      body: JSON.stringify({ ...problemData, model: modelId, userApiKey }),
    });

    const data = await response.json();

    if (response.ok) {
      // Success — clear any stale exhausted flag for this model.
      if (modelQuotaStatus[modelId]?.exhaustedOn) {
        delete modelQuotaStatus[modelId].exhaustedOn;
        await chrome.storage.local.set({ modelQuotaStatus });
      }

      // Self-heal: if the key was previously flagged broken but this call
      // just succeeded (e.g. user fixed it on Google's side directly,
      // without ever opening our popup), clear the flag silently now.
      const { apiKeyInvalid } = await chrome.storage.local.get("apiKeyInvalid");
      if (apiKeyInvalid) {
        await chrome.storage.local.set({ apiKeyInvalid: false });
      }

      return data.explanation;
    }

    console.error(`Worker error details (${modelId}):`, data);
    const status_ = (data.error?.error?.status || data.error?.status || "").toUpperCase();
    const msg = (data.error?.error?.message || data.error?.message || "").toLowerCase();
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
      // await chrome.storage.local.set({
      //   lastQuotaError: {
      //     modelId,
      //     message: data.error?.message || null,
      //     status: data.error?.status || null,
      //     code: data.error?.code || null,
      //     time: new Date().toISOString(),
      //   },
      // });

      const isLastModel = i === MODEL_PRIORITY.length - 1;
      if (!isLastModel) {
        notifyTab(tabId, "generating", `Daily limit reached for ${label}`, "Switching to backup model");
        await new Promise((resolve) => setTimeout(resolve, 1500)); // let the user actually read this before it's overwritten
      }
      lastFriendlyError = "All models hit today's limit — try again tomorrow";
      continue; // try next model
    }

    // Key itself is broken (revoked/expired/no permission) — distinct from
    // quota or busy errors. Flag it so the popup shows a persistent warning
    // even after this toast disappears.
    const isAuthError = status_ === "UNAUTHENTICATED" || status_ === "PERMISSION_DENIED";
    if (isAuthError) {
      await chrome.storage.local.set({ apiKeyInvalid: true });
      notifyTab(tabId, "failed", "Your Gemini key isn't working", "Update it to keep generating notes");
      throw new Error("Your Gemini key isn't working");
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


/* =========================================================================
 * BACKFILL — fetches a past submission's full data via LeetCode's GraphQL
 * API instead of live DOM scraping. Produces an object shaped identically
 * to content.js's finalData, verified via side-by-side comparison against
 * real live-scraped submissions (all fields matched except a cosmetic
 * memory-display rounding difference, e.g. "138.17 MB" vs "138.2 MB").
 * ========================================================================= */

const GRAPHQL_LANG_TO_DISPLAY = {
  cpp: "C++",
  java: "Java",
  python: "Python",
  python3: "Python3",
  javascript: "JavaScript",
  typescript: "TypeScript",
  csharp: "C#",
  c: "C",
  golang: "Go",
  kotlin: "Kotlin",
  swift: "Swift",
  rust: "Rust",
  ruby: "Ruby",
  php: "PHP",
  dart: "Dart",
  scala: "Scala",
  elixir: "Elixir",
  erlang: "Erlang",
  racket: "Racket",
};

// Same logic as content.js's richText/cleanText/cleanConstraint/
// parseDescriptionContent/buildMarkdown/slugify — duplicated here because
// background.js (service worker) has no access to content.js's DOM-scoped
// functions, which only run inside LeetCode tab pages. Confirmed via
// console testing to work standalone with zero page dependency.
function backfillStripTags(html) {
  if (!html) return "";
  let text = html
    .replace(/<sup>(.*?)<\/sup>/gi, "^$1")
    .replace(/<sub>(.*?)<\/sub>/gi, "_$1")
    .replace(/<[^>]+>/g, "");
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  text = text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  text = text.replace(/\s+([.,;:!?])/g, "$1");
  return text;
}

// BACKFILL-ONLY: extracts <div class="example-block">...</div> sections,
// matching content.js's live DOM parser's example-block handling. Needed
// because backfillParseHtmlContent's main blockRegex only matches <p>,
// <pre>, <ul> — it had no awareness of <div class="example-block">, so
// this-format examples were silently falling into the description text
// instead of being split out. Confirmed via real HTML inspection (Missing
// Number problem) that this is a common LeetCode example markup pattern.
function backfillExtractExamples(html) {
  if (!html) return [];

  const examples = [];
  const blockDivRegex = /<div class="example-block">([\s\S]*?)<\/div>/gi;
  let match;

  while ((match = blockDivRegex.exec(html)) !== null) {
    const inner = match[1];
    const lines = [];

    const pRegex = /<p>([\s\S]*?)<\/p>/gi;
    let pMatch;
    while ((pMatch = pRegex.exec(inner)) !== null) {
      const text = backfillStripTags(pMatch[1]);
      if (text) lines.push(text);
    }

    if (lines.length) examples.push(lines.join("\n"));
  }

  return examples;
}

function backfillParseHtmlContent(html) {
  const examples = [];
  const constraints = [];
  let followUp = null;

  if (!html) return { description: "", examples, constraints, followUp };

  // Pull out <div class="example-block"> examples first (backfill-only
  // path — mirrors content.js's live example-block handling), then strip
  // those blocks + their "Example N:" heading <p> tags out of the HTML so
  // the main block regex below doesn't fold them into the description.
  const blockExamples = backfillExtractExamples(html);
  examples.push(...blockExamples);

  let cleanedHtml = html
    .replace(/<div class="example-block">[\s\S]*?<\/div>/gi, "")
    .replace(/<p><strong class="example">Example \d+:<\/strong><\/p>/gi, "");

  const blockRegex = /<p>([\s\S]*?)<\/p>|<pre>([\s\S]*?)<\/pre>|<ul>([\s\S]*?)<\/ul>/gi;
  const descriptionParts = [];
  let hitConstraints = false;
  let match;

  while ((match = blockRegex.exec(cleanedHtml)) !== null) {
    const [, pContent, preContent, ulContent] = match;

    if (pContent !== undefined) {
      const text = backfillStripTags(pContent);
      if (/^Constraints:?$/i.test(text)) { hitConstraints = true; continue; }
      if (/^follow[- ]?up/i.test(text)) { followUp = text; continue; }
      if (/^Example \d+:?$/i.test(text)) continue;
      if (!text) continue;
      if (!hitConstraints) descriptionParts.push(text);
    } else if (preContent !== undefined) {
      const raw = preContent.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
      const lines = raw.split("\n").map((ln) => ln.replace(/[ \t]+/g, " ").trim()).filter((ln) => ln !== "");
      examples.push(lines.join("\n"));
    } else if (ulContent !== undefined) {
      const liMatches = [...ulContent.matchAll(/<li>([\s\S]*?)<\/li>/gi)];
      liMatches.forEach((liMatch) => {
        const t = backfillStripTags(liMatch[1]);
        if (t) constraints.push(t);
      });
    }
  }

  const description = descriptionParts.join("\n\n").trim();

  if (!followUp) {
    const fullText = backfillStripTags(cleanedHtml);
    const m = fullText.match(/Follow-up:?.*$/i);
    if (m) followUp = m[0].replace(/\s+([.,;:!?)])/g, "$1").trim();
  }

  return { description, examples, constraints, followUp };
}

function backfillSlugify(title) {
  return (title || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function backfillBuildMarkdown(data) {
  const lines = [];
  const title = data.problemName || "Untitled";
  lines.push(`[${title}](https://leetcode.com/problems/${backfillSlugify(title)}/)`);
  lines.push("Solved");
  if (data.difficulty) lines.push(data.difficulty);
  if (data.tags && data.tags.length) { lines.push("Topics"); lines.push("Companies"); lines.push("Hint"); }
  lines.push("");
  if (data.description) { lines.push(data.description); lines.push(""); }
  (data.examples || []).forEach((ex, i) => {
    lines.push(`Example ${i + 1}:`); lines.push(""); lines.push("```"); lines.push(ex); lines.push(""); lines.push("```"); lines.push("");
  });
  if (data.constraints && data.constraints.length) {
    lines.push("Constraints:");
    data.constraints.forEach((c) => lines.push(c.startsWith("`") ? `   * ${c}` : `   * \`${c}\``));
    lines.push("");
  }
  if (data.followUp) lines.push(data.followUp);
  return lines.join("\n").trim() + "\n";
}

// Same lang mapping as getFolderName()/getLanguageSlug() elsewhere —
// keep in sync intentionally so storage keys never disagree.
const BACKFILL_GRAPHQL_LANG_TO_SLUG = {
  cpp: "Cpp",
  java: "Java",
  python: "Python",
  python3: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  csharp: "CSharp",
  c: "C",
  golang: "Go",
  kotlin: "Kotlin",
  swift: "Swift",
  rust: "Rust",
  ruby: "Ruby",
  php: "PHP",
  dart: "Dart",
  scala: "Scala",
  elixir: "Elixir",
  erlang: "Erlang",
  racket: "Racket",
};

async function backfillFetchAllSubmissions() {
  const query = `
    query submissionList($offset: Int!, $limit: Int!, $questionSlug: String) {
      submissionList(offset: $offset, limit: $limit, questionSlug: $questionSlug) {
        hasNext
        submissions {
          id
          title
          titleSlug
          statusDisplay
          lang
          timestamp
        }
      }
    }
  `;

  const all = [];
  let offset = 0;
  const limit = 20;
  let hasNext = true;
  let pageCount = 0;
  const MAX_PAGES = 200;

  while (hasNext && pageCount < MAX_PAGES) {
    const res = await fetch("https://leetcode.com/graphql/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ query, variables: { offset, limit, questionSlug: "" } }),
    });

    const data = await res.json();
    const page = data?.data?.submissionList;

    if (!page) {
      console.error("❌ backfillFetchAllSubmissions: bad response at offset", offset, data?.errors);
      break;
    }

    all.push(...page.submissions);
    hasNext = page.hasNext;
    offset += limit;
    pageCount++;
  }

  return all;
}

function backfillFilterAndDedupe(allSubmissions) {
  const accepted = allSubmissions.filter((s) => s.statusDisplay === "Accepted");

  const seen = new Map();
  for (const sub of accepted) {
    const key = `${sub.titleSlug}|${sub.lang}`;
    if (!seen.has(key)) seen.set(key, sub);
  }

  return Array.from(seen.values());
}

async function backfillFindNewProblems(dedupedCandidates) {
  const { submissions = {} } = await chrome.storage.local.get("submissions");

  const newProblems = [];

  for (const candidate of dedupedCandidates) {
    const langSlug = BACKFILL_GRAPHQL_LANG_TO_SLUG[candidate.lang.toLowerCase()] || candidate.lang;

    const matchedProblem = Object.values(submissions).find((p) => {
      const storedUrl = p.languages?.[langSlug]?.url;
      const storedSlug = storedUrl ? storedUrl.split("/problems/")[1]?.split("/")[0] : null;
      return storedSlug === candidate.titleSlug;
    });

    const pushStatus = matchedProblem?.languages?.[langSlug]?.pushStatus;

    if (pushStatus !== "complete") {
      newProblems.push({ ...candidate, langSlug });
    }
  }

  return newProblems;
}

async function backfillFetchList() {
  const allSubmissions = await backfillFetchAllSubmissions();
  const deduped = backfillFilterAndDedupe(allSubmissions);
  const newProblems = await backfillFindNewProblems(deduped);
  return newProblems;
}

// Runs the full import pipeline (fetch -> explanation -> storage merge ->
// GitHub push) over a queue of candidates, sequentially, with a delay
// between items. Continues past per-item failures rather than aborting
// the whole batch — failures are recorded and reported at the end.
// Progress is written to chrome.storage.local.backfillProgress after
// every item so the popup can poll it live, even after being closed and
// reopened mid-batch. Checks backfillCancelRequested between items so a
// user-requested cancel takes effect after the current item finishes,
// never mid-item (avoids leaving a half-written storage/GitHub state).
async function backfillRunImportLoop(queue, delayMs = 3000) {
  await chrome.storage.local.set({ backfillInProgress: true });

  let done = 0;
  let failed = 0;
  const failedItems = [];

  for (let i = 0; i < queue.length; i++) {
    const { backfillCancelRequested } = await chrome.storage.local.get("backfillCancelRequested");
    if (backfillCancelRequested) {
      console.log("🛑 Backfill cancelled by user — stopping before next item.");
      break;
    }

    const candidate = queue[i];

    await chrome.storage.local.set({
      backfillProgress: { current: i, total: queue.length, currentProblem: candidate.title, done, failed },
    });

    try {
      const submissionId = parseInt(candidate.id, 10);
      const finalData = await fetchSubmissionFromAPI(submissionId, candidate.titleSlug);
      if (!finalData) throw new Error("fetchSubmissionFromAPI returned null");

      const explanation = await generateExplanation(finalData, null);

      const problemNumber = finalData.problemNumber;
      const langSlug = candidate.langSlug;

      const { submissions = {} } = await chrome.storage.local.get("submissions");
      const problem = submissions[problemNumber] || {};

      const {
        code, language, url, timestamp,
        testCasesPassed, runtime, runtimeBeats, memory, memoryBeats,
        ...sharedFields
      } = finalData;

      const mergedProblem = {
        ...problem,
        ...sharedFields,
        problemNumber,
        languages: {
          ...problem.languages,
          [langSlug]: {
            code, language, url, timestamp,
            testCasesPassed, runtime, runtimeBeats, memory, memoryBeats,
            explanation,
            pushStatus: "pending",
          },
        },
      };

      submissions[problemNumber] = mergedProblem;
      await chrome.storage.local.set({ submissions });

      const pushData = { ...mergedProblem, langSlug, _isUpdate: false };
      await pushToGithub(pushData);

      const latest = await chrome.storage.local.get("submissions");
      const subs = latest.submissions || {};
      if (subs[problemNumber]?.languages?.[langSlug]) {
        subs[problemNumber].languages[langSlug].pushStatus = "complete";
        await chrome.storage.local.set({ submissions: subs });
      }

      done++;
      console.log(`✅ [${i + 1}/${queue.length}] Imported: ${candidate.title} (${langSlug})`);
        } catch (error) {
      failed++;
      // Preserve id + titleSlug (not just title/langSlug) so a failed item
      // can be re-queued and re-run through the exact same pipeline later
      // via the "Retry Failed" flow — without these two fields there's no
      // way to re-fetch the problem at all.
      failedItems.push({
        id: candidate.id,
        titleSlug: candidate.titleSlug,
        title: candidate.title,
        langSlug: candidate.langSlug,
        error: error.message,
      });
      console.error(`❌ [${i + 1}/${queue.length}] Failed: ${candidate.title} —`, error.message);
    }

    await chrome.storage.local.set({
      backfillProgress: { current: i + 1, total: queue.length, currentProblem: candidate.title, done, failed },
    });

    if (i < queue.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  await chrome.storage.local.set({
    backfillInProgress: false,
    backfillCancelRequested: false,
    backfillLastRunSummary: { total: queue.length, done, failed, failedItems, finishedAt: new Date().toISOString() },
    // Marks that a summary is waiting to be seen — the popup checks this
    // on every open and keeps showing the summary screen (instead of
    // stats) until the user explicitly clicks Done or Retry.
    backfillSummaryPending: failed > 0,
  });

  console.log(`🎉 Backfill batch finished: ${done} done, ${failed} failed, out of ${queue.length}`);
}

// Fetches a single past submission's full data via GraphQL. Returns an
// object shaped identically to content.js's finalData, ready to pass
// directly into saveSubmission()'s equivalent logic.
async function fetchSubmissionFromAPI(submissionId, titleSlug) {
  const detailQuery = `
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        runtimeDisplay
        runtimePercentile
        memoryDisplay
        memoryPercentile
        code
        lang { name }
        question { questionFrontendId title titleSlug }
        totalCorrect
        totalTestcases
        timestamp
      }
    }
  `;

  const detailRes = await fetch("https://leetcode.com/graphql/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query: detailQuery, variables: { submissionId } }),
  });
  const detailData = await detailRes.json();
  const detail = detailData?.data?.submissionDetails;
  if (!detail) {
    console.error("❌ backfill: submissionDetails failed:", detailData?.errors);
    return null;
  }

  const slug = titleSlug || detail.question.titleSlug;
  const questionQuery = `
    query questionContent($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        difficulty
        content
        topicTags { name }
      }
    }
  `;

  const questionRes = await fetch("https://leetcode.com/graphql/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query: questionQuery, variables: { titleSlug: slug } }),
  });
  const questionData = await questionRes.json();
  const question = questionData?.data?.question;
  if (!question) {
    console.error("❌ backfill: question query failed:", questionData?.errors);
    return null;
  }

    // Service workers have neither `document` nor `DOMParser` — parse the
  // raw HTML with plain string/regex logic instead of a DOM tree.
  const parsed = backfillParseHtmlContent(question.content || "");

  const problemNumber = detail.question.questionFrontendId;
  const problemName = detail.question.title;
  const language = GRAPHQL_LANG_TO_DISPLAY[detail.lang.name.toLowerCase()] || detail.lang.name;

  const problemInfoShape = {
    problemNumber,
    problemName,
    difficulty: question.difficulty,
    tags: question.topicTags.map((t) => t.name),
    description: parsed.description,
    examples: parsed.examples,
    constraints: parsed.constraints,
    followUp: parsed.followUp,
  };

  return {
    ...problemInfoShape,
    markdown: backfillBuildMarkdown(problemInfoShape),
    testCasesPassed: `${detail.totalCorrect}/${detail.totalTestcases}`,
    runtime: detail.runtimeDisplay,
    runtimeBeats: `${detail.runtimePercentile.toFixed(2)}%`,
    memory: detail.memoryDisplay,
    memoryBeats: `${detail.memoryPercentile.toFixed(2)}%`,
    code: detail.code,
    language,
    url: `https://leetcode.com/problems/${slug}/submissions/${submissionId}/`,
    timestamp: new Date(detail.timestamp * 1000).toISOString(),
  };
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

function getFolderName(language) {
  const map = {
    "c++": "Cpp",
    "java": "Java",
    "python3": "Python",
    "python": "Python",
    "javascript": "JavaScript",
    "typescript": "TypeScript",
    "c#": "CSharp",
    "c": "C",
    "go": "Go",
    "kotlin": "Kotlin",
    "swift": "Swift",
    "rust": "Rust",
    "ruby": "Ruby",
    "php": "PHP",
    "dart": "Dart",
    "scala": "Scala",
    "elixir": "Elixir",
    "erlang": "Erlang",
    "racket": "Racket",
  };
  return map[(language || "").toLowerCase().trim()] || "Unknown";
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

//   const files = [
//     { path: `${folderName}/problem.md`, content: buildProblemMd(submissionData) },
//     { path: `${folderName}/approach.md`, content: buildApproachMd(submissionData) },
//     { path: `${folderName}/solution.${ext}`, content: submissionData.code },
//   ];

//   const failed = [];

//   for (const file of files) {
//     try {
//       await putFile(githubToken, githubUsername, repoName, file.path, file.content, commitMsg);
//     } catch (error) {
//       console.error(`Push failed for ${file.path}:`, error.message);
//       failed.push(file.path);
//     }
//   }

//   if (failed.length > 0) {
//     // Some files pushed, some didn't — caller needs to know this isn't a clean success.
//     const err = new Error(`Partial push — failed: ${failed.join(", ")}`);
//     err.partial = true;
//     err.failedFiles = failed;
//     throw err;
//   }
// }


async function problemMdExists(token, owner, repo, path) {
  const { confirmed, sha } = await getFileSha(token, owner, repo, path);
  // If we couldn't confirm (network hiccup), assume it might exist and
  // skip writing rather than risk clobbering it — safer default given
  // problem.md is meant to be write-once.
  if (!confirmed) return true;
  return !!sha;
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
  const langSlug = submissionData.langSlug || getFolderName(submissionData.language);
  const isUpdate = submissionData._isUpdate; // passed in from caller

  // submissionData.languages[langSlug] holds this language's code/stats/
  // explanation — buildProblemMd/buildApproachMd expect those fields at
  // the top level, so we flatten just this one language back out here.
  const langData = submissionData.languages?.[langSlug] || {};
  submissionData = { ...submissionData, ...langData };

  const ext = getFileExtension(submissionData.language);

  const commitVerb = isUpdate ? "Update" : "Add";
  const commitMsg = `${commitVerb} solution: ${submissionData.problemName} (${langSlug})`;

  const problemMdPath = `${folderName}/problem.md`;
  const files = [
    { path: `${folderName}/${langSlug}/approach.md`, content: buildApproachMd(submissionData) },
    { path: `${folderName}/${langSlug}/solution.${ext}`, content: submissionData.code },
  ];

  const failed = [];

  // problem.md is write-once — only push it if it doesn't already exist.
  try {
    const alreadyExists = await problemMdExists(githubToken, githubUsername, repoName, problemMdPath);
    if (!alreadyExists) {
      await putFile(githubToken, githubUsername, repoName, problemMdPath, buildProblemMd(submissionData), commitMsg);
    }
  } catch (error) {
    console.error(`Push failed for ${problemMdPath}:`, error.message);
    failed.push(problemMdPath);
  }

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