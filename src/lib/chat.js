/**
 * src/lib/chat.js
 * Supabase CRUD for chat_rooms, chat_members, and chat_messages.
 * Supports text, image, file, and voice attachments.
 */

import { supabase, getAuthHeaders } from './supabase';

const MSG_BUCKET = 'chat-attachments';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// ── Chat Rooms ────────────────────────────────────────────────────────────────

export async function getChatRooms(orgId) {
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('*, chat_members(*)')
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function upsertChatRoom(orgId, chat) {
  const { data, error } = await supabase
    .from('chat_rooms')
    .upsert({
      id:              chat.id,
      organization_id: orgId,
      name:            chat.name || '',
      is_group:        chat.isGroup || false,
      created_by:      chat.createdBy || null,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;

  // Upsert members
  if (chat.memberIds?.length) {
    const members = chat.memberIds.map(uid => ({
      chat_room_id:    chat.id,
      organization_id: orgId,
      user_id:         uid,
    }));
    await supabase.from('chat_members').upsert(members, { onConflict: 'chat_room_id,user_id', ignoreDuplicates: true });
  }

  return data;
}

export async function deleteChatRoom(id) {
  const { error } = await supabase.from('chat_rooms').delete().eq('id', id);
  if (error) throw error;
}

// ── Chat Messages ─────────────────────────────────────────────────────────────

export async function getChatMessages(chatRoomId, limit = 100) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('chat_room_id', chatRoomId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function sendChatMessage(orgId, chatRoomId, msg) {
  let attachmentPath = null;
  let attachmentUrl  = null;
  let attachmentName = null;
  let attachmentSize = null;
  let messageType    = msg.messageType || 'text';

  // Upload attachment to storage if present
  const attDataUrl = msg.attachment?.dataUrl || msg.attachment?.url || null;
  if (attDataUrl) {
    try {
      const att = { ...msg.attachment, dataUrl: attDataUrl };
      const isVoice = att.type?.startsWith('audio') || messageType === 'voice';
      const isImage = att.type?.startsWith('image') || messageType === 'image';
      messageType = isVoice ? 'voice' : isImage ? 'image' : 'file';

      let blob;
      const dataUrl = att.dataUrl;

      if (!dataUrl) {
        blob = null; // nothing to upload
      } else if (dataUrl.startsWith('http') || dataUrl.startsWith('/')) {
        // Already a hosted URL (e.g. Supabase Storage) — use it directly
        attachmentUrl  = dataUrl;
        attachmentName = att.name || 'attachment';
        attachmentSize = att.size || null;
        blob = null;
      } else if (dataUrl.startsWith('data:')) {
        // Base64 dataUrl — decode to blob
        const arr  = dataUrl.split(',');
        const mime = (arr[0].match(/:(.*?);/) || [])[1] || att.type || 'application/octet-stream';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8 = new Uint8Array(n);
        while (n--) u8[n] = bstr.charCodeAt(n);
        blob = new Blob([u8], { type: mime });
      } else if (dataUrl.startsWith('blob:')) {
        // Blob URL — fetch to get actual bytes
        const res = await fetch(dataUrl);
        blob = await res.blob();
      } else {
        console.warn('[KrakenCam] Unsupported attachment dataUrl format:', dataUrl.slice(0, 30));
        blob = null;
      }

      if (blob && blob.size > 0) {
        const mime = blob.type || att.type || 'application/octet-stream';
        const ext  = mime.split('/')[1]?.split(';')[0]?.replace(/[^a-z0-9]/gi, '') || 'bin';
        const safeName = (att.name || `attachment.${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${orgId}/${chatRoomId}/${Date.now()}_${safeName}`;

        const uploadHeaders = await getAuthHeaders({ 'Content-Type': mime, 'x-upsert': 'false' });
        const uploadRes = await fetch(
          `${SUPABASE_URL}/storage/v1/object/${MSG_BUCKET}/${path}`,
          { method: 'POST', headers: uploadHeaders, body: blob }
        );

        if (uploadRes.ok) {
          attachmentPath = path;
          attachmentUrl  = `${SUPABASE_URL}/storage/v1/object/public/${MSG_BUCKET}/${path}`;
          attachmentName = att.name || `attachment.${ext}`;
          attachmentSize = blob.size;
        } else {
          const errText = await uploadRes.text().catch(() => uploadRes.status);
          console.warn('[KrakenCam] Chat attachment upload error:', errText);
        }
      }
    } catch (e) {
      console.warn('[KrakenCam] Chat attachment upload failed:', e.message);
    }
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert([{
      organization_id: orgId,
      chat_room_id:    chatRoomId,
      channel:         chatRoomId,
      sender_id:       msg.senderId || null,
      sender_name:     msg.senderName || null,
      content:         msg.content || '',
      message_type:    messageType,
      attachment_path: attachmentPath,
      attachment_url:  attachmentUrl,
      attachment_name: attachmentName,
      attachment_size: attachmentSize,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteChatMessage(id) {
  const { error } = await supabase.from('chat_messages').delete().eq('id', id);
  if (error) throw error;
}
