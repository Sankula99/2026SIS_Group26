import {
  signOut,
  getCurrentUser,
  sendLoginOtp,
  sendSignupOtp,
  verifyEmailOtp,
  getProfile,
  upsertProfile
} from "./src/lib/supabase.js";

const MOCK = {
  friends: [
    { name: "Maya", initials: "MY", status: "DATA2001 · Workshop 02" },
    { name: "Noah", initials: "NO", status: "Free until 2:00 PM" },
    { name: "Priya", initials: "PR", status: "DATA2001 · Workshop 02" },
    { name: "Liam", initials: "LI", status: "On campus today" },
    { name: "Zoe", initials: "ZO", status: "DATA2001 · Workshop 02" },
    { name: "Ethan", initials: "ET", status: "Free after 12:00 PM" }
  ],
  session: {
    subject: "DATA2001",
    activity: "Workshop 02",
    time: "Tuesday · 10:00 AM–12:00 PM",
    friends: ["Maya", "Priya", "Zoe"]
  },
  freeTimes: [
    { time: "Today · 1:00–2:30 PM", title: "You + Noah + Liam", detail: "1 hr 30 min shared break" },
    { time: "Wednesday · 12:00–1:00 PM", title: "You + Maya + Priya", detail: "1 hr shared break" },
    { time: "Thursday · 3:00–5:00 PM", title: "You + Zoe", detail: "2 hr shared break" }
  ],
  notifications: [
    { title: "Priya joined your session", detail: "DATA2001 · Workshop 02", unread: true },
    { title: "Noah wants to meet up", detail: "Today around 1:00 PM", unread: true },
    { title: "Maya updated her timetable", detail: "Your Wednesday overlap changed", unread: false }
  ]
};

const content = document.getElementById("content");
const toast = document.getElementById("toast");
const notificationDot = document.getElementById("notificationDot");

let state = {
  view: "home",
  timetableSharing: true,
  meetupNotifications: true,
  classNotifications: true,
  friendNotifications: true,
  notificationCount: 2,
  currentTab: null,
  isAllocate: false,
  authView: "login",
  email: "",
  otpPurpose: "login",
  otpCode: "",
  user: null,
  authLoading: false,
  authError: ""
};

document.addEventListener("DOMContentLoaded", init);

function persistAuthProgress() {
  return chrome.storage.local.set({
    email: state.email,
    authView: state.authView,
    otpPurpose: state.otpPurpose
  });
}

function init() {
  chrome.storage.local.remove(["password", "mfaEnabled"]);
  chrome.storage.local.get({
    timetableSharing: true,
    meetupNotifications: true,
    classNotifications: true,
    friendNotifications: true,
    notificationCount: 2,
    email: "",
    authView: "login",
    otpPurpose: "login"
  }, async (saved) => {
    Object.assign(state, saved);
    delete state.password;
    delete state.mfaEnabled;
    delete state.mfaCode;
    delete state.mfaSent;
    updateNotificationBadge();

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      state.currentTab = tabs?.[0] || null;
      const haystack = `${state.currentTab?.url || ""} ${state.currentTab?.title || ""}`;
      state.isAllocate = /allocate\+?|timetable|class.?registration/i.test(haystack);
    });

    const user = await getCurrentUser();
    state.user = user || null;
    if (user) {
      state.authView = "home";
    } else if (saved.authView === "otp" && isValidEmail(saved.email)) {
      state.authView = "otp";
      state.otpPurpose = saved.otpPurpose === "signup" ? "signup" : "login";
      state.email = saved.email;
    } else {
      state.authView = saved.authView === "signup" ? "signup" : "login";
    }
    render();
  });

  document.getElementById("homeBtn").addEventListener("click", () => go("home"));
  document.getElementById("settingsBtn").addEventListener("click", () => go("settings"));
  document.getElementById("notificationsBtn").addEventListener("click", openNotifications);
}

function go(view) {
  state.view = view;
  render();
}

