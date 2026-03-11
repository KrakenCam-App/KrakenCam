import { useState, useRef, useEffect, useCallback } from "react";

// ── Icons ──────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 20, stroke = "currentColor", fill = "none", strokeWidth = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);
const ic = {
  dash:     "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  camera:   "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z M12 17a4 4 0 100-8 4 4 0 000 8z",
  rooms:    "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
  reports:  "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  templates:"M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14l4 4m0-4l-4 4",
  edit:     "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  plus:     "M12 5v14 M5 12h14",
  close:    "M18 6L6 18 M6 6l12 12",
  trash:    "M3 6h18 M8 6V4h8v2 M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  image:    "M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14 M3 19l5-5 4 4 4-4 5 5 M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  pen:      "M12 20h9 M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z",
  text:     "M4 7V4h16v3 M9 20h6 M12 4v16",
  undo:     "M3 7v6h6 M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  building: "M3 21h18 M9 21V7l6-4v18 M9 21V7 M3 21V11l6-4",
  briefcase:"M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2",
  eye:      "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 12a3 3 0 100-6 3 3 0 000 6z",
  check:    "M20 6L9 17l-5-5",
  copy:     "M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1",
  layers:   "M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5",
  mapPin:   "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 10a3 3 0 100-6 3 3 0 000 6z",
  grid:     "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
  rotateCw: "M23 4v6h-6 M20.49 15a9 9 0 11-2.12-9.36L23 10",
  timer:    "M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v6l4 2",
  alert:    "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01",
  phone:    "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z",
  mail:     "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
  user:     "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
  chevRight:"M9 18l6-6-6-6",
  chevDown: "M6 9l6 6 6-6",
  star:     "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  arrowLeft:"M19 12H5 M12 19l-7-7 7-7",
  folder:   "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
  hash:     "M4 9h16 M4 15h16 M10 3L8 21 M16 3l-2 18",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  clockIcon:"M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v6l4 2",
};

// ── Seed data helpers ──────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const DEFAULT_ROOMS = ["Living Room","Kitchen","Master Bedroom","Bathroom","Garage","Basement","Exterior"];
const ROOM_ICONS = { "Living Room":"🛋️","Kitchen":"🍳","Master Bedroom":"🛏️","Bathroom":"🚿","Garage":"🔧","Basement":"🏗️","Exterior":"🌿","Attic":"🏠","Office":"💼","Dining Room":"🪑","Utility Room":"⚙️","Hallway":"🚪","Other":"📦" };
const ROOM_COLORS = ["#4a90d9","#3dba7e","#8b7cf8","#e8c53a","#e8703a","#e85a3a","#3ab8e8","#f0954e"];

const STATUS_META = {
  active:    { label:"Active",    cls:"green"  },
  onhold:    { label:"On Hold",   cls:"orange" },
  completed: { label:"Completed", cls:"blue"   },
  archived:  { label:"Archived",  cls:"purple" },
};

const SEED_PROJECTS = [
  {
    id: "proj_1", title: "123 Oak Street Renovation",
    address: "123 Oak Street", city: "Denver", state: "CO", zip: "80203",
    clientName: "Robert & Linda Hayes", clientEmail: "hayes@email.com", clientPhone: "(720) 555-0182",
    contractorName: "Apex Builders", contractorPhone: "(720) 555-0199",
    type: "Renovation", status: "active", notes: "Full kitchen and master bath renovation. Insurance claim active.",
    createdAt: "Mar 1, 2026", color: "#4a90d9",
    rooms: DEFAULT_ROOMS.map((n,i)=>({ id:uid(), name:n, icon:ROOM_ICONS[n]||"📦", color:ROOM_COLORS[i%ROOM_COLORS.length], photoCount:Math.floor(Math.random()*12)+1 })),
    photos: [
      { id:uid(), name:"Foundation crack NE corner", room:"Exterior",       date:"Mar 7, 2026", tags:["damage","critical"], color:"#e85a3a" },
      { id:uid(), name:"Water damage ceiling",        room:"Living Room",    date:"Mar 7, 2026", tags:["water","mold"],     color:"#4a90d9" },
      { id:uid(), name:"Kitchen plumbing leak",       room:"Kitchen",        date:"Mar 6, 2026", tags:["plumbing"],         color:"#3dba7e" },
    ],
    reports: [
      { id:uid(), title:"Oak St – Insurance Claim", type:"Insurance", date:"Mar 8, 2026", photos:14, status:"draft",  color:"#4a90d9" },
    ],
  },
  {
    id: "proj_2", title: "456 Maple Ave – Water Damage",
    address: "456 Maple Avenue", city: "Denver", state: "CO", zip: "80220",
    clientName: "Sarah Chen", clientEmail: "schen@email.com", clientPhone: "(303) 555-0144",
    contractorName: "FloodPro Restoration", contractorPhone: "(303) 555-0177",
    type: "Insurance Claim", status: "active", notes: "Burst pipe in basement. Mold assessment required.",
    createdAt: "Feb 28, 2026", color: "#3dba7e",
    rooms: ["Basement","Bathroom","Hallway","Utility Room"].map((n,i)=>({ id:uid(), name:n, icon:ROOM_ICONS[n]||"📦", color:ROOM_COLORS[i%ROOM_COLORS.length], photoCount:Math.floor(Math.random()*10)+2 })),
    photos: [
      { id:uid(), name:"Burst pipe main valve",  room:"Basement",      date:"Feb 28, 2026", tags:["plumbing","damage"], color:"#3dba7e" },
      { id:uid(), name:"Mold on south wall",     room:"Basement",      date:"Feb 28, 2026", tags:["mold","hazard"],    color:"#e85a3a" },
    ],
    reports: [
      { id:uid(), title:"Maple Ave – Contractor Package", type:"Contractor", date:"Mar 2, 2026", photos:18, status:"sent",  color:"#3dba7e" },
    ],
  },
  {
    id: "proj_3", title: "789 Pine Rd Full Inspection",
    address: "789 Pine Road", city: "Aurora", state: "CO", zip: "80012",
    clientName: "Marcus Williams", clientEmail: "mwilliams@email.com", clientPhone: "(720) 555-0231",
    contractorName: "HomeSafe Inspections", contractorPhone: "(720) 555-0255",
    type: "Inspection", status: "completed", notes: "Pre-sale full property inspection. All rooms documented.",
    createdAt: "Feb 20, 2026", color: "#8b7cf8",
    rooms: DEFAULT_ROOMS.map((n,i)=>({ id:uid(), name:n, icon:ROOM_ICONS[n]||"📦", color:ROOM_COLORS[i%ROOM_COLORS.length], photoCount:Math.floor(Math.random()*18)+4 })),
    photos: [
      { id:uid(), name:"Roof shingle damage",     room:"Exterior",       date:"Feb 20, 2026", tags:["roof","damage"],  color:"#e85a3a" },
      { id:uid(), name:"HVAC unit overview",       room:"Basement",       date:"Feb 20, 2026", tags:["hvac"],           color:"#8b7cf8" },
      { id:uid(), name:"Electrical panel",         room:"Basement",       date:"Feb 20, 2026", tags:["electrical"],     color:"#e8c53a" },
    ],
    reports: [
      { id:uid(), title:"Pine Rd – Full Inspection Report", type:"Inspection", date:"Feb 22, 2026", photos:42, status:"final", color:"#8b7cf8" },
    ],
  },
];

