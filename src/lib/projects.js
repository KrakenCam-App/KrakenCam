/**
 * src/lib/projects.js
 * Supabase CRUD for projects — complete field mapping including all
 * site conditions, insurance, timeline, rooms, and team assignment.
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

// Strip base64 dataUrls from photos before saving (too large for DB)
function stripPhotos(photos = []) {
  return photos.map(p => {
    if (p.dataUrl && p.dataUrl.startsWith('data:')) {
      const { dataUrl, ...rest } = p;
      return { ...rest, hasImage: true };
    }
    return p;
  });
}

function stripFiles(files = []) {
  return files.map(f => {
    if (f.dataUrl && f.dataUrl.startsWith('data:')) {
      const { dataUrl, ...rest } = f;
      return { ...rest, hasFile: true };
    }
    return f;
  });
}

/** App camelCase → DB snake_case */
function toDbRow(p) {
  return {
    organization_id:       p.organization_id,
    title:                 p.title                 || 'Untitled Project',
    color:                 p.color                 || '#4a90d9',
    status:                p.status                || 'active',
    type:                  p.type                  || '',
    project_number:        p.projectNumber         || '',

    // Address
    address:               p.address               || '',
    city:                  p.city                  || '',
    state:                 p.state                 || '',
    zip:                   p.zip                   || '',
    lat:                   p.lat                   || '',
    lng:                   p.lng                   || '',
    manual_gps:            p.manualGps             ?? false,
    coords:                p.coords                || null,

    // Property
    property_type:         p.propertyType          || '',
    cause_of_loss:         p.causeOfLoss           || '',
    date_inspection:       p.dateInspection        || '',
    time_inspection:       p.timeInspection        || '',
    date_work_performed:   p.dateWorkPerformed      || '',
    time_work_performed:   p.timeWorkPerformed      || '',
    completion_date:       p.completionDate        || '',
    completion_time:       p.completionTime        || '',

    // Site conditions
    access_limitations:    p.accessLimitations     || '',
    power_status:          p.powerStatus           || 'on',
    water_status:          p.waterStatus           || 'on',
    ppe_items:             p.ppeItems              || [],
    ppe_other_text:        p.ppeOtherText          || '',

    // Client
    client_first_name:     p.clientFirstName       || '',
    client_last_name:      p.clientLastName        || '',
    client_name:           [p.clientFirstName, p.clientLastName].filter(Boolean).join(' ') || p.clientName || '',
    client_email:          p.clientEmail           || '',
    client_phone:          p.clientPhone           || '',
    client_relationship:   p.clientRelationship    || '',
    occupancy_status:      p.occupancyStatus       || '',

    // Contractor
    contractor_name:       p.contractorName        || '',
    contractor_phone:      p.contractorPhone       || '',

    // Insurance
    insurance_enabled:     p.insuranceEnabled      ?? false,
    insurance_carrier:     p.insuranceCarrier      || '',
    insurance_policy_num:  p.insurancePolicyNum    || '',
    claim_number:          p.claimNumber           || '',
    adjuster_name:         p.adjusterName          || '',
    adjuster_phone:        p.adjusterPhone         || '',
    adjuster_email:        p.adjusterEmail         || '',
    adjuster_company:      p.adjusterCompany       || '',
    date_of_loss:          p.dateOfLoss            || '',
    coverage_type:         p.coverageType          || '',
    deductible:            p.deductible            || '',
    policy_number:         p.policyNumber          || '',

    // Notes
    notes:                 p.notes                 || '',
    scope:                 p.scope                 || '',
    scratch_pad:           p.scratchPad            || '',

    // Team
    assigned_user_ids:     p.assignedUserIds       || [],

    // Timeline
    timeline_stage:        p.timelineStage         || '',
    timeline_notes:        p.timelineNotes         || {},
    timeline_client_notes: p.timelineClientNotes   || {},

    // Structured data
    rooms:                 p.rooms                 || [],
    reports:               p.reports               || [],
    checklists:            p.checklists            || [],
    photos:                stripPhotos(p.photos    || []),
    files:                 stripFiles(p.files      || []),
    photo_tags:            p.photoTags             || [],
    ba_pairs:              p.beforeAfterPairs      || p.baPairs || [],
    client_portal:         p.clientPortal          || {},
    portal_config:         p.portalConfig          || {},
    activity_log:          p.activityLog           || [],
  };
}

