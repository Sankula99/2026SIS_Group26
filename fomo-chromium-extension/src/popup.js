import {
  getClerk,
  getCurrentUser,
  signOut,
  sendLoginOtp,
  sendSignupOtp,
  verifyEmailOtp
} from "./lib/clerk.js";
import { getProfile, upsertProfile } from "./lib/supabase.js";

const SUBJECTS = [
  {
    id: "41172_SPR_U_1_S",
    code: "41172_SPR_U_1_S",
    name: "Software Innovation Studio",
    activities: [
      {
        name: "Tutorial 1",
        icon: "book",
        sessions: [
          {
            id: "Activity 01",
            day: "Tuesday",
            time: "10:00 am – 12:00 pm",
            campus: "City (U)",
            location: "CB11.06.101",
            friends: ["Priyanka Ravi"]
          }
        ]
      },
      {
        name: "Seminar 1",
        icon: "seminar",
        sessions: [
          {
            id: "Activity 01",
            day: "Wednesday",
            time: "2:00 pm – 3:00 pm",
            campus: "City (U)",
            location: "CB11.06.101",
            friends: ["Shristi Shrestha"]
          }
        ]
      },
      {
        name: "Workshop 1",
        icon: "workshop",
        sessions: [
          {
            id: "Activity 01",
            day: "Monday",
            time: "10:00 am – 12:00 pm",
            campus: "City (U)",
            location: "CB11.06.101",
            friends: ["Priyanka Ravi", "Shristi Shrestha", "Alice Liang"]
          },
          {
            id: "Activity 02",
            day: "Tuesday",
            time: "10:00 am – 11:00 am",
            campus: "City (U)",
            location: "CB11.B1.102",
            friends: ["Priyanka Ravi", "Arav Lal"]
          }
        ]
      },
      {
        name: "Computer Lab",
        icon: "lab",
        sessions: [
          {
            id: "Activity 01",
            day: "Thursday",
            time: "1:00 pm – 3:00 pm",
            campus: "City (U)",
            location: "CB11.06.101",
            friends: ["Jack Merton"]
          }
        ]
      }
    ]
  },
  {
    id: "41181_SPR_U_1_S",
    code: "41181_SPR_U_1_S",
    name: "Information Security and Management",
    activities: [
      {
        name: "Tutorial 1",
        icon: "book",
        sessions: [
          {
            id: "Activity 01",
            day: "Wednesday",
            time: "10:00 am – 12:00 pm",
            campus: "City (U)",
            location: "UTS City Campus",
            friends: ["Priyanka Ravi", "Omar Yang"]
          }
        ]
      }
    ]
  },
  {
    id: "48730_SPR_U_1_S",
    code: "48730_SPR_U_1_S",
    name: "Cybersecurity",
    activities: [
      {
        name: "Tutorial 1",
        icon: "book",
        sessions: [
          {
            id: "Activity 01",
            day: "Thursday",
            time: "11:00 am – 1:00 pm",
            campus: "City (U)",
            location: "UTS City Campus",
            friends: ["Alice Liang"]
          }
        ]
      }
    ]
  },
  {
    id: "41030_SPR_U_1_S",
    code: "41030_SPR_U_1_S",
    name: "Engineering Capstone",
    activities: [
      {
        name: "Workshop 1",
        icon: "workshop",
        sessions: [
          {
            id: "Activity 01",
            day: "Friday",
            time: "9:00 am – 11:00 am",
            campus: "City (U)",
            location: "UTS City Campus",
            friends: ["Priyanka Ravi"]
          }
        ]
      }
    ]
  }
];

const PEOPLE = [
  { name: "Priyanka Ravi", close: true, sharedSubjectIds: ["41172_SPR_U_1_S", "41181_SPR_U_1_S", "41030_SPR_U_1_S"] },
  { name: "Shristi Shrestha", close: true, sharedSubjectIds: ["41172_SPR_U_1_S", "48730_SPR_U_1_S"] },
  { name: "Nathan Cole", close: false, sharedSubjectIds: ["41181_SPR_U_1_S"] },
  { name: "Arav Lal", close: false, sharedSubjectIds: ["41172_SPR_U_1_S", "41030_SPR_U_1_S"] },
  { name: "Omar Yang", close: false, sharedSubjectIds: ["41181_SPR_U_1_S"] },
  { name: "Alice Liang", close: false, sharedSubjectIds: ["41172_SPR_U_1_S", "48730_SPR_U_1_S"] },
  { name: "Jack Merton", close: false, sharedSubjectIds: ["41172_SPR_U_1_S"] }
];

