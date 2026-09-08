const FomoCalendar = (() => {
  "use strict";

  // TODO: make this an env variable
  const HASH_KEY = "calendarUrlHash"; // This is the name of the local storage space, we can change this if needed.

  function parseCalendar(text) {
    // RFC 5545: unfold physical lines before decoding escaped TEXT values.
    const lines = text.replace(/^\uFEFF/, "").replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
    if (lines[0] !== "BEGIN:VCALENDAR" || !lines.includes("END:VCALENDAR")) {
      throw new Error("The calendar response is not an ICS calendar.");
    }

    const user = Object.create(null);
    const seen = new Set();
    const components = [];
    let description = null;
    let eventCount = 0;

    function addActivity(value) {
      if (value === null) return;
      const decoded = value.replace(/\\([nN,;\\])/g, (_, escaped) =>
        /[nN]/.test(escaped) ? "\n" : escaped
      );
      // Allocate+ uses three comma-separated identifiers on the first line.
      const fields = decoded.split("\n", 1)[0].split(",");
      if (fields.length !== 3 || fields.some(field => !field.trim())) return;
      const [subject, activity, number] = fields.map(field => field.trim());
      if (!/^\d+(?:_[A-Za-z0-9]+){4}$/.test(subject) || // Validate subject, activity and number structure loosely
          !/^[A-Za-z][A-Za-z0-9]*$/.test(activity) || !/^\d+$/.test(number)) return;
      const identity = JSON.stringify([subject, activity, number]); // Serialise so we can track if this activity already exists in the timetable
      if (seen.has(identity)) return;
      seen.add(identity);

      const activities = user[subject] ??= Object.create(null);
      const previous = activities[activity];
      // Keep distinct allocations if an activity changes number during the term for some reason.
      activities[activity] = previous === undefined ? number
        : Array.isArray(previous) ? [...previous, number] : [previous, number];
    }

    for (const line of lines) {
      if (line.startsWith("BEGIN:")) {
        const component = line.slice(6);
        components.push(component);
        if (component === "VEVENT") {
          description = null;
          eventCount++;
        }
      } else if (line.startsWith("END:")) {
        const component = line.slice(4);
        if (components.pop() !== component) {
          throw new Error("The ICS calendar contains an incomplete component.");
        }
        if (component === "VEVENT") addActivity(description);
      } else if (components.at(-1) === "VEVENT") {
        // Parameters may contain quoted colons; VALARM descriptions are ignored.
        const match = line.match(/^DESCRIPTION(?:;(?:[^":]|"[^"]*")*)?:(.*)$/i);
        if (match) description = match[1];
      }
    }

    if (components.length) throw new Error("The ICS calendar is incomplete.");
    if (eventCount && !seen.size) {
      throw new Error("No timetable activities were found in the calendar descriptions.");
    }
    return { USER: user };
  }

  async function importCalendar(url) {
    /*
    Still not sure how often the URL parameter updates, if at all.

    This works on the assumption that it might change following a modification
    of the timetable or some sort of expiry.

    We hash the URL and only do extractions if its 'new' or missing from local
    storage, otherwise we assume its the same and the existing data is still
    relevant.

    If this is not the case, and the URL is instead basically tied to your account
    and persists, then we will have to ditch this method and run checks on every load.
    */
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
    const hash = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
    const stored = await chrome.storage.local.get(HASH_KEY);
    if (stored[HASH_KEY] === hash) return null;

    await chrome.storage.local.set({ [HASH_KEY]: hash });
    try {
      const response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) throw new Error(`Calendar request failed (HTTP ${response.status}).`);
      return parseCalendar(await response.text());
    } catch (error) {
      // If we dont remove the hash after failure then it will get stuck
      const current = await chrome.storage.local.get(HASH_KEY);
      if (current[HASH_KEY] === hash) await chrome.storage.local.remove(HASH_KEY);
      throw error;
    }
  }

  return { parseCalendar, importCalendar };
})();
