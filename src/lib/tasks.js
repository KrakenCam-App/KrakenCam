/**
 * src/lib/tasks.js
 *
 * Supabase CRUD helpers for tasks (tasks table).
 * All queries are automatically org-scoped via Row Level Security (RLS).
 */

import { supabase } from './supabase';

/**
 * Fetch all tasks for the current user's org.
 * Optionally filter by project.
 *
 * @param {string|null} projectId - Optional project UUID to filter by.
 * @returns {Array} Array of task rows.
 */
export async function getTasks(projectId = null) {
  let query = supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Insert a new task.
 *
 * @param {Object} data - Task fields.
 *   Required: title
 *   Optional: project_id, description, completed, assigned_to, due_date, created_by
 * @returns {Object} The newly inserted row.
 */
export async function createTask(data) {
  const { data: row, error } = await supabase
    .from('tasks')
    .insert([data])
    .select()
    .single();

  if (error) throw error;
  return row;
}

/**
 * Update an existing task by its UUID.
 * Use this to mark complete, update title, reassign, etc.
 *
 * @param {string} id   - tasks.id
 * @param {Object} data - Partial fields to update (e.g. { completed: true })
 * @returns {Object} The updated row.
 */
export async function updateTask(id, data) {
  const { data: row, error } = await supabase
    .from('tasks')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return row;
}

/**
 * Delete a task by its UUID.
 *
 * @param {string} id - tasks.id
 */
export async function deleteTask(id) {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