const NOTIFICATIONS = [
  { title: "Priyanka joined an activity", detail: "Software Innovation Studio · Workshop 1", unread: true },
  { title: "Friend request received", detail: "Open People to review it", unread: true },
  { title: "Shared availability changed", detail: "Your timetable overlap was updated", unread: false }
];

const content = document.getElementById("content");
const paperStack = document.getElementById("paperStack");
const toast = document.getElementById("toast");

let state = {
  view: "home",
  timetableSharing: true,
  meetupNotifications: true,
  classNotifications: true,
  friendNotifications: true,
  notificationCount: 2,
  currentTab: null,
  isTimetable: false,
  authView: "welcome",
  email: "",
  otpPurpose: "login",
  otpCode: "",
  user: null,
  profile: null,
  authLoading: false,
  authError: "",
  selectedSubjectId: SUBJECTS[0].id,
  selectedActivityName: "Workshop 1",
  selectedSessionId: "Activity 01",
  selectedPersonName: PEOPLE[0].name,
  returnView: "home"
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  chrome.storage.local.remove(["password", "mfaEnabled", "fomo-auth-session"]);

  const saved = await chrome.storage.local.get({
    timetableSharing: true,
    meetupNotifications: true,
    classNotifications: true,
    friendNotifications: true,
    notificationCount: 2,
    email: "",
    authView: "welcome",
    otpPurpose: "login"
  });

  Object.assign(state, saved);

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  state.currentTab = tabs?.[0] || null;
  const haystack = `${state.currentTab?.url || ""} ${state.currentTab?.title || ""}`;
  state.isTimetable = /mytimetable|allocate\+?|timetable|class.?registration/i.test(haystack);

  let authReady = false;
  try {
    const clerk = await getClerk();
    clerk.addListener(() => {
      if (!authReady) return;
      const nextUser = clerk.user
        ? {
            id: clerk.user.id,
            email:
              clerk.user.primaryEmailAddress?.emailAddress ||
              clerk.user.emailAddresses?.[0]?.emailAddress ||
              ""
          }
        : null;

      const signedInChanged = Boolean(nextUser) !== Boolean(state.user);
      state.user = nextUser;
      if (!nextUser) {
        state.profile = null;
        state.authView = "welcome";
        state.view = "home";
      }
      if (signedInChanged) render();
    });
  } catch (error) {
    state.authError = error?.message || "Clerk failed to load.";
  }

  try {
    const user = await getCurrentUser();
    state.user = user || null;

    if (user) {
      try {
        const { data: profile } = await getProfile(user.id);
        state.profile = profile || null;
      } catch (_error) {
        // Clerk IDs are not Supabase auth UUIDs on this branch, so profile sync is optional.
        state.profile = null;
      }
      state.authView = "home";
    } else if (saved.authView === "otp" && isValidEmail(saved.email)) {
      state.authView = "otp";
      state.otpPurpose = saved.otpPurpose === "signup" ? "signup" : "login";
      state.email = saved.email;
    } else if (saved.authView === "login" || saved.authView === "signup") {
      state.authView = saved.authView;
    } else {
      state.authView = "welcome";
    }
  } catch (error) {
    state.user = null;
    state.authView = "welcome";
    state.authError ||= error?.message || "Could not check your session.";
  }

  authReady = true;
  render();
}

function persistAuthProgress() {
  return chrome.storage.local.set({
    email: state.email,
    authView: state.authView,
    otpPurpose: state.otpPurpose
  });
}

function applyTheme(theme) {
  paperStack.className = `paper-stack theme-${theme}`;
}

function go(view, payload = {}) {
  state.view = view;
  Object.assign(state, payload);
  render();
}

