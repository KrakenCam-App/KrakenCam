import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Icon, ic } from "../utils/icons.jsx";
import { PLAN_AI_LIMITS, canAccessFeature, getWeekWindowStart, getNextResetDate } from "../utils/constants.js";
import {
  uid, formatDate, formatTime, formatDateTimeLabel,
  estimateBlockHeight, today,
  formatFileSizeLabel, inferProjectFileKind
} from "../utils/helpers.js";

// ── Report Pages (paginated preview) ──────────────────────────────────────────
// Estimates block heights and splits them into 8.5Ã11 pages (816Ã1056px at 96dpi).
// Header/footer on each page consume fixed space; remaining body space is filled
// block by block. A block that is too tall to fit starts a new page.

const PAGE_W   = 816;
const PAGE_H   = 1056;
const HEADER_H = 52;   // continuation header
const FOOTER_H = 38;   // footer + optional disclaimer
const COVER_H  = 1056; // page 1 is always exactly one page


export function PageFooter({ accentColor, settings, reportDate, reportTime, pageNum, isLast }) {
  const dateStr = reportDate ? formatDate(reportDate, settings) : formatDate(new Date().toISOString().slice(0,10), settings);
  const timeStr = reportTime ? formatTime(reportTime, settings) : null;
  return (
    <>
      <div style={{ padding:"10px 36px",borderTop:`2px solid ${accentColor}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fafafa",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ fontSize:10,color:"#888" }}>{dateStr}</span>
          {timeStr && <span style={{ fontSize:10,color:"#aaa" }}>Â· {timeStr}</span>}
        </div>
        <span style={{ fontSize:10,color:accentColor,fontWeight:600 }}>{settings?.reportFooterCenter||"Confidential"}</span>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:9,color:"#bbb",letterSpacing:".06em" }}>POWERED BY KRAKENCAM</div>
          <div style={{ fontSize:9.5,color:"#aaa" }}>Page {pageNum}</div>
        </div>
      </div>
      {isLast && settings?.reportFooterDisclaimer && (
        <div style={{ padding:"8px 36px",fontSize:9.5,color:"#bbb",lineHeight:1.6,background:"#fafafa",borderTop:"1px solid #eee",flexShrink:0 }}>{settings.reportFooterDisclaimer}</div>
      )}
    </>
  );
}

export function BlockRenderer({ block, showGps, showTimestamp, showRooms, showTags, gridClass, settings }) {
  if (block.type === "divider") return (
    <div style={{ padding:"14px 36px 8px" }}>
      <div style={{
        fontSize:(block.textStyle?.fontSize||13)+"px",
        fontWeight:(block.textStyle?.bold??true)?"700":"normal",
        fontStyle:block.textStyle?.italic?"italic":"normal",
        textDecoration:block.textStyle?.underline?"underline":"none",
        background:block.textStyle?.highlight?"#ffe066":"transparent",
        textTransform:"uppercase",letterSpacing:".06em",
        color:block.textStyle?.color||"#444",
        display:"flex",alignItems:"center",gap:8
      }}>
        {block.label||"Section"}<div style={{ flex:1,height:1,background:"#e8e8e8" }} />
      </div>
    </div>
  );
  if (block.type === "signature") return (
    <div style={{ padding:"10px 36px 18px" }}>
      <div style={{ display:"flex", flexDirection:"column", gap:8, maxWidth:340 }}>
        {block.label && <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"#888",marginBottom:2 }}>{block.label}</div>}
        {block.signatureImg ? (
          <div style={{ borderBottom:"1.5px solid #333", paddingBottom:4, minHeight:60, display:"flex", alignItems:"flex-end" }}>
            <img src={block.signatureImg} alt="Signature" style={{ maxHeight:56, maxWidth:280, objectFit:"contain" }} />
          </div>
        ) : (
          <div style={{ borderBottom:"1.5px solid #ccc", height:64 }} />
        )}
        {block.signerName && <div style={{ fontSize:10.5, color:"#555" }}>{block.signerName}</div>}
        {block.signerTitle && <div style={{ fontSize:10, color:"#888" }}>{block.signerTitle}</div>}
        <div style={{ fontSize:10, color:"#aaa" }}>Date: {block.sigDate || "_________________"}</div>
        {(block.signerCertCodes||[]).length > 0 && (
          <div style={{ display:"flex",flexWrap:"wrap",gap:4,marginTop:3 }}>
            {block.signerCertCodes.map(code => (
              <span key={code} style={{ fontSize:9,fontWeight:800,padding:"1px 6px",borderRadius:4,background:"#f0f0f0",color:"#666",border:"1px solid #ddd",fontFamily:"monospace",letterSpacing:".04em" }}>
                {code}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
  if (block.type === "text") return (
    <div style={{ padding:"6px 36px 12px" }}>
      <div style={{
        fontSize:(block.textStyle?.fontSize||12.5)+"px",
        lineHeight:1.7,
        color:block.textStyle?.color||"#333",
        whiteSpace:"pre-wrap",
        fontWeight:block.textStyle?.bold?"bold":"normal",
        fontStyle:block.textStyle?.italic?"italic":"normal",
        textDecoration:block.textStyle?.underline?"underline":"none",
        background:block.textStyle?.highlight?"#ffe066":"transparent",
        padding:block.textStyle?.highlight?"2px 4px":"0",
        borderRadius:block.textStyle?.highlight?3:0,
      }} dangerouslySetInnerHTML={{ __html: block.content||"" }} />
    </div>
  );
  if (block.type === "photos") {
    if (!(block.photos||[]).length) return (
      <div style={{ padding:"6px 36px 12px" }}>
        <div style={{ border:"2px dashed #ddd",borderRadius:8,padding:"28px 20px",textAlign:"center",color:"#ccc",fontSize:12 }}>No photos added</div>
      </div>
    );
    return (
      <div style={{ padding:"6px 36px 12px" }}>
        <div className={gridClass} style={{ marginBottom:6 }}>
          {(block.photos||[]).map((ph,pi)=>(
            <div key={pi} style={{ borderRadius:4,overflow:"hidden",border:"1px solid #e8e8e8" }}>
              <div style={{ position:"relative" }}>
                {ph.dataUrl ? <img src={ph.dataUrl} alt={ph.name} style={{ width:"100%",display:"block",aspectRatio:"4/3",objectFit:"cover" }} /> : <div style={{ aspectRatio:"4/3",background:"#eee" }} />}
                {showTimestamp && ph.date && (
                  <div style={{ position:"absolute",bottom:4,left:4,background:"rgba(0,0,0,.55)",color:"white",fontSize:7,padding:"2px 5px",borderRadius:3,fontFamily:"monospace",letterSpacing:".02em",pointerEvents:"none" }}>ð {ph.date}</div>
                )}
              </div>
              <div style={{ padding:"4px 6px",fontSize:9.5,color:"#555",background:"#fafafa",borderTop:"1px solid #eee" }}>
                <div style={{ fontWeight:600,marginBottom:2 }}>{ph.name||"Photo"}</div>
                {showTags && (ph.tags||[]).length > 0 && (
                  <div style={{ display:"flex",flexWrap:"wrap",gap:4,marginBottom:2 }}>
                    {(ph.tags||[]).map(t=>(
                      <span key={t} style={{ fontSize:7.5,padding:"1px 5px",borderRadius:8,background:"#e8f0fe",color:"#3a6fd8",fontWeight:600,letterSpacing:".02em" }}>{t}</span>
                    ))}
                  </div>
                )}
                <div style={{ display:"flex",flexWrap:"wrap",gap:6,fontSize:8.5,color:"#aaa",marginTop:1 }}>
                  {showRooms && ph.room && <span>ð {ph.room}{ph.floor ? ` Â· ${ph.floor}` : ""}</span>}
                  {showGps && ph.gps && <span>ð {ph.gps.lat}, {ph.gps.lng}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
        {block.caption && <div style={{ fontSize:11,color:"#888",fontStyle:"italic" }}>{block.caption}</div>}
      </div>
    );
  }
  if (block.type === "files") return (
    <div style={{ padding:"10px 36px 14px" }}>
      {block.label && <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"#888",marginBottom:8 }}>{block.label}</div>}
      {(block.files||[]).length > 0 ? (
        <div style={{ display:"grid",gap:8 }}>
          {(block.files||[]).map(file => (
            <div key={file.id || file.name} style={{ border:"1px solid #e8e8e8",borderRadius:8,padding:"10px 12px",background:"#fafafa" }}>
              <div style={{ display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start" }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:11.5,fontWeight:700,color:"#333",wordBreak:"break-word" }}>{file.name || "Attached File"}</div>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginTop:5 }}>
                    <span style={{ fontSize:9,padding:"2px 6px",borderRadius:999,background:"#e8f0fe",color:"#3a6fd8",fontWeight:700 }}>{file.category || "General"}</span>
                    <span style={{ fontSize:9,padding:"2px 6px",borderRadius:999,background:"#f1f1f1",color:"#666",fontWeight:700 }}>{file.kind || inferProjectFileKind(file)}</span>
                    {(file.tags || []).map(tag => <span key={tag} style={{ fontSize:9,padding:"2px 6px",borderRadius:999,background:"#f5ecff",color:"#7a4cc2",fontWeight:700 }}>{tag}</span>)}
                  </div>
                </div>
                <div style={{ fontSize:10,color:"#888",whiteSpace:"nowrap" }}>{formatFileSizeLabel(file.size || 0)}</div>
              </div>
              <div style={{ fontSize:9.5,color:"#999",marginTop:6 }}>
                {(file.uploadedByName || "Unknown")}{file.uploadedAt ? ` â¢ ${formatDateTimeLabel(file.uploadedAt, settings)}` : ""}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ border:"2px dashed #ddd",borderRadius:8,padding:"24px 20px",textAlign:"center",color:"#ccc",fontSize:12 }}>No files attached</div>
      )}
      {block.caption && <div style={{ fontSize:11,color:"#888",fontStyle:"italic",marginTop:6 }}>{block.caption}</div>}
    </div>
  );
  if (block.type === "textphoto") return (
    <div style={{ padding:"6px 36px 12px" }}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start" }}>
        <div style={{ fontSize:(block.textStyle?.fontSize||12.5)+"px",lineHeight:1.7,color:block.textStyle?.color||"#333",whiteSpace:"pre-wrap",
          fontWeight:block.textStyle?.bold?"bold":"normal",fontStyle:block.textStyle?.italic?"italic":"normal",
          textDecoration:block.textStyle?.underline?"underline":"none",
          background:block.textStyle?.highlight?"#ffe066":"transparent",
          padding:block.textStyle?.highlight?"2px 4px":"0",borderRadius:block.textStyle?.highlight?3:0 }}
          dangerouslySetInnerHTML={{ __html: block.sideText||"" }} />
        <div>
          {(block.photos||[]).length>0
            ? <div style={{ borderRadius:4,overflow:"hidden",border:"1px solid #e8e8e8" }}>
                <div style={{ position:"relative" }}>
                  <img src={block.photos[0].dataUrl} alt="" style={{ width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block" }} />
                  {showTimestamp && block.photos[0].date && (
                    <div style={{ position:"absolute",bottom:4,left:4,background:"rgba(0,0,0,.55)",color:"white",fontSize:7,padding:"2px 5px",borderRadius:3,fontFamily:"monospace",letterSpacing:".02em",pointerEvents:"none" }}>ð {block.photos[0].date}</div>
                  )}
                </div>
                <div style={{ padding:"4px 6px",fontSize:9.5,color:"#555",background:"#fafafa" }}>
                  <div style={{ fontWeight:600,marginBottom:2 }}>{block.photos[0].name}</div>
                  {showTags && (block.photos[0].tags||[]).length > 0 && (
                    <div style={{ display:"flex",flexWrap:"wrap",gap:4,marginBottom:2 }}>
                      {(block.photos[0].tags||[]).map(t=>(
                        <span key={t} style={{ fontSize:7.5,padding:"1px 5px",borderRadius:8,background:"#e8f0fe",color:"#3a6fd8",fontWeight:600 }}>{t}</span>
                      ))}
                    </div>
                  )}
                  {showRooms && block.photos[0].room && (
                    <span style={{ color:"#aaa",fontSize:8.5 }}>ð {block.photos[0].room}{block.photos[0].floor ? ` Â· ${block.photos[0].floor}` : ""}</span>
                  )}
                </div>
              </div>
            : <div style={{ aspectRatio:"4/3",background:"#f0f0f0",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",color:"#ccc",fontSize:12 }}>No photo</div>
          }
        </div>
      </div>
    </div>
  );
  if (block.type === "beforeafter") {
    if (!block._bPhoto || !block._aPhoto) return (
      <div style={{ padding:"6px 46px 12px" }}>
        <div style={{ border:"2px dashed #ddd",borderRadius:8,padding:"20px",textAlign:"center",color:"#ccc",fontSize:12 }}>Before & After pair not available</div>
      </div>
    );
    return (
      <div style={{ padding:"6px 46px 12px" }}>
        {block.label && <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"#888",marginBottom:8 }}>{block.label}</div>}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
          {[{label:"Before",photo:block._bPhoto},{label:"After",photo:block._aPhoto}].map(({label,photo})=>(
            <div key={label} style={{ borderRadius:6,overflow:"hidden",border:"1px solid #e8e8e8" }}>
              <div style={{ position:"relative" }}>
                {photo?.dataUrl ? <img src={photo.dataUrl} alt={label} style={{ width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block" }} /> : <div style={{ aspectRatio:"4/3",background:"#eee",display:"flex",alignItems:"center",justifyContent:"center",color:"#ccc",fontSize:12 }}>No photo</div>}
                <div style={{ position:"absolute",bottom:0,left:0,right:0,padding:"4px 8px",background:"rgba(0,0,0,.55)",fontSize:10,fontWeight:700,color:"white",letterSpacing:".04em",textTransform:"uppercase" }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
        {block.caption && <div style={{ fontSize:11,color:"#888",fontStyle:"italic",marginTop:6 }}>{block.caption}</div>}
      </div>
    );
  }
  if (block.type === "sketch") return (
    <div style={{ padding:"6px 36px 14px" }}>
      {block.dataUrl
        ? <div>
            <img src={block.dataUrl} alt={block.sketchTitle||"Sketch"} style={{ width:"100%",borderRadius:4,border:"1px solid #e8e8e8",display:"block" }} />
            {block.caption && <div style={{ fontSize:10.5,color:"#888",textAlign:"center",marginTop:5,fontStyle:"italic" }}>{block.caption}</div>}
          </div>
        : <div style={{ background:"#f8f8f8",border:"1.5px dashed #ccc",borderRadius:6,padding:"20px",textAlign:"center",color:"#bbb",fontSize:11 }}>Sketch not available</div>
      }
    </div>
  );
  if (block.type === "table") {
    const rows = block.tableRows || [];
    const hasHeader = block.tableHasHeader !== false;
    const colWidths = block.tableColWidths || rows[0]?.map(() => 120) || [];
    const colAligns = block.tableColAligns || rows[0]?.map(() => "left") || [];
    const headerBg  = block.tableHeaderBg || "#e86c3a";
    const headerCol = block.tableHeaderColor || "#fff";
    const striped   = block.tableStriped !== false;
    const borders   = block.tableBorders || "all";
    return (
      <div className="rp-table-wrap">
        {block.tableTitle && <div className="rp-table-title">{block.tableTitle}</div>}
        {block.tableHeading && <div className="rp-table-heading">{block.tableHeading}</div>}
        <table className={`rp-table borders-${borders}`}>
          <colgroup>{colWidths.map((w,i)=><col key={i} style={{ width:w }} />)}</colgroup>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={striped && ri % 2 === 1 && !(hasHeader && ri===0) ? "striped" : ""}>
                {row.map((cell, ci) => hasHeader && ri === 0
                  ? <th key={ci} style={{ background:headerBg,color:headerCol,textAlign:colAligns[ci]||"left" }}>{cell}</th>
                  : <td key={ci} style={{ textAlign:colAligns[ci]||"left" }}>{cell}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

// ── Scaled preview wrapper — measures its container and zooms pages to fit ──
export function ScaledReportPreview(props) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const available = el.parentElement?.clientWidth || window.innerWidth;
      const PAGE_WIDTH = 816;
      const padding = 32; // 16px each side
      const s = Math.min(1, (available - padding) / PAGE_WIDTH);
      setScale(parseFloat(s.toFixed(3)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el.parentElement || document.body);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      <div style={{
        width: 816,
        transformOrigin: "top center",
        transform: `scale(${scale})`,
        // When scaled down, transform doesn't affect layout height, so we pull up
        // by the amount of space the shrinkage frees (negative margin collapses it)
        marginBottom: scale < 1 ? `${(scale - 1) * 816 * 1.3}px` : 0,
      }}>
        <ReportPages {...props} />
      </div>
      <div style={{ height: 48 }} />
    </div>
  );
}

export function ReportPages({ title, reportType, reportDate, reportTime, accentColor, project, coverPhoto, blocks, settings, showCoverInfo, showGps, showTimestamp, showRooms, showTags, gridClass, forPrint = false }) {
  const today = reportDate ? formatDate(reportDate, settings) : formatDate(new Date().toISOString().slice(0,10), settings);

  // ── Page 1: cover + property info (always fills exactly one page) ──
  const page1 = (
    <div key="p1" style={{ width:PAGE_W,height:PAGE_H,background:"white",boxShadow:forPrint?"none":"0 4px 40px rgba(0,0,0,.6)",marginBottom:forPrint?0:2,fontFamily:"'Inter',system-ui,sans-serif",color:"#1a1a1a",display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"28px 36px 20px",borderBottom:`3px solid ${accentColor}`,flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:16 }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            {settings?.logo
              ? <img src={settings.logo} alt="logo" style={{ height:44,width:44,objectFit:"contain",borderRadius:6,background:"#f5f5f5",padding:3 }} />
              : <div style={{ width:44,height:44,borderRadius:8,background:accentColor,display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:700,fontSize:16 }}>{(settings?.companyName||"SS")[0]}</div>
            }
            <div>
              <div style={{ fontWeight:700,fontSize:15,color:"#111" }}>{settings?.companyName||"Your Company"}</div>
              <div style={{ fontSize:10.5,color:"#777" }}>{settings?.phone}{settings?.email?` Â· ${settings.email}`:""}</div>
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontWeight:700,fontSize:14,color:"#111" }}>{settings?.reportHeaderTitle||"Property Report"}</div>
            <div style={{ fontSize:10.5,color:"#777" }}>{reportType} Â· {today}</div>
          </div>
        </div>
      </div>
      {/* Cover photo */}
      <div style={{ height:300,background:"#1a1e28",overflow:"hidden",position:"relative",flexShrink:0 }}>
        {coverPhoto
          ? <img src={coverPhoto} alt="cover" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
          : <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:8,color:"#555" }}>
              <Icon d={ic.image} size={48} stroke="#444" />
              <div style={{ fontSize:13,color:"#555" }}>No cover photo</div>
            </div>
        }
        {showCoverInfo && (
          <div style={{ position:"absolute",bottom:0,left:0,right:0,padding:"20px 36px",background:"linear-gradient(to top,rgba(0,0,0,.85),transparent)",zIndex:2 }}>
            <div style={{ fontSize:20,fontWeight:700,color:"white",marginBottom:4,lineHeight:1.2 }}>{title}</div>
            <div style={{ fontSize:11.5,color:"rgba(255,255,255,.75)",display:"flex",gap:12,flexWrap:"wrap" }}>
              {project.address && <span>ð {[project.address,project.city,project.state].filter(Boolean).join(", ")}</span>}
              {project.clientName && <span>ð¤ {project.clientName}</span>}
            </div>
          </div>
        )}
      </div>
      {/* Property info — all fields */}
      {(() => {
        const InfoRow = ({ label, value }) => value ? (
          <div>
            <div style={{ fontSize:8.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"#999",marginBottom:1 }}>{label}</div>
            <div style={{ fontSize:11,color:"#222",fontWeight:500,lineHeight:1.3 }}>{value}</div>
          </div>
        ) : null;

        const SectionHead = ({ label }) => (
          <div style={{ gridColumn:"1/-1",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"#444",marginTop:8,marginBottom:2,display:"flex",alignItems:"center",gap:8 }}>
            {label}<div style={{ flex:1,height:1,background:"#e8e8e8" }} />
          </div>
        );

        const hasInsurance = project.insuranceEnabled && (project.insuranceCarrier||project.insurancePolicyNum||project.claimNumber||project.adjusterName);
        const hasSiteConditions = project.accessLimitations||project.powerStatus||project.waterStatus||(project.ppeItems?.length > 0);
        const hasDates = project.dateInspection||project.dateWorkPerformed||project.dateOfLoss;

        return (
          <div style={{ padding:"14px 36px",flex:1,overflowY:"auto",fontSize:11 }}>
            {/* Property & Client */}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"7px 20px" }}>
              <SectionHead label="Property & Client" />
              <InfoRow label="Property Address" value={[project.address,project.city,project.state,project.zip].filter(Boolean).join(", ")} />
              <InfoRow label="Property Type"    value={project.propertyType} />
              <InfoRow label="Project #"        value={project.projectNumber} />
              <InfoRow label="Client"           value={project.clientName} />
              <InfoRow label="Client Phone"     value={project.clientPhone} />
              <InfoRow label="Client Email"     value={project.clientEmail} />
              <InfoRow label="Relationship"     value={project.clientRelationship} />
              <InfoRow label="Occupancy"        value={project.occupancyStatus} />
              <InfoRow label="Project Type"     value={project.type} />
              <InfoRow label="Cause of Loss"    value={project.causeOfLoss} />

              {/* Dates */}
              {hasDates && <SectionHead label="Key Dates" />}
              <InfoRow label="Date of Inspection"   value={formatDate(project.dateInspection, settings)} />
              <InfoRow label="Time of Inspection"   value={formatTime(project.timeInspection, settings)} />
              <InfoRow label="Date Work Performed"  value={formatDate(project.dateWorkPerformed, settings)} />
              <InfoRow label="Time Work Performed"  value={formatTime(project.timeWorkPerformed, settings)} />
              {project.dateOfLoss && <InfoRow label="Date of Loss" value={project.dateOfLoss} />}
              <InfoRow label="Report Date" value={reportDate ? formatDate(reportDate, settings) : today} />

              {/* Contractor */}
              {project.contractorName && <SectionHead label="Contractor / Inspector" />}
              <InfoRow label="Contractor / Inspector" value={project.contractorName} />
              <InfoRow label="Contractor Phone"       value={project.contractorPhone} />

              {/* Insurance */}
              {hasInsurance && <SectionHead label="Insurance Information" />}
              {hasInsurance && <>
                <InfoRow label="Carrier"       value={project.insuranceCarrier} />
                <InfoRow label="Policy #"      value={project.insurancePolicyNum} />
                <InfoRow label="Claim #"       value={project.claimNumber} />
                <InfoRow label="Coverage Type" value={project.coverageType} />
                <InfoRow label="Adjuster"      value={project.adjusterName} />
                <InfoRow label="Adjuster Co."  value={project.adjusterCompany} />
                <InfoRow label="Adjuster Phone" value={project.adjusterPhone} />
                <InfoRow label="Adjuster Email" value={project.adjusterEmail} />
              </>}

              {/* Site Conditions */}
              {hasSiteConditions && <SectionHead label="Site Conditions" />}
              {project.powerStatus  && <InfoRow label="Power"  value={project.powerStatus==="on"?"On":project.powerStatus==="off"?"Off":"N/A"} />}
              {project.waterStatus  && <InfoRow label="Water"  value={project.waterStatus==="on"?"On":project.waterStatus==="off"?"Off":"N/A"} />}
              {project.accessLimitations && <InfoRow label="Access Limitations" value={project.accessLimitations} />}
              {project.ppeItems?.length > 0 && (
                <div style={{ gridColumn:"1/-1" }}>
                  <div style={{ fontSize:8.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"#999",marginBottom:4 }}>PPE Required</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:4 }}>
                    {project.ppeItems.map(p => (
                      <span key={p} style={{ fontSize:9.5,padding:"2px 8px",borderRadius:10,background:"#f0f0f0",color:"#333",fontWeight:600 }}>{p}</span>
                    ))}
                    {project.ppeOtherText && <span style={{ fontSize:9.5,padding:"2px 8px",borderRadius:10,background:"#f0f0f0",color:"#333",fontWeight:600 }}>{project.ppeOtherText}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
      <PageFooter accentColor={accentColor} settings={settings} reportDate={reportDate} reportTime={reportTime} pageNum={1} isLast={blocks.length===0} />
    </div>
  );

  if (blocks.length === 0) return <>{page1}</>;

  // ── Paginate content blocks ──
  const PAGE_BODY_H = PAGE_H - HEADER_H - FOOTER_H;
  const pages = [];    // array of arrays of blocks
  let current = [];
  let used = 0;

  for (const block of blocks) {
    const h = estimateBlockHeight(block, gridClass);
    if (used + h > PAGE_BODY_H && current.length > 0) {
      pages.push(current);
      current = [block];
      used = h;
    } else {
      current.push(block);
      used += h;
    }
  }
  if (current.length > 0) pages.push(current);

  const totalPages = 1 + pages.length;

  const contentPages = pages.map((pageBlocks, pi) => {
    const pageNum = pi + 2;
    const isLast  = pageNum === totalPages;
    return (
      <div key={`p${pageNum}`} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:0 }}>
        {!forPrint && (
          <div style={{ width:PAGE_W,height:28,display:"flex",alignItems:"center",gap:12,padding:"0 4px",marginBottom:2 }}>
            <div style={{ flex:1,height:1,borderTop:"1px dashed #3a4050" }} />
            <span style={{ fontSize:10,color:"#555",letterSpacing:".05em",whiteSpace:"nowrap" }}>PAGE {pageNum}</span>
            <div style={{ flex:1,height:1,borderTop:"1px dashed #3a4050" }} />
          </div>
        )}
        {/* Page */}
        <div style={{ width:PAGE_W,minHeight:PAGE_H,background:"white",boxShadow:forPrint?"none":"0 4px 40px rgba(0,0,0,.6)",marginBottom:forPrint?0:2,fontFamily:"'Inter',system-ui,sans-serif",color:"#1a1a1a",display:"flex",flexDirection:"column",flexShrink:0 }}>
          {/* Continuation header */}
          <div style={{ padding:"14px 36px 10px",borderBottom:`2px solid ${accentColor}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,height:HEADER_H,boxSizing:"border-box" }}>
            <div style={{ fontWeight:700,fontSize:13,color:"#333" }}>{title}</div>
            <div style={{ fontSize:10.5,color:"#999" }}>{reportType} Â· {today}</div>
          </div>
          {/* Blocks */}
          <div style={{ flex:1,paddingTop:4 }}>
            {pageBlocks.map(block => (
              <BlockRenderer key={block.id} block={block.type==="beforeafter" ? (() => {
                const pair = (project.beforeAfterPairs||[]).find(p=>p.id===block.baPairId);
                return { ...block, _bPhoto: pair ? (project.photos||[]).find(p=>p.id===pair.beforeId) : null, _aPhoto: pair ? (project.photos||[]).find(p=>p.id===pair.afterId) : null };
              })() : block} showGps={showGps} showTimestamp={showTimestamp} showRooms={showRooms} showTags={showTags} gridClass={gridClass} settings={settings} />
            ))}
          </div>
          {/* Footer */}
          <PageFooter accentColor={accentColor} settings={settings} reportDate={reportDate} reportTime={reportTime} pageNum={pageNum} isLast={isLast} />
        </div>
      </div>
    );
  });

  return <>{page1}{contentPages}</>;
}


