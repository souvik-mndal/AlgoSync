// console.log("AlgoSync AI: Waiting for Submit (click or Ctrl+Enter)...");

// let problemInfo = {};

// /* =========================================================================
//  * DESCRIPTION-TAB PARSER (unchanged)
//  * ========================================================================= */

// function richText(node) {
//   let result = "";
//   for (const child of node.childNodes) {
//     if (child.nodeType === Node.TEXT_NODE) {
//       result += child.textContent;
//     } else if (child.nodeType === Node.ELEMENT_NODE) {
//       const tag = child.tagName;
//       if (tag === "SUP") {
//         result += "^" + richText(child);
//       } else if (tag === "SUB") {
//         result += "_" + richText(child);
//       } else {
//         result += richText(child);
//       }
//     }
//   }
//   return result;
// }

// function cleanText(el) {
//   if (!el) return "";
//   let text = richText(el);
//   text = text.replace(/\u00a0/g, " ");
//   text = text.replace(/\s+/g, " ").trim();
//   text = text.replace(/\s+([.,;:!?])/g, "$1");
//   return text;
// }

// function cleanConstraint(li) {
//   let text = richText(li);
//   text = text.replace(/\u00a0/g, " ");
//   text = text.replace(/\s+/g, " ").trim();
//   return text;
// }

// function extractTitleAndNumber() {
//   const link = document.querySelector('a[href^="/problems/"]');
//   if (!link) return { problemNumber: "0", problemName: "Unknown" };
//   const raw = cleanText(link);
//   const match = raw.match(/^(\d+)\.\s*(.+)$/);
//   if (match) {
//     return { problemNumber: match[1], problemName: match[2].trim() };
//   }
//   return { problemNumber: "0", problemName: raw || "Unknown" };
// }

// function extractDifficulty() {
//   const el = document.querySelector('[class*="text-difficulty-"]');
//   return el ? cleanText(el) : "Unknown";
// }

// function extractTopics() {
//   const seen = [];
//   document.querySelectorAll('a[href^="/tag/"]').forEach((a) => {
//     const text = cleanText(a);
//     if (text && !seen.includes(text)) seen.push(text);
//   });
//   return seen;
// }

// function getDescriptionContentEl() {
//   const wrapper = document.querySelector('[data-track-load="description_content"]');
//   if (!wrapper) return null;

//   const isHtmlContentDiv = (el) =>
//     el &&
//     el.tagName === "DIV" &&
//     Array.from(el.classList).some((c) => c.startsWith("HTMLContent_html__"));

//   if (isHtmlContentDiv(wrapper)) return wrapper;

//   const all = wrapper.querySelectorAll("div");
//   for (const div of all) {
//     if (isHtmlContentDiv(div)) return div;
//   }
//   return wrapper;
// }

// function parseDescriptionContent(content) {
//   const descriptionParts = [];
//   const examples = [];
//   const constraints = [];
//   let followUp = null;

//   if (!content) {
//     return { description: "", examples, constraints, followUp };
//   }

//   let hitExamples = false;
//   let hitConstraints = false;

//   for (const child of Array.from(content.children)) {
//     const tagText = cleanText(child);

//     if (child.tagName === "P") {
//       if (child.querySelector("strong.example")) {
//         hitExamples = true;
//         continue;
//       }
//       if (/^Constraints:?$/i.test(tagText)) {
//         hitConstraints = true;
//         continue;
//       }
//       if (/^follow[- ]?up/i.test(tagText)) {
//         followUp = tagText;
//         continue;
//       }
//       if (!tagText) continue;
//       if (!hitExamples && !hitConstraints) {
//         descriptionParts.push(tagText);
//       }
//     } else if (child.tagName === "PRE") {
//       const raw = child.textContent || "";
//       const lines = raw
//         .split("\n")
//         .map((ln) => ln.replace(/[ \t]+/g, " ").trim())
//         .filter((ln) => ln !== "");
//       examples.push(lines.join("\n"));
//     } else if (child.tagName === "UL") {
//       if (hitConstraints || descriptionParts.length > 0) {
//         child.querySelectorAll(":scope > li").forEach((li) => {
//           const liText = cleanConstraint(li);
//           if (liText) constraints.push(liText);
//         });
//       }
//     }
//   }

//   const description = descriptionParts.join("\n\n").trim();

//   if (!followUp) {
//     const fullText = cleanText(content);
//     const m = fullText.match(/Follow-up:?.*$/i);
//     if (m) {
//       followUp = m[0].replace(/\s+([.,;:!?)])/g, "$1").trim();
//     }
//   }

//   return { description, examples, constraints, followUp };
// }

// function slugify(title) {
//   return (title || "")
//     .trim()
//     .toLowerCase()
//     .replace(/[^a-z0-9]+/g, "-")
//     .replace(/^-+|-+$/g, "");
// }

// function buildMarkdown(data) {
//   const lines = [];
//   const title = data.problemName || "Untitled";
//   lines.push(`[${title}](https://leetcode.com/problems/${slugify(title)}/)`);
//   lines.push("Solved");
//   if (data.difficulty) lines.push(data.difficulty);
//   if (data.tags && data.tags.length) {
//     lines.push("Topics");
//     lines.push("Companies");
//     lines.push("Hint");
//   }
//   lines.push("");
//   if (data.description) {
//     lines.push(data.description);
//     lines.push("");
//   }
//   (data.examples || []).forEach((ex, i) => {
//     lines.push(`Example ${i + 1}:`);
//     lines.push("");
//     lines.push("```");
//     lines.push(ex);
//     lines.push("");
//     lines.push("```");
//     lines.push("");
//   });
//   if (data.constraints && data.constraints.length) {
//     lines.push("Constraints:");
//     data.constraints.forEach((c) => {
//       lines.push(c.startsWith("`") ? `   * ${c}` : `   * \`${c}\``);
//     });
//     lines.push("");
//   }
//   if (data.followUp) lines.push(data.followUp);

//   return lines.join("\n").trim() + "\n";
// }

// function captureProblemDescription() {
//   const { problemNumber, problemName } = extractTitleAndNumber();
//   const difficulty = extractDifficulty();
//   const tags = extractTopics();

