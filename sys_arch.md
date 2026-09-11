# FOMO – System Architecture

## Overview
**FOMO** is a Chromium Manifest V3 extension that lets university students see friends in classes, find shared free time, and organise meetups while keeping timetable sharing opt-in and reversible.

Authentication is handled by **Clerk** (email + one-time code). **Supabase** is retained as a REST data layer for profiles, timetables, friendships, and notifications. The popup’s friends / free-time / meetup screens still render local mock data.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            Chrome Browser                                │
│  ┌────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐  │
│  │   Popup UI     │   │ Background       │   │  Content Script         │  │
│  │ popup.html     │◄──│ Service Worker   │◄──│  content.js             │  │
│  │ popup.css      │   │ src/background.js│   │  UTS Allocate+ page     │  │
│  │ src/popup.js   │   │ (bundled)        │   │  friend column inject   │  │
│  │ (esbuild →     │   │                  │   │                         │  │
│  │  popup.js)     │   │                  │   │                         │  │
│  └───────┬────────┘   └────────┬─────────┘   └────────────▲────────────┘  │
│          │                     │                          │               │
│          │ chrome.storage.local / chrome.runtime.sendMessage              │
│          │                     │                          │               │
│  ┌───────▼────────┐   ┌────────▼────────┐   ┌─────────────┴────────────┐  │
│  │ Icons          │   │ Demo page       │   │ Overlay injection        │  │
│  └────────────────┘   │ demo.html/.js   │   │ chrome.scripting API     │  │
│                       └─────────────────┘   └──────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
          │                                              │
          │  @clerk/chrome-extension                     │  REST (anon key)
          ▼                                              ▼
┌─────────────────────┐                        ┌─────────────────────┐
│ Clerk               │                        │ Supabase            │
│ - Sign up / sign in │                        │ src/lib/supabase.js │
│ - Email OTP         │                        │ - profiles          │
│ - Session JWT in    │                        │ - timetables        │
│   chrome.storage    │                        │ - friendships       │
│                     │                        │ - notifications     │
│                     │                        │ - meetup_requests   │
└─────────────────────┘                        └─────────────────────┘
```

## Repository Layout

```
2026SIS_Group26/
├── sys_arch.md
├── README.md
├── supabase/
│   └── migrations/
│       └── 20240101000000_create_profiles.sql
├── my-clerk-vite-app/          # Standalone Clerk JS playground (not the extension)
└── fomo-chromium-extension/
    ├── manifest.json           # MV3: permissions, hosts, popup, service worker
    ├── package.json            # npm run build / watch
    ├── build.mjs               # esbuild: src/popup.js + src/background.js → root
    ├── popup.html / popup.css
    ├── popup.js                # Bundled output (gitignored)
    ├── background.js           # Bundled output (gitignored)
    ├── content.js
    ├── demo.html / demo.js / demo.css
    ├── icons/
    └── src/
        ├── popup.js            # Popup source (views, auth UI, mock FOMO data)
        ├── background.js       # Service worker source
        └── lib/
            ├── config.js       # Clerk publishable key + Supabase URL / anon key
            ├── clerk.js        # Clerk client: OTP sign-in/up, session, sign-out
            └── supabase.js     # PostgREST helpers (no Auth)
```

`CLERK_PUBLISHABLE_KEY` is read from `fomo-chromium-extension/.env` at **build** time and inlined by esbuild.

## Component Details

### 1. Manifest (`manifest.json`)
- Manifest V3 toolbar extension **FOMO – Uni Social Timetable**.
- **Permissions**: `storage`, `cookies`, `activeTab`, `scripting`.
- **Host permissions**: `https://*.supabase.co/*`, `https://*.clerk.accounts.dev/*`, `https://*.clerk.com/*`.
- **Background**: ES module service worker `background.js`.
- **Content script**: Allocate+ student timetable URLs.
- **CSP**: `script-src 'self'` (Clerk is bundled; no remote scripts).

### 2. Background Service Worker (`src/background.js`)
- Sets default privacy / notification flags on install.
- Updates the toolbar badge (`SET_BADGE`).
- Creates a Clerk client with `@clerk/chrome-extension/background` so the session JWT stays fresh while the popup is closed.
- Answers `CLERK_GET_TOKEN` for other extension contexts. Content scripts cannot load Clerk directly.

### 3. Popup (`popup.html`, `src/popup.js`, `popup.css`)
- Vanilla JS UI (not React). Auth uses `createClerkClient()` from `@clerk/chrome-extension/internal`, not Clerk React hooks.
- **Auth gate**: unsigned-in users only see login / signup / OTP. Signed-in users see the FOMO views.
- **Auth views**:
  - **Login**: email → Clerk email OTP.
  - **Signup**: email → Clerk email OTP.
  - **OTP**: 6-digit code, resend, change email.
