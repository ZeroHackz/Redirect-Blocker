let allTabsModeIsOn = false;
const extensionTabs = [];
let keepAlive;
const builtInURLs = [
    "https://google.com/",
    "chrome://",
    "edge://",
    "chrome-extension://egmgebeelgaakhaoodlmnimbfemfgdah",
    "edge-extension://egmgebeelgaakhaoodlmnimbfemfgdah",
    "https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values",
    "https://chrome.google.com/webstore/detail/redirect-blocker/egmgebeelgaakhaoodlmnimbfemfgdah"
];
let allowedURLs = [...builtInURLs];
const initialSettings = {
    tabExclusive: false,
    preventSameTabRedirects: false,
    savedURLs: ["https://soap2day.day/", "https://vipleague.im/"],
    allowedURLs: ["https://github.com/ZeroHackz/Redirect-Blocker"],
    shortCutToggleSingleKeys: ["alt", "shift", "k"],
    shortCutToggleAllKeys: ["alt", "shift", "l"],
    onStartup: false,
};
let settings = initialSettings;
async function checkRedirect(tab, extTab) {
    if (!extTab?.isTabEnabled)
        return;
    const combinedURLs = extTab
        ? [...allowedURLs, ...settings.savedURLs, new URL(extTab.url).origin]
        : allowedURLs;
    if (extTab && !isURLMatch(combinedURLs, tab.url)) {
        await chrome.tabs.remove(tab.id).catch(() => null);
    }
    else if (allTabsModeIsOn) {
        await updateExtensionTab(tab, true);
    }
}
async function addExtensionTab(tab, instantSave = false) {
    if (!tab)
        return;
    if (extensionTabs.find(et => et.id === tab.id))
        return;
    const updatedTabData = {
        id: tab.id,
        url: tab.url,
        active: tab.active,
        windowId: tab.windowId,
        windowActive: tab.windowId === (await getCurrentWindowId()),
        savedURL: isURLMatch(settings.savedURLs, tab.url),
        isTabEnabled: true,
        ...tab
    };
    extensionTabs.push(updatedTabData);
    sendToggledStateToContentScript(tab.id, true);
    if (instantSave)
        saveExtTabs();
    else
        debouncedSaveExtTabs();
}
async function handleTabUpdate(tab) {
    const tabId = tab.id;
    const url = tab.url;
    let extTab = extensionTabs.find((t) => t.id === tabId);
    if (isURLMatch(settings.savedURLs, url) && !extTab) {
        if (!extTab) {
            await addExtensionTab(tab, true);
            return;
        }
    }
    if (isURLMatch([...settings.savedURLs, ...allowedURLs], url)) {
        if (extTab) {
            try {
                if (extTab.url && new URL(extTab.url).origin !== new URL(url).origin) {
                    if (!settings.tabExclusive && !allTabsModeIsOn) {
                        removeExtensionTab(extTab, true);
                        return;
                    }
                }
                await updateExtensionTab(tab);
                return;
            }
            catch (error) {
                console.error("Error comparing origins", error);
                return;
            }
        }
    }
    if (extTab)
        await updateExtensionTab(tab);
}
;
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.sync.get("settings", (res) => {
        const startUpSetting = (res?.settings).onStartup;
        if (startUpSetting) {
            chrome.tabs.query({}).then((allTabs) => {
                const tabs = allTabs.filter((t) => t.id);
                extensionTabs.splice(0, extensionTabs.length, ...tabs);
                allTabsModeIsOn = true;
                chrome.storage.local.set({ allTabsModeIsOn: true });
                saveExtTabs();
            });
        }
    });
});
chrome.webNavigation.onCommitted.addListener(async (details) => {
    if (details.frameId !== 0)
        return;
    const tabId = details.tabId;
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab)
        return;
    let extTab = extensionTabs.find((t) => t.id === tabId);
    if (allTabsModeIsOn || extTab?.isTabEnabled) {
        await handleTabUpdate(tab);
    }
});
chrome.webNavigation.onCommitted.addListener(async (details) => {
    if (details.frameId !== 0)
        return;
    const tabId = details.tabId;
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab)
        return;
    await handleTabUpdate(tab);
});
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId).catch(() => null);
    if (!tab)
        return;
    for (let extTab of extensionTabs) {
        extTab.active = extTab.id === tab.id;
        extTab.windowActive = extTab.windowId === tab.windowId && tab.windowId === (await getCurrentWindowId());
        await updateExtensionTab(extTab);
    }
});
chrome.windows.onCreated.addListener(async (window) => {
    const extTab = extensionTabs.find((t) => t.active && t.windowActive);
    if (!extTab)
        return;
    const popupTab = (await chrome.tabs.query({ windowId: window.id }).catch(() => null))?.[0];
    if (window.type === "popup" && popupTab) {
        const combinedURLs = [
            ...allowedURLs,
            ...settings.savedURLs,
            new URL(extTab.url).origin,
        ];
        if (!isURLMatch(combinedURLs, popupTab.pendingUrl || popupTab.url)) {
            chrome.windows.remove(window.id).catch(() => null);
        }
    }
});
chrome.tabs.onRemoved.addListener((tabId) => {
    const extTab = extensionTabs.find((t) => t.id === tabId);
    if (!extTab)
        return;
    removeExtensionTab(extTab);
    checkTabs();
});
async function onTabMoved(tabId) {
    const extTab = extensionTabs.find((t) => t.id === tabId);
    if (!extTab)
        return;
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    updateExtensionTab(tab);
}
chrome.tabs.onAttached.addListener(onTabMoved);
chrome.tabs.onDetached.addListener(onTabMoved);
chrome.storage.onChanged.addListener((changes) => {
    const newSettings = changes.settings?.newValue;
    if (newSettings) {
        allowedURLs = [...newSettings.allowedURLs, ...builtInURLs];
        settings = changes.settings.newValue;
    }
    if (changes.extensionTabs?.newValue) {
        setExtensionTabs(changes.extensionTabs.newValue);
    }
    if (changes.allTabsModeIsOn?.newValue) {
        allTabsModeIsOn = changes.allTabsModeIsOn.newValue;
    }
});
chrome.runtime.onMessage.addListener(async (message) => {
    if (message.toggleSingle === true) {
        const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))?.[0];
        const updatedTabData = {
            id: tab.id,
            url: tab.url,
            active: tab.active,
            windowId: tab.windowId,
            windowActive: tab.windowId === (await getCurrentWindowId()),
            savedURL: isURLMatch(settings.savedURLs, tab.url),
            isTabEnabled: true,
            ...tab
        };
        if (!tab)
            return;
        const extTab = extensionTabs.find((t) => t.id === tab.id);
        if (extTab) {
            removeExtensionTab(extTab, true);
        }
        else {
            await addExtensionTab(updatedTabData, true);
        }
    }
    else if (message.toggleAll === true) {
        if (allTabsModeIsOn) {
            extensionTabs.splice(0, extensionTabs.length);
            allTabsModeIsOn = false;
        }
        else {
            const tabs = await chrome.tabs.query({}).catch(() => []);
            extensionTabs.splice(0, extensionTabs.length, ...tabs);
            allTabsModeIsOn = true;
        }
        saveExtTabs();
        chrome.storage.local.set({ allTabsModeIsOn: allTabsModeIsOn });
    }
    else if (message.action === "addTab") {
        await addExtensionTab(message.tab, true);
    }
    else if (message.action === "removeTab") {
        const extTab = extensionTabs.find((t) => t.id === message.tab.id);
        if (extTab)
            removeExtensionTab(extTab, true);
    }
    else if (message.action === "toggleTabEnabled") {
        const tabId = message.tabId;
        const extTab = extensionTabs.find((t) => t.id === tabId);
        if (extTab) {
            extTab.isTabEnabled = !extTab.isTabEnabled;
            await updateExtensionTab(extTab, true);
        }
    }
});
async function setExtensionTabs(newExtensionTabs) {
    extensionTabs.splice(0, extensionTabs.length, ...newExtensionTabs);
    saveExtTabs();
}
async function updateExtensionTab(tab, instantSave = false) {
    if (!tab)
        return;
    let extTabIndex = extensionTabs.findIndex((t) => t.id === tab.id);
    const updatedTabData = {
        id: tab.id,
        url: tab.url,
        active: tab.active,
        windowId: tab.windowId,
        windowActive: tab.windowId === (await getCurrentWindowId()),
        savedURL: isURLMatch(settings.savedURLs, tab.url),
        isTabEnabled: extensionTabs[extTabIndex]?.isTabEnabled ?? true,
        ...tab
    };
    if (extTabIndex >= 0) {
        extensionTabs[extTabIndex] = updatedTabData;
    }
    else {
        extensionTabs.push(updatedTabData);
    }
    sendToggledStateToContentScript(tab.id, true);
    if (instantSave)
        saveExtTabs();
    else
        debouncedSaveExtTabs();
    return updatedTabData;
}
function removeExtensionTab(extTab, instantSave = false) {
    const extTabIndex = extensionTabs.findIndex((t) => t.id === extTab.id);
    if (extTabIndex < 0)
        return;
    extensionTabs.splice(extTabIndex, 1);
    sendToggledStateToContentScript(extTab.id, false);
    if (instantSave)
        saveExtTabs();
    else
        debouncedSaveExtTabs();
}
function saveExtTabs() {
    const extTabsSet = [...new Set(extensionTabs.map((t) => t.id))].map((id) => extensionTabs.find((t) => t.id === id));
    extensionTabs.splice(0, extensionTabs.length, ...extTabsSet);
    console.log("extTabs", extensionTabs);
    chrome.storage.local.set({ extensionTabs: extensionTabs });
    if (!extensionTabs.length) {
        allTabsModeIsOn = false;
        chrome.storage.local.set({ allTabsModeIsOn: false });
    }
}
let debouncedSaveExtTabs = debounce(() => {
    saveExtTabs();
    if (!extensionTabs.length) {
        if (keepAlive)
            clearInterval(keepAlive);
        keepAlive = null;
        allTabsModeIsOn = false;
        return;
    }
    if (!keepAlive)
        persistServiceWorker();
}, 5000);
function sendToggledStateToContentScript(tabId, isToggledOn) {
    chrome.tabs.sendMessage(tabId, { action: "toggleTab", isToggledOn });
}
function persistServiceWorker() {
    if (keepAlive)
        clearInterval(keepAlive);
    keepAlive = setInterval(() => {
        checkTabs();
    }, 1000 * 25);
}
function checkTabs() {
    chrome.tabs.query({}).then((tabs) => {
        for (let i = extensionTabs.length - 1; i >= 0; i--) {
            if (!tabs.find((t) => t.id === extensionTabs[i].id)) {
                extensionTabs.splice(i, 1);
                console.log("Found non-existant tab");
            }
        }
        debouncedSaveExtTabs();
    });
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getTabId") {
        sendResponse({ tabId: sender.tab.id });
    }
    if (message.action === "getTabToggledState") {
        const tabToggledState = extensionTabs.find((t) => t.id === sender.tab.id);
        sendResponse({ tabToggledState: !!tabToggledState });
    }
    if (message.action === "getTabEnabledState") {
        const tabEnabledState = extensionTabs.find((t) => t.id === sender.tab.id)?.isTabEnabled ?? true;
        sendResponse({ tabEnabledState: tabEnabledState });
    }
});
function isURLMatch(urls, url) {
    if (!url)
        return false;
    try {
        const targetHostname = new URL(url).hostname;
        for (const currentUrl of urls) {
            const allowedHostname = new URL(currentUrl).hostname;
            if (targetHostname === allowedHostname) {
                return true;
            }
        }
        return false;
    }
    catch (error) {
        console.error("Invalid URL:", url, error);
        return false;
    }
}
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
async function getCurrentWindowId() {
    const window = await chrome.windows.getCurrent();
    return window.id;
}
(function initializeExtension() {
    chrome.storage.local.get(["extensionTabs"], async (res) => {
        if (!res?.extensionTabs) {
            chrome.storage.local.set({ extensionTabs: [], allTabsModeIsOn: false });
        }
        else {
            setExtensionTabs(res.extensionTabs);
        }
        if (extensionTabs.length) {
            persistServiceWorker();
            checkTabs();
        }
    });
})();
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        chrome.tabs.create({ url: "dist/popup/install.html" });
    }
});
