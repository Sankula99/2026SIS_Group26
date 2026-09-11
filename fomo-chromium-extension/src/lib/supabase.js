import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

function errorFromBody(body, fallback) {
  if (!body || typeof body !== "object") return { message: fallback };
  return {
    message: body.msg || body.error_description || body.message || body.error || fallback
  };
}

async function readBody(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function rest(method, table, { query = {}, body, prefer } = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await readBody(res);
  if (!res.ok) {
    return { data: null, error: errorFromBody(data, `Request failed (${res.status})`) };
  }
  return { data, error: null };
}

export async function getProfile(userId) {
  const { data, error } = await rest("GET", "profiles", {
    query: { id: `eq.${userId}`, select: "*", limit: "1" }
  });
  if (error) return { data: null, error };
  const row = Array.isArray(data) ? data[0] : data;
  return { data: row || null, error: null };
}

export async function upsertProfile(profile) {
  return rest("POST", "profiles", {
    query: { on_conflict: "id" },
    body: profile,
    prefer: "resolution=merge-duplicates,return=representation"
  });
}

export async function getSharedTimetables(userIds) {
  if (!userIds?.length) return { data: [], error: null };
  return rest("GET", "timetables", {
    query: {
      user_id: `in.(${userIds.join(",")})`,
      shared: "eq.true",
      select: "*"
    }
  });
}

export async function setTimetableSharing(userId, shared, timetableData) {
  return rest("POST", "timetables", {
    query: { on_conflict: "user_id" },
    body: { user_id: userId, shared, data: timetableData },
    prefer: "resolution=merge-duplicates,return=representation"
  });
}

export async function sendFriendRequest(fromId, toId) {
  return rest("POST", "friend_requests", {
    body: { from_id: fromId, to_id: toId, status: "pending" },
    prefer: "return=representation"
  });
}

export async function acceptFriendRequest(requestId) {
  return rest("PATCH", "friend_requests", {
    query: { id: `eq.${requestId}` },
    body: { status: "accepted" },
    prefer: "return=representation"
  });
}

export async function getFriends(userId) {
  return rest("GET", "friendships", {
    query: {
      user_id: `eq.${userId}`,
      select: "friend_id,profiles(*)"
    }
  });
}

export async function getNotifications(userId) {
  return rest("GET", "notifications", {
    query: {
      user_id: `eq.${userId}`,
      select: "*",
      order: "created_at.desc"
    }
  });
}

export async function markNotificationRead(notificationId) {
  const { error } = await rest("PATCH", "notifications", {
    query: { id: `eq.${notificationId}` },
    body: { read: true }
  });
  return { error };
}

export async function sendMeetupRequest(fromId, toId, slot) {
  return rest("POST", "meetup_requests", {
    body: {
      from_id: fromId,
      to_id: toId,
      time_slot: slot,
      status: "pending"
    },
    prefer: "return=representation"
  });
}