function render() {
  if (!state.user) {
    applyTheme("yellow");
    if (state.authView === "login") return renderLogin();
    if (state.authView === "signup") return renderSignup();
    if (state.authView === "otp") return renderOtp();
    return renderWelcome();
  }

  const renderers = {
    home: renderHome,
    subjects: renderSubjects,
    subject: renderSubject,
    activity: renderActivity,
    session: renderSession,
    people: renderPeople,
    person: renderPerson,
    personSubject: renderPersonSubject,
    settings: renderSettings,
    notifications: renderNotifications
  };

  (renderers[state.view] || renderHome)();
}

function getDisplayName() {
  const profileName = state.profile?.display_name || state.profile?.name || state.user?.user_metadata?.full_name;
  if (profileName) return profileName;

  const localPart = (state.user?.email || state.email || "FOMO Student").split("@")[0];
  const prettified = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return prettified || "FOMO Student";
}

function getSubject() {
  return SUBJECTS.find(subject => subject.id === state.selectedSubjectId) || SUBJECTS[0];
}

function getActivity() {
  const subject = getSubject();
  return subject.activities.find(activity => activity.name === state.selectedActivityName) || subject.activities[0];
}

function getSession() {
  const activity = getActivity();
  return activity.sessions.find(session => session.id === state.selectedSessionId) || activity.sessions[0];
}

function getPerson() {
  return PEOPLE.find(person => person.name === state.selectedPersonName) || PEOPLE[0];
}

function header({ backView = null } = {}) {
  return `
    <header class="note-header">
      <button class="note-logo-button" data-home title="Home">
        <img class="note-logo" src="assets/fomo-logo.png" alt="FOMO" />
      </button>
      <button class="profile-chip" data-profile title="Profile">
        <span class="profile-avatar" aria-hidden="true"></span>
        <span class="profile-copy">
          <strong>${escapeHtml(getDisplayName())}</strong>
          <small>Edit Profile &gt;</small>
        </span>
      </button>
      <span class="header-actions">
        <button class="sketch-icon-btn" data-close title="Close FOMO" aria-label="Close FOMO">×</button>
        <button class="sketch-icon-btn gear" data-settings title="Settings" aria-label="Settings">⚙</button>
      </span>
      ${backView ? `<button class="back-button" data-back="${escapeHtml(backView)}" title="Back" aria-label="Back">←</button>` : ""}
    </header>
  `;
}

function wireHeader() {
  const homeButton = content.querySelector("[data-home]");
  const profileButton = content.querySelector("[data-profile]");
  const closeButton = content.querySelector("[data-close]");
  const settingsButton = content.querySelector("[data-settings]");
  const backButton = content.querySelector("[data-back]");

  homeButton?.addEventListener("click", () => go("home"));
  profileButton?.addEventListener("click", () => {
    showToast("Profile editing is the next screen to connect to Supabase.");
  });
  closeButton?.addEventListener("click", () => window.close());
  settingsButton?.addEventListener("click", () => {
    state.returnView = state.view;
    go("settings");
  });
  backButton?.addEventListener("click", () => go(backButton.dataset.back || "home"));
}

/* ---------- Main screens ---------- */
function renderHome() {
  applyTheme("yellow");
  content.innerHTML = `
    ${header()}
    <div class="screen-scroll home-content">
      <div class="home-question hand-underline">What would you like to view?</div>

      <button class="menu-card" id="subjectsButton">
        <span class="home-icon" aria-hidden="true">${iconSvg("subjects")}</span>
        <span>
          <span class="menu-title">Subjects</span>
          <span class="menu-desc">View your subjects,<br />activities and friends.</span>
        </span>
        <span class="menu-arrow">›</span>
      </button>

      <button class="menu-card" id="peopleButton">
        <span class="home-icon" aria-hidden="true">${iconSvg("people")}</span>
        <span>
          <span class="menu-title">People</span>
          <span class="menu-desc">See your friends and<br />their availabilities.</span>
        </span>
        <span class="menu-arrow">›</span>
      </button>

      <div class="home-footer">
        <span class="home-status-dot"></span>
        <span>${state.isTimetable ? "UTS timetable page detected" : "FOMO prototype ready"}</span>
      </div>
    </div>
  `;

  wireHeader();
  document.getElementById("subjectsButton").addEventListener("click", () => go("subjects"));
  document.getElementById("peopleButton").addEventListener("click", () => go("people"));
}

