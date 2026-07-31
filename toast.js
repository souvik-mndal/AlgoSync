(function () {
  const FONT_BASE = chrome.runtime.getURL("fonts/");
  const STYLE_ID = "algosync-toast-style";
  const TOAST_ID = "algosync-toast";

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `

    @font-face { font-family: "Manrope"; src: url("${FONT_BASE}Manrope-Regular.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
      @font-face { font-family: "Manrope"; src: url("${FONT_BASE}Manrope-Medium.woff2") format("woff2"); font-weight: 500; font-style: normal; font-display: swap; }
      @font-face { font-family: "Manrope"; src: url("${FONT_BASE}Manrope-SemiBold.woff2") format("woff2"); font-weight: 600; font-style: normal; font-display: swap; }
      @font-face { font-family: "Manrope"; src: url("${FONT_BASE}Manrope-Bold.woff2") format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }

      #${TOAST_ID} {
   position: fixed;
   top: 20px;
   right: 20px;
   z-index: 999999;
   display: flex;
   align-items: center;
   gap: 12px;
   padding: 14px 20px;
   border-radius: 14px;
   font-family: "Manrope", -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
   font-size: 14px;
   font-weight: 600;
   letter-spacing: 0.1px;
   border: 1px solid rgba(255, 255, 255, 0.5);
   opacity: 0;
   transform: translateX(40px) scale(0.95);
   transition:
     opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1),
     transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
     background 0.35s ease,
     box-shadow 0.35s ease,
     color 0.35s ease;
   pointer-events: none;
   max-width: 320px;
 }
      #${TOAST_ID}.show {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
      #${TOAST_ID} .algosync-text {
  display: flex;
  flex-direction: column;
  gap: 1px;      /* <- controls head/sub gap directly, tune this */
  line-height: 1.25;
}
#${TOAST_ID} .algosync-sub {
  display: block;
  font-size: 11.5px;
  font-weight: 400;
  opacity: 0.85;
  line-height: 1.2;   /* tighter than default */
}

      /* Spinner for in-progress states */
      .algosync-spinner {
        width: 18px;
        height: 18px;
        border-radius: 50%;
         border: 2.5px solid rgba(0,0,0,0.12);
         border-top-color: currentColor;
        flex-shrink: 0;
        animation: algosync-spin 0.7s linear infinite;
      }
      @keyframes algosync-spin {
        to { transform: rotate(360deg); }
      }

      /* Checkmark draw animation */
      .algosync-check {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }
      .algosync-check circle {
        stroke: currentColor;
        stroke-width: 2;
        fill: none;
        opacity: 0.35;
      }
      .algosync-check path {
        stroke: currentColor;
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
        fill: none;
        stroke-dasharray: 20;
        stroke-dashoffset: 20;
        animation: algosync-draw 0.4s cubic-bezier(0.65, 0, 0.35, 1) 0.15s forwards;
      }
      @keyframes algosync-draw {
        to { stroke-dashoffset: 0; }
      }

      /* X mark for failure/error */
      .algosync-x {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }
      .algosync-x line {
        stroke: currentColor;
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-dasharray: 18;
        stroke-dashoffset: 18;
        animation: algosync-draw 0.3s ease 0.1s forwards;
      }
    `;
    document.head.appendChild(style);
  }

  const ICONS = {
    spinner: `<div class="algosync-spinner"></div>`,
    check: `
      <svg class="algosync-check" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10.5"></circle>
        <path d="M7 12.5l3 3 7-7"></path>
      </svg>`,
    x: `
      <svg class="algosync-x" viewBox="0 0 24 24">
        <line x1="6" y1="6" x2="18" y2="18"></line>
        <line x1="18" y1="6" x2="6" y2="18"></line>
      </svg>`,
    dash: `
      <svg class="algosync-x" viewBox="0 0 24 24">
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>`,
  };

  const STATES = {
    submitting: {
        bg: "radial-gradient(circle at 15% 15%, #8ec5e8 0%, transparent 55%), radial-gradient(circle at 80% 20%, #b9dcee 0%, transparent 50%), radial-gradient(circle at 50% 60%, #e3f0f8 0%, transparent 60%), radial-gradient(circle at 90% 85%, #78b9de 0%, transparent 55%), #cbe1f0",
       color: "#1c4e6b",
       shadow: "0 1px 1px rgba(255,255,255,0.8), 0 12px 26px rgba(32,69,92,0.18), inset 0 1px 0 rgba(255,255,255,0.6)",
        text: "Submitting",
        sub: null,
        icon: "spinner",
    },
    accepted: {
      bg: "radial-gradient(circle at 15% 15%, #aed787 0%, transparent 55%), radial-gradient(circle at 80% 20%, #d9ecb0 0%, transparent 50%), radial-gradient(circle at 50% 60%, #edf5d9 0%, transparent 60%), radial-gradient(circle at 90% 85%, #a1cf7d 0%, transparent 55%), #d4e6b9",
     color: "#3a5a2f",
     shadow: "0 1px 1px rgba(255,255,255,0.8), 0 12px 26px rgba(61,85,48,0.18), inset 0 1px 0 rgba(255,255,255,0.6)",
      text: "Accepted",
      sub: null,
      icon: "check",
    },
    generating: {
        bg: "radial-gradient(circle at 15% 15%, #8ec5e8 0%, transparent 55%), radial-gradient(circle at 80% 20%, #b9dcee 0%, transparent 50%), radial-gradient(circle at 50% 60%, #e3f0f8 0%, transparent 60%), radial-gradient(circle at 90% 85%, #78b9de 0%, transparent 55%), #cbe1f0",
       color: "#1c4e6b",
       shadow: "0 1px 1px rgba(255,255,255,0.8), 0 12px 26px rgba(32,69,92,0.18), inset 0 1px 0 rgba(255,255,255,0.6)",
        text: "Writing notes",
        sub: "Stay on this page for a moment",
        icon: "spinner",
    },
    ready: {
      bg: "radial-gradient(circle at 15% 15%, #aed787 0%, transparent 55%), radial-gradient(circle at 80% 20%, #d9ecb0 0%, transparent 50%), radial-gradient(circle at 50% 60%, #edf5d9 0%, transparent 60%), radial-gradient(circle at 90% 85%, #a1cf7d 0%, transparent 55%), #d4e6b9",
      color: "#3a5a2f",
     shadow: "0 1px 1px rgba(255,255,255,0.8), 0 12px 26px rgba(61,85,48,0.18), inset 0 1px 0 rgba(255,255,255,0.6)",
      text: "Notes ready",
      sub: null,
      icon: "check",
    },
    pushed: {
       bg: "radial-gradient(circle at 15% 15%, #aed787 0%, transparent 55%), radial-gradient(circle at 80% 20%, #d9ecb0 0%, transparent 50%), radial-gradient(circle at 50% 60%, #edf5d9 0%, transparent 60%), radial-gradient(circle at 90% 85%, #a1cf7d 0%, transparent 55%), #d4e6b9",
      color: "#3a5a2f",
     shadow: "0 1px 1px rgba(255,255,255,0.8), 0 12px 26px rgba(61,85,48,0.18), inset 0 1px 0 rgba(255,255,255,0.6)",
      text: "Pushed to GitHub",
      sub: null,
      icon: "check",
    },
    failed: {
      bg: "radial-gradient(circle at 15% 15%, #e6907f 0%, transparent 55%), radial-gradient(circle at 80% 20%, #eeb6a7 0%, transparent 50%), radial-gradient(circle at 50% 60%, #f7ddd6 0%, transparent 60%), radial-gradient(circle at 90% 85%, #dd7c62 0%, transparent 55%), #ecc7b7",
      color: "#8c3a30",
     shadow: "0 1px 1px rgba(255,255,255,0.8), 0 12px 26px rgba(122,53,39,0.18), inset 0 1px 0 rgba(255,255,255,0.6)",
      text: "Something went wrong",
      sub: "Explanation wasn't saved",
      icon: "x",
    },
    notAccepted: {
      bg: "radial-gradient(circle at 15% 15%, #e6907f 0%, transparent 55%), radial-gradient(circle at 80% 20%, #eeb6a7 0%, transparent 50%), radial-gradient(circle at 50% 60%, #f7ddd6 0%, transparent 60%), radial-gradient(circle at 90% 85%, #dd7c62 0%, transparent 55%), #ecc7b7",
      color: "#8c3a30",
     shadow: "0 1px 1px rgba(255,255,255,0.8), 0 12px 26px rgba(122,53,39,0.18), inset 0 1px 0 rgba(255,255,255,0.6)",
      text: "Not accepted",
      sub: null,
      icon: "dash",
    },
  };

  let hideTimer = null;

  window.algosyncToast = function (stateKey, customText, customSub) {
    const state = STATES[stateKey];
    if (!state) return;

    let el = document.getElementById(TOAST_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = TOAST_ID;
      document.body.appendChild(el);
    }

    clearTimeout(hideTimer);

    el.style.background = state.bg;
    el.style.boxShadow = state.shadow;
    el.style.color = state.color;

    const subText = customSub !== undefined ? customSub : state.sub;
    el.innerHTML = `
      ${ICONS[state.icon]}
      <span class="algosync-text">
        ${customText || state.text}
        ${subText ? `<span class="algosync-sub">${subText}</span>` : ""}
      </span>
    `;

    el.classList.remove("show");
    void el.offsetWidth; // force reflow so re-trigger animates even if same state fires again
    requestAnimationFrame(() => el.classList.add("show"));

    if (stateKey === "ready" || stateKey === "failed" || stateKey === "notAccepted" || stateKey === "pushed") {
      hideTimer = setTimeout(() => {
        el.classList.remove("show");
      }, 3200);
    }
  };
})();