const toggleBtn = document.querySelector(".toggleBtn");
const currentTabExtMode = document.querySelector(".currentTabExtMode");
const allTabsExtMode = document.querySelector(".allTabsExtMode");
const savedURLsInput = document.querySelector("#savedURLs");
const allowedURLsInput = document.querySelector("#allowedURLS");
const tabExclusiveSelect = document.querySelector("#turnOffOnWhen");
const preventSameTabRedirectsSelect = document.querySelector("#preventSameTabRedirects");
const shortCutSingleInput = document.querySelector("#shortCutSingleInput");
const shortCutAllInput = document.querySelector("#shortCutAllInput");
const onStartup = document.querySelector("#onStartup");
const shortCutBtn = document.querySelector("#shortCutBtn");
const shortCutSingleDisplay = document.querySelector("#shortCutSingleDisplay");
const shortCutAllDisplay = document.querySelector("#shortCutAllDisplay");
const nextSettings = document.querySelector("#nextSettings");
const backSettings = document.querySelector("#backSettings");
const pageNumber = document.querySelector("#pageNumber");
const pageList = document.querySelector(".pageList");
const changeToAllowedURL = document.querySelector("#changeToAllowedURLPage");
const changeToSavedURL = document.querySelector("#changeToSavedURLPage");
const placeholderSettings = {
    tabExclusive: false,
    preventSameTabRedirects: false,
    savedURLs: ["https://soap2day.day/", "https://vipleague.im/"],
    allowedURLs: ["https://youtube.com/@Tyson3101"],
    shortCutToggleSingleKeys: ["alt", "shift", "s"],
    shortCutToggleAllKeys: ["alt", "shift", "a"],
    onStartup: false,
};
let extensionModePopUp = "single";
let allTabsModeIsOn_POPUP = false;
let currentTabIsOn_POPUP = false;
let isTabEnabled_POPUP = true;
async function addExtensionTabToBackground(tab) {
    await chrome.runtime.sendMessage({ action: "addTab", tab: tab });
}
async function removeExtensionTabFromBackground(tab) {
    await chrome.runtime.sendMessage({ action: "removeTab", tab: tab });
}
async function toggleTabEnabled(tabId) {
    await chrome.runtime.sendMessage({
        action: "toggleTabEnabled",
        tabId: tabId,
    });
}
async function setAllTabsMode(allTabsMode) {
    chrome.storage.local.set({ allTabsModeIsOn: allTabsMode });
    allTabsModeIsOn_POPUP = allTabsMode;
    currentTabIsOn_POPUP = allTabsMode;
    changeToggleButton(allTabsMode);
}
changeToAllowedURL.onclick = () => {
    document.querySelector("#savedURLsPage").classList.add("remove");
    document.querySelector("#allowedURLsPage").classList.remove("remove");
};
changeToSavedURL.onclick = () => {
    document.querySelector("#allowedURLsPage").classList.add("remove");
    document.querySelector("#savedURLsPage").classList.remove("remove");
};
chrome.storage.local.get("extensionTabs", async ({ extensionTabs }) => {
    if (!extensionTabs)
        extensionTabs = [];
    const activeTab = (await chrome.tabs
        .query({ active: true, currentWindow: true })
        .catch(() => null))?.[0];
    if (!activeTab)
        return;
    const extTab = extensionTabs.find((tab) => tab.id === activeTab.id);
    if (extTab) {
        changeToggleButton(extTab.isTabEnabled);
        currentTabIsOn_POPUP = true;
        isTabEnabled_POPUP = extTab.isTabEnabled;
    }
    else {
        changeToggleButton(false);
        isTabEnabled_POPUP = true;
    }
});
chrome.storage.local.get("allTabsModeIsOn", ({ allTabsModeIsOn }) => {
    if (allTabsModeIsOn) {
        allTabsModeIsOn_POPUP = true;
    }
});
toggleBtn.onclick = async () => {
    const activeTab = (await chrome.tabs
        .query({ active: true, currentWindow: true })
        .catch(() => null))?.[0];
    if (!activeTab)
        return;
    chrome.storage.local.get(["extensionTabs", "allTabsModeIsOn"], async ({ extensionTabs, allTabsModeIsOn }) => {
        if (!extensionTabs)
            extensionTabs = [];
        if (extensionModePopUp === "single") {
            const extTab = extensionTabs.find((tab) => tab.id === activeTab.id);
            if (extTab) {
                await toggleTabEnabled(activeTab.id);
                isTabEnabled_POPUP = !isTabEnabled_POPUP;
                changeToggleButton(isTabEnabled_POPUP);
            }
            else {
                addExtensionTabToBackground(activeTab);
                const savedURL = isURLMatchPOPUP(savedURLsInput.value.split("\n"), activeTab.url);
                extensionTabs.push({ ...activeTab, savedURL, isTabEnabled: true });
                currentTabIsOn_POPUP = true;
                isTabEnabled_POPUP = true;
                changeToggleButton(true);
            }
            chrome.storage.local.set({ extensionTabs });
        }
        else {
            if (allTabsModeIsOn_POPUP) {
                allTabsModeIsOn = false;
            }
            else {
                allTabsModeIsOn = true;
            }
            setAllTabsMode(allTabsModeIsOn);
        }
    });
};
currentTabExtMode.onclick = () => {
    changeExtensionMode("single");
};
allTabsExtMode.onclick = () => {
    changeExtensionMode("all");
};
shortCutBtn.onclick = () => {
    document.querySelector(".shortCuts").classList.toggle("remove");
    shortCutBtn.innerText =
        shortCutBtn.innerText === "Show Shortcuts"
            ? "Hide Shortcuts"
            : "Show Shortcuts";
};
function changeExtensionMode(result) {
    currentTabExtMode.classList.remove("selected");
    allTabsExtMode.classList.remove("selected");
    if (result === "single") {
        extensionModePopUp = "single";
        currentTabExtMode.classList.add("selected");
        if (currentTabIsOn_POPUP) {
            changeToggleButton(isTabEnabled_POPUP);
        }
        else {
            changeToggleButton(false);
        }
    }
    else {
        extensionModePopUp = "all";
        allTabsExtMode.classList.add("selected");
        document
            .querySelector(".shortCutSingleContainer")
            .classList.add("hideShortCut");
        document
            .querySelector(".shortCutAllContainer")
            .classList.remove("hideShortCut");
        if (allTabsModeIsOn_POPUP) {
            changeToggleButton(true);
        }
        else {
            changeToggleButton(false);
        }
    }
}
chrome.storage.sync.get("settings", (result) => {
    if (!result.settings) {
        result.settings = placeholderSettings;
    }
    updateSettingsUI(result.settings);
    handleSettingsChange();
});
chrome.storage.onChanged.addListener((changes) => {
    if (!changes.settings)
        return;
    updateSettingsUI(changes.settings.newValue);
});
function updateSettingsUI(settings) {
    if (!settings)
        settings = placeholderSettings;
    savedURLsInput.value = settings.savedURLs.join("\n");
    allowedURLsInput.value = settings.allowedURLs.join("\n");
    tabExclusiveSelect.value = settings.tabExclusive ? "tab" : "url";
    preventSameTabRedirectsSelect.value = settings.preventSameTabRedirects
        ? "true"
        : "false";
    shortCutSingleInput.value = settings.shortCutToggleSingleKeys.join(" + ");
    shortCutAllInput.value = settings.shortCutToggleAllKeys.join(" + ");
    shortCutSingleDisplay.innerText =
        settings.shortCutToggleSingleKeys.join(" + ");
    shortCutAllDisplay.innerText = settings.shortCutToggleAllKeys.join(" + ");
    onStartup.value = settings.onStartup ? "true" : "false";
}
function handleSettingsChange() {
    savedURLsInput.onchange = () => {
        const savedURLs = savedURLsInput.value
            .trim()
            .split("\n")
            .filter(isValidURL);
        saveSettings("savedURLs", savedURLs);
    };
    allowedURLsInput.onchange = () => {
        const allowedURLs = allowedURLsInput.value
            .trim()
            .split("\n")
            .filter(isValidURL);
        saveSettings("allowedURLs", allowedURLs);
    };
    tabExclusiveSelect.onchange = () => {
        const tabExclusive = tabExclusiveSelect.value === "tab";
        saveSettings("tabExclusive", tabExclusive);
    };
    preventSameTabRedirectsSelect.onchange = () => {
        const preventSameTabRedirects = preventSameTabRedirectsSelect.value === "true";
        saveSettings("preventSameTabRedirects", preventSameTabRedirects);
    };
    shortCutSingleInput.onchange = () => {
        const shortCut = shortCutSingleInput.value
            .trim()
            .split("+")
            .map((s) => s.trim().toLowerCase());
        saveSettings("shortCutToggleSingleKeys", shortCut);
    };
    shortCutAllInput.onchange = () => {
        const shortCut = shortCutAllInput.value
            .trim()
            .split("+")
            .map((s) => s.trim().toLowerCase());
        saveSettings("shortCutToggleAllKeys", shortCut);
    };
    onStartup.onchange = () => {
        const onStartupValue = onStartup.value === "true";
        saveSettings("onStartup", onStartupValue);
    };
    function saveSettings(setting, value) {
        chrome.storage.sync.get("settings", (result) => {
            const settings = result.settings;
            chrome.storage.sync.set({
                settings: { ...settings, [setting]: value },
            });
        });
    }
    nextSettings.onclick = () => {
        const settingPage = document.querySelectorAll(".settingsPage");
        const active = [...settingPage].find((page) => page.classList.contains("active"));
        const next = (() => {
            const nextIndex = parseInt(active.dataset["settingindex"]) + 1;
            if (nextIndex >= settingPage.length)
                return settingPage[0];
            return settingPage[nextIndex];
        })();
        pageNumber.innerText = `${parseInt(next.dataset["settingindex"]) + 1}/5`;
        active.classList.remove("active");
        next.classList.add("active");
        pageList.querySelector(".active").classList.remove("active");
        pageList.children[parseInt(next.dataset["settingindex"])].classList.add("active");
    };
    backSettings.onclick = () => {
        const settingPage = document.querySelectorAll(".settingsPage");
        const active = [...settingPage].find((page) => page.classList.contains("active"));
        const last = (() => {
            const lastIndex = parseInt(active.dataset["settingindex"]) - 1;
            if (lastIndex < 0) {
                pageNumber.innerText = `5/5`;
                return settingPage[4];
            }
            else {
                pageNumber.innerText = `${parseInt(active.dataset["settingindex"])}/5`;
                return settingPage[lastIndex];
            }
        })();
        active.classList.remove("active");
        last.classList.add("active");
        pageList.querySelector(".active").classList.remove("active");
        pageList.children[parseInt(last.dataset["settingindex"])].classList.add("active");
    };
}
pageList.onclick = (e) => {
    const ele = e.target;
    if (ele?.tagName?.toLowerCase() == "a") {
        const settingPage = document.querySelectorAll(".settingsPage");
        const activePage = [...settingPage].find((page) => page.classList.contains("active"));
        const nextPage = settingPage[parseInt(ele.dataset["pageindex"])];
        pageNumber.innerText = `${parseInt(nextPage.dataset["settingindex"]) + 1}/5`;
        activePage.classList.remove("active");
        nextPage.classList.add("active");
        pageList.querySelector(".active").classList.remove("active");
        ele.classList.add("active");
    }
};
function changeToggleButton(result) {
    toggleBtn.innerText = result ? "Turn Off" : "Turn On";
    toggleBtn.classList.remove(result ? "off" : "on");
    toggleBtn.classList.add(result ? "on" : "off");
    toggleBtn.classList.remove("loading");
}
function isValidURL(url) {
    try {
        new URL(url);
        return true;
    }
    catch (err) {
        return false;
    }
}
function isURLMatchPOPUP(urls, url) {
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