function renderSubjects() {
  applyTheme("pink");
  content.innerHTML = `
    ${header({ backView: "home" })}
    <div class="screen-scroll">
      <h1 class="screen-title hand-underline">Subjects</h1>
      <div class="section-count">${SUBJECTS.length} Subjects</div>
      <div class="note-list">
        ${SUBJECTS.map(subject => `
          <button class="note-row" data-subject="${escapeHtml(subject.id)}">
            <span>
              <strong>${escapeHtml(subject.code)}</strong>
              <small>${escapeHtml(subject.name)}</small>
            </span>
            <span class="row-arrow">›</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;

  wireHeader();
  content.querySelectorAll("[data-subject]").forEach(button => {
    button.addEventListener("click", () => {
      const subject = SUBJECTS.find(item => item.id === button.dataset.subject);
      go("subject", {
        selectedSubjectId: button.dataset.subject,
        selectedActivityName: subject?.activities?.[0]?.name || ""
      });
    });
  });
}

function renderSubject() {
  applyTheme("green");
  const subject = getSubject();

  content.innerHTML = `
    ${header({ backView: "subjects" })}
    <div class="screen-scroll">
      <div class="subject-code">${escapeHtml(subject.code)}</div>
      <h1 class="subject-name hand-underline">${escapeHtml(subject.name)}</h1>
      <div class="section-count">${subject.activities.length} ${subject.activities.length === 1 ? "Activity" : "Activities"}</div>

      <div class="note-list">
        ${subject.activities.map(activity => `
          <button class="note-row activity-row" data-activity="${escapeHtml(activity.name)}">
            <span class="activity-icon" aria-hidden="true">${iconSvg(activity.icon)}</span>
            <strong>${escapeHtml(activity.name)}</strong>
            <span class="row-arrow">›</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;

  wireHeader();
  content.querySelectorAll("[data-activity]").forEach(button => {
    button.addEventListener("click", () => {
      const activity = subject.activities.find(item => item.name === button.dataset.activity);
      go("activity", {
        selectedActivityName: button.dataset.activity,
        selectedSessionId: activity?.sessions?.[0]?.id || ""
      });
    });
  });
}

function renderActivity() {
  applyTheme("blue");
  const subject = getSubject();
  const activity = getActivity();

  content.innerHTML = `
    ${header({ backView: "subject" })}
    <div class="screen-scroll">
      <div class="subject-code">${escapeHtml(subject.code)}</div>
      <h1 class="subject-name">${escapeHtml(subject.name)}</h1>
      <h2 class="screen-subtitle hand-underline">${escapeHtml(activity.name)}</h2>

      <div class="note-list" style="margin-top:10px;">
        ${activity.sessions.map(session => `
          <button class="note-row session-row" data-session="${escapeHtml(session.id)}">
            <span>
              <span class="session-title">
                ${escapeHtml(session.id)}
                <span class="friend-glyphs">${friendGlyphs(session.friends.length)}</span>
              </span>
              <span class="session-meta">
                ${escapeHtml(session.day)} ${escapeHtml(session.time)}<br />
                Campus: ${escapeHtml(session.campus)} &nbsp; Location: ${escapeHtml(session.location)}
              </span>
            </span>
            <span class="row-arrow">›</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;

  wireHeader();
  content.querySelectorAll("[data-session]").forEach(button => {
    button.addEventListener("click", () => go("session", { selectedSessionId: button.dataset.session }));
  });
}

function renderSession() {
  applyTheme("purple");
  const subject = getSubject();
  const activity = getActivity();
  const session = getSession();

  const visiblePeople = session.friends
    .map(name => PEOPLE.find(person => person.name === name) || { name, close: false })
    .filter(Boolean);

  content.innerHTML = `
    ${header({ backView: "activity" })}
    <div class="screen-scroll">
      <div class="subject-code">${escapeHtml(subject.code)}</div>
      <h1 class="subject-name">${escapeHtml(subject.name)}</h1>
      <h2 class="screen-subtitle hand-underline">${escapeHtml(activity.name)} &nbsp;|&nbsp; ${escapeHtml(session.id)}</h2>

      <div class="detail-box">
        <p>${escapeHtml(session.day)} ${escapeHtml(session.time)}</p>
        <p>Campus: ${escapeHtml(session.campus)} &nbsp; Location: ${escapeHtml(session.location)}</p>
      </div>

      <div class="people-label">
        <span>People in this activity (${visiblePeople.length})</span>
        <span class="icons">★ ♙♙</span>
      </div>

      <div class="people-panel">
        <div class="list-scroll" style="max-height:179px;">
          ${visiblePeople.length ? visiblePeople.map(person => personRow(person, false)).join("") : `
            <div class="empty-note">None of your opted-in friends are in this activity yet.</div>
          `}
        </div>
      </div>
      <p class="fine-print">Only showing friends who have opted in.</p>
    </div>
  `;

  wireHeader();
  wirePersonRows();
}

