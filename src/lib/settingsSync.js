/**
 * settingsSync.js
 * Settings split into two tables:
 *   org_settings  — shared company settings (branding, report defaults, project types)
 *   user_settings — personal settings (name, title, phone, avatar, personal prefs)
 *
 * Binary fields (logo, userAvatar) stay in localStorage only — too large for DB.
 */

// Personal fields — saved to user_settings (per user, not shared)
const USER_KEYS = [
  'userFirstName','userLastName','userEmail','userTitle','userPhone',
  'userRole','userPermissions','userBio','userDepartment',
  'notifProjects','notifPhotos','notifReports','notifChecklists',
  'notifTasks','notifCalendar','notifTeam','notifBilling',
  'notifSounds','notifDesktop',
  'photoQuality','videoQuality','saveToCameraRoll',
];

// Binary fields — localStorage only
const BINARY_KEYS = ['logo', 'userAvatar'];

function splitSettings(settings) {
  const org = {}, user = {};
  for (const [k, v] of Object.entries(settings)) {
    if (BINARY_KEYS.includes(k)) continue; // skip
    if (USER_KEYS.includes(k)) user[k] = v;
    else org[k] = v;
  }
  return { org, user };
}

async function dbPost(path, body) {
  const url     = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  await fetch(`${url}/rest/v1/${path}`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(body),
  });
}

async function dbGet(path) {
  const url     = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  return res.json();
}

// Load both org + user settings and merge them
export async function loadSettingsFromDB(orgId, userId) {
  try {
    const [orgRows, userRows] = await Promise.all([
      orgId  ? dbGet(`org_settings?organization_id=eq.${orgId}&select=settings&limit=1`)  : Promise.resolve([]),
      userId ? dbGet(`user_settings?user_id=eq.${userId}&select=settings&limit=1`) : Promise.resolve([]),
    ]);
    const orgSettings  = orgRows?.[0]?.settings  || {};
    const userSettings = userRows?.[0]?.settings || {};
    // Merge: org settings first, user settings override personal fields
    return Object.keys(orgSettings).length || Object.keys(userSettings).length
      ? { ...orgSettings, ...userSettings }
      : null;
  } catch {
    return null;
  }
}

// Save settings — split into org and user buckets
export async function saveSettingsToDB(orgId, userId, settings) {
  const { org, user } = splitSettings(settings);
  const now = new Date().toISOString();
  try {
    await Promise.all([
      orgId  && Object.keys(org).length  ? dbPost('org_settings',  { organization_id: orgId, settings: org,  updated_at: now }) : Promise.resolve(),
      userId && Object.keys(user).length ? dbPost('user_settings', { user_id: userId,         settings: user, updated_at: now }) : Promise.resolve(),
    ]);
  } catch { /* non-fatal */ }
}

// Legacy export for any code still importing stripBinary
export function stripBinary(settings) {
  const s = { ...settings };
  BINARY_KEYS.forEach(k => delete s[k]);
  return s;
}
