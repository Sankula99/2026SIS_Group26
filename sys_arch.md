# FOMO – System Architecture

## Overview
**FOMO** is a Chromium browser extension that lets university students see friends in classes, find shared free time, and organise meetups while keeping timetable sharing opt-in and reversible.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Chrome Browser                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   Popup UI    │    │ Background    │    │  Content Script      │  │
│  │ (popup.html)  │◄───│ Service Worker│◄───│  (content.js)        │  │
│  │  (popup.js)   │    │ (background.js)│    │  UTS Allocate+ page  │  │
│  │  (popup.css)  │    │               │    │  friend column inject│  │
│  └──────┬───────┘    └──────────────┘    └──────────────────────┘  │
│         │                ▲                       ▲                   │
│         │ chrome.storage.local  chrome.runtime.sendMessage          │
│         │                │                       │                   │
│  ┌──────▼───────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │ Extension    │    │  Demo Page   │    │   Overlay Injection   │  │
│  │  Icons       │    │ (demo.html)  │    │  (via scripting API)  │  │
│  └──────────────┘    │ (demo.js)    │    └──────────────────────┘  │
│                      │ (demo.css)   │                               │
│                      └──────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
                    ┌──────────────────┐
                    │   Supabase       │
                    │   (src/lib/      │
                    │   supabase.ts)   │
                    │   - Auth         │
                    │   - Profiles     │
                    │   - Timetables   │
                    │   - Friendships  │
                    │   - Notifications│
                    └──────────────────┘
```

## Project Structure

```
fomo-chromium-extension/
├── manifest.json          # Manifest V3 extension configuration
├── background.js          # Service worker: defaults, badge, messaging
├── content.js             # Content script: timetable DOM injection
├── popup.html             # Extension popup shell
├── popup.js               # Popup logic: views, state, overlay injection
├── popup.css              # Popup styles
├── demo.html              # Allocate+ timetable demo page
├── demo.js                # Demo page interactions
├── demo.css               # Demo page styles
├── icons/                 # Extension icons (16/32/48/128 px)
└── src/
    └── lib/
        └── supabase.ts    # Backend client (placeholder)
```

## Component Details

### 1. Background Service Worker (`background.js`)
- **Role**: Persistent background task for extension lifecycle.
- **Responsibilities**:
  - Initialise default settings on install (`timetableSharing`, `meetupNotifications`, `classNotifications`, `friendNotifications`, `notificationCount`).
  - Manage the extension badge count in the toolbar.
  - Listen for `SET_BADGE` messages from popup and update the badge.
- **Storage**: Uses `chrome.storage.local`.

### 2. Popup UI (`popup.html`, `popup.js`, `popup.css`)
- **Role**: Primary user interface when the user clicks the extension icon.
- **Views**:
  - **Home**: Context card showing current class, friends present, quick actions, sharing toggle.
  - **Friends**: List of connected friends with activity/status.
  - **Free Together**: Overlapping free-time slots between the user and friends.
  - **Meet Up**: Send low-pressure meetup requests to friends.
  - **Settings**: Privacy toggles (timetable sharing, notification preferences).
  - **Notifications**: Unread activity feed.
- **State Management**: In-memory `state` object synchronised with `chrome.storage.local`.
- **Overlay Injection**: Uses `chrome.scripting.executeScript` to inject a FOMO card onto the active timetable page.
- **Routing**: Simple view-switching via `state.view` and `render()` dispatcher.

### 3. Content Script (`content.js`)
- **Role**: Runs on UTS Allocate+ timetable pages (`https://mytimetablecloud.uts.edu.au/even/student*`).
- **Responsibilities**:
  - Observe DOM mutations to detect timetable rendering.
  - Inject a "People" column into the activity table.
  - Populate each row with friend names based on `timetableKey + activityId`.
- **Data Source**: Currently uses prototype `PEOPLE_BY_ACTIVITY` map (to be replaced by backend data).

### 4. Demo Page (`demo.html`, `demo.js`, `demo.css`)
- **Role**: Standalone prototype simulating the Allocate+ activity selection page.
- **Features**:
  - Mock activity list with FOMO pills showing friend attendance.
  - Interactive highlighting and radio selection.
  - Privacy notice section.

### 5. Supabase Client (`src/lib/supabase.ts`)
- **Role**: Backend data layer.
- **Purpose**: Authentication, profile management, timetable sharing, friend relationships, and notification delivery.
- **Status**: Placeholder (empty) in this repository.

## Data Flow

### Timetable Sharing (Privacy-First)
1. User opts in to timetable sharing in Settings.
2. User's timetable is pushed to Supabase (marked as shared).
3. Friends' content scripts / popup fetch only shared timetables.
4. Friend indicators are calculated locally or server-side without exposing private timetables.

### Friend Indicators on Allocate+
1. Content script detects page load / DOM mutation on the timetable.
2. It requests (or reads cached) friend data keyed by `timetableKey + activityId`.
3. A "People" column is appended to the table rows.
4. Names are rendered as comma-separated text inside styled cells.

### Meetup Requests
1. User selects a friend in the popup and sends a request.
2. Request is stored in Supabase.
3. Recipient receives a notification via the extension badge and notifications view.

## External Integrations
- **UTS Allocate+ / MyTimetableCloud**: DOM scraping target for the content script.
- **Supabase**: Planned backend for auth, data persistence, and realtime notifications.

## Privacy Considerations
- Timetable sharing is opt-in (default: off in a production build; prototype uses mock data).
- Per-friend visibility control is stubbed in Settings for future implementation.
- Friend indicators only display information from friends who have explicitly shared their timetables.

## Build & Run
- No build step required for the current prototype.
- Load `fomo-chromium-extension` as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked).
- The demo page can be opened via the popup's "Demo timetable" button or directly from the file system.

## Future Work
- Implement Supabase client (`supabase.ts`).
- Replace `PEOPLE_BY_ACTIVITY` mock data with live backend calls.
- Add authentication flow.
- Implement realtime notifications via Supabase Realtime.
- Add per-friend visibility controls.
- Extend meetup request scheduling.
