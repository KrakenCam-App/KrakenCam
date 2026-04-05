/**
 * src/lib/videos.js
 *
 * Supabase CRUD helpers for video_recordings and video_chapter_markers.
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
    .order('recorded_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

/**
 * Upload a video blob to storage and insert a video_recordings row.
 *
 * Storage path: {orgId}/{projectId}/videos/{timestamp}.webm
 *
 * @param {string} projectId          - projects.id
 * @param {string} orgId              - organizations.id
 * @param {Blob}   videoBlob          - The video blob to upload
 * @param {string} [title]            - Video title
 * @param {number} [durationSeconds]  - Duration in seconds
 * @param {string} [room]             - Room name
 * @param {string} [gps]              - GPS coords string
 * @param {string} [recordedByUserId] - User ID who recorded
 * @param {string[]} [tags]           - Tag array
 * @param {string} [notes]            - Notes text
 * @returns {Object} The newly inserted video_recordings row
 */
export async function uploadVideo(
  projectId,
  orgId,
  videoBlob,
  title,
  durationSeconds,
  room = null,
  gps = null,
  recordedByUserId = null,
  tags = [],
  notes = null
) {
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
      organization_id:      orgId,
      project_id:           projectId,
      title:                title || null,
      storage_path:         storagePath,
      duration_seconds:     durationSeconds ? Math.round(durationSeconds) : null,
      mime_type:            mimeType,
      room:                 room || null,
      gps:                  gps  || null,
      recorded_at:          new Date().toISOString(),
      recorded_by_user_id:  recordedByUserId || null,
      tags:                 tags && tags.length > 0 ? tags : [],
      notes:                notes || null,
    }])
    .select()
    .single();

  if (insertError) throw insertError;
  return row;
}

/**
 * Update metadata on an existing video recording.
 * @param {string} id      - video_recordings.id
 * @param {Object} updates - Fields to update (title, notes, tags, trim_start_seconds, trim_end_seconds, room)
 */
export async function updateVideo(id, updates) {
  const allowed = ['title', 'notes', 'tags', 'room', 'trim_start_seconds', 'trim_end_seconds', 'thumbnail_url'];
  const payload = {};
  for (const key of allowed) {
    if (key in updates) payload[key] = updates[key];
  }
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('video_recordings')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
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

// ─────────────────────────────────────────────────────────────────
// Chapter Markers
// ─────────────────────────────────────────────────────────────────

/**
 * Fetch all chapter markers for a video, ordered by timestamp.
 * @param {string} videoId - video_recordings.id
 */
export async function getChapterMarkers(videoId) {
  const { data, error } = await supabase
    .from('video_chapter_markers')
    .select('*')
    .eq('video_id', videoId)
    .order('timestamp_seconds', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Add a chapter marker.
 * @param {Object} data
 * @param {string} data.videoId
 * @param {string} data.projectId
 * @param {string} data.orgId
 * @param {number} data.timestampSeconds
 * @param {string} data.label
 * @param {string} [data.notes]
 * @param {string} [data.createdByUserId]
 */
export async function addChapterMarker({ videoId, projectId, orgId, timestampSeconds, label, notes, createdByUserId }) {
  const { data, error } = await supabase
    .from('video_chapter_markers')
    .insert([{
      video_id:            videoId,
      project_id:          projectId,
      organization_id:     orgId,
      timestamp_seconds:   timestampSeconds,
      label:               label,
      notes:               notes || null,
      created_by_user_id:  createdByUserId || null,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a chapter marker.
 * @param {string} id      - video_chapter_markers.id
 * @param {Object} updates - { label, notes, timestamp_seconds }
 */
export async function updateChapterMarker(id, updates) {
  const payload = { updated_at: new Date().toISOString() };
  if ('label'             in updates) payload.label             = updates.label;
  if ('notes'             in updates) payload.notes             = updates.notes;
  if ('timestamp_seconds' in updates) payload.timestamp_seconds = updates.timestamp_seconds;

  const { data, error } = await supabase
    .from('video_chapter_markers')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a chapter marker.
 * @param {string} id - video_chapter_markers.id
 */
export async function deleteChapterMarker(id) {
  const { error } = await supabase
    .from('video_chapter_markers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