function render() {
  if (!state.user) {
    if (state.authView === "signup") {
      renderSignup();
      return;
    }
    if (state.authView === "otp") {
      renderOtp();
      return;
    }
    renderLogin();
    return;
  }

  const renderers = {
    home: renderHome,
    friends: renderFriends,
    free: renderFreeTime,
    meetup: renderMeetup,
    settings: renderSettings,
    notifications: renderNotifications
  };
  (renderers[state.view] || renderHome)();
}

function renderHome() {
  const s = MOCK.session;
  const initials = s.friends.map(name => {
    const friend = MOCK.friends.find(f => f.name === name);
    return `<span class="avatar" title="${escapeHtml(name)}">${friend?.initials || name.slice(0,2).toUpperCase()}</span>`;
  }).join("");

  content.innerHTML = `
    <section class="context-card">
      <div class="context-top">
        <span class="context-label"><span class="status-dot"></span>${state.isAllocate ? "Allocate+ detected" : "Demo timetable active"}</span>
        <span class="context-chip">${state.isAllocate ? "LIVE PAGE" : "MVP DATA"}</span>
      </div>
      <h2>${s.subject} · ${s.activity}</h2>
      <p>${s.time}</p>
      <div class="friend-row">
        <div class="avatar-stack">${initials}</div>
        <div>
          <strong>${s.friends.length} friends in this class</strong>
          <small>${s.friends.join(" · ")}</small>
        </div>
      </div>
    </section>

    <div class="section-title">
      <h3>What do you want to do?</h3>
      <span>6 friends connected</span>
    </div>

    <div class="action-grid">
      <button class="action-card" data-view="friends">
        <span class="action-icon">◎</span>
        <strong>Friends</strong>
        <small>See friends, requests and class activity.</small>
      </button>
      <button class="action-card" data-view="free">
        <span class="action-icon">◷</span>
        <strong>Free Together</strong>
        <small>Find overlapping breaks automatically.</small>
      </button>
      <button class="action-card" data-view="meetup">
        <span class="action-icon">☕</span>
        <strong>Meet Up</strong>
        <small>Send a low-pressure meetup request.</small>
      </button>
      <button class="action-card" id="sessionBtn">
        <span class="action-icon">▦</span>
        <strong>Friends in Classes</strong>
        <small>Compare who is allocated where.</small>
      </button>
    </div>

    <div class="sharing-row">
      <div>
        <strong>Share my timetable</strong>
        <small>${state.timetableSharing ? "Visible to approved friends" : "Your timetable is private"}</small>
      </div>
      <button class="switch ${state.timetableSharing ? "on" : ""}" id="shareToggle" aria-label="Toggle timetable sharing">
        <span></span>
      </button>
    </div>

    <div class="demo-actions">
      <button class="primary-btn" id="overlayBtn">Show FOMO on this page</button>
      <button class="secondary-btn" id="demoBtn">Demo timetable</button>
    </div>
  `;

  content.querySelectorAll("[data-view]").forEach(btn => {
    btn.addEventListener("click", () => go(btn.dataset.view));
  });
  document.getElementById("shareToggle").addEventListener("click", toggleSharing);
  document.getElementById("overlayBtn").addEventListener("click", injectOverlay);
  document.getElementById("demoBtn").addEventListener("click", openDemoPage);
  document.getElementById("sessionBtn").addEventListener("click", () => {
    showToast(`${s.friends.join(", ")} are in ${s.activity}.`);
  });
}

function renderFriends() {
  content.innerHTML = `
    ${heading("Friends", "Only accepted friends can see shared timetable information.")}
    <div class="list">
      ${MOCK.friends.map(friend => `
        <div class="list-item">
          <span class="list-avatar">${friend.initials}</span>
          <div class="list-copy">
            <strong>${friend.name}</strong>
            <small>${friend.status}</small>
          </div>
          <span class="trailing">›</span>
        </div>
      `).join("")}
    </div>
  `;
  wireBack();
}