function renderPeople() {
  applyTheme("pink");
  const closeCount = PEOPLE.filter(person => person.close).length;

  content.innerHTML = `
    ${header({ backView: "home" })}
    <div class="screen-scroll">
      <h1 class="screen-title hand-underline">People</h1>
      <div class="section-count">${closeCount} Close Friends, ${PEOPLE.length} Friends</div>
      <div class="people-panel">
        <div class="list-scroll">
          ${PEOPLE.map(person => personRow(person, true)).join("")}
        </div>
      </div>
    </div>
  `;

  wireHeader();
  wirePersonRows();
}

function renderPerson() {
  applyTheme("green");
  const person = getPerson();
  const sharedSubjects = person.sharedSubjectIds
    .map(id => SUBJECTS.find(subject => subject.id === id))
    .filter(Boolean);

  content.innerHTML = `
    ${header({ backView: "people" })}
    <div class="screen-scroll">
      <div class="friend-profile-heading">
        <span class="person-avatar" aria-hidden="true"></span>
        <h2 class="hand-underline">${escapeHtml(person.name)}</h2>
      </div>
      <div class="section-count">${sharedSubjects.length} Shared ${sharedSubjects.length === 1 ? "Subject" : "Subjects"}</div>
      <div class="note-list">
        ${sharedSubjects.map(subject => `
          <button class="note-row" data-person-subject="${escapeHtml(subject.id)}">
            <span>
              <strong>${escapeHtml(subject.code)}</strong>
              <small>${escapeHtml(subject.name)}</small>
            </span>
            <span class="row-arrow">›</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;

  wireHeader();
  content.querySelectorAll("[data-person-subject]").forEach(button => {
    button.addEventListener("click", () => go("personSubject", { selectedSubjectId: button.dataset.personSubject }));
  });
}

function renderPersonSubject() {
  applyTheme("blue");
  const person = getPerson();
  const subject = getSubject();
  const relevantActivities = subject.activities.filter(activity =>
    activity.sessions.some(session => session.friends.includes(person.name))
  );

  content.innerHTML = `
    ${header({ backView: "person" })}
    <div class="screen-scroll">
      <div class="friend-profile-heading" style="margin-bottom:7px;">
        <span class="person-avatar" aria-hidden="true"></span>
        <h2 class="hand-underline">${escapeHtml(person.name)}</h2>
      </div>
      <div class="subject-code">${escapeHtml(subject.code)}</div>
      <h1 class="subject-name hand-underline">${escapeHtml(subject.name)}</h1>

      <div class="note-list" style="margin-top:10px;">
        ${relevantActivities.length ? relevantActivities.flatMap(activity =>
          activity.sessions
            .filter(session => session.friends.includes(person.name))
            .map(session => `
              <div class="note-row session-row" style="cursor:default;">
                <span>
                  <span class="session-title">${escapeHtml(activity.name)} · ${escapeHtml(session.id)} ${person.close ? "★" : "♙"}</span>
                  <span class="session-meta">${escapeHtml(session.day)} ${escapeHtml(session.time)}</span>
                </span>
                <span class="friend-glyphs">♙</span>
              </div>
            `)
        ).join("") : `
          <div class="empty-note">Shared subject found, but no shared activity is available in the prototype data.</div>
        `}
      </div>
    </div>
  `;

  wireHeader();
}

