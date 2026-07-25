console.log("AlgoSync AI: Background service worker running");

const WORKER_URL = "https://cool-mode-3295.algosync-svk.workers.dev";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GENERATE_EXPLANATION") {
    generateExplanation(message.data)
      .then((explanation) => sendResponse({ success: true, explanation }))
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
    throw new Error(data.error?.message || "Worker request failed");
  }

  return data.explanation;
}