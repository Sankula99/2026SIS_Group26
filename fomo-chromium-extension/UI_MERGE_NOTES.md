# UI branch merge notes

This build applies the approved FOMO **notepad + stacked sticky-note** UI to the uploaded `App+UI+OTP` branch.

## Preserved from this branch
- Clerk email-code / OTP authentication
- Existing background Clerk session support
- Supabase profile helper integration
- UTS MyTimetable content script and existing manifest permissions
- Notification badge behaviour

## UI merged in
- Ruled notepad canvas (removes the accidental-looking white popup margin)
- Layered coloured sticky notes with tape and paper-settle animation
- Larger/readable typography
- FOMO logo asset and matching toolbar icon
- Welcome -> Login / Sign up -> OTP sticky flow
- Subjects -> Subject -> Activity -> Session screens
- People -> Friend -> Shared Subject screens
- Sticky-note Settings and Notifications screens

## Important
The Subjects/People content remains prototype/mock data. This change is a UI merge; it does not replace this branch's authentication backend.

The normal build command remains `npm run build` when dependencies are installed. The bundled root `popup.js` in this ZIP has also been updated directly so the extension can be loaded immediately.