function personRow(person, showArrow) {
  return `
    <button class="person-row" data-person="${escapeHtml(person.name)}">
      <span class="friend-star ${person.close ? "close" : ""}" title="${person.close ? "Close friend" : "Friend"}">${person.close ? "★" : "☆"}</span>
      <span class="person-avatar" aria-hidden="true"></span>
      <strong>${escapeHtml(person.name)}</strong>
      <span class="mini-arrow">${showArrow ? "›" : ""}</span>
    </button>
  `;
}

function wirePersonRows() {
  content.querySelectorAll("[data-person]").forEach(button => {
    button.addEventListener("click", () => go("person", { selectedPersonName: button.dataset.person }));
  });
}

/* ---------- Settings ---------- */
function renderSettings() {
  applyTheme("yellow");

  content.innerHTML = `
    ${header({ backView: state.returnView || "home" })}
    <div class="screen-scroll">
      <h1 class="screen-title hand-underline">Settings</h1>
      <div class="settings-list">
        ${settingRow("Share my timetable", "Visible to approved friends", "timetableSharing", state.timetableSharing)}
        ${settingRow("Friend requests", "Notify me about new requests", "friendNotifications", state.friendNotifications)}
        ${settingRow("Friends joining classes", "Notify when a shared class changes", "classNotifications", state.classNotifications)}
        ${settingRow("Meetup requests", "Notify when a friend wants to meet", "meetupNotifications", state.meetupNotifications)}

        <div class="setting-row">
          <span>
            <strong>Notifications</strong>
            <small>${state.notificationCount} unread prototype notifications</small>
          </span>
          <button class="paper-link-button" id="notificationsButton">View</button>
        </div>

        <div class="setting-row">
          <span>
            <strong>Account</strong>
            <small>${escapeHtml(state.user?.email || "Signed in")}</small>
          </span>
          <button class="paper-danger-button" id="logoutButton">Sign out</button>
        </div>
      </div>
    </div>
  `;

  wireHeader();

  content.querySelectorAll("[data-setting]").forEach(button => {
    button.addEventListener("click", async () => {
      const key = button.dataset.setting;
      state[key] = !state[key];
      await chrome.storage.local.set({ [key]: state[key] });
      renderSettings();
      showToast(`${humanizeSetting(key)} ${state[key] ? "on" : "off"}.`);
    });
  });

  document.getElementById("notificationsButton").addEventListener("click", () => go("notifications"));
  document.getElementById("logoutButton").addEventListener("click", handleLogout);
}

function renderNotifications() {
  applyTheme("purple");
  state.notificationCount = 0;
  chrome.storage.local.set({ notificationCount: 0 });
  chrome.runtime.sendMessage({ type: "SET_BADGE", count: 0 }).catch(() => {});

  content.innerHTML = `
    ${header({ backView: "settings" })}
    <div class="screen-scroll">
      <h1 class="screen-title hand-underline">Notifications</h1>
      <div class="people-panel" style="margin-top:11px;">
        ${NOTIFICATIONS.map(item => `
          <div class="notification-item">
            <strong>${item.unread ? '<span class="notification-dot"></span>' : ""}${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.detail)}</small>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  wireHeader();
}

function settingRow(title, subtitle, key, enabled) {
  return `
    <div class="setting-row">
      <span>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(subtitle)}</small>
      </span>
      <button class="paper-switch ${enabled ? "on" : ""}" data-setting="${escapeHtml(key)}" aria-label="Toggle ${escapeHtml(title)}"></button>
    </div>
  `;
}

/* ---------- Authentication ---------- */
function renderWelcome() {
  applyTheme("yellow");
  content.innerHTML = `
    <div class="auth-screen">
      <img class="auth-logo-large" src="assets/fomo-logo.png" alt="FOMO" />
      <p class="auth-tagline">What are you waiting for?</p>
      <p class="auth-subtagline">Everyone else is doing it :)</p>
      <div class="auth-actions">
        <button class="paper-button" id="welcomeLogin">Log in</button>
        <button class="paper-button secondary" id="welcomeSignup">Sign up</button>
      </div>
    </div>
  `;

  document.getElementById("welcomeLogin").addEventListener("click", () => {
    state.authView = "login";
    state.authError = "";
    persistAuthProgress();
    render();
  });

  document.getElementById("welcomeSignup").addEventListener("click", () => {
    state.authView = "signup";
    state.authError = "";
    persistAuthProgress();
    render();
  });
}

