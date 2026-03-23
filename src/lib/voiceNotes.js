/**
 * src/lib/voiceNotes.js
 *
 * Supabase CRUD helpers for voice_notes.
 * Audio blobs are uploaded to the "project-photos" storage bucket.
 * All queries are org-scoped via RLS.
 */

import { supabase, getAuthHeaders } from './supabase';

const BUCKET = 'project-photos';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Fetch all voice notes for a project.
 * @param {string} projectId - projects.id
 */
export async function getVoiceNotes(projectId) {
  const { data, error } = await supabase
    .from('voice_notes')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Upload an audio blob to storage and insert a voice_notes row.
 *
 * Storage path: {orgId}/{projectId}/voice/{timestamp}.webm
 *
 * @param {string} projectId      - projects.id
 * @param {string} orgId          - organizations.id
 * @param {Blob}   audioBlob      - The recorded audio blob
 * @param {number} [durationSeconds] - Duration in seconds (optional)
 * @returns {Object} The newly inserted voice_notes row
 */
export async function uploadVoiceNote(projectId, orgId, audioBlob, durationSeconds, title = null, createdByName = null, durationMs = null) {
  const timestamp = Date.now();
  const mime = audioBlob.type || 'audio/webm';
  const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : 'webm';
  const storagePath = `${orgId}/${projectId}/voice/${timestamp}.${ext}`;

  // Use raw fetch with auth headers (same as project photo uploads — avoids RLS issues)
  const uploadHeaders = await getAuthHeaders({ 'Content-Type': mime, 'x-upsert': 'false' });
  const uploadRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`,
    { method: 'POST', headers: uploadHeaders, body: audioBlob }
  );
  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => uploadRes.status);
    throw new Error(`Voice note upload failed: ${errText}`);
  }

  const { data: row, error: insertError } = await supabase
    .from('voice_notes')
    .insert([{
      organization_id:  orgId,
      project_id:       projectId,
      storage_path:     storagePath,
      duration_seconds: durationSeconds ? Math.round(durationSeconds) : null,
      duration_ms:      durationMs || (durationSeconds ? durationSeconds * 1000 : null),
      mime_type:        mime,
      title:            title || null,
      created_by_name:  createdByName || null,
    }])
    .select()
    .single();

  if (insertError) throw insertError;
  return row;
}

/**
 * Delete a voice note from both storage and the DB.
 * @param {string} id          - voice_notes.id
 * @param {string} storagePath - voice_notes.storage_path
 */
export async function deleteVoiceNote(id, storagePath) {
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  }

  const { error } = await supabase
    .from('voice_notes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Get a signed URL for a private voice note audio file.
 * @param {string} storagePath
 * @param {number} [expiresIn=3600]
 */
export async function getVoiceNoteUrl(storagePath, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}
