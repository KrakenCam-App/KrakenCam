// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Core helpers ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
const uid = () => Math.random().toString(36).slice(2, 10);
const isValidUuid = id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Track DB ids of messages we sent so realtime doesn't echo them back
const _sentChatDbIds = new Set();
export { _sentChatDbIds };

// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ EXIF / image orientation ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ

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
      if (marker === 0xFFE1) { // APP1 ÃÂ¢ÃÂÃÂ EXIF
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

// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Date / time formatting ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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

// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Sketch scale helpers ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
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
    projectNumber: project?.projectNumber || "ÃÂ¢ÃÂÃÂ",
    projectType: project?.projectType || "ÃÂ¢ÃÂÃÂ",
    projectAddress: projectAddress || "ÃÂ¢ÃÂÃÂ",
    siteCompany: project?.companyName || project?.contractorName || "ÃÂ¢ÃÂÃÂ",
    clientName: project?.clientName || "ÃÂ¢ÃÂÃÂ",
    floorLabel: floorLabel || "ÃÂ¢ÃÂÃÂ",
    scale: normalizeSketchScale(scale),
    draftDate,
  };
}

// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Report block height estimator ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
function estimateBlockHeight(block, gridClass) {
  if (block.type === "divider") return 46;
  if (block.type === "text") {
    const lines = Math.max(1, Math.ceil((block.content||"").length / 85));
    return 24 + lines * 21.25; // 12.5px font ÃÂÃÂ 1.7 lineHeight ÃÂ¢ÃÂÃÂ 21.25px/line + padding
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

// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Signature builder ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
function buildSignature(s) {
  const name    = s.emailSignatureName    || `${s.userFirstName||""} ${s.userLastName||""}`.trim();
  const title   = s.emailSignatureTitle   || s.userTitle   || "";
  const company = s.emailSignatureCompany || s.companyName || "";
  const phone   = s.emailSignaturePhone   || s.phone       || "";
  const email   = s.emailSignatureEmail   || s.email       || "";
  const lines   = ["ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ", name, title, company, phone&&`ÃÂ°ÃÂÃÂÃÂ ${phone}`, email&&`ÃÂ¢ÃÂÃÂ ${email}`].filter(Boolean);

  const SOCIALS = [
    { key:"Facebook",  enabled: s.sigFacebookEnabled,  url: s.sigFacebookUrl,  label:"Facebook"  },
    { key:"Instagram", enabled: s.sigInstagramEnabled, url: s.sigInstagramUrl, label:"Instagram" },
    { key:"X",         enabled: s.sigXEnabled,         url: s.sigXUrl,         label:"X"         },
    { key:"LinkedIn",  enabled: s.sigLinkedInEnabled,  url: s.sigLinkedInUrl,  label:"LinkedIn"  },
    { key:"YouTube",   enabled: s.sigYoutubeEnabled,   url: s.sigYoutubeUrl,   label:"YouTube"   },
  ].filter(x => x.enabled && x.url);

  if (s.sigSocialsEnabled && SOCIALS.length) {
    lines.push("", SOCIALS.map(x => `[${x.label}](${x.url})`).join("  ÃÂÃÂ·  "));
  }
  if (s.sigReviewEnabled && s.sigReviewUrl) {
    lines.push("", `ÃÂ¢ÃÂ­ÃÂ ${s.sigReviewLabel||"Leave us a Review"}: ${s.sigReviewUrl}`);
  }
  return lines.join("\n");
}

// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Embed code builder ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
function buildEmbedCode(pair, bPhoto, aPhoto, maxWidth, companyLogo, krakenLogo) {
  if (!bPhoto || !bPhoto.dataUrl || !aPhoto || !aPhoto.dataUrl) return "";
  var id   = "ba_" + Math.random().toString(36).slice(2, 8);
  var name = (pair.name || "Before & After").replace(/</g, "&lt;");
  var mw   = parseInt(maxWidth) || 800;
  var bSrc = bPhoto.dataUrl;
  var aSrc = aPhoto.dataUrl;
  var logo = krakenLogo || '';
  var D = [
    "<!-- Before & After Slider: " + name + " ÃÂ¢ÃÂÃÂ KrakenCam -->",
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

const formatDurationLabel = (ms = 0) => {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};
const NOTIFICATION_PREF_ITEMS = [
  { key:"notifAssignments", label:"Assignments", desc:"Jobsite, task, and calendar assignments sent to you" },
  { key:"notifMentions", label:"Mentions", desc:"When someone tags you in a task or chat" },
  { key:"notifTasks", label:"Task activity", desc:"Task updates and work items that need your attention" },
  { key:"notifCalendar", label:"Calendar & dispatch", desc:"Schedule updates, dispatch changes, and event assignments" },
  { key:"notifChecklists", label:"Checklist activity", desc:"Checklist completions and inspection workflow updates" },
  { key:"notifFiles", label:"Files & documents", desc:"Project files uploaded, shared, or ready to review" },
  { key:"notifReports", label:"Reports", desc:"Report exports, approvals, and send-ready updates" },
  { key:"notifPhotos", label:"Photos & media", desc:"Photo, video, and field media activity" },
  { key:"notifCerts", label:"Certification alerts", desc:"Expired or expiring certifications for your team" },
  { key:"notifTeam", label:"Team & permissions", desc:"User invites, removals, role changes, and permission updates" },
  { key:"notifAdminAlerts", label:"Admin & manager alerts", desc:"Operational alerts that should surface to managers and admins" },
  { key:"notifUpdates", label:"App updates & news", desc:"Product updates and new feature announcements" },
];
const NOTIFICATION_PREF_DEFAULTS = {
  notifAssignments: true,
  notifMentions: true,
  notifTasks: true,
  notifCalendar: true,
  notifChecklists: true,
  notifFiles: true,
  notifReports: true,
  notifPhotos: true,
  notifCerts: true,
  notifTeam: true,
  notifAdminAlerts: true,
  notifUpdates: false,
};
const getNotificationSettingKey = (type = "") => ({
  assignment: "notifAssignments",
  mention: "notifMentions",
  task: "notifTasks",
  "task-comment": "notifTasks",
  calendar: "notifCalendar",
  checklist: "notifChecklists",
  file: "notifFiles",
  report: "notifReports",
  photo: "notifPhotos",
  video: "notifPhotos",
  "voice-note": "notifPhotos",
  "cert-alert": "notifCerts",
  team: "notifTeam",
  admin: "notifAdminAlerts",
  system: "notifUpdates",
}[type] || "notifUpdates");
const getNotificationAudienceMeta = (settings = {}, teamUsers = []) => {
  const role = settings?.userRole || "admin";
  const directId = settings?.currentUserId || (role === "admin" ? "__admin__" : null);
  const matchedUser = directId && directId !== "__admin__"
    ? teamUsers.find(u => u.id === directId)
    : teamUsers.find(u =>
        u.email &&
        settings?.userEmail &&
        String(u.email).toLowerCase() === String(settings.userEmail).toLowerCase()
      );
  const userId = directId || matchedUser?.id || "__admin__";
  return { role, userId, email: settings?.userEmail || matchedUser?.email || "" };
};
const shouldShowNotificationForCurrentUser = (notification, settings = {}, teamUsers = []) => {
  const { role, userId, email } = getNotificationAudienceMeta(settings, teamUsers);
  const roleTargets = notification?.recipientRoles || notification?.audienceRoles || [];
  const userTargets = notification?.recipientUserIds || [];
  const emailTargets = notification?.recipientEmails || [];
  if (roleTargets.length && !roleTargets.includes(role)) return false;
  if (userTargets.length && !userTargets.includes(userId)) return false;
  if (emailTargets.length && (!email || !emailTargets.map(v => String(v).toLowerCase()).includes(String(email).toLowerCase()))) return false;
  return true;
};
const isNotificationEnabledForCurrentUser = (notification, settings = {}, teamUsers = []) => {
  if (!shouldShowNotificationForCurrentUser(notification, settings, teamUsers)) return true;
  const key = getNotificationSettingKey(notification?.type);
  return settings?.[key] !== false;
};
const normalizeNotification = (notification = {}) => ({
  id: notification.id || uid(),
  type: notification.type || "system",
  date: notification.date || today(),
  timestamp: notification.timestamp || new Date().toISOString(),
  read: !!notification.read,
  ...notification,
});const ensureClientPortal = (project = {}, settings = {}) => ({
  ...DEFAULT_CLIENT_PORTAL,
  ...(project?.clientPortal || {}),
  slug: project?.clientPortal?.slug || project?.portalSlug || `${project?.id || "project"}-${String(project?.title || "portal").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) || uid()}`,
  reviewLabel: project?.clientPortal?.reviewLabel || settings?.sigReviewLabel || DEFAULT_CLIENT_PORTAL.reviewLabel,
  reviewUrl: project?.clientPortal?.reviewUrl || settings?.sigReviewUrl || "",
  reviewEnabled: project?.clientPortal?.reviewEnabled ?? false,
  passwordEnabled: project?.clientPortal?.passwordEnabled ?? false,
  password: project?.clientPortal?.password || "",
  clientNotes: project?.clientPortal?.clientNotes || [],
  teamMessages: project?.clientPortal?.teamMessages || [],
});
const isPortalApprovedItem = (item = {}) => item?.clientPortalVisible === true;
const filterPortalApprovedItems = (items = []) => (items || []).filter(isPortalApprovedItem);
const withPortalFilteredProject = (project = {}) => ({
  ...project,
  photos: filterPortalApprovedItems(project.photos),
  videos: filterPortalApprovedItems(project.videos),
  sketches: filterPortalApprovedItems(project.sketches),
  reports: filterPortalApprovedItems(project.reports),
  files: filterPortalApprovedItems(project.files),
});
const getPortalItemDateValue = (item = {}) => {
  const raw = item.updatedAt || item.createdAt || item.addedAt || item.timestamp || item.dateInspection || item.date || "";
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
};
const formatPortalRelativeLabel = (raw) => {
  if (!raw) return "Recently updated";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw);
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
};
const buildPortalActivity = (project = {}) => {
  const items = [];
  (project.reports || []).forEach(r => items.push({ id:`report-${r.id}`, type:"report", title:r.title || r.type || "Report updated", when:r.createdAt || r.updatedAt || r.date, detail:r.recipient ? `Prepared for ${r.recipient}` : "Report added to the portal" }));
  (project.photos || []).forEach(p => items.push({ id:`photo-${p.id}`, type:"photo", title:p.name || "Photo added", when:p.createdAt || p.date, detail:p.room ? `Photo uploaded for ${p.room}` : "New project photo uploaded" }));
  (project.videos || []).forEach(v => items.push({ id:`video-${v.id}`, type:"video", title:v.name || "Video added", when:v.createdAt || v.date, detail:v.room ? `Video uploaded for ${v.room}` : "New project video uploaded" }));
  (project.files || []).forEach(f => items.push({ id:`file-${f.id}`, type:"file", title:f.name || "File added", when:f.addedAt || f.createdAt || f.date, detail:f.category ? `${f.category} file shared` : "File shared in portal" }));
  (project.clientPortal?.clientNotes || []).forEach(n => items.push({ id:`client-note-${n.id}`, type:"note", title:"Client note received", when:n.createdAt, detail:n.author || "Portal visitor" }));
  (project.clientPortal?.teamMessages || []).forEach(n => items.push({ id:`portal-team-${n.id}`, type:"portal-message", title:"New message from our team", when:n.createdAt, detail:n.author || "Project team" }));
  return items.sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0)).slice(0, 8);
};
const formatFileSizeLabel = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const getFileExtension = (name = "") => {
  const parts = String(name).split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
};
const isPreviewableFile = (file = {}) => {
  const type = file.type || "";
  const ext = getFileExtension(file.name);
  return type.startsWith("image/") || type === "application/pdf" || type.startsWith("text/") || ["txt","csv","json","md"].includes(ext);
};
const inferProjectFileKind = (file = {}) => {
  const type = file.type || "";
  const ext = getFileExtension(file.name);
  if (type.startsWith("image/")) return "Image";
  if (type.startsWith("audio/")) return "Audio";
  if (type.startsWith("video/")) return "Video";
  if (type === "application/pdf") return "PDF";
  if ([
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ].includes(type) || ["doc","docx","ppt","pptx"].includes(ext)) return "Document";
  if ([
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
  ].includes(type) || ["xls","xlsx","csv"].includes(ext)) return "Spreadsheet";
  if (type.startsWith("text/") || ["txt","json","md"].includes(ext)) return "Text";
  return "Other";
};
const normaliseProjectFile = (file = {}) => ({
  ...file,
  category: (file.category || "General").trim() || "General",
  tags: Array.isArray(file.tags) ? file.tags.filter(Boolean) : [],
  kind: file.kind || inferProjectFileKind(file),
});
const parseTagInput = (value = "") => Array.from(new Set(
  value.split(",").map(t => t.trim()).filter(Boolean)
));
const decodeDataUrlText = (dataUrl = "") => {
  try {
    const [, payload = ""] = String(dataUrl).split(",");
    return decodeURIComponent(escape(atob(payload)));
  } catch {
    return "Preview is unavailable for this file.";
  }
};
const ROOM_ICONS = {
  "Living Room": ["M3 12h18","M6 12V9a2 2 0 012-2h8a2 2 0 012 2v3","M5 12v5","M19 12v5","M8 17v-3","M16 17v-3"],
  "Kitchen": ["M4 4h16v16H4z","M9 4v16","M4 11h16","M14 8h3","M14 14h3"],
  "Master Bedroom": ["M3 10h18","M5 10V7h6a2 2 0 012 2v1","M13 10V8h4a2 2 0 012 2v0","M5 10v7","M19 10v7"],
  "Bathroom": ["M7 3h10","M8 7h8","M8 7v5a4 4 0 008 0V7","M9 21h6"],
  "Garage": ["M3 11l9-7 9 7","M5 10v10h14V10","M8 14h8","M8 17h8"],
  "Basement": ["M4 6h16v12H4z","M4 10h16","M8 14h2","M14 14h2","M12 18v3"],
  "Exterior": ["M12 3v18","M5 10l7-7 7 7","M5 21h14"],
  "Attic": ["M3 11l9-7 9 7","M7 10v9h10v-9","M10 19v-4h4v4"],
  "Office": ["M4 7h16v12H4z","M8 7V5h8v2","M12 13h.01","M9 17h6"],
  "Dining Room": ["M12 4v8","M8 4v8","M16 4v8","M6 12h12","M8 12v8","M16 12v8"],
  "Utility Room": ["M12 8v8","M8 12h8","M5 5h14v14H5z"],
  "Hallway": ["M5 3h14v18H5z","M12 3v18","M9 12h.01"],
  "Bedroom": ["M3 11h18","M5 11V8h5a2 2 0 012 2v1","M12 11h7v8","M5 11v8"],
  "Crawlspace": ["M4 17c2-4 4-6 8-6s6 2 8 6","M7 9h10","M12 6h.01"],
  "Mechanical Room": ["M12 8v8","M8 12h8","M5 12a7 7 0 0114 0","M12 5V3","M12 21v-2"],
  "Entrance": ["M5 3h14v18H5z","M10 21v-6h4v6","M8 10h.01"],
  "Roof": ["M3 12l9-7 9 7","M6 11h12","M8 15h8"],
  "Closet": ["M6 4h12v16H6z","M10 4v16","M14 9h.01","M14 15h.01"],
  "Shop": ["M14 4l6 6-8 8H6V12z","M13 5l6 6","M4 20h16"],
  "Warehouse": ["M3 8l9-5 9 5v11H3z","M7 11h2v3H7z","M11 11h2v3h-2z","M15 11h2v3h-2z"],
  "Other": ["M4 4h16v16H4z","M9 9h6v6H9z"],
};
const ROOM_COLORS = ["#4a90d9","#3dba7e","#8b7cf8","#e8c53a","#e8703a","#e85a3a","#3ab8e8","#f0954e"];const getRoomIcon = (roomName = "Other") => ROOM_ICONS[roomName] || ROOM_ICONS.Other;

const STATUS_META = {
  active:    { label:"Active",    cls:"green"  },
  onhold:    { label:"On Hold",   cls:"orange" },
  completed: { label:"Completed", cls:"blue"   },
  archived:  { label:"Archived",  cls:"purple" },
};
// Normalise projectStatuses: handle both old string[] and new {id,label,cls}[] format
const normaliseStatuses = (arr) => {
  if (!arr?.length) return null;
  if (typeof arr[0] === "string") {
    // Old format ÃÂ¢ÃÂÃÂ convert strings to objects using STATUS_META for labels/colours
    return arr.map(id => ({ id, label: STATUS_META[id]?.label || id, cls: STATUS_META[id]?.cls || "blue" }));
  }
  return arr;
};
const getStatusMeta = (statusId, settings) => {
  const statuses = normaliseStatuses(settings?.projectStatuses);
  const custom = (statuses||[]).find(s => s.id === statusId);
  if (custom) return { label: custom.label, cls: custom.cls || "blue" };
  return STATUS_META[statusId] || { label: statusId || "Active", cls: "green" };
};
const STATUS_CLS_OPTIONS = ["green","blue","orange","purple","red","gray"];


// getCertStatus Ã¢ÂÂ cert expiry checker, shared across AccountPage/PhotosTab/TasksPage
const getCertStatus = (dateExpires) => {
  if (!dateExpires) return "no-expiry";
  const now   = new Date(); now.setHours(0,0,0,0);
  const exp   = new Date(dateExpires + "T00:00:00");
  const days  = Math.ceil((exp - now) / 86400000);
  if (days < 0)  return "expired";
  if (days <= 30) return "expiring-soon";
  if (days <= 90) return "expiring-warning";
  return "valid";
};

// ROLE_META â shared role display metadata (admin/manager/user)
const ROLE_META = {
  admin:   { label:"Admin",   color:"#e86c3a", desc:"Full system control"                            },
  manager: { label:"Manager", color:"#8b7cf8", desc:"Create projects, view reports, manage users"    },
  user:    { label:"User",    color:"#3dba7e", desc:"Upload photos, fill reports, complete checklists"},
};
export {
  uid, isValidUuid,
  getExifOrientation, drawImageWithOrientation,
  formatDate, formatTime, todayFormatted, today, formatDateTimeLabel,
  SKETCH_SCALE_OPTIONS, normalizeSketchScale, getTitleBlockHeight, buildSketchTitleBlockData,
  estimateBlockHeight,
  buildSignature,
  buildEmbedCode,
  // App utility helpers (moved from jobsite-reporter.jsx)
  formatDurationLabel,
  NOTIFICATION_PREF_ITEMS, NOTIFICATION_PREF_DEFAULTS,
  getNotificationSettingKey, getNotificationAudienceMeta,
  shouldShowNotificationForCurrentUser, isNotificationEnabledForCurrentUser,
  normalizeNotification,
  isPortalApprovedItem, filterPortalApprovedItems, withPortalFilteredProject,
  getPortalItemDateValue, formatPortalRelativeLabel, buildPortalActivity,
  formatFileSizeLabel, getFileExtension, isPreviewableFile, inferProjectFileKind,
  normaliseProjectFile, parseTagInput, decodeDataUrlText,
  ROOM_ICONS, ROOM_COLORS, getRoomIcon, STATUS_META, normaliseStatuses, getStatusMeta,
  STATUS_CLS_OPTIONS,
  getCertStatus,
  ROLE_META,
};