function renderLogin() {
  applyTheme("pink");
  content.innerHTML = `
    <div class="auth-screen">
      <img class="auth-logo-large" style="width:132px;margin-bottom:15px;" src="assets/fomo-logo.png" alt="FOMO" />
      <div class="auth-form">
        <h1 class="auth-form-title hand-underline">Log in</h1>
        <p class="auth-form-copy">Enter your email and we'll send you a one-time sign-in code.</p>
        ${state.authError ? `<div class="auth-error">${escapeHtml(state.authError)}</div>` : ""}
        <div class="auth-field">
          <label for="loginEmail">Email</label>
          <input id="loginEmail" type="email" value="${escapeHtml(state.email)}" placeholder="you@uts.edu.au" autocomplete="email" ${state.authLoading ? "disabled" : ""} />
        </div>
        <button class="paper-button" id="loginSubmit" ${state.authLoading ? "disabled" : ""}>${state.authLoading ? "Sending code..." : "Send sign-in code"}</button>
        <div class="auth-links">
          <button class="text-link" id="loginBack">Back</button>
          <button class="text-link" id="goSignup">Create an account</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("loginSubmit").addEventListener("click", handleLogin);
  document.getElementById("loginEmail").addEventListener("keydown", event => {
    if (event.key === "Enter") handleLogin();
  });
  document.getElementById("loginBack").addEventListener("click", () => setAuthView("welcome"));
  document.getElementById("goSignup").addEventListener("click", () => setAuthView("signup"));
}

function renderSignup() {
  applyTheme("pink");
  content.innerHTML = `
    <div class="auth-screen">
      <img class="auth-logo-large" style="width:132px;margin-bottom:15px;" src="assets/fomo-logo.png" alt="FOMO" />
      <div class="auth-form">
        <h1 class="auth-form-title hand-underline">Sign up</h1>
        <p class="auth-form-copy">Create your FOMO account with your university email.</p>
        ${state.authError ? `<div class="auth-error">${escapeHtml(state.authError)}</div>` : ""}
        <div class="auth-field">
          <label for="signupEmail">Email</label>
          <input id="signupEmail" type="email" value="${escapeHtml(state.email)}" placeholder="you@uts.edu.au" autocomplete="email" ${state.authLoading ? "disabled" : ""} />
        </div>
        <button class="paper-button" id="signupSubmit" ${state.authLoading ? "disabled" : ""}>${state.authLoading ? "Sending code..." : "Send verification code"}</button>
        <div class="auth-links">
          <button class="text-link" id="signupBack">Back</button>
          <button class="text-link" id="goLogin">Already have an account</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("signupSubmit").addEventListener("click", handleSignup);
  document.getElementById("signupEmail").addEventListener("keydown", event => {
    if (event.key === "Enter") handleSignup();
  });
  document.getElementById("signupBack").addEventListener("click", () => setAuthView("welcome"));
  document.getElementById("goLogin").addEventListener("click", () => setAuthView("login"));
}