/** DB snake_case → app camelCase */
function fromDbRow(row) {
  return {
    id:                   row.id,
    organization_id:      row.organization_id,
    title:                row.title                 || 'Untitled Project',
    color:                row.color                 || '#4a90d9',
    status:               row.status                || 'active',
    type:                 row.type                  || '',
    projectNumber:        row.project_number        || '',

    // Address
    address:              row.address               || '',
    city:                 row.city                  || '',
    state:                row.state                 || '',
    zip:                  row.zip                   || '',
    lat:                  row.lat                   || '',
    lng:                  row.lng                   || '',
    manualGps:            row.manual_gps            ?? false,
    coords:               row.coords                || null,

    // Property
    propertyType:         row.property_type         || '',
    causeOfLoss:          row.cause_of_loss         || '',
    dateInspection:       row.date_inspection       || '',
    timeInspection:       row.time_inspection       || '',
    dateWorkPerformed:    row.date_work_performed    || '',
    timeWorkPerformed:    row.time_work_performed    || '',
    completionDate:       row.completion_date       || '',
    completionTime:       row.completion_time       || '',

    // Site conditions
    accessLimitations:    row.access_limitations    || '',
    powerStatus:          row.power_status          || 'on',
    waterStatus:          row.water_status          || 'on',
    ppeItems:             row.ppe_items             || [],
    ppeOtherText:         row.ppe_other_text        || '',

    // Client
    clientFirstName:      row.client_first_name     || '',
    clientLastName:       row.client_last_name      || '',
    // Derive full clientName: prefer new split fields, fall back to old client_name for legacy records
    clientName:           (row.client_first_name || row.client_last_name)
                            ? [row.client_first_name, row.client_last_name].filter(Boolean).join(' ')
                            : (row.client_name || ''),
    clientEmail:          row.client_email          || '',
    clientPhone:          row.client_phone          || '',
    clientRelationship:   row.client_relationship   || '',
    occupancyStatus:      row.occupancy_status      || '',

    // Contractor
    contractorName:       row.contractor_name       || '',
    contractorPhone:      row.contractor_phone      || '',

    // Insurance
    insuranceEnabled:     row.insurance_enabled     ?? false,
    insuranceCarrier:     row.insurance_carrier      || '',
    insurancePolicyNum:   row.insurance_policy_num  || '',
    claimNumber:          row.claim_number          || '',
    adjusterName:         row.adjuster_name         || '',
    adjusterPhone:        row.adjuster_phone        || '',
    adjusterEmail:        row.adjuster_email        || '',
    adjusterCompany:      row.adjuster_company      || '',
    dateOfLoss:           row.date_of_loss          || '',
    coverageType:         row.coverage_type         || '',
    deductible:           row.deductible            || '',
    policyNumber:         row.policy_number         || '',

    // Notes
    notes:                row.notes                 || '',
    scope:                row.scope                 || '',
    scratchPad:           row.scratch_pad           || '',

    // Team
    assignedUserIds:      row.assigned_user_ids     || [],

    // Timeline
    timelineStage:        row.timeline_stage        || '',
    timelineNotes:        row.timeline_notes        || {},
    timelineClientNotes:  row.timeline_client_notes || {},

    // Structured data
    rooms:                row.rooms                 || [],
    reports:              row.reports               || [],
    checklists:           row.checklists            || [],
    photos:               row.photos                || [],
    videos:               row.videos               || [],   // loaded separately from video_recordings table
    voiceNotes:           row.voice_notes           || [],   // loaded separately from voice_notes table
    sketches:             row.sketches              || [],   // loaded separately from sketches table
    files:                row.files                 || [],
    photoTags:            row.photo_tags            || [],
    beforeAfterPairs:     row.ba_pairs              || [],
    baPairs:              row.ba_pairs              || [],
    clientPortal:         row.client_portal         || {},
    portalConfig:         row.portal_config         || {},
    activityLog:          row.activity_log          || [],

    createdAt:            row.created_at            || '',
    updatedAt:            row.updated_at            || '',
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

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
  // Use client UUID if valid (needed for optimistic UI), otherwise let DB generate
  if (project.id && isUuid(project.id)) row.id = project.id;
  else row.id = newUuid();

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
  delete row.organization_id; // never overwrite org on update
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
