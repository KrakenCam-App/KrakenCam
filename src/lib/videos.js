/**
 * src/lib/videos.js
 *
 * Supabase CRUD helpers for video_recordings.
 * Video blobs are uploaded to the "project-photos" storage bucket.
 * All queries are org-scoped via RLS.
 */

import { supabase } from './supabase';

const BUCKET = 'project-photos';

/**
 * Fetch all video recordings for a project.
 * @param {string} projectId - projects.id
 */
export async function getVideos(projectId) {
  const { data, error } = await supabase
    .from('video_recordings')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Upload a video blob to storage and insert a video_recordings row.
 *
 * Storage path: {orgId}/{projectId}/videos/{timestamp}.webm
 *
 * @param {string} projectId       - projects.id
 * @param {string} orgId           - organizations.id
 * @param {Blob}   videoBlob       - The video blob to upload
 * @param {string} [title]         - Video title
 * @param {number} [durationSeconds] - Duration in seconds
 * @returns {Object} The newly inserted video_recordings row
 */
export async function uploadVideo(projectId, orgId, videoBlob, title, durationSeconds, room = null, gps = null) {
  const timestamp = Date.now();
  const mimeType = videoBlob.type || 'video/webm';
  const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogv' : 'webm';
  const storagePath = `${orgId}/${projectId}/videos/${timestamp}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, videoBlob, {
      cacheControl: '3600',
      upsert: false,
      contentType: mimeType,
    });

  if (uploadError) throw uploadError;

  const { data: row, error: insertError } = await supabase
    .from('video_recordings')
    .insert([{
      organization_id:  orgId,
      project_id:       projectId,
      title:            title || null,
      storage_path:     storagePath,
      duration_seconds: durationSeconds ? Math.round(durationSeconds) : null,
      mime_type:        mimeType,
      room:             room || null,
      gps:              gps  || null,
    }])
    .select()
    .single();

  if (insertError) throw insertError;
  return row;
}

/**
 * Delete a video from both storage and the DB.
 * @param {string} id          - video_recordings.id
 * @param {string} storagePath - video_recordings.storage_path
 */
export async function deleteVideo(id, storagePath) {
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  }

  const { error } = await supabase
    .from('video_recordings')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Get a signed URL for a private video recording.
 * @param {string} storagePath
 * @param {number} [expiresIn=3600]
 */
export async function getVideoUrl(storagePath, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}
