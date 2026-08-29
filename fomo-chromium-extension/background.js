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
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SET_BADGE") {
    updateBadge(Number(message.count) || 0);
    sendResponse({ ok: true });
  }
});

function updateBadge(count) {
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#6D4AFF" });
}
