# FOMO – Chromium Extension MVP

A functional, local-first prototype for demonstrating the FOMO university social timetable concept.

## What works

- Chromium Manifest V3 toolbar extension
- Popup detects whether the current tab looks like an Allocate+/timetable page
- Timetable sharing ON/OFF persists with `chrome.storage.local`
- Friends list
- Shared free-time suggestions
- Meetup request interactions
- Notification view + toolbar badge
- Settings/privacy toggles
- **Show FOMO on this page** injects a floating session/friends card into the active webpage
- **Demo timetable** opens an included Allocate+-style mock page with FOMO friend indicators

The friend/timetable information is intentionally mock data. There is no backend or university authentication yet.

## Install in Chrome / Edge

1. Unzip `fomo-chromium-extension.zip`.
2. Open `chrome://extensions` in Chrome (or `edge://extensions` in Edge).
3. Turn on **Developer mode**.
4. Choose **Load unpacked**.
5. Select the `fomo-chromium-extension` folder.
6. Pin **FOMO – Uni Social Timetable** from the browser extensions menu.

## Best team demo

1. Open FOMO from the toolbar.
2. Show the `DATA2001 · Workshop 02` card and the three friend indicators.
3. Toggle **Share my timetable** OFF and ON to demonstrate privacy control.
4. Open **Free Together** and choose a suggested break.
5. Open **Meet Up** and send a request.
6. Click **Demo timetable** to show the proposed Allocate+ integration.
7. On any normal webpage, reopen FOMO and click **Show FOMO on this page**. A live floating FOMO card will be injected onto the page.

> Chrome does not allow extension script injection on protected browser pages such as `chrome://extensions`. Use a normal `https://` webpage for the overlay demo.

## Prototype mapping to your epics

- Epic 1 – Friends & Privacy: friends list, timetable sharing, settings
- Epic 2 – Friend-Aware Timetable Selection: session card + demo timetable friend indicators
- Epic 3 – Shared Free-Time Discovery: Free Together
- Epic 4 – User Control: sharing toggle, suggestions only, no automatic commitments
- Epic 5 – Notifications: notification centre and toolbar badge

## Next engineering steps

1. Authentication (university email / OAuth)
2. Backend database for users, friendships and timetable-sharing permissions
3. Reliable Allocate+ DOM integration/content script
4. Timetable extraction/normalisation
5. Real-time friend updates
6. Meetup request API
7. Per-friend visibility controls
8. Security/privacy review before using real student timetable data