// ── Signature Draw Modal ──────────────────────────────────────────────────────
export function SignatureDrawModal({ onSave, onClose }) {
  const [mode, setMode] = useState("draw"); // "draw" | "upload"
  const canvasRef  = useRef(null);
  const drawing    = useRef(false);
  const fileRef    = useRef(null);
  const [isEmpty,  setIsEmpty]  = useState(true);
  const [uploadSrc,setUploadSrc]= useState(null);

  // Init canvas white background
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
  }, [mode]);

  const pt = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const src = (e.touches && e.touches[0]) || e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };

  const onDown = (e) => {
    e.preventDefault();
    drawing.current = true;
    setIsEmpty(false);
    const ctx = canvasRef.current.getContext("2d");
    const p = pt(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
  };
  const onMove = (e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.strokeStyle = "#1a1a2e";
    const p = pt(e);
    ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.moveTo(p.x, p.y);
  };
  const onUp = (e) => { e.preventDefault(); drawing.current = false; };

  const clearCanvas = () => {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
    setIsEmpty(true);
  };

  const handleSave = () => {
    if (mode === "upload" && uploadSrc) { onSave(uploadSrc); onClose(); return; }
    if (isEmpty) return;
    onSave(canvasRef.current.toDataURL("image/png"));
    onClose();
  };

  const handleUpload = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => setUploadSrc(ev.target.result);
    r.readAsDataURL(f);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal fade-in" style={{ maxWidth:520 }}>
        <div className="modal-header">
          <div className="modal-title">â Add Signature</div>
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22} /></button>
        </div>

        {/* Mode tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid var(--border)", padding:"0 24px" }}>
          {[["draw","â Draw by Hand"],["upload","ð Upload Image"]].map(([id,label]) => (
            <button key={id} className="btn btn-ghost btn-sm"
              style={{ borderBottom:`2px solid ${mode===id?"var(--accent)":"transparent"}`,borderRadius:0,paddingBottom:10,color:mode===id?"var(--accent)":"var(--text2)",fontWeight:mode===id?700:500 }}
              onClick={()=>{ setMode(id); setUploadSrc(null); }}>
              {label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {mode === "draw" ? (
            <div>
              <div style={{ fontSize:12.5, color:"var(--text3)", marginBottom:10 }}>
                Sign your name in the box below using your mouse or touchscreen.
              </div>
              <div style={{ border:"2px solid var(--border)", borderRadius:"var(--radius-sm)", background:"#fff", overflow:"hidden", cursor:"crosshair", touchAction:"none" }}>
                <canvas ref={canvasRef} width={468} height={160}
                  style={{ display:"block", width:"100%", height:160 }}
                  onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
                  onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
                />
              </div>
              <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8 }}>
                <button className="btn btn-ghost btn-sm" style={{ fontSize:12, color:"var(--text3)" }} onClick={clearCanvas}>✕ Clear</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize:12.5, color:"var(--text3)", marginBottom:10 }}>
                Upload a PNG or JPG image of your signature. A transparent PNG works best.
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleUpload} />
              {uploadSrc ? (
                <div style={{ border:"2px solid var(--border)", borderRadius:"var(--radius-sm)", background:"#fff", padding:16, display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
                  <img src={uploadSrc} alt="Signature" style={{ maxHeight:120, maxWidth:"100%", objectFit:"contain" }} />
                  <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>Replace Image</button>
                </div>
              ) : (
                <div style={{ border:"2px dashed var(--border)", borderRadius:"var(--radius-sm)", padding:"32px 20px", textAlign:"center", cursor:"pointer", background:"var(--surface2)" }}
                  onClick={() => fileRef.current?.click()}>
                  <Icon d={ic.upload} size={28} stroke="var(--text3)" />
                  <div style={{ fontSize:13, color:"var(--text2)", marginTop:8, fontWeight:600 }}>Click to upload signature</div>
                  <div style={{ fontSize:11.5, color:"var(--text3)", marginTop:4 }}>PNG with transparent background recommended</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}
            disabled={mode==="draw" ? isEmpty : !uploadSrc}>
            <Icon d={ic.check} size={14} /> Use Signature
          </button>
        </div>
      </div>
    </div>
  );
}

const BLOCK_TYPES = [
  { id:"text",        label:"Text Block",        icon:ic.text      },
  { id:"table",       label:"Table",             icon:"M3 3h18v18H3V3z M3 9h18 M3 15h18 M9 3v18 M15 3v18" },
  { id:"photos",      label:"Photo Grid",        icon:ic.image     },
  { id:"files",       label:"File List",         icon:ic.folder    },
  { id:"textphoto",   label:"Text + Photo",      icon:ic.copy      },
  { id:"beforeafter", label:"Before & After",    icon:ic.layers    },
  { id:"sketch",      label:"Sketch / Map",      icon:ic.sketch    },
  { id:"divider",     label:"Section Divider",   icon:ic.hash      },
  { id:"signature",   label:"Signature",         icon:"M12 19l7-7-7-7 M5 12h14" },
];

// Scrollable block-type picker that fits in a fixed bar without overflowing
const PAGE_SIZE = 4; // how many block buttons are visible at once
export function BlockInsertBar({ onAdd, prefix, extraLeft, extraRight }) {
  const [offset, setOffset] = React.useState(0);
  const total   = BLOCK_TYPES.length;
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;
  const visible = BLOCK_TYPES.slice(offset, offset + PAGE_SIZE);
  return (
    <div style={{ display:"flex",alignItems:"center",gap:3,padding:"3px 8px",background:"var(--surface2)",borderBottom:"1px solid var(--border)",borderTop:"1px solid var(--border)" }}>
      {extraLeft}
      {prefix && <div style={{ fontSize:11,color:"var(--text3)",marginRight:4,fontWeight:600,whiteSpace:"nowrap",flexShrink:0 }}>{prefix}</div>}
      {/* Prev arrow */}
      <button className="btn btn-ghost btn-sm btn-icon" title="Previous" disabled={!canPrev}
        onClick={e=>{e.stopPropagation();setOffset(o=>Math.max(0,o-PAGE_SIZE));}}
        style={{ opacity:canPrev?1:.25,padding:"2px 4px",flexShrink:0 }}>
        <Icon d="M15 18l-6-6 6-6" size={13}/>
      </button>
      {/* Visible block buttons */}
      <div style={{ display:"flex",alignItems:"center",gap:3,flex:1,overflow:"hidden" }}>
        {visible.map(bt=>(
          <button key={bt.id} className="btn btn-ghost btn-sm" title={`Add ${bt.label}`}
            style={{ gap:4,fontSize:11,padding:"2px 7px",whiteSpace:"nowrap",flexShrink:0 }}
            onClick={e=>{e.stopPropagation();onAdd(bt.id);}}>
            <Icon d={bt.icon} size={12}/>{bt.label}
          </button>
        ))}
      </div>
      {/* Next arrow */}
      <button className="btn btn-ghost btn-sm btn-icon" title="More" disabled={!canNext}
        onClick={e=>{e.stopPropagation();setOffset(o=>Math.min(total-PAGE_SIZE,o+PAGE_SIZE));}}
        style={{ opacity:canNext?1:.25,padding:"2px 4px",flexShrink:0 }}>
        <Icon d="M9 18l6-6-6-6" size={13}/>
      </button>
      {/* Page indicator */}
      <div style={{ display:"flex",gap:3,flexShrink:0 }}>
        {Array.from({length:Math.ceil(total/PAGE_SIZE)},(_,i)=>(
          <div key={i} onClick={e=>{e.stopPropagation();setOffset(i*PAGE_SIZE);}}
            style={{ width:5,height:5,borderRadius:"50%",cursor:"pointer",transition:"background .15s",
              background:Math.floor(offset/PAGE_SIZE)===i?"var(--accent)":"var(--border)" }} />
        ))}
      </div>
      {extraRight}
    </div>
  );
}

