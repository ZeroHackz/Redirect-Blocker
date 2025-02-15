// SHORTCUTS LISTENER
let shortCutToggleSingleKeys: string[] = ["alt", "shift", "s"];
let shortCutToggleAllKeys: string[] = ["alt", "shift", "a"];

let pressedKeys: string[] = [];

/**
 * FUNCTIONS
 */

function shortCutListener() {
  let pressedKeys = [];
  // Web Dev Simplifed Debounce
  function debounce(cb, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        cb(...args);
      }, delay);
    };
  }

  const checkKeys = (keysToCheck, waitDebounce = true, delay = 700) => {
    return new Promise((resolve) => {
      function debounceCB() {
        if (!keysToCheck?.length) return resolve(false);
        if (pressedKeys.length == keysToCheck.length) {
          let match = true;
          for (let i = 0; i < pressedKeys.length; i++) {
            if (pressedKeys[i] != keysToCheck[i]) {
              match = false;
              break;
            }
          }
          resolve(match);
        } else resolve(false);
      }
      if (waitDebounce) debounce(debounceCB, delay)();
      else debounceCB();
    });
  };

  document.addEventListener("keydown", async (e) => {
    if (!e.key) return;
    pressedKeys.push(e.key.toLowerCase());

    // Shortcut for toggle tabs
    if (await checkKeys(shortCutToggleSingleKeys)) {
      chrome.runtime.sendMessage({ toggleSingle: true });
    } else if (await checkKeys(shortCutToggleAllKeys, false)) {
      chrome.runtime.sendMessage({ toggleAll: true });
    }
    pressedKeys = [];
  });
}

// Prevent same tab redirects
function preventSameTabRedirect(event: Event) {
  const aTag = event.target as HTMLAnchorElement;
  if (!isTabToggledOn || !isSameTabRedirectsPrevented || !isTabEnabled) return; //NEW: check isTabEnabled

  if (aTag && aTag.href) {
    if (!isURLMatchSameTab(combinedURLs, aTag.href)) {
      event.preventDefault();
    }
  }
}

// Start preventing same tab redirects
function beginPreventionOfSameTabRedirects() {
  if (!isTabToggledOn || !isSameTabRedirectsPrevented || !isTabEnabled) return; //NEW: check isTabEnabled

  // Set up a MutationObserver to watch for new <a> tags
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLAnchorElement) {
            node.addEventListener("click", preventSameTabRedirect);
          }
        });
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  document.querySelectorAll("a").forEach((link) => {
    link.removeEventListener("click", preventSameTabRedirect);
    link.addEventListener("click", preventSameTabRedirect);
  });
}

// Stop preventing same tab redirects
function endPreventionOfSameTabRedirects() {
  document.querySelectorAll("a").forEach((link) => {
    link.removeEventListener("click", preventSameTabRedirect);
  });
}

// Check if the URL matches the allowed URLs for same tab redirects
function isURLMatchSameTab(urls: string[], url: string): boolean {
  if (!url) return false;
  try {
    const targetHostname = new URL(url).hostname;

    for (const currentUrl of urls) {
      const allowedHostname = new URL(currentUrl).hostname;
      if (targetHostname === allowedHostname) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error("Invalid URL:", url, error); // Log invalid URLs
    return false; // Handle invalid URLs gracefully
  }
}

function getTabEnabledState() {
  //NEW
  chrome.runtime.sendMessage({ action: "getTabEnabledState" }, (response) => {
    isTabEnabled = response.tabEnabledState;
    if (!isTabEnabled) {
      endPreventionOfSameTabRedirects();
    } else {
      beginPreventionOfSameTabRedirects();
    }
  });
}

// Storage

chrome.storage.sync.get("settings", (result) => {
  const settings = result.settings;
  if (!settings) return;

  if (!settings.shortCutToggleSingleKeys || !settings.shortCutToggleAllKeys) {
    if (!settings.shortCutToggleSingleKeys)
      settings.shortCutToggleSingleKeys = shortCutToggleSingleKeys;
    if (!settings.shortCutToggleAllKeys)
      settings.shortCutToggleAllKeys = shortCutToggleAllKeys;

    chrome.storage.sync.set({ settings });
  }

  shortCutToggleSingleKeys = settings.shortCutToggleSingleKeys;
  shortCutToggleAllKeys = settings.shortCutToggleAllKeys;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    const settings = changes.settings.newValue;
    if (!settings) return;
    shortCutToggleSingleKeys = settings.shortCutToggleSingleKeys;
    shortCutToggleAllKeys = settings.shortCutToggleAllKeys;
  }
});

shortCutListener();

// Same Tab Redirects
// Variables
let tabId: number = null;
let isTabToggledOn = false;
let isSameTabRedirectsPrevented = false;
let combinedURLs: string[] = [];
let isTabEnabled = true; //NEW

// Get the current tab ID
chrome.runtime.sendMessage({ action: "getTabId" }, (response) => {
  tabId = response.tabId;
  beginPreventionOfSameTabRedirects();
  getTabEnabledState(); //NEW
});

// Handle messages from other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleTab") {
    isTabToggledOn = !!request.isToggledOn;
    if (isTabToggledOn) {
      beginPreventionOfSameTabRedirects();
    } else {
      endPreventionOfSameTabRedirects();
    }
  }
});

// Initialize settings and add listeners
chrome.storage.local.get("extensionTabs", (result) => {
  const extensionTabs = result.extensionTabs;
  if (extensionTabs) {
    const tabIsToggled = extensionTabs.find((tab: Tab) => tab.id == tabId);
    isTabToggledOn = !!tabIsToggled;
    if (isTabToggledOn) beginPreventionOfSameTabRedirects();
    else endPreventionOfSameTabRedirects();
  }
});

chrome.storage.sync.get("settings", (result) => {
  const settings = result.settings;
  if (settings) {
    if (settings.preventSameTabRedirects == null) {
      isSameTabRedirectsPrevented = false;
      settings.preventSameTabRedirects = false;
      chrome.storage.sync.set({ settings });
    } else {
      isSameTabRedirectsPrevented = settings.preventSameTabRedirects;
      combinedURLs = [
        ...settings.allowedURLs,
        ...settings.savedURLs,
        window.origin,
      ];
    }
    beginPreventionOfSameTabRedirects();
  }
});

chrome.runtime.sendMessage({ action: "getTabToggledState" }, (response) => {
  isTabToggledOn = !!response.isToggled;
  if (isTabToggledOn) beginPreventionOfSameTabRedirects();
  else endPreventionOfSameTabRedirects();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.extensionTabs) {
    const extensionTabs = changes.extensionTabs.newValue;
    if (extensionTabs) {
      const tabIsToggled = extensionTabs.find((tab: Tab) => tab.id == tabId);
      isTabToggledOn = !!tabIsToggled;
      if (isTabToggledOn) beginPreventionOfSameTabRedirects();
      else endPreventionOfSameTabRedirects();
    }
  }

  if (changes.settings) {
    const settings = changes.settings.newValue;
    if (settings) {
      isSameTabRedirectsPrevented = settings.preventSameTabRedirects;
      if (isTabToggledOn && isSameTabRedirectsPrevented)
        beginPreventionOfSameTabRedirects();
      else endPreventionOfSameTabRedirects();
      combinedURLs = [
        ...settings.allowedURLs,
        ...settings.savedURLs,
        window.origin,
      ];
    }
  }
});
