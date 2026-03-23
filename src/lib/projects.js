/**
 * src/lib/projects.js
 * Supabase CRUD for projects — mapped exactly to DB schema.
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

/** Convert app project → DB row (only columns that exist in DB) */
function toDbRow(p) {
  return {
    id:                p.id,
    organization_id:   p.organization_id   || null,
    name:              p.name || p.title   || '',       // DB uses "name" not "title"
    description:       p.description || p.notes || '',  // DB uses "description" not "notes"
    location:          p.location || p.address || '',   // DB uses "location" not "address"
    status:            p.status            || 'active',
    color:             p.color             || '#4a90d9',
    type:              p.type              || '',
    date:              p.date              || '',
    scope:             p.scope             || '',
    manual_gps:        p.manualGps         || false,
    coords:            p.coords            || null,
    lat:               p.lat               || '',
    lng:               p.lng               || '',
    timeline_stage:    p.timelineStage     || '',
    timeline_notes:    p.timelineNotes     || {},
    scratch_pad:       p.scratchPad        || '',
    photo_tags:        p.photoTags         || [],
    ba_pairs:          p.baPairs           || [],
    client_portal:     p.clientPortal      || {},
    portal_config:     p.portalConfig      || {},
    activity_log:      p.activityLog       || [],
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
    rooms:             p.rooms             || [],
    reports:           p.reports           || [],
    checklists:        p.checklists        || [],
    photos:            stripPhotos(p.photos || []),
  };
}

/** Convert DB row → app project */
function fromDbRow(row) {
  return {
    id:               row.id,
    organization_id:  row.organization_id,
    name:             row.name             || 'Untitled Project',
    title:            row.name             || 'Untitled Project',
    description:      row.description      || '',
    notes:            row.description      || '',
    location:         row.location         || '',
    address:          row.location         || '',
    status:           row.status           || 'active',
    color:            row.color            || '#4a90d9',
    type:             row.type             || '',
    date:             row.date             || '',
    scope:            row.scope            || '',
    manualGps:        row.manual_gps       || false,
    coords:           row.coords           || null,
    lat:              row.lat              || '',
    lng:              row.lng              || '',
    timelineStage:    row.timeline_stage   || '',
    timelineNotes:    row.timeline_notes   || {},
    scratchPad:       row.scratch_pad      || '',
    photoTags:        row.photo_tags       || [],
    baPairs:          row.ba_pairs         || [],
    clientPortal:     row.client_portal    || {},
    portalConfig:     row.portal_config    || {},
    activityLog:      row.activity_log     || [],
    clientName:       row.client_name      || '',
    clientEmail:      row.client_email     || '',
    clientPhone:      row.client_phone     || '',
    contractorName:   row.contractor_name  || '',
    contractorPhone:  row.contractor_phone || '',
    insuranceCompany: row.insurance_company || '',
    claimNumber:      row.claim_number     || '',
    adjusterName:     row.adjuster_name    || '',
    adjusterPhone:    row.adjuster_phone   || '',
    deductible:       row.deductible       || '',
    policyNumber:     row.policy_number    || '',
    rooms:            row.rooms            || [],
    reports:          row.reports          || [],
    checklists:       row.checklists       || [],
    photos:           row.photos           || [],
    videos:           [],
    voiceNotes:       [],
    sketches:         [],
    files:            [],
    tasks:            [],
    createdAt:        row.created_at       || '',
    createdBy:        row.created_by       || '',
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
  delete row.id;
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
    .update(row)
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
    .insert([{
      folder_id: folderId,
      project_id: projectId,
      storage_path: storagePath,
      filename: file.name,
      size_bytes: file.size,
      mime_type: file.type,
    }])
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
  const { data, error } = await supabase.storage
    .from('project-photos')
    .createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