function renderFreeTime() {
  content.innerHTML = `
    ${heading("Free Together", "Suggested from timetable overlap — nothing is booked automatically.")}
    ${MOCK.freeTimes.map((slot, i) => `
      <section class="free-card">
        <span class="time">${slot.time}</span>
        <h4>${slot.title}</h4>
        <p>${slot.detail}</p>
        <button class="mini-btn" data-slot="${i}">Suggest meetup</button>
      </section>
    `).join("")}
  `;
  wireBack();
  content.querySelectorAll("[data-slot]").forEach(btn => {
    btn.addEventListener("click", () => {
      const slot = MOCK.freeTimes[Number(btn.dataset.slot)];
      showToast(`Meetup suggestion ready for ${slot.time}.`);
      setTimeout(() => go("meetup"), 350);
    });
  });
}

function renderMeetup() {
  content.innerHTML = `
    ${heading("Meet Up", "Choose a friend. They receive a request — not an automatic event.")}
    <div class="list">
      ${MOCK.friends.map((friend, i) => `
        <button class="list-item clickable" data-friend="${i}" style="width:100%; text-align:left;">
          <span class="list-avatar">${friend.initials}</span>
          <span class="list-copy">
            <strong>${friend.name}</strong>
            <small>${i % 2 === 0 ? "Shared free time today" : "On campus today"}</small>
          </span>
          <span class="trailing">Send →</span>
        </button>
      `).join("")}
    </div>
  `;
  wireBack();
  content.querySelectorAll("[data-friend]").forEach(btn => {
    btn.addEventListener("click", () => {
      const friend = MOCK.friends[Number(btn.dataset.friend)];
      btn.querySelector(".trailing").textContent = "Sent ✓";
      btn.disabled = true;
      showToast(`Meetup request sent to ${friend.name}.`);
    });
  });
}

function renderSettings() {
  content.innerHTML = `
    ${heading("Privacy & Settings", "The MVP keeps timetable sharing opt-in and reversible.")}
    <div class="settings-group">
      ${settingLine("Timetable sharing", state.timetableSharing, "timetableSharing", "Let approved friends see your timetable")}
    </div>
    <div class="settings-group">
      ${settingLine("Friend requests", state.friendNotifications, "friendNotifications", "Notify when someone wants to connect")}
      ${settingLine("Friends joining classes", state.classNotifications, "classNotifications", "Notify when overlap may have changed")}
      ${settingLine("Meetup requests", state.meetupNotifications, "meetupNotifications", "Notify when a friend wants to meet")}
    </div>
    <div class="settings-group">
      <div class="settings-line">
        <div>
          <strong>Account</strong>
          <small>${state.user ? escapeHtml(state.user.email || "") : "Not signed in"}</small>
        </div>
        ${state.user ? `<button class="secondary-btn" id="logoutBtn" style="height:30px;border-radius:8px;font-size:9px;font-weight:800;">Sign out</button>` : ""}
      </div>
    </div>
  `;
  wireBack();
  content.querySelectorAll("[data-setting]").forEach(button => {
    button.addEventListener("click", () => {
      toggleSetting(button.dataset.setting);
    });
  });

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await handleLogout();
    });
  }
}

function renderNotifications() {
  content.innerHTML = `
    ${heading("Notifications", "Useful updates without changing your timetable for you.")}
    <div class="list">
      ${MOCK.notifications.map(n => `
        <div class="list-item">
          ${n.unread ? '<span class="notification-unread"></span>' : '<span style="width:7px"></span>'}
          <div class="list-copy">
            <strong>${n.title}</strong>
            <small>${n.detail}</small>
          </div>
        </div>
      `).join("")}
    </div>
  `;
  wireBack();
}

