/**
 * src/lib/tasks.js
 *
 * Supabase CRUD helpers for tasks.
 * Handles the full task shape: title, description, priority, status,
 * assignees, due date, tags, checklist, comments, attachments, repeat settings.
 * All queries are automatically org-scoped via Row Level Security (RLS).
 */

import { supabase } from './supabase';

// ── Shape converters ──────────────────────────────────────────────────────────

/** App camelCase → DB snake_case */
function toDbRow(t) {
  // Strip base64 dataUrls from attachments before saving to DB
  const safeAttachments = (t.attachments || t.files || []).map(a => {
    if (a.dataUrl && a.dataUrl.startsWith('data:')) {
      const { dataUrl, ...rest } = a;
      return { ...rest, hasFile: true };
    }
    return a;
  });

  return {
    organization_id: t.organization_id,
    project_id:      t.projectId       || t.project_id       || null,
    title:           t.title           || '',
    description:     t.description     || null,
    priority:        t.priority        || 'medium',
    status:          t.status          || 'todo',
    assignee_ids:    t.assigneeIds      || t.assignee_ids     || [],
    due_date:        t.dueDate         || t.due_date         || null,
    completed:       t.completed       ?? false,
    completed_at:    t.completedAt     || t.completed_at     || null,
    repeat_enabled:  t.repeatEnabled   ?? t.repeat_enabled   ?? false,
    repeat_type:     t.repeatType      || t.repeat_type      || 'days',
    repeat_value:    t.repeatValue     ?? t.repeat_value     ?? 1,
    repeat_day:      t.repeatDay       ?? t.repeat_day       ?? 1,
    repeat_weekday:  t.repeatWeekday   ?? t.repeat_weekday   ?? 1,
    checklist:       t.checklist       || [],
    comments:        t.comments        || [],
    attachments:     safeAttachments,
    tags:            t.tags            || [],
    created_by:      t.createdBy       || t.created_by       || null,
  };
}

/** DB snake_case → app camelCase */
function fromDbRow(row) {
  return {
    id:             row.id,
    organization_id: row.organization_id,
    projectId:      row.project_id      || '',
    title:          row.title           || '',
    description:    row.description     || '',
    priority:       row.priority        || 'medium',
    status:         row.status          || 'todo',
    assigneeIds:    row.assignee_ids    || [],
    dueDate:        row.due_date        || '',
    completed:      row.completed       ?? false,
    completedAt:    row.completed_at    || null,
    repeatEnabled:  row.repeat_enabled  ?? false,
    repeatType:     row.repeat_type     || 'days',
    repeatValue:    row.repeat_value    ?? 1,
    repeatDay:      row.repeat_day      ?? 1,
    repeatWeekday:  row.repeat_weekday  ?? 1,
    checklist:      row.checklist       || [],
    comments:       row.comments        || [],
    attachments:    row.attachments     || [],
    tags:           row.tags            || [],
    createdBy:      row.created_by      || '',
    createdAt:      row.created_at      || '',
    updatedAt:      row.updated_at      || '',
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Fetch all tasks for the current user's org.
 * Optionally filter by project.
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
  return (data || []).map(fromDbRow);
}

// Check if a string is a valid UUID
function isUuid(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Generate a real UUID (works in all modern browsers)
function newUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Insert a new task.
 * Pass the full app-side task object — it will be converted to DB shape.
 */
export async function createTask(task) {
  const row = toDbRow(task);
  // Only keep the client id if it's a real UUID — otherwise let DB generate one
  if (task.id && isUuid(task.id)) {
    row.id = task.id;
  } else {
    row.id = newUuid();
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert([row])
    .select()
    .single();

  if (error) throw error;
  return fromDbRow(data);
}

/**
 * Update an existing task by UUID.
 * Pass partial or full app-side task fields.
 */
export async function updateTask(id, task) {
  const row = toDbRow(task);
  delete row.organization_id; // never overwrite org on update
  delete row.created_by;      // never overwrite creator

  const { data, error } = await supabase
    .from('tasks')
    .update(row)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromDbRow(data);
}

/**
 * Delete a task by UUID.
 */
export async function deleteTask(id) {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
