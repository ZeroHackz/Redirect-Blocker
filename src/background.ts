interface Tab {
  id: number;
  windowId: number;
  url: string;
  active: boolean;
  savedURL?: boolean;
}

let allTabsModeIsOn = true; // Default to on for all tabs
const extensionTabs: Tab[] = [];

const builtInURLs = [
  "https://google.com/",
  "chrome://",
  "chrome-extension://egmgebeelgaakhaoodlmnimbfemfgdah",
  "https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values",
  "https://github.com/Tyson3101/",
  "https://chrome.google.com/webstore/detail/redirect-blocker/egmgebeelgaakhaoodlmnimbfemfgdah",
  "https://tyson3101.com",
];

// Simplify settings to core functionality
const defaultSettings = {
  savedURLs: ["https://soap2day.day/", "https://vipleague.im/"],
  allowedURLs: ["https://youtube.com/@Tyson3101"],
};

let settings = defaultSettings;
let allowedURLs = [...builtInURLs, ...defaultSettings.allowedURLs];

// Initialize: Always enable redirect blocking on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.query({}).then((allTabs) => {
    const tabs = allTabs.filter((t) => t.id) as Tab[];
    extensionTabs.splice(0, extensionTabs.length, ...tabs);
    saveExtTabs();
  });
});

// Handle new tab creation
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!allTabsModeIsOn) return;

  // Check the new tab's URL once it's available
  let intMs = 0;
  let urlPropertiesInterval = setInterval(async () => {
    const updatedTab = await chrome.tabs.get(tab.id).catch(() => null);
    if (!updatedTab) return clearInterval(urlPropertiesInterval);
    intMs += 20;
    if (updatedTab.url || updatedTab.pendingUrl) {
      checkTabUrl(updatedTab);
      clearInterval(urlPropertiesInterval);
    } else if (intMs >= 1000) {
      return clearInterval(urlPropertiesInterval);
    }
  }, 20);
});

// Handle tab updates
chrome.tabs.onUpdated.addListener(async (_tabId, _changeInfo, tab) => {
  if (!allTabsModeIsOn) return;
  checkTabUrl(tab);
});

// Check if a tab's URL is allowed, close it if not
async function checkTabUrl(tab: chrome.tabs.Tab) {
  // If URL matches allowed URLs or saved URLs, keep the tab
  if (isURLMatch([...settings.savedURLs, ...allowedURLs], tab.url)) {
    updateExtensionTab(tab);
    return;
  }
  
  // If this tab was previously allowed but now has a disallowed URL
  const extTab = extensionTabs.find((t) => t.id === tab.id);
  if (extTab) {
    if (extTab.url !== tab.url) {
      // URL changed to disallowed - block it by reverting to original URL
      await chrome.tabs.update(tab.id, { url: extTab.url }).catch(() => null);
    }
  }
}

// Helper Functions
async function updateExtensionTab(tab: chrome.tabs.Tab) {
  if (!tab) return;

  let extTabIndex = extensionTabs.findIndex((t) => t.id === tab.id);

  const updatedTabData = {
    id: tab.id,
    url: tab.url,
    active: tab.active,
    windowId: tab.windowId,
    savedURL: isURLMatch(settings.savedURLs, tab.url),
  };

  // If tab exists, update it, else push it
  if (extTabIndex >= 0) {
    extensionTabs[extTabIndex] = updatedTabData;
  } else {
    extensionTabs.push(updatedTabData);
  }

  saveExtTabs();
  return updatedTabData;
}

// Save extension tabs to storage
function saveExtTabs() {
  // Remove duplicates
  const extTabsSet = [...new Set(extensionTabs.map((t) => t.id))].map((id) =>
    extensionTabs.find((t) => t.id === id)
  );

  extensionTabs.splice(0, extensionTabs.length, ...extTabsSet);
  chrome.storage.local.set({ extensionTabs: extensionTabs });
}

// Clean up tabs that no longer exist
function checkTabs() {
  chrome.tabs.query({}).then((tabs) => {
    for (let i = extensionTabs.length - 1; i >= 0; i--) {
      if (!tabs.find((t) => t.id === extensionTabs[i].id)) {
        extensionTabs.splice(i, 1);
      }
    }
    saveExtTabs();
  });
}

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  const extTabIndex = extensionTabs.findIndex((t) => t.id === tabId);
  if (extTabIndex >= 0) {
    extensionTabs.splice(extTabIndex, 1);
    saveExtTabs();
  }
});

// URL matching utility
function isURLMatch(urls: string[], url: string) {
  if (!url) return false;
  const normalizeUrl = (url: string) =>
    url
      .replace(/^https?:\/\/(www\.)?(ww\d+\.)?/, "https://")
      .replace(/\/([^?]+).*$/, "/$1")
      .replace(/\/$/, "")
      .toLowerCase();

  const normalizedUrl = normalizeUrl(url);

  for (const currentUrl of urls) {
    const normalizedCurrentUrl = normalizeUrl(currentUrl);
    if (
      normalizedUrl === normalizedCurrentUrl ||
      normalizedUrl.startsWith(normalizedCurrentUrl + "/")
    ) {
      return true;
    }
  }
  return false;
}

// Load settings on initialization
(function initializeExtension() {
  chrome.storage.sync.get("settings", (res) => {
    if (res?.settings) {
      settings = {
        savedURLs: res.settings.savedURLs || defaultSettings.savedURLs,
        allowedURLs: res.settings.allowedURLs || defaultSettings.allowedURLs
      };
      allowedURLs = [...settings.allowedURLs, ...builtInURLs];
    } else {
      chrome.storage.sync.set({ 
        settings: defaultSettings
      });
    }
  });
  
  chrome.storage.local.get(["extensionTabs"], async (res) => {
    if (res?.extensionTabs) {
      extensionTabs.splice(0, extensionTabs.length, ...res.extensionTabs);
    }
    checkTabs();
  });
})();