//   const contentEl = getDescriptionContentEl();
//   const { description, examples, constraints, followUp } = parseDescriptionContent(contentEl);

//   if (problemName !== "Unknown") {
//     problemInfo = {
//       problemNumber,
//       problemName,
//       difficulty,
//       tags,
//       description,
//       examples,
//       constraints,
//       followUp,
//     };
//     problemInfo.markdown = buildMarkdown(problemInfo);
//     console.log("📋 Description captured:", problemInfo);
//   }
// }

// /* =========================================================================
//  * SUBMIT TRIGGER — click OR Ctrl+Enter / Cmd+Enter
//  * Now ALWAYS re-scrapes description fresh, to handle LeetCode's client-side
//  * routing (navigating between problems without a full page reload, which
//  * would otherwise leave stale data from a previous problem in problemInfo)
//  * ========================================================================= */

// document.addEventListener('click', function (event) {
//   const submitBtn = event.target.closest('[data-e2e-locator="console-submit-button"]');
//   if (submitBtn) {
//     console.log("🖱️ Submit button clicked! Refreshing problem info...");
//     captureProblemDescription();
//     waitForSubmissionOutcome();
//   }
// });

// document.addEventListener('keydown', function (event) {
//   const isSubmitShortcut = (event.ctrlKey || event.metaKey) && event.key === 'Enter';
//   if (isSubmitShortcut) {
//     console.log("⌨️ Ctrl+Enter / Cmd+Enter detected! Refreshing problem info...");
//     captureProblemDescription();
//     waitForSubmissionOutcome();
//   }
// });

// /* =========================================================================
//  * RESULT DETECTION (unchanged)
//  * ========================================================================= */

// function findTestCaseSummary() {
//   const text = document.body.textContent || "";
//   const match = text.match(/(\d+)\s*\/\s*(\d+)\s*testcases passed/i);
//   if (!match) return null;

//   const passed = parseInt(match[1], 10);
//   const total = parseInt(match[2], 10);
//   return { passed, total, text: `${passed}/${total}` };
// }

// function findAcceptedMarker() {
//   const el = document.querySelector('[data-e2e-locator="submission-result"]');
//   if (el && cleanText(el) === "Accepted") return el;
//   return null;
// }

// function checkOutcomeNow() {
//   const acceptedMarker = findAcceptedMarker();
//   if (acceptedMarker) {
//     return { status: "accepted", marker: acceptedMarker };
//   }

//   const summary = findTestCaseSummary();
//   if (summary) {
//     if (summary.total === 0 && summary.passed === 0) {
//       return { status: "failed", summary };
//     }
//     if (summary.passed < summary.total) {
//       return { status: "failed", summary };
//     }
//     if (summary.passed === summary.total && summary.total > 0) {
//       return { status: "accepted", marker: null };
//     }
//   }

//   return null;
// }

// function waitForSubmissionOutcome(safetyNetMs = 8000) {
//   const immediate = checkOutcomeNow();
//   if (immediate) {
//     handleOutcome(immediate);
//     return;
//   }

//   const observer = new MutationObserver(() => {
//     const outcome = checkOutcomeNow();
//     if (outcome) {
//       observer.disconnect();
//       clearTimeout(safetyTimer);
//       handleOutcome(outcome);
//     }
//   });

//   observer.observe(document.body, { childList: true, subtree: true, characterData: true });

//   const safetyTimer = setTimeout(() => {
//     observer.disconnect();
//     console.log("⏱️ No result detected within 8s — LeetCode may be slow or something broke. Try again.");
//   }, safetyNetMs);
// }

// function handleOutcome(outcome) {
//   if (outcome.status === "accepted") {
//     console.log("✅ Accepted (or all testcases passed)! Capturing details...");
//     captureAcceptedDetails(outcome.marker);
//   } else {
//     console.log(`❌ Submission failed (${outcome.summary ? outcome.summary.text : "unknown"} testcases passed) — saving empty result.`);
//     const finalData = {};
//     console.log("📦 FINAL Submission Data:", finalData);
//     chrome.storage.local.set({ latestSubmission: finalData });
//   }
// }

// /* =========================================================================
//  * STAT CARD EXTRACTION (unchanged)
//  * ========================================================================= */

// function extractStatCard(label) {
//   const labelDivs = Array.from(document.querySelectorAll("div.flex-1.text-sm"));
//   const labelDiv = labelDivs.find((d) => cleanText(d) === label);
//   if (!labelDiv) return null;

//   const card = labelDiv.closest("div.group");
//   if (!card) return null;

//   const valueRow = card.querySelector("div.mt-2");
//   if (!valueRow) return null;

//   const spans = Array.from(valueRow.querySelectorAll(":scope > span"));
//   if (spans.length < 2) return null;

//   const value = cleanText(spans[0]);
//   const unit = cleanText(spans[1]);

//   const beatsIdx = spans.findIndex((s) => /^beats$/i.test(cleanText(s)));
//   const beatsPercent = beatsIdx >= 0 && spans[beatsIdx + 1] ? cleanText(spans[beatsIdx + 1]) : null;

//   return { value, unit, beatsPercent };
// }

// function isPlaceholderBeats(beatsPercent) {
//   return !beatsPercent || /^-+%?$/.test(beatsPercent.trim());
// }

// function waitForReadyStat(label, { intervalMs = 250, maxWaitMs = 6000 } = {}) {
//   return new Promise((resolve) => {
//     let lastKey = null;
//     let stableCount = 0;
//     let elapsed = 0;

//     const tick = () => {
//       const reading = extractStatCard(label);
//       const isReady = reading && !isPlaceholderBeats(reading.beatsPercent);

//       if (isReady) {
//         const key = `${reading.value}${reading.unit}|${reading.beatsPercent}`;
//         stableCount = key === lastKey ? stableCount + 1 : 1;
//         lastKey = key;

//         if (stableCount >= 2) {
//           resolve(reading);
//           return;
//         }
//       }

//       elapsed += intervalMs;
//       if (elapsed >= maxWaitMs) {
//         resolve(reading);
//         return;
//       }

//       setTimeout(tick, intervalMs);
//     };