function renderLogin() {
  content.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-header">
          <span class="brand-mark">F</span>
          <div>
            <strong>Welcome back</strong>
            <small>We'll email you a sign-in code</small>
          </div>
        </div>
        ${state.authError ? `<div class="auth-error">${escapeHtml(state.authError)}</div>` : ""}
        <div class="auth-field">
          <label for="loginEmail">Email</label>
          <input id="loginEmail" type="email" value="${escapeHtml(state.email)}" placeholder="you@uni.edu.au" autocomplete="email" ${state.authLoading ? "disabled" : ""} />
        </div>
        <button class="primary-btn auth-submit" id="loginSubmit" ${state.authLoading ? "disabled" : ""}>${state.authLoading ? "Sending code..." : "Send sign-in code"}</button>
        <button class="link-btn" id="goSignup">Create an account</button>
      </div>
    </div>
  `;

  document.getElementById("loginSubmit").addEventListener("click", handleLogin);
  document.getElementById("loginEmail").addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleLogin();
  });
  document.getElementById("goSignup").addEventListener("click", () => {
    state.authView = "signup";
    state.authError = "";
    persistAuthProgress();
    render();
  });
}

function renderSignup() {
  content.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-header">
          <span class="brand-mark">F</span>
          <div>
            <strong>Create account</strong>
            <small>Join FOMO with your uni email</small>
          </div>
        </div>
        ${state.authError ? `<div class="auth-error">${escapeHtml(state.authError)}</div>` : ""}
        <div class="auth-field">
          <label for="signupEmail">Email</label>
          <input id="signupEmail" type="email" value="${escapeHtml(state.email)}" placeholder="you@uni.edu.au" autocomplete="email" ${state.authLoading ? "disabled" : ""} />
        </div>
        <button class="primary-btn auth-submit" id="signupSubmit" ${state.authLoading ? "disabled" : ""}>${state.authLoading ? "Sending code..." : "Send verification code"}</button>
        <button class="link-btn" id="goLogin">Already have an account? Sign in</button>
      </div>
    </div>
  `;

  document.getElementById("signupSubmit").addEventListener("click", handleSignup);
  document.getElementById("signupEmail").addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleSignup();
  });
  document.getElementById("goLogin").addEventListener("click", () => {
    state.authView = "login";
    state.authError = "";
    persistAuthProgress();
    render();
  });
}

