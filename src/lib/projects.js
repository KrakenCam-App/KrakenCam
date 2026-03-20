/**
 * src/lib/projects.js
 *
 * Supabase CRUD helpers for projects, picture_folders, and pictures.
 * All queries are automatically org-scoped via Row Level Security (RLS).
 * The logged-in user's JWT is used automatically by the supabase client.
 */

import { supabase } from './supabase';

// ─── Projects ────────────────────────────────────────────────────────────────

/**
 * Fetch all projects for the current user's org.
 * RLS ensures only org-scoped rows are returned.
 */
export async function getProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Insert a new project row and return it.
 * @param {Object} data  - Project fields. Must include organization_id.
 */
export async function createProject(data) {
  const { data: row, error } = await supabase
    .from('projects')
    .insert([data])
    .select()
    .single();

  if (error) throw error;
  return row;
}

/**
 * Update an existing project row by its UUID.
 * @param {string} id    - Project UUID (projects.id).
 * @param {Object} data  - Partial fields to update.
 */
export async function updateProject(id, data) {
  const { data: row, error } = await supabase
    .from('projects')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return row;
}

/**
 * Delete a project row by its UUID.
 * Cascades to picture_folders and pictures via FK constraints if set up.
 * @param {string} id - Project UUID.
 */
export async function deleteProject(id) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ─── Picture Folders ──────────────────────────────────────────────────────────

/**
 * Fetch all picture_folders for a project.
 * @param {string} projectId - Project UUID.
 */
export async function getFolders(projectId) {
  const { data, error } = await supabase
    .from('picture_folders')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Create a new picture folder inside a project.
 * @param {string} projectId - Project UUID.
 * @param {string} name      - Folder name (e.g. room name).
 */
export async function createFolder(projectId, name) {
  const { data: row, error } = await supabase
    .from('picture_folders')
    .insert([{ project_id: projectId, name }])
    .select()
    .single();

  if (error) throw error;
  return row;
}

/**
 * Delete a picture folder by UUID.
 * @param {string} id - picture_folders.id
 */
export async function deleteFolder(id) {
  const { error } = await supabase
    .from('picture_folders')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ─── Pictures ─────────────────────────────────────────────────────────────────

/**
 * Fetch all pictures for a folder.
 * @param {string} folderId - picture_folders.id
 */
export async function getPictures(folderId) {
  const { data, error } = await supabase
    .from('pictures')
    .select('*')
    .eq('folder_id', folderId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Upload a photo file to storage and insert a pictures row.
 *
 * Storage path: {orgId}/{projectId}/{folderId}/{timestamp}_{filename}
 *
 * @param {string} folderId  - picture_folders.id
 * @param {string} projectId - projects.id
 * @param {string} orgId     - organizations.id (for path isolation)
 * @param {File}   file      - The File object to upload
 * @returns {Object} The newly inserted pictures row
 */
export async function uploadPicture(folderId, projectId, orgId, file) {
  const timestamp = Date.now();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${orgId}/${projectId}/${folderId}/${timestamp}_${safeFilename}`;

  // Upload to Supabase storage bucket "project-photos"
  const { error: uploadError } = await supabase.storage
    .from('project-photos')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Insert metadata row in pictures table
  const { data: row, error: insertError } = await supabase
    .from('pictures')
    .insert([{
      folder_id:    folderId,
      project_id:   projectId,
      storage_path: storagePath,
      filename:     file.name,
      size_bytes:   file.size,
      mime_type:    file.type,
    }])
    .select()
    .single();

  if (insertError) throw insertError;
  return row;
}

/**
 * Delete a picture from both storage and the DB.
 * @param {string} id          - pictures.id
 * @param {string} storagePath - The storage path stored in pictures.storage_path
 */
export async function deletePicture(id, storagePath) {
  // Remove from storage first (non-fatal if missing)
  if (storagePath) {
    await supabase.storage
      .from('project-photos')
      .remove([storagePath]);
  }

  // Delete the DB row
  const { error } = await supabase
    .from('pictures')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Get a short-lived signed URL for a private storage object.
 * @param {string} storagePath - The path stored in pictures.storage_path
 * @param {number} [expiresIn=3600] - Seconds until URL expires (default 1 hour)
 * @returns {string} Signed URL
 */
export async function getPictureUrl(storagePath, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from('project-photos')
    .createSignedUrl(storagePath, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}
