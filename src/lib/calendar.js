/**
 * src/lib/calendar.js
 * Supabase CRUD for cal_events — full field mapping.
 */

import { supabase } from './supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isUuid(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}
function newUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/** Combine date string + time string → ISO timestamptz string */
function toIso(date, time, allDay) {
  if (!date) return null;
  if (allDay) return `${date}T00:00:00`;
  return time ? `${date}T${time}:00` : `${date}T00:00:00`;
}

/** App camelCase → DB snake_case */
function toDbRow(ev) {
  const allDay = ev.allDay ?? false;
  return {
    organization_id:     ev.organization_id,
    project_id:          ev.projectId           || ev.project_id        || null,
    title:               ev.title               || '',
    description:         ev.description         || null,
    notes:               ev.notes               || null,
    type:                ev.type                || 'appointment',
    color:               ev.color               || '#2b7fe8',
    start_at:            toIso(ev.startDate, ev.startTime, allDay),
    end_at:              toIso(ev.endDate,   ev.endTime,   allDay) ||
                         toIso(ev.startDate, ev.endTime,   allDay),
    all_day:             allDay,
    assignee_ids:        ev.assigneeIds          || ev.assignee_ids      || [],
    repeat_enabled:      ev.repeatEnabled        ?? ev.repeat_enabled    ?? false,
    repeat_type:         ev.repeatType           || ev.repeat_type       || 'days',
    repeat_value:        ev.repeatValue          ?? ev.repeat_value      ?? 1,
    repeat_day:          ev.repeatDay            ?? ev.repeat_day        ?? 1,
    repeat_weekday:      ev.repeatWeekday        ?? ev.repeat_weekday    ?? 0,
    repeat_end_date:     ev.repeatEndDate        || ev.repeat_end_date   || null,
    created_by:          ev.createdBy            || ev.created_by        || null,
    // ── New fields ────────────────────────────────────────────────────────────
    priority:            ev.priority             || 'normal',
    status:              ev.status               || 'scheduled',
    location:            ev.location             || null,
    visibility:          ev.visibility           || 'shared',
    reminder_preset:     ev.reminderPreset       || ev.reminder_preset   || null,
    cancelled_at:        ev.cancelledAt          || ev.cancelled_at      || null,
    completed_at:        ev.completedAt          || ev.completed_at      || null,
    created_by_user_id:  ev.createdByUserId      || ev.created_by_user_id || null,
  };
}

/** DB snake_case → app camelCase */
function fromDbRow(row) {
  const startAt = row.start_at || '';
  const endAt   = row.end_at   || '';
  return {
    id:               row.id,
    organization_id:  row.organization_id,
    projectId:        row.project_id          || '',
    title:            row.title               || '',
    description:      row.description         || '',
    notes:            row.notes               || '',
    type:             row.type                || 'appointment',
    color:            row.color               || '#2b7fe8',
    startDate:        startAt.slice(0, 10),
    endDate:          endAt.slice(0, 10)      || startAt.slice(0, 10),
    startTime:        startAt.slice(11, 16)   || '09:00',
    endTime:          endAt.slice(11, 16)     || '10:00',
    allDay:           row.all_day             ?? false,
    assigneeIds:      row.assignee_ids        || [],
    repeatEnabled:    row.repeat_enabled      ?? false,
    repeatType:       row.repeat_type         || 'days',
    repeatValue:      row.repeat_value        ?? 1,
    repeatDay:        row.repeat_day          ?? 1,
    repeatWeekday:    row.repeat_weekday      ?? 0,
    repeatEndDate:    row.repeat_end_date     || '',
    createdBy:        row.created_by          || '',
    createdAt:        row.created_at          || '',
    updatedAt:        row.updated_at          || '',
    // ── New fields ────────────────────────────────────────────────────────────
    priority:         row.priority            || 'normal',
    status:           row.status              || 'scheduled',
    location:         row.location            || '',
    visibility:       row.visibility          || 'shared',
    reminderPreset:   row.reminder_preset     || '',
    cancelledAt:      row.cancelled_at        || null,
    completedAt:      row.completed_at        || null,
    createdByUserId:  row.created_by_user_id  || null,
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getCalEvents(projectId = null) {
  let query = supabase
    .from('cal_events')
    .select('*')
    .order('start_at', { ascending: true });
  if (projectId) query = query.eq('project_id', projectId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(fromDbRow);
}

export async function createCalEvent(ev) {
  const row = toDbRow(ev);
  // Use client UUID if valid, otherwise generate one
  row.id = (ev.id && isUuid(ev.id)) ? ev.id : newUuid();

  const { data, error } = await supabase
    .from('cal_events')
    .insert([row])
    .select()
    .single();
  if (error) throw error;
  return fromDbRow(data);
}

export async function updateCalEvent(id, ev) {
  const row = toDbRow(ev);
  delete row.organization_id;
  delete row.created_by;
  delete row.created_by_user_id;
  // Set updated_at on every save
  row.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('cal_events')
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return fromDbRow(data);
}

export async function deleteCalEvent(id) {
  const { error } = await supabase.from('cal_events').delete().eq('id', id);
  if (error) throw error;
}

// ── Activity log ──────────────────────────────────────────────────────────────

export async function getEventActivity(eventId) {
  const { data, error } = await supabase
    .from('event_activity_logs')
    .select('*, profiles(full_name, first_name, last_name)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function logEventActivity({ event_id, organization_id, user_id, action_type, action_label, old_value_json, new_value_json }) {
  const { error } = await supabase
    .from('event_activity_logs')
    .insert([{ event_id, organization_id, user_id, action_type, action_label, old_value_json, new_value_json }]);
  if (error) console.warn('[calendar] Failed to log activity:', error.message);
}