function renderOtp() {
  const otpTitle = state.otpPurpose === "signup" ? "Verify your email" : "Check your email";
  content.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-header">
          <span class="brand-mark">F</span>
          <div>
            <strong>${otpTitle}</strong>
            <small>Enter the 6-digit code sent to ${escapeHtml(state.email || "your email")}</small>
          </div>
        </div>
        ${state.authError ? `<div class="auth-error">${escapeHtml(state.authError)}</div>` : ""}
        <div class="auth-field">
          <label for="otpCodeInput">Code</label>
          <input id="otpCodeInput" type="text" inputmode="numeric" maxlength="8" placeholder="123456" autocomplete="one-time-code" value="${escapeHtml(state.otpCode)}" ${state.authLoading ? "disabled" : ""} />
        </div>
        <button class="primary-btn auth-submit" id="otpVerifyBtn" ${state.authLoading ? "disabled" : ""}>${state.authLoading ? "Verifying..." : "Verify"}</button>
        <button class="link-btn" id="otpResendBtn" ${state.authLoading ? "disabled" : ""}>Resend code</button>
        <button class="link-btn" id="otpBackBtn">Use a different email</button>
      </div>
    </div>
  `;

  document.getElementById("otpVerifyBtn").addEventListener("click", handleOtpVerify);
  document.getElementById("otpCodeInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleOtpVerify();
  });
  document.getElementById("otpResendBtn").addEventListener("click", handleOtpResend);
  document.getElementById("otpBackBtn").addEventListener("click", () => {
    state.authView = state.otpPurpose === "signup" ? "signup" : "login";
    state.authError = "";
    persistAuthProgress();
    render();
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendAuthOtp(purpose) {
  const send = purpose === "signup" ? sendSignupOtp : sendLoginOtp;
  const { error } = await send(state.email);
  if (error) {
    const message = error.message || "Could not send the verification code.";
    if (purpose === "login" && /signup|not (found|registered)|does not exist/i.test(message)) {
      return "No account found for that email. Create an account first.";
    }
    return message;
  }
  return null;
}

async function handleSignup() {
  const email = document.getElementById("signupEmail")?.value?.trim() || "";
  if (!isValidEmail(email)) {
    state.authError = "Please enter a valid email address.";
    render();
    return;
  }

  state.email = email;
  state.otpPurpose = "signup";
  state.authView = "otp";
  state.authLoading = true;
  state.authError = "";
  await persistAuthProgress();
  render();

  const errorMessage = await sendAuthOtp("signup");
  state.authLoading = false;
  if (errorMessage) {
    state.authError = errorMessage;
    state.authView = "signup";
    await persistAuthProgress();
    render();
    return;
  }

  showToast("Verification code sent to your email.");
  render();
}

async function handleLogin() {
  const email = document.getElementById("loginEmail")?.value?.trim() || "";
  if (!isValidEmail(email)) {
    state.authError = "Please enter a valid email address.";
    render();
    return;
  }

  state.email = email;
  state.otpPurpose = "login";
  state.authView = "otp";
  state.authLoading = true;
  state.authError = "";
  await persistAuthProgress();
  render();

  const errorMessage = await sendAuthOtp("login");
  state.authLoading = false;
  if (errorMessage) {
    state.authError = errorMessage;
    state.authView = "login";
    await persistAuthProgress();
    render();
    return;
  }

  showToast("Sign-in code sent to your email.");
  render();
}

async function handleOtpVerify() {
  const token = (document.getElementById("otpCodeInput")?.value || "").replace(/\s+/g, "");
  state.otpCode = token;
  if (!token) {
    state.authError = "Please enter the verification code.";
    render();
    return;
  }

  state.authLoading = true;
  state.authError = "";
  render();

  const { data, error } = await verifyEmailOtp(state.email, token);
  state.authLoading = false;

  if (error || !data?.user) {
    state.authError = error?.message || "Invalid or expired code.";
    render();
    return;
  }

  await completeAuth(data.user);
}

async function handleOtpResend() {
  if (!isValidEmail(state.email)) {
    state.authError = "Please enter a valid email address.";
    state.authView = state.otpPurpose === "signup" ? "signup" : "login";
    persistAuthProgress();
    render();
    return;
  }

  state.authLoading = true;
  state.authError = "";
  await persistAuthProgress();
  render();

  const errorMessage = await sendAuthOtp(state.otpPurpose);
  state.authLoading = false;
  if (errorMessage) {
    state.authError = errorMessage;
    persistAuthProgress();
    render();
    return;
  }

  persistAuthProgress();
  showToast("A new code was sent to your email.");
  render();
}

async function completeAuth(user) {
  state.user = user;
  state.view = "home";
  state.authView = "home";
  state.authError = "";
  state.otpCode = "";

  const { data: profile } = await getProfile(user.id);
  if (!profile) {
    await upsertProfile({ id: user.id, email: user.email });
  }

  await persistAuthProgress();
  showToast("Signed in successfully.");
  render();
}

async function handleLogout() {
  await signOut();
  state.user = null;
  state.authView = "login";
  state.authError = "";
  state.otpCode = "";
  await persistAuthProgress();
  showToast("Signed out.");
  render();
}

function heading(title, subtitle) {
  return `
    <div class="view-heading">
      <button class="back-link" data-back>← Back</button>
      <h2>${title}</h2>
      <p>${subtitle}</p>
    </div>
  `;
}

function wireBack() {
  const back = content.querySelector("[data-back]");
  if (back) back.addEventListener("click", () => go("home"));
}

function settingLine(title, enabled, key, detail) {
  return `
    <div class="settings-line">
      <div>
        <strong>${title}</strong>
        <small>${detail}</small>
      </div>
      <button class="switch ${enabled ? "on" : ""}" data-setting="${key}" aria-label="${title}">
        <span></span>
      </button>
    </div>
  `;
}

function toggleSharing() {
  state.timetableSharing = !state.timetableSharing;
  chrome.storage.local.set({ timetableSharing: state.timetableSharing });
  render();
  showToast(state.timetableSharing ? "Timetable sharing turned on." : "Timetable sharing turned off.");
}

function toggleSetting(key) {
  state[key] = !state[key];
  chrome.storage.local.set({ [key]: state[key] });
  render();
  showToast(`${prettyKey(key)} ${state[key] ? "enabled" : "disabled"}.`);
}

function prettyKey(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
}

function openNotifications() {
  state.view = "notifications";
  state.notificationCount = 0;
  chrome.storage.local.set({ notificationCount: 0 });
  chrome.runtime.sendMessage({ type: "SET_BADGE", count: 0 });
  updateNotificationBadge();
  render();
}

function updateNotificationBadge() {
  notificationDot.textContent = state.notificationCount;
  notificationDot.style.display = state.notificationCount > 0 ? "grid" : "none";
}

function openDemoPage() {
  chrome.tabs.create({ url: chrome.runtime.getURL("demo.html") });
}

function injectOverlay() {
  if (!state.currentTab?.id) {
    showToast("No active tab available.");
    return;
  }

  const session = MOCK.session;

  chrome.scripting.executeScript({
    target: { tabId: state.currentTab.id },
    func: (sessionData) => {
      const existing = document.getElementById("fomo-demo-overlay");
      if (existing) existing.remove();

      const root = document.createElement("div");
      root.id = "fomo-demo-overlay";
      root.innerHTML = `
        <div style="font: 13px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                    width:300px;background:#fff;color:#19172a;border:1px solid #e6e1f6;
                    border-radius:18px;box-shadow:0 18px 50px rgba(36,28,74,.24);overflow:hidden;">
          <div style="padding:14px 15px;background:linear-gradient(135deg,#34255f,#6d4aff);color:#fff;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:14px">FOMO</strong>
              <button id="fomo-close" style="border:0;background:rgba(255,255,255,.15);color:#fff;width:24px;height:24px;border-radius:8px;cursor:pointer">×</button>
            </div>
            <div style="margin-top:12px;font-size:11px;opacity:.8">Friends in this session</div>
            <div style="font-size:16px;font-weight:800;margin-top:2px">${sessionData.subject} · ${sessionData.activity}</div>
            <div style="font-size:11px;opacity:.8;margin-top:2px">${sessionData.time}</div>
          </div>
          <div style="padding:13px 15px;">
            <div style="font-size:11px;font-weight:800">${sessionData.friends.length} friends are going</div>
            <div style="font-size:10px;color:#746f89;margin-top:3px">${sessionData.friends.join(" · ")}</div>
            <button id="fomo-meet" style="width:100%;margin-top:11px;border:0;border-radius:10px;padding:9px;background:#6d4aff;color:#fff;font-size:10px;font-weight:800;cursor:pointer">Suggest a meetup</button>
          </div>
        </div>
      `;
      Object.assign(root.style, {
        position: "fixed",
        right: "22px",
        bottom: "22px",
        zIndex: "2147483647"
      });
      document.documentElement.appendChild(root);

      root.querySelector("#fomo-close").addEventListener("click", () => root.remove());
      root.querySelector("#fomo-meet").addEventListener("click", (event) => {
        event.currentTarget.textContent = "Meetup request sent ✓";
        event.currentTarget.style.background = "#1f9d67";
      });
    },
    args: [session]
  }, () => {
    if (chrome.runtime.lastError) {
      showToast("Chrome blocks extensions on this page. Try a normal website tab.");
    } else {
      showToast("FOMO overlay added to the page.");
    }
  });
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2100);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