//     tick();
//   });
// }

// function waitForTestCaseSummary({ intervalMs = 250, maxWaitMs = 6000 } = {}) {
//   return new Promise((resolve) => {
//     let elapsed = 0;
//     const tick = () => {
//       const summary = findTestCaseSummary();
//       if (summary) {
//         resolve(summary);
//         return;
//       }
//       elapsed += intervalMs;
//       if (elapsed >= maxWaitMs) {
//         resolve(null);
//         return;
//       }
//       setTimeout(tick, intervalMs);
//     };
//     tick();
//   });
// }

// async function captureAcceptedDetails() {
//   const [testCaseSummary, runtimeStat, memoryStat] = await Promise.all([
//     waitForTestCaseSummary(),
//     waitForReadyStat("Runtime"),
//     waitForReadyStat("Memory"),
//   ]);

//   const testCasesPassed = testCaseSummary ? testCaseSummary.text : "Unknown";

//   const runtime = runtimeStat ? `${runtimeStat.value} ${runtimeStat.unit}` : "Unknown";
//   const runtimeBeats = runtimeStat && runtimeStat.beatsPercent ? runtimeStat.beatsPercent : "Unknown";
//   const memory = memoryStat ? `${memoryStat.value} ${memoryStat.unit}` : "Unknown";
//   const memoryBeats = memoryStat && memoryStat.beatsPercent ? memoryStat.beatsPercent : "Unknown";

//   const codeBlock = document.querySelector('pre code[class*="language-"]');
//   let code = "";
//   let language = "Unknown";

//   if (codeBlock) {
//     const langClass = [...codeBlock.classList].find((c) => c.startsWith("language-"));
//     language = langClass ? langClass.replace("language-", "") : "Unknown";

//     const cloned = codeBlock.cloneNode(true);
//     cloned.querySelectorAll(".linenumber").forEach((span) => span.remove());
//     code = cloned.textContent.trim();
//   }

//   const finalData = {
//     ...problemInfo,
//     testCasesPassed,
//     runtime,
//     runtimeBeats,
//     memory,
//     memoryBeats,
//     code,
//     language,
//     url: window.location.href,
//     timestamp: new Date().toISOString(),
//   };

//   console.log("📦 FINAL Submission Data:", finalData);
//   chrome.storage.local.set({ latestSubmission: finalData });
// }

// captureProblemDescription();
















































console.log("AlgoSync AI: Waiting for Submit (click or Ctrl+Enter)...");

let problemInfo = {};
// async function saveSubmission(finalData) {
//   try {
//     await chrome.storage.local.set({
//       latestSubmission: finalData
//     });

//     console.log("✅ Latest submission saved");

//   } catch (error) {
//     console.error("❌ Storage save failed:", error.message);
//   }
// }

// async function saveSubmission(finalData) {
//   try {
//     await chrome.storage.local.set({
//       latestSubmission: finalData
//     });

//     console.log("✅ Latest submission saved");

//     if (finalData.code) {
//       console.log("🤖 Requesting AI explanation...");
//       chrome.runtime.sendMessage(
//         { type: "GENERATE_EXPLANATION", data: finalData },
//         (response) => {
//           if (response && response.success) {
//             console.log("✅ AI Explanation:", response.explanation);
//             chrome.storage.local.set({ latestExplanation: response.explanation });
//           } else {
//             console.error("❌ AI explanation failed:", response?.error);
//           }
//         }
//       );
//     }

//   } catch (error) {
//     console.error("❌ Storage save failed:", error.message);
//   }
// }
function getEmbeddedQuestionData() {
  try {
    const scripts = document.querySelectorAll('script[type="application/json"]');
    for (const script of scripts) {
      const data = JSON.parse(script.textContent);
      const queries = data?.props?.pageProps?.dehydratedState?.queries;
      if (!queries) continue;
      for (const q of queries) {
        const question = q?.state?.data?.question;
        if (question) return question;
      }
    }
  } catch (e) {
    console.warn("⚠️ Could not parse embedded question JSON:", e);
  }
  return null;
}

// async function saveSubmission(finalData) {
//   try {
//     const { repoName } = await chrome.storage.local.get("repoName");
//     if (!repoName) {
//       console.log("⚠️ No repo connected — skipping AI call");
//       algosyncToast("failed", "Please connect a repo", "Click the extension icon");
//       return;
//     }
    
//     if (!finalData.code) {
//       // await chrome.storage.local.set({ latestSubmission: finalData });
//       console.log("⚠️ No code captured — likely a real failed submission OR a scraping issue");
//       algosyncToast("failed", "Couldn't read your code", "Try resubmitting");
//       return;
//     }

//     const problemNumber = finalData.problemNumber;
//     const decision = await shouldCallAI(problemNumber, finalData.code, finalData.language);

//     console.log(`🔍 Decision: ${decision.call ? "Call AI" : "Skip AI"} — ${decision.reason}`);

//     const result = await chrome.storage.local.get("submissions");
//     const submissions = result.submissions || {};

//     if (!decision.call) {
//       submissions[problemNumber] = {
//         ...submissions[problemNumber],
//         ...finalData,
//         explanation: submissions[problemNumber].explanation,
//       };
//       await chrome.storage.local.set({ submissions });
//       console.log("⏭️ Skipped AI call — code unchanged");
//       algosyncToast("ready", "Already documented");
//       return;
//     }

//     console.log("🤖 Requesting AI explanation before saving...");
//     algosyncToast("generating");

//     chrome.runtime.sendMessage(
//     { type: "GENERATE_EXPLANATION", data: finalData },
//     async (response) => {
//       if (response && response.success) {
//         console.log("✅ AI Explanation:", response.explanation);
//         algosyncToast("ready");

//         const updated = await chrome.storage.local.get("submissions");
//         const subs = updated.submissions || {};
//         const fullData = { ...finalData, explanation: response.explanation };
//         subs[problemNumber] = fullData;
//         await chrome.storage.local.set({ submissions: subs });

