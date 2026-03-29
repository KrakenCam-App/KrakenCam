// ── Core helpers ─────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const isValidUuid = id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Track DB ids of messages we sent so realtime doesn't echo them back
const _sentChatDbIds = new Set();
export { _sentChatDbIds };

// ── EXIF / image orientation ──────────────────────────────────────────────────

/**
 * Read EXIF orientation tag from a Blob/File (JPEG only).
 * Returns 1-8 per EXIF spec, or 1 (normal) if not found.
 */
async function getExifOrientation(blob) {
  try {
    const buf = await blob.slice(0, 65536).arrayBuffer();
    const view = new DataView(buf);
    if (view.getUint16(0) !== 0xFFD8) return 1; // not JPEG
    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      const len    = view.getUint16(offset + 2);
      if (marker === 0xFFE1) { // APP1 — EXIF
        const exifHeader = view.getUint32(offset + 4);
        if (exifHeader !== 0x45786966) return 1; // "Exif"
        const tiffOffset = offset + 10;
        const littleEndian = view.getUint16(tiffOffset) === 0x4949;
        const getU16 = o => view.getUint16(tiffOffset + o, littleEndian);
        const getU32 = o => view.getUint32(tiffOffset + o, littleEndian);
        const ifdOffset = getU32(4);
        const entries   = getU16(ifdOffset);
        for (let i = 0; i < entries; i++) {
          const tag = getU16(ifdOffset + 2 + i * 12);
          if (tag === 0x0112) return getU16(ifdOffset + 2 + i * 12 + 8);
        }
        return 1;
      }
      offset += 2 + len;
    }
  } catch {}
  return 1;
}

/**
 * Draw an image onto a canvas with EXIF orientation applied.
 * Returns { width, height } of the drawn canvas.
 */
function drawImageWithOrientation(canvas, img, orientation) {
  const w = img.width || img.naturalWidth;
  const h = img.height || img.naturalHeight;
  const swap = orientation >= 5; // 5-8 are rotated 90/270
  canvas.width  = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext("2d");
  ctx.save();
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, h); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, h, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, h, w); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, w); break;
    default: break; // 1 = normal
  }
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// ── Date / time formatting ────────────────────────────────────────────────────
const today = () => new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Settings-aware date/time formatters
const formatDate = (dateStr, settings) => {
  if (!dateStr) return "";
  const fmt  = settings?.dateFormat || "MMM D, YYYY";
  const d    = new Date(dateStr + (dateStr.includes("T") ? "" : "T12:00:00"));
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  const mon  = d.toLocaleDateString("en-US", { month:"short" });
  if (fmt === "MM/DD/YYYY") return `${mm}/${dd}/${yyyy}`;
  if (fmt === "DD/MM/YYYY") return `${dd}/${mm}/${yyyy}`;
  if (fmt === "YYYY-MM-DD") return `${yyyy}-${mm}-${dd}`;
  return `${mon} ${d.getDate()}, ${yyyy}`;
};

const formatTime = (timeStr, settings) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  if (settings?.timeFormat === "24hr") return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
};

const todayFormatted = (settings) => formatDate(new Date().toISOString().slice(0,10), settings);