function renderOtp() {
  applyTheme("pink");
  const title = state.otpPurpose === "signup" ? "Verify your email" : "Check your email";

  content.innerHTML = `
    <div class="auth-screen">
      <img class="auth-logo-large" style="width:120px;margin-bottom:13px;" src="assets/fomo-logo.png" alt="FOMO" />
      <div class="auth-form">
        <h1 class="auth-form-title hand-underline">${title}</h1>
        <p class="auth-form-copy">Enter the code sent to ${escapeHtml(state.email || "your email")}.</p>
        ${state.authError ? `<div class="auth-error">${escapeHtml(state.authError)}</div>` : ""}
        <div class="auth-field">
          <label for="otpCodeInput">Verification code</label>
          <input class="otp-input" id="otpCodeInput" type="text" inputmode="numeric" maxlength="8" placeholder="123456" autocomplete="one-time-code" value="${escapeHtml(state.otpCode)}" ${state.authLoading ? "disabled" : ""} />
        </div>
        <button class="paper-button" id="otpVerifyButton" ${state.authLoading ? "disabled" : ""}>${state.authLoading ? "Verifying..." : "Verify"}</button>
        <div class="auth-links">
          <button class="text-link" id="otpBackButton">Different email</button>
          <button class="text-link" id="otpResendButton" ${state.authLoading ? "disabled" : ""}>Resend code</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("otpVerifyButton").addEventListener("click", handleOtpVerify);
  document.getElementById("otpCodeInput").addEventListener("keydown", event => {
    if (event.key === "Enter") handleOtpVerify();
  });
  document.getElementById("otpResendButton").addEventListener("click", handleOtpResend);
  document.getElementById("otpBackButton").addEventListener("click", () => {
    setAuthView(state.otpPurpose === "signup" ? "signup" : "login");
  });
}

function setAuthView(view) {
  state.authView = view;
  state.authError = "";
  persistAuthProgress();
  render();
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

  const { data, error } = await verifyEmailOtp(token, state.otpPurpose);
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
    await persistAuthProgress();
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
    await persistAuthProgress();
    render();
    return;
  }

  await persistAuthProgress();
  showToast("A new code was sent to your email.");
  render();
}

async function completeAuth(user) {
  state.user = user;
  state.view = "home";
  state.authView = "home";
  state.authError = "";
  state.otpCode = "";

  try {
    const { data: profile } = await getProfile(user.id);
    if (profile) {
      state.profile = profile;
    } else {
      const { data: inserted } = await upsertProfile({ id: user.id, email: user.email });
      state.profile = Array.isArray(inserted) ? inserted[0] : inserted;
    }
  } catch (_error) {
    // Authentication is handled by Clerk on this branch. Supabase profile sync is optional.
    state.profile = null;
  }

  await persistAuthProgress();
  showToast("Signed in successfully.");
  render();
}

async function handleLogout() {
  await signOut();
  state.user = null;
  state.profile = null;
  state.authView = "welcome";
  state.authError = "";
  state.otpCode = "";
  state.view = "home";
  await persistAuthProgress();
  showToast("Signed out.");
  render();
}

/* ---------- Small helpers ---------- */
function friendGlyphs(count) {
  const visible = Math.max(0, Math.min(count, 3));
  return `${"♙".repeat(visible)}${count > 3 ? "+" : ""}`;
}

function humanizeSetting(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, char => char.toUpperCase());
}

function iconSvg(type) {
  const common = `fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;

  if (type === "subjects") {
    return `<svg viewBox="0 0 48 44" ${common}>
      <path d="M7 8l14-5 19 7-15 6L7 8z" />
      <path d="M7 8v7l18 8 15-7v-6" />
      <path d="M7 16v7l18 8 15-7v-7" />
      <path d="M7 24v7l18 8 15-7v-7" />
    </svg>`;
  }

  if (type === "people") {
    return `<svg viewBox="0 0 52 44" ${common}>
      <circle cx="26" cy="11" r="6" />
      <circle cx="10" cy="16" r="5" />
      <circle cx="42" cy="16" r="5" />
      <path d="M16 37c0-9 4-15 10-15s10 6 10 15" />
      <path d="M1 37c0-8 3-13 9-13 4 0 7 3 8 7" />
      <path d="M34 31c1-4 4-7 8-7 6 0 9 5 9 13" />
    </svg>`;
  }

  if (type === "book") {
    return `<svg viewBox="0 0 28 28" ${common}>
      <path d="M3 5h8c2 0 3 1 3 3v15c0-2-1-3-3-3H3V5z" />
      <path d="M25 5h-8c-2 0-3 1-3 3v15c0-2 1-3 3-3h8V5z" />
    </svg>`;
  }

  if (type === "seminar") {
    return `<svg viewBox="0 0 28 28" ${common}>
      <path d="M4 5h20v14H10l-6 5V5z" />
      <path d="M8 10h12M8 14h8" />
    </svg>`;
  }

  if (type === "workshop") {
    return `<svg viewBox="0 0 28 28" ${common}>
      <path d="M5 4h14l4 4v16H5V4z" />
      <path d="M9 10h10M9 14h10M9 18h7" />
    </svg>`;
  }

  return `<svg viewBox="0 0 28 28" ${common}>
    <rect x="3" y="6" width="22" height="15" rx="2" />
    <path d="M9 12l3 3-3 3M14 18h5" />
  </svg>`;
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
