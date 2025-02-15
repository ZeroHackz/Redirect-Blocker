# Critical Improvements

## Summary of Changes

### Robust URL matching: Implement hostname matching in isURLMatch and isURLMatchPOPUP in background.ts, content.ts, and script.ts.

### Refactor onCreated and onUpdated: Simplify with early returns, helper functions, and replace setInterval with chrome.webNavigation.onCommitted.

### Decouple All Tabs Mode: Separate All Tabs Mode logic from tab activation.

### Clarify disabledTabs: Review and clarify the disabledTabs function. Remove disabledTabs.splice(0, disabledTabs.length, ...disabledTabs);

###### Updated by ZeroHackz
---------------
# Redirect Blocker

<img src="./extension/img/Icon128.png" />

#### Redirect Blocker saves you from facing potential malicious/annoying redirects when on specific websites.

#### For example, when on websites like Soap2day or other similar sites, you have to fight for your life closing and avoiding redirects to get to the page wanted, but with this extension, it is easy as pie, and a much more pleasant experience.

## How to download?

**Option 1** – Install it from the [Chrome Web Store](https://chrome.google.com/webstore/detail/redirect-blocker/egmgebeelgaakhaoodlmnimbfemfgdah)

**Option 2** – Install it from source:

- Clone/download this repo,
- Open Chrome and go to `chrome://extensions`,
- Enable "Developer mode",
- Click "Load unpacked extension",
- Select the `extension` folder.

## How to turn it on?

#### To turn it on just click the extension icon and a popup will appear, you will be able to turn the extension on, OR use the customizable shortcut: alt + shift + s!

<img src="./images/ShowcaseImg.png" width="500" height="300"/>

###### By Tyson3101