const TEMPLATES = [
  { id:1, name:"Insurance Claim Report",     desc:"Property damage insurance claims. Includes liability and damage assessment fields.", type:"Insurance",  color:"#4a90d9" },
  { id:2, name:"Contractor Quote Package",   desc:"Send to contractors for bid requests with scope of work and material specs.",        type:"Contractor", color:"#3dba7e" },
  { id:3, name:"Property Inspection",        desc:"Full property walkthrough covering all rooms and systems.",                          type:"Inspection", color:"#8b7cf8" },
  { id:4, name:"Water Damage Assessment",    desc:"Specialized template for water damage and moisture documentation.",                  type:"Damage",     color:"#e85a3a" },
  { id:5, name:"Renovation Progress Report", desc:"Track renovation phases, completed work, and remaining tasks.",                     type:"Progress",   color:"#e8c53a" },
  { id:6, name:"Fire Damage Documentation",  desc:"Detailed fire and smoke damage assessment for restoration companies.",              type:"Damage",     color:"#e8703a" },
];

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --bg:#0d0f14;--surface:#13161e;--surface2:#1a1e28;--surface3:#22273a;
    --border:#2a2f42;--accent:#e86c3a;--accent2:#f0954e;--accent-glow:rgba(232,108,58,0.15);
    --blue:#4a90d9;--green:#3dba7e;--purple:#8b7cf8;--yellow:#e8c53a;
    --text:#f0f2f7;--text2:#8b9ab8;--text3:#4a5570;
    --nav-w:252px;--radius:12px;--radius-sm:8px;
    --font:'Inter',system-ui,sans-serif;
    --density-page-pad:26px;--density-nav-pad:14px 12px 0;--density-item-pad:9px 12px;
    --density-card-pad:20px;--density-gap:20px;--density-font:13.5px;--density-topbar-h:58px;
  }
  body{font-family:var(--font);background:var(--bg);color:var(--text);overflow:hidden;height:100vh;}
  h1,h2,h3,h4{font-family:var(--font);font-weight:700;letter-spacing:-0.01em;}
  ::-webkit-scrollbar{width:4px;height:4px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px;}

  .app{display:flex;height:100vh;overflow:hidden;}

  /* ── NAV ── */
  .nav{width:var(--nav-w);background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;overflow-y:auto;}
  .nav-brand{padding:22px 18px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);}
  .nav-brand-icon{width:36px;height:36px;background:var(--accent);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .nav-brand-text{font-family:var(--font);font-size:14px;font-weight:700;line-height:1.2;}
  .nav-brand-sub{font-size:10px;color:var(--text2);font-weight:400;letter-spacing:.08em;text-transform:uppercase;}

  /* Project switcher in nav */
  .nav-project-switcher{margin:12px 12px 0;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;cursor:pointer;transition:border-color .15s;}
  .nav-project-switcher:hover{border-color:var(--accent);}
  .nav-project-switcher-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);font-weight:600;margin-bottom:4px;}
  .nav-project-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text);}
  .nav-project-addr{font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}

  .nav-section{padding:var(--density-nav-pad);}
  .nav-section-label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);font-weight:600;padding:0 8px 8px;}
  .nav-item{display:flex;align-items:center;gap:10px;padding:var(--density-item-pad);border-radius:var(--radius-sm);cursor:pointer;transition:all .15s;font-size:var(--density-font);font-weight:500;color:var(--text2);margin-bottom:2px;}
  .nav-item:hover{background:var(--surface2);color:var(--text);}
  .nav-item.active{background:var(--accent-glow);color:var(--accent);}
  .nav-badge{margin-left:auto;background:var(--accent);color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;}
  .nav-footer{margin-top:auto;padding:14px 12px;border-top:1px solid var(--border);}

  /* ── TOPBAR ── */
  .main{flex:1;overflow:hidden;background:var(--bg);display:flex;flex-direction:column;}
  .topbar{background:var(--surface);border-bottom:1px solid var(--border);padding:0 24px;height:var(--density-topbar-h);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
  .topbar-left{display:flex;align-items:center;gap:12px;}
  .topbar-crumb{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text2);}
  .topbar-crumb-proj{color:var(--accent);font-weight:600;cursor:pointer;}
  .topbar-crumb-proj:hover{text-decoration:underline;}
  .topbar-title{font-family:var(--font);font-size:15px;font-weight:700;letter-spacing:-0.01em;}
  .topbar-actions{display:flex;align-items:center;gap:10px;}

  .page{padding:var(--density-page-pad);flex:1;overflow-y:auto;height:calc(100vh - var(--density-topbar-h));}

  /* ── BUTTONS ── */
  .btn{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:var(--radius-sm);border:none;cursor:pointer;font-family:var(--font);font-size:13.5px;font-weight:600;transition:all .15s;white-space:nowrap;}
  .btn-primary{background:var(--accent);color:white;}
  .btn-primary:hover{background:var(--accent2);transform:translateY(-1px);box-shadow:0 4px 14px rgba(232,108,58,.4);}
  .btn-secondary{background:var(--surface2);color:var(--text);border:1px solid var(--border);}
  .btn-secondary:hover{background:var(--surface3);}
  .btn-ghost{background:transparent;color:var(--text2);}
  .btn-ghost:hover{background:var(--surface2);color:var(--text);}
  .btn-sm{padding:6px 12px;font-size:12px;}
  .btn-danger{background:rgba(220,60,60,.12);color:#ff6b6b;border:1px solid rgba(220,60,60,.22);}
  .btn-danger:hover{background:rgba(220,60,60,.22);}
  .btn-icon{width:34px;height:34px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-sm);}

  /* ── CARDS ── */
  .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;}
  .card-header{padding:15px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
  .card-body{padding:var(--density-card-pad);}

  /* ── GRIDS ── */
  .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--density-gap);}
  .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--density-gap);}

  /* ── TAGS ── */
  .tag{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11.5px;font-weight:600;}
  .tag-orange{background:rgba(232,108,58,.15);color:var(--accent);}
  .tag-blue{background:rgba(74,144,217,.15);color:var(--blue);}
  .tag-green{background:rgba(61,186,126,.15);color:var(--green);}
  .tag-purple{background:rgba(139,124,248,.15);color:var(--purple);}
  .tag-yellow{background:rgba(232,197,58,.15);color:var(--yellow);}

  /* ── GRID ── */
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:18px;}

  /* ── PROJECT CARDS (Jobsite List) ── */
  .project-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;cursor:pointer;transition:all .2s;position:relative;}
  .project-card:hover{border-color:var(--accent);transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.35);}
  .project-card-bar{height:4px;}
  .project-card-body{padding:18px 20px;}
  .project-card-title{font-family:var(--font);font-size:14px;font-weight:700;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-0.01em;}
  .project-card-addr{font-size:12.5px;color:var(--text2);margin-bottom:12px;display:flex;align-items:center;gap:5px;}
  .project-card-meta{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;}
  .project-card-stat{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--text2);}
  .project-card-footer{padding:10px 20px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--surface2);}
  .project-card-client{font-size:12px;color:var(--text2);display:flex;align-items:center;gap:5px;}

  /* ── STATS ── */
  .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px;}
  .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px;position:relative;overflow:hidden;}
  .stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;}
  .stat-card.orange::before{background:var(--accent);}
  .stat-card.blue::before{background:var(--blue);}
  .stat-card.green::before{background:var(--green);}
  .stat-card.purple::before{background:var(--purple);}
  .stat-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text2);font-weight:600;margin-bottom:8px;}
  .stat-value{font-family:var(--font);font-size:26px;font-weight:700;line-height:1;letter-spacing:-0.02em;}
  .stat-sub{font-size:12px;color:var(--text2);margin-top:5px;}

  /* ── PROJECT DETAIL HEADER ── */
  .project-hero{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:22px;}
  .project-hero-bar{height:5px;}
  .project-hero-body{padding:22px 24px;}
  .project-hero-title{font-family:var(--font);font-size:19px;font-weight:700;margin-bottom:6px;letter-spacing:-0.02em;}
  .project-hero-addr{display:flex;align-items:center;gap:6px;font-size:13.5px;color:var(--text2);margin-bottom:16px;}
  .project-info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
  .project-info-box{background:var(--surface2);border-radius:var(--radius-sm);padding:14px 16px;}
  .project-info-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);font-weight:700;margin-bottom:6px;}
  .project-info-value{font-size:13.5px;font-weight:600;}
  .project-info-sub{font-size:12px;color:var(--text2);margin-top:2px;}

  /* ── PHOTO CARDS ── */
  .photo-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;cursor:pointer;transition:all .2s;}
  .photo-card:hover{border-color:var(--accent);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.3);}
  .photo-card-img{aspect-ratio:4/3;background:var(--surface2);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;}
  .photo-card-img img{width:100%;height:100%;object-fit:cover;}
  .photo-placeholder{display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--text3);}
  .photo-card-info{padding:11px 13px;}
  .photo-card-name{font-weight:600;font-size:12.5px;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .photo-card-meta{font-size:11px;color:var(--text2);}
  .photo-tag{display:inline-flex;align-items:center;font-size:10px;background:var(--surface3);color:var(--text2);padding:2px 7px;border-radius:20px;margin-top:5px;margin-right:4px;font-weight:500;}

  /* ── ROOM CARDS ── */
  .room-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;cursor:pointer;transition:all .15s;}
  .room-card:hover{border-color:var(--accent);background:var(--surface2);}
  .room-icon-wrap{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:10px;}
  .room-name{font-family:var(--font);font-size:13px;font-weight:700;margin-bottom:3px;}
  .room-count{font-size:12px;color:var(--text2);}
  .progress-bar{background:var(--surface2);border-radius:4px;height:5px;overflow:hidden;margin-top:10px;}
  .progress-fill{height:100%;border-radius:4px;background:var(--accent);}

  /* ── REPORT ROWS ── */
  .report-row{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:13px 16px;display:flex;align-items:center;gap:14px;cursor:pointer;transition:all .15s;margin-bottom:8px;}
  .report-row:hover{border-color:var(--accent);background:var(--surface2);}
  .report-row-icon{width:38px;height:38px;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .report-row-actions{margin-left:auto;display:flex;gap:7px;opacity:0;transition:opacity .15s;}
  .report-row:hover .report-row-actions{opacity:1;}

  /* ── MODAL ── */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;}
  .modal{background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:580px;max-height:92vh;overflow-y:auto;}
  .modal-lg{max-width:720px;}
  .modal-header{padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
  .modal-title{font-family:var(--font);font-size:15px;font-weight:700;letter-spacing:-0.01em;}
  .modal-body{padding:24px;}
  .modal-footer{padding:14px 24px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;}

  /* ── FORMS ── */
  .form-group{margin-bottom:16px;}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  .form-row-3{display:grid;grid-template-columns:2fr 1fr 1fr;gap:14px;}
  .form-label{display:block;font-size:12px;font-weight:600;color:var(--text2);margin-bottom:5px;letter-spacing:.03em;text-transform:uppercase;}
  .form-input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:9px 13px;color:var(--text);font-family:var(--font);font-size:13.5px;outline:none;transition:border-color .15s;}
  .form-input:focus{border-color:var(--accent);}
  .form-input::placeholder{color:var(--text3);}
  .form-textarea{resize:vertical;min-height:76px;}
  .form-select{appearance:none;cursor:pointer;}
  .form-section{margin-bottom:8px;padding-bottom:8px;}
  .form-section-title{font-family:var(--font);font-size:12.5px;font-weight:700;color:var(--text);margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;letter-spacing:0;}

  /* ── MISC ── */
  .section-title{font-family:var(--font);font-size:17px;font-weight:700;margin-bottom:4px;letter-spacing:-0.02em;}
  .section-sub{font-size:13px;color:var(--text2);margin-bottom:22px;}
  .divider{height:1px;background:var(--border);margin:18px 0;}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--accent);display:inline-block;}
  .pill{display:inline-flex;align-items:center;gap:5px;background:rgba(0,0,0,.55);backdrop-filter:blur(8px);border-radius:20px;padding:5px 11px;font-size:11px;color:rgba(255,255,255,.85);border:1px solid rgba(255,255,255,.12);white-space:nowrap;}
  .empty{text-align:center;padding:56px 20px;color:var(--text2);}
  .empty-icon{width:64px;height:64px;background:var(--surface2);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;}
  .empty h3{font-family:var(--font);font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px;letter-spacing:-0.01em;}
  .empty p{font-size:13px;line-height:1.6;max-width:300px;margin:0 auto 18px;}
  .upload-zone{border:2px dashed var(--border);border-radius:var(--radius);padding:28px;text-align:center;cursor:pointer;transition:all .2s;}
  .upload-zone:hover{border-color:var(--accent);background:var(--accent-glow);}

  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .fade-in{animation:fadeIn .22s ease forwards;}
  @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}

  /* ── CAMERA ── */
  .cam-page{display:flex;flex-direction:column;height:100vh;background:#000;position:relative;overflow:hidden;}
  .cam-view{flex:1;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;min-height:0;}
  .cam-view video{width:100%;height:100%;object-fit:cover;display:block;}
  .cam-grid-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
  .cam-guide{position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center;}
  .cam-guide-box{position:relative;width:65%;max-width:500px;aspect-ratio:4/3;}
  .cam-guide-box::before,.cam-guide-box::after,.cam-guide-box span::before,.cam-guide-box span::after{content:'';position:absolute;width:24px;height:24px;border-color:rgba(255,255,255,.7);border-style:solid;}
  .cam-guide-box::before{top:0;left:0;border-width:2px 0 0 2px;}
  .cam-guide-box::after{top:0;right:0;border-width:2px 2px 0 0;}
  .cam-guide-box span::before{bottom:0;left:0;border-width:0 0 2px 2px;}
  .cam-guide-box span::after{bottom:0;right:0;border-width:0 2px 2px 0;}
  .cam-flash{position:absolute;inset:0;background:white;pointer-events:none;opacity:0;z-index:20;transition:opacity .04s;}
  .cam-flash.on{opacity:1;}
  .cam-hud-top{position:absolute;top:0;left:0;right:0;padding:13px 16px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(to bottom,rgba(0,0,0,.7),transparent);z-index:10;gap:8px;flex-wrap:wrap;}
  .cam-hud-bot{position:absolute;bottom:0;left:0;right:0;padding:12px 18px 22px;background:linear-gradient(to top,rgba(0,0,0,.85),transparent);z-index:10;}
  .shutter-outer{width:74px;height:74px;border-radius:50%;border:3px solid rgba(255,255,255,.85);display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;transition:transform .1s;flex-shrink:0;}
  .shutter-outer:hover{transform:scale(1.06);}
  .shutter-outer:active{transform:scale(.94);}
  .shutter-inner{width:58px;height:58px;border-radius:50%;background:white;transition:all .1s;}
  .shutter-inner.firing{background:var(--accent);transform:scale(.88);}
  .cam-icon-btn{width:42px;height:42px;border-radius:50%;background:rgba(0,0,0,.5);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;cursor:pointer;color:white;transition:all .15s;flex-shrink:0;}
  .cam-icon-btn:hover{background:rgba(255,255,255,.18);}
  .cam-icon-btn.lit{background:var(--accent);border-color:var(--accent);}
  .cam-thumb-row{display:flex;gap:7px;overflow-x:auto;padding-bottom:4px;margin-bottom:10px;}
  .cam-thumb-row::-webkit-scrollbar{height:2px;}
  .cam-thumb{width:50px;height:50px;border-radius:8px;object-fit:cover;border:2px solid transparent;cursor:pointer;flex-shrink:0;transition:border-color .15s;}
  .cam-thumb:hover{border-color:var(--accent);}
  .cam-countdown{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:25;}
  .cam-countdown-num{font-family:var(--font);font-size:100px;font-weight:700;color:white;text-shadow:0 0 40px rgba(232,108,58,.9);animation:cPulse 1s ease-in-out infinite;letter-spacing:-0.05em;}
  @keyframes cPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.1);opacity:.75}}
  .cam-error{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;color:var(--text2);text-align:center;padding:40px;}
  .cam-error-icon{width:70px;height:70px;border-radius:50%;background:rgba(232,108,58,.1);border:2px solid rgba(232,108,58,.3);display:flex;align-items:center;justify-content:center;}
  .review-overlay{position:absolute;inset:0;background:#000;z-index:30;display:flex;flex-direction:column;animation:slideUp .28s ease;}
  .review-overlay img{flex:1;object-fit:contain;min-height:0;}
  .review-meta{padding:13px 16px 20px;background:var(--surface);border-top:1px solid var(--border);}
  .zoom-slider{-webkit-appearance:none;appearance:none;width:100px;height:4px;border-radius:4px;background:rgba(255,255,255,.25);outline:none;}
  .zoom-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:white;cursor:pointer;}

  /* ── EDITOR ── */
  .editor-wrap{display:flex;flex-direction:column;height:100vh;}
  .editor-toolbar{background:var(--surface);border-bottom:1px solid var(--border);padding:9px 18px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0;}
  .tool-btn{width:34px;height:34px;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid transparent;color:var(--text2);transition:all .15s;}
  .tool-btn:hover{background:var(--surface2);color:var(--text);}
  .tool-btn.active{background:var(--accent-glow);border-color:var(--accent);color:var(--accent);}
  .tool-sep{width:1px;height:22px;background:var(--border);margin:0 3px;}
  .editor-body{flex:1;display:flex;overflow:hidden;}
  .canvas-area{flex:1;display:flex;align-items:center;justify-content:center;background:#080a10;overflow:hidden;}
  .editor-side{width:208px;background:var(--surface);border-left:1px solid var(--border);padding:14px;overflow-y:auto;flex-shrink:0;}
  .editor-side h4{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--text3);font-weight:700;margin-bottom:10px;}
  .color-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-bottom:14px;}
  .color-dot{width:23px;height:23px;border-radius:5px;cursor:pointer;transition:transform .15s;border:2px solid transparent;}
  .color-dot:hover{transform:scale(1.15);}
  .color-dot.sel{border-color:white;}
  .size-slider{width:100%;margin:7px 0 14px;accent-color:var(--accent);}

  /* ── TEMPLATE ── */
  .template-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;transition:all .2s;cursor:pointer;}
  .template-card:hover{border-color:var(--accent);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.3);}
  .template-preview{height:130px;background:var(--surface2);display:flex;flex-direction:column;gap:5px;padding:12px;}
  .tmpl-line{background:var(--surface3);border-radius:3px;}
  .template-info{padding:13px 15px;}
  .template-name{font-family:var(--font);font-size:13px;font-weight:700;margin-bottom:3px;letter-spacing:-0.01em;}
  .template-desc{font-size:11.5px;color:var(--text2);line-height:1.5;}

  /* ── CONFIRM DELETE ── */
  .confirm-box{background:rgba(220,60,60,.08);border:1px solid rgba(220,60,60,.25);border-radius:var(--radius);padding:16px 18px;display:flex;align-items:center;gap:14px;margin-top:16px;}

  /* ── REPORT CREATOR ── */
  .rc-wrap{display:flex;flex-direction:column;height:100vh;overflow:hidden;}
  .rc-topbar{background:var(--surface);border-bottom:1px solid var(--border);padding:0 18px;height:54px;display:flex;align-items:center;gap:10px;flex-shrink:0;}
  .rc-options-bar{background:var(--surface2);border-bottom:1px solid var(--border);padding:8px 18px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0;}
  .rc-toggle{display:flex;align-items:center;gap:6px;padding:5px 10px;background:var(--surface);border:1px solid var(--border);border-radius:20px;cursor:pointer;font-size:12px;font-weight:500;color:var(--text2);transition:all .15s;user-select:none;}
  .rc-toggle:hover{border-color:var(--text2);color:var(--text);}
  .rc-toggle.on{background:var(--accent-glow);border-color:var(--accent);color:var(--accent);}
  .rc-body{display:flex;flex:1;overflow:hidden;}
  .rc-canvas{flex:1;overflow-y:auto;background:#1a1e28;padding:24px;display:flex;flex-direction:column;align-items:center;gap:0;}
  .rc-sidebar{width:260px;background:var(--surface);border-left:1px solid var(--border);overflow-y:auto;flex-shrink:0;}
  .rc-sidebar-section{padding:14px 16px;border-bottom:1px solid var(--border);}
  .rc-sidebar-title{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);font-weight:700;margin-bottom:10px;}

  /* Report document */
  .rp{background:white;width:816px;min-height:1056px;box-shadow:0 4px 32px rgba(0,0,0,.5);color:#1a1a1a;position:relative;font-family:'Inter',system-ui,sans-serif;flex-shrink:0;}
  .rp-header{padding:28px 36px 20px;border-bottom:3px solid #e86c3a;}
  .rp-footer{padding:10px 36px;border-top:2px solid #e86c3a;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#888;background:#fafafa;}
  .rp-cover{position:relative;height:340px;background:#1a1e28;overflow:hidden;display:flex;align-items:flex-end;}
  .rp-cover img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0;}
  .rp-cover-overlay{position:relative;z-index:2;padding:28px 36px;width:100%;background:linear-gradient(to top,rgba(0,0,0,.85),transparent);}
  .rp-section{padding:22px 36px;border-bottom:1px solid #eee;}
  .rp-section:last-child{border-bottom:none;}
  .rp-section-title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#444;margin-bottom:14px;display:flex;align-items:center;gap:8px;}
  .rp-section-title::after{content:'';flex:1;height:1px;background:#e8e8e8;}
  .rp-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;}
  .rp-info-row{display:flex;flex-direction:column;gap:1px;}
  .rp-info-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#999;}
  .rp-info-value{font-size:12px;color:#222;font-weight:500;}
  .rp-photo-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .rp-photo-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
  .rp-photo-grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;}
  .rp-photo-item{position:relative;border-radius:4px;overflow:hidden;border:1px solid #e8e8e8;}
  .rp-photo-item img{width:100%;display:block;aspect-ratio:4/3;object-fit:cover;}
  .rp-photo-caption{padding:5px 7px;font-size:9.5px;color:#555;background:#fafafa;border-top:1px solid #eee;line-height:1.4;}
  .rp-photo-meta{display:flex;gap:8px;font-size:8.5px;color:#aaa;margin-top:2px;}
  .rp-text-block{font-size:12.5px;line-height:1.7;color:#333;white-space:pre-wrap;}
  .rp-text-photo{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;}
  .rp-branding{font-size:9px;color:#bbb;letter-spacing:.06em;text-align:right;}
  .rp-page-break{width:816px;height:32px;background:transparent;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .rp-page-break-line{width:100%;height:1px;border-top:2px dashed #444;opacity:.4;}

  /* Block add buttons */
  .rc-add-block{width:816px;padding:8px 0;display:flex;justify-content:center;opacity:0;transition:opacity .2s;}
  .rc-add-block:hover{opacity:1;}
  .rc-section-wrap{width:816px;}
  .rc-section-wrap:hover .rc-add-block{opacity:1;}
  .rc-block-selected{outline:2px solid var(--accent);outline-offset:2px;}
`;


// ── Camera Component ───────────────────────────────────────────────────────────
function CameraPage({ project, defaultRoom, onSave, onClose }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const flashRef  = useRef(null);
  const streamRef = useRef(null);

  const [camState,  setCamState]   = useState("starting");
  const [facing,    setFacing]     = useState("environment");
  const [zoom,      setZoom]       = useState(1);
  const [timerSec,  setTimerSec]   = useState(0);
  const [countdown, setCountdown]  = useState(null);
  const [firing,    setFiring]     = useState(false);
  const [gridOn,    setGridOn]     = useState(true);
  const [reviewImg, setReviewImg]  = useState(null);
  const [session,   setSession]    = useState([]);
  const [gps,       setGps]        = useState(null);
  const [gpsLabel,  setGpsLabel]   = useState("Locating…");
  const [selRoom,   setSelRoom]    = useState(defaultRoom || (project?.rooms?.[0]?.name) || "General");
  const [photoName, setPhotoName]  = useState("");
  const [roomMenuOpen, setRoomMenuOpen] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) { setGpsLabel("GPS unavailable"); return; }
    navigator.geolocation.getCurrentPosition(
      p => { const la = p.coords.latitude.toFixed(5), lo = p.coords.longitude.toFixed(5); setGps({ lat: la, lng: lo }); setGpsLabel(`${la}, ${lo}`); },
      () => setGpsLabel("Location denied"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const startStream = useCallback(async (face) => {
    setCamState("starting");
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCamState("live");
    } catch (e) {
      setCamState(e.name === "NotAllowedError" || e.name === "PermissionDeniedError" ? "denied" : "error");
    }
  }, []);

  useEffect(() => { startStream(facing); return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); }; }, []);

  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const caps = track.getCapabilities?.();
    if (caps?.zoom) track.applyConstraints({ advanced: [{ zoom }] }).catch(() => {});
  }, [zoom]);

  const doSnap = useCallback(() => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas) return;
    setFiring(true);
    if (flashRef.current) { flashRef.current.classList.add("on"); setTimeout(() => flashRef.current?.classList.remove("on"), 140); }
    canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (facing === "user") { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "rgba(0,0,0,0.52)";
    ctx.fillRect(10, canvas.height - 58, 480, 46);
    ctx.fillStyle = "white"; ctx.font = "bold 13px sans-serif";
    ctx.fillText(`${project?.title || "Jobsite"} — ${selRoom}  •  ${new Date().toLocaleString()}`, 18, canvas.height - 37);
    ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.font = "12px sans-serif";
    ctx.fillText(gps ? `GPS: ${gps.lat}, ${gps.lng}` : "GPS: unavailable", 18, canvas.height - 17);
    setReviewImg(canvas.toDataURL("image/jpeg", 0.93));
    setTimeout(() => setFiring(false), 200);
  }, [facing, gps, selRoom, project]);

  const handleShutter = () => {
    if (timerSec === 0) { doSnap(); return; }
    let c = timerSec; setCountdown(c);
    const iv = setInterval(() => { c--; if (c <= 0) { clearInterval(iv); setCountdown(null); doSnap(); } else setCountdown(c); }, 1000);
  };

  const acceptPhoto = () => {
    const name = photoName.trim() || `${selRoom} — ${new Date().toLocaleTimeString()}`;
    setSession(prev => [...prev, { id: uid(), dataUrl: reviewImg, room: selRoom, name, date: today(), tags: ["live capture"], gps }]);
    setReviewImg(null); setPhotoName("");
  };

  const flipCam = async () => { const next = facing === "environment" ? "user" : "environment"; setFacing(next); await startStream(next); };
  const cycleTimer = () => setTimerSec(t => t === 0 ? 3 : t === 3 ? 10 : 0);

  const roomList = project?.rooms?.map(r => r.name) || ["General"];

  if (camState === "denied") return (
    <div className="cam-page"><div className="cam-error"><div className="cam-error-icon"><Icon d={ic.alert} size={32} stroke="var(--accent)" /></div><div style={{ fontSize:16,fontWeight:700,color:"var(--text)" }}>Camera Access Denied</div><div style={{ fontSize:13,maxWidth:320 }}>Allow camera permissions in your browser settings, then try again.</div><div style={{ display:"flex",gap:10,marginTop:4 }}><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => startStream(facing)}>Try Again</button></div></div></div>
  );
  if (camState === "error") return (
    <div className="cam-page"><div className="cam-error"><div className="cam-error-icon"><Icon d={ic.alert} size={32} stroke="var(--accent)" /></div><div style={{ fontSize:16,fontWeight:700,color:"var(--text)" }}>Camera Unavailable</div><div style={{ fontSize:13,maxWidth:320 }}>No camera found or it is in use by another app.</div><div style={{ display:"flex",gap:10,marginTop:4 }}><button className="btn btn-secondary" onClick={onClose}>Go Back</button><button className="btn btn-primary" onClick={() => startStream(facing)}>Retry</button></div></div></div>
  );

  return (
    <div className="cam-page">
      <canvas ref={canvasRef} style={{ display:"none" }} />
      {reviewImg && (
        <div className="review-overlay">
          <img src={reviewImg} alt="preview" />
          <div className="review-meta">
            <div style={{ display:"flex",gap:12,marginBottom:12,alignItems:"flex-end" }}>
              <div style={{ flex:1 }}>
                <div className="form-label">Photo Name</div>
                <input className="form-input" placeholder={`${selRoom} photo…`} value={photoName} onChange={e => setPhotoName(e.target.value)} autoFocus />
              </div>
              <div style={{ minWidth:150 }}>
                <div className="form-label">Room</div>
                <select className="form-input form-select" value={selRoom} onChange={e => setSelRoom(e.target.value)}>
                  {roomList.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            {gps && <div style={{ display:"flex",alignItems:"center",gap:5,fontSize:11.5,color:"var(--green)",marginBottom:12 }}><Icon d={ic.mapPin} size={12} stroke="var(--green)" />GPS: {gps.lat}, {gps.lng}</div>}
            <div style={{ display:"flex",gap:10 }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setReviewImg(null)}>Retake</button>
              <button className="btn btn-primary" style={{ flex:2 }} onClick={acceptPhoto}><Icon d={ic.check} size={15} /> Accept Photo</button>
            </div>
          </div>
        </div>
      )}
      <div className="cam-view">
        {camState === "starting" ? (
          <div style={{ color:"var(--text2)",fontSize:14,display:"flex",flexDirection:"column",alignItems:"center",gap:12 }}>
            <div style={{ width:46,height:46,borderRadius:"50%",border:"3px solid var(--accent)",borderTopColor:"transparent",animation:"spin .8s linear infinite" }} />
            <span>Starting camera…</span>
          </div>
        ) : (
          <video ref={videoRef} playsInline muted autoPlay style={{ width:"100%",height:"100%",objectFit:"cover",transform:facing==="user"?"scaleX(-1)":"none" }} />
        )}
        <div ref={flashRef} className="cam-flash" />
        {gridOn && camState === "live" && (
          <svg className="cam-grid-svg" style={{ opacity:.22 }}>
            <line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke="white" strokeWidth="1" />
            <line x1="66.66%" y1="0" x2="66.66%" y2="100%" stroke="white" strokeWidth="1" />
            <line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke="white" strokeWidth="1" />
            <line x1="0" y1="66.66%" x2="100%" y2="66.66%" stroke="white" strokeWidth="1" />
          </svg>
        )}
        <div className="cam-guide"><div className="cam-guide-box"><span /></div></div>
        {countdown !== null && <div className="cam-countdown"><div className="cam-countdown-num">{countdown}</div></div>}

        <div className="cam-hud-top">
          <button className="btn btn-sm" style={{ background:"rgba(0,0,0,.55)",color:"white",border:"1px solid rgba(255,255,255,.2)" }} onClick={onClose}><Icon d={ic.close} size={14} /> Close</button>
          <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
            {project && <div className="pill"><Icon d={ic.briefcase} size={11} />{project.title}</div>}
            <div className="pill"><Icon d={ic.mapPin} size={11} stroke={gps ? "#3dba7e" : "#8b9ab8"} />{gpsLabel}</div>
            <div className="pill" style={{ cursor:"pointer" }} onClick={() => setRoomMenuOpen(o => !o)}>
              {project?.rooms?.find(r => r.name === selRoom)?.icon || "📦"} {selRoom} ▾
            </div>
          </div>
        </div>

        {roomMenuOpen && (
          <div style={{ position:"absolute",top:60,right:14,background:"rgba(13,15,20,.97)",border:"1px solid var(--border)",borderRadius:12,padding:"6px 0",zIndex:15,minWidth:170,maxHeight:300,overflowY:"auto" }}>
            {roomList.map(r => (
              <div key={r} onClick={() => { setSelRoom(r); setRoomMenuOpen(false); }}
                style={{ padding:"8px 16px",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",gap:8,background:selRoom===r?"var(--accent-glow)":"transparent",color:selRoom===r?"var(--accent)":"var(--text)" }}>
                {project?.rooms?.find(rm => rm.name===r)?.icon || "📦"} {r}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cam-hud-bot">
        {session.length > 0 && (
          <div style={{ marginBottom:10 }}>
            <div className="cam-thumb-row">{session.map((s,i) => <img key={i} className="cam-thumb" src={s.dataUrl} alt={s.name} title={s.name} />)}</div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,.55)" }}>{session.length} photo{session.length!==1?"s":""} captured</div>
          </div>
        )}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12 }}>
          <div style={{ display:"flex",gap:10,alignItems:"center" }}>
            <div className="cam-icon-btn" title="Self-timer" onClick={cycleTimer}>
              {timerSec > 0 ? <span style={{ fontWeight:700,fontSize:13 }}>{timerSec}s</span> : <Icon d={ic.timer} size={18} />}
            </div>
            <div className={`cam-icon-btn ${gridOn?"lit":""}`} title="Grid" onClick={() => setGridOn(g => !g)}><Icon d={ic.grid} size={18} /></div>
          </div>
          <div className="shutter-outer" onClick={handleShutter}><div className={`shutter-inner ${firing?"firing":""}`} /></div>
          <div style={{ display:"flex",gap:10,alignItems:"center" }}>
            <div className="cam-icon-btn" title="Flip camera" onClick={flipCam}><Icon d={ic.rotateCw} size={18} /></div>
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:3 }}>
              <span style={{ fontSize:10,color:"rgba(255,255,255,.6)",fontWeight:600 }}>{zoom.toFixed(1)}×</span>
              <input type="range" className="zoom-slider" min="1" max="5" step="0.1" value={zoom} onChange={e => setZoom(+e.target.value)} />
            </div>
            {session.length > 0 && (
              <button className="btn btn-primary btn-sm" onClick={() => onSave(session)}><Icon d={ic.check} size={14} /> Save {session.length}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TextOverlay: draggable + resizable, fully uncontrolled ────────────────────
function TextOverlay({ obj, isActive, onUpdate, onDelete, onFocus, onDragStart, setRef }) {
  const divRef  = useRef(null);
  const objFsPx = Math.round(obj.fontSize * 1.333);
  const objFont = `${obj.italic?"italic ":""}${obj.bold?"bold ":""}${objFsPx}px sans-serif`;

  // Focus on mount
  useEffect(() => {
    const el = divRef.current; if (!el) return;
    el.focus();
    const range = document.createRange(), sel = window.getSelection();
    range.selectNodeContents(el); range.collapse(false);
    sel.removeAllRanges(); sel.addRange(range);
  }, []);

  // Apply font style imperatively — never touch content or height
  useEffect(() => {
    const el = divRef.current; if (!el) return;
    el.style.font = objFont;
  }, [objFont]);

  // Resize corner drag
  const onResizeStart = e => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const startW = obj.w || 200;
    const onMove = ev => onUpdate({ w: Math.max(80, startW + ev.clientX - startX) });
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  const w = obj.w || 200;

  return (
    <div
      style={{ position:"absolute", left:`${obj.x}%`, top:`${obj.y}%`, zIndex:20, userSelect:"none",
        filter: isActive ? "drop-shadow(0 0 8px rgba(255,255,255,0.55))" : "none" }}
      onMouseDown={e => { onFocus(); onDragStart(e); }}
    >
      {/* Drag handle */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        background:"rgba(0,0,0,0.78)", borderRadius:"4px 4px 0 0", padding:"3px 8px", cursor:"move", gap:6 }}>
        <span style={{ fontSize:10, color:"rgba(255,255,255,.5)", letterSpacing:.5, pointerEvents:"none" }}>⠿ drag</span>
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ background:"none", border:"none", color:"rgba(255,110,110,.9)", cursor:"pointer", fontSize:13, lineHeight:1, padding:"0 3px" }}>✕</button>
      </div>

      {/* contentEditable — completely uncontrolled, never written to by React after mount */}
      <div style={{ position:"relative", width: w + "px" }}>
        <div
          ref={el => { divRef.current = el; setRef && setRef(el); }}
          contentEditable
          suppressContentEditableWarning
          // Do NOT set value/children here — let DOM own the content entirely
          onFocus={onFocus}
          onMouseDown={e => { e.stopPropagation(); onFocus(); }}
          onKeyDown={e => e.key === "Escape" && e.currentTarget.blur()}
          style={{
            font: objFont,
            color: obj.color,
            background: obj.bg
              ? (obj.bgColor !== "transparent" ? obj.bgColor : "rgba(0,0,0,0.65)")
              : "rgba(0,0,0,0.28)",
            border: isActive ? "2px dashed rgba(255,255,255,0.85)" : "2px dashed rgba(255,255,255,0.25)",
            borderTop:"none", borderRadius:"0 0 4px 4px",
            outline:"none", padding:"6px 8px",
            width:"100%",
            // Height is NEVER set — div grows naturally with typed content forever
            textDecoration: obj.under ? "underline" : "none",
            lineHeight:1.4, caretColor:"white",
            whiteSpace:"pre-wrap", wordBreak:"break-word",
            boxSizing:"border-box", overflowWrap:"break-word",
          }}
          data-placeholder="Type here…"
        />
        {/* Resize width grip */}
        <div onMouseDown={onResizeStart}
          style={{ position:"absolute", right:0, bottom:0, width:18, height:18, cursor:"se-resize",
            display:"flex", alignItems:"center", justifyContent:"center",
            background:"rgba(255,255,255,0.12)", borderRadius:"0 0 4px 0" }}>
          <svg width="9" height="9" viewBox="0 0 9 9">
            <line x1="2" y1="8" x2="8" y2="2" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="5" y1="8" x2="8" y2="5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}


function ImageEditor({ photo, onClose }) {
  const canvasRef   = useRef(null);
  const startPos    = useRef(null);
  const lastPos     = useRef(null);
  const snapRef     = useRef(null);

  const [tool,        setTool]        = useState("pen");
  const [color,       setColor]       = useState("#e86c3a");
  const [bgColor,     setBgColor]     = useState("transparent");
  const [size,        setSize]        = useState(25);  // brush 25-60
  const [fontSize,    setFontSize]    = useState(18);  // 10-50 pt
  const [drawing,     setDrawing]     = useState(false);
  const [history,     setHistory]     = useState([]);
  const [future,      setFuture]      = useState([]);
  const [textBold,    setTextBold]    = useState(false);
  const [textItalic,  setTextItalic]  = useState(false);
  const [textUnder,   setTextUnder]   = useState(false);
  const [textBg,      setTextBg]      = useState(false);

  // Floating text objects: { id, x, y (screen-space %, relative to canvas), text, color, bgColor, bold, italic, under, bg, fontSize, editing }
  const [textObjects, setTextObjects] = useState([]);
  const [activeTextId, setActiveTextId] = useState(null);
  // Dragging state for text objects
  const domRefs = useRef({}); // id → contentEditable DOM node
  const dragRef = useRef(null);

  const COLORS = ["#e86c3a","#4a90d9","#3dba7e","#8b7cf8","#e8c53a","#ff6b6b","#fff","#000","#a0b0cc","#f0954e","#3ab8e8","#e85a3a"];

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    if (photo?.dataUrl) {
      const img = new Image();
      img.onload = () => { c.width = img.width || 960; c.height = img.height || 640; ctx.drawImage(img, 0, 0); saveSnap(); };
      img.src = photo.dataUrl;
    } else {
      ctx.fillStyle = "#1a1e28"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.strokeStyle = "#2a2f42"; ctx.lineWidth = 1;
      for (let x = 0; x < c.width; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,c.height); ctx.stroke(); }
      for (let y = 0; y < c.height; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(c.width,y); ctx.stroke(); }
      ctx.fillStyle = "#3a3f55"; ctx.fillRect(80, 60, 380, 260);
      ctx.fillStyle = "#8b9ab8"; ctx.font = "15px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(photo?.name || "Photo Canvas", 270, 200);
      ctx.fillText("Open the camera to capture real photos", 270, 224);
      saveSnap();
    }
  }, []);

  const saveSnap = () => {
    const c = canvasRef.current;
    if (c) { setHistory(h => [...h.slice(-30), c.toDataURL()]); setFuture([]); }
  };
  const restoreSnap = (dataUrl) => {
    const img = new Image();
    img.onload = () => { const c = canvasRef.current; if (c) c.getContext("2d").drawImage(img, 0, 0); };
    img.src = dataUrl;
  };
  const undo = () => {
    if (history.length < 2) return;
    const prev = history[history.length - 2], cur = history[history.length - 1];
    setFuture(f => [cur, ...f]); setHistory(h => h.slice(0, -1)); restoreSnap(prev);
  };
  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setHistory(h => [...h, next]); setFuture(f => f.slice(1)); restoreSnap(next);
  };

  const flattenText = () => {
    if (!textObjects.length) return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    const rect = c.getBoundingClientRect();
    const scaleX = c.width / rect.width, scaleY = c.height / rect.height;
    textObjects.forEach(obj => {
      // Read actual typed text from the uncontrolled DOM node
      const domEl = domRefs.current[obj.id];
      const text = domEl ? (domEl.innerText || "").trim() : (obj.text || "").trim();
      if (!text) return;
      const fsPx = Math.round(obj.fontSize * 1.333);
      const fontStr = `${obj.italic?"italic ":""}${obj.bold?"bold ":""}${fsPx}px sans-serif`;
      ctx.font = fontStr; ctx.textAlign = "left"; ctx.textBaseline = "top";
      const cx = (obj.x / 100) * rect.width * scaleX;
      const cy = (obj.y / 100) * rect.height * scaleY;
      const lines = text.split("\n");
      const lineH = fsPx * 1.4;
      if (obj.bg) {
        const bw = (obj.w || 200) * scaleX;
        const bh = lineH * lines.length + 12;
        ctx.fillStyle = obj.bgColor !== "transparent" ? obj.bgColor : "rgba(0,0,0,0.6)";
        ctx.fillRect(cx, cy, bw, bh);
      }
      ctx.fillStyle = obj.color;
      lines.forEach((line, i) => {
        ctx.fillText(line, cx + 6, cy + 6 + i * lineH);
        if (obj.under) {
          const w = ctx.measureText(line).width;
          ctx.beginPath(); ctx.moveTo(cx + 6, cy + 6 + i*lineH + fsPx + 2);
          ctx.lineTo(cx + 6 + w, cy + 6 + i*lineH + fsPx + 2);
          ctx.strokeStyle = obj.color; ctx.lineWidth = Math.max(1, fsPx * 0.07); ctx.stroke();
        }
      });
    });
    domRefs.current = {};
    setTextObjects([]);
    setActiveTextId(null);
    saveSnap();
  };

  const pt = e => {
    const c = canvasRef.current, r = c.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (cx - r.left) * (c.width / r.width),
      y: (cy - r.top) * (c.height / r.height),
      // pct = position as % of canvas display rect (for overlay positioning)
      px: ((cx - r.left) / r.width) * 100,
      py: ((cy - r.top) / r.height) * 100,
    };
  };

  const isShape = t => t === "rect" || t === "circle" || t === "arrow";

  const onDown = e => {
    if (tool === "text") {
      const p = pt(e);
      const newObj = {
        id: Date.now(), x: p.px, y: p.py, text: "",
        color, bgColor, bold: textBold, italic: textItalic,
        under: textUnder, bg: textBg, fontSize, editing: true,
        w: 200, h: 80,
      };
      setTextObjects(prev => [...prev, newObj]);
      setActiveTextId(newObj.id);
      return;
    }
    // Flatten any floating text before drawing
    if (textObjects.length) flattenText();
    const p = pt(e);
    setDrawing(true); startPos.current = p; lastPos.current = p;
    if (isShape(tool)) {
      snapRef.current = canvasRef.current.toDataURL();
    } else {
      const ctx = canvasRef.current.getContext("2d");
      ctx.beginPath(); ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = tool === "eraser" ? "#1a1e28" : color; ctx.fill();
    }
  };

  const onMove = e => {
    if (!drawing) return;
    const ctx = canvasRef.current.getContext("2d"), p = pt(e);
    if (tool === "pen" || tool === "eraser") {
      ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = tool === "eraser" ? "#1a1e28" : color;
      ctx.lineWidth = tool === "eraser" ? size * 3 : size;
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
      lastPos.current = p;
    } else if (isShape(tool)) {
      const img = new Image();
      img.onload = () => {
        const c = canvasRef.current; if (!c) return;
        const cx = c.getContext("2d");
        cx.clearRect(0, 0, c.width, c.height); cx.drawImage(img, 0, 0);
        drawShape(cx, tool, startPos.current, p);
      };
      img.src = snapRef.current;
    }
  };

  const onUp = e => {
    if (!drawing) return;
    setDrawing(false);
    if (isShape(tool)) {
      const p = pt(e), ctx = canvasRef.current.getContext("2d");
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0); drawShape(ctx, tool, startPos.current, p); saveSnap();
      };
      img.src = snapRef.current;
    } else { saveSnap(); }
  };

  const drawShape = (ctx, type, from, to) => {
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = "round";
    if (type === "rect") {
      ctx.beginPath(); ctx.rect(from.x, from.y, to.x - from.x, to.y - from.y);
      if (bgColor !== "transparent") { ctx.fillStyle = bgColor; ctx.fill(); }
      ctx.stroke();
    } else if (type === "circle") {
      const rx = Math.abs(to.x - from.x) / 2, ry = Math.abs(to.y - from.y) / 2;
      const cx = from.x + (to.x - from.x) / 2, cy = from.y + (to.y - from.y) / 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (bgColor !== "transparent") { ctx.fillStyle = bgColor; ctx.fill(); }
      ctx.stroke();
    } else if (type === "arrow") {
      const dx = to.x - from.x, dy = to.y - from.y;
      const len = Math.sqrt(dx*dx + dy*dy); if (len < 2) return;
      const angle = Math.atan2(dy, dx);
      const headLen = Math.max(28, size * 4), headAngle = 0.42;
      const shaftEnd = { x: to.x - headLen * 0.6 * Math.cos(angle), y: to.y - headLen * 0.6 * Math.sin(angle) };
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(shaftEnd.x, shaftEnd.y); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - headLen * Math.cos(angle - headAngle), to.y - headLen * Math.sin(angle - headAngle));
      ctx.lineTo(to.x - headLen * Math.cos(angle + headAngle), to.y - headLen * Math.sin(angle + headAngle));
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
    }
  };

  // ── Text object drag handlers ────────────────────────────────────────────────
  const onTextDragStart = (e, id) => {
    if (e.target.tagName === "TEXTAREA") return; // let textarea handle its own events
    e.preventDefault(); e.stopPropagation();
    const obj = textObjects.find(o => o.id === id);
    if (!obj) return;
    dragRef.current = { id, startMouseX: e.clientX, startMouseY: e.clientY, startObjX: obj.x, startObjY: obj.y };
    const onMove = ev => {
      if (!dragRef.current) return;
      const c = canvasRef.current; if (!c) return;
      const r = c.getBoundingClientRect();
      const dx = ((ev.clientX - dragRef.current.startMouseX) / r.width)  * 100;
      const dy = ((ev.clientY - dragRef.current.startMouseY) / r.height) * 100;
      setTextObjects(prev => prev.map(o => o.id === id ? { ...o, x: dragRef.current.startObjX + dx, y: dragRef.current.startObjY + dy } : o));
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const updateTextObj = (id, patch) => setTextObjects(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
  const deleteTextObj = (id) => { setTextObjects(prev => prev.filter(o => o.id !== id)); if (activeTextId === id) setActiveTextId(null); };

  const exportImg = () => {
    flattenText();
    setTimeout(() => {
      const a = document.createElement("a");
      a.download = `${photo?.name || "photo"}.jpg`;
      a.href = canvasRef.current.toDataURL("image/jpeg", 0.95); a.click();
    }, 80);
  };
  const downloadPng = () => {
    flattenText();
    setTimeout(() => {
      const a = document.createElement("a");
      a.download = `${photo?.name || "photo"}_edited.png`;
      a.href = canvasRef.current.toDataURL("image/png"); a.click();
    }, 80);
  };
  const handleDone = () => { flattenText(); setTimeout(onClose, 80); };

  const tools = [
    { id:"pen",    icon:ic.pen,    label:"Draw"   },
    { id:"eraser", icon:"M20.707 5.826l-3.535-3.533a1 1 0 00-1.414 0L.707 17.842A1 1 0 001.414 19.26l7.778.001 11.515-11.434a1 1 0 000-2.001z", label:"Eraser" },
    { id:"text",   icon:ic.text,   label:"Text"   },
    { id:"arrow",  icon:"M5 12h14 M12 5l7 7-7 7", label:"Arrow"  },
    { id:"rect",   icon:"M3 3h18v18H3z",           label:"Square" },
    { id:"circle", icon:"M12 22a10 10 0 100-20 10 10 0 000 20z", label:"Circle" },
  ];

  const cursor = tool === "eraser" ? "cell" : tool === "text" ? "crosshair" : "crosshair";
  const fsPx = Math.round(fontSize * 1.333);

  return (
    <div className="editor-wrap fade-in">
      {/* ── Toolbar ── */}
      <div className="editor-toolbar">
        <button className="btn btn-sm btn-ghost" onClick={onClose}>← Back</button>
        <div className="tool-sep" />
        {tools.map(t => (
          <div key={t.id} className={`tool-btn ${tool===t.id?"active":""}`} title={t.label}
            onClick={() => { if (tool === "text" && t.id !== "text") flattenText(); setTool(t.id); }}>
            <Icon d={t.icon} size={15} />
          </div>
        ))}
        <div className="tool-sep" />
        {tool === "text" && (<>
          <div className={`tool-btn ${textBold?"active":""}`}   title="Bold"      onClick={() => { setTextBold(v=>!v); if (activeTextId) updateTextObj(activeTextId, { bold: !textBold }); }}>   <strong style={{ fontSize:13,fontFamily:"serif" }}>B</strong></div>
          <div className={`tool-btn ${textItalic?"active":""}`} title="Italic"    onClick={() => { setTextItalic(v=>!v); if (activeTextId) updateTextObj(activeTextId, { italic: !textItalic }); }}> <em style={{ fontSize:13,fontFamily:"serif" }}>I</em></div>
          <div className={`tool-btn ${textUnder?"active":""}`}  title="Underline" onClick={() => { setTextUnder(v=>!v); if (activeTextId) updateTextObj(activeTextId, { under: !textUnder }); }}>  <span style={{ fontSize:13,textDecoration:"underline" }}>U</span></div>
          <div className={`tool-btn ${textBg?"active":""}`}     title="Highlight" onClick={() => { setTextBg(v=>!v); if (activeTextId) updateTextObj(activeTextId, { bg: !textBg, bgColor }); }}>  <span style={{ fontSize:10,background:"#e86c3a",color:"white",padding:"1px 4px",borderRadius:3 }}>BG</span></div>
          <div className="tool-sep" />
        </>)}
        <div className="tool-btn" title="Undo" onClick={undo}><Icon d={ic.undo} size={15} /></div>
        <div className="tool-btn" title="Redo" onClick={redo} style={{ transform:"scaleX(-1)" }}><Icon d={ic.undo} size={15} /></div>
        {textObjects.length > 0 && (<>
          <div className="tool-sep" />
          <button className="btn btn-sm btn-secondary" style={{ fontSize:11.5,padding:"4px 10px" }} onClick={flattenText} title="Flatten all text onto canvas">
            Flatten Text
          </button>
        </>)}
        <div style={{ marginLeft:"auto",display:"flex",gap:8 }}>
          <button className="btn btn-sm btn-secondary" onClick={exportImg} title="Download as JPEG"><Icon d={ic.download} size={14} /> JPG</button>
          <button className="btn btn-sm btn-secondary" onClick={downloadPng} title="Download as PNG"
            style={{ background:"var(--surface3)",borderColor:"var(--accent)",color:"var(--accent)" }}>
            <Icon d={ic.download} size={14} /> PNG
          </button>
          <button className="btn btn-sm btn-primary" onClick={handleDone}><Icon d={ic.check} size={14} /> Done</button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="editor-body">
        <div className="canvas-area" style={{ position:"relative" }}>
          <canvas ref={canvasRef} width={640} height={480}
            style={{ borderRadius:8, cursor, border:"1px solid var(--border)", maxWidth:"100%", maxHeight:"100%", display:"block" }}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
            onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
          />

          {/* ── Floating draggable text objects ── */}
          {textObjects.map(obj => (
            <TextOverlay
              key={obj.id}
              obj={obj}
              isActive={activeTextId === obj.id}
              onUpdate={patch => updateTextObj(obj.id, patch)}
              onDelete={() => deleteTextObj(obj.id)}
              onFocus={() => setActiveTextId(obj.id)}
              onDragStart={e => onTextDragStart(e, obj.id)}
              setRef={el => { if (el) domRefs.current[obj.id] = el; else delete domRefs.current[obj.id]; }}
            />
          ))}
        </div>

        {/* ── Sidebar ── */}
        <div className="editor-side">
          <h4>Stroke Color</h4>
          <div className="color-grid">
            {COLORS.map(c => <div key={c} className={`color-dot ${color===c?"sel":""}`} style={{ background:c }}
              onClick={() => { setColor(c); if (activeTextId) updateTextObj(activeTextId, { color: c }); }} />)}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
            <span style={{ fontSize:11,color:"var(--text2)" }}>Custom</span>
            <input type="color" value={color} onChange={e => { setColor(e.target.value); if (activeTextId) updateTextObj(activeTextId, { color: e.target.value }); }}
              style={{ width:28,height:28,borderRadius:6,border:"1px solid var(--border)",cursor:"pointer",padding:2,background:"none" }} />
          </div>

          <h4>Background / Fill</h4>
          <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginBottom:6 }}>
            <div onClick={() => { setBgColor("transparent"); if (activeTextId) updateTextObj(activeTextId, { bgColor:"transparent" }); }}
              style={{ width:22,height:22,borderRadius:5,cursor:"pointer",border:`2px solid ${bgColor==="transparent"?"white":"transparent"}`,
                backgroundImage:"linear-gradient(45deg,#666 25%,transparent 25%,transparent 75%,#666 75%),linear-gradient(45deg,#666 25%,transparent 25%,transparent 75%,#666 75%)",
                backgroundSize:"8px 8px",backgroundPosition:"0 0,4px 4px" }} />
            {["rgba(0,0,0,0.5)","rgba(255,255,255,0.5)","#e86c3a","#4a90d9","#3dba7e","#e8c53a","#ff6b6b","#000","#fff","#8b7cf8","#f0954e","#1a1e28"].map(c => (
              <div key={c} className={`color-dot ${bgColor===c?"sel":""}`} style={{ background:c }}
                onClick={() => { setBgColor(c); if (activeTextId) updateTextObj(activeTextId, { bgColor: c }); }} />
            ))}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
            <span style={{ fontSize:11,color:"var(--text2)" }}>Custom</span>
            <input type="color" value={bgColor==="transparent"?"#000000":bgColor}
              onChange={e => { setBgColor(e.target.value); if (activeTextId) updateTextObj(activeTextId, { bgColor: e.target.value }); }}
              style={{ width:28,height:28,borderRadius:6,border:"1px solid var(--border)",cursor:"pointer",padding:2,background:"none" }} />
          </div>

          <h4>Brush / Line Size</h4>
          <input type="range" min="25" max="60" value={size} onChange={e => setSize(+e.target.value)} className="size-slider" />
          <div style={{ fontSize:11.5,color:"var(--text2)",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span>{size}px</span>
            <div style={{ width:Math.min(size,32),height:Math.min(size,32),borderRadius:"50%",background:color,flexShrink:0 }} />
          </div>

          <h4>Font Size</h4>
          <input type="range" min="10" max="50" value={activeTextId ? (textObjects.find(o=>o.id===activeTextId)?.fontSize ?? fontSize) : fontSize}
            onChange={e => {
              setFontSize(+e.target.value);
              if (activeTextId) updateTextObj(activeTextId, { fontSize: +e.target.value });
            }} className="size-slider" />
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <span style={{ fontSize:11.5,color:"var(--text2)" }}>
              {activeTextId ? (textObjects.find(o=>o.id===activeTextId)?.fontSize ?? fontSize) : fontSize}pt
            </span>
            <span style={{ fontSize: Math.min(fontSize, 22), color:"var(--text2)", fontWeight: textBold?"700":"400", fontStyle: textItalic?"italic":"normal", lineHeight:1 }}>Aa</span>
          </div>

          <div className="divider" />
          <h4>Quick Labels</h4>
          {["Damage","Measurement","Note","Hazard","Repair Needed"].map(tag => (
            <div key={tag} style={{ fontSize:12,padding:"6px 0",color:"var(--text2)",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:6,cursor:"pointer" }}
              onClick={() => {
                setTool("text");
                const newObj = { id:Date.now(), x:10, y:10, text:tag, color, bgColor, bold:textBold, italic:textItalic, under:textUnder, bg:textBg, fontSize, editing:true, w:200, h:80 };
                setTextObjects(prev => [...prev, newObj]);
                setActiveTextId(newObj.id);
              }}>
              <span style={{ color:"var(--accent)" }}>+</span>{tag}
            </div>
          ))}
          {photo?.gps && (<>
            <div className="divider" />
            <h4>GPS</h4>
            <div style={{ fontSize:11,color:"var(--green)",lineHeight:1.8 }}>{photo.gps.lat}<br />{photo.gps.lng}</div>
          </>)}
        </div>
      </div>
    </div>
  );
}

// ── New / Edit Project Modal ───────────────────────────────────────────────────
function ProjectModal({ project, onSave, onClose }) {
  const isEdit = !!project;
  const [form, setForm] = useState({
    title:               project?.title               || "",
    address:             project?.address             || "",
    city:                project?.city               || "",
    state:               project?.state               || "",
    zip:                 project?.zip                 || "",
    clientName:          project?.clientName          || "",
    clientEmail:         project?.clientEmail         || "",
    clientPhone:         project?.clientPhone         || "",
    clientRelationship:  project?.clientRelationship  || "",
    occupancyStatus:     project?.occupancyStatus     || "",
    contractorName:      project?.contractorName      || "",
    contractorPhone:     project?.contractorPhone     || "",
    type:                project?.type               || "Renovation",
    status:              project?.status              || "active",
    notes:               project?.notes               || "",
    color:               project?.color               || "#4a90d9",
  });
  const [teamMembers, setTeamMembers] = useState(project?.teamMembers || []);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole]   = useState("Viewer");
  const MEMBER_ROLES = ["Admin","Editor","Viewer","Photographer","Read Only"];
  const [customRooms, setCustomRooms] = useState(
    project?.rooms?.map(r => r.name) || [...DEFAULT_ROOMS]
  );
  const [newRoom, setNewRoom] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const COLORS_PROJECT = ["#4a90d9","#3dba7e","#8b7cf8","#e85a3a","#e8703a","#e8c53a","#3ab8e8","#f0954e"];
  const PROJECT_TYPES = ["Renovation","Insurance Claim","Inspection","Repair","New Construction","Water Damage","Fire Damage","Quote Request","Other"];

  const handleSave = () => {
    if (!form.title.trim()) return;
    const rooms = customRooms.map((n, i) => ({
      id: project?.rooms?.find(r => r.name===n)?.id || uid(),
      name: n, icon: ROOM_ICONS[n] || "📦",
      color: ROOM_COLORS[i % ROOM_COLORS.length],
      photoCount: project?.rooms?.find(r => r.name===n)?.photoCount || 0,
    }));
    onSave({
      id: project?.id || `proj_${uid()}`,
      ...form,
      rooms,
      teamMembers,
      photos:  project?.photos  || [],
      reports: project?.reports || [],
      createdAt: project?.createdAt || today(),
    });
  };

  const addRoom = () => {
    const n = newRoom.trim();
    if (n && !customRooms.includes(n)) { setCustomRooms(r => [...r, n]); setNewRoom(""); }
  };
  const removeRoom = (n) => setCustomRooms(r => r.filter(x => x !== n));

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal modal-lg fade-in" style={{ maxWidth:680 }}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Edit Jobsite" : "New Jobsite"}</div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><Icon d={ic.close} size={16} /></button>
        </div>
        <div className="modal-body">

          {/* Color bar */}
          <div style={{ display:"flex",gap:8,marginBottom:20,alignItems:"center" }}>
            <span style={{ fontSize:11.5,color:"var(--text2)",fontWeight:600,textTransform:"uppercase",letterSpacing:".05em" }}>Project Color</span>
            {COLORS_PROJECT.map(c => (
              <div key={c} onClick={() => set("color", c)} style={{ width:26,height:26,borderRadius:6,background:c,cursor:"pointer",border:form.color===c?"3px solid white":"3px solid transparent",transition:"border .1s" }} />
            ))}
          </div>

          {/* Project info */}
          <div className="form-section">
            <div className="form-section-title"><Icon d={ic.briefcase} size={15} stroke="var(--accent)" /> Project Details</div>
            <div className="form-group">
              <label className="form-label">Job Title *</label>
              <input className="form-input" placeholder="e.g. 123 Oak Street Full Renovation" value={form.title} onChange={e => set("title", e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Project Type</label>
                <select className="form-input form-select" value={form.type} onChange={e => set("type", e.target.value)}>
                  {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input form-select" value={form.status} onChange={e => set("status", e.target.value)}>
                  {Object.entries(STATUS_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="form-section">
            <div className="form-section-title"><Icon d={ic.mapPin} size={15} stroke="var(--accent)" /> Property Address</div>
            <div className="form-group">
              <label className="form-label">Street Address</label>
              <input className="form-input" placeholder="123 Main Street" value={form.address} onChange={e => set("address", e.target.value)} />
            </div>
            <div className="form-row-3">
              <div className="form-group"><label className="form-label">City</label><input className="form-input" placeholder="Denver" value={form.city} onChange={e => set("city", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">State / Province</label><input className="form-input" placeholder="CO or ON" value={form.state} onChange={e => set("state", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">ZIP / Postal Code</label><input className="form-input" placeholder="80202 or M5H 2N2" value={form.zip} onChange={e => set("zip", e.target.value)} /></div>
            </div>
          </div>

          {/* Client */}
          <div className="form-section">
            <div className="form-section-title"><Icon d={ic.user} size={15} stroke="var(--accent)" /> Client Information</div>
            <div className="form-group"><label className="form-label">Client Name</label><input className="form-input" placeholder="Jane Smith" value={form.clientName} onChange={e => set("clientName", e.target.value)} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" placeholder="client@email.com" value={form.clientEmail} onChange={e => set("clientEmail", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-input" placeholder="(555) 000-0000" value={form.clientPhone} onChange={e => set("clientPhone", e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Relationship to Property</label>
                <select className="form-input form-select" value={form.clientRelationship} onChange={e => set("clientRelationship", e.target.value)}>
                  <option value="">— Select —</option>
                  {["Owner","Tenant","Property Manager","Manager","Office Admin","Other"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Building Occupancy Status</label>
                <select className="form-input form-select" value={form.occupancyStatus} onChange={e => set("occupancyStatus", e.target.value)}>
                  <option value="">— Select —</option>
                  {["Occupied","Unoccupied","Vacant","Partially Occupied","Condemned","Restricted","Seasonal Occupancy"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Contractor */}
          <div className="form-section">
            <div className="form-section-title"><Icon d={ic.building} size={15} stroke="var(--accent)" /> Contractor / Inspector</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Company / Name</label><input className="form-input" placeholder="Apex Builders" value={form.contractorName} onChange={e => set("contractorName", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-input" placeholder="(555) 000-0000" value={form.contractorPhone} onChange={e => set("contractorPhone", e.target.value)} /></div>
            </div>
          </div>

          {/* Team Members */}
          <div className="form-section">
            <div className="form-section-title"><Icon d={ic.user} size={15} stroke="var(--accent)" /> Team Members</div>

            {/* Upsell notice */}
            <div style={{ background:"linear-gradient(135deg,rgba(232,108,58,.12),rgba(139,124,248,.1))",border:"1px solid rgba(232,108,58,.3)",borderRadius:"var(--radius-sm)",padding:"12px 14px",marginBottom:16,display:"flex",alignItems:"flex-start",gap:10 }}>
              <div style={{ width:28,height:28,borderRadius:6,background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1 }}>
                <Icon d={ic.star} size={14} stroke="white" fill="white" />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700,fontSize:13,marginBottom:3,color:"var(--text)" }}>Add Users — $9 / user / month</div>
                <div style={{ fontSize:12,color:"var(--text2)",lineHeight:1.55 }}>
                  Each additional user gets their own login, can capture photos, and access this project based on their assigned role. Billed monthly, cancel anytime.
                </div>
              </div>
            </div>

            {/* Existing members */}
            {teamMembers.length > 0 && (
              <div style={{ marginBottom:12 }}>
                {teamMembers.map((m, i) => (
                  <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",marginBottom:6 }}>
                    <div style={{ width:30,height:30,borderRadius:"50%",background:"var(--surface3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12,fontWeight:700,color:"var(--text2)" }}>
                      {m.email[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{m.email}</div>
                    </div>
                    <span style={{ fontSize:11.5,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"var(--surface3)",color:"var(--text2)",flexShrink:0 }}>{m.role}</span>
                    <button className="btn btn-ghost btn-icon" style={{ width:28,height:28,color:"var(--text3)" }}
                      onClick={() => setTeamMembers(prev => prev.filter((_,j) => j !== i))}>
                      <Icon d={ic.close} size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new member row */}
            <div style={{ display:"flex",gap:8,alignItems:"flex-end" }}>
              <div style={{ flex:1 }}>
                <label className="form-label">Email Address</label>
                <input className="form-input" placeholder="colleague@email.com" value={newMemberEmail}
                  onChange={e => setNewMemberEmail(e.target.value)}
                  onKeyDown={e => { if (e.key==="Enter" && newMemberEmail.trim()) { setTeamMembers(prev => [...prev, { email:newMemberEmail.trim(), role:newMemberRole }]); setNewMemberEmail(""); } }} />
              </div>
              <div style={{ width:140 }}>
                <label className="form-label">Role</label>
                <select className="form-input form-select" value={newMemberRole} onChange={e => setNewMemberRole(e.target.value)}>
                  {MEMBER_ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <button className="btn btn-secondary" style={{ marginBottom:1 }}
                onClick={() => { if (newMemberEmail.trim()) { setTeamMembers(prev => [...prev, { email:newMemberEmail.trim(), role:newMemberRole }]); setNewMemberEmail(""); } }}>
                <Icon d={ic.plus} size={15} /> Add
              </button>
            </div>
            {teamMembers.length > 0 && (
              <div style={{ marginTop:10,fontSize:12,color:"var(--text2)" }}>
                {teamMembers.length} user{teamMembers.length !== 1 ? "s" : ""} added · <span style={{ color:"var(--accent)",fontWeight:600 }}>+${teamMembers.length * 9}/mo</span> added to your plan
              </div>
            )}
          </div>

          {/* Rooms */}
          <div className="form-section">
            <div className="form-section-title"><Icon d={ic.rooms} size={15} stroke="var(--accent)" /> Rooms / Areas</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:7,marginBottom:12 }}>
              {customRooms.map(r => (
                <div key={r} style={{ display:"flex",alignItems:"center",gap:5,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:20,padding:"4px 10px 4px 10px",fontSize:13 }}>
                  <span>{ROOM_ICONS[r]||"📦"}</span>
                  <span>{r}</span>
                  <span style={{ color:"var(--text3)",cursor:"pointer",marginLeft:2,fontSize:12,lineHeight:1 }} onClick={() => removeRoom(r)}>×</span>
                </div>
              ))}
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <input className="form-input" style={{ flex:1 }} placeholder="Add custom room (e.g. Sunroom)…" value={newRoom} onChange={e => setNewRoom(e.target.value)} onKeyDown={e => e.key==="Enter"&&addRoom()} />
              <button className="btn btn-secondary" onClick={addRoom}><Icon d={ic.plus} size={15} /></button>
            </div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginTop:10 }}>
              {Object.keys(ROOM_ICONS).filter(n => !customRooms.includes(n)).map(n => (
                <div key={n} style={{ fontSize:12,background:"var(--surface3)",border:"1px dashed var(--border)",borderRadius:20,padding:"3px 10px",cursor:"pointer",color:"var(--text2)" }}
                  onClick={() => setCustomRooms(r => [...r, n])}>+ {n}</div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input form-textarea" placeholder="Any notes about this project…" value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!form.title.trim()}>
            <Icon d={ic.check} size={14} /> {isEdit ? "Save Changes" : "Create Jobsite"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Projects List (Home) ───────────────────────────────────────────────────────
function ProjectsList({ projects, onSelect, onNew, onEdit, onDelete }) {
  const [showDeleteId, setShowDeleteId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = projects
    .filter(p => filterStatus === "all" || p.status === filterStatus)
    .filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.address.toLowerCase().includes(search.toLowerCase()) || p.clientName.toLowerCase().includes(search.toLowerCase()));

  const totalPhotos = projects.reduce((a, p) => a + (p.photos?.length || 0), 0);

  return (
    <div className="page fade-in">
      {/* Top stats */}
      <div className="stats-grid">
        {[
          { label:"Total Jobsites", value:String(projects.length),  sub:`${projects.filter(p=>p.status==="active").length} active`, cls:"orange" },
          { label:"Total Photos",   value:String(totalPhotos),      sub:"Across all projects",                                       cls:"blue"   },
          { label:"Active Reports", value:String(projects.reduce((a,p)=>a+(p.reports?.length||0),0)), sub:"Across all projects",     cls:"green"  },
          { label:"Completed",      value:String(projects.filter(p=>p.status==="completed").length),  sub:"Finished projects",       cls:"purple" },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.cls}`}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap" }}>
        <input className="form-input" style={{ width:260,padding:"8px 14px" }} placeholder="Search jobsites, addresses, clients…" value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display:"flex",gap:6 }}>
          {[["all","All"],["active","Active"],["onhold","On Hold"],["completed","Completed"],["archived","Archived"]].map(([k,l]) => (
            <button key={k} className={`btn btn-sm ${filterStatus===k?"btn-primary":"btn-secondary"}`} onClick={() => setFilterStatus(k)}>{l}</button>
          ))}
        </div>
        <button className="btn btn-primary" style={{ marginLeft:"auto" }} onClick={onNew}><Icon d={ic.plus} size={16} /> New Jobsite</button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><Icon d={ic.briefcase} size={28} stroke="var(--text3)" /></div>
          <h3>{search ? "No results found" : "No jobsites yet"}</h3>
          <p>{search ? "Try a different search term." : "Create your first jobsite to start capturing photos and building reports."}</p>
          {!search && <button className="btn btn-primary" onClick={onNew}><Icon d={ic.plus} size={15} /> Create First Jobsite</button>}
        </div>
      ) : (
        <div className="grid-3">
          {filtered.map(project => {
            const sm = STATUS_META[project.status] || STATUS_META.active;
            return (
              <div key={project.id} className="project-card" onClick={() => onSelect(project)}>
                <div className="project-card-bar" style={{ background: project.color }} />
                <div className="project-card-body">
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6 }}>
                    <div className="project-card-title">{project.title}</div>
                    <span className={`tag tag-${sm.cls}`} style={{ flexShrink:0 }}>{sm.label}</span>
                  </div>
                  <div className="project-card-addr"><Icon d={ic.mapPin} size={12} stroke="var(--text3)" />{project.address}{project.city ? `, ${project.city}` : ""}{project.state ? `, ${project.state}` : ""}</div>
                  <div className="project-card-meta">
                    <div className="project-card-stat"><Icon d={ic.camera} size={12} />{project.photos?.length || 0} photos</div>
                    <div className="project-card-stat"><Icon d={ic.rooms} size={12} />{project.rooms?.length || 0} rooms</div>
                    <div className="project-card-stat"><Icon d={ic.reports} size={12} />{project.reports?.length || 0} reports</div>
                  </div>
                  <div style={{ fontSize:11,color:"var(--text2)",background:"var(--surface2)",borderRadius:6,padding:"5px 9px",display:"inline-flex",alignItems:"center",gap:5 }}>
                    <Icon d={ic.hash} size={11} />{project.type}
                  </div>
                </div>
                <div className="project-card-footer">
                  <div className="project-card-client"><Icon d={ic.user} size={12} />{project.clientName || "No client set"}</div>
                  <div style={{ display:"flex",gap:6 }} onClick={e => e.stopPropagation()}>
                    <button className="btn btn-sm btn-ghost btn-icon" title="Edit" onClick={() => onEdit(project)}><Icon d={ic.edit} size={14} /></button>
                    <button className="btn btn-sm btn-ghost btn-icon" title="Delete" onClick={() => setShowDeleteId(project.id)}><Icon d={ic.trash} size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
          {/* New jobsite card */}
          <div className="project-card" style={{ border:"2px dashed var(--border)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:200 }} onClick={onNew}>
            <div style={{ width:52,height:52,borderRadius:"50%",background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12 }}>
              <Icon d={ic.plus} size={24} stroke="var(--accent)" />
            </div>
            <div style={{ fontSize:13,fontWeight:700,color:"var(--text2)" }}>New Jobsite</div>
            <div style={{ fontSize:12,color:"var(--text3)",marginTop:4 }}>Create a new project</div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {showDeleteId && (() => { const proj = projects.find(p=>p.id===showDeleteId); return (
        <div className="modal-overlay" onClick={() => setShowDeleteId(null)}>
          <div className="modal fade-in" style={{ maxWidth:440 }}>
            <div className="modal-header"><div className="modal-title">Delete Jobsite?</div><button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowDeleteId(null)}><Icon d={ic.close} size={16} /></button></div>
            <div className="modal-body">
              <p style={{ fontSize:13.5,lineHeight:1.6,color:"var(--text2)" }}>Are you sure you want to delete <strong style={{ color:"var(--text)" }}>{proj?.title}</strong>? This will permanently delete all {proj?.photos?.length || 0} photos and {proj?.reports?.length || 0} reports associated with this project.</p>
              <div className="confirm-box">
                <Icon d={ic.alert} size={20} stroke="#ff6b6b" />
                <span style={{ fontSize:13,color:"#ff6b6b" }}>This action cannot be undone.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { onDelete(showDeleteId); setShowDeleteId(null); }}>Delete Jobsite</button>
            </div>
          </div>
        </div>
      ); })()}
    </div>
  );
}

// ── Project Detail (tabs: Overview, Photos, Rooms, Reports) ───────────────────
function ProjectDetail({ project, onBack, onEdit, onOpenCamera, onEditPhoto, onUpdateProject, onOpenReportCreator }) {
  const [tab, setTab] = useState("overview");
  const fileRef = useRef();
  const sm = STATUS_META[project.status] || STATUS_META.active;

  const addUploadedPhotos = (files) => {
    const newPhotos = [];
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        newPhotos.push({ id:uid(), name:file.name.replace(/\.[^/.]+$/, ""), room: project.rooms?.[0]?.name || "General", date:today(), tags:["uploaded"], dataUrl:e.target.result });
        if (newPhotos.length === files.length) {
          onUpdateProject({ ...project, photos:[...project.photos, ...newPhotos] });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const deletePhoto = (photoId) => onUpdateProject({ ...project, photos: project.photos.filter(p => p.id !== photoId) });

  const TABS = [
    { id:"overview", label:"Overview",  icon:ic.activity },
    { id:"photos",   label:`Photos (${project.photos?.length||0})`, icon:ic.camera },
    { id:"rooms",    label:`Rooms (${project.rooms?.length||0})`,   icon:ic.rooms  },
    { id:"reports",  label:`Reports (${project.reports?.length||0})`,icon:ic.reports},
  ];

  return (
    <div className="page fade-in">
      {/* Project hero */}
      <div className="project-hero">
        <div className="project-hero-bar" style={{ background:project.color }} />
        <div className="project-hero-body">
          <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12 }}>
            <div style={{ flex:1,minWidth:0 }}>
              <div className="project-hero-title">{project.title}</div>
              <div className="project-hero-addr">
                <Icon d={ic.mapPin} size={14} stroke="var(--text3)" />
                {[project.address, project.city, project.state, project.zip].filter(Boolean).join(", ")}
              </div>
            </div>
            <div style={{ display:"flex",gap:8,alignItems:"center",flexShrink:0 }}>
              <span className={`tag tag-${sm.cls}`}>{sm.label}</span>
              <button className="btn btn-sm btn-secondary" onClick={() => onEdit(project)}><Icon d={ic.edit} size={14} /> Edit</button>
              <button className="btn btn-sm btn-primary" onClick={() => onOpenCamera(project)}><Icon d={ic.camera} size={14} /> Camera</button>
            </div>
          </div>

          <div className="project-info-grid" style={{ marginTop:16 }}>
            <div className="project-info-box">
              <div className="project-info-label"><Icon d={ic.user} size={11} /> Client</div>
              <div className="project-info-value">{project.clientName || "—"}</div>
              {project.clientPhone && <div className="project-info-sub">{project.clientPhone}</div>}
              {project.clientEmail && <div className="project-info-sub">{project.clientEmail}</div>}
            </div>
            <div className="project-info-box">
              <div className="project-info-label"><Icon d={ic.building} size={11} /> Contractor</div>
              <div className="project-info-value">{project.contractorName || "—"}</div>
              {project.contractorPhone && <div className="project-info-sub">{project.contractorPhone}</div>}
            </div>
            <div className="project-info-box">
              <div className="project-info-label"><Icon d={ic.clockIcon} size={11} /> Details</div>
              <div className="project-info-value">{project.type}</div>
              <div className="project-info-sub">Created {project.createdAt}</div>
            </div>
          </div>

          {project.notes && (
            <div style={{ marginTop:14,padding:"10px 14px",background:"var(--surface2)",borderRadius:8,fontSize:13,color:"var(--text2)",lineHeight:1.6 }}>
              <strong style={{ color:"var(--text)" }}>Notes: </strong>{project.notes}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex",gap:4,marginBottom:20,borderBottom:"1px solid var(--border)",paddingBottom:0 }}>
        {TABS.map(t => (
          <button key={t.id} className="btn btn-ghost btn-sm" style={{ borderBottom:`2px solid ${tab===t.id?"var(--accent)":"transparent"}`,borderRadius:0,paddingBottom:12,color:tab===t.id?"var(--accent)":"var(--text2)",fontWeight:tab===t.id?700:500 }}
            onClick={() => setTab(t.id)}>
            <Icon d={t.icon} size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><span style={{ fontWeight:700 }}>Photo Summary</span></div>
            <div className="card-body" style={{ padding:"12px 16px" }}>
              {project.rooms?.map(room => (
                <div key={room.id} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                  <span style={{ fontSize:18 }}>{room.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13,fontWeight:600,marginBottom:3 }}>{room.name}</div>
                    <div style={{ background:"var(--surface2)",borderRadius:4,height:5,overflow:"hidden" }}>
                      <div style={{ height:"100%",background:room.color,width:`${Math.min(100,(project.photos?.filter(p=>p.room===room.name).length/Math.max(1,project.photos?.length))*100)}%` }} />
                    </div>
                  </div>
                  <span style={{ fontSize:12,color:"var(--text2)",minWidth:28,textAlign:"right" }}>{project.photos?.filter(p=>p.room===room.name).length || 0}</span>
                </div>
              ))}
              {(!project.photos?.length) && <div style={{ fontSize:13,color:"var(--text3)",textAlign:"center",padding:12 }}>No photos yet</div>}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span style={{ fontWeight:700 }}>Quick Actions</span></div>
            <div className="card-body">
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                <button className="btn btn-primary" style={{ justifyContent:"center" }} onClick={() => onOpenCamera(project)}><Icon d={ic.camera} size={15} /> Open Live Camera</button>
                <button className="btn btn-secondary" style={{ justifyContent:"center" }} onClick={() => { fileRef.current?.click(); }}><Icon d={ic.image} size={15} /> Upload Photos</button>
                <button className="btn btn-secondary" style={{ justifyContent:"center" }} onClick={() => setTab("reports")}><Icon d={ic.reports} size={15} /> Create Report</button>
                <button className="btn btn-secondary" style={{ justifyContent:"center" }} onClick={() => onEdit(project)}><Icon d={ic.edit} size={15} /> Edit Project Info</button>
              </div>
              <input ref={fileRef} type="file" multiple accept="image/*" style={{ display:"none" }} onChange={e => addUploadedPhotos(e.target.files)} />
            </div>
          </div>
        </div>
      )}

      {/* Photos tab */}
      {tab === "photos" && (
        <div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ fontSize:13,color:"var(--text2)" }}>{project.photos?.length || 0} photos in this project</div>
            <div style={{ display:"flex",gap:8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}><Icon d={ic.image} size={13} /> Upload</button>
              <button className="btn btn-primary btn-sm" onClick={() => onOpenCamera(project)}><Icon d={ic.camera} size={13} /> Live Camera</button>
            </div>
          </div>
          <input ref={fileRef} type="file" multiple accept="image/*" style={{ display:"none" }} onChange={e => addUploadedPhotos(e.target.files)} />
          {project.photos?.length === 0 ? (
            <div className="empty">
              <div className="empty-icon"><Icon d={ic.camera} size={28} stroke="var(--text3)" /></div>
              <h3>No photos yet</h3>
              <p>Open the live camera or upload photos to start documenting this jobsite.</p>
              <button className="btn btn-primary" onClick={() => onOpenCamera(project)}><Icon d={ic.camera} size={15} /> Open Camera</button>
            </div>
          ) : (
            <div className="grid-4">
              {project.photos.map(photo => (
                <div key={photo.id} className="photo-card">
                  <div className="photo-card-img" onClick={() => onEditPhoto(photo)}>
                    {photo.dataUrl ? <img src={photo.dataUrl} alt={photo.name} /> : (
                      <div className="photo-placeholder"><Icon d={ic.image} size={32} stroke={photo.color||"var(--accent)"} /><span style={{ fontSize:10,color:"var(--text3)" }}>{photo.room}</span></div>
                    )}
                    {photo.gps && <div style={{ position:"absolute",bottom:5,left:5 }}><span className="pill" style={{ fontSize:9,padding:"3px 7px" }}><Icon d={ic.mapPin} size={9} stroke="#3dba7e" />GPS</span></div>}
                    <div style={{ position:"absolute",top:5,right:5,opacity:0,transition:"opacity .15s" }} className="photo-actions">
                      <button className="btn btn-sm btn-danger btn-icon" onClick={e => { e.stopPropagation(); deletePhoto(photo.id); }}><Icon d={ic.trash} size={12} /></button>
                    </div>
                  </div>
                  <div className="photo-card-info">
                    <div className="photo-card-name">{photo.name}</div>
                    <div className="photo-card-meta">{photo.room} · {photo.date}</div>
                    <div>{photo.tags?.map(t => <span key={t} className="photo-tag">{t}</span>)}</div>
                  </div>
                </div>
              ))}
              <div className="photo-card" style={{ border:"2px dashed var(--border)",cursor:"pointer" }} onClick={() => onOpenCamera(project)}>
                <div className="photo-card-img" style={{ minHeight:120 }}>
                  <div className="photo-placeholder">
                    <div style={{ width:44,height:44,borderRadius:"50%",background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={ic.plus} size={20} stroke="var(--accent)" /></div>
                    <span style={{ fontSize:11,color:"var(--text2)" }}>Add photo</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <style>{`.photo-card:hover .photo-actions{opacity:1!important}`}</style>
        </div>
      )}

      {/* Rooms tab */}
      {tab === "rooms" && (
        <div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ fontSize:13,color:"var(--text2)" }}>{project.rooms?.length || 0} rooms defined</div>
            <button className="btn btn-secondary btn-sm" onClick={() => onEdit(project)}><Icon d={ic.edit} size={13} /> Manage Rooms</button>
          </div>
          <div className="grid-4">
            {project.rooms?.map(room => {
              const count = project.photos?.filter(p => p.room===room.name).length || 0;
              return (
                <div key={room.id} className="room-card" onClick={() => onOpenCamera({ ...project, _defaultRoom:room.name })}>
                  <div className="room-icon-wrap" style={{ background:room.color+"20" }}><span style={{ fontSize:20 }}>{room.icon}</span></div>
                  <div className="room-name">{room.name}</div>
                  <div className="room-count">{count} photo{count!==1?"s":""}</div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width:`${Math.min(100,(count/Math.max(1,...(project.rooms?.map(r=>project.photos?.filter(p=>p.room===r.name).length||0)||[1])))*100)}%`,background:room.color }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reports tab */}
      {tab === "reports" && (
        <div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ fontSize:13,color:"var(--text2)" }}>{project.reports?.length || 0} report{project.reports?.length !== 1 ? "s" : ""} for this project</div>
            <button className="btn btn-primary btn-sm" onClick={() => onOpenReportCreator(project, null)}>
              <Icon d={ic.plus} size={13} /> New Report
            </button>
          </div>
          {project.reports?.length === 0 ? (
            <div className="empty">
              <div className="empty-icon"><Icon d={ic.reports} size={28} stroke="var(--text3)" /></div>
              <h3>No reports yet</h3>
              <p>Create a report to compile photos and information for insurance, contractors, or inspections.</p>
              <button className="btn btn-primary" onClick={() => onOpenReportCreator(project, null)}>
                <Icon d={ic.plus} size={15} /> Create Report
              </button>
            </div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {project.reports?.map(r => (
                <div key={r.id} className="report-row">
                  <div className="report-row-icon" style={{ background:(r.color||"#4a90d9")+"20" }}>
                    <Icon d={ic.reports} size={16} stroke={r.color||"#4a90d9"} />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600,fontSize:13.5,marginBottom:2 }}>{r.title}</div>
                    <div style={{ fontSize:12,color:"var(--text2)" }}>
                      {r.reportType||r.type} · {r.date} · {r.photos||0} photo{r.photos!==1?"s":""}
                    </div>
                  </div>
                  <span className={`tag tag-${r.status==="sent"?"green":r.status==="final"?"blue":r.status==="review"?"purple":"orange"}`}>
                    {r.status}
                  </span>
                  <div className="report-row-actions">
                    <button className="btn btn-sm btn-secondary" onClick={() => onOpenReportCreator(project, r)}>
                      <Icon d={ic.edit} size={12} /> Open
                    </button>
                    <button className="btn btn-sm btn-danger btn-icon"
                      onClick={() => onUpdateProject({ ...project, reports: project.reports.filter(x => x.id !== r.id) })}>
                      <Icon d={ic.trash} size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Report Pages (paginated preview) ──────────────────────────────────────────
// Estimates block heights and splits them into 8.5×11 pages (816×1056px at 96dpi).
// Header/footer on each page consume fixed space; remaining body space is filled
// block by block. A block that is too tall to fit starts a new page.

const PAGE_W   = 816;
const PAGE_H   = 1056;
const HEADER_H = 52;   // continuation header
const FOOTER_H = 38;   // footer + optional disclaimer
const COVER_H  = 1056; // page 1 is always exactly one page

// Estimate the rendered height of a block (conservative pixel estimates)
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
  if (block.type === "textphoto") {
    const colW = (PAGE_W - 72 - 16) / 2;
    const photoH = colW * 3/4 + 28;
    const textLines = Math.max(1, Math.ceil((block.sideText||"").length / 42));
    return 18 + Math.max(photoH, textLines * 21.25);
  }
  return 60;
}

function PageFooter({ accentColor, settings, pageNum, isLast }) {
  return (
    <>
      <div style={{ padding:"10px 36px",borderTop:`2px solid ${accentColor}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fafafa",flexShrink:0 }}>
        <span style={{ fontSize:10,color:"#888" }}>{settings?.reportFooterLeft||settings?.companyName||""}{settings?.phone?` · ${settings.phone}`:""}</span>
        <span style={{ fontSize:10,color:accentColor,fontWeight:600 }}>{settings?.reportFooterCenter||"Confidential"}</span>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:9,color:"#bbb",letterSpacing:".06em" }}>POWERED BY SITESNAP PRO</div>
          <div style={{ fontSize:9.5,color:"#aaa" }}>Page {pageNum}</div>
        </div>
      </div>
      {isLast && settings?.reportFooterDisclaimer && (
        <div style={{ padding:"8px 36px",fontSize:9.5,color:"#bbb",lineHeight:1.6,background:"#fafafa",borderTop:"1px solid #eee",flexShrink:0 }}>{settings.reportFooterDisclaimer}</div>
      )}
    </>
  );
}

function BlockRenderer({ block, showGps, showTimestamp, showRooms, gridClass }) {
  if (block.type === "divider") return (
    <div style={{ padding:"14px 36px 8px" }}>
      <div style={{ fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"#444",display:"flex",alignItems:"center",gap:8 }}>
        {block.label||"Section"}<div style={{ flex:1,height:1,background:"#e8e8e8" }} />
      </div>
    </div>
  );
  if (block.type === "text") return (
    <div style={{ padding:"6px 36px 12px" }}>
      <div style={{ fontSize:12.5,lineHeight:1.7,color:"#333",whiteSpace:"pre-wrap" }}>{block.content}</div>
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
              {ph.dataUrl ? <img src={ph.dataUrl} alt={ph.name} style={{ width:"100%",display:"block",aspectRatio:"4/3",objectFit:"cover" }} /> : <div style={{ aspectRatio:"4/3",background:"#eee" }} />}
              <div style={{ padding:"4px 6px",fontSize:9.5,color:"#555",background:"#fafafa",borderTop:"1px solid #eee" }}>
                <div>{ph.name||"Photo"}</div>
                <div style={{ display:"flex",gap:8,fontSize:8.5,color:"#aaa",marginTop:1 }}>
                  {showRooms && ph.room && <span>📍 {ph.room}</span>}
                  {showTimestamp && ph.date && <span>🕐 {ph.date}</span>}
                  {showGps && ph.gps && <span>🌐 {ph.gps.lat}, {ph.gps.lng}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
        {block.caption && <div style={{ fontSize:11,color:"#888",fontStyle:"italic" }}>{block.caption}</div>}
      </div>
    );
  }
  if (block.type === "textphoto") return (
    <div style={{ padding:"6px 36px 12px" }}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start" }}>
        <div style={{ fontSize:12.5,lineHeight:1.7,color:"#333",whiteSpace:"pre-wrap" }}>{block.sideText}</div>
        <div>
          {(block.photos||[]).length>0
            ? <div style={{ borderRadius:4,overflow:"hidden",border:"1px solid #e8e8e8" }}>
                <img src={block.photos[0].dataUrl} alt="" style={{ width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block" }} />
                <div style={{ padding:"4px 6px",fontSize:9.5,color:"#555",background:"#fafafa" }}>
                  {block.photos[0].name}
                  {showRooms && block.photos[0].room && <span style={{ color:"#aaa",marginLeft:6 }}>📍 {block.photos[0].room}</span>}
                </div>
              </div>
            : <div style={{ aspectRatio:"4/3",background:"#f0f0f0",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",color:"#ccc",fontSize:12 }}>No photo</div>
          }
        </div>
      </div>
    </div>
  );
  return null;
}

function ReportPages({ title, reportType, accentColor, project, coverPhoto, blocks, settings, showCoverInfo, showGps, showTimestamp, showRooms, gridClass }) {
  const today = new Date().toLocaleDateString();

  // ── Page 1: cover + property info (always fills exactly one page) ──
  const page1 = (
    <div key="p1" style={{ width:PAGE_W,height:PAGE_H,background:"white",boxShadow:"0 4px 40px rgba(0,0,0,.6)",marginBottom:2,fontFamily:"'Inter',system-ui,sans-serif",color:"#1a1a1a",display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden" }}>
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
              <div style={{ fontSize:10.5,color:"#777" }}>{settings?.phone}{settings?.email?` · ${settings.email}`:""}</div>
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontWeight:700,fontSize:14,color:"#111" }}>{settings?.reportHeaderTitle||"Property Report"}</div>
            <div style={{ fontSize:10.5,color:"#777" }}>{reportType} · {today}</div>
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
              {project.address && <span>📍 {[project.address,project.city,project.state].filter(Boolean).join(", ")}</span>}
              {project.clientName && <span>👤 {project.clientName}</span>}
            </div>
          </div>
        )}
      </div>
      {/* Property info */}
      <div style={{ padding:"18px 36px",borderBottom:"1px solid #eee",flexShrink:0 }}>
        <div style={{ fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"#444",marginBottom:10,display:"flex",alignItems:"center",gap:8 }}>
          Property & Client Information <div style={{ flex:1,height:1,background:"#e8e8e8" }} />
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 24px" }}>
          {[
            ["Property Address",[project.address,project.city,project.state,project.zip].filter(Boolean).join(", ")],
            ["Client",project.clientName||"—"],
            ["Client Email",project.clientEmail||"—"],
            ["Client Phone",project.clientPhone||"—"],
            ["Relationship",project.clientRelationship||"—"],
            ["Occupancy",project.occupancyStatus||"—"],
            ["Project Type",project.type||"—"],
            ["Report Date",today],
          ].map(([l,v])=>(
            <div key={l}>
              <div style={{ fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"#999" }}>{l}</div>
              <div style={{ fontSize:11.5,color:"#222",fontWeight:500 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Contractor row if present */}
      {project.contractorName && (
        <div style={{ padding:"12px 36px",borderBottom:"1px solid #eee",display:"flex",gap:32,flexShrink:0 }}>
          <div>
            <div style={{ fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"#999" }}>Contractor</div>
            <div style={{ fontSize:11.5,color:"#222",fontWeight:500 }}>{project.contractorName}</div>
          </div>
          {project.contractorPhone && (
            <div>
              <div style={{ fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"#999" }}>Phone</div>
              <div style={{ fontSize:11.5,color:"#222",fontWeight:500 }}>{project.contractorPhone}</div>
            </div>
          )}
        </div>
      )}
      {/* Spacer + footer */}
      <div style={{ flex:1 }} />
      <PageFooter accentColor={accentColor} settings={settings} pageNum={1} isLast={blocks.length===0} />
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
        {/* Page label */}
        <div style={{ width:PAGE_W,height:28,display:"flex",alignItems:"center",gap:12,padding:"0 4px",marginBottom:2 }}>
          <div style={{ flex:1,height:1,borderTop:"1px dashed #3a4050" }} />
          <span style={{ fontSize:10,color:"#555",letterSpacing:".05em",whiteSpace:"nowrap" }}>PAGE {pageNum}</span>
          <div style={{ flex:1,height:1,borderTop:"1px dashed #3a4050" }} />
        </div>
        {/* Page */}
        <div style={{ width:PAGE_W,minHeight:PAGE_H,background:"white",boxShadow:"0 4px 40px rgba(0,0,0,.6)",marginBottom:2,fontFamily:"'Inter',system-ui,sans-serif",color:"#1a1a1a",display:"flex",flexDirection:"column",flexShrink:0 }}>
          {/* Continuation header */}
          <div style={{ padding:"14px 36px 10px",borderBottom:`2px solid ${accentColor}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,height:HEADER_H,boxSizing:"border-box" }}>
            <div style={{ fontWeight:700,fontSize:13,color:"#333" }}>{title}</div>
            <div style={{ fontSize:10.5,color:"#999" }}>{reportType} · {today}</div>
          </div>
          {/* Blocks */}
          <div style={{ flex:1,paddingTop:4 }}>
            {pageBlocks.map(block => (
              <BlockRenderer key={block.id} block={block} showGps={showGps} showTimestamp={showTimestamp} showRooms={showRooms} gridClass={gridClass} />
            ))}
          </div>
          {/* Footer */}
          <PageFooter accentColor={accentColor} settings={settings} pageNum={pageNum} isLast={isLast} />
        </div>
      </div>
    );
  });

  return <>{page1}{contentPages}</>;
}


const BLOCK_TYPES = [
  { id:"text",       label:"Text Block",        icon:ic.text      },
  { id:"photos",     label:"Photo Grid",         icon:ic.image     },
  { id:"textphoto",  label:"Text + Photo",       icon:ic.copy      },
  { id:"divider",    label:"Section Divider",    icon:ic.hash      },
];

function ReportCreator({ project, reportData, settings, templates, onSave, onClose }) {
  const isNew = !reportData;
  const coverRef  = useRef();
  const photoLayout = settings?.reportPhotoLayout || "3 per row";
  const colMap = { "2 per row":"rp-photo-grid-2","3 per row":"rp-photo-grid-3","4 per row":"rp-photo-grid-4","Full width":"rp-photo-grid-2" };

  // ── Report meta ──
  const [title,       setTitle]       = useState(reportData?.title       || `${project.title} — Report`);
  const [reportType,  setReportType]  = useState(reportData?.reportType  || settings?.defaultReportType || "Assessment");
  const [status,      setStatus]      = useState(reportData?.status      || "draft");
  const [coverPhoto,  setCoverPhoto]  = useState(reportData?.coverPhoto  || null);
  const [selectedTpl, setSelectedTpl] = useState(null);

  // ── Display toggles (start from settings defaults) ──
  const [showGps,       setShowGps]       = useState(settings?.reportShowGps !== "no");
  const [showTimestamp, setShowTimestamp] = useState(settings?.reportShowTimestamp !== "no");
  const [showRooms,     setShowRooms]     = useState(true);
  const [showCoverInfo, setShowCoverInfo] = useState(true);
  const [previewOpen,   setPreviewOpen]   = useState(false);

  // ── Content blocks ──
  const [blocks, setBlocks] = useState(reportData?.blocks || [
    { id:uid(), type:"text",   content:"Enter your report summary here. Describe the property, the purpose of this report, and any key findings." },
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

  const accentColor = settings?.accent || "#e86c3a";

  // Apply template
  const applyTemplate = (tpl) => {
    if (!tpl) return;
    setSelectedTpl(tpl);
    const sectionBlocks = [];
    const sections = ["Cover Page","Property Information","Scope of Work","Report","Damage Summary","Photo Documentation","Sign Off","Signature Block"];
    sections.forEach(s => {
      if (s === "Cover Page") return; // handled separately
      if (s === "Photo Documentation") {
        sectionBlocks.push({ id:uid(), type:"divider", label:s });
        sectionBlocks.push({ id:uid(), type:"photos", photos:[], caption:"" });
      } else if (s === "Signature Block" || s === "Sign Off") {
        sectionBlocks.push({ id:uid(), type:"divider", label:s });
        sectionBlocks.push({ id:uid(), type:"text", content:`Prepared by: ${settings?.userFirstName||""} ${settings?.userLastName||""}\nTitle: ${settings?.userTitle||""}\nDate: ${new Date().toLocaleDateString()}\n\nSignature: _________________________` });
      } else {
        sectionBlocks.push({ id:uid(), type:"divider", label:s });
        sectionBlocks.push({ id:uid(), type:"text", content:`${s} details go here.` });
      }
    });
    setBlocks(sectionBlocks);
  };

  const addBlock = (type, afterId) => {
    const newBlock = { id:uid(), type,
      content: type==="text"?"Enter text here...": type==="divider"?"Section Title": "",
      photos: type==="photos"||type==="textphoto" ? [] : undefined,
      label:  type==="divider" ? "Section" : undefined,
      caption: type==="photos" ? "" : undefined,
      sideText: type==="textphoto" ? "Describe what's shown in this photo." : undefined,
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
    const saved = { id: reportData?.id || uid(), title, reportType, status, coverPhoto, blocks, date: today(), photos: blocks.reduce((a,b)=>a+(b.photos?.length||0),0) };
    onSave(saved);
  };

  const gridClass = colMap[photoLayout] || "rp-photo-grid-3";

  // ── Render ──
  return (
    <div className="rc-wrap">

      {/* Top bar */}
      <div className="rc-topbar">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>← Back</button>
        <div style={{ width:1,height:20,background:"var(--border)" }} />
        <input value={title} onChange={e=>setTitle(e.target.value)} style={{ background:"transparent",border:"none",outline:"none",fontSize:14,fontWeight:700,color:"var(--text)",flex:1,minWidth:0 }} />
        <div style={{ display:"flex",gap:8,alignItems:"center",marginLeft:"auto" }}>
          <select className="form-input form-select btn-sm" style={{ width:140,padding:"5px 10px",fontSize:12 }} value={status} onChange={e=>setStatus(e.target.value)}>
            {["draft","review","sent","final"].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={()=>setPreviewOpen(true)}><Icon d={ic.eye} size={13} /> Preview</button>
          <button className="btn btn-secondary btn-sm"><Icon d={ic.download} size={13} /> Export PDF</button>
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
          {BLOCK_TYPES.map(bt => (
            <button key={bt.id} className="btn btn-secondary btn-sm" onClick={()=>addBlock(bt.id, blocks[blocks.length-1]?.id)}>
              <Icon d={bt.icon} size={12} />+ {bt.label}
            </button>
          ))}
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
                      <div style={{ fontSize:10.5,color:"#777" }}>{settings?.phone}{settings?.email?` · ${settings.email}`:""}</div>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontWeight:700,fontSize:14,color:"#111" }}>{settings?.reportHeaderTitle||"Property Report"}</div>
                    <div style={{ fontSize:10.5,color:"#777" }}>{reportType} · {new Date().toLocaleDateString()}</div>
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
                      {project.address && <span>📍 {[project.address,project.city,project.state].filter(Boolean).join(", ")}</span>}
                      {project.clientName && <span>👤 {project.clientName}</span>}
                      {project.type && <span>🏷 {project.type}</span>}
                    </div>
                  </div>
                )}
                <input ref={coverFileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleCoverFileUpload} />
              </div>

              {/* Property info */}
              <div className="rp-section">
                <div className="rp-section-title" style={{ "--sec-color":accentColor }}>Property & Client Information</div>
                <div className="rp-info-grid">
                  {[
                    ["Property Address", [project.address,project.city,project.state,project.zip].filter(Boolean).join(", ")],
                    ["Client",           project.clientName || "—"],
                    ["Client Email",     project.clientEmail || "—"],
                    ["Client Phone",     project.clientPhone || "—"],
                    ["Relationship",     project.clientRelationship || "—"],
                    ["Occupancy Status", project.occupancyStatus || "—"],
                    ["Project Type",     project.type || "—"],
                    ["Report Date",      new Date().toLocaleDateString()],
                  ].map(([label,value]) => (
                    <div key={label} className="rp-info-row">
                      <div className="rp-info-label">{label}</div>
                      <div className="rp-info-value">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contractor */}
              {project.contractorName && (
                <div className="rp-section">
                  <div className="rp-section-title">Contractor / Inspector</div>
                  <div className="rp-info-grid">
                    <div className="rp-info-row"><div className="rp-info-label">Company</div><div className="rp-info-value">{project.contractorName}</div></div>
                    {project.contractorPhone && <div className="rp-info-row"><div className="rp-info-label">Phone</div><div className="rp-info-value">{project.contractorPhone}</div></div>}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Page break */}
          <div className="rp-page-break"><div className="rp-page-break-line" /></div>

          {/* Content blocks */}
          {blocks.map((block, idx) => (
            <div key={block.id} className="rc-section-wrap" onClick={e=>{e.stopPropagation();setSelectedBlock(block.id);}}>
              <div className={`rp ${selectedBlock===block.id?"rc-block-selected":""}`}
                style={{ minHeight:"auto",borderBottom:"1px solid #eee",cursor:"pointer",marginBottom:0 }}>

                {/* Block toolbar (visible on hover/select) */}
                {selectedBlock===block.id && (
                  <div style={{ position:"absolute",top:-38,right:0,display:"flex",gap:4,zIndex:20 }}>
                    {BLOCK_TYPES.map(bt=>(
                      <button key={bt.id} className="btn btn-secondary btn-sm" style={{ fontSize:11,padding:"4px 8px" }}
                        onClick={e=>{e.stopPropagation();addBlock(bt.id,block.id);}}>
                        <Icon d={bt.icon} size={11} />+{bt.label.split(" ")[0]}
                      </button>
                    ))}
                    <div style={{ width:1,height:20,background:"var(--border)",margin:"0 2px",alignSelf:"center" }} />
                    <button className="btn btn-ghost btn-sm btn-icon" style={{ width:28,height:28 }} onClick={e=>{e.stopPropagation();moveBlock(block.id,-1);}}><Icon d="M12 19V5 M5 12l7-7 7 7" size={13} /></button>
                    <button className="btn btn-ghost btn-sm btn-icon" style={{ width:28,height:28 }} onClick={e=>{e.stopPropagation();moveBlock(block.id,1);}}><Icon d="M12 5v14 M19 12l-7 7-7-7" size={13} /></button>
                    <button className="btn btn-danger btn-sm btn-icon" style={{ width:28,height:28 }} onClick={e=>{e.stopPropagation();deleteBlock(block.id);}}><Icon d={ic.trash} size={13} /></button>
                  </div>
                )}

                {/* DIVIDER block */}
                {block.type==="divider" && (
                  <div className="rp-section" style={{ paddingTop:16,paddingBottom:12 }}>
                    {editingBlock===block.id
                      ? <input autoFocus value={block.label||""} onChange={e=>updateBlock(block.id,{label:e.target.value})} onBlur={()=>setEditingBlock(null)}
                          style={{ fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"#444",background:"transparent",border:"none",borderBottom:"2px solid "+accentColor,outline:"none",width:"100%",padding:"4px 0" }} />
                      : <div className="rp-section-title" style={{ cursor:"text" }} onDoubleClick={()=>setEditingBlock(block.id)}>{block.label||"Section"}</div>
                    }
                  </div>
                )}

                {/* TEXT block */}
                {block.type==="text" && (
                  <div className="rp-section">
                    {editingBlock===block.id
                      ? <textarea autoFocus value={block.content||""} onChange={e=>updateBlock(block.id,{content:e.target.value})} onBlur={()=>setEditingBlock(null)}
                          style={{ width:"100%",minHeight:100,background:"#fafafa",border:"1px solid #e0e0e0",borderRadius:4,padding:"10px 12px",fontSize:12.5,lineHeight:1.7,fontFamily:"inherit",resize:"vertical",outline:"none" }} />
                      : <div className="rp-text-block" style={{ cursor:"text",minHeight:40,padding:"2px 0" }} onDoubleClick={()=>setEditingBlock(block.id)}>
                          {block.content || <span style={{ color:"#ccc" }}>Double-click to edit…</span>}
                        </div>
                    }
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
                              {ph.dataUrl ? <img src={ph.dataUrl} alt={ph.name} /> : <div style={{ aspectRatio:"4/3",background:"#e8e8e8",display:"flex",alignItems:"center",justifyContent:"center",color:"#ccc" }}><Icon d={ic.image} size={28} stroke="#ccc" /></div>}
                              <div className="rp-photo-caption">
                                <div>{ph.name||"Photo"}</div>
                                <div className="rp-photo-meta">
                                  {showRooms && ph.room && <span>📍 {ph.room}</span>}
                                  {showTimestamp && ph.date && <span>🕐 {ph.date}</span>}
                                  {showGps && ph.gps && <span>🌐 {ph.gps.lat}, {ph.gps.lng}</span>}
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

                {/* TEXT + PHOTO block */}
                {block.type==="textphoto" && (
                  <div className="rp-section">
                    <div className="rp-text-photo">
                      <div>
                        {editingBlock===block.id
                          ? <textarea autoFocus value={block.sideText||""} onChange={e=>updateBlock(block.id,{sideText:e.target.value})} onBlur={()=>setEditingBlock(null)}
                              style={{ width:"100%",minHeight:120,background:"#fafafa",border:"1px solid #e0e0e0",borderRadius:4,padding:"8px 10px",fontSize:12.5,lineHeight:1.7,fontFamily:"inherit",resize:"vertical",outline:"none" }} />
                          : <div className="rp-text-block" style={{ cursor:"text",minHeight:60 }} onDoubleClick={()=>setEditingBlock(block.id)}>
                              {block.sideText||<span style={{ color:"#ccc" }}>Double-click to edit text…</span>}
                            </div>
                        }
                      </div>
                      <div>
                        {(block.photos||[]).length > 0
                          ? <div className="rp-photo-item" style={{ cursor:"pointer" }} onClick={e=>{e.stopPropagation();openPhotoPicker(block.id);}}>
                              <img src={block.photos[0].dataUrl} alt={block.photos[0].name} />
                              <div className="rp-photo-caption">
                                <div>{block.photos[0].name}</div>
                                <div className="rp-photo-meta">
                                  {showRooms && block.photos[0].room && <span>📍 {block.photos[0].room}</span>}
                                  {showTimestamp && block.photos[0].date && <span>🕐 {block.photos[0].date}</span>}
                                  {showGps && block.photos[0].gps && <span>🌐 {block.photos[0].gps.lat}</span>}
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

              </div>

              {/* Add block button between sections */}
              <div className="rc-add-block">
                <div style={{ display:"flex",gap:6 }}>
                  {BLOCK_TYPES.map(bt=>(
                    <button key={bt.id} className="btn btn-secondary btn-sm" style={{ fontSize:11,padding:"4px 10px",background:"var(--surface2)" }}
                      onClick={e=>{e.stopPropagation();addBlock(bt.id,block.id);}}>
                      <Icon d={bt.icon} size={11} />+{bt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Final page footer */}
          <div className="rc-section-wrap">
            <div className="rp" style={{ minHeight:"auto",marginBottom:32 }}>
              <div className="rp-footer" style={{ borderTopColor:accentColor }}>
                <span>{settings?.reportFooterLeft || settings?.companyName || "Company"}{settings?.phone ? ` · ${settings.phone}` : ""}</span>
                <span style={{ color:accentColor,fontWeight:600 }}>{settings?.reportFooterCenter || "Confidential"}</span>
                <div style={{ textAlign:"right" }}>
                  <div className="rp-branding">POWERED BY SITESNAP PRO</div>
                  <div style={{ fontSize:9.5,color:"#aaa" }}>{new Date().toLocaleDateString()}</div>
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
            <div className="rc-sidebar-title">Add Content Block</div>
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              {BLOCK_TYPES.map(bt => (
                <button key={bt.id} className="btn btn-secondary btn-sm" style={{ justifyContent:"flex-start",gap:8,fontSize:12.5 }}
                  onClick={()=>addBlock(bt.id, blocks[blocks.length-1]?.id)}>
                  <Icon d={bt.icon} size={14} />{bt.label}
                </button>
              ))}
            </div>
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

          {selectedBlock && (() => {
            const blk = blocks.find(b=>b.id===selectedBlock);
            if (!blk) return null;
            return (
              <div className="rc-sidebar-section">
                <div className="rc-sidebar-title">Selected Block</div>
                <div style={{ fontSize:12,color:"var(--text2)",marginBottom:10,padding:"8px 10px",background:"var(--surface2)",borderRadius:6,textTransform:"capitalize" }}>{blk.type.replace("textphoto","Text + Photo")}</div>
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {BLOCK_TYPES.map(bt=>(
                    <button key={bt.id} className="btn btn-secondary btn-sm" style={{ justifyContent:"flex-start",gap:7,fontSize:11.5 }}
                      onClick={()=>addBlock(bt.id, selectedBlock)}>
                      <Icon d={bt.icon} size={12} />Add {bt.label} after
                    </button>
                  ))}
                  <button className="btn btn-danger btn-sm" style={{ marginTop:4,justifyContent:"center" }} onClick={()=>deleteBlock(selectedBlock)}>
                    <Icon d={ic.trash} size={12} /> Delete Block
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Preview modal ── */}
      {previewOpen && (
        <div style={{ position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,.85)",display:"flex",flexDirection:"column",overflow:"hidden" }}>
          {/* Preview top bar */}
          <div style={{ height:52,background:"#0d1017",borderBottom:"1px solid #2a2f3e",display:"flex",alignItems:"center",padding:"0 20px",gap:12,flexShrink:0 }}>
            <div style={{ fontWeight:700,fontSize:14,color:"white",flex:1 }}>Print Preview — {title}</div>
            <div style={{ fontSize:12,color:"#666",background:"#1a1e28",padding:"4px 12px",borderRadius:20,border:"1px solid #2a2f3e" }}>8.5" × 11" · US Letter</div>
            <button className="btn btn-secondary btn-sm"><Icon d={ic.download} size={13} /> Export PDF</button>
            <button className="btn btn-ghost btn-sm" style={{ color:"white" }} onClick={()=>setPreviewOpen(false)}>
              <Icon d={ic.close} size={15} /> Close Preview
            </button>
          </div>

          {/* Preview scroll area */}
          <div style={{ flex:1,overflowY:"auto",padding:"32px 0",display:"flex",flexDirection:"column",alignItems:"center",gap:0,background:"#1a1e28" }}>
            <ReportPages
              title={title} reportType={reportType} accentColor={accentColor}
              project={project} coverPhoto={coverPhoto} blocks={blocks}
              settings={settings} showCoverInfo={showCoverInfo}
              showGps={showGps} showTimestamp={showTimestamp} showRooms={showRooms}
              gridClass={gridClass}
            />
            <div style={{ height:48 }} />
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
                          <div style={{ padding:"5px 7px",fontSize:10,color:"var(--text2)",background:"var(--surface)",borderTop:"1px solid var(--border)" }}>{ph.room} · {ph.name?.slice(0,22)}</div>
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
    </div>
  );
}


const ACCENT_PRESETS = [
  { name:"Ember",   value:"#e86c3a" },
  { name:"Sky",     value:"#4a90d9" },
  { name:"Sage",    value:"#3dba7e" },
  { name:"Violet",  value:"#8b7cf8" },
  { name:"Gold",    value:"#e8c53a" },
  { name:"Rose",    value:"#e85a8a" },
  { name:"Teal",    value:"#2ec4b6" },
  { name:"Coral",   value:"#f0614e" },
];

function SettingsPage({ settings, onSave }) {
  const [tab, setTab]   = useState("company");
  const [form, setForm] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const logoRef   = useRef();
  const avatarRef = useRef();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Apply mode change immediately so the UI updates live (before Save)
  const applyMode = (mode) => {
    const applyDark = () => {
      document.documentElement.style.setProperty("--bg",       "#0d0f14");
      document.documentElement.style.setProperty("--surface",  "#13161e");
      document.documentElement.style.setProperty("--surface2", "#1a1e28");
      document.documentElement.style.setProperty("--surface3", "#22273a");
      document.documentElement.style.setProperty("--border",   "#2a2f42");
      document.documentElement.style.setProperty("--text",     "#f0f2f7");
      document.documentElement.style.setProperty("--text2",    "#8b9ab8");
      document.documentElement.style.setProperty("--text3",    "#4a5570");
    };
    const applyLight = () => {
      document.documentElement.style.setProperty("--bg",       "#f0f2f5");
      document.documentElement.style.setProperty("--surface",  "#ffffff");
      document.documentElement.style.setProperty("--surface2", "#f5f6fa");
      document.documentElement.style.setProperty("--surface3", "#e8eaf0");
      document.documentElement.style.setProperty("--border",   "#d8dce8");
      document.documentElement.style.setProperty("--text",     "#111827");
      document.documentElement.style.setProperty("--text2",    "#4b5563");
      document.documentElement.style.setProperty("--text3",    "#9ca3af");
    };
    if (mode === "light") applyLight();
    else if (mode === "dark") applyDark();
    else window.matchMedia("(prefers-color-scheme: light)").matches ? applyLight() : applyDark();
  };

  // Apply density immediately
  const applyDensity = (density) => {
    if (density === "compact") {
      document.documentElement.style.setProperty("--density-page-pad",  "16px");
      document.documentElement.style.setProperty("--density-nav-pad",   "10px 8px 0");
      document.documentElement.style.setProperty("--density-item-pad",  "6px 10px");
      document.documentElement.style.setProperty("--density-card-pad",  "14px");
      document.documentElement.style.setProperty("--density-gap",       "12px");
      document.documentElement.style.setProperty("--density-font",      "12.5px");
      document.documentElement.style.setProperty("--density-topbar-h",  "48px");
    } else {
      document.documentElement.style.setProperty("--density-page-pad",  "26px");
      document.documentElement.style.setProperty("--density-nav-pad",   "14px 12px 0");
      document.documentElement.style.setProperty("--density-item-pad",  "9px 12px");
      document.documentElement.style.setProperty("--density-card-pad",  "20px");
      document.documentElement.style.setProperty("--density-gap",       "20px");
      document.documentElement.style.setProperty("--density-font",      "13.5px");
      document.documentElement.style.setProperty("--density-topbar-h",  "58px");
    }
  };

  const handleSave = () => {
    onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set("logo", ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set("userAvatar", ev.target.result);
    reader.readAsDataURL(file);
  };

  const TABS = [
    { id:"company",  label:"Company",        icon:ic.building   },
    { id:"appearance",label:"Appearance",    icon:ic.grid       },
    { id:"account",  label:"Account",        icon:ic.user       },
    { id:"reports",  label:"Report Defaults",icon:ic.reports    },
  ];

  return (
    <div className="page fade-in" style={{ maxWidth:820 }}>
      <div style={{ marginBottom:24 }}>
        <div className="section-title">Settings</div>
        <div className="section-sub">Manage your company profile, appearance, account, and report defaults</div>
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex",gap:4,borderBottom:"1px solid var(--border)",marginBottom:28 }}>
        {TABS.map(t => (
          <button key={t.id} className="btn btn-ghost btn-sm"
            style={{ borderBottom:`2px solid ${tab===t.id?"var(--accent)":"transparent"}`,borderRadius:0,paddingBottom:12,color:tab===t.id?"var(--accent)":"var(--text2)",fontWeight:tab===t.id?700:500,gap:6 }}
            onClick={() => setTab(t.id)}>
            <Icon d={t.icon} size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* ── COMPANY ── */}
      {tab === "company" && (
        <div className="fade-in">
          {/* Logo upload */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Company Logo</span></div>
            <div className="card-body">
              <div style={{ display:"flex",alignItems:"center",gap:24 }}>
                <div style={{ width:96,height:96,borderRadius:14,background:"var(--surface2)",border:"2px dashed var(--border)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0,cursor:"pointer" }}
                  onClick={() => logoRef.current?.click()}>
                  {form.logo
                    ? <img src={form.logo} alt="logo" style={{ width:"100%",height:"100%",objectFit:"contain",padding:8 }} />
                    : <div style={{ textAlign:"center",color:"var(--text3)" }}><Icon d={ic.image} size={28} /><div style={{ fontSize:10,marginTop:4 }}>Upload</div></div>
                  }
                </div>
                <div>
                  <div style={{ fontWeight:600,fontSize:13.5,marginBottom:6 }}>Company Logo</div>
                  <div style={{ fontSize:12.5,color:"var(--text2)",marginBottom:12,lineHeight:1.6 }}>
                    Appears in the nav sidebar and on all generated reports.<br />Recommended: PNG with transparent background, min 200×200px.
                  </div>
                  <div style={{ display:"flex",gap:8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => logoRef.current?.click()}>
                      <Icon d={ic.image} size={13} /> Upload Logo
                    </button>
                    {form.logo && <button className="btn btn-danger btn-sm" onClick={() => set("logo", null)}>
                      <Icon d={ic.trash} size={13} /> Remove
                    </button>}
                  </div>
                </div>
              </div>
              <input ref={logoRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleLogoUpload} />
            </div>
          </div>

          {/* Company details */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Company Information</span></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label">Company Name</label><input className="form-input" value={form.companyName} onChange={e => set("companyName", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">License / Registration #</label><input className="form-input" value={form.license} onChange={e => set("license", e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Primary Email</label><input className="form-input" type="email" value={form.email} onChange={e => set("email", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Phone Number</label><input className="form-input" value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
              </div>
              <div className="form-group"><label className="form-label">Street Address</label><input className="form-input" value={form.address} onChange={e => set("address", e.target.value)} /></div>
              <div className="form-row-3">
                <div className="form-group"><label className="form-label">City</label><input className="form-input" value={form.city} onChange={e => set("city", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">State / Province</label><input className="form-input" value={form.state} onChange={e => set("state", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">ZIP / Postal Code</label><input className="form-input" value={form.zip} onChange={e => set("zip", e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Website</label><input className="form-input" placeholder="https://yourcompany.com" value={form.website} onChange={e => set("website", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Industry</label>
                  <select className="form-input form-select" value={form.industry} onChange={e => set("industry", e.target.value)}>
                    {["General Contractor","Restoration & Remediation","Insurance Adjuster","Property Inspector","Plumbing","Electrical","HVAC","Roofing","Other"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── APPEARANCE ── */}
      {tab === "appearance" && (
        <div className="fade-in">
          {/* Mode */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Color Mode</span></div>
            <div className="card-body">
              <div style={{ display:"flex",gap:12 }}>
                {[
                  { id:"dark",  label:"Dark",  desc:"Dark backgrounds, easy on the eyes in low light.", icon:"🌙" },
                  { id:"light", label:"Light", desc:"Clean white UI, great for bright environments.",   icon:"☀️" },
                  { id:"system",label:"System",desc:"Follows your device's OS preference automatically.",icon:"💻" },
                ].map(m => (
                  <div key={m.id} onClick={() => { set("mode", m.id); applyMode(m.id); }}
                    style={{ flex:1,border:`2px solid ${form.mode===m.id?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius)",padding:"16px 14px",cursor:"pointer",background:form.mode===m.id?"var(--accent-glow)":"var(--surface2)",transition:"all .15s" }}>
                    <div style={{ fontSize:24,marginBottom:8 }}>{m.icon}</div>
                    <div style={{ fontWeight:700,fontSize:13.5,marginBottom:4 }}>{m.label}</div>
                    <div style={{ fontSize:12,color:"var(--text2)",lineHeight:1.5 }}>{m.desc}</div>
                    {form.mode===m.id && <div style={{ display:"flex",alignItems:"center",gap:4,marginTop:10,fontSize:11.5,color:"var(--accent)",fontWeight:600 }}><Icon d={ic.check} size={12} /> Active</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Accent color */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Accent Color</span></div>
            <div className="card-body">
              <div style={{ fontSize:12.5,color:"var(--text2)",marginBottom:16 }}>Used for buttons, highlights, active states, and report accents across the entire app.</div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20 }}>
                {ACCENT_PRESETS.map(p => (
                  <div key={p.value} onClick={() => set("accent", p.value)}
                    style={{ border:`2px solid ${form.accent===p.value?"var(--text)":"transparent"}`,borderRadius:10,padding:"12px 10px",cursor:"pointer",background:"var(--surface2)",transition:"all .15s",display:"flex",flexDirection:"column",alignItems:"center",gap:8 }}>
                    <div style={{ width:36,height:36,borderRadius:8,background:p.value,boxShadow:form.accent===p.value?`0 0 0 3px ${p.value}44`:"none" }} />
                    <div style={{ fontSize:11.5,fontWeight:600,color:form.accent===p.value?"var(--text)":"var(--text2)" }}>{p.name}</div>
                    {form.accent===p.value && <Icon d={ic.check} size={12} stroke={p.value} />}
                  </div>
                ))}
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                <div style={{ fontSize:12.5,fontWeight:600,color:"var(--text2)" }}>Custom color</div>
                <div style={{ position:"relative" }}>
                  <input type="color" value={form.accent} onChange={e => set("accent", e.target.value)}
                    style={{ width:42,height:42,borderRadius:8,border:"1px solid var(--border)",cursor:"pointer",background:"none",padding:2 }} />
                </div>
                <div style={{ fontFamily:"monospace",fontSize:12,color:"var(--text2)",background:"var(--surface2)",padding:"4px 10px",borderRadius:6 }}>{form.accent}</div>
              </div>

              {/* Live preview */}
              <div style={{ marginTop:20,padding:16,background:"var(--surface2)",borderRadius:"var(--radius)",border:"1px solid var(--border)" }}>
                <div style={{ fontSize:11.5,color:"var(--text3)",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10 }}>Preview</div>
                <div style={{ display:"flex",gap:10,alignItems:"center",flexWrap:"wrap" }}>
                  <button style={{ background:form.accent,color:"white",border:"none",padding:"8px 16px",borderRadius:8,fontWeight:600,fontSize:13,cursor:"default" }}>Primary Button</button>
                  <button style={{ background:`${form.accent}18`,color:form.accent,border:`1px solid ${form.accent}44`,padding:"8px 16px",borderRadius:8,fontWeight:600,fontSize:13,cursor:"default" }}>Outline Button</button>
                  <div style={{ display:"flex",alignItems:"center",gap:5,background:`${form.accent}18`,padding:"4px 10px",borderRadius:20,fontSize:12,fontWeight:600,color:form.accent }}>
                    <Icon d={ic.check} size={12} stroke={form.accent} /> Active Tag
                  </div>
                  <div style={{ width:24,height:24,borderRadius:6,background:form.accent }} />
                </div>
              </div>
            </div>
          </div>

          {/* UI density */}
          <div className="card">
            <div className="card-header"><span style={{ fontWeight:700 }}>Interface Density</span></div>
            <div className="card-body">
              <div style={{ display:"flex",gap:10 }}>
                {[{id:"comfortable",label:"Comfortable",desc:"More spacing, easier to tap"},{id:"compact",label:"Compact",desc:"Denser layout, more content visible"}].map(d => (
                  <div key={d.id} onClick={() => { set("density", d.id); applyDensity(d.id); }}
                    style={{ flex:1,border:`2px solid ${form.density===d.id?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius)",padding:"14px",cursor:"pointer",background:form.density===d.id?"var(--accent-glow)":"var(--surface2)",transition:"all .15s" }}>
                    <div style={{ fontWeight:700,fontSize:13,marginBottom:3 }}>{d.label}</div>
                    <div style={{ fontSize:12,color:"var(--text2)" }}>{d.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ACCOUNT ── */}
      {tab === "account" && (
        <div className="fade-in">
          {/* Profile */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Profile Information</span></div>
            <div className="card-body">
              <div style={{ display:"flex",alignItems:"center",gap:20,marginBottom:22 }}>
                <div style={{ position:"relative",flexShrink:0 }}>
                  <div onClick={() => avatarRef.current.click()}
                    style={{ width:72,height:72,borderRadius:"50%",background:form.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:700,color:"white",cursor:"pointer",overflow:"hidden",border:`3px solid ${form.accent}`,boxShadow:"0 0 0 3px var(--surface)" }}>
                    {form.userAvatar
                      ? <img src={form.userAvatar} alt="avatar" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                      : <>{form.userFirstName?.[0]?.toUpperCase()}{form.userLastName?.[0]?.toUpperCase()}</>
                    }
                  </div>
                  {/* Camera overlay on hover */}
                  <div onClick={() => avatarRef.current.click()}
                    style={{ position:"absolute",inset:0,borderRadius:"50%",background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",opacity:0,transition:"opacity .15s" }}
                    onMouseEnter={e=>e.currentTarget.style.opacity=1}
                    onMouseLeave={e=>e.currentTarget.style.opacity=0}>
                    <Icon d={ic.camera} size={20} stroke="white" />
                  </div>
                  <input ref={avatarRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleAvatarUpload} />
                </div>
                <div>
                  <div style={{ fontWeight:700,fontSize:16,marginBottom:3 }}>{form.userFirstName} {form.userLastName}</div>
                  <div style={{ fontSize:13,color:"var(--text2)",marginBottom:6 }}>{form.userEmail}</div>
                  <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                    <span style={{ background:`${form.accent}18`,color:form.accent,fontSize:11.5,fontWeight:600,padding:"3px 10px",borderRadius:20 }}>Pro Plan</span>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize:11.5,padding:"3px 10px",color:"var(--text3)" }} onClick={() => avatarRef.current.click()}>
                      <Icon d={ic.camera} size={12} /> Change Photo
                    </button>
                    {form.userAvatar && (
                      <button className="btn btn-ghost btn-sm" style={{ fontSize:11.5,padding:"3px 10px",color:"var(--text3)" }} onClick={() => set("userAvatar", null)}>
                        <Icon d={ic.trash} size={12} /> Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">First Name</label><input className="form-input" value={form.userFirstName} onChange={e => set("userFirstName", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Last Name</label><input className="form-input" value={form.userLastName} onChange={e => set("userLastName", e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Email Address</label><input className="form-input" type="email" value={form.userEmail} onChange={e => set("userEmail", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Job Title</label><input className="form-input" value={form.userTitle} onChange={e => set("userTitle", e.target.value)} /></div>
              </div>
              <div className="form-group"><label className="form-label">Mobile Phone</label><input className="form-input" value={form.userPhone} onChange={e => set("userPhone", e.target.value)} /></div>
            </div>
          </div>

          {/* Change password */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Change Password</span></div>
            <div className="card-body">
              <div style={{ fontSize:12.5,color:"var(--text2)",marginBottom:16,lineHeight:1.6 }}>
                Choose a strong password with at least 8 characters, including a mix of letters and numbers.
              </div>
              <div className="form-group"><label className="form-label">Current Password</label><input className="form-input" type="password" placeholder="Enter current password" /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">New Password</label><input className="form-input" type="password" placeholder="Min 8 characters" /></div>
                <div className="form-group"><label className="form-label">Confirm New Password</label><input className="form-input" type="password" placeholder="Repeat new password" /></div>
              </div>
              <button className="btn btn-secondary btn-sm"><Icon d={ic.check} size={13} /> Update Password</button>
            </div>
          </div>

          {/* Notifications */}
          <div className="card">
            <div className="card-header"><span style={{ fontWeight:700 }}>Notifications</span></div>
            <div className="card-body">
              {[
                { key:"notifReports", label:"Report ready to send",    desc:"When a report is generated and ready for review" },
                { key:"notifPhotos",  label:"Photo upload complete",    desc:"After a batch of photos finishes uploading"      },
                { key:"notifUpdates", label:"App updates & news",       desc:"Product updates and new features"                },
              ].map(n => (
                <div key={n.key} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontWeight:600,fontSize:13.5,marginBottom:2 }}>{n.label}</div>
                    <div style={{ fontSize:12,color:"var(--text2)" }}>{n.desc}</div>
                  </div>
                  <div onClick={() => set(n.key, !form[n.key])}
                    style={{ width:44,height:24,borderRadius:12,background:form[n.key]?form.accent:"var(--surface3)",cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0 }}>
                    <div style={{ width:18,height:18,borderRadius:"50%",background:"white",position:"absolute",top:3,left:form[n.key]?23:3,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── REPORT DEFAULTS ── */}
      {tab === "reports" && (
        <div className="fade-in">
          {/* Header */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Report Header</span><span style={{ fontSize:11.5,color:"var(--text2)" }}>Appears at the top of every generated report</span></div>
            <div className="card-body">
              <div style={{ marginBottom:18,padding:16,background:"var(--surface2)",borderRadius:"var(--radius)",border:"1px solid var(--border)" }}>
                <div style={{ fontSize:11,color:"var(--text3)",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10 }}>Header Preview</div>
                <div style={{ background:"white",borderRadius:8,padding:"16px 20px",color:"#222" }}>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"2px solid "+form.accent,paddingBottom:12,marginBottom:10 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                      {form.logo
                        ? <img src={form.logo} alt="logo" style={{ height:40,width:40,objectFit:"contain" }} />
                        : <div style={{ width:40,height:40,borderRadius:8,background:form.accent,display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:700,fontSize:14 }}>{(form.companyName||"AC")[0]}</div>
                      }
                      <div>
                        <div style={{ fontWeight:700,fontSize:14,color:"#111" }}>{form.companyName || "Your Company"}</div>
                        <div style={{ fontSize:11,color:"#666" }}>{form.phone} · {form.email}</div>
                      </div>
                    </div>
                    <div style={{ textAlign:"right",fontSize:11,color:"#666",lineHeight:1.8 }}>
                      <div style={{ fontWeight:700,fontSize:13,color:"#111" }}>{form.reportHeaderTitle || "Property Inspection Report"}</div>
                      <div>{form.address}{form.city?`, ${form.city}`:""}</div>
                    </div>
                  </div>
                  {form.reportHeaderNote && <div style={{ fontSize:11,color:"#555",fontStyle:"italic" }}>{form.reportHeaderNote}</div>}
                </div>
              </div>
              <div className="form-group"><label className="form-label">Header Title (e.g. "Property Inspection Report")</label><input className="form-input" value={form.reportHeaderTitle} onChange={e => set("reportHeaderTitle", e.target.value)} placeholder="Property Inspection Report" /></div>
              <div className="form-group"><label className="form-label">Header Tagline / Note (optional)</label><input className="form-input" value={form.reportHeaderNote} onChange={e => set("reportHeaderNote", e.target.value)} placeholder="Licensed & Insured · Serving the Greater Denver Area" /></div>
            </div>
          </div>

          {/* Footer */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Report Footer</span><span style={{ fontSize:11.5,color:"var(--text2)" }}>Appears at the bottom of every page</span></div>
            <div className="card-body">
              {/* Footer preview */}
              <div style={{ marginBottom:18,padding:16,background:"var(--surface2)",borderRadius:"var(--radius)",border:"1px solid var(--border)" }}>
                <div style={{ fontSize:11,color:"var(--text3)",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10 }}>Footer Preview</div>
                <div style={{ background:"white",borderRadius:8,padding:"12px 20px",color:"#222",borderTop:`2px solid ${form.accent}` }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:10.5,color:"#666" }}>
                    <span>{form.reportFooterLeft || form.companyName || "Your Company"} · {form.phone}</span>
                    <span style={{ color:form.accent,fontWeight:600 }}>{form.reportFooterCenter || "Confidential"}</span>
                    <span>Page 1 of 1 · {new Date().toLocaleDateString()}</span>
                  </div>
                  {form.reportFooterDisclaimer && <div style={{ marginTop:8,fontSize:9.5,color:"#aaa",lineHeight:1.5 }}>{form.reportFooterDisclaimer}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Footer Left Text</label><input className="form-input" value={form.reportFooterLeft} onChange={e => set("reportFooterLeft", e.target.value)} placeholder="Company name + phone" /></div>
                <div className="form-group"><label className="form-label">Footer Center Label</label><input className="form-input" value={form.reportFooterCenter} onChange={e => set("reportFooterCenter", e.target.value)} placeholder="Confidential" /></div>
              </div>
              <div className="form-group"><label className="form-label">Disclaimer / Legal Text (optional)</label><textarea className="form-input form-textarea" style={{ minHeight:64 }} value={form.reportFooterDisclaimer} onChange={e => set("reportFooterDisclaimer", e.target.value)} placeholder="This report is prepared for the exclusive use of the client named herein. Reproduction or distribution without written consent is prohibited." /></div>
            </div>
          </div>

          {/* Report defaults */}
          <div className="card">
            <div className="card-header"><span style={{ fontWeight:700 }}>Report Defaults</span></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label">Default Report Type</label>
                  <select className="form-input form-select" value={form.defaultReportType} onChange={e => set("defaultReportType", e.target.value)}>
                    {["Assessment","Inspection","Quote","Progress Update","Damage Assessment","Insurance Report","Other"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Photo Layout</label>
                  <select className="form-input form-select" value={form.reportPhotoLayout} onChange={e => set("reportPhotoLayout", e.target.value)}>
                    {["2 per row","3 per row","4 per row","Full width"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Include GPS Coordinates</label>
                  <select className="form-input form-select" value={form.reportShowGps} onChange={e => set("reportShowGps", e.target.value)}>
                    <option value="yes">Yes — show on each photo</option>
                    <option value="summary">Summary page only</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Include Timestamps</label>
                  <select className="form-input form-select" value={form.reportShowTimestamp} onChange={e => set("reportShowTimestamp", e.target.value)}>
                    <option value="yes">Yes — on each photo</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save bar */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"flex-end",gap:12,marginTop:28,paddingTop:20,borderTop:"1px solid var(--border)" }}>
        {saved && <div style={{ display:"flex",alignItems:"center",gap:6,color:"var(--green)",fontSize:13,fontWeight:600 }}><Icon d={ic.check} size={15} stroke="var(--green)" /> Changes saved</div>}
        <button className="btn btn-secondary" onClick={() => setForm({ ...settings })}>Reset</button>
        <button className="btn btn-primary" onClick={handleSave}><Icon d={ic.check} size={14} /> Save All Changes</button>
      </div>
    </div>
  );
}
function TemplatesPage() {
  const [templates, setTemplates] = useState(TEMPLATES);
  const [showCreate, setShowCreate] = useState(false);
  const [editTmpl,   setEditTmpl]   = useState(null);
  const [deleteTmpl, setDeleteTmpl] = useState(null);
  const tagColor = c => c==="#4a90d9"?"blue":c==="#3dba7e"?"green":c==="#8b7cf8"?"purple":"orange";
  const TP = ({ color }) => (
    <div className="template-preview">
      <div className="tmpl-line" style={{ height:16,width:"60%",background:color+"40" }} />
      <div className="tmpl-line" style={{ height:9,width:"90%" }} />
      <div className="tmpl-line" style={{ height:9,width:"75%" }} />
      <div style={{ display:"flex",gap:5,marginTop:3 }}><div className="tmpl-line" style={{ height:44,flex:1 }} /><div className="tmpl-line" style={{ height:44,flex:1 }} /></div>
      <div className="tmpl-line" style={{ height:9,width:"50%" }} />
    </div>
  );
  return (
    <div className="page fade-in">
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:22 }}>
        <div><div className="section-title">Report Templates</div><div className="section-sub">Reusable templates for insurance, contractors, inspections & more</div></div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Icon d={ic.plus} size={15} /> New Template</button>
      </div>
      <div className="grid-3">
        {templates.map(t => (
          <div key={t.id} className="template-card">
            <TP color={t.color} />
            <div className="template-info">
              <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:5 }}>
                <div className="template-name">{t.name}</div>
                <span className={`tag tag-${tagColor(t.color)}`} style={{ flexShrink:0 }}>{t.type}</span>
              </div>
              <div className="template-desc">{t.desc}</div>
              <div style={{ display:"flex",gap:8,marginTop:12 }}>
                <button className="btn btn-sm btn-secondary" style={{ flex:1 }} onClick={() => setEditTmpl(t)}><Icon d={ic.edit} size={12} /> Edit</button>
                <button className="btn btn-sm btn-primary" style={{ flex:1 }}><Icon d={ic.copy} size={12} /> Use</button>
                <button className="btn btn-sm btn-danger btn-icon" title="Delete template" onClick={() => setDeleteTmpl(t)}><Icon d={ic.trash} size={13} /></button>
              </div>
            </div>
          </div>
        ))}
        <div className="template-card" style={{ border:"2px dashed var(--border)",cursor:"pointer" }} onClick={() => setShowCreate(true)}>
          <div style={{ height:130,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8 }}>
            <div style={{ width:46,height:46,borderRadius:"50%",background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={ic.plus} size={20} stroke="var(--accent)" /></div>
            <span style={{ fontSize:13,color:"var(--text2)",fontWeight:600 }}>Create Template</span>
          </div>
          <div className="template-info"><div className="template-name" style={{ color:"var(--text2)" }}>Blank Template</div><div className="template-desc">Start from scratch.</div></div>
        </div>
      </div>

      {/* Edit / Create modal */}
      {(showCreate||editTmpl) && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&(setShowCreate(false),setEditTmpl(null))}>
          <div className="modal fade-in modal-lg">
            <div className="modal-header"><div className="modal-title">{editTmpl?`Edit: ${editTmpl.name}`:"Create Template"}</div><button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setShowCreate(false);setEditTmpl(null); }}><Icon d={ic.close} size={16} /></button></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Template Name</label><input className="form-input" defaultValue={editTmpl?.name} placeholder="e.g. Water Damage Assessment" /></div>
              <div className="form-row"><div className="form-group"><label className="form-label">Report Type</label><select className="form-input form-select">{["Assessment","Inspection","Quote","Progress Update","Damage Assessment","Insurance Report","Other"].map(t=><option key={t}>{t}</option>)}</select></div><div className="form-group"><label className="form-label">Recipient</label><select className="form-input form-select">{["Client","Adjuster","Insurance Company","Contractor","N/A","Other"].map(t=><option key={t}>{t}</option>)}</select></div></div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-input form-textarea" defaultValue={editTmpl?.desc} /></div>
              <div className="form-group"><label className="form-label" style={{ marginBottom:12 }}>Sections</label>{["Cover Page","Property Information","Scope of Work","Report","Damage Summary","Photo Documentation","Sign Off","Signature Block"].map((s,i)=><div key={s} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--border)" }}><input type="checkbox" defaultChecked={i<5} style={{ accentColor:"var(--accent)" }}/><span style={{ fontSize:13,flex:1 }}>{s}</span></div>)}</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowCreate(false);setEditTmpl(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { setShowCreate(false);setEditTmpl(null); }}><Icon d={ic.check} size={14} /> {editTmpl?"Save":"Create"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTmpl && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setDeleteTmpl(null)}>
          <div className="modal fade-in" style={{ maxWidth:420 }}>
            <div className="modal-header">
              <div className="modal-title">Delete Template?</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDeleteTmpl(null)}><Icon d={ic.close} size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize:13.5,lineHeight:1.6,color:"var(--text2)" }}>
                Are you sure you want to delete <strong style={{ color:"var(--text)" }}>{deleteTmpl.name}</strong>? This template will be permanently removed.
              </p>
              <div className="confirm-box">
                <Icon d={ic.alert} size={20} stroke="#ff6b6b" />
                <span style={{ fontSize:13,color:"#ff6b6b" }}>This action cannot be undone.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTmpl(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { setTemplates(prev => prev.filter(t => t.id !== deleteTmpl.id)); setDeleteTmpl(null); }}>
                <Icon d={ic.trash} size={13} /> Delete Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root App ───────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  // Company
  logo: null, companyName: "Acme Construction", license: "CO-2024-00123",
  email: "contact@acmeco.com", phone: "(555) 012-3456",
  address: "100 Industrial Way", city: "Denver", state: "CO", zip: "80203",
  website: "", industry: "General Contractor",
  // Appearance
  accent: "#e86c3a", mode: "dark", density: "comfortable",
  // Account / user
  userFirstName: "John", userLastName: "Davis", userEmail: "john@acmeco.com",
  userTitle: "Project Manager", userPhone: "(555) 099-0001",
  notifReports: true, notifPhotos: true, notifUpdates: false,
  // Report defaults
  reportHeaderTitle: "Property Inspection Report",
  reportHeaderNote: "Licensed & Insured · Serving the Greater Denver Area",
  reportFooterLeft: "", reportFooterCenter: "Confidential",
  reportFooterDisclaimer: "",
  defaultReportType: "Assessment", reportPhotoLayout: "3 per row",
  reportShowGps: "yes", reportShowTimestamp: "yes",
};

export default function App() {
  const [projects,      setProjects]      = useState(SEED_PROJECTS);
  const [activeProject, setActiveProject] = useState(null);
  const [page,          setPage]          = useState("projects");
  const [editingPhoto,  setEditingPhoto]  = useState(null);
  const [showNewProject,setShowNewProject]= useState(false);
  const [editingProject,setEditingProject]= useState(null);
  const [cameraProject, setCameraProject] = useState(null);
  const [settings,      setSettings]      = useState(DEFAULT_SETTINGS);
  const [reportCreatorData, setReportCreatorData] = useState(null); // { project, report|null }

  // Apply accent color as CSS variable whenever it changes
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", settings.accent);
    // Derive a slightly lighter version for hover
    document.documentElement.style.setProperty("--accent2", settings.accent + "cc");
    document.documentElement.style.setProperty("--accent-glow", settings.accent + "26");
  }, [settings.accent]);

  // Apply color mode (dark / light / system)
  useEffect(() => {
    const applyDark = () => {
      document.documentElement.style.setProperty("--bg",       "#0d0f14");
      document.documentElement.style.setProperty("--surface",  "#13161e");
      document.documentElement.style.setProperty("--surface2", "#1a1e28");
      document.documentElement.style.setProperty("--surface3", "#22273a");
      document.documentElement.style.setProperty("--border",   "#2a2f42");
      document.documentElement.style.setProperty("--text",     "#f0f2f7");
      document.documentElement.style.setProperty("--text2",    "#8b9ab8");
      document.documentElement.style.setProperty("--text3",    "#4a5570");
    };
    const applyLight = () => {
      document.documentElement.style.setProperty("--bg",       "#f0f2f5");
      document.documentElement.style.setProperty("--surface",  "#ffffff");
      document.documentElement.style.setProperty("--surface2", "#f5f6fa");
      document.documentElement.style.setProperty("--surface3", "#e8eaf0");
      document.documentElement.style.setProperty("--border",   "#d8dce8");
      document.documentElement.style.setProperty("--text",     "#111827");
      document.documentElement.style.setProperty("--text2",    "#4b5563");
      document.documentElement.style.setProperty("--text3",    "#9ca3af");
    };

    if (settings.mode === "light") {
      applyLight();
    } else if (settings.mode === "dark") {
      applyDark();
    } else {
      // system
      const mq = window.matchMedia("(prefers-color-scheme: light)");
      mq.matches ? applyLight() : applyDark();
      const handler = e => e.matches ? applyLight() : applyDark();
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [settings.mode]);

  // Apply density
  useEffect(() => {
    if (settings.density === "compact") {
      document.documentElement.style.setProperty("--density-page-pad",  "16px");
      document.documentElement.style.setProperty("--density-nav-pad",   "10px 8px 0");
      document.documentElement.style.setProperty("--density-item-pad",  "6px 10px");
      document.documentElement.style.setProperty("--density-card-pad",  "14px");
      document.documentElement.style.setProperty("--density-gap",       "12px");
      document.documentElement.style.setProperty("--density-font",      "12.5px");
      document.documentElement.style.setProperty("--density-topbar-h",  "48px");
    } else {
      document.documentElement.style.setProperty("--density-page-pad",  "26px");
      document.documentElement.style.setProperty("--density-nav-pad",   "14px 12px 0");
      document.documentElement.style.setProperty("--density-item-pad",  "9px 12px");
      document.documentElement.style.setProperty("--density-card-pad",  "20px");
      document.documentElement.style.setProperty("--density-gap",       "20px");
      document.documentElement.style.setProperty("--density-font",      "13.5px");
      document.documentElement.style.setProperty("--density-topbar-h",  "58px");
    }
  }, [settings.density]);

  const saveProject = (proj) => {
    setProjects(prev => prev.some(p => p.id===proj.id) ? prev.map(p => p.id===proj.id ? proj : p) : [...prev, proj]);
    setShowNewProject(false); setEditingProject(null);
  };
  const deleteProject = (id) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProject?.id === id) { setActiveProject(null); setPage("projects"); }
  };
  const updateProject = (proj) => {
    setProjects(prev => prev.map(p => p.id===proj.id ? proj : p));
    setActiveProject(proj);
  };
  const handleCameraSave = (photos) => {
    if (!cameraProject) return;
    const updated = { ...cameraProject, photos:[...(cameraProject.photos||[]), ...photos] };
    updateProject(updated);
    setCameraProject(null);
    setPage(activeProject ? "detail" : "projects");
  };
  const openCamera = (proj) => {
    const defaultRoom = proj._defaultRoom || proj.rooms?.[0]?.name;
    const cleanProj = { ...proj }; delete cleanProj._defaultRoom;
    setCameraProject({ ...cleanProj, _defaultRoom: defaultRoom });
    setPage("camera");
  };

  const openReportCreator = (proj, report) => {
    setReportCreatorData({ project: proj, report: report || null });
  };

  const saveReport = (proj, savedReport) => {
    const updatedReports = proj.reports.some(r => r.id === savedReport.id)
      ? proj.reports.map(r => r.id === savedReport.id ? savedReport : r)
      : [...(proj.reports||[]), savedReport];
    const updatedProj = { ...proj, reports: updatedReports };
    updateProject(updatedProj);
    setReportCreatorData(null);
  };

  const isFullscreen = page === "camera" || page === "editor" || !!reportCreatorData;
  const isDetail     = page === "detail";

  const NAV = [
    { id:"projects",   label:"All Jobsites",   icon:ic.folder,    section:"main" },
    { id:"templates",  label:"Templates",       icon:ic.templates, section:"tools" },
    { id:"settings",   label:"Settings",        icon:ic.settings,  section:"tools" },
  ];

  const userInitials = `${settings.userFirstName?.[0]||"J"}${settings.userLastName?.[0]||"D"}`.toUpperCase();

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* ── LEFT NAV ── */}
        <nav className="nav">
          <div className="nav-brand">
            {settings.logo
              ? <img src={settings.logo} alt="logo" style={{ width:36,height:36,borderRadius:10,objectFit:"contain",background:"white",padding:3,flexShrink:0 }} />
              : <div className="nav-brand-icon"><Icon d={ic.camera} size={18} stroke="white" strokeWidth={2} /></div>
            }
            <div>
              <div className="nav-brand-text">{settings.companyName || "SiteSnap"}</div>
              <div className="nav-brand-sub">Pro Reporting</div>
            </div>
          </div>

          {activeProject && (
            <div className="nav-project-switcher" onClick={() => setPage("detail")}>
              <div className="nav-project-switcher-label">Active Project</div>
              <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                <div style={{ width:8,height:8,borderRadius:"50%",background:activeProject.color,flexShrink:0 }} />
                <div className="nav-project-name">{activeProject.title}</div>
              </div>
              <div className="nav-project-addr">{activeProject.address}{activeProject.city?`, ${activeProject.city}`:""}</div>
            </div>
          )}

          {activeProject && (
            <div className="nav-section">
              <div className="nav-section-label">This Project</div>
              {[
                { id:"detail",    label:"Overview",   icon:ic.activity },
                { id:"cam_quick", label:"Take Photos", icon:ic.camera   },
              ].map(item => (
                <div key={item.id} className={`nav-item ${page===item.id?"active":""}`}
                  onClick={() => item.id==="cam_quick" ? openCamera(activeProject) : setPage(item.id)}>
                  <Icon d={item.icon} size={15} />{item.label}
                </div>
              ))}
            </div>
          )}

          <div className="nav-section">
            <div className="nav-section-label">Navigation</div>
            {NAV.filter(i => i.section==="main").map(item => (
              <div key={item.id} className={`nav-item ${page===item.id?"active":""}`} onClick={() => setPage(item.id)}>
                <Icon d={item.icon} size={15} />{item.label}
                {item.id==="projects" && <span className="nav-badge">{projects.length}</span>}
              </div>
            ))}
          </div>
          <div className="nav-section">
            <div className="nav-section-label">Tools</div>
            {NAV.filter(i => i.section==="tools").map(item => (
              <div key={item.id} className={`nav-item ${page===item.id?"active":""}`} onClick={() => setPage(item.id)}>
                <Icon d={item.icon} size={15} />{item.label}
              </div>
            ))}
          </div>

          <div className="nav-footer">
            <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:"var(--radius-sm)",background:"var(--surface2)",cursor:"pointer" }}
              onClick={() => setPage("settings")}>
              <div style={{ width:32,height:32,borderRadius:"50%",background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12,color:"white",flexShrink:0,overflow:"hidden" }}>
                {settings.userAvatar
                  ? <img src={settings.userAvatar} alt="avatar" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                  : userInitials
                }
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{settings.userFirstName} {settings.userLastName}</div>
                <div style={{ fontSize:11,color:"var(--text2)" }}>Pro Plan · {projects.length} projects</div>
              </div>
              <div className="dot" />
            </div>
          </div>
        </nav>

        {/* ── MAIN ── */}
        <div className="main">
          {!isFullscreen && (
            <div className="topbar">
              <div className="topbar-left">
                {(isDetail || page==="projects") && (
                  <div className="topbar-crumb">
                    {page==="projects" ? (
                      <span style={{ display:"flex",alignItems:"center",gap:6,color:"var(--text)",fontWeight:600,fontSize:13 }}>
                        <Icon d={ic.folder} size={14} stroke="var(--text)" /> All Jobsites
                      </span>
                    ) : (
                      <span className="topbar-crumb-proj" onClick={() => { setPage("projects"); setActiveProject(null); }}>
                        <Icon d={ic.folder} size={14} /> All Jobsites
                      </span>
                    )}
                    {isDetail && activeProject && (
                      <><span style={{ color:"var(--text3)" }}>›</span>
                      <span style={{ color:"var(--text)",fontWeight:600,fontSize:13 }}>{activeProject.title}</span></>
                    )}
                  </div>
                )}
                {page==="templates" && <div className="topbar-title">Report Templates</div>}
                {page==="settings"  && <div className="topbar-title">Settings</div>}
              </div>
              <div className="topbar-actions">
                {page==="projects" && <button className="btn btn-primary btn-sm" onClick={() => setShowNewProject(true)}><Icon d={ic.plus} size={14} /> New Jobsite</button>}
                {isDetail && activeProject && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingProject(activeProject)}><Icon d={ic.edit} size={13} /> Edit Project</button>
                    <button className="btn btn-primary btn-sm" onClick={() => openCamera(activeProject)}><Icon d={ic.camera} size={13} /> Camera</button>
                  </>
                )}
              </div>
            </div>
          )}

          {page === "projects" && (
            <ProjectsList projects={projects} onSelect={p => { setActiveProject(p); setPage("detail"); }} onNew={() => setShowNewProject(true)} onEdit={p => setEditingProject(p)} onDelete={deleteProject} />
          )}
          {page === "detail" && activeProject && (
            <ProjectDetail
              project={projects.find(p => p.id===activeProject.id) || activeProject}
              onBack={() => { setPage("projects"); setActiveProject(null); }}
              onEdit={p => setEditingProject(p)}
              onOpenCamera={openCamera}
              onEditPhoto={photo => { setEditingPhoto(photo); setPage("editor"); }}
              onUpdateProject={updateProject}
              onOpenReportCreator={openReportCreator}
            />
          )}
          {page === "camera" && (
            <CameraPage project={cameraProject} defaultRoom={cameraProject?._defaultRoom} onSave={handleCameraSave} onClose={() => { setCameraProject(null); setPage(activeProject ? "detail" : "projects"); }} />
          )}
          {page === "editor" && (
            <ImageEditor photo={editingPhoto} onClose={() => setPage(activeProject ? "detail" : "projects")} />
          )}
          {page === "templates" && <TemplatesPage />}
          {page === "settings" && (
            <SettingsPage settings={settings} onSave={s => setSettings(s)} />
          )}
        </div>

        {/* ── PROJECT MODAL ── */}
        {(showNewProject || editingProject) && (
          <ProjectModal
            project={editingProject}
            onSave={proj => { saveProject(proj); if (editingProject && activeProject?.id===proj.id) setActiveProject(proj); }}
            onClose={() => { setShowNewProject(false); setEditingProject(null); }}
          />
        )}

        {/* ── REPORT CREATOR (fullscreen overlay) ── */}
        {reportCreatorData && (
          <div style={{ position:"fixed",inset:0,zIndex:200,background:"var(--bg)" }}>
            <ReportCreator
              project={projects.find(p => p.id===reportCreatorData.project.id) || reportCreatorData.project}
              reportData={reportCreatorData.report}
              settings={settings}
              templates={TEMPLATES}
              onSave={saved => saveReport(reportCreatorData.project, saved)}
              onClose={() => setReportCreatorData(null)}
            />
          </div>
        )}
      </div>
    </>
  );
}