// ── AI Writer Modal ──────────────────────────────────────────────────────────
export function AiWriterModal({ block, project, settings, onAccept, onClose, onUsageIncrement }) {
  const [prompt,    setPrompt]    = useState("");
  const [result,    setResult]    = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const promptRef = useRef();

  const blockLabel = block.label || block.sketchTitle || (
    block.type==="text"      ? "Report Text" :
    block.type==="table"     ? "Data Table" :
    block.type==="textphoto" ? "Text + Photo" :
    block.type==="divider"   ? "Section Divider" :
    block.type==="signature" ? "Signature Block" : "Block"
  );

  const systemPrompt = `You are an expert construction and property inspection report writer for ${settings?.companyName||"a construction company"}. 
You write professional, concise, factual report content. Use industry-standard terminology.
Project context:
- Property: ${[project.address,project.city,project.state].filter(Boolean).join(", ")||"N/A"}
- Project Type: ${project.type||"N/A"}
- Cause of Loss: ${project.causeOfLoss||"N/A"}
- Property Type: ${project.propertyType||"N/A"}
- Client: ${project.clientName||"N/A"}
- Inspector: ${settings?.userFirstName||""} ${settings?.userLastName||""}, ${settings?.userTitle||""}
- Company: ${settings?.companyName||"N/A"}
Write ONLY the report text content. No preamble, no "here is the text", no markdown headers. Plain professional prose ready to paste into the report.`;

  const generate = async () => {
    if (!prompt.trim() && !result) return;
    const plan  = settings?.plan || "base";
    const limit = PLAN_AI_LIMITS[plan] || 0;
    if (limit === 0) { setError("AI Write is not available on your current plan."); return; }
    const wStart   = settings?.aiGenerationsWindowStart ? new Date(settings.aiGenerationsWindowStart) : null;
    const curWin   = getWeekWindowStart();
    const valid    = wStart && wStart >= curWin;
    const usedNow  = valid ? (settings?.aiGenerationsUsed || 0) : 0;
    if (usedNow >= limit) {
      const reset = getNextResetDate();
      setError("Weekly limit reached (" + limit + " AI Generation Krakens). Resets " + reset.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}) + " at 11:59 PM.");
      return;
    }
    setLoading(true); setError("");
    const userMsg = prompt.trim()
      ? `Write the "${blockLabel}" section. Instructions: ${prompt}`
      : `Rewrite this text more professionally: ${result}`;
    try {
      // ── Proxy via Vercel serverless function (/api/generate-report) ──────
      // This keeps ANTHROPIC_API_KEY server-side; never in the browser bundle.
      const { data: { session: _sess } } = await supabase.auth.getSession();
      const _token = _sess?.access_token || "";
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${_token}`,
        },
        body: JSON.stringify({
          projectName:        blockLabel,
          projectDescription: systemPrompt,
          photos:             [],
          customPrompt:       userMsg,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const text = data.report || "";
      setResult(text.trim());
      setPrompt("");
      if (onUsageIncrement) onUsageIncrement();
    } catch(e) {
      setError(e.message||"Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const handleKey = e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); generate(); } };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.55)" }}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16,boxShadow:"0 16px 60px rgba(0,0,0,.7)",width:"min(560px,95vw)",maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden" }}>
        {/* Header */}
        <div style={{ padding:"16px 20px 14px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#7c3aed,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700,fontSize:14 }}>AI Report Writer</div>
            <div style={{ fontSize:11.5,color:"var(--text2)" }}>Writing: <span style={{ color:"var(--accent)" }}>{blockLabel}</span></div>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><Icon d={ic.close} size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12 }}>
          {/* Prompt input */}
          <div>
            <div style={{ fontSize:11.5,fontWeight:600,color:"var(--text2)",marginBottom:5 }}>Describe what you want — or press Generate for a smart draft</div>
            <div style={{ display:"flex",gap:8 }}>
              <input ref={promptRef} className="form-input" value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={handleKey}
                placeholder={`e.g. "Water damage to ceiling joists from roof leak, moderate severity"`}
                style={{ flex:1,fontSize:13 }} autoFocus />
              <button className="btn btn-primary btn-sm" onClick={generate} disabled={loading} style={{ whiteSpace:"nowrap",gap:6,background:"linear-gradient(135deg,#7c3aed,#a855f7)",border:"none" }}>
                {loading
                  ? <><span style={{ display:"inline-block",width:12,height:12,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"white",borderRadius:"50%",animation:"spin .7s linear infinite" }} /> Writing...</>
                  : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg> {result?"Regenerate":"Generate"}</>
                }
              </button>
            </div>
          </div>

          {/* Suggestion chips */}
          {!result && !loading && (
            <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
              {[
                "Write a professional summary of findings",
                "Describe the damage in detail",
                "Write scope of work recommendations",
                "Summarize site conditions",
                "Write a closing statement",
              ].map(s=>(
                <button key={s} className="btn btn-secondary btn-sm" style={{ fontSize:11,padding:"3px 10px" }}
                  onClick={()=>{setPrompt(s);setTimeout(()=>promptRef.current?.focus(),50);}}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Result */}
          {error && (
            <div style={{ padding:"10px 14px",background:"rgba(232,90,58,.1)",border:"1px solid rgba(232,90,58,.3)",borderRadius:8,fontSize:12.5,color:"#e85a3a" }}>{error}</div>
          )}
          {result && (
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              <div style={{ fontSize:11.5,fontWeight:600,color:"var(--text2)" }}>Generated draft — edit before accepting:</div>
              <textarea value={result} onChange={e=>setResult(e.target.value)}
                style={{ width:"100%",minHeight:160,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:"12px 14px",fontSize:13,lineHeight:1.75,fontFamily:"inherit",color:"var(--text)",resize:"vertical",outline:"none",boxSizing:"border-box" }} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"12px 20px",borderTop:"1px solid var(--border)",display:"flex",gap:8,justifyContent:"flex-end" }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          {result && (
            <button className="btn btn-primary btn-sm" onClick={()=>onAccept(result)} style={{ background:"linear-gradient(135deg,#7c3aed,#a855f7)",border:"none",gap:6 }}>
              <Icon d={ic.check} size={14} /> Use This Text
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AI Writer Upgrade Modal ──────────────────────────────────────────────────
export function AiWriterUpgradeModal({ onUpgrade, onClose, isAdmin, settings, users }) {
  const [confirming, setConfirming] = React.useState(false);

  // Proration — only computed when admin hits "Upgrade"
  const p = isAdmin ? calcProration(settings, users || [], "base", "pro") : null;

  return (
    <div style={{ position:"fixed",inset:0,zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.55)" }}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16,boxShadow:"0 16px 60px rgba(0,0,0,.7)",width:"min(460px,95vw)",overflow:"hidden" }}>

        {/* Gradient header */}
        <div style={{ padding:"24px 28px 20px",background:"linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#c084fc 100%)",textAlign:"center" }}>
          <div style={{ width:48,height:48,borderRadius:13,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
          </div>
          <div style={{ fontSize:19,fontWeight:800,color:"white",marginBottom:5 }}>
            {confirming ? "Confirm Upgrade" : "â¦ Intelligence II / â¬¡ Command III Feature"}
          </div>
          <div style={{ fontSize:13,color:"rgba(255,255,255,.82)",lineHeight:1.5 }}>
            {confirming
              ? "Review the charges below — AI Write unlocks the moment you confirm."
              : isAdmin
                ? "AI Report Writer is included in Intelligence II and Command III — upgrade to unlock it for your whole team"
                : "Ask your account admin to upgrade the plan to unlock this feature"}
          </div>
        </div>

        <div style={{ padding:"20px 24px 22px" }}>

          {/* ── Step 1: Feature overview ── */}
          {!confirming && (
            <>
              <div style={{ display:"flex",flexDirection:"column",gap:9,marginBottom:18 }}>
                {[
                  ["Instant drafts",  "Generate professional text from your project details"],
                  ["Context-aware",   "AI uses your property, damage type, and site data"],
                  ["Fully editable",  "Review and tweak before it goes in the report"],
                  ["All block types", "Works on any text section in the report"],
                ].map(([title,desc])=>(
                  <div key={title} style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
                    <div style={{ width:18,height:18,borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1 }}>
                      <Icon d={ic.check} size={10} stroke="white" strokeWidth={3} />
                    </div>
                    <div>
                      <div style={{ fontWeight:600,fontSize:13 }}>{title}</div>
                      <div style={{ fontSize:12,color:"var(--text2)" }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {isAdmin ? (
                <>
                  <div style={{ padding:"12px 16px",background:"var(--surface2)",borderRadius:10,border:"1px solid var(--border)",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                    <div>
                      <div style={{ fontWeight:700,fontSize:13.5 }}>â¦ Intelligence II / â¬¡ Command III</div>
                      <div style={{ fontSize:11.5,color:"var(--text2)" }}>Admin seat Â· +${PRICING.monthly.pro.user}/user/mo</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:22,fontWeight:900,color:"#a855f7" }}>${PRICING.monthly.pro.admin}<span style={{ fontSize:12,fontWeight:400,color:"var(--text2)" }}>/mo</span></div>
                    </div>
                  </div>
                  <div style={{ display:"flex",gap:8 }}>
                    <button className="btn btn-secondary btn-sm" style={{ flex:1 }} onClick={onClose}>Maybe later</button>
                    <button className="btn btn-primary btn-sm" style={{ flex:2,background:"linear-gradient(135deg,#7c3aed,#a855f7)",border:"none",fontWeight:700,gap:6 }}
                      onClick={()=>setConfirming(true)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                      Upgrade to Intelligence II
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ padding:"13px 15px",background:"linear-gradient(135deg,#7c3aed0d,#a855f70d)",borderRadius:10,border:"1px solid #a855f730",marginBottom:14 }}>
                    <div style={{ display:"flex",alignItems:"flex-start",gap:10 }}>
                      <div style={{ width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#7c3aed,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                        <Icon d={ic.user} size={14} stroke="white" />
                      </div>
                      <div>
                        <div style={{ fontWeight:700,fontSize:13,marginBottom:3 }}>Admin upgrade required</div>
                        <div style={{ fontSize:12,color:"var(--text2)",lineHeight:1.6 }}>
                          Your account is on Capture I. Ask your admin to upgrade to Intelligence II or Command III in <strong>Account → Billing</strong>. AI Write will unlock immediately.
                        </div>
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{ width:"100%" }} onClick={onClose}>Got it</button>
                </>
              )}
            </>
          )}

          {/* ── Step 2: Proration confirm (admin only) ── */}
          {confirming && p && (
            <>
              <div style={{ background:"var(--surface2)",borderRadius:9,overflow:"hidden",border:"1px solid var(--border)",marginBottom:14,fontSize:12.5 }}>
                <div style={{ display:"grid",gridTemplateColumns:"1fr auto",padding:"9px 13px",borderBottom:"1px solid var(--border)",color:"var(--text2)" }}>
                  <span>Capture I unused credit ({p.daysLeft} of {p.daysTotal} days left)</span>
                  <span style={{ color:"#3dba7e",fontWeight:700 }}>â${p.unusedCredit}</span>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr auto",padding:"9px 13px",borderBottom:"1px solid var(--border)",color:"var(--text2)" }}>
                  <span>Intelligence II prorated charge ({p.daysLeft} days)</span>
                  <span style={{ fontWeight:600 }}>+${p.newCharge}</span>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr auto",padding:"11px 13px",fontWeight:800,fontSize:13.5 }}>
                  <span>Charged today</span>
                  <span style={{ color: p.netCharge > 0 ? "var(--accent)" : "#3dba7e" }}>
                    ${p.netCharge > 0 ? p.netCharge : "0.00"}{p.netCharge <= 0 ? " (credit)" : ""}
                  </span>
                </div>
              </div>
              <div style={{ fontSize:11.5,color:"var(--text3)",marginBottom:14,lineHeight:1.6 }}>
                From <strong>{p.cycleEnd.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</strong> onwards: <strong>${p.toTotal}/mo</strong> Â· AI Write unlocks immediately for all team members.
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex:1 }} onClick={()=>setConfirming(false)}>â Back</button>
                <button className="btn btn-primary btn-sm" style={{ flex:2,background:"linear-gradient(135deg,#7c3aed,#a855f7)",border:"none",fontWeight:700,gap:6 }}
                  onClick={onUpgrade}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                  Confirm — Pay ${Math.max(0, p.netCharge)} now
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}


// ── AI 1-Click Report Generator ─────────────────────────────────────────────
function parseAiOutputToBlocks(rawText) {
  const paras = rawText.split(/\n{2,}/);
  const out = [];
  paras.forEach(para => {
    const t = para.trim();
    if (!t) return;
    const lines2 = t.split("\n");
    const firstLine2 = lines2[0].trim();
    const looksLikeHeader = firstLine2.length <= 60 && !/[.,;!?]$/.test(firstLine2) && lines2.length === 1;
    if (looksLikeHeader) {
      out.push({ id: uid(), type: "divider", label: firstLine2 });
    } else {
      out.push({ id: uid(), type: "text", content: t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>") });
    }
  });
  return out.length > 0 ? out : [{ id: uid(), type: "text", content: rawText.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>") }];
}

function AiOneClickModal({ project, settings, onGenerate, onClose, onUsageIncrement }) {
  const REPORT_TYPES = [
    { id:"findings",   label:"Findings Report",    krakens:2, desc:"3â6 paragraphs on identified issues, deficiencies, risks, and recommended actions." },
    { id:"progress",   label:"Progress Report",    krakens:2, desc:"3â6 paragraphs: work completed, current conditions, concerns, and next steps." },
    { id:"completion", label:"Completion Report",  krakens:4, desc:"6â12 paragraph professional close-out: scope, actions, final condition, recommendations, conclusion." },
    { id:"custom",     label:"Custom Report",      krakens:6, desc:"Choose your sections and describe exactly what you need." },
  ];
  const CUSTOM_SECTIONS = ["Executive Summary","Scope of Work","Findings & Deficiencies","Cause of Loss","Moisture Readings","Equipment Used","Work Completed","Site Conditions","Photo Documentation","Safety Observations","Timeline","Recommendations","Next Steps","Sign-Off","Conclusion"];
  const [sel, setSel]   = React.useState(null);
  const [secs, setSecs] = React.useState([]);
  const [extra, setExtra] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");
  const plan = settings?.plan || "base";
  const limit = PLAN_AI_LIMITS[plan] || 0;
  const wStart = settings?.aiGenerationsWindowStart ? new Date(settings.aiGenerationsWindowStart) : null;
  const curWin = getWeekWindowStart();
  const valid  = wStart && wStart >= curWin;
  const used   = valid ? (settings?.aiGenerationsUsed || 0) : 0;
  const remaining = Math.max(0, limit - used);
  const canAfford = k => remaining >= k;
  const PROMPTS = {
    findings:   "Write a Findings Report for this project. Produce 3-6 professional paragraphs identifying key issues, deficiencies, and risks. Highlight affected areas and recommended actions. Plain text, no markdown or bullets.",
    progress:   "Write a Progress Report for this active project. Produce 3-6 professional paragraphs covering: work completed, current site conditions, ongoing concerns, and next steps. Suitable for clients, adjusters, and property managers. Plain text, no markdown.",
    completion: "Write a Completion Report for this finished project. Produce 6-12 professional paragraphs covering scope of work, actions taken, project progression, final site condition, recommendations, and conclusion. Format with each major section title on its own line followed by its paragraph. Professional language suitable for clients, insurers, and records.",
    custom:     null,
  };
  const buildPrompt = () => {
    if (sel === "custom") {
      const sectList = secs.join(", ") || "Introduction, Findings, Conclusion";
      return "Write a professional report with these sections: " + sectList + ". For each section write the section title on its own line, then a professional paragraph. " + (extra ? "Additional instructions: " + extra : "");
    }
    return PROMPTS[sel] || PROMPTS.findings;
  };
  const handleGenerate = async () => {
    if (!sel) return;
    const type = REPORT_TYPES.find(t => t.id === sel);
    if (!canAfford(type.krakens)) { setErr("Not enough Krakens. Need " + type.krakens + ", have " + remaining + " remaining."); return; }
    if (sel === "custom" && secs.length === 0) { setErr("Select at least one section."); return; }
    setLoading(true); setErr("");
    const sysPrompt = "You are an expert restoration and property inspection report writer for " + (settings?.companyName || "a restoration company") + ". Write professional, factual reports using industry-standard terminology. Use ONLY the project data provided.\n\nProject:\n- Property: " + ([project.address,project.city,project.state].filter(Boolean).join(", ")||"N/A") + "\n- Type: " + (project.type||"N/A") + "\n- Cause of Loss: " + (project.causeOfLoss||"N/A") + "\n- Property Type: " + (project.propertyType||"N/A") + "\n- Client: " + (project.clientName||"N/A") + "\n- Inspector: " + ((settings?.userFirstName||"")+" "+(settings?.userLastName||"")).trim() + (settings?.userTitle?", "+settings.userTitle:"") + "\n- Company: " + (settings?.companyName||"N/A") + "\n- Status: " + (project.status||"N/A");
    try {
      const { data:{ session:_s } } = await supabase.auth.getSession();
      const res = await fetch("/api/generate-report", {
        method:"POST",
        headers:{ "Content-Type":"application/json","Authorization":"Bearer "+(_s?.access_token||"") },
        body: JSON.stringify({ projectName:project.title||"Project", projectDescription:sysPrompt, photos:[], customPrompt:buildPrompt() }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      if (onUsageIncrement) onUsageIncrement(type.krakens);
      onGenerate(d.report?.trim() || "");
    } catch(e) { setErr(e.message || "Generation failed. Please try again."); }
    setLoading(false);
  };
  return (
    <div style={{position:"fixed",inset:0,zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.6)"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16,boxShadow:"0 16px 60px rgba(0,0,0,.7)",width:"min(580px,95vw)",maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"16px 20px 14px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#7c3aed,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:14}}>AI 1-Click Report Generator</div>
            <div style={{fontSize:11.5,color:"var(--text2)"}}>{remaining} Kraken{remaining!==1?"s":""} remaining · resets {getNextResetDate().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</div>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><Icon d={ic.close} size={16}/></button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
          {REPORT_TYPES.map(type => {
            const ok = canAfford(type.krakens); const isS = sel===type.id;
            return (
              <div key={type.id} onClick={()=>ok&&setSel(type.id)}
                style={{border:"2px solid "+(isS?"#a855f7":"var(--border)"),borderRadius:10,padding:"12px 16px",cursor:ok?"pointer":"not-allowed",opacity:ok?1:0.45,background:isS?"rgba(168,85,247,.08)":"var(--surface2)",transition:"all .15s",display:"flex",alignItems:"flex-start",gap:12}}>
                <div style={{width:18,height:18,borderRadius:"50%",border:"2px solid "+(isS?"#a855f7":"var(--border)"),background:isS?"#a855f7":"transparent",flexShrink:0,marginTop:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {isS&&<div style={{width:6,height:6,borderRadius:"50%",background:"white"}}/>}
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{fontWeight:700,fontSize:13.5}}>{type.label}</span>
                    <span style={{fontSize:11,fontWeight:700,color:"#a855f7",background:"rgba(168,85,247,.12)",padding:"2px 8px",borderRadius:20}}>⚡ {type.krakens} Krakens</span>
                  </div>
                  <div style={{fontSize:12,color:"var(--text2)",lineHeight:1.5}}>{type.desc}</div>
                </div>
              </div>
            );
          })}
          {sel==="custom"&&(
            <div style={{display:"flex",flexDirection:"column",gap:10,paddingTop:4}}>
              <div style={{fontSize:12,fontWeight:600,color:"var(--text2)"}}>Sections to include:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {CUSTOM_SECTIONS.map(s=>{const on=secs.includes(s);return(
                  <button key={s} onClick={()=>setSecs(p=>on?p.filter(x=>x!==s):[...p,s])} className="btn btn-sm"
                    style={{fontSize:11.5,padding:"3px 10px",background:on?"linear-gradient(135deg,#7c3aed,#a855f7)":undefined,color:on?"white":undefined,border:"1px solid "+(on?"transparent":"var(--border)")}}>{s}</button>
                );})}
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:"var(--text2)",marginBottom:4}}>Additional instructions <span style={{fontWeight:400}}>(optional)</span>:</div>
                <textarea value={extra} onChange={e=>setExtra(e.target.value)} placeholder="Describe anything specific to include or emphasize..." style={{width:"100%",minHeight:68,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:"8px 12px",fontSize:12.5,lineHeight:1.6,fontFamily:"inherit",color:"var(--text)",resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
              </div>
            </div>
          )}
          {err&&<div style={{padding:"10px 14px",background:"rgba(232,90,58,.1)",border:"1px solid rgba(232,90,58,.3)",borderRadius:8,fontSize:12.5,color:"#e85a3a"}}>{err}</div>}
        </div>
        <div style={{padding:"12px 20px",borderTop:"1px solid var(--border)",display:"flex",gap:8,justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:11.5,color:"var(--text3)"}}>
            {sel?("Uses "+REPORT_TYPES.find(t=>t.id===sel)?.krakens+" Krakens · replaces current report content"):"Select a report type above"}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-sm" onClick={handleGenerate} disabled={!sel||loading}
              style={{background:"linear-gradient(135deg,#7c3aed,#a855f7)",color:"white",border:"none",gap:6,display:"flex",alignItems:"center",minWidth:130,justifyContent:"center",opacity:(!sel||loading)?0.65:1,padding:"6px 14px",borderRadius:7,fontWeight:700,fontSize:13,cursor:(!sel||loading)?"not-allowed":"pointer"}}>
              {loading
                ?<><span style={{display:"inline-block",width:12,height:12,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"white",borderRadius:"50%",animation:"spin .7s linear infinite"}}/> Generating…</>
                :<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg> Generate Report</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReportCreator({ project, reportData, settings, onSettingsChange, templates, users, onSave, onClose, onUpgradeAi, userRole }) {
  const isNew = !reportData;
  const coverRef  = useRef();
  const photoLayout = settings?.reportPhotoLayout || "3 per row";
  const colMap = { "2 per row":"rp-photo-grid-2","3 per row":"rp-photo-grid-3","4 per row":"rp-photo-grid-4","Full width":"rp-photo-grid-2" };

  // Derive cert codes for a signer name — looks up matching user in users array
  const getCertCodesForSigner = (name) => {
    if (!name || !users?.length) return [];
    const normalized = name.trim().toLowerCase();
    const match = users.find(u =>
      `${u.firstName||""} ${u.lastName||""}`.trim().toLowerCase() === normalized
    );
    return (match?.certifications||[])
      .filter(c => c.certCode?.trim())
      .map(c => c.certCode.trim().toUpperCase());
  };

  // Default signer name (admin)
  const defaultSignerName = `${settings?.userFirstName||""} ${settings?.userLastName||""}`.trim();
  const defaultSignerCertCodes = getCertCodesForSigner(defaultSignerName);

  // ── Report meta ──
  const [title,       setTitle]       = useState(reportData?.title       || `${project.title} — Report`);
  const [reportType,  setReportType]  = useState(reportData?.reportType  || settings?.defaultReportType || "Assessment");
  const [reportDate,  setReportDate]  = useState(reportData?.reportDate  || new Date().toLocaleDateString("en-CA")); // en-CA gives YYYY-MM-DD for date input
  const [reportTime,  setReportTime]  = useState(reportData?.reportTime  || "");
  const [status,      setStatus]      = useState(reportData?.status      || "draft");
  const [coverPhoto,  setCoverPhoto]  = useState(reportData?.coverPhoto  || null);
  const [selectedTpl, setSelectedTpl] = useState(null);

  // ── Display toggles (start from settings defaults) ──
  const [showGps,       setShowGps]       = useState(settings?.reportShowGps !== "no");
  const [showTimestamp, setShowTimestamp] = useState(settings?.reportShowTimestamp !== "no");
  const [showRooms,     setShowRooms]     = useState(true);
  const [showCoverInfo, setShowCoverInfo] = useState(true);
  const [showTags,      setShowTags]      = useState(true);
  const [previewOpen,   setPreviewOpen]   = useState(false);
  const [showSigModal,  setShowSigModal]  = useState(false);
  const [signatureTargetId, setSignatureTargetId] = useState(null);

  // ── Content blocks ──
  const [blocks, setBlocks] = useState(reportData?.blocks || [
    { id:uid(), type:"text",   content:"" },
  ]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [editingBlock,  setEditingBlock]  = useState(null);

  const coverFileRef = useRef();
  const addBlockFileRef = useRef();
  const [addingPhotosToBlock, setAddingPhotosToBlock] = useState(null);

  // ── Photo picker state ──
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [photoPickerTarget, setPhotoPickerTarget] = useState(null); // blockId or "cover"
  const [selectedProjectPhotos, setSelectedProjectPhotos] = useState([]);
  const [printing, setPrinting] = useState(false);
  const [aiWriterBlock, setAiWriterBlock] = useState(null);   // blockId being written
  const [showAiOneClick, setShowAiOneClick] = React.useState(false);
  const [showAiUpgrade, setShowAiUpgrade] = useState(false);
  const printLayerRef = useRef(null);
  const aiEnabled = (PLAN_AI_LIMITS[settings?.plan || "base"] || 0) > 0;
  const canExportReports = canAccessFeature(settings, "exports", "view");

  const accentColor = settings?.accent || "#2b7fe8";

  // Apply template — respects enabled sections and uses saved default text
  const applyTemplate = (tpl) => {
    if (!tpl) return;
    setSelectedTpl(tpl);
    const sectionBlocks = [];
    const sections = ["Cover Page","Property Information","Scope of Work","Report","Damage Summary","Photo Documentation","Sign Off"];
    sections.forEach(s => {
      if (s === "Cover Page") return; // handled by cover photo area, not a block
      // If the template has sections data, honour the enabled flag.
      // Templates without sections data (legacy / seed) default every section to enabled.
      const secData = tpl.sections?.[s];
      const isEnabled = secData ? secData.enabled !== false : true;
      if (!isEnabled) return;
      if (s === "Photo Documentation") {
        sectionBlocks.push({ id:uid(), type:"divider", label:s });
        sectionBlocks.push({ id:uid(), type:"photos", photos:[], caption:"" });
      } else if (s === "Sign Off") {
        sectionBlocks.push({ id:uid(), type:"divider", label:s });
        const signOffText = secData?.text?.trim();
        sectionBlocks.push({ id:uid(), type:"text", content: signOffText ||
          `Prepared by: ${settings?.userFirstName||""} ${settings?.userLastName||""}\nTitle: ${settings?.userTitle||""}\nDate: ${formatDate(new Date().toISOString().slice(0,10), settings)}` });
        sectionBlocks.push({ id:uid(), type:"signature", label:"Authorized Signature",
          signatureImg: tpl.signatureImg || null,
          signerName: `${settings?.userFirstName||""} ${settings?.userLastName||""}`.trim(),
          signerTitle: settings?.userTitle||"",
          sigDate: formatDate(new Date().toISOString().slice(0,10), settings),
          signerCertCodes: defaultSignerCertCodes });
      } else {
        sectionBlocks.push({ id:uid(), type:"divider", label:s });
        // Use the saved default text from the template editor; fall back to placeholder
        const savedText = secData?.text?.trim();
        sectionBlocks.push({ id:uid(), type:"text",
          content: savedText || `${s} details go here.` });
      }
    });
    setBlocks(sectionBlocks);
  };

  // On mount: if this report was opened from a template (via _fromTemplate id),
  // auto-apply that template so its sections and saved text are pre-populated.
  // Must be placed AFTER applyTemplate is defined to avoid temporal dead zone error.
  useEffect(() => {
    const templateId = reportData?._fromTemplate;
    if (!templateId || !templates?.length) return;
    const tpl = templates.find(t => String(t.id) === String(templateId));
    if (tpl) applyTemplate(tpl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount only

  const addBlock = (type, afterId) => {
    const newBlock = { id:uid(), type,
      content: type==="divider"?"Section Title": "",
      photos: type==="photos"||type==="textphoto" ? [] : undefined,
      files: type==="files" ? [] : undefined,
      label:  type==="divider" ? "Section" : type==="signature" ? "Authorized Signature" : undefined,
      dataUrl: type==="sketch" ? null : undefined,
      sketchTitle: type==="sketch" ? "Sketch / Map" : undefined,
      sideText: type==="textphoto" ? "" : undefined,
      baPairId: type==="beforeafter" ? null : undefined,
      caption:  type==="beforeafter" ? "" : (type==="photos"||type==="sketch"||type==="files" ? "" : undefined),
      signatureImg: type==="signature" ? null : undefined,
      signerName:  type==="signature" ? (settings?.userFirstName||"")+" "+(settings?.userLastName||"") : undefined,
      signerTitle: type==="signature" ? (settings?.userTitle||"") : undefined,
      sigDate:     type==="signature" ? formatDate(new Date().toISOString().slice(0,10), settings) : undefined,
      signerCertCodes: type==="signature" ? defaultSignerCertCodes : undefined,
      // table
      tableTitle:   type==="table" ? "Table Title" : undefined,
      tableHeading: type==="table" ? "" : undefined,
      tableHasHeader: type==="table" ? true : undefined,
      tableColWidths: type==="table" ? [150, 150, 150] : undefined,
      tableColAligns: type==="table" ? ["left","left","left"] : undefined,
      tableRows:    type==="table" ? [
        ["Column A", "Column B", "Column C"],
        ["", "", ""],
        ["", "", ""],
      ] : undefined,
      tableHeaderBg:   type==="table" ? accentColor : undefined,
      tableHeaderColor:type==="table" ? "#ffffff" : undefined,
      tableStriped:    type==="table" ? true : undefined,
      tableBorders:    type==="table" ? "all" : undefined, // "all"|"outer"|"none"
    };
    setBlocks(prev => {
      const idx = afterId ? prev.findIndex(b=>b.id===afterId) : prev.length-1;
      const next = [...prev];
      next.splice(idx+1, 0, newBlock);
      return next;
    });
    setEditingBlock(newBlock.id);
  };

  const updateBlock = (id, patch) => setBlocks(prev => prev.map(b => b.id===id ? { ...b, ...patch } : b));
  const deleteBlock = (id) => { setBlocks(prev => prev.filter(b => b.id!==id)); setSelectedBlock(null); };
  const moveBlock   = (id, dir) => setBlocks(prev => {
    const idx = prev.findIndex(b=>b.id===id);
    if ((dir===-1&&idx===0)||(dir===1&&idx===prev.length-1)) return prev;
    const next = [...prev];
    [next[idx],next[idx+dir]] = [next[idx+dir],next[idx]];
    return next;
  });

  const openPhotoPicker = (blockId) => { setPhotoPickerTarget(blockId); setSelectedProjectPhotos([]); setPhotoPickerOpen(true); };

  const confirmPhotoPicker = () => {
    if (photoPickerTarget === "cover") {
      if (selectedProjectPhotos[0]?.dataUrl) setCoverPhoto(selectedProjectPhotos[0].dataUrl);
    } else {
      updateBlock(photoPickerTarget, { photos:[...(blocks.find(b=>b.id===photoPickerTarget)?.photos||[]), ...selectedProjectPhotos] });
    }
    setPhotoPickerOpen(false); setPhotoPickerTarget(null); setSelectedProjectPhotos([]);
  };

  const handleCoverFileUpload = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = ev => setCoverPhoto(ev.target.result); r.readAsDataURL(f);
  };

  const handleSaveReport = () => {
    const saved = { id: reportData?.id || uid(), title, reportType, reportDate, reportTime, status, coverPhoto, blocks, date: today(), photos: blocks.reduce((a,b)=>a+(b.photos?.length||0),0) };
    onSave(saved);
  };

  const handlePrintOrExport = () => _doPrint();

  const PRINT_DOC_CSS = `
    @page { size: letter portrait; margin: 0; }
    html, body { margin:0; padding:0; background:#fff; }
    body { font-family: 'Inter', system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-root { padding:0; margin:0; }
    .print-root > div { page-break-after: always; break-after: page; }
    .print-root > div:last-child { page-break-after: auto; break-after: auto; }
    .rp-photo-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
    .rp-photo-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
    .rp-photo-grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;}
    .rp-table-wrap{padding:18px 36px 22px;}
    .rp-table-title{font-size:14px;font-weight:800;color:#111;margin-bottom:3px;}
    .rp-table-heading{font-size:11px;color:#888;margin-bottom:10px;line-height:1.5;}
    .rp-table{border-collapse:collapse;table-layout:fixed;width:100%;}
    .rp-table.borders-all td,.rp-table.borders-all th{border:1px solid #d0d0d0;}
    .rp-table.borders-outer{border:1.5px solid #bbb;}
    .rp-table.borders-outer td,.rp-table.borders-outer th{border-bottom:1px solid #e8e8e8;}
    .rp-table.borders-none td,.rp-table.borders-none th{border:none;border-bottom:1px solid #f0f0f0;}
    .rp-table th{font-size:11px;font-weight:700;padding:7px 10px;letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .rp-table td{font-size:12px;padding:7px 10px;vertical-align:top;overflow:hidden;word-break:break-word;}
    .rp-table tr.striped{background:#f9f9f9;}
  `;

  const _doPrint = async () => {
    if (!canExportReports) {
      alert("Your role does not currently have permission to print or export reports.");
      return;
    }
    setPrinting(true);
    await new Promise(resolve => setTimeout(resolve, 80));
    try { await document.fonts?.ready; } catch {}
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const html = printLayerRef.current?.innerHTML;
    if (!html) {
      setPrinting(false);
      alert("Report pages were not ready to print. Please try again.");
      return;
    }

    const win = window.open("", "_blank", "width=980,height=1200");
    if (!win) {
      setPrinting(false);
      alert("Please allow pop-ups to export or print the report.");
      return;
    }

    win.document.open();
    win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title || "Report"}</title>
    <style>${PRINT_DOC_CSS}</style>
  </head>
  <body>
    <div class="print-root">${html}</div>
  </body>
</html>`);
    win.document.close();

    const finalize = () => {
      setPrinting(false);
      win.focus();
      setTimeout(() => {
        win.print();
      }, 250);
    };

    if (win.document.readyState === "complete") finalize();
    else win.onload = finalize;
  };

  const gridClass = colMap[photoLayout] || "rp-photo-grid-3";

  // ── Render ──
  return (
    <>
    <div className="rc-wrap">

      {/* Top bar */}
      <div className="rc-topbar">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>â Back</button>
        <div style={{ width:1,height:20,background:"var(--border)" }} />
        <input value={title} onChange={e=>setTitle(e.target.value)} style={{ background:"transparent",border:"none",outline:"none",fontSize:14,fontWeight:700,color:"var(--text)",flex:1,minWidth:0 }} />
        <div style={{ display:"flex",gap:8,alignItems:"center",marginLeft:"auto" }}>
          <select className="form-input form-select btn-sm" style={{ width:140,padding:"5px 10px",fontSize:12 }} value={status} onChange={e=>setStatus(e.target.value)}>
            {["draft","review","sent","final"].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={()=>setPreviewOpen(true)}><Icon d={ic.eye} size={13} /> Preview</button>
          {settings?.plan === "command" && (
            <button className="btn btn-sm" onClick={() => aiEnabled ? setShowAiOneClick(true) : setShowAiUpgrade(true)}
              title="AI 1-Click Report Generator — Command Plan exclusive"
              style={{ background:"linear-gradient(135deg,#7c3aed,#a855f7)",color:"white",border:"none",display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:7,fontWeight:700,fontSize:13,cursor:"pointer" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
              1 Click
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handlePrintOrExport} disabled={!canExportReports}><Icon d={ic.download} size={13} /> Export PDF</button>
          <button className="btn btn-secondary btn-sm btn-icon" title="Print" onClick={handlePrintOrExport} disabled={!canExportReports}><Icon d={ic.printer} size={13} /></button>
          <button className="btn btn-primary btn-sm" onClick={handleSaveReport}><Icon d={ic.check} size={13} /> Save Report</button>
        </div>
      </div>

      {/* Options bar */}
      <div className="rc-options-bar">
        <span style={{ fontSize:11.5,fontWeight:600,color:"var(--text3)",marginRight:4,whiteSpace:"nowrap" }}>DISPLAY:</span>
        {[
          { label:"GPS Coords",  val:showGps,       set:setShowGps       },
          { label:"Timestamps",  val:showTimestamp,  set:setShowTimestamp  },
          { label:"Room Labels", val:showRooms,      set:setShowRooms      },
          { label:"Photo Tags",  val:showTags,       set:setShowTags       },
          { label:"Cover Info",  val:showCoverInfo,  set:setShowCoverInfo  },
        ].map(t => (
          <div key={t.label} className={`rc-toggle ${t.val?"on":""}`} onClick={()=>t.set(v=>!v)}>
            <div style={{ width:14,height:14,borderRadius:3,background:t.val?"var(--accent)":"var(--surface3)",border:`1.5px solid ${t.val?"var(--accent)":"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              {t.val && <Icon d={ic.check} size={9} stroke="white" strokeWidth={3} />}
            </div>
            {t.label}
          </div>
        ))}
        <div style={{ width:1,height:18,background:"var(--border)",margin:"0 4px" }} />
        <span style={{ fontSize:11.5,fontWeight:600,color:"var(--text3)",whiteSpace:"nowrap" }}>TEMPLATE:</span>
        <select className="form-input form-select" style={{ width:180,padding:"4px 8px",fontSize:12 }}
          value={selectedTpl?.id||""} onChange={e => { const t=templates?.find(t=>t.id===parseInt(e.target.value)); applyTemplate(t); }}>
          <option value="">— None / Custom —</option>
          {(templates||[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div style={{ marginLeft:"auto",display:"flex",gap:8 }}>
        </div>
      </div>

      {/* Body */}
      <div className="rc-body">

        {/* ── Document canvas ── */}
        <div className="rc-canvas" onClick={()=>setSelectedBlock(null)}>

          {/* Cover photo */}
          <div className="rc-section-wrap">
            <div className="rp" style={{ marginBottom:0, borderBottom:"none", minHeight:"auto" }}>

              {/* Report header */}
              <div className="rp-header" style={{ borderBottomColor:accentColor }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:16 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                    {settings?.logo
                      ? <img src={settings.logo} alt="logo" style={{ height:44,width:44,objectFit:"contain",borderRadius:6,background:"#f5f5f5",padding:3 }} />
                      : <div style={{ width:44,height:44,borderRadius:8,background:accentColor,display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:700,fontSize:16 }}>{(settings?.companyName||"SS")[0]}</div>
                    }
                    <div>
                      <div style={{ fontWeight:700,fontSize:15,color:"#111" }}>{settings?.companyName||"Your Company"}</div>
                      <div style={{ fontSize:10.5,color:"#777" }}>{settings?.phone}{settings?.email?` Â· ${settings.email}`:""}</div>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontWeight:700,fontSize:14,color:"#111" }}>{settings?.reportHeaderTitle||"Property Report"}</div>
                    <div style={{ fontSize:10.5,color:"#777" }}>{reportType} Â· {reportDate ? formatDate(reportDate, settings) : formatDate(new Date().toISOString().slice(0,10), settings)}</div>
                    {settings?.reportHeaderNote && <div style={{ fontSize:9.5,color:"#aaa",marginTop:2 }}>{settings.reportHeaderNote}</div>}
                  </div>
                </div>
              </div>

              {/* Cover photo area */}
              <div className="rp-cover" style={{ background:"#e8e8e8",cursor:"pointer" }}
                onClick={e=>{e.stopPropagation(); setPhotoPickerTarget("cover"); setSelectedProjectPhotos([]); setPhotoPickerOpen(true);}}>
                {coverPhoto
                  ? <img src={coverPhoto} alt="cover" />
                  : <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,color:"#aaa" }}>
                      <Icon d={ic.image} size={48} stroke="#ccc" />
                      <div style={{ fontSize:13,fontWeight:600,color:"#bbb" }}>Click to add cover photo</div>
                      <div style={{ fontSize:11,color:"#ccc" }}>Choose from project photos or upload</div>
                    </div>
                }
                {showCoverInfo && (
                  <div className="rp-cover-overlay">
                    <div style={{ fontSize:22,fontWeight:700,color:"white",marginBottom:6,lineHeight:1.2 }}>{title}</div>
                    <div style={{ fontSize:12,color:"rgba(255,255,255,.75)",display:"flex",gap:12,flexWrap:"wrap" }}>
                      {project.address && <span>ð {[project.address,project.city,project.state].filter(Boolean).join(", ")}</span>}
                      {project.clientName && <span>ð¤ {project.clientName}</span>}
                      {project.type && <span>ð· {project.type}</span>}
                    </div>
                  </div>
                )}
                <input ref={coverFileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleCoverFileUpload} />
              </div>

              {/* Property & Client */}
              <div className="rp-section">
                <div className="rp-section-title" style={{ "--sec-color":accentColor }}>Property &amp; Client Information</div>
                <div className="rp-info-grid">
                  {[
                    ["Property Address", [project.address,project.city,project.state,project.zip].filter(Boolean).join(", ")||"—"],
                    ["Property Type",    project.propertyType],
                    ["Project #",        project.projectNumber],
                    ["Client",           project.clientName],
                    ["Client Phone",     project.clientPhone],
                    ["Client Email",     project.clientEmail],
                    ["Relationship",     project.clientRelationship],
                    ["Occupancy Status", project.occupancyStatus],
                    ["Project Type",     project.type],
                    ["Cause of Loss",    project.causeOfLoss],
                  ].filter(([,v])=>v).map(([label,value]) => (
                    <div key={label} className="rp-info-row">
                      <div className="rp-info-label">{label}</div>
                      <div className="rp-info-value">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Dates */}
              {(project.dateInspection||project.dateWorkPerformed||project.dateOfLoss) && (
                <div className="rp-section">
                  <div className="rp-section-title" style={{ "--sec-color":accentColor }}>Key Dates</div>
                  <div className="rp-info-grid">
                    {[
                      ["Date of Inspection",  formatDate(project.dateInspection, settings)],
                      ["Time of Inspection",  formatTime(project.timeInspection, settings)],
                      ["Date Work Performed", formatDate(project.dateWorkPerformed, settings)],
                      ["Time Work Performed", formatTime(project.timeWorkPerformed, settings)],
                      ["Date of Loss",        formatDate(project.dateOfLoss, settings)],
                      ["Report Date",         formatDate(new Date().toISOString().slice(0,10), settings)],
                    ].filter(([,v])=>v).map(([label,value]) => (
                      <div key={label} className="rp-info-row">
                        <div className="rp-info-label">{label}</div>
                        <div className="rp-info-value">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contractor */}
              {project.contractorName && (
                <div className="rp-section">
                  <div className="rp-section-title" style={{ "--sec-color":accentColor }}>Contractor / Inspector</div>
                  <div className="rp-info-grid">
                    {[
                      ["Contractor / Inspector", project.contractorName],
                      ["Phone",                  project.contractorPhone],
                    ].filter(([,v])=>v).map(([label,value]) => (
                      <div key={label} className="rp-info-row">
                        <div className="rp-info-label">{label}</div>
                        <div className="rp-info-value">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Insurance */}
              {project.insuranceEnabled && (project.insuranceCarrier||project.insurancePolicyNum||project.claimNumber||project.adjusterName) && (
                <div className="rp-section">
                  <div className="rp-section-title" style={{ "--sec-color":accentColor }}>Insurance Information</div>
                  <div className="rp-info-grid">
                    {[
                      ["Carrier",         project.insuranceCarrier],
                      ["Policy #",        project.insurancePolicyNum],
                      ["Claim #",         project.claimNumber],
                      ["Coverage Type",   project.coverageType],
                      ["Date of Loss",    project.dateOfLoss],
                      ["Adjuster",        project.adjusterName],
                      ["Adjuster Co.",    project.adjusterCompany],
                      ["Adjuster Phone",  project.adjusterPhone],
                      ["Adjuster Email",  project.adjusterEmail],
                    ].filter(([,v])=>v).map(([label,value]) => (
                      <div key={label} className="rp-info-row">
                        <div className="rp-info-label">{label}</div>
                        <div className="rp-info-value">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Site Conditions */}
              {(project.powerStatus||project.waterStatus||project.accessLimitations||project.ppeItems?.length>0) && (
                <div className="rp-section">
                  <div className="rp-section-title" style={{ "--sec-color":accentColor }}>Site Conditions</div>
                  <div className="rp-info-grid">
                    {[
                      ["Power",              project.powerStatus  ? (project.powerStatus==="on"?"On":project.powerStatus==="off"?"Off":"N/A") : null],
                      ["Water",              project.waterStatus  ? (project.waterStatus==="on"?"On":project.waterStatus==="off"?"Off":"N/A") : null],
                      ["Access Limitations", project.accessLimitations],
                    ].filter(([,v])=>v).map(([label,value]) => (
                      <div key={label} className="rp-info-row">
                        <div className="rp-info-label">{label}</div>
                        <div className="rp-info-value">{value}</div>
                      </div>
                    ))}
                    {project.ppeItems?.length > 0 && (
                      <div className="rp-info-row" style={{ gridColumn:"1/-1" }}>
                        <div className="rp-info-label">PPE Required</div>
                        <div className="rp-info-value" style={{ display:"flex",flexWrap:"wrap",gap:4,marginTop:2 }}>
                          {[...project.ppeItems, project.ppeOtherText].filter(Boolean).map(p => (
                            <span key={p} style={{ fontSize:10.5,padding:"2px 9px",borderRadius:10,background:"#f0f0f0",color:"#333",fontWeight:600,border:"1px solid #ddd" }}>{p}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Page break */}
          <div className="rp-page-break"><div className="rp-page-break-line" /></div>

          {/* Add block at top */}
          <BlockInsertBar prefix="Add at top:"
            onAdd={id=>{const nb={id:uid(),type:id,content:id==="text"?"":undefined,photos:id==="photos"||id==="textphoto"?[]:undefined,files:id==="files"?[]:undefined,label:id==="divider"?"Section":id==="signature"?"Authorized Signature":undefined,sideText:id==="textphoto"?"":undefined,signatureImg:id==="signature"?null:undefined,signerName:id==="signature"?(settings?.userFirstName||"")+" "+(settings?.userLastName||""):undefined,signerTitle:id==="signature"?(settings?.userTitle||""):undefined,sigDate:id==="signature"?formatDate(new Date().toISOString().slice(0,10),settings):undefined,signerCertCodes:id==="signature"?defaultSignerCertCodes:undefined,caption:id==="photos"||id==="sketch"||id==="files"?"":undefined,dataUrl:id==="sketch"?null:undefined,sketchTitle:id==="sketch"?"Sketch / Map":undefined};setBlocks(prev=>[nb,...prev]);setEditingBlock(nb.id);}}
          />

          {/* Content blocks */}
          {blocks.map((block, idx) => (
            <div key={block.id} className="rc-section-wrap">
              <div className="rp" style={{ minHeight:"auto",borderBottom:"1px solid #eee",marginBottom:0 }}>

                {/* DIVIDER block */}
                {block.type==="divider" && (
                  <div className="rp-section" style={{ paddingTop:16,paddingBottom:12 }}>
                    {editingBlock===block.id
                      ? <input autoFocus value={block.label||""} onChange={e=>updateBlock(block.id,{label:e.target.value})} onBlur={()=>setEditingBlock(null)}
                          style={{ fontSize:(block.textStyle?.fontSize||13)+"px",fontWeight:(block.textStyle?.bold??true)?"700":"normal",
                            fontStyle:block.textStyle?.italic?"italic":"normal",
                            textDecoration:block.textStyle?.underline?"underline":"none",
                            textTransform:"uppercase",letterSpacing:".06em",
                            color:block.textStyle?.color||"#444",
                            background:block.textStyle?.highlight?"#ffe066":"transparent",border:"none",borderBottom:"2px solid "+accentColor,outline:"none",width:"100%",padding:"4px 0" }} />
                      : <div className="rp-section-title" style={{ cursor:"text",
                            fontSize:(block.textStyle?.fontSize||13)+"px",
                            fontWeight:(block.textStyle?.bold??true)?"700":"normal",
                            fontStyle:block.textStyle?.italic?"italic":"normal",
                            textDecoration:block.textStyle?.underline?"underline":"none",
                            background:block.textStyle?.highlight?"#ffe066":"transparent",
                            color:block.textStyle?.color||undefined }}
                          onDoubleClick={()=>setEditingBlock(block.id)}>{block.label||"Section"}</div>
                    }
                  </div>
                )}

                {/* TEXT block */}
                {block.type==="text" && (
                  <div className="rp-section">
                    <div style={{ position:"relative" }}>
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        data-block-id={block.id}
                        onFocus={()=>setEditingBlock(block.id)}
                        onBlur={e=>{ updateBlock(block.id,{content:e.currentTarget.innerHTML}); setEditingBlock(null); }}
                        onInput={e=>{/* save on blur only to avoid cursor jump */}}
                        dangerouslySetInnerHTML={{ __html: block.content || "" }}
                        style={{ width:"100%",minHeight:72,outline:"none",cursor:"text",
                          padding:"10px 52px 10px 10px",
                          fontSize:(block.textStyle?.fontSize||12.5)+"px",
                          lineHeight:1.7,
                          fontWeight:block.textStyle?.bold?"bold":"normal",
                          fontStyle:block.textStyle?.italic?"italic":"normal",
                          textDecoration:block.textStyle?.underline?"underline":"none",
                          color:block.textStyle?.color||"#333",
                          background:block.textStyle?.highlight?"#ffe066": editingBlock===block.id ? "#fff" : "#f8f9fa",
                          border: editingBlock===block.id ? "2px solid #2b7fe8" : "1.5px dashed #ccc",
                          borderRadius:6,
                          whiteSpace:"pre-wrap",wordBreak:"break-word",
                          transition:"border-color .15s, background .15s" }}
                      />
                      {!block.content && editingBlock!==block.id && (
                        <div style={{ position:"absolute",top:10,left:10,color:"#aaa",fontSize:(block.textStyle?.fontSize||12.5)+"px",pointerEvents:"none",fontStyle:"italic" }}>Click to type text…</div>
                      )}
                      <button title="â¨ Write with AI" onClick={e=>{e.stopPropagation(); aiEnabled ? setAiWriterBlock(block.id) : setShowAiUpgrade(true);}}
                        style={{ position:"absolute",top:6,right:6,height:32,padding:"0 10px",borderRadius:7,border:"none",background:"linear-gradient(135deg,#2b7fe8,#1a5fc8)",display:"flex",alignItems:"center",justifyContent:"center",gap:5,cursor:"pointer",boxShadow:"0 2px 8px rgba(43,127,232,.45)",transition:"transform .1s,box-shadow .1s",whiteSpace:"nowrap" }}
                        onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.05)";e.currentTarget.style.boxShadow="0 3px 12px rgba(43,127,232,.6)";}}
                        onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="0 2px 8px rgba(43,127,232,.45)";}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                        <span style={{ fontSize:11,fontWeight:700,color:"white" }}>AI Write</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* PHOTOS block */}
                {block.type==="photos" && (
                  <div className="rp-section">
                    {(block.photos||[]).length > 0 ? (
                      <>
                        <div className={gridClass}>
                          {(block.photos||[]).map((ph,pi) => (
                            <div key={pi} className="rp-photo-item">
                              <div style={{ position:"relative" }}>
                                {ph.dataUrl ? <img src={ph.dataUrl} alt={ph.name} /> : <div style={{ aspectRatio:"4/3",background:"#e8e8e8",display:"flex",alignItems:"center",justifyContent:"center",color:"#ccc" }}><Icon d={ic.image} size={28} stroke="#ccc" /></div>}
                                {showTimestamp && ph.date && (
                                  <div style={{ position:"absolute",bottom:4,left:4,background:"rgba(0,0,0,.55)",color:"white",fontSize:7.5,padding:"2px 5px",borderRadius:3,fontFamily:"monospace",letterSpacing:".02em",pointerEvents:"none" }}>ð {ph.date}</div>
                                )}
                              </div>
                              <div className="rp-photo-caption">
                                <div style={{ fontWeight:600 }}>{ph.name||"Photo"}</div>
                                {showTags && (ph.tags||[]).length > 0 && (
                                  <div style={{ display:"flex",flexWrap:"wrap",gap:3,marginTop:2 }}>
                                    {(ph.tags||[]).map(t=>(
                                      <span key={t} style={{ fontSize:7.5,padding:"1px 5px",borderRadius:8,background:"#e8f0fe",color:"#3a6fd8",fontWeight:600 }}>{t}</span>
                                    ))}
                                  </div>
                                )}
                                <div className="rp-photo-meta">
                                  {showRooms && ph.room && <span>ð {ph.room}{ph.floor ? ` Â· ${ph.floor}` : ""}</span>}
                                  {showGps && ph.gps && <span>ð {ph.gps.lat}, {ph.gps.lng}</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop:10,display:"flex",gap:8 }}>
                          <button className="btn btn-secondary btn-sm" onClick={e=>{e.stopPropagation();openPhotoPicker(block.id);}}><Icon d={ic.plus} size={12} /> Add Photos</button>
                          {editingBlock===block.id
                            ? <input autoFocus value={block.caption||""} onChange={e=>updateBlock(block.id,{caption:e.target.value})} onBlur={()=>setEditingBlock(null)} style={{ flex:1,background:"#fafafa",border:"1px solid #ddd",borderRadius:4,padding:"4px 8px",fontSize:11.5,outline:"none" }} placeholder="Add caption…" />
                            : <div style={{ fontSize:11,color:"#aaa",cursor:"text",padding:"4px 0",flex:1 }} onDoubleClick={()=>setEditingBlock(block.id)}>{block.caption||<span>Double-click to add caption</span>}</div>
                          }
                        </div>
                      </>
                    ) : (
                      <div style={{ border:"2px dashed #ddd",borderRadius:8,padding:"28px 20px",textAlign:"center",cursor:"pointer" }} onClick={e=>{e.stopPropagation();openPhotoPicker(block.id);}}>
                        <Icon d={ic.image} size={32} stroke="#ccc" />
                        <div style={{ fontSize:13,color:"#aaa",marginTop:8 }}>Click to add photos from this project</div>
                      </div>
                    )}
                  </div>
                )}

                {block.type==="files" && (
                  <div className="rp-section" style={{ padding:"10px 36px 16px" }}>
                    {editingBlock===block.id
                      ? <input autoFocus value={block.label||""} onChange={e=>updateBlock(block.id,{label:e.target.value})} onBlur={()=>setEditingBlock(null)}
                          style={{ width:"100%",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",background:"transparent",border:"none",borderBottom:"2px solid "+accentColor,outline:"none",padding:"2px 0 6px",color:"#888",marginBottom:10 }} />
                      : <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"#888",marginBottom:10,cursor:"text" }} onDoubleClick={()=>setEditingBlock(block.id)}>{block.label||"Attached Files"}</div>
                    }
                    {(block.files||[]).length > 0 ? (
                      <div style={{ display:"grid",gap:8 }}>
                        {(block.files||[]).map(file => (
                          <div key={file.id || file.name} style={{ border:"1px solid #e8e8e8",borderRadius:8,padding:"10px 12px",background:"#fafafa" }}>
                            <div style={{ display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start" }}>
                              <div style={{ minWidth:0 }}>
                                <div style={{ fontSize:11.5,fontWeight:700,color:"#333",wordBreak:"break-word" }}>{file.name || "Attached File"}</div>
                                <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginTop:5 }}>
                                  <span style={{ fontSize:9,padding:"2px 6px",borderRadius:999,background:"#e8f0fe",color:"#3a6fd8",fontWeight:700 }}>{file.category || "General"}</span>
                                  <span style={{ fontSize:9,padding:"2px 6px",borderRadius:999,background:"#f1f1f1",color:"#666",fontWeight:700 }}>{file.kind || inferProjectFileKind(file)}</span>
                                  {(file.tags || []).map(tag => <span key={tag} style={{ fontSize:9,padding:"2px 6px",borderRadius:999,background:"#f5ecff",color:"#7a4cc2",fontWeight:700 }}>{tag}</span>)}
                                </div>
                              </div>
                              <div style={{ fontSize:10,color:"#888",whiteSpace:"nowrap" }}>{formatFileSizeLabel(file.size || 0)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ border:"2px dashed #ddd",borderRadius:8,padding:"24px 20px",textAlign:"center",color:"#ccc",fontSize:12 }}>
                        No files attached to this report block yet. Use the Files tab on the jobsite to add one directly.
                      </div>
                    )}
                    <div style={{ marginTop:10 }}>
                      {editingBlock===`${block.id}_caption`
                        ? <input autoFocus value={block.caption||""} onChange={e=>updateBlock(block.id,{caption:e.target.value})} onBlur={()=>setEditingBlock(null)}
                            style={{ width:"100%",fontSize:11,color:"#888",background:"transparent",border:"none",borderBottom:"1px dashed #ccc",outline:"none" }}
                            placeholder="Add caption..." />
                        : <div style={{ fontSize:11,color:"#999",cursor:"text",fontStyle:"italic" }} onDoubleClick={()=>setEditingBlock(`${block.id}_caption`)}>{block.caption||"Double-click to add caption"}</div>
                      }
                    </div>
                  </div>
                )}

                {/* TEXT + PHOTO block */}
                {block.type==="textphoto" && (
                  <div className="rp-section">
                    <div className="rp-text-photo">
                      <div>
                        {editingBlock===block.id
                          ? <div style={{ position:"relative" }}>
                              <div
                                contentEditable
                                suppressContentEditableWarning
                                data-block-id={block.id}
                                onFocus={e=>{setEditingBlock(block.id); e.currentTarget.parentElement.querySelector('.tp-placeholder') && (e.currentTarget.parentElement.querySelector('.tp-placeholder').style.display='none');}}
                                onBlur={e=>{ updateBlock(block.id,{sideText:e.currentTarget.innerHTML}); setEditingBlock(null); }}
                                onInput={e=>{ const p=e.currentTarget.parentElement.querySelector('.tp-placeholder'); if(p) p.style.display=e.currentTarget.innerHTML&&e.currentTarget.innerHTML!=='<br>'?'none':'block'; }}
                                dangerouslySetInnerHTML={{ __html: block.sideText||"" }}
                                style={{ width:"100%",minHeight:120,outline:"none",cursor:"text",
                                  fontSize:(block.textStyle?.fontSize||12.5)+"px",lineHeight:1.7,
                                  fontWeight:block.textStyle?.bold?"bold":"normal",fontStyle:block.textStyle?.italic?"italic":"normal",
                                  textDecoration:block.textStyle?.underline?"underline":"none",color:block.textStyle?.color||"inherit",
                                  background:block.textStyle?.highlight?"#ffe066":"transparent",
                                  whiteSpace:"pre-wrap",wordBreak:"break-word" }}
                              />
                              {!block.sideText && (
                                <div className="tp-placeholder" style={{ position:"absolute",top:0,left:0,color:"#ccc",fontSize:(block.textStyle?.fontSize||12.5)+"px",pointerEvents:"none",lineHeight:1.7 }}>Click to edit text...</div>
                              )}
                            </div>
                          : <div className="rp-text-block" style={{ cursor:"text",minHeight:60,
                              fontSize:(block.textStyle?.fontSize||12.5)+"px",
                              fontWeight:block.textStyle?.bold?"bold":"normal",fontStyle:block.textStyle?.italic?"italic":"normal",
                              textDecoration:block.textStyle?.underline?"underline":"none",color:block.textStyle?.color||"inherit",
                              background:block.textStyle?.highlight?"#ffe066":"transparent" }}
                              onClick={()=>setEditingBlock(block.id)}>
                              {block.sideText ? <span dangerouslySetInnerHTML={{ __html: block.sideText }} /> : <span style={{ color:"#ccc" }}>Click to edit text...</span>}
                            </div>
                        }
                      </div>
                      <div>
                        {(block.photos||[]).length > 0
                          ? <div className="rp-photo-item" style={{ cursor:"pointer" }} onClick={e=>{e.stopPropagation();openPhotoPicker(block.id);}}>
                              <div style={{ position:"relative" }}>
                                <img src={block.photos[0].dataUrl} alt={block.photos[0].name} />
                              </div>
                              <div className="rp-photo-caption">
                                <div style={{ fontWeight:600 }}>{block.photos[0].name}</div>
                                {showTags && (block.photos[0].tags||[]).length > 0 && (
                                  <div style={{ display:"flex",flexWrap:"wrap",gap:3,marginTop:2 }}>
                                    {(block.photos[0].tags||[]).map(t=>(
                                      <span key={t} style={{ fontSize:7.5,padding:"1px 5px",borderRadius:8,background:"#e8f0fe",color:"#3a6fd8",fontWeight:600 }}>{t}</span>
                                    ))}
                                  </div>
                                )}
                                <div className="rp-photo-meta">
                                  {showRooms && block.photos[0].room && <span>ð {block.photos[0].room}{block.photos[0].floor ? ` Â· ${block.photos[0].floor}` : ""}</span>}
                                  {showGps && block.photos[0].gps && <span>ð {block.photos[0].gps.lat}</span>}
                                  {showTimestamp && block.photos[0].date && <span>ð {block.photos[0].date}{block.photos[0].time ? ` ${block.photos[0].time}` : ""}</span>}
                                </div>
                              </div>
                            </div>
                          : <div style={{ border:"2px dashed #ddd",borderRadius:6,aspectRatio:"4/3",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexDirection:"column",gap:6 }}
                              onClick={e=>{e.stopPropagation();openPhotoPicker(block.id);}}>
                              <Icon d={ic.image} size={28} stroke="#ccc" />
                              <div style={{ fontSize:11,color:"#ccc" }}>Add photo</div>
                            </div>
                        }
                      </div>
                    </div>
                  </div>
                )}

                {/* SIGNATURE block */}
                {block.type==="signature" && (
                  <div className="rp-section" style={{ padding:"10px 36px 18px" }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:8, maxWidth:340 }}>
                      {/* Label / heading */}
                      {editingBlock===block.id
                        ? <input autoFocus value={block.label||""} onChange={e=>updateBlock(block.id,{label:e.target.value})} onBlur={()=>setEditingBlock(null)}
                            style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",background:"transparent",border:"none",borderBottom:"2px solid "+accentColor,outline:"none",padding:"2px 0",color:"#888",letterSpacing:".06em" }} />
                        : <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"#888",cursor:"text" }} onDoubleClick={()=>setEditingBlock(block.id)}>{block.label||"Authorized Signature"}</div>
                      }
                      {/* Sig image or placeholder */}
                      <div style={{ borderBottom:"1.5px solid #ccc", minHeight:64, display:"flex", alignItems:"flex-end", paddingBottom:4, position:"relative" }}>
                        {block.signatureImg
                          ? <img src={block.signatureImg} alt="Signature" style={{ maxHeight:56, maxWidth:280, objectFit:"contain" }} />
                          : <div style={{ color:"#ccc", fontSize:12, fontStyle:"italic", paddingBottom:4 }}>No signature added</div>
                        }
                      </div>
                      {/* Action buttons */}
                      <div style={{ display:"flex", gap:8, marginTop:4 }}>
                        <button className="btn btn-secondary btn-sm" style={{ fontSize:11 }}
                          onClick={e => { e.stopPropagation(); setSignatureTargetId(block.id); setShowSigModal(true); }}>
                          â {block.signatureImg ? "Replace" : "Add Signature"}
                        </button>
                        {block.signatureImg && (
                          <button className="btn btn-ghost btn-sm" style={{ fontSize:11, color:"var(--text3)" }}
                            onClick={e => { e.stopPropagation(); updateBlock(block.id, { signatureImg: null }); }}>
                            ✕ Remove
                          </button>
                        )}
                      </div>
                      {/* Signer name & title inline edit */}
                      <div style={{ display:"flex", gap:8, marginTop:2 }}>
                        <input value={block.signerName||""} onChange={e=>{
                          const name = e.target.value;
                          const codes = getCertCodesForSigner(name);
                          updateBlock(block.id,{signerName:name, signerCertCodes:codes});
                        }}
                          onClick={e=>e.stopPropagation()}
                          style={{ flex:1,fontSize:11,background:"transparent",border:"none",borderBottom:"1px dashed #ddd",outline:"none",padding:"2px 0",color:"#555" }}
                          placeholder="Signer name" />
                        <input value={block.signerTitle||""} onChange={e=>updateBlock(block.id,{signerTitle:e.target.value})}
                          onClick={e=>e.stopPropagation()}
                          style={{ flex:1,fontSize:11,background:"transparent",border:"none",borderBottom:"1px dashed #ddd",outline:"none",padding:"2px 0",color:"#888" }}
                          placeholder="Title" />
                        <input value={block.sigDate||""} onChange={e=>updateBlock(block.id,{sigDate:e.target.value})}
                          onClick={e=>e.stopPropagation()}
                          style={{ width:90,fontSize:11,background:"transparent",border:"none",borderBottom:"1px dashed #ddd",outline:"none",padding:"2px 0",color:"#aaa" }}
                          placeholder="Date" />
                      </div>
                      {/* Certification codes */}
                      {(block.signerCertCodes||[]).length > 0 && (
                        <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginTop:4 }}>
                          {block.signerCertCodes.map(code => (
                            <span key={code} style={{ fontSize:10,fontWeight:800,padding:"1px 7px",borderRadius:5,background:"var(--surface2)",color:"var(--text2)",border:"1px solid var(--border)",fontFamily:"monospace",letterSpacing:".04em" }}>
                              {code}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* BEFORE & AFTER block */}
                {block.type==="beforeafter" && (() => {
                  const baPairs = project.beforeAfterPairs || [];
                  const pair = baPairs.find(p=>p.id===block.baPairId);
                  const bPhoto = pair ? (project.photos||[]).find(p=>p.id===pair.beforeId) : null;
                  const aPhoto = pair ? (project.photos||[]).find(p=>p.id===pair.afterId) : null;
                  return (
                    <div className="rp-section" style={{ padding:"10px 46px 14px" }}>
                      {/* Pair selector */}
                      <div style={{ marginBottom:10,display:"flex",alignItems:"center",gap:8 }}>
                        <span style={{ fontSize:11,fontWeight:700,color:"#888" }}>Select Pair:</span>
                        <select style={{ flex:1,fontSize:12,padding:"4px 8px",borderRadius:4,border:"1px solid #ddd",background:"#fafafa" }}
                          value={block.baPairId||""}
                          onChange={e=>updateBlock(block.id,{baPairId:e.target.value||null})}
                          onClick={e=>e.stopPropagation()}>
                          <option value="">— Choose a Before &amp; After pair —</option>
                          {baPairs.map(p=><option key={p.id} value={p.id}>{p.name}{p.room?` Â· ${p.room}`:""}</option>)}
                        </select>
                      </div>
                      {pair && bPhoto && aPhoto ? (
                        <>
                          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
                            {[{label:"Before",photo:bPhoto},{label:"After",photo:aPhoto}].map(({label,photo})=>(
                              <div key={label} style={{ borderRadius:6,overflow:"hidden",border:"1px solid #e8e8e8" }}>
                                <div style={{ position:"relative" }}>
                                  {photo?.dataUrl ? <img src={photo.dataUrl} alt={label} style={{ width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block" }} /> : <div style={{ aspectRatio:"4/3",background:"#eee",display:"flex",alignItems:"center",justifyContent:"center",color:"#ccc",fontSize:12 }}>No photo</div>}
                                  <div style={{ position:"absolute",bottom:0,left:0,right:0,padding:"3px 8px",background:"rgba(0,0,0,.55)",fontSize:10,fontWeight:700,color:"white",letterSpacing:".04em",textTransform:"uppercase" }}>{label}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {editingBlock===block.id
                            ? <input autoFocus value={block.caption||""} onChange={e=>updateBlock(block.id,{caption:e.target.value})} onBlur={()=>setEditingBlock(null)}
                                style={{ width:"100%",fontSize:11,color:"#888",background:"transparent",border:"none",borderBottom:"1px dashed #ccc",outline:"none",textAlign:"center" }}
                                placeholder="Add caption…" />
                            : <div style={{ fontSize:11,color:"#bbb",textAlign:"center",cursor:"text",fontStyle:"italic" }} onDoubleClick={()=>setEditingBlock(block.id)}>{block.caption||"Double-click to add caption"}</div>
                          }
                        </>
                      ) : baPairs.length === 0 ? (
                        <div style={{ border:"2px dashed #ddd",borderRadius:8,padding:"20px",textAlign:"center",color:"#bbb",fontSize:12 }}>
                          No Before &amp; After pairs yet. Create them in the Photos tab.
                        </div>
                      ) : (
                        <div style={{ border:"2px dashed #ddd",borderRadius:8,padding:"20px",textAlign:"center",color:"#ccc",fontSize:12 }}>
                          <Icon d={ic.layers} size={28} stroke="#ccc" />
                          <div style={{ marginTop:8 }}>Select a pair above to preview</div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {block.type==="sketch" && (
                  <div className="rp-section" style={{ padding:"10px 36px 14px" }}>
                    {block.dataUrl ? (
                      <div>
                        <img src={block.dataUrl} alt={block.sketchTitle||"Sketch"} style={{ width:"100%",borderRadius:6,border:"1px solid #e8e8e8",display:"block" }} />
                        {editingBlock===block.id
                          ? <input autoFocus value={block.caption||""} onChange={e=>updateBlock(block.id,{caption:e.target.value})} onBlur={()=>setEditingBlock(null)}
                              style={{ width:"100%",marginTop:6,fontSize:11,color:"#888",background:"transparent",border:"none",borderBottom:"1px dashed #ccc",outline:"none",textAlign:"center" }}
                              placeholder="Add caption..." />
                          : <div style={{ fontSize:11,color:"#999",marginTop:6,textAlign:"center",cursor:"text",fontStyle:"italic" }} onDoubleClick={()=>setEditingBlock(block.id)}>{block.caption||"Double-click to add caption"}</div>
                        }
                        <div style={{ display:"flex",gap:8,marginTop:10,justifyContent:"center" }}>
                          <button className="btn btn-secondary btn-sm" style={{ fontSize:11 }} onClick={e=>{ e.stopPropagation(); updateBlock(block.id,{dataUrl:null}); }}>
                            ✕ Remove Image
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ border:"2px dashed #ccc",borderRadius:8,padding:"30px 20px",textAlign:"center",color:"#aaa" }}>
                        <Icon d={ic.sketch} size={32} stroke="#ccc" />
                        <div style={{ fontSize:13,marginTop:8,marginBottom:12 }}>No sketch attached</div>
                        <div style={{ fontSize:11.5,color:"#bbb",marginBottom:12 }}>Go to the Sketches tab to create a sketch, then use "Add to Report" to attach it here.</div>
                      </div>
                    )}
                  </div>
                )}

                {/* TABLE block */}
                {block.type==="table" && (() => {
                  const rows      = block.tableRows      || [["Col A","Col B","Col C"],["","",""]];
                  const colWidths = block.tableColWidths || rows[0].map(()=>150);
                  const colAligns = block.tableColAligns || rows[0].map(()=>"left");
                  const hasHeader = block.tableHasHeader !== false;
                  const headerBg  = block.tableHeaderBg  || accentColor;
                  const headerCol = block.tableHeaderColor|| "#ffffff";
                  const striped   = block.tableStriped   !== false;
                  const borders   = block.tableBorders   || "all";
                  const isActive  = editingBlock === block.id;

                  const setRows = (r) => updateBlock(block.id,{tableRows:r});
                  const setCellVal = (ri,ci,val) => {
                    const next = rows.map((row,r)=>r===ri?row.map((c,cc)=>cc===ci?val:c):row);
                    setRows(next);
                  };
                  const addRow = () => setRows([...rows, rows[0].map(()=>"")]);
                  const deleteRow = (ri) => { if(rows.length>1) setRows(rows.filter((_,r)=>r!==ri)); };
                  const addCol = () => {
                    updateBlock(block.id,{
                      tableRows: rows.map(r=>[...r,""]),
                      tableColWidths:[...colWidths,140],
                      tableColAligns:[...colAligns,"left"],
                    });
                  };
                  const deleteCol = (ci) => {
                    if(colWidths.length<=1) return;
                    updateBlock(block.id,{
                      tableRows: rows.map(r=>r.filter((_,c)=>c!==ci)),
                      tableColWidths: colWidths.filter((_,c)=>c!==ci),
                      tableColAligns: colAligns.filter((_,c)=>c!==ci),
                    });
                  };
                  const setAlign = (ci,align) => {
                    const next=[...colAligns]; next[ci]=align;
                    updateBlock(block.id,{tableColAligns:next});
                  };
                  const setColWidth = (ci,w) => {
                    const next=[...colWidths]; next[ci]=Math.max(60,parseInt(w)||100);
                    updateBlock(block.id,{tableColWidths:next});
                  };

                  return (
                    <div onClick={()=>setEditingBlock(block.id)}>
                      {/* ── Toolbar (only when active) ── */}
                      {isActive && (
                        <div className="tbl-toolbar" onClick={e=>e.stopPropagation()}>
                          {/* Title & heading toggles */}
                          <span style={{fontSize:10,fontWeight:700,color:"var(--text3)",marginRight:2}}>TITLE</span>
                          <input value={block.tableTitle||""} onChange={e=>updateBlock(block.id,{tableTitle:e.target.value})}
                            placeholder="Table title..."
                            style={{fontSize:12,fontWeight:700,background:"var(--surface3)",border:"1px solid var(--border)",borderRadius:4,padding:"2px 7px",outline:"none",width:140,color:"var(--text)"}} />
                          <div style={{width:1,height:16,background:"var(--border)",margin:"0 4px"}}/>
                          <span style={{fontSize:10,fontWeight:700,color:"var(--text3)",marginRight:2}}>SUBTITLE</span>
                          <input value={block.tableHeading||""} onChange={e=>updateBlock(block.id,{tableHeading:e.target.value})}
                            placeholder="Optional subtitle..."
                            style={{fontSize:11,background:"var(--surface3)",border:"1px solid var(--border)",borderRadius:4,padding:"2px 7px",outline:"none",width:160,color:"var(--text)"}} />
                          <div style={{width:1,height:16,background:"var(--border)",margin:"0 4px"}}/>

                          {/* Header row toggle */}
                          <button title="Toggle header row" onClick={()=>updateBlock(block.id,{tableHasHeader:!hasHeader})}
                            style={{padding:"2px 8px",borderRadius:4,border:`1px solid ${hasHeader?"var(--accent)":"var(--border)"}`,background:hasHeader?"var(--accent-glow)":"transparent",fontSize:11,fontWeight:600,cursor:"pointer",color:hasHeader?"var(--accent)":"var(--text2)"}}>
                            Header row
                          </button>

                          {/* Striped toggle */}
                          <button title="Toggle striped rows" onClick={()=>updateBlock(block.id,{tableStriped:!striped})}
                            style={{padding:"2px 8px",borderRadius:4,border:`1px solid ${striped?"var(--accent)":"var(--border)"}`,background:striped?"var(--accent-glow)":"transparent",fontSize:11,fontWeight:600,cursor:"pointer",color:striped?"var(--accent)":"var(--text2)"}}>
                            Striped
                          </button>

                          {/* Border style */}
                          <div style={{display:"flex",borderRadius:4,overflow:"hidden",border:"1px solid var(--border)"}}>
                            {[["all","All"],["outer","Outer"],["none","None"]].map(([v,l])=>(
                              <button key={v} onClick={()=>updateBlock(block.id,{tableBorders:v})}
                                style={{padding:"2px 8px",border:"none",borderRight:v!=="none"?"1px solid var(--border)":"none",background:borders===v?"var(--accent)":"var(--surface3)",color:borders===v?"white":"var(--text2)",fontSize:11,cursor:"pointer",fontWeight:600}}>
                                {l}
                              </button>
                            ))}
                          </div>

                          {/* Header color picker */}
                          {hasHeader && (
                            <>
                              <div style={{width:1,height:16,background:"var(--border)",margin:"0 2px"}}/>
                              <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"var(--text2)",cursor:"pointer"}}>
                                <span>Header</span>
                                <input type="color" value={headerBg} onChange={e=>updateBlock(block.id,{tableHeaderBg:e.target.value})}
                                  style={{width:22,height:22,border:"none",borderRadius:4,cursor:"pointer",padding:1}} />
                              </label>
                              <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"var(--text2)",cursor:"pointer"}}>
                                <span>Text</span>
                                <input type="color" value={headerCol} onChange={e=>updateBlock(block.id,{tableHeaderColor:e.target.value})}
                                  style={{width:22,height:22,border:"none",borderRadius:4,cursor:"pointer",padding:1}} />
                              </label>
                            </>
                          )}

                          <div style={{flex:1}}/>
                          {/* Add row / col */}
                          <button onClick={addRow} title="Add row"
                            style={{padding:"2px 9px",borderRadius:4,border:"1px solid var(--border)",background:"var(--surface3)",fontSize:11,fontWeight:700,cursor:"pointer",color:"var(--text2)",gap:4,display:"flex",alignItems:"center"}}>
                            + Row
                          </button>
                          <button onClick={addCol} title="Add column"
                            style={{padding:"2px 9px",borderRadius:4,border:"1px solid var(--border)",background:"var(--surface3)",fontSize:11,fontWeight:700,cursor:"pointer",color:"var(--text2)"}}>
                            + Col
                          </button>
                        </div>
                      )}

                      {/* ── Table itself ── */}
                      <div style={{padding:"18px 24px 22px",overflowX:"auto"}} onClick={e=>e.stopPropagation()}>
                        {/* Title + heading (view mode only; editing happens in toolbar) */}
                        {!isActive && (block.tableTitle || block.tableHeading) && (
                          <div style={{marginBottom:10}}>
                            {block.tableTitle && <div style={{fontSize:14,fontWeight:800,color:"#111",marginBottom:block.tableHeading?2:0}}>{block.tableTitle}</div>}
                            {block.tableHeading && <div style={{fontSize:11,color:"#888",lineHeight:1.5}}>{block.tableHeading}</div>}
                          </div>
                        )}
                        {/* Title + heading preview while editing */}
                        {isActive && (block.tableTitle || block.tableHeading) && (
                          <div style={{marginBottom:10}}>
                            {block.tableTitle && <div style={{fontSize:14,fontWeight:800,color:"#111",marginBottom:block.tableHeading?2:0}}>{block.tableTitle}</div>}
                            {block.tableHeading && <div style={{fontSize:11,color:"#888",lineHeight:1.5}}>{block.tableHeading}</div>}
                          </div>
                        )}

                        <table style={{borderCollapse:"collapse",tableLayout:"fixed",width:"100%"}}>
                          <colgroup>
                            {colWidths.map((w,ci)=><col key={ci} style={{width:w}} />)}
                            {isActive && <col style={{width:28}} />}
                          </colgroup>

                          {/* Column controls row */}
                          {isActive && (
                            <thead>
                              <tr>
                                {colWidths.map((w,ci)=>(
                                  <th key={ci} style={{padding:"4px 4px 2px",background:"var(--surface2)",border:"1px solid var(--border)",verticalAlign:"middle"}}>
                                    <div style={{display:"flex",alignItems:"center",gap:2,justifyContent:"center",flexWrap:"nowrap"}}>
                                      {/* Align buttons */}
                                      {[["left","M3 6h18 M3 12h12 M3 18h15"],["center","M3 6h18 M6 12h12 M4 18h16"],["right","M3 6h18 M9 12h12 M6 18h15"]].map(([a,d])=>(
                                        <button key={a} onClick={()=>setAlign(ci,a)} title={a+" align"}
                                          style={{padding:"1px 3px",border:"none",borderRadius:3,background:colAligns[ci]===a?"var(--accent)":"transparent",cursor:"pointer"}}>
                                          <Icon d={d} size={11} stroke={colAligns[ci]===a?"white":"var(--text3)"} />
                                        </button>
                                      ))}
                                      {/* Width input */}
                                      <input type="number" value={w} onChange={e=>setColWidth(ci,e.target.value)}
                                        style={{width:40,fontSize:10,textAlign:"center",background:"var(--surface3)",border:"1px solid var(--border)",borderRadius:3,padding:"1px 3px",outline:"none",color:"var(--text)"}} />
                                      <span style={{fontSize:9,color:"var(--text3)"}}>px</span>
                                      {/* Delete col */}
                                      {colWidths.length > 1 && (
                                        <button onClick={()=>deleteCol(ci)} title="Delete column"
                                          style={{padding:"1px 3px",border:"none",borderRadius:3,background:"transparent",cursor:"pointer",color:"#e85a3a",fontSize:12,lineHeight:1}}>Ã</button>
                                      )}
                                    </div>
                                  </th>
                                ))}
                                <th style={{padding:0,background:"var(--surface2)",border:"1px solid var(--border)",width:28}}/>
                              </tr>
                            </thead>
                          )}

                          <tbody>
                            {rows.map((row, ri) => {
                              const isHeaderRow = hasHeader && ri === 0;
                              const isStriped = striped && !isHeaderRow && ri % 2 === 1;
                              return (
                                <tr key={ri} style={{background: isHeaderRow ? headerBg : isStriped ? "#f9f9f9" : "white"}}>
                                  {row.map((cell, ci) => {
                                    const cellStyle = {
                                      padding: isActive ? "2px 3px" : "7px 10px",
                                      textAlign: colAligns[ci]||"left",
                                      fontSize: isHeaderRow ? 11 : 12,
                                      fontWeight: isHeaderRow ? 700 : 400,
                                      color: isHeaderRow ? headerCol : "#222",
                                      letterSpacing: isHeaderRow ? ".03em" : "normal",
                                      border: borders==="all" ? "1px solid #d0d0d0" :
                                              borders==="outer" ? (ri===0?"1px solid #bbb":"0 0 1px 0 solid #e8e8e8") :
                                              "0 0 1px 0 solid #f0f0f0",
                                      borderBottom: borders!=="none" ? "1px solid #e8e8e8" : "none",
                                      wordBreak:"break-word",
                                      verticalAlign:"top",
                                    };
                                    return isActive
                                      ? <td key={ci} style={{...cellStyle,padding:0,border:"1px solid var(--border)"}}>
                                          <textarea
                                            value={cell}
                                            onChange={e=>setCellVal(ri,ci,e.target.value)}
                                            rows={1}
                                            style={{
                                              width:"100%",height:"100%",minHeight:32,resize:"none",
                                              background: isHeaderRow ? headerBg : isStriped ? "#f9f9f9" : "white",
                                              border:"none",outline:"2px solid transparent",
                                              padding:"5px 7px",
                                              fontSize: isHeaderRow?11:12,
                                              fontWeight: isHeaderRow?700:400,
                                              color: isHeaderRow ? headerCol : "#222",
                                              textAlign: colAligns[ci]||"left",
                                              fontFamily:"inherit",
                                              transition:"outline .1s",
                                              boxSizing:"border-box",
                                            }}
                                            onFocus={e=>{e.target.style.outline="2px solid "+accentColor+"88";e.target.rows=Math.max(2,e.target.value.split("\n").length);}}
                                            onBlur={e=>{e.target.style.outline="2px solid transparent";e.target.rows=1;}}
                                          />
                                        </td>
                                      : <td key={ci} style={cellStyle}>{cell}</td>;
                                  })}
                                  {/* Row delete button when editing */}
                                  {isActive && (
                                    <td style={{padding:"0 2px",border:"1px solid var(--border)",background:"var(--surface2)",textAlign:"center",verticalAlign:"middle",width:24}}>
                                      {rows.length > 1 && (
                                        <button onClick={()=>deleteRow(ri)} title="Delete row"
                                          style={{border:"none",background:"transparent",cursor:"pointer",color:"#e85a3a",fontSize:14,lineHeight:1,padding:"0 2px"}}>Ã</button>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {!isActive && (
                          <div style={{marginTop:6,fontSize:10.5,color:"#bbb",fontStyle:"italic",cursor:"pointer"}} onClick={()=>setEditingBlock(block.id)}>
                            Click to edit table
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

              </div>
              {/* Inline block action bar */}
              <BlockInsertBar
                onAdd={id=>{addBlock(id,block.id);}}
                extraLeft={<>
                  <button className="btn btn-ghost btn-sm btn-icon" title="Move Up" onClick={e=>{e.stopPropagation();moveBlock(block.id,-1);}} style={{ opacity:idx===0?.3:1,padding:"2px 5px",flexShrink:0 }}><Icon d="M12 19V5 M5 12l7-7 7 7" size={13} /></button>
                  <button className="btn btn-ghost btn-sm btn-icon" title="Move Down" onClick={e=>{e.stopPropagation();moveBlock(block.id,1);}} style={{ opacity:idx===blocks.length-1?.3:1,padding:"2px 5px",flexShrink:0 }}><Icon d="M12 5v14 M19 12l-7 7-7-7" size={13} /></button>
                  <div style={{ width:1,height:14,background:"var(--border)",margin:"0 3px",flexShrink:0 }} />
                </>}
                extraRight={<>
                  <div style={{ width:1,height:14,background:"var(--border)",margin:"0 3px",flexShrink:0 }} />
                  <button className="btn btn-ghost btn-sm btn-icon" title="Delete block" onClick={e=>{e.stopPropagation();deleteBlock(block.id);}} style={{ color:"#e85a3a",padding:"2px 5px",flexShrink:0 }}><Icon d={ic.trash} size={13} /></button>
                </>}
              />
              {/* Text formatting toolbar — only for text/textphoto blocks */}
              {(block.type==="text"||block.type==="textphoto"||block.type==="divider") && (() => {
                const ts = block.textStyle || {};
                const contentField = block.type==="text" ? "content" : block.type==="textphoto" ? "sideText" : "label";

                // execCommand on current selection; if no selection falls back to block-level toggle
                const fmt = (cmd, value) => {
                  const isDivider = block.type === "divider";
                  const sel = window.getSelection();
                  const hasSelection = !isDivider && sel && sel.toString().length > 0;
                  if (hasSelection) {
                    // Apply to selection — focus is preserved by onMouseDown preventDefault
                    document.execCommand(cmd, false, value || null);
                    // Persist HTML after execCommand modifies the DOM
                    const el = document.querySelector(`[data-block-id="${block.id}"]`);
                    if (el) updateBlock(block.id, { [contentField]: el.innerHTML });
                  } else {
                    // No selection (or divider) — toggle block-level style
                    const defaultBold = isDivider ? true : false;
                    const patch = {
                      bold:      cmd==="bold"      ? !(ts.bold??defaultBold) : (ts.bold??defaultBold),
                      italic:    cmd==="italic"    ? !ts.italic    : ts.italic,
                      underline: cmd==="underline" ? !ts.underline : ts.underline,
                      highlight: cmd==="highlight" ? !ts.highlight : ts.highlight,
                    };
                    updateBlock(block.id, { textStyle:{ ...ts, ...patch } });
                  }
                };

                const fmtColor = (color) => {
                  const isDivider = block.type === "divider";
                  const sel = window.getSelection();
                  if (!isDivider && sel && sel.toString().length > 0) {
                    document.execCommand("foreColor", false, color);
                    const el = document.querySelector(`[data-block-id="${block.id}"]`);
                    if (el) updateBlock(block.id, { [contentField]: el.innerHTML });
                  } else {
                    updateBlock(block.id, { textStyle:{ ...ts, color } });
                  }
                };

                const fmtHighlight = () => {
                  const isDivider = block.type === "divider";
                  const sel = window.getSelection();
                  if (!isDivider && sel && sel.toString().length > 0) {
                    document.execCommand("hiliteColor", false, ts.highlight ? "transparent" : "#ffe066");
                    const el = document.querySelector(`[data-block-id="${block.id}"]`);
                    if (el) updateBlock(block.id, { [contentField]: el.innerHTML });
                  } else {
                    updateBlock(block.id, { textStyle:{ ...ts, highlight:!ts.highlight } });
                  }
                };

                const togBtn = (active, title, children, onClick) => (
                  <button title={title} onMouseDown={e=>{e.preventDefault();onClick();}}
                    style={{ background:active?"var(--accent)":"transparent",color:active?"white":"var(--text2)",
                      border:`1px solid ${active?"var(--accent)":"var(--border)"}`,
                      borderRadius:4,padding:"1px 5px",fontSize:11,fontWeight:700,cursor:"pointer",lineHeight:"18px",flexShrink:0 }}>
                    {children}
                  </button>
                );

                return (
                  <div style={{ display:"flex",alignItems:"center",gap:4,padding:"3px 8px",background:"var(--surface3)",borderBottom:"1px solid var(--border)",flexWrap:"wrap" }}>
                    <span style={{ fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",marginRight:2,flexShrink:0 }}>Format:</span>
                    {togBtn(ts.bold??(block.type==="divider"?true:false), "Bold (or select text first)", <b>B</b>, ()=>fmt("bold"))}
                    {togBtn(ts.italic,    "Italic (or select text first)",    <i>I</i>,          ()=>fmt("italic"))}
                    {togBtn(ts.underline, "Underline (or select text first)", <u>U</u>,          ()=>fmt("underline"))}
                    {togBtn(ts.highlight, "Highlight (or select text first)", <span style={{ background:"#ffe066",color:"#333",padding:"0 2px" }}>H</span>, fmtHighlight)}
                    <div style={{ width:1,height:14,background:"var(--border)",flexShrink:0 }} />
                    <span style={{ fontSize:10,color:"var(--text3)",flexShrink:0 }}>Size:</span>
                    <input type="number" min="8" max="20" step="1"
                      value={ts.fontSize||12}
                      onChange={e=>updateBlock(block.id,{ textStyle:{ ...ts, fontSize:Math.min(20,Math.max(8,parseInt(e.target.value)||12)) } })}
                      onClick={e=>e.stopPropagation()}
                      style={{ width:42,padding:"1px 4px",fontSize:11,textAlign:"center",border:"1px solid var(--border)",borderRadius:4,background:"var(--surface)",color:"var(--text)",flexShrink:0 }} />
                    <span style={{ fontSize:10,color:"var(--text3)",flexShrink:0 }}>pt</span>
                    <div style={{ width:1,height:14,background:"var(--border)",flexShrink:0 }} />
                    <span style={{ fontSize:10,color:"var(--text3)",flexShrink:0 }}>Color:</span>
                    {["#222222","#e85a3a","#2b7fe8","#3dba7e","#e8c53a","#8b7cf8","#888888"].map(c=>(
                      <div key={c} onMouseDown={e=>{e.preventDefault();fmtColor(c);}}
                        style={{ width:14,height:14,borderRadius:"50%",background:c,cursor:"pointer",flexShrink:0,
                          boxShadow:ts.color===c?"0 0 0 2px white,0 0 0 3.5px var(--accent)":"0 0 0 1px rgba(0,0,0,.15)",
                          transition:"box-shadow .15s" }} />
                    ))}
                    <label title="Custom color" style={{ position:"relative",cursor:"pointer",flexShrink:0 }}>
                      <div style={{ width:14,height:14,borderRadius:"50%",background:"conic-gradient(red,yellow,lime,cyan,blue,magenta,red)",boxShadow:"0 0 0 1px rgba(0,0,0,.15)" }} />
                      <input type="color" value={ts.color||"#222222"} onChange={e=>fmtColor(e.target.value)}
                        style={{ position:"absolute",opacity:0,width:0,height:0,pointerEvents:"none" }} />
                    </label>
                  </div>
                );
              })()}
            </div>
          ))}

          {/* Add block to end */}
          <div style={{ display:"flex",justifyContent:"center",padding:"16px 0 8px" }}>
            <button className="btn btn-secondary btn-sm" style={{ gap:6,fontSize:12,opacity:.7 }}
              onClick={()=>addBlock("text", blocks[blocks.length-1]?.id)}>
              <Icon d="M12 5v14 M5 12h14" size={13} /> Add Block
            </button>
          </div>

          {/* Final page footer */}
          <div className="rc-section-wrap">
            <div className="rp" style={{ minHeight:"auto",marginBottom:32 }}>
              <div className="rp-footer" style={{ borderTopColor:accentColor }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <span style={{ fontSize:10,color:"#888" }}>{formatDate(reportDate || new Date().toISOString().slice(0,10), settings)}</span>
                  {reportTime && <span style={{ fontSize:10,color:"#aaa" }}>Â· {formatTime(reportTime, settings)}</span>}
                </div>
                <span style={{ color:accentColor,fontWeight:600 }}>{settings?.reportFooterCenter || "Confidential"}</span>
                <div style={{ textAlign:"right" }}>
                  <div className="rp-branding">POWERED BY KRAKENCAM</div>
                  <div style={{ fontSize:9.5,color:"#aaa" }}>Page 1</div>
                </div>
              </div>
              {settings?.reportFooterDisclaimer && (
                <div style={{ padding:"10px 36px",fontSize:9.5,color:"#bbb",lineHeight:1.6,background:"#fafafa",borderTop:"1px solid #eee" }}>{settings.reportFooterDisclaimer}</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="rc-sidebar">
          <div className="rc-sidebar-section">
            <div className="rc-sidebar-title">Report Details</div>
            <div className="form-group"><label className="form-label" style={{ color:"#8b9ab8" }}>Report Type</label>
              <select className="form-input form-select" style={{ fontSize:12.5 }} value={reportType} onChange={e=>setReportType(e.target.value)}>
                {["Assessment","Inspection","Quote","Progress Update","Damage Assessment","Insurance Report","Other"].map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label" style={{ color:"#8b9ab8" }}>Report Date</label>
              <div className="date-input-wrap">
                <input type="date" className="form-input" style={{ fontSize:12.5 }} value={reportDate} onChange={e=>setReportDate(e.target.value)} />
                <span className="date-icon"><Icon d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" size={18} stroke="var(--accent)" strokeWidth={2} /></span>
              </div>
            </div>
            <div className="form-group">
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5 }}>
                <label className="form-label" style={{ color:"#8b9ab8",marginBottom:0 }}>Report Time</label>
                {reportTime && (
                  <button onClick={() => setReportTime("")}
                    style={{ fontSize:11,color:"var(--text3)",background:"none",border:"none",cursor:"pointer",padding:"0 2px",lineHeight:1 }}>
                    ✕ Remove
                  </button>
                )}
              </div>
              <input type="time" className="form-input" style={{ fontSize:12.5,colorScheme:"dark" }}
                value={reportTime} onChange={e => setReportTime(e.target.value)} />
            </div>
            <div className="form-group"><label className="form-label" style={{ color:"#8b9ab8" }}>Status</label>
              <select className="form-input form-select" style={{ fontSize:12.5 }} value={status} onChange={e=>setStatus(e.target.value)}>
                {["draft","review","sent","final"].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="rc-sidebar-section">
            <div className="rc-sidebar-title">Cover Photo</div>
            <div style={{ border:"2px dashed var(--border)",borderRadius:8,aspectRatio:"4/3",overflow:"hidden",cursor:"pointer",background:"var(--surface2)",position:"relative",marginBottom:8 }}
              onClick={()=>{ setPhotoPickerTarget("cover"); setSelectedProjectPhotos([]); setPhotoPickerOpen(true); }}>
              {coverPhoto ? <img src={coverPhoto} alt="cover" style={{ width:"100%",height:"100%",objectFit:"cover" }} /> : (
                <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:6,color:"var(--text3)" }}>
                  <Icon d={ic.image} size={24} /><div style={{ fontSize:11 }}>Add cover photo</div>
                </div>
              )}
            </div>
            {coverPhoto && <button className="btn btn-ghost btn-sm" style={{ width:"100%",justifyContent:"center",fontSize:12 }} onClick={()=>setCoverPhoto(null)}><Icon d={ic.trash} size={12} /> Remove</button>}
          </div>

          <div className="rc-sidebar-section">
            <div className="rc-sidebar-title">Project Photos</div>
            <div style={{ fontSize:11.5,color:"var(--text2)",marginBottom:8 }}>{project.photos?.length||0} photos available</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:5 }}>
              {(project.photos||[]).slice(0,9).map(ph => (
                <div key={ph.id} style={{ width:56,height:56,borderRadius:6,overflow:"hidden",cursor:"pointer",border:"1px solid var(--border)",background:"var(--surface2)" }}
                  title={ph.name} onClick={()=>{ setPhotoPickerTarget(selectedBlock || (blocks[blocks.length-1]?.id)); setSelectedProjectPhotos([]); setPhotoPickerOpen(true); }}>
                  {ph.dataUrl ? <img src={ph.dataUrl} style={{ width:"100%",height:"100%",objectFit:"cover" }} /> : <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={ic.image} size={16} stroke="var(--text3)" /></div>}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Print layer — hidden normally, shown via @media print ── */}
      <div ref={printLayerRef} className={printing ? "print-layer print-layer--active" : "print-layer"}>
        <ReportPages
          title={title} reportType={reportType} reportDate={reportDate} reportTime={reportTime} accentColor={accentColor}
          project={project} coverPhoto={coverPhoto} blocks={blocks}
          settings={settings} showCoverInfo={showCoverInfo}
          showGps={showGps} showTimestamp={showTimestamp} showRooms={showRooms} showTags={showTags}
          gridClass={gridClass} forPrint={true}
        />
      </div>

    </div>{/* end rc-wrap */}

    {/* ── Modals rendered OUTSIDE rc-wrap so position:fixed isn't clipped ── */}
      {/* ── Preview modal ── */}
      {previewOpen && (
        <div style={{ position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,.9)",display:"flex",flexDirection:"column",overflow:"hidden" }}>
          {/* Preview top bar */}
          <div style={{ height:52,background:"#0d1017",borderBottom:"1px solid #2a2f3e",display:"flex",alignItems:"center",padding:"0 16px",gap:10,flexShrink:0,flexWrap:"wrap" }}>
            <div style={{ fontWeight:700,fontSize:14,color:"white",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>Print Preview — {title}</div>
            <div style={{ fontSize:11,color:"#888",background:"#1a1e28",padding:"3px 10px",borderRadius:20,border:"1px solid #2a2f3e",flexShrink:0 }}>8.5â³ Ã 11â³</div>
            <button className="btn btn-secondary btn-sm" onClick={()=>_doPrint()} style={{ flexShrink:0 }} disabled={!canExportReports}><Icon d={ic.download} size={13} /> Export PDF</button>
            <button className="btn btn-secondary btn-sm btn-icon" title="Print" onClick={()=>_doPrint()} style={{ flexShrink:0 }} disabled={!canExportReports}><Icon d={ic.printer} size={13} /></button>
            <button className="btn btn-ghost btn-sm" style={{ color:"white",flexShrink:0 }} onClick={()=>setPreviewOpen(false)}>
              <Icon d={ic.close} size={15} /> Close
            </button>
          </div>

          {/* Preview scroll area */}
          <div style={{ flex:1,overflow:"auto",background:"#111318",padding:"32px 16px",boxSizing:"border-box" }}>
            {/* ScaledPages: uses CSS zoom so the layout box shrinks with the visual */}
            <ScaledReportPreview
              title={title} reportType={reportType} reportDate={reportDate} reportTime={reportTime} accentColor={accentColor}
              project={project} coverPhoto={coverPhoto} blocks={blocks}
              settings={settings} showCoverInfo={showCoverInfo}
              showGps={showGps} showTimestamp={showTimestamp} showRooms={showRooms} showTags={showTags}
              gridClass={gridClass}
            />
          </div>
        </div>
      )}

      {/* Photo picker modal */}
      {photoPickerOpen && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setPhotoPickerOpen(false)}>
          <div className="modal modal-lg fade-in" style={{ maxWidth:700 }}>
            <div className="modal-header">
              <div className="modal-title">Select Photos from Project</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>setPhotoPickerOpen(false)}><Icon d={ic.close} size={16} /></button>
            </div>
            <div className="modal-body">
              {(project.photos||[]).length === 0 ? (
                <div className="empty" style={{ padding:"32px 0" }}>
                  <div className="empty-icon"><Icon d={ic.camera} size={28} stroke="var(--text3)" /></div>
                  <h3>No photos in this project</h3>
                  <p>Go capture some photos first, then come back to add them to the report.</p>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:12.5,color:"var(--text2)",marginBottom:14 }}>
                    Click photos to select. {selectedProjectPhotos.length > 0 && <strong style={{ color:"var(--accent)" }}>{selectedProjectPhotos.length} selected</strong>}
                  </div>
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,maxHeight:360,overflowY:"auto" }}>
                    {(project.photos||[]).map(ph => {
                      const isSel = selectedProjectPhotos.some(s=>s.id===ph.id);
                      return (
                        <div key={ph.id} onClick={() => setSelectedProjectPhotos(prev => isSel ? prev.filter(s=>s.id!==ph.id) : photoPickerTarget==="cover" ? [ph] : [...prev,ph])}
                          style={{ borderRadius:8,overflow:"hidden",cursor:"pointer",border:`2px solid ${isSel?"var(--accent)":"var(--border)"}`,position:"relative",transition:"border-color .15s" }}>
                          {ph.dataUrl ? <img src={ph.dataUrl} style={{ width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block" }} /> : <div style={{ aspectRatio:"4/3",background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={ic.image} size={24} stroke="var(--text3)" /></div>}
                          {isSel && <div style={{ position:"absolute",top:5,right:5,width:20,height:20,borderRadius:"50%",background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={ic.check} size={11} stroke="white" strokeWidth={3} /></div>}
                          <div style={{ padding:"5px 7px",fontSize:10,color:"var(--text2)",background:"var(--surface)",borderTop:"1px solid var(--border)" }}>{ph.room} Â· {ph.name?.slice(0,22)}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setPhotoPickerOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmPhotoPicker} disabled={selectedProjectPhotos.length===0}>
                <Icon d={ic.check} size={14} /> Add {selectedProjectPhotos.length > 0 ? selectedProjectPhotos.length : ""} Photo{selectedProjectPhotos.length!==1?"s":""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature draw/upload modal */}
      {showSigModal && (
        <SignatureDrawModal
          onSave={dataUrl => {
            if (signatureTargetId) updateBlock(signatureTargetId, { signatureImg: dataUrl });
          }}
          onClose={() => { setShowSigModal(false); setSignatureTargetId(null); }}
        />
      )}

      {/* AI 1-Click modal */}
      {showAiOneClick && (
        <AiOneClickModal
          project={project}
          settings={settings}
          onGenerate={(text) => {
            const parsed = parseAiOutputToBlocks(text);
            setBlocks(parsed.length > 0 ? parsed : [{ id: uid(), type: "text", content: text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>") }]);
            setShowAiOneClick(false);
          }}
          onClose={() => setShowAiOneClick(false)}
          onUsageIncrement={(krakens) => {
            if (!onSettingsChange) return;
            const curWin2 = getWeekWindowStart();
            const wStart2 = settings?.aiGenerationsWindowStart ? new Date(settings.aiGenerationsWindowStart) : null;
            const valid2 = wStart2 && wStart2 >= curWin2;
            const used2  = valid2 ? (settings?.aiGenerationsUsed || 0) : 0;
            onSettingsChange(prev => ({ ...prev, aiGenerationsUsed: used2 + krakens, aiGenerationsWindowStart: valid2 ? prev.aiGenerationsWindowStart : curWin2.toISOString() }));
          }}
        />
      )}

      {/* AI Writer modal */}
      {aiWriterBlock && (
        <AiWriterModal
          block={blocks.find(b=>b.id===aiWriterBlock)}
          project={project}
          settings={settings}
          onAccept={text=>{ updateBlock(aiWriterBlock,{content:text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}); setAiWriterBlock(null); }}
          onClose={()=>setAiWriterBlock(null)}
          onUsageIncrement={() => {
            if (!onSettingsChange) return;
            const curWin  = getWeekWindowStart();
            const wStart  = settings?.aiGenerationsWindowStart ? new Date(settings.aiGenerationsWindowStart) : null;
            const valid   = wStart && wStart >= curWin;
            const used    = valid ? (settings?.aiGenerationsUsed || 0) : 0;
            onSettingsChange(prev => ({
              ...prev,
              aiGenerationsUsed: used + 1,
              aiGenerationsWindowStart: valid ? prev.aiGenerationsWindowStart : curWin.toISOString(),
            }));
          }}
        />
      )}

      {/* AI Writer upgrade modal */}
      {showAiUpgrade && (
        <AiWriterUpgradeModal
          isAdmin={userRole === "admin"}
          settings={settings}
          users={users || []}
          onUpgrade={()=>{ setShowAiUpgrade(false); onUpgradeAi && onUpgradeAi(); }}
          onClose={()=>setShowAiUpgrade(false)}
        />
      )}
    </>
  );
}


const ACCENT_PRESETS = [
  { name:"Kraken",  value:"#2b7fe8" },
  { name:"Sky",     value:"#4a90d9" },
  { name:"Sage",    value:"#3dba7e" },
  { name:"Violet",  value:"#8b7cf8" },
  { name:"Gold",    value:"#e8c53a" },
  { name:"Rose",    value:"#e85a8a" },
  { name:"Teal",    value:"#2ec4b6" },
  { name:"Coral",   value:"#f0614e" },
];

// ── TASKS PAGE ───────────────────────────────────────────────────────────────

const TASK_PRIORITIES = [
  { id:"critical", label:"Critical", color:"#e85a3a" },
  { id:"high",     label:"High",     color:"#e8703a" },
  { id:"medium",   label:"Medium",   color:"#e8c53a" },
  { id:"low",      label:"Low",      color:"#3dba7e" },
];

const EMPTY_TASK = {
  id:"", title:"", description:"", priority:"medium", status:"todo",
  assigneeIds:[], projectId:"", dueDate:"", tags:[], checklist:[],
  createdBy:"admin", createdAt:"", comments:[],
  repeatEnabled: false, repeatType:"days", repeatValue:1, repeatDay:1, repeatWeekday:1,
  attachments:[],
};

// Compute urgency from dueDate: "overdue" | "soon" (<=3 days) | "normal" | null
const getDueUrgency = (dueDate) => {
  if (!dueDate) return null;
  const diff = Math.ceil((new Date(dueDate+"T12:00:00") - new Date()) / 86400000);
  if (diff < 0)  return "overdue";
  if (diff <= 3) return "soon";
  return "normal";
};
