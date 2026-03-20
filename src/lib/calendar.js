/**
 * src/lib/calendar.js
 *
 * Supabase CRUD helpers for calendar events (cal_events table).
 * All queries are automatically org-scoped via Row Level Security (RLS).
 */

import { supabase } from './supabase';

/**
 * Fetch all calendar events for the current user's org.
 * Optionally filter by project.
 *
 * @param {string|null} projectId - Optional project UUID to filter by.
 * @returns {Array} Array of cal_event rows.
 */
export async function getCalEvents(projectId = null) {
  let query = supabase
    .from('cal_events')
    .select('*')
    .order('start_at', { ascending: true });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Insert a new calendar event.
 *
 * @param {Object} data - Event fields.
 *   Required: title, start_at
 *   Optional: project_id, description, end_at, all_day, created_by
 * @returns {Object} The newly inserted row.
 */
export async function createCalEvent(data) {
  const { data: row, error } = await supabase
    .from('cal_events')
    .insert([data])
    .select()
    .single();

  if (error) throw error;
  return row;
}

/**
 * Update an existing calendar event by its UUID.
 *
 * @param {string} id   - cal_events.id
 * @param {Object} data - Partial fields to update.
 * @returns {Object} The updated row.
 */
export async function updateCalEvent(id, data) {
  const { data: row, error } = await supabase
    .from('cal_events')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return row;
}

/**
 * Delete a calendar event by its UUID.
 *
 * @param {string} id - cal_events.id
 */
export async function deleteCalEvent(id) {
  const { error } = await supabase
    .from('cal_events')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
