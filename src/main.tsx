import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// Guard: never register SW in iframes or preview hosts
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
} else {
  // Register SW and check for updates on every page load / visibility change
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Auto-apply update silently
      updateSW(true);
    },
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      // Check for updates immediately
      registration.update();

      // Re-check every time the app becomes visible (tab focus, app open)
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          registration.update();
        }
      });

      // Also poll every 60 seconds as fallback
      setInterval(() => {
        registration.update();
      }, 60 * 1000);
    },
  });
}

createRoot(document.getElementById("root")!).render(<App />);
