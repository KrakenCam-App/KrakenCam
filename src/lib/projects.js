/**
 * src/lib/projects.js
 * Supabase CRUD for projects — full rich data including rooms, photos,
 * reports, checklists, activity log, portal config, and all metadata.
 */

import { supabase } from './supabase';

function stripPhotos(photos = []) {
  return photos.map(p => {
    const isBase64 = p.dataUrl && p.dataUrl.startsWith('data:');
    if (isBase64) {
      const { dataUrl, ...rest } = p;
      return { ...rest, hasImage: true };
    }
    return p;
  });
}

function stripFiles(files = []) {
  return files.map(f => {
    const isBase64 = f.dataUrl && f.dataUrl.startsWith('data:');
    if (isBase64) {
      const { dataUrl, ...rest } = f;
      return { ...rest, hasFile: true };
    }
    return f;
  });
}

function stripVideos(videos = []) {
  return videos.map(v => {
    const { dataUrl, _blob, ...rest } = v;
    return rest;
  });
}

/** Convert app camelCase project → DB snake_case row */
function toDbRow(p) {
  return {
    id:                p.id,
    organization_id:   p.organization_id   || null,  // ← fixed
    title:             p.title             || '',
    address:           p.address           || '',
    city:              p.city              || '',
    state:             p.state             || '',
    zip:               p.zip               || '',
    lat:               p.lat               || '',
    lng:               p.lng               || '',
    color:             p.color             || '#4a90d9',
    type:              p.type              || '',
    status:            p.status            || 'active',
    date:              p.date              || '',
    notes:             p.notes             || '',
    scope:             p.scope             || '',
    client_name:       p.clientName        || '',
    client_email:      p.clientEmail       || '',
    client_phone:      p.clientPhone       || '',
    contractor_name:   p.contractorName    || '',
    contractor_phone:  p.contractorPhone   || '',
    insurance_company: p.insuranceCompany  || '',
    claim_number:      p.claimNumber       || '',
    adjuster_name:     p.adjusterName      || '',
    adjuster_phone:    p.adjusterPhone     || '',
    deductible:        p.deductible        || '',
    policy_number:     p.policyNumber      || '',
    manual_gps:        p.manualGps         || false,
    coords:            p.coords            || null,
    timeline_stage:    p.timelineStage     || '',
    timeline_notes:    p.timelineNotes     || {},
    scratch_pad:       p.scratchPad        || '',
    photo_tags:        p.photoTags         || [],
    ba_pairs:          p.baPairs           || [],
    client_portal:     p.clientPortal      || {},
    portal_config:     p.portalConfig      || {},
    activity_log:      p.activityLog       || [],
    rooms:             p.rooms             || [],
    reports:           p.reports           || [],
    checklists:        p.checklists        || [],
    photos:            stripPhotos(p.photos || []),
    files:             stripFiles(p.files   || []),
  };
}

/** Convert DB snake_case row → app camelCase project */
function fromDbRow(row) {
  return {
    id:               row.id,
    organization_id:  row.organization_id,
    title:            row.title             || 'Untitled Project',
    address:          row.address           || '',
    city:             row.city              || '',
    state:            row.state             || '',
    zip:              row.zip               || '',
    lat:              row.lat               || '',
    lng:              row.lng               || '',
    color:            row.color             || '#4a90d9',
    type:             row.type              || '',
    status:           row.status            || 'active',
    date:             row.date              || '',
    notes:            row.notes             || '',
    scope:            row.scope             || '',
    clientName:       row.client_name       || '',
    clientEmail:      row.client_email      || '',
    clientPhone:      row.client_phone      || '',
    contractorName:   row.contractor_name   || '',
    contractorPhone:  row.contractor_phone  || '',
    insuranceCompany: row.insurance_company || '',
    claimNumber:      row.claim_number      || '',
    adjusterName:     row.adjuster_name     || '',
    adjusterPhone:    row.adjuster_phone    || '',
    deductible:       row.deductible        || '',
    policyNumber:     row.policy_number     || '',
    manualGps:        row.manual_gps        || false,
    coords:           row.coords            || null,
    timelineStage:    row.timeline_stage    || '',
    timelineNotes:    row.timeline_notes    || {},
    scratchPad:       row.scratch_pad       || '',
    photoTags:        row.photo_tags        || [],
    baPairs:          row.ba_pairs          || [],
    clientPortal:     row.client_portal     || {},
    portalConfig:     row.portal_config     || {},
    activityLog:      row.activity_log      || [],
    rooms:            row.rooms             || [],
    reports:          row.reports           || [],
    checklists:       row.checklists        || [],
    photos:           row.photos            || [],
    videos:           row.videos            || [],
    voiceNotes:       row.voice_notes       || [],
    sketches:         row.sketches          || [],
    files:            row.files             || [],
    tasks:            row.tasks             || [],
    createdAt:        row.created_at        || '',
    updatedAt:        row.updated_at        || '',
  };
}

export async function getProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromDbRow);
}

export async function createProject(project) {
  const row = toDbRow(project);
  const { data, error } = await supabase
    .from('projects')
    .insert([row])
    .select()
    .single();
  if (error) throw error;
  return fromDbRow(data);
}

export async function updateProject(id, project) {
  const row = toDbRow(project);
  delete row.id;
  const { data, error } = await supabase
    .from('projects')
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return fromDbRow(data);
}

export async function deleteProject(id) {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

// ── Picture Folders ────────────────────────────────────────────────────────────

export async function getFolders(projectId) {
  const { data, error } = await supabase
    .from('picture_folders')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createFolder(projectId, name) {
  const { data: row, error } = await supabase
    .from('picture_folders')
    .insert([{ project_id: projectId, name }])
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function deleteFolder(id) {
  const { error } = await supabase.from('picture_folders').delete().eq('id', id);
  if (error) throw error;
}

// ── Pictures ──────────────────────────────────────────────────────────────────

export async function getPictures(folderId) {
  const { data, error } = await supabase
    .from('pictures')
    .select('*')
    .eq('folder_id', folderId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function uploadPicture(folderId, projectId, orgId, file) {
  const timestamp = Date.now();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${orgId}/${projectId}/${folderId}/${timestamp}_${safeFilename}`;
  const { error: uploadError } = await supabase.storage
    .from('project-photos')
    .upload(storagePath, file, { cacheControl: '3600', upsert: false });
  if (uploadError) throw uploadError;
  const { data: row, error: insertError } = await supabase
    .from('pictures')
    .insert([{ folder_id: folderId, project_id: projectId, storage_path: storagePath, filename: file.name, size_bytes: file.size, mime_type: file.type }])
    .select()
    .single();
  if (insertError) throw insertError;
  return row;
}

export async function deletePicture(id, storagePath) {
  if (storagePath) await supabase.storage.from('project-photos').remove([storagePath]);
  const { error } = await supabase.from('pictures').delete().eq('id', id);
  if (error) throw error;
}

export async function getPictureUrl(storagePath, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from('project-photos').createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
