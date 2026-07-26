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