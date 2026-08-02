// Pings the service worker every 20s to prevent MV3 idle-timeout
// from killing it mid-session. Only runs while this content script
// is alive (i.e., while a LeetCode problem tab is open).
setInterval(() => {
  chrome.runtime.sendMessage({ type: "KEEPALIVE_PING" }, () => {
    if (chrome.runtime.lastError) {
      // Worker was asleep — this message itself wakes it back up.
      console.log("🔄 Service worker was idle, ping woke it up");
    }
  });
}, 20000);