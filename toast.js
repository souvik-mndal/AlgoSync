(function () {
  const STYLE_ID = "algosync-toast-style";
  const TOAST_ID = "algosync-toast";

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
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
        font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.1px;
        color: #fff;
        opacity: 0;
        transform: translateX(40px) scale(0.95);
        transition:
          opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1),
          transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
          background 0.35s ease,
          box-shadow 0.35s ease;
        pointer-events: none;
        max-width: 320px;
      }
      #${TOAST_ID}.show {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
      #${TOAST_ID} .algosync-sub {
        display: block;
        font-size: 11.5px;
        font-weight: 400;
        opacity: 0.85;
        margin-top: 2px;
      }

      /* Spinner for in-progress states */
      .algosync-spinner {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 2.5px solid rgba(255,255,255,0.35);
        border-top-color: #fff;
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
        stroke: #fff;
        stroke-width: 2;
        fill: none;
        opacity: 0.35;
      }
      .algosync-check path {
        stroke: #fff;
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
        stroke: #fff;
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-dasharray: 14;
        stroke-dashoffset: 14;
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
        bg: "linear-gradient(135deg, #0ea5e9, #0284c7)",
        shadow: "0 8px 28px rgba(14, 165, 233, 0.45)",
        text: "Submitting",
        sub: null,
        icon: "spinner",
    },
    accepted: {
      bg: "linear-gradient(135deg, #22c55e, #16a34a)",
      shadow: "0 8px 28px rgba(34, 197, 94, 0.45)",
      text: "Accepted",
      sub: null,
      icon: "check",
    },
    generating: {
        bg: "linear-gradient(135deg, #f59e0b, #ea580c)",
        shadow: "0 8px 28px rgba(245, 158, 11, 0.45)",
        text: "Writing notes",
        sub: "Stay on this page for a moment",
        icon: "spinner",
    },
    ready: {
      bg: "linear-gradient(135deg, #22c55e, #16a34a)",
      shadow: "0 8px 28px rgba(34, 197, 94, 0.45)",
      text: "Notes ready",
      sub: null,
      icon: "check",
    },
    pushed: {
      bg: "linear-gradient(135deg, #6366f1, #4f46e5)",
      shadow: "0 8px 28px rgba(99, 102, 241, 0.45)",
      text: "Pushed to GitHub",
      sub: null,
      icon: "check",
    },
    failed: {
      bg: "linear-gradient(135deg, #ef4444, #dc2626)",
      shadow: "0 8px 28px rgba(239, 68, 68, 0.45)",
      text: "Something went wrong",
      sub: "Explanation wasn't saved",
      icon: "x",
    },
    notAccepted: {
      bg: "linear-gradient(135deg, #ef4444, #dc2626)",
      shadow: "0 8px 28px rgba(239, 68, 68, 0.45)",
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