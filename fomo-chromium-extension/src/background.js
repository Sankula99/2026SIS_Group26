import { createClerkClient } from "@clerk/chrome-extension/background";
import { CLERK_PUBLISHABLE_KEY } from "./lib/config.js";

const DEFAULTS = {
  timetableSharing: true,
  meetupNotifications: true,
  classNotifications: true,
  friendNotifications: true,
  notificationCount: 2
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(DEFAULTS, (items) => {
    chrome.storage.local.set(items);
    updateBadge(items.notificationCount ?? 2);
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get({ notificationCount: 2 }, ({ notificationCount }) => {
    updateBadge(notificationCount);
  });
  refreshClerkSession();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SET_BADGE") {
    updateBadge(Number(message.count) || 0);
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "CLERK_GET_TOKEN") {
    getClerkToken()
      .then((token) => sendResponse({ token }))
      .catch((error) => sendResponse({ token: null, error: error.message }));
    return true;
  }
});

function updateBadge(count) {
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#6D4AFF" });
}

async function getBackgroundClerk() {
  if (!CLERK_PUBLISHABLE_KEY) return null;
  return createClerkClient({
    publishableKey: CLERK_PUBLISHABLE_KEY
  });
}

async function refreshClerkSession() {
  try {
    await getBackgroundClerk();
  } catch (error) {
    console.warn("Clerk session refresh skipped:", error?.message || error);
  }
}

async function getClerkToken() {
  const clerk = await getBackgroundClerk();
  if (!clerk?.session) return null;
  return clerk.session.getToken();
}

refreshClerkSession();