//         const pushData = { ...fullData, _isUpdate: decision.reason === "code changed" };
//         chrome.runtime.sendMessage(
//           { type: "PUSH_TO_GITHUB", data: pushData },
//           (pushResponse) => {
//             if (pushResponse && pushResponse.success) {
//               console.log("✅ Pushed to GitHub");
//               algosyncToast("pushed");
//             } else {
//               console.error("❌ GitHub push failed:", pushResponse?.error);
//               algosyncToast("failed", "Notes saved, but GitHub push failed", pushResponse?.error);
//             }
//           }
//         );
//       } else {
//           console.error("❌ AI explanation failed:", response?.error);
//           const errMsg = response?.error || "Explanation wasn't saved";
//           algosyncToast("failed", "Couldn't generate notes", errMsg);
//         }
//       }
//     );

//   } catch (error) {
//     console.error("❌ Storage save failed:", error.message);
//   }
// }

async function saveSubmission(finalData) {
  try {
    const { repoName } = await chrome.storage.local.get("repoName");
    if (!repoName) {
      console.log("⚠️ No repo connected — skipping AI call");
      algosyncToast("failed", "Please connect a repo", "Click the extension icon");
      return;
    }
    
    if (!finalData.code) {
      console.log("⚠️ No code captured — likely a real failed submission OR a scraping issue");
      algosyncToast("failed", "Couldn't read your code", "Try resubmitting");
      return;
    }

    const problemNumber = finalData.problemNumber;
    const decision = await shouldCallAI(problemNumber, finalData.code, finalData.language);

    console.log(`🔍 Decision: ${decision.call ? "Call AI" : "Skip AI"} — ${decision.reason}`);

    const result = await chrome.storage.local.get("submissions");
    const submissions = result.submissions || {};

    if (!decision.call) {
      const existing = submissions[problemNumber] || {};
      const mergedData = { ...existing, ...finalData, explanation: existing.explanation };
      submissions[problemNumber] = mergedData;
      await chrome.storage.local.set({ submissions });
      console.log("⏭️ Skipped AI call — code unchanged");

      if (decision.retryPush) {
        // Explanation already exists, but the last GitHub push didn't fully
        // succeed — retry just the push, skip the AI call entirely.
        console.log("🔁 Retrying incomplete push (no AI call needed)...");
        algosyncToast("generating", "Finishing GitHub push", "Retrying previous push");
        pushToGithubAndRecordStatus(problemNumber, mergedData, true);
      } else {
        algosyncToast("ready", "Already documented");
      }
      return;
    }

    console.log("🤖 Requesting AI explanation before saving...");
    algosyncToast("generating");

    chrome.runtime.sendMessage(
    { type: "GENERATE_EXPLANATION", data: finalData },
    async (response) => {
      if (response && response.success) {
        console.log("✅ AI Explanation:", response.explanation);
        algosyncToast("ready");

        const updated = await chrome.storage.local.get("submissions");
        const subs = updated.submissions || {};
        const fullData = { ...finalData, explanation: response.explanation, pushStatus: "pending" };
        subs[problemNumber] = fullData;
        await chrome.storage.local.set({ submissions: subs });

        pushToGithubAndRecordStatus(problemNumber, fullData, decision.reason === "code changed");
      } else {
          console.error("❌ AI explanation failed:", response?.error);
          const errMsg = response?.error || "Explanation wasn't saved";
          algosyncToast("failed", "Couldn't generate notes", errMsg);
        }
      }
    );

  } catch (error) {
    console.error("❌ Storage save failed:", error.message);
  }
}

// Pushes to GitHub, then writes the resulting pushStatus back onto the
// stored submission so future shouldCallAI checks know whether a retry
// is needed — this is what closes the "partial push gets stuck forever" bug.
// async function pushToGithubAndRecordStatus(problemNumber, fullData, isUpdate) {
//   const pushData = { ...fullData, _isUpdate: isUpdate };

//   chrome.runtime.sendMessage(
//     { type: "PUSH_TO_GITHUB", data: pushData },
//     async (pushResponse) => {
//       const status = pushResponse?.pushStatus || "failed";

//       const latest = await chrome.storage.local.get("submissions");
//       const subs = latest.submissions || {};
//       if (subs[problemNumber]) {
//         subs[problemNumber].pushStatus = status;
//         await chrome.storage.local.set({ submissions: subs });
//       }

//       if (pushResponse && pushResponse.success) {
//         console.log("✅ Pushed to GitHub");
//         algosyncToast("pushed");
//       } else if (pushResponse?.partial) {
//         console.error("⚠️ Partial GitHub push:", pushResponse.failedFiles);
//         algosyncToast("failed", "Push partially failed", `Missing: ${pushResponse.failedFiles.join(", ")} — will retry next submit`);
//       } else {
//         console.error("❌ GitHub push failed:", pushResponse?.error);
//         algosyncToast("failed", "Notes saved, but GitHub push failed", pushResponse?.error);
//       }
//     }
//   );
// }


async function pushToGithubAndRecordStatus(problemNumber, fullData, isUpdate) {
  const pushData = { ...fullData, _isUpdate: isUpdate };

  // The service worker can go idle/die mid-request (MV3 behavior), in which
  // case sendMessage's callback never fires — no error, no timeout, nothing.
  // This wraps it in a race so a dead worker can't leave pushStatus stuck
  // on "pending" forever.
  const responsePromise = new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "PUSH_TO_GITHUB", data: pushData },
      (pushResponse) => {
        if (chrome.runtime.lastError) {
          console.error("⚠️ sendMessage error:", chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(pushResponse);
      }
    );
  });

  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve(null), 20000); // 20s — generous but bounded
  });

  const pushResponse = await Promise.race([responsePromise, timeoutPromise]);

  const status = pushResponse?.pushStatus || "failed";

  const latest = await chrome.storage.local.get("submissions");
  const subs = latest.submissions || {};
  if (subs[problemNumber]) {
    subs[problemNumber].pushStatus = status;
    await chrome.storage.local.set({ submissions: subs });
  }

  if (pushResponse && pushResponse.success) {
    console.log("✅ Pushed to GitHub");
    algosyncToast("pushed");
  } else if (pushResponse?.partial) {
    console.error("⚠️ Partial GitHub push:", pushResponse.failedFiles);
    algosyncToast("failed", "Push partially failed", `Missing: ${pushResponse.failedFiles.join(", ")} — will retry next submit`);
  } else if (pushResponse === null) {
    console.error("❌ No response from background — service worker may have gone idle");
    algosyncToast("failed", "Push status unknown", "Will retry next submit");
  } else {
    console.error("❌ GitHub push failed:", pushResponse?.error);
    algosyncToast("failed", "Notes saved, but GitHub push failed", pushResponse?.error);
  }
}