- Chrome closes the popup when focus is lost. `email`, `authView`, and `otpPurpose` are saved in `chrome.storage.local` so reopen returns to the code screen.
- **App views** (mock data in `MOCK`): Home, Friends, Free Together, Meet Up, Settings, Notifications.
- Settings: timetable sharing, notification toggles, signed-in email, sign out.
- Overlay: `chrome.scripting.executeScript` injects a FOMO card on the active tab.
- Optional `upsertProfile` after sign-in; Clerk user ids are not Supabase `auth.users` UUIDs, so this can fail and is non-blocking.

### 4. Clerk client (`src/lib/clerk.js`)
- Loads Clerk with `allowedRedirectProtocols: ['chrome-extension:']`.
- Sign-in: `client.signIn.create` → `prepareFirstFactor({ strategy: 'email_code' })`.
- Sign-up: `client.signUp.create` → `prepareEmailAddressVerification({ strategy: 'email_code' })`.
- Verify: `attemptFirstFactor` / `attemptEmailAddressVerification` then `setActive`.
- Maps `clerk.user` to `{ id, email }` for the popup.
- Session JWT is stored by the SDK in `chrome.storage.local` (not passwords).
- Popup / side panel **cannot** use OAuth or magic links; Email + OTP is the supported method.

### 5. Supabase data client (`src/lib/supabase.js`)
- REST calls to PostgREST with the **anon key only** (no Clerk JWT, no Supabase Auth session).
- Helpers exist for `profiles`, `timetables`, `friend_requests`, `friendships`, `notifications`, `meetup_requests`.
- The popup does not yet drive those screens from this client; they still use `MOCK`.
- RLS that uses `auth.uid()` will not see a Clerk user until Clerk JWTs are wired into Supabase.

### 6. Content Script (`content.js`)
- Runs on `https://mytimetablecloud.uts.edu.au/even/student*`.
- Injects a People column from prototype `PEOPLE_BY_ACTIVITY`.
- Does not call Clerk or Supabase.

### 7. Demo Page (`demo.html`, `demo.js`, `demo.css`)
- Local Allocate+-style mock page with friend pills, opened from the popup.

## Auth Flow

1. User enters email (login or signup) in the popup.
2. Clerk emails a 6-digit code (Clerk’s own mailer; no Resend in this repo).
3. Popup may close; stored `authView: "otp"` restores the code screen.
4. User enters the code; Clerk creates a session.
5. Popup shows Home. Sign out calls `clerk.signOut()`.

Dashboard requirements: **Native API** enabled (Chrome extension / CAPTCHA bypass), **Email verification code** enabled, extension id in Clerk `allowed_origins`. Bot sign-up protection / Turnstile will 400 custom `signUp.create()` unless Native API is on or CAPTCHA is disabled for testing.

## Data Flow (intended vs current)

### Timetable sharing
**Intended:** opt-in in Settings → write `timetables.shared` in Supabase → friends only see shared rows.  
**Current:** toggle persists in `chrome.storage.local`; UI copy is mock.

### Friend indicators on Allocate+
**Intended:** content script uses backend friend data keyed by timetable + activity.  
**Current:** static `PEOPLE_BY_ACTIVITY` map.

### Meetup requests
**Intended:** insert `meetup_requests`, notify via badge.  
**Current:** local toast / list-item “Sent” state.

## External Integrations
- **UTS Allocate+ / MyTimetableCloud**: content-script DOM target.
- **Clerk**: identity, email OTP, session.
- **Supabase**: planned persistence (helpers present; UI still mock). Linked project ref `lbnckgfwmmvhkqjlatxn` (`Social_Sync`).

## Privacy
- Timetable sharing is designed as opt-in and reversible.
- Prototype popup defaults sharing **on** and uses mock friend data.
- Friend indicators should only show friends who have shared; content script does not enforce that yet.
- No passwords stored. Clerk session tokens live in `chrome.storage.local`.

## Build & Run

From `fomo-chromium-extension/` (not the repo root):

```powershell
npm install
npm run build
```

Then Chrome → `chrome://extensions` → Developer mode → Load unpacked → select `fomo-chromium-extension`.

`popup.js` and `background.js` at the folder root are **build outputs**. Edit `src/popup.js` and `src/background.js`, then rebuild (or `npm run watch`).

Open the demo timetable from the popup, or open `demo.html` directly.

## Known Gaps / Future Work
- Connect popup lists to `src/lib/supabase.js` instead of `MOCK`.
- Replace `PEOPLE_BY_ACTIVITY` with live friend data.
- Map Clerk user ids into Supabase (JWT template + third-party auth, or a `profiles` schema that does not FK `auth.users`).
- Per-friend visibility controls.
- Supabase Realtime for notifications.
- Production Clerk instance (current builds use `pk_test_` development keys).
- Consistent Chrome extension id (`key` in the manifest) so Clerk `allowed_origins` does not need updating after every unpacked reload.
