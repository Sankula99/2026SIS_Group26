/**
 * free_time.js
 * Utility to find common free time slots across multiple calendars.
 *
 * Exports: `findFreeTimes(calendars, durationMinutes, window)`
 *
 * - `calendars` can be an array of event arrays or a single array of events.
 *   Each event: { start: ISO|number|Date, end: ISO|number|Date }
 * - `durationMinutes` number: minimum slot length in minutes
 * - `window` { start: ISO|number|Date, end: ISO|number|Date }
 *
 * Returns array of free slots: [{ start: ISOString, end: ISOString }, ...]
 */

(function (root) {
  'use strict';

  function toMs(t) {
    if (t instanceof Date) return t.getTime();
    if (typeof t === 'number') return t; // assume ms
    return Date.parse(t);
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function normalizeEvents(input, windowStart, windowEnd) {
    const events = [];
    if (!input) return events;

    // Accept either an array of events or an array of arrays of events
    let flat = [];
    if (Array.isArray(input) && input.length > 0 && input[0] && (input[0].start !== undefined || input[0].end !== undefined)) {
      // single array of events
      flat = input;
    } else if (Array.isArray(input)) {
      flat = input.flat();
    }

    for (const ev of flat) {
      if (!ev) continue;
      const s = toMs(ev.start);
      const e = toMs(ev.end);
      if (Number.isNaN(s) || Number.isNaN(e)) continue;
      const cs = clamp(s, windowStart, windowEnd);
      const ce = clamp(e, windowStart, windowEnd);
      if (cs < ce) events.push({ start: cs, end: ce });
    }
    return events;
  }

  function mergeIntervals(intervals) {
    if (!intervals.length) return [];
    intervals.sort((a, b) => a.start - b.start);
    const out = [Object.assign({}, intervals[0])];
    for (let i = 1; i < intervals.length; i++) {
      const cur = intervals[i];
      const last = out[out.length - 1];
      if (cur.start <= last.end) {
        // overlap
        last.end = Math.max(last.end, cur.end);
      } else {
        out.push(Object.assign({}, cur));
      }
    }
    return out;
  }

  /**
   * Find free time slots across calendars.
   * @param {Array} calendars Array of event arrays or single event array
   * @param {number} durationMinutes Minimum slot length in minutes
   * @param {{start: *, end: *}} window Time window to search within
   * @returns {Array<{start: string, end: string}>}
   */
  function findFreeTimes(calendars, durationMinutes, window) {
    const winStart = toMs(window.start);
    const winEnd = toMs(window.end);
    if (!Number.isFinite(winStart) || !Number.isFinite(winEnd) || winStart >= winEnd) {
      throw new Error('Invalid window range');
    }
    const durationMs = Math.max(0, Number(durationMinutes)) * 60 * 1000;

    const events = normalizeEvents(calendars, winStart, winEnd);
    const busy = mergeIntervals(events);

    const free = [];
    let cursor = winStart;
    for (const b of busy) {
      if (b.start > cursor) {
        const len = b.start - cursor;
        if (len >= durationMs) free.push({ start: cursor, end: b.start });
      }
      cursor = Math.max(cursor, b.end);
    }
    if (cursor < winEnd) {
      const len = winEnd - cursor;
      if (len >= durationMs) free.push({ start: cursor, end: winEnd });
    }

    // map to ISO strings
    return free.map(s => ({ start: new Date(s.start).toISOString(), end: new Date(s.end).toISOString() }));
  }

  const api = { findFreeTimes };

  // UMD-ish export to work in different extension setups
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else if (typeof define === 'function' && define.amd) {
    define(function () { return api; });
  } else {
    const target = (typeof window !== 'undefined') ? window : root || this;
    target.freeTime = api;
  }

})(typeof globalThis !== 'undefined' ? globalThis : this);