function normalizeCode(code, language) {
  if (!code) return "";

  let cleaned = code;
  const lang = (language || "").toLowerCase();

  if (lang.includes("python")) {
    cleaned = cleaned.replace(/#.*$/gm, "");
    cleaned = cleaned.replace(/'''[\s\S]*?'''/g, "");
    cleaned = cleaned.replace(/"""[\s\S]*?"""/g, "");
  } else if (lang.includes("ruby")) {
    cleaned = cleaned.replace(/#.*$/gm, "");
    cleaned = cleaned.replace(/=begin[\s\S]*?=end/g, "");
  } else if (lang.includes("elixir")) {
    cleaned = cleaned.replace(/#.*$/gm, "");
  } else if (lang.includes("erlang")) {
    cleaned = cleaned.replace(/%.*$/gm, "");
  } else if (lang.includes("racket")) {
    cleaned = cleaned.replace(/;.*$/gm, "");
    cleaned = cleaned.replace(/#\|[\s\S]*?\|#/g, "");
  } else {
    // Default: C-style (C++, Java, JS, TS, C#, C, Go, Kotlin, Swift, Rust, PHP, Dart, Scala)
    cleaned = cleaned.replace(/\/\/.*$/gm, "");
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");
  }

  return cleaned.replace(/\s+/g, " ").trim();
}


// async function shouldCallAI(problemNumber, newCode, language) {
//   const result = await chrome.storage.local.get("submissions");
//   const submissions = result.submissions || {};
//   const existing = submissions[problemNumber];

//   if (!existing) {
//     return { call: true, reason: "new problem" };
//   }
//   if (!existing.explanation) {
//     return { call: true, reason: "no explanation yet — retrying" };
//   }
//   const normalizedNew = normalizeCode(newCode, language);
//   const normalizedOld = normalizeCode(existing.code, existing.language);

//   if (normalizedNew === normalizedOld) {
//     return { call: false, reason: "unchanged code" };
//   }

//   return { call: true, reason: "code changed" };
// }
async function shouldCallAI(problemNumber, newCode, language) {
  const result = await chrome.storage.local.get("submissions");
  const submissions = result.submissions || {};
  const existing = submissions[problemNumber];

  if (!existing) {
    return { call: true, reason: "new problem" };
  }
  if (!existing.explanation) {
    return { call: true, reason: "no explanation yet — retrying" };
  }
  const normalizedNew = normalizeCode(newCode, language);
  const normalizedOld = normalizeCode(existing.code, existing.language);

  if (normalizedNew === normalizedOld) {
    // Code unchanged — but if the last push didn't fully succeed,
    // we still need to retry the push (just not the AI call).
    if (existing.pushStatus !== "complete") {
      return { call: false, reason: "unchanged code", retryPush: true };
    }
    return { call: false, reason: "unchanged code", retryPush: false };
  }

  return { call: true, reason: "code changed" };
}

/* =========================================================================
 * DESCRIPTION-TAB PARSER
 * ========================================================================= */

function richText(node) {
  let result = "";
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName;
      if (tag === "SUP") {
        result += "^" + richText(child);
      } else if (tag === "SUB") {
        result += "_" + richText(child);
      } else {
        result += richText(child);
      }
    }
  }
  return result;
}

function cleanText(el) {
  if (!el) return "";
  let text = richText(el);
  text = text.replace(/\u00a0/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/\s+([.,;:!?])/g, "$1");
  return text;
}

function cleanConstraint(li) {
  let text = richText(li);
  text = text.replace(/\u00a0/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function extractTitleAndNumber() {
  // FIXED SELECTOR: only matches the real title link (has "truncate" and
  // "cursor-text" classes), not the prev/next navigation arrows, which also
  // start with href="/problems/" but use "cursor-pointer" instead.
  const link = document.querySelector('a.truncate.cursor-text[href^="/problems/"]');
  if (!link) return { problemNumber: "0", problemName: "Unknown" };
  const raw = cleanText(link);
  const match = raw.match(/^(\d+)\.\s*(.+)$/);
  if (match) {
    return { problemNumber: match[1], problemName: match[2].trim() };
  }
  return { problemNumber: "0", problemName: raw || "Unknown" };
}

function extractDifficulty() {
  const el = document.querySelector('[class*="text-difficulty-"]');
  return el ? cleanText(el) : "Unknown";
}

function extractTopics() {
  const seen = [];
  document.querySelectorAll('a[href^="/tag/"]').forEach((a) => {
    const text = cleanText(a);
    if (text && !seen.includes(text)) seen.push(text);
  });
  return seen;
}

function getDescriptionContentEl() {
  const wrapper = document.querySelector('[data-track-load="description_content"]');
  if (!wrapper) return null;

  const isHtmlContentDiv = (el) =>
    el &&
    el.tagName === "DIV" &&
    Array.from(el.classList).some((c) => c.startsWith("HTMLContent_html__"));

  if (isHtmlContentDiv(wrapper)) return wrapper;

  const all = wrapper.querySelectorAll("div");
  for (const div of all) {
    if (isHtmlContentDiv(div)) return div;
  }
  return wrapper;
}

function parseDescriptionContent(content) {
  const descriptionParts = [];
  const examples = [];
  const constraints = [];
  let followUp = null;

  if (!content) {
    return { description: "", examples, constraints, followUp };
  }

  let hitExamples = false;
  let hitConstraints = false;

  for (const child of Array.from(content.children)) {
    const tagText = cleanText(child);

    if (child.tagName === "P") {
      if (child.querySelector("strong.example")) {
        hitExamples = true;
        continue;
      }
      if (/^Constraints:?$/i.test(tagText)) {
        hitConstraints = true;
        continue;
      }
      if (/^follow[- ]?up/i.test(tagText)) {
        followUp = tagText;
        continue;
      }
      if (!tagText) continue;
      if (!hitExamples && !hitConstraints) {
        descriptionParts.push(tagText);
      }
    } else if (child.tagName === "PRE") {
      // Original format: example wrapped in a <pre> tag
      const raw = child.textContent || "";
      const lines = raw
        .split("\n")
        .map((ln) => ln.replace(/[ \t]+/g, " ").trim())
        .filter((ln) => ln !== "");
      examples.push(lines.join("\n"));
    } else if (child.tagName === "DIV" && child.classList.contains("example-block")) {
      // NEW: Newer format - example wrapped in <div class="example-block">
      const lines = [];
      child.querySelectorAll(":scope > p").forEach((p) => {
        const text = cleanText(p);
        if (text) lines.push(text);
      });
      child.querySelectorAll(":scope > ul > li").forEach((li) => {
        const text = cleanConstraint(li);
        if (text) lines.push(text);
      });
      if (lines.length) examples.push(lines.join("\n"));
    } else if (child.tagName === "UL") {
      if (hitConstraints || descriptionParts.length > 0) {
        child.querySelectorAll(":scope > li").forEach((li) => {
          const liText = cleanConstraint(li);
          if (liText) constraints.push(liText);
        });
      }
    }
  }

  const description = descriptionParts.join("\n\n").trim();

  if (!followUp) {
    const fullText = cleanText(content);
    const m = fullText.match(/Follow-up:?.*$/i);
    if (m) {
      followUp = m[0].replace(/\s+([.,;:!?)])/g, "$1").trim();
    }
  }

  return { description, examples, constraints, followUp };
}

function slugify(title) {
  return (title || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildMarkdown(data) {
  const lines = [];
  const title = data.problemName || "Untitled";
  lines.push(`[${title}](https://leetcode.com/problems/${slugify(title)}/)`);
  lines.push("Solved");
  if (data.difficulty) lines.push(data.difficulty);
  if (data.tags && data.tags.length) {
    lines.push("Topics");
    lines.push("Companies");
    lines.push("Hint");
  }
  lines.push("");
  if (data.description) {
    lines.push(data.description);
    lines.push("");
  }
  (data.examples || []).forEach((ex, i) => {
    lines.push(`Example ${i + 1}:`);
    lines.push("");
    lines.push("```");
    lines.push(ex);
    lines.push("");
    lines.push("```");
    lines.push("");
  });
  if (data.constraints && data.constraints.length) {
    lines.push("Constraints:");
    data.constraints.forEach((c) => {
      lines.push(c.startsWith("`") ? `   * ${c}` : `   * \`${c}\``);
    });
    lines.push("");
  }
  if (data.followUp) lines.push(data.followUp);

  return lines.join("\n").trim() + "\n";
}

// function captureProblemDescription() {
//   const { problemNumber, problemName } = extractTitleAndNumber();
//   const difficulty = extractDifficulty();
//   const tags = extractTopics();

//   const contentEl = getDescriptionContentEl();
//   const { description, examples, constraints, followUp } = parseDescriptionContent(contentEl);

//   if (problemName !== "Unknown") {
//     problemInfo = {
//       problemNumber,
//       problemName,
//       difficulty,
//       tags,
//       description,
//       examples,
//       constraints,
//       followUp,
//     };
//     problemInfo.markdown = buildMarkdown(problemInfo);
//     console.log("📋 Description captured:", problemInfo);
//   }
// }

function captureProblemDescription() {
  const question = getEmbeddedQuestionData();

  if (question) {
    const problemNumber = question.questionFrontendId || "0";
    const problemName = question.title || "Unknown";
    const difficulty = question.difficulty || "Unknown";
    const tags = (question.topicTags || []).map(t => t.name);

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = question.content || "";
    const { description, examples, constraints, followUp } = parseDescriptionContent(tempDiv);

    problemInfo = {
      problemNumber,
      problemName,
      difficulty,
      tags,
      description,
      examples,
      constraints,
      followUp,
    };
    problemInfo.markdown = buildMarkdown(problemInfo);
    console.log("📋 Description captured (JSON method):", problemInfo);
    return;
  }

  console.warn("⚠️ Embedded JSON not found — falling back to DOM scraping");
  const { problemNumber, problemName } = extractTitleAndNumber();
  const difficulty = extractDifficulty();
  const tags = extractTopics();
  const contentEl = getDescriptionContentEl();
  const { description, examples, constraints, followUp } = parseDescriptionContent(contentEl);

  if (problemName !== "Unknown") {
    problemInfo = { problemNumber, problemName, difficulty, tags, description, examples, constraints, followUp };
    problemInfo.markdown = buildMarkdown(problemInfo);
    console.log("📋 Description captured (DOM fallback):", problemInfo);
  } else {
    console.warn("⚠️ Both JSON and DOM scraping failed for this problem.");
  }
}

/* =========================================================================
 * SUBMIT TRIGGER — click OR Ctrl+Enter / Cmd+Enter
 * Always re-scrapes description fresh on every submit (handles LeetCode's
 * client-side routing between problems without a full page reload).
 * No page-load scrape anymore — the first real scrape happens on your
 * first Submit action.
 * ========================================================================= */

document.addEventListener('click', function (event) {
  const submitBtn = event.target.closest('[data-e2e-locator="console-submit-button"]');
  if (submitBtn) {
    console.log("🖱️ Submit button clicked! Refreshing problem info...");
    algosyncToast("submitting");
    captureProblemDescription();
    waitForSubmissionOutcome();
  }
});

document.addEventListener('keydown', function (event) {
  const isSubmitShortcut = (event.ctrlKey || event.metaKey) && event.key === 'Enter';
  if (isSubmitShortcut) {
    console.log("⌨️ Ctrl+Enter / Cmd+Enter detected! Refreshing problem info...");
    algosyncToast("submitting");
    captureProblemDescription();
    waitForSubmissionOutcome();
  }
});

/* =========================================================================
 * RESULT DETECTION
 * ========================================================================= */

function findTestCaseSummary() {
  const text = document.body.textContent || "";
  const match = text.match(/(\d+)\s*\/\s*(\d+)\s*testcases passed/i);
  if (!match) return null;

  const passed = parseInt(match[1], 10);
  const total = parseInt(match[2], 10);
  return { passed, total, text: `${passed}/${total}` };
}

function findAcceptedMarker() {
  const el = document.querySelector('[data-e2e-locator="submission-result"]');
  if (el && cleanText(el) === "Accepted") return el;
  return null;
}

function checkOutcomeNow() {
  const acceptedMarker = findAcceptedMarker();
  if (acceptedMarker) {
    return { status: "accepted", marker: acceptedMarker };
  }

  const summary = findTestCaseSummary();
  if (summary) {
    if (summary.total === 0 && summary.passed === 0) {
      return { status: "failed", summary };
    }
    // if (summary.passed < summary.total) {
    //   return { status: "failed", summary };
    // }
    if (summary.passed < summary.total) {
      return null;
    }
    if (summary.passed === summary.total && summary.total > 0) {
      return { status: "accepted", marker: null };
    }
  }

  return null;
}



// let partialFailStableCount = 0;
// let lastPartialFailKey = null;

// function checkOutcomeNow() {
//   const acceptedMarker = findAcceptedMarker();
//   if (acceptedMarker) {
//     return { status: "accepted", marker: acceptedMarker };
//   }

//   const summary = findTestCaseSummary();
//   if (summary) {
//     if (summary.total === 0 && summary.passed === 0) {
//       return { status: "failed", summary };
//     }
//     if (summary.passed === summary.total && summary.total > 0) {
//       return { status: "accepted", marker: null };
//     }
//     if (summary.passed < summary.total) {
//       // Numbers might still be updating live — require the same partial
//       // result to appear twice in a row before treating it as final,
//       // so we don't call it "failed" mid-render.
//       const key = summary.text;
//       if (key === lastPartialFailKey) {
//         partialFailStableCount++;
//       } else {
//         partialFailStableCount = 1;
//         lastPartialFailKey = key;
//       }
//       if (partialFailStableCount >= 2) {
//         return { status: "failed", summary };
//       }
//       return null;
//     }
//   }

//   return null;
// }



// let lastSummaryKey = null;
// let stableSummaryCount = 0;

// function checkOutcomeNow() {
//   const acceptedMarker = findAcceptedMarker();
//   if (acceptedMarker) {
//     return { status: "accepted", marker: acceptedMarker };
//   }

//   const summary = findTestCaseSummary();
//   if (summary) {
//     if (summary.total === 0 && summary.passed === 0) {
//       return { status: "failed", summary };
//     }

//     if (summary.passed === summary.total && summary.total > 0) {
//       return { status: "accepted", marker: null };
//     }

//     if (summary.passed < summary.total) {
//       const key = summary.text;
//       if (key === lastSummaryKey) {
//         stableSummaryCount++;
//       } else {
//         stableSummaryCount = 1;
//         lastSummaryKey = key;
//       }
//       if (stableSummaryCount >= 12) {
//         return { status: "failed", summary };
//       }
//       return null;
//     }
//   }

//   return null;
// }



function waitForSubmissionOutcome(safetyNetMs = 13000) {
  const immediate = checkOutcomeNow();
// function waitForSubmissionOutcome(safetyNetMs = 15000) {
//   partialFailStableCount = 0;
//   lastPartialFailKey = null;
  // const immediate = checkOutcomeNow();
  if (immediate) {
    handleOutcome(immediate);
    return;
  }

  const observer = new MutationObserver(() => {
    const outcome = checkOutcomeNow();
    if (outcome) {
      observer.disconnect();
      clearTimeout(safetyTimer);
      handleOutcome(outcome);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  // const safetyTimer = setTimeout(() => {
  //   observer.disconnect();
  //   console.log("⏱️ No result detected within 8s — LeetCode may be slow or something broke. Try again.");
  // }, safetyNetMs);
  const safetyTimer = setTimeout(() => {
    observer.disconnect();
    console.log("⏱️ No result detected within 13s — LeetCode may be slow or something broke. Try again.");
    algosyncToast("failed", "Couldn't detect result", "Try resubmitting");
  }, safetyNetMs);
}


// function waitForSubmissionOutcome(safetyNetMs = 12000) {
//   lastSummaryKey = null;
//   stableSummaryCount = 0;

//   const immediate = checkOutcomeNow();
//   if (immediate) {
//     handleOutcome(immediate);
//     return;
//   }

//   const observer = new MutationObserver(() => {
//     const outcome = checkOutcomeNow();
//     if (outcome) {
//       observer.disconnect();
//       clearTimeout(safetyTimer);
//       handleOutcome(outcome);
//     }
//   });

//   observer.observe(document.body, { childList: true, subtree: true, characterData: true });

//   const safetyTimer = setTimeout(() => {
//     observer.disconnect();
//     console.log("⏱️ No result detected within 8s — LeetCode may be slow or something broke. Try again.");
//     algosyncToast("failed", "Couldn't detect result", "Try resubmitting");
//   }, safetyNetMs);
// }



// function handleOutcome(outcome) {
//   if (outcome.status === "accepted") {
//     console.log("✅ Accepted (or all testcases passed)! Capturing details...");
//     captureAcceptedDetails(outcome.marker);
//   } else {
//     console.log(`❌ Submission failed (${outcome.summary ? outcome.summary.text : "unknown"} testcases passed) — saving empty result.`);
//     const finalData = {};
//     console.log("📦 FINAL Submission Data:", finalData);
//     // chrome.storage.local.set({ latestSubmission: finalData });
//     saveSubmission(finalData);
//   }
// }



  function handleOutcome(outcome) {
    if (outcome.status === "accepted") {
      algosyncToast("accepted");
      console.log("✅ Accepted (or all testcases passed)! Capturing details...");
      captureAcceptedDetails(outcome.marker).catch((err) => {
      console.error("❌ captureAcceptedDetails crashed:", err);
      algosyncToast("failed", "Something broke while reading your code");
    });
  } else {
    algosyncToast("notAccepted");
    console.log(`❌ Submission failed (${outcome.summary ? outcome.summary.text : "unknown"} testcases passed) — saving empty result.`);
    const finalData = {};
    console.log("📦 FINAL Submission Data:", finalData);
    saveSubmission(finalData);
  }
}

/* =========================================================================
 * STAT CARD EXTRACTION (Runtime / Memory)
 * ========================================================================= */

function extractStatCard(label) {
  const labelDivs = Array.from(document.querySelectorAll("div.flex-1.text-sm"));
  const labelDiv = labelDivs.find((d) => cleanText(d) === label);
  if (!labelDiv) return null;

  const card = labelDiv.closest("div.group");
  if (!card) return null;

  const valueRow = card.querySelector("div.mt-2");
  if (!valueRow) return null;

  const spans = Array.from(valueRow.querySelectorAll(":scope > span"));
  if (spans.length < 2) return null;

  const value = cleanText(spans[0]);
  const unit = cleanText(spans[1]);

  const beatsIdx = spans.findIndex((s) => /^beats$/i.test(cleanText(s)));
  const beatsPercent = beatsIdx >= 0 && spans[beatsIdx + 1] ? cleanText(spans[beatsIdx + 1]) : null;

  return { value, unit, beatsPercent };
}

function isPlaceholderBeats(beatsPercent) {
  return !beatsPercent || /^-+%?$/.test(beatsPercent.trim());
}

function waitForReadyStat(label, { intervalMs = 250, maxWaitMs = 6000 } = {}) {
  return new Promise((resolve) => {
    let lastKey = null;
    let stableCount = 0;
    let elapsed = 0;

    const tick = () => {
      const reading = extractStatCard(label);
      const isReady = reading && !isPlaceholderBeats(reading.beatsPercent);

      if (isReady) {
        const key = `${reading.value}${reading.unit}|${reading.beatsPercent}`;
        stableCount = key === lastKey ? stableCount + 1 : 1;
        lastKey = key;

        if (stableCount >= 2) {
          resolve(reading);
          return;
        }
      }

      elapsed += intervalMs;
      if (elapsed >= maxWaitMs) {
        resolve(reading);
        return;
      }

      setTimeout(tick, intervalMs);
    };

    tick();
  });
}

function waitForTestCaseSummary({ intervalMs = 250, maxWaitMs = 6000 } = {}) {
  return new Promise((resolve) => {
    let elapsed = 0;
    const tick = () => {
      const summary = findTestCaseSummary();
      if (summary) {
        resolve(summary);
        return;
      }
      elapsed += intervalMs;
      if (elapsed >= maxWaitMs) {
        resolve(null);
        return;
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

async function captureAcceptedDetails() {
  const [testCaseSummary, runtimeStat, memoryStat] = await Promise.all([
    waitForTestCaseSummary(),
    waitForReadyStat("Runtime"),
    waitForReadyStat("Memory"),
  ]);

  const testCasesPassed = testCaseSummary ? testCaseSummary.text : "Unknown";

  const runtime = runtimeStat ? `${runtimeStat.value} ${runtimeStat.unit}` : "Unknown";
  const runtimeBeats = runtimeStat && runtimeStat.beatsPercent ? runtimeStat.beatsPercent : "Unknown";
  const memory = memoryStat ? `${memoryStat.value} ${memoryStat.unit}` : "Unknown";
  const memoryBeats = memoryStat && memoryStat.beatsPercent ? memoryStat.beatsPercent : "Unknown";

  // const codeBlock = document.querySelector('pre code[class*="language-"]');
  // let code = "";
  // let language = "Unknown";

  // if (codeBlock) {
  //   const langClass = [...codeBlock.classList].find((c) => c.startsWith("language-"));
  //   language = langClass ? langClass.replace("language-", "") : "Unknown";

  //   const cloned = codeBlock.cloneNode(true);
  //   cloned.querySelectorAll(".linenumber").forEach((span) => span.remove());
  //   code = cloned.textContent.trim();
  // }


  // let code = "";
  // let language = "Unknown";

  // // Find the POTD "Code" section
  // const header = [...document.querySelectorAll("div")].find(el => {
  //   const text = el.innerText?.trim();
  //   return text && text.startsWith("Code\n");
  // });

  // if (header) {
  //   // Get language
  //   const lines = header.innerText.split("\n");
  //   language = lines[1] || "Unknown";
  //   // console.log("🔍 Raw language value:", JSON.stringify(language));
  //   // Get code
  //   const codeBlock = header.querySelector("pre code");

  //   if (codeBlock) {
  //     const cloned = codeBlock.cloneNode(true);

  //     // Remove line numbers
  //     cloned.querySelectorAll(".linenumber").forEach(el => el.remove());

  //     code = cloned.textContent.trim();
  //   }
  // }



  let code = "";
  let language = "Unknown";

  // Find the POTD "Code" section
  const header = [...document.querySelectorAll("div")].find(el => {
    const text = el.innerText?.trim();
    return text && text.startsWith("Code\n");
  });

  if (header) {
    // Get language — primary method reads the header text layout
    const lines = header.innerText.split("\n");
    language = lines[1] || "Unknown";

    const codeBlock = header.querySelector("pre code");

    if (codeBlock) {
      // Fallback: if the text-layout method gave us nothing usable,
      // try reading it off the code block's language-* class instead.
      if (language === "Unknown" || !language.trim()) {
        const langClass = [...codeBlock.classList].find((c) => c.startsWith("language-"));
        if (langClass) language = langClass.replace("language-", "");
      }

      const cloned = codeBlock.cloneNode(true);
      cloned.querySelectorAll(".linenumber").forEach(el => el.remove());
      code = cloned.textContent.trim();
    }
  }

  const finalData = {
    ...problemInfo,
    testCasesPassed,
    runtime,
    runtimeBeats,
    memory,
    memoryBeats,
    code,
    language,
    url: window.location.href,
    timestamp: new Date().toISOString(),
  };

  console.log("📦 FINAL Submission Data:", finalData);
  // chrome.storage.local.set({ latestSubmission: finalData });
  saveSubmission(finalData);
}

// Note: no page-load scrape anymore. captureProblemDescription() only runs
// when you click Submit or press Ctrl+Enter — see the trigger section above.