const formatDateTimeLabel = (iso, settings) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${formatDate(d.toISOString(), settings)} at ${d.toLocaleTimeString("en-US", {
    hour: settings?.timeFormat === "24hr" ? "2-digit" : "numeric",
    minute: "2-digit",
    hour12: settings?.timeFormat !== "24hr",
  })}`;
};

// ── Sketch scale helpers ──────────────────────────────────────────────────────
const SKETCH_SCALE_OPTIONS = [
  "1 sq = 6 in",
  "1 sq = 1 ft",
  "1 sq = 2 ft",
  "1 sq = 4 ft",
  "1 sq = 6 ft",
  "1 sq = 10 ft",
  "No Scale",
];

function normalizeSketchScale(value) {
  if (!value) return "1 sq = 1 ft";
  const compact = String(value).trim().toLowerCase().replace(/\s+/g, " ");
  const exact = SKETCH_SCALE_OPTIONS.find(opt => opt.toLowerCase() === compact);
  if (exact) return exact;
  if (compact === "no scale" || compact === "no-scale") return "No Scale";
  if (compact === "1 sq = 6in") return "1 sq = 6 in";
  return value;
}

function getTitleBlockHeight(width) {
  return Math.round(width * 0.62);
}

function buildSketchTitleBlockData(project, settings, scale, floorLabel) {
  const projectAddress = [project?.address, project?.city, project?.state, project?.zip].filter(Boolean).join(", ");
  const userName = `${settings?.userFirstName || ""} ${settings?.userLastName || ""}`.trim() || "Inspector";
  const draftDate = formatDate(new Date().toISOString().slice(0,10), settings);
  return {
    title: "PROJECT INFO",
    companyName: settings?.companyName || "Your Company",
    userName,
    projectName: project?.title || project?.name || "Untitled Project",
    projectNumber: project?.projectNumber || "—",
    projectType: project?.projectType || "—",
    projectAddress: projectAddress || "—",
    siteCompany: project?.companyName || project?.contractorName || "—",
    clientName: project?.clientName || "—",
    floorLabel: floorLabel || "—",
    scale: normalizeSketchScale(scale),
    draftDate,
  };
}

// ── Report block height estimator ─────────────────────────────────────────────
function estimateBlockHeight(block, gridClass) {
  if (block.type === "divider") return 46;
  if (block.type === "text") {
    const lines = Math.max(1, Math.ceil((block.content||"").length / 85));
    return 24 + lines * 21.25; // 12.5px font × 1.7 lineHeight ≈ 21.25px/line + padding
  }
  if (block.type === "photos") {
    const photos = (block.photos||[]).length;
    if (photos === 0) return 80; // empty placeholder
    const cols = gridClass==="rp-photo-grid-2"?2:gridClass==="rp-photo-grid-4"?4:3;
    const rows = Math.ceil(photos / cols);
    const colW = (PAGE_W - 72) / cols; // 72 = 36px padding each side
    const photoH = (colW * 3/4) + 28;  // aspect-ratio 4:3 + caption
    return 18 + rows * (photoH + 8) + (block.caption ? 20 : 0);
  }
  if (block.type === "files") {
    const count = Math.max(1, (block.files||[]).length);
    return 40 + count * 58 + (block.caption ? 20 : 0);
  }
  if (block.type === "textphoto") {
    const colW = (PAGE_W - 72 - 16) / 2;
    const photoH = colW * 3/4 + 28;
    const textLines = Math.max(1, Math.ceil((block.sideText||"").length / 42));
    return 18 + Math.max(photoH, textLines * 21.25);
  }
  if (block.type === "signature") return 130;
  if (block.type === "beforeafter") return 280;
  if (block.type === "sketch") return 400;
  if (block.type === "table") {
    const rows = (block.tableRows||[]).length;
    const titleH = block.tableTitle ? 22 : 0;
    const headingH = block.tableHeading ? 18 : 0;
    return 40 + titleH + headingH + rows * 28;
  }
  return 60;
}

// ── Signature builder ─────────────────────────────────────────────────────────
function buildSignature(s) {
  const name    = s.emailSignatureName    || `${s.userFirstName||""} ${s.userLastName||""}`.trim();
  const title   = s.emailSignatureTitle   || s.userTitle   || "";
  const company = s.emailSignatureCompany || s.companyName || "";
  const phone   = s.emailSignaturePhone   || s.phone       || "";
  const email   = s.emailSignatureEmail   || s.email       || "";
  const lines   = ["──────────────────────", name, title, company, phone&&`📞 ${phone}`, email&&`✉ ${email}`].filter(Boolean);

  const SOCIALS = [
    { key:"Facebook",  enabled: s.sigFacebookEnabled,  url: s.sigFacebookUrl,  label:"Facebook"  },
    { key:"Instagram", enabled: s.sigInstagramEnabled, url: s.sigInstagramUrl, label:"Instagram" },
    { key:"X",         enabled: s.sigXEnabled,         url: s.sigXUrl,         label:"X"         },
    { key:"LinkedIn",  enabled: s.sigLinkedInEnabled,  url: s.sigLinkedInUrl,  label:"LinkedIn"  },
    { key:"YouTube",   enabled: s.sigYoutubeEnabled,   url: s.sigYoutubeUrl,   label:"YouTube"   },
  ].filter(x => x.enabled && x.url);

  if (s.sigSocialsEnabled && SOCIALS.length) {
    lines.push("", SOCIALS.map(x => `[${x.label}](${x.url})`).join("  ·  "));
  }
  if (s.sigReviewEnabled && s.sigReviewUrl) {
    lines.push("", `⭐ ${s.sigReviewLabel||"Leave us a Review"}: ${s.sigReviewUrl}`);
  }
  return lines.join("\n");
}

// ── Embed code builder ────────────────────────────────────────────────────────
function buildEmbedCode(pair, bPhoto, aPhoto, maxWidth, companyLogo, krakenLogo) {
  if (!bPhoto || !bPhoto.dataUrl || !aPhoto || !aPhoto.dataUrl) return "";
  var id   = "ba_" + Math.random().toString(36).slice(2, 8);
  var name = (pair.name || "Before & After").replace(/</g, "&lt;");
  var mw   = parseInt(maxWidth) || 800;
  var bSrc = bPhoto.dataUrl;
  var aSrc = aPhoto.dataUrl;
  var logo = krakenLogo || '';
  var D = [
    "<!-- Before & After Slider: " + name + " — KrakenCam -->",
    ['<div id="',id,'" style="position:relative;width:100%;max-width:',mw,'px;',
     'aspect-ratio:4/3;overflow:hidden;cursor:ew-resize;',
     'user-select:none;-webkit-user-select:none;border-radius:8px;touch-action:none;">'].join(""),
    ['  <img src="',aSrc,'" alt="After" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;">'].join(""),
    ['  <div id="',id,'_clip" style="position:absolute;inset:0;clip-path:inset(0 50% 0 0);">'].join(""),
    ['    <img src="',bSrc,'" alt="Before" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;">'].join(""),
    "  " + ["<","/div>"].join(""),
    ['  <div id="',id,'_div" style="position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);',
     'width:3px;background:white;box-shadow:0 0 6px rgba(0,0,0,.4);pointer-events:none;">'].join(""),
    ['    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);',
     'width:34px;height:34px;background:white;border-radius:50%;',
     'box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;gap:3px;">'].join(""),
    '      <div style="width:3px;height:12px;background:#999;border-radius:2px;">' + ["<","/div>"].join(""),
    '      <div style="width:3px;height:12px;background:#999;border-radius:2px;">' + ["<","/div>"].join(""),
    "    " + ["<","/div>"].join(""),
    "  " + ["<","/div>"].join(""),
    '  <span style="position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,.6);color:white;font-size:11px;font-weight:700;padding:3px 9px;border-radius:4px;letter-spacing:.06em;pointer-events:none;font-family:sans-serif;">BEFORE' + ["<","/span>"].join(""),
    '  <span style="position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,.6);color:white;font-size:11px;font-weight:700;padding:3px 9px;border-radius:4px;letter-spacing:.06em;pointer-events:none;font-family:sans-serif;">AFTER' + ["<","/span>"].join(""),
    ['  <span style="position:absolute;top:8px;right:8px;display:inline-flex;align-items:center;gap:5px;padding:3px 8px 3px 5px;',
     'background:rgba(0,0,0,.55);border-radius:20px;pointer-events:none;font-family:sans-serif;">',
     '<img src="',logo,'" alt="KrakenCam" style="width:16px;height:16px;object-fit:contain;border-radius:50%;background:#0d1a2e;vertical-align:middle;">',
     '<span style="font-size:10px;font-weight:700;color:white;letter-spacing:.04em;">Made with KrakenCam' + ["<","/span>"].join("") + ["<","/span>"].join("")].join(""),
    companyLogo ? ['  <div style="position:absolute;top:8px;left:8px;pointer-events:none;">',
     '<img src="',companyLogo,'" alt="logo" style="height:64px;max-width:160px;object-fit:contain;border-radius:4px;',
     'background:rgba(0,0,0,.45);padding:3px;">',
     ["<","/div>"].join("")].join("") : "",
    ["<","/div>"].join(""),
    ["<scr","ipt>"].join(""),
    "(function(){",
    "  var el=document.getElementById('" + id + "');",
    "  var clip=document.getElementById('" + id + "_clip');",
    "  var div=document.getElementById('" + id + "_div');",
    "  var dragging=false;",
    "  function move(e){",
    "    if(!dragging)return;",
    "    e.preventDefault();",
    "    var rect=el.getBoundingClientRect();",
    "    var clientX=e.touches?e.touches[0].clientX:e.clientX;",
    "    var pct=Math.max(0,Math.min(100,((clientX-rect.left)/rect.width)*100));",
    "    clip.style.clipPath='inset(0 '+(100-pct)+'% 0 0)';",
    "    div.style.left=pct+'%';",
    "  }",
    "  el.addEventListener('mousedown',function(e){dragging=true;move(e);});",
    "  el.addEventListener('touchstart',function(e){dragging=true;move(e);},{passive:false});",
    "  window.addEventListener('mousemove',move);",
    "  window.addEventListener('touchmove',move,{passive:false});",
    "  window.addEventListener('mouseup',function(){dragging=false;});",
    "  window.addEventListener('touchend',function(){dragging=false;});",
    "})();",
    ["<","/scr","ipt>"].join(""),
  ];
  return D.join("\n");
}

export {
  uid, isValidUuid,
  getExifOrientation, drawImageWithOrientation,
  formatDate, formatTime, todayFormatted, today, formatDateTimeLabel,
  SKETCH_SCALE_OPTIONS, normalizeSketchScale, getTitleBlockHeight, buildSketchTitleBlockData,
  estimateBlockHeight,
  buildSignature,
  buildEmbedCode,
};
