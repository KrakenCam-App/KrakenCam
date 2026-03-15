import { useState, useRef, useEffect, useCallback, memo } from "react";
import { supabase } from "./lib/supabase";

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
  upload:   "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
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
  chevLeft: "M15 18l-6-6 6-6",
  chevDown: "M6 9l6 6 6-6",
  star:     "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  arrowLeft:"M19 12H5 M12 19l-7-7 7-7",
  logOut:   "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9",
  folder:   "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
  hash:     "M4 9h16 M4 15h16 M10 3L8 21 M16 3l-2 18",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  clockIcon:"M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v6l4 2",
  printer:  "M6 9V2h12v7 M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2 M6 14h12v8H6z",
  users:    "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75 M9 11a4 4 0 100-8 4 4 0 000 8z",
  shield:   "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  lock:     "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z M7 11V7a5 5 0 0110 0v4",
  creditCard:"M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2z M1 10h22",
  userPlus: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M12 7a4 4 0 100 8 4 4 0 000-8z M20 8v6 M23 11h-6",
  userX:    "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M12 7a4 4 0 100 8 4 4 0 000-8z M18 8l4 4m0-4l-4 4",
  sliders:  "M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6",
  clipboardList: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 5a2 2 0 002 2h2a2 2 0 002-2 M9 5a2 2 0 012-2h2a2 2 0 012 2 M9 12h6 M9 16h4",
  kanban:   "M3 3h5v18H3z M10 3h5v11h-5z M17 3h4v7h-4z",
  listCheck:"M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  flag:     "M4 15s1-1 4-1 4 2 8 2 4-1 4-1V3s-1 1-4 1-4-2-8-2-4 1-4 1z M4 22v-7",
  grip:     "M9 5h2 M9 12h2 M9 19h2 M13 5h2 M13 12h2 M13 19h2",
  moveVert: "M8 9l4-4 4 4 M16 15l-4 4-4-4",
  tag:      "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z M7 7h.01",
  link:     "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  message:  "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  bell:     "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0",
  atSign:   "M20 12a8 8 0 10-3.56 6.61 M20 12v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9",
  video:    "M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z",
  sketch:   "M3 17l4-4 4 4 4-6 4 6 M21 21H3",
  ruler:    "M5 3l4 4-8 8a2 2 0 000 2.83l.17.17a2 2 0 002.83 0L12 10l4 4 2-2L4 2 3 3z M15 5l2 2 M12 8l2 2 M9 11l2 2",
  dimension:"M21 6H3 M3 6l3-3M3 6l3 3 M21 6l-3-3 M21 6l-3 3 M12 6v12",
  eraser:   "M20 20H7L3 16l10-10 7 7-2.5 2.5 M6.0 11.0l5 5",
  square:   "M3 3h18v18H3z",
  circle:   "M12 22a10 10 0 100-20 10 10 0 000 20z",
  minus:    "M5 12h14",
  arrowUpRight: "M7 17L17 7 M7 7h10v10",
  droplet:  "M12 2.69l5.66 5.66a8 8 0 11-11.31 0z",
  move:     "M5 9l-3 3 3 3 M9 5l3-3 3 3 M15 19l-3 3-3-3 M19 9l3 3-3 3 M2 12h20 M12 2v20",
};

// ── Seed data helpers ──────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);

const billingDaySuffix = (dateStr) => {
  const d = new Date(dateStr || "2025-03-11").getDate();
  const s = ["st","nd","rd"];
  const v = d % 100;
  return d + (s[(v-20)%10] || s[v-1] || "th");
};

// Returns { daysUsed, daysTotal, daysLeft, cycleStart, cycleEnd } for today in the billing cycle
const getBillingCycleInfo = (signupDate, billingCycle) => {
  const anchor = new Date(signupDate || "2025-03-11");
  const anchorDay = anchor.getDate();
  const today = new Date();

  if (billingCycle === "annual") {
    // Find current annual cycle start
    let cycleStart = new Date(today.getFullYear(), anchor.getMonth(), anchorDay);
    if (cycleStart > today) cycleStart.setFullYear(cycleStart.getFullYear() - 1);
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
    const daysTotal = Math.round((cycleEnd - cycleStart) / 86400000);
    const daysUsed  = Math.round((today - cycleStart) / 86400000);
    return { daysUsed, daysTotal, daysLeft: daysTotal - daysUsed, cycleStart, cycleEnd };
  } else {
    // Find current monthly cycle start
    let cycleStart = new Date(today.getFullYear(), today.getMonth(), anchorDay);
    if (cycleStart > today) { cycleStart.setMonth(cycleStart.getMonth() - 1); }
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);
    const daysTotal = Math.round((cycleEnd - cycleStart) / 86400000);
    const daysUsed  = Math.round((today - cycleStart) / 86400000);
    return { daysUsed, daysTotal, daysLeft: daysTotal - daysUsed, cycleStart, cycleEnd };
  }
};

// Calculate proration amounts for a plan change mid-cycle
const calcProration = (settings, users, fromPlan, toPlan) => {
  const cycle = settings?.billingCycle || "monthly";
  const info   = getBillingCycleInfo(settings?.signupDate, cycle);
  const activeUserCount = users.filter(u => u.status !== "inactive").length;

  const fromTotal = PRICING[cycle][fromPlan].admin + activeUserCount * PRICING[cycle][fromPlan].user;
  const toTotal   = PRICING[cycle][toPlan].admin   + activeUserCount * PRICING[cycle][toPlan].user;

  const dailyFrom   = fromTotal / info.daysTotal;
  const dailyTo     = toTotal   / info.daysTotal;
  const unusedCredit = parseFloat((dailyFrom * info.daysLeft).toFixed(2));
  const newCharge    = parseFloat((dailyTo   * info.daysLeft).toFixed(2));
  const netCharge    = parseFloat((newCharge - unusedCredit).toFixed(2));

  return { unusedCredit, newCharge, netCharge, daysLeft: info.daysLeft, daysTotal: info.daysTotal, cycleEnd: info.cycleEnd, fromTotal, toTotal };
};
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

  .print-layer { display:none; }

  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin:0 !important; padding:0 !important; background:white !important; overflow:visible !important; height:auto !important; }
    body > * { display:none !important; }
    .app { display:block !important; height:auto !important; overflow:visible !important; }
    .app > * { display:none !important; }
    .rc-wrap { display:block !important; height:auto !important; overflow:visible !important; }
    .rc-wrap > * { display:none !important; }
    .print-layer { display:block !important; }
    .print-layer > div { page-break-after:always; box-shadow:none !important; margin:0 !important; width:100% !important; }
    .print-layer > div:last-child { page-break-after:avoid; }
    @page { size:letter portrait; margin:0; }
  }
  ::-webkit-scrollbar{width:4px;height:4px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px;}
  .board-scroll::-webkit-scrollbar{height:10px;}
  .board-scroll::-webkit-scrollbar-track{background:var(--surface2);border-radius:6px;}
  .board-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:6px;}
  .board-scroll::-webkit-scrollbar-thumb:hover{background:var(--accent);}

  .app{display:flex;height:100vh;overflow:hidden;}

  /* ── NAV ── */
  .nav{width:var(--nav-w);background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;overflow-y:auto;overflow-x:hidden;transition:width .2s ease;}
  .nav.collapsed{width:56px;}
  .nav-brand{padding:22px 18px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);transition:padding .2s;}
  .nav.collapsed .nav-brand{padding:14px 10px;justify-content:center;}
  .nav-brand-icon{width:36px;height:36px;background:var(--accent);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .nav-brand-text{font-family:var(--font);font-size:14px;font-weight:700;line-height:1.2;}
  .nav-brand-sub{font-size:10px;color:var(--text2);font-weight:400;letter-spacing:.08em;text-transform:uppercase;}
  .nav.collapsed .nav-brand-text,.nav.collapsed .nav-brand-sub{display:none;}

  /* Project switcher in nav */
  .nav-project-switcher{margin:12px 12px 0;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;cursor:pointer;transition:border-color .15s;}
  .nav-project-switcher:hover{border-color:var(--accent);}
  .nav-project-switcher-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);font-weight:600;margin-bottom:4px;}
  .nav-project-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text);}
  .nav-project-addr{font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}
  .nav.collapsed .nav-project-switcher{display:none;}
  .nav-section{padding:var(--density-nav-pad);}
  .nav.collapsed .nav-section{padding:8px 0;}
  .nav-section-label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);font-weight:600;padding:0 8px 8px;}
  .nav.collapsed .nav-section-label{display:none;}
  .nav-item{display:flex;align-items:center;gap:10px;padding:var(--density-item-pad);border-radius:var(--radius-sm);cursor:pointer;transition:all .15s;font-size:var(--density-font);font-weight:500;color:var(--text2);margin-bottom:2px;white-space:nowrap;}
  .nav.collapsed .nav-item{justify-content:center;padding:11px 0;border-radius:0;margin-bottom:0;}
  .nav-item:hover{background:var(--surface2);color:var(--text);}
  .nav-item.active{background:var(--accent-glow);color:var(--accent);}
  .nav-item-label{overflow:hidden;}
  .nav.collapsed .nav-item-label{display:none;}
  .nav-badge{margin-left:auto;background:var(--accent);color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;}
  .nav.collapsed .nav-badge{display:none;}
  .nav-footer{margin-top:auto;padding:14px 12px;border-top:1px solid var(--border);}
  .nav.collapsed .nav-footer{padding:10px 0;display:flex;flex-direction:column;align-items:center;gap:8px;}
  .nav.collapsed .nav-collapse-btn{width:36px!important;height:36px!important;border-radius:8px!important;}
  .nav-footer-text{flex:1;min-width:0;}
  .nav.collapsed .nav-footer-text{display:none;}
  .nav-collapse-btn{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;cursor:pointer;color:var(--text3);transition:all .15s;flex-shrink:0;}
  .nav-collapse-btn:hover{background:var(--surface2);color:var(--text);}

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
  .report-row-actions{margin-left:auto;display:flex;gap:7px;opacity:1;transition:opacity .15s;}

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
  input[type="date"].form-input{color-scheme:dark;cursor:text;padding-right:36px;}
  input[type="date"].form-input::-webkit-calendar-picker-indicator{opacity:0;width:28px;height:100%;position:absolute;right:0;top:0;cursor:pointer;margin:0;padding:0;}
  input[type="date"].form-input::-webkit-inner-spin-button{display:none;}
  .date-input-wrap{position:relative;display:block;}
  .date-input-wrap .date-icon{position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--accent);}
  .date-input-wrap:hover .date-icon{opacity:1;}

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
  @keyframes recBlink{0%,100%{opacity:1}50%{opacity:.2}}

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
  .editor-toolbar{background:var(--surface);border-bottom:1px solid var(--border);padding:9px 18px;display:flex;align-items:center;gap:8px;flex-wrap:nowrap;flex-shrink:0;overflow:hidden;}
  .tool-btn{width:34px;height:34px;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid transparent;color:var(--text2);transition:all .15s;}
  .tool-btn:hover{background:var(--surface2);color:var(--text);}
  .tool-btn.active{background:var(--accent-glow);border-color:var(--accent);color:var(--accent);}
  .tool-sep{width:1px;height:22px;background:var(--border);margin:0 3px;}
  .editor-body{flex:1;display:flex;overflow:hidden;min-height:0;}
  .canvas-area{flex:1;display:flex;align-items:center;justify-content:center;background:#080a10;overflow:hidden;min-height:0;}
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
  /* ── Report Table ── */
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
  .rp-table tr:hover td{background:rgba(0,0,0,.02);}
  /* Table editor toolbar */
  .tbl-toolbar{display:flex;align-items:center;gap:2px;padding:5px 8px;background:var(--surface2);border-bottom:1px solid var(--border);flex-wrap:wrap;}
  .rp-text-photo{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;}
  .rp-branding{font-size:9px;color:#bbb;letter-spacing:.06em;text-align:right;}
  .rp-page-break{width:816px;height:32px;background:transparent;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .rp-page-break-line{width:100%;height:1px;border-top:2px dashed #444;opacity:.4;}

  /* ── MOBILE BOTTOM NAV ── */
  .mob-nav{display:none;position:fixed;bottom:0;left:0;width:100vw;height:58px;background:var(--surface);border-top:1px solid var(--border);z-index:500;}
  .mob-nav.hidden{display:none!important;}
  .mob-nav-inner{display:flex;height:100%;align-items:center;justify-content:space-evenly;padding:0 8px;}
  .mob-nav-item{display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text3);transition:color .15s;position:relative;padding:10px 12px;border-radius:12px;}
  .mob-nav-item.active{color:var(--accent);}
  .mob-nav-item.active svg{filter:drop-shadow(0 0 5px var(--accent));}
  .mob-nav-cam-wrap{display:flex;align-items:center;justify-content:center;padding:0 4px;}
  .mob-nav-cam{background:var(--accent);border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(232,108,58,.5);transition:transform .15s;flex-shrink:0;}
  .mob-nav-cam:active{transform:scale(.91);}
  .mob-badge{background:var(--accent);color:white;font-size:9px;font-weight:700;min-width:15px;height:15px;padding:0 3px;border-radius:20px;display:flex;align-items:center;justify-content:center;position:absolute;top:4px;right:4px;}

  /* ── DESKTOP-ONLY (reports, templates) ── */
  .desktop-only{}

  /* ── Sketch notes panel ── */
  .sketch-notes-panel{
    width:256px;border-left:1px solid var(--border);padding:16px;flex-shrink:0;
  }
  .mobile-only{display:none;}

  /* ── MOBILE TOPBAR BRAND ── */
  .mob-topbar-brand{display:none;align-items:center;gap:8px;}

  /* ── MOBILE HERO STACK ── */
  .mob-hero-actions{display:none;}

  @media (max-width: 768px) {

    /* ─ Core layout ─ */
    body{overflow:hidden;-webkit-text-size-adjust:100%;}
    .app{flex-direction:column;height:100dvh;overflow:hidden;}
    .nav{display:none!important;}
    .mob-nav{display:flex;}
    .desktop-only{display:none!important;}
    .mobile-only{display:block!important;}
    .mobile-only[style*="flex"]{display:flex!important;}
    .sketch-notes-panel{
      position:fixed;bottom:0;left:0;right:0;width:100%!important;
      border-left:none!important;border-top:1px solid var(--border);
      border-radius:16px 16px 0 0;
      max-height:70vh;padding:20px 16px 32px;
      box-shadow:0 -8px 40px rgba(0,0,0,.5);
    }
    .main{flex:1;min-height:0;padding-bottom:0;min-width:0;overflow:hidden;}

    /* ─ Topbar ─ */
    .topbar{padding:0 14px;height:52px;}
    .topbar-title{font-size:14px;}
    .topbar-crumb{font-size:12px;}
    .mob-topbar-brand{display:flex;}

    /* ─ Page ─ */
    .page{padding:12px 14px 24px;height:calc(100% - 52px);padding-bottom:calc(58px + 24px);overflow-y:auto;-webkit-overflow-scrolling:touch;}

    /* ─ Stats grid 2-col ─ */
    .stats-grid{grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
    .stat-card{padding:14px;}
    .stat-value{font-size:20px;}
    .stat-label{font-size:10px;}

    /* ─ Generic grids ─ */
    .grid-3,.grid-4{grid-template-columns:1fr 1fr;gap:10px;}
    .grid-2{grid-template-columns:1fr;gap:10px;}

    /* ─ Project list: single col ─ */
    .projects-grid{grid-template-columns:1fr!important;}
    .project-card-body{padding:14px 16px;}
    .project-card-footer{padding:9px 16px;}

    /* ─ Project detail hero ─ */
    .project-hero-body{padding:16px;}
    .project-hero-title{font-size:16px;margin-bottom:4px;}
    .project-hero-addr{font-size:12px;margin-bottom:12px;}
    .project-info-grid{grid-template-columns:1fr 1fr;gap:8px;}
    .project-info-box{padding:10px 12px;}
    .project-info-value{font-size:12.5px;}

    /* ─ Tabs scrollable ─ */
    .tabs{overflow-x:auto;-webkit-overflow-scrolling:touch;flex-wrap:nowrap!important;scrollbar-width:none;}
    .tabs::-webkit-scrollbar{display:none;}
    .tab-item{flex-shrink:0;white-space:nowrap;}

    /* ─ Photo grid 2-col ─ */
    .photo-grid{grid-template-columns:1fr 1fr!important;gap:8px!important;}

    /* ─ Forms ─ */
    .form-row,.form-row-3{grid-template-columns:1fr!important;gap:10px;}
    .form-input{font-size:16px;}/* prevents iOS zoom on focus */

    /* ─ Modals: slide up from bottom ─ */
    .modal-overlay{padding:0;align-items:flex-end;}
    .modal{border-radius:20px 20px 0 0;max-height:94dvh;max-width:100%!important;width:100%;}
    .modal-body{padding:18px;}
    .modal-header{padding:16px 18px;}
    .modal-footer{padding:12px 18px;flex-direction:column-reverse;gap:8px;}
    .modal-footer .btn{width:100%;justify-content:center;padding:12px 16px;}

    /* ─ Editor ─ */
    .editor-side{display:none;}
    .editor-toolbar{padding:7px 10px;gap:4px;overflow-x:auto;-webkit-overflow-scrolling:touch;}
    .editor-toolbar::-webkit-scrollbar{display:none;}
    .tool-btn{width:40px;height:40px;flex-shrink:0;}

    /* ─ Kanban board ─ */
    .board-scroll{-webkit-overflow-scrolling:touch;}

    /* ─ Report rows: always show actions ─ */
    .report-row-actions{opacity:1!important;}
    .report-row{padding:10px 12px;}

    /* ─ Section headers ─ */
    .section-title{font-size:15px;}
    .section-sub{font-size:12px;margin-bottom:12px;}

    /* ─ Empty states ─ */
    .empty{padding:40px 20px;}
    .empty-icon{width:54px;height:54px;}

    /* ─ Buttons ─ */
    .btn{padding:10px 14px;font-size:13px;}
    .btn-sm{padding:7px 12px;font-size:12px;}

    /* ─ Tasks: hide detail panel ─ */
    .task-detail-panel{display:none!important;}

    /* ─ Tasks list view: stack and simplify on mobile ─ */
    .task-list-row{flex-wrap:wrap;gap:8px!important;padding:10px 12px!important;}
    .task-list-meta{display:none!important;}
    .task-list-actions{opacity:1!important;margin-left:auto;}

    /* ─ Account page: grids collapse ─ */
    .account-grid{grid-template-columns:1fr!important;}
    .account-stats-grid{grid-template-columns:1fr 1fr!important;}
    .perm-row{grid-template-columns:1fr 52px 52px 52px!important;padding:8px 10px!important;font-size:12px!important;}
    .project-card-title{white-space:normal!important;}
    .proj-hero-header{flex-direction:column!important;gap:10px!important;}
    .proj-hero-btns{order:-1;width:100%;justify-content:space-between!important;}
    .proj-hero-text{width:100%;}
    .photo-actions{opacity:1!important;}
    .photo-action-btn{width:40px!important;height:40px!important;}
    .price-row{grid-template-columns:1fr 60px 70px!important;gap:4px!important;padding:9px 10px!important;font-size:12px!important;}
    .bill-row{grid-template-columns:1fr 90px 60px 52px!important;padding:9px 12px!important;font-size:11.5px!important;}

    /* ─ Settings: full width fields ─ */
    .settings-grid{grid-template-columns:1fr!important;}
  }

  @media (max-width: 480px) {
    .grid-3,.grid-4{grid-template-columns:1fr 1fr;}
    .stats-grid{grid-template-columns:1fr 1fr;}
    .project-info-grid{grid-template-columns:1fr 1fr;}
    .photo-grid{grid-template-columns:1fr 1fr!important;}
    /* Camera touch targets */
    .shutter-outer{width:68px;height:68px;}
    .shutter-inner{width:54px;height:54px;}
    .cam-icon-btn{width:44px;height:44px;}
  }
`;



// ── Camera Component ───────────────────────────────────────────────────────────
function CameraPage({ project, defaultRoom, onSave, onClose, settings }) {
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const flashRef     = useRef(null);
  const streamRef    = useRef(null);
  const mediaRecRef  = useRef(null);
  const chunksRef    = useRef([]);
  const recTimerRef  = useRef(null);

  const [camState,    setCamState]    = useState("starting");
  const [facing,      setFacing]      = useState("environment");
  const [zoom,        setZoom]        = useState(1);
  const [timerSec,    setTimerSec]    = useState(0);
  const [countdown,   setCountdown]   = useState(null);
  const [firing,      setFiring]      = useState(false);
  const [gridOn,      setGridOn]      = useState(true);
  const [reviewImg,   setReviewImg]   = useState(null);
  const [session,     setSession]     = useState([]);
  const [gps,         setGps]         = useState(null);
  const [gpsLabel,    setGpsLabel]    = useState("Locating…");
  const [selRoom,     setSelRoom]     = useState(defaultRoom || (project?.rooms?.[0]?.name) || "General");
  const [photoName,   setPhotoName]   = useState("");
  const [roomMenuOpen,setRoomMenuOpen]= useState(false);

  // Video mode state
  const [mode,        setMode]        = useState("photo");  // "photo" | "video"
  const [recState,    setRecState]    = useState("idle");   // "idle" | "recording" | "review"
  const [recSeconds,  setRecSeconds]  = useState(0);
  const [reviewVideo, setReviewVideo] = useState(null);     // object URL
  const [videoName,   setVideoName]   = useState("");

  const MAX_REC = 90;

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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: face, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCamState("live");
    } catch (e) {
      setCamState(e.name === "NotAllowedError" || e.name === "PermissionDeniedError" ? "denied" : "error");
    }
  }, []);

  useEffect(() => { startStream(facing); return () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    if (reviewVideo) URL.revokeObjectURL(reviewVideo);
  }; }, []);

  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const caps = track.getCapabilities?.();
    if (caps?.zoom) track.applyConstraints({ advanced: [{ zoom }] }).catch(() => {});
  }, [zoom]);

  // ── Photo capture ──
  const doSnap = useCallback(() => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas) return;
    setFiring(true);
    if (flashRef.current) { flashRef.current.classList.add("on"); setTimeout(() => flashRef.current?.classList.remove("on"), 140); }
    const qualityMap = { low: 0.5, moderate: 0.85, high: 0.97 };
    const jpegQuality = qualityMap[settings?.photoQuality] ?? 0.88;
    const resMap = { low: 1920, moderate: 2560, high: 3840 };
    const maxRes = resMap[settings?.photoQuality] ?? 2560;
    const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
    const scale = Math.min(maxRes / vw, maxRes / vh, 1);
    canvas.width = Math.round(vw * scale); canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext("2d");
    if (facing === "user") { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "rgba(0,0,0,0.52)";
    ctx.fillRect(10, canvas.height - 58, 480, 46);
    ctx.fillStyle = "white"; ctx.font = "bold 13px sans-serif";
    ctx.fillText(`${project?.title || "Jobsite"} — ${selRoom}  •  ${new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} ${new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:(settings?.timeFormat!=="24hr")})}`, 18, canvas.height - 37);
    ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.font = "12px sans-serif";
    ctx.fillText(gps ? `GPS: ${gps.lat}, ${gps.lng}` : "GPS: unavailable", 18, canvas.height - 17);
    setReviewImg(canvas.toDataURL("image/jpeg", jpegQuality));
    setTimeout(() => setFiring(false), 200);
  }, [facing, gps, selRoom, project, settings?.photoQuality]);

  const handleShutter = () => {
    if (timerSec === 0) { doSnap(); return; }
    let c = timerSec; setCountdown(c);
    const iv = setInterval(() => { c--; if (c <= 0) { clearInterval(iv); setCountdown(null); doSnap(); } else setCountdown(c); }, 1000);
  };

  const acceptPhoto = () => {
    const name = photoName.trim() || `${selRoom} — ${new Date().toLocaleTimeString()}`;
    if (settings?.saveToCameraRoll && reviewImg) {
      const a = document.createElement("a");
      a.href = reviewImg;
      a.download = `KrakenCam_${name.replace(/[^a-z0-9]/gi,"_")}.jpg`;
      a.click();
    }
    setSession(prev => [...prev, { id: uid(), dataUrl: reviewImg, room: selRoom, name, date: today(), tags: ["live capture"], gps }]);
    setReviewImg(null); setPhotoName("");
  };

  // ── Video recording ──
  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "video/mp4";
    const rec = new MediaRecorder(streamRef.current, { mimeType });
    rec.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url  = URL.createObjectURL(blob);
      setReviewVideo({ url, blob, mimeType });
      setRecState("review");
    };
    rec.start(100);
    mediaRecRef.current = rec;
    setRecSeconds(0);
    setRecState("recording");
    recTimerRef.current = setInterval(() => {
      setRecSeconds(s => {
        if (s + 1 >= MAX_REC) { stopRecording(); return MAX_REC; }
        return s + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
  };

  const handleVideoShutter = () => {
    if (recState === "idle")      startRecording();
    else if (recState === "recording") stopRecording();
  };

  const acceptVideo = () => {
    if (!reviewVideo) return;
    const name = videoName.trim() || `${selRoom} — Video ${new Date().toLocaleTimeString()}`;
    setSession(prev => [...prev, {
      id: uid(),
      dataUrl: reviewVideo.url,
      isVideo: true,
      mimeType: reviewVideo.mimeType,
      room: selRoom, name, date: today(),
      tags: ["video", "live capture"], gps,
      duration: recSeconds,
    }]);
    URL.revokeObjectURL(reviewVideo.url);
    setReviewVideo(null); setVideoName(""); setRecSeconds(0); setRecState("idle");
  };

  const discardVideo = () => {
    if (reviewVideo) URL.revokeObjectURL(reviewVideo.url);
    setReviewVideo(null); setRecSeconds(0); setRecState("idle");
  };

  const flipCam = async () => { const next = facing === "environment" ? "user" : "environment"; setFacing(next); await startStream(next); };
  const cycleTimer = () => setTimerSec(t => t === 0 ? 3 : t === 3 ? 10 : 0);

  const roomList = project?.rooms?.map(r => r.name) || ["General"];

  const fmtTime = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const recPct  = (recSeconds / MAX_REC) * 100;

  if (camState === "denied") return (
    <div className="cam-page"><div className="cam-error"><div className="cam-error-icon"><Icon d={ic.alert} size={32} stroke="var(--accent)" /></div><div style={{ fontSize:16,fontWeight:700,color:"var(--text)" }}>Camera Access Denied</div><div style={{ fontSize:13,maxWidth:320 }}>Allow camera permissions in your browser settings, then try again.</div><div style={{ display:"flex",gap:10,marginTop:4 }}><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => startStream(facing)}>Try Again</button></div></div></div>
  );
  if (camState === "error") return (
    <div className="cam-page"><div className="cam-error"><div className="cam-error-icon"><Icon d={ic.alert} size={32} stroke="var(--accent)" /></div><div style={{ fontSize:16,fontWeight:700,color:"var(--text)" }}>Camera Unavailable</div><div style={{ fontSize:13,maxWidth:320 }}>No camera found or it is in use by another app.</div><div style={{ display:"flex",gap:10,marginTop:4 }}><button className="btn btn-secondary" onClick={onClose}>Go Back</button><button className="btn btn-primary" onClick={() => startStream(facing)}>Retry</button></div></div></div>
  );

  return (
    <div className="cam-page">
      <canvas ref={canvasRef} style={{ display:"none" }} />

      {/* ── Photo review overlay ── */}
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

      {/* ── Video review overlay ── */}
      {recState === "review" && reviewVideo && (
        <div className="review-overlay">
          <video src={reviewVideo.url} controls autoPlay loop style={{ width:"100%",height:"100%",objectFit:"contain",background:"#000" }} />
          <div className="review-meta">
            <div style={{ display:"flex",gap:12,marginBottom:12,alignItems:"flex-end" }}>
              <div style={{ flex:1 }}>
                <div className="form-label">Video Name</div>
                <input className="form-input" placeholder={`${selRoom} video…`} value={videoName} onChange={e => setVideoName(e.target.value)} autoFocus />
              </div>
              <div style={{ minWidth:150 }}>
                <div className="form-label">Room</div>
                <select className="form-input form-select" value={selRoom} onChange={e => setSelRoom(e.target.value)}>
                  {roomList.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,.6)",marginBottom:10 }}>
              🎬 Duration: {fmtTime(recSeconds)} · {gps ? `GPS: ${gps.lat}, ${gps.lng}` : "No GPS"}
            </div>
            <div style={{ display:"flex",gap:10 }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={discardVideo}>Discard</button>
              <button className="btn btn-primary" style={{ flex:2 }} onClick={acceptVideo}><Icon d={ic.check} size={15} /> Save Video</button>
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
        {gridOn && camState === "live" && mode === "photo" && (
          <svg className="cam-grid-svg" style={{ opacity:.22 }}>
            <line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke="white" strokeWidth="1" />
            <line x1="66.66%" y1="0" x2="66.66%" y2="100%" stroke="white" strokeWidth="1" />
            <line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke="white" strokeWidth="1" />
            <line x1="0" y1="66.66%" x2="100%" y2="66.66%" stroke="white" strokeWidth="1" />
          </svg>
        )}
        <div className="cam-guide"><div className="cam-guide-box"><span /></div></div>
        {countdown !== null && <div className="cam-countdown"><div className="cam-countdown-num">{countdown}</div></div>}

        {/* Recording indicator + timer bar */}
        {recState === "recording" && (
          <div style={{ position:"absolute",top:0,left:0,right:0,zIndex:12 }}>
            {/* Progress bar */}
            <div style={{ height:3,background:"rgba(255,255,255,.15)" }}>
              <div style={{ height:"100%",background:"#e85a3a",width:`${recPct}%`,transition:"width 1s linear" }} />
            </div>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,paddingTop:10 }}>
              <span style={{ width:10,height:10,borderRadius:"50%",background:"#e85a3a",display:"inline-block",boxShadow:"0 0 8px #e85a3a",animation:"recBlink 1s ease-in-out infinite" }} />
              <span style={{ color:"white",fontWeight:700,fontSize:15,letterSpacing:".05em",textShadow:"0 1px 4px rgba(0,0,0,.8)" }}>{fmtTime(recSeconds)}</span>
              <span style={{ color:"rgba(255,255,255,.6)",fontSize:12 }}>/ {fmtTime(MAX_REC)}</span>
            </div>
          </div>
        )}

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
        {/* Session thumbnails */}
        {session.length > 0 && (
          <div style={{ marginBottom:10 }}>
            <div className="cam-thumb-row">
              {session.map((s,i) => (
                <div key={i} style={{ position:"relative",flexShrink:0 }}>
                  {s.isVideo
                    ? <div className="cam-thumb" style={{ background:"#111",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:3 }}>
                        <span style={{ fontSize:18 }}>🎬</span>
                        <span style={{ fontSize:9,color:"rgba(255,255,255,.7)" }}>{fmtTime(s.duration||0)}</span>
                      </div>
                    : <img className="cam-thumb" src={s.dataUrl} alt={s.name} title={s.name} />
                  }
                </div>
              ))}
            </div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,.55)" }}>
              {session.filter(s=>!s.isVideo).length} photo{session.filter(s=>!s.isVideo).length!==1?"s":""}
              {session.filter(s=>s.isVideo).length > 0 && ` · ${session.filter(s=>s.isVideo).length} video${session.filter(s=>s.isVideo).length!==1?"s":""}`} captured
            </div>
          </div>
        )}

        {/* Mode toggle — Photo / Video */}
        <div style={{ display:"flex",justifyContent:"center",marginBottom:14 }}>
          <div style={{ display:"flex",background:"rgba(0,0,0,.5)",borderRadius:20,padding:3,border:"1px solid rgba(255,255,255,.15)" }}>
            {[{v:"photo",label:"📷 Photo"},{v:"video",label:"🎬 Video"}].map(({v,label})=>(
              <button key={v} disabled={recState==="recording"}
                onClick={()=>{ if(recState!=="recording") setMode(v); }}
                style={{ padding:"6px 18px",borderRadius:16,fontSize:12.5,fontWeight:700,border:"none",cursor:recState==="recording"?"not-allowed":"pointer",background:mode===v?"white":"transparent",color:mode===v?"#111":"rgba(255,255,255,.7)",transition:"all .15s" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12 }}>
          {/* Left controls */}
          <div style={{ display:"flex",gap:10,alignItems:"center" }}>
            {mode === "photo" && (
              <>
                <div className="cam-icon-btn" title="Self-timer" onClick={cycleTimer}>
                  {timerSec > 0 ? <span style={{ fontWeight:700,fontSize:13 }}>{timerSec}s</span> : <Icon d={ic.timer} size={18} />}
                </div>
                <div className={`cam-icon-btn ${gridOn?"lit":""}`} title="Grid" onClick={() => setGridOn(g => !g)}><Icon d={ic.grid} size={18} /></div>
              </>
            )}
            {mode === "video" && recState === "idle" && (
              <div style={{ fontSize:11.5,color:"rgba(255,255,255,.5)",lineHeight:1.4,maxWidth:90,textAlign:"center" }}>Up to<br/>90 sec</div>
            )}
            {mode === "video" && recState === "recording" && (
              <div style={{ fontSize:12,color:"#e85a3a",fontWeight:700 }}>{fmtTime(MAX_REC - recSeconds)} left</div>
            )}
          </div>

          {/* Shutter / Record button */}
          {mode === "photo"
            ? <div className="shutter-outer" onClick={handleShutter}><div className={`shutter-inner ${firing?"firing":""}`} /></div>
            : <div onClick={handleVideoShutter} style={{ cursor:"pointer",position:"relative",width:72,height:72,display:"flex",alignItems:"center",justifyContent:"center" }}>
                <div style={{ position:"absolute",inset:0,borderRadius:"50%",border:`3px solid ${recState==="recording"?"#e85a3a":"white"}`,transition:"border-color .2s" }} />
                <div style={{ width:recState==="recording"?28:54,height:recState==="recording"?28:54,borderRadius:recState==="recording"?6:"50%",background:recState==="recording"?"#e85a3a":"white",transition:"all .2s",boxShadow:recState==="recording"?"0 0 16px #e85a3a66":"none" }} />
              </div>
          }

          {/* Right controls */}
          <div style={{ display:"flex",gap:10,alignItems:"center" }}>
            <div className="cam-icon-btn" title="Flip camera" onClick={flipCam}><Icon d={ic.rotateCw} size={18} /></div>
            {mode === "photo" && (
              <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:3 }}>
                <span style={{ fontSize:10,color:"rgba(255,255,255,.6)",fontWeight:600 }}>{zoom.toFixed(1)}×</span>
                <input type="range" className="zoom-slider" min="1" max="5" step="0.1" value={zoom} onChange={e => setZoom(+e.target.value)} />
              </div>
            )}
            {session.length > 0 && (
              <button className="btn btn-primary btn-sm" onClick={() => onSave(session)}><Icon d={ic.check} size={14} /> Save {session.length}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ImageEditor({ photo, onClose, onSave }) {
  const canvasRef   = useRef(null);
  const startPos    = useRef(null);
  const lastPos     = useRef(null);
  const snapRef     = useRef(null);

  const [tool,        setTool]        = useState("pen");
  const [color,       setColor]       = useState("#e86c3a");
  const [bgColor,     setBgColor]     = useState("transparent");
  const [size,        setSize]        = useState(25);
  const [drawing,     setDrawing]     = useState(false);
  const [history,     setHistory]     = useState([]);
  const [future,      setFuture]      = useState([]);
  const [cropRect,    setCropRect]    = useState(null);
  const cropStartRef  = useRef(null);

  const COLORS = ["#e86c3a","#4a90d9","#3dba7e","#8b7cf8","#e8c53a","#ff6b6b","#fff","#000","#a0b0cc","#f0954e","#3ab8e8","#e85a3a"];

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    if (photo?.dataUrl) {
      const img = new Image();
      img.onload = () => {
        const MAX_W = 1920, MAX_H = 1080;
        const scale = Math.min(1, MAX_W / img.width, MAX_H / img.height);
        c.width  = Math.round(img.width  * scale);
        c.height = Math.round(img.height * scale);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        saveSnap();
      };
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

  const pt = e => {
    const c = canvasRef.current, r = c.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx-r.left)*(c.width/r.width), y: (cy-r.top)*(c.height/r.height) };
  };

  const isShape = t => t === "rect" || t === "circle" || t === "arrow";

  const applyCrop = () => {
    if (!cropRect) return;
    const c = canvasRef.current; if (!c) return;
    const { x, y, w, h } = cropRect;
    if (w < 4 || h < 4) { setCropRect(null); return; }
    const tmp = document.createElement("canvas");
    tmp.width = Math.round(Math.abs(w)); tmp.height = Math.round(Math.abs(h));
    const sx = w < 0 ? x + w : x, sy = h < 0 ? y + h : y;
    tmp.getContext("2d").drawImage(c, sx, sy, Math.abs(w), Math.abs(h), 0, 0, tmp.width, tmp.height);
    c.width = tmp.width; c.height = tmp.height;
    c.getContext("2d").drawImage(tmp, 0, 0);
    setCropRect(null); saveSnap();
  };

  const onDown = e => {
    if (tool === "crop") {
      const p = pt(e); cropStartRef.current = p;
      setCropRect({ x: p.x, y: p.y, w: 0, h: 0 }); return;
    }
    const p = pt(e);
    setDrawing(true); startPos.current = p; lastPos.current = p;
    if (isShape(tool)) {
      snapRef.current = canvasRef.current.toDataURL();
    } else {
      const ctx = canvasRef.current.getContext("2d");
      ctx.beginPath(); ctx.arc(p.x, p.y, size/2, 0, Math.PI*2);
      ctx.fillStyle = color; ctx.fill();
    }
  };

  

  const onMove = e => {
    if (tool === "crop" && cropStartRef.current) {
      const p = pt(e);
      setCropRect({ x: cropStartRef.current.x, y: cropStartRef.current.y, w: p.x - cropStartRef.current.x, h: p.y - cropStartRef.current.y });
      return;
    }
    if (!drawing) return;
    const ctx = canvasRef.current.getContext("2d"), p = pt(e);
    if (tool === "pen") {
      ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
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
    if (tool === "crop") { cropStartRef.current = null; return; }
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



  const triggerDownload = (dataUrl, filename) => {
    const a = document.createElement("a");
    a.download = filename;
    a.href = dataUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const exportImg = () => {
    triggerDownload(canvasRef.current.toDataURL("image/jpeg", 0.95), `${photo?.name || "photo"}.jpg`);
  };
  const downloadPng = () => {
    triggerDownload(canvasRef.current.toDataURL("image/png"), `${photo?.name || "photo"}_edited.png`);
  };
  const handleDone = () => {
    const c = canvasRef.current;
    if (c && onSave) onSave(c.toDataURL("image/jpeg", 0.93));
    onClose();
  };

  const tools = [
    { id:"pen",    icon:ic.pen,    label:"Draw"   },
    { id:"arrow",  icon:"M5 12h14 M12 5l7 7-7 7", label:"Arrow"  },
    { id:"rect",   icon:"M3 3h18v18H3z",           label:"Square" },
    { id:"circle", icon:"M12 22a10 10 0 100-20 10 10 0 000 20z", label:"Circle" },
    { id:"crop",   icon:"M6 2v14a2 2 0 002 2h14 M18 22V8a2 2 0 00-2-2H2", label:"Crop" },
  ];

  const cursor = "crosshair";

  return (
    <div className="editor-wrap fade-in">
      {/* ── Toolbar ── */}
      <div className="editor-toolbar">
        <button className="btn btn-sm btn-ghost" onClick={onClose}>← Back</button>
        <div className="tool-sep" />
        {tools.map(t => (
          <div key={t.id} className={`tool-btn ${tool===t.id?"active":""}`} title={t.label}
            onClick={() => { setCropRect(null); setTool(t.id); }}>
            <Icon d={t.icon} size={15} />
          </div>
        ))}
        {tool === "crop" && cropRect && Math.abs(cropRect.w) > 4 && Math.abs(cropRect.h) > 4 && (<>
          <div className="tool-sep" />
          <button className="btn btn-sm btn-primary" style={{ fontSize:11.5, padding:"4px 12px" }} onClick={applyCrop}>✓ Apply Crop</button>
          <button className="btn btn-sm btn-secondary" style={{ fontSize:11.5, padding:"4px 10px" }} onClick={() => setCropRect(null)}>✕ Cancel</button>
        </>)}
        <div className="tool-sep" />
        <div className="tool-btn" title="Undo" onClick={undo}><Icon d={ic.undo} size={15} /></div>
        <div className="tool-btn" title="Redo" onClick={redo} style={{ transform:"scaleX(-1)" }}><Icon d={ic.undo} size={15} /></div>
        <div style={{ marginLeft:"auto",display:"flex",gap:8 }}>
          <button className="btn btn-sm btn-secondary" onClick={exportImg} title="Download as JPEG"><Icon d={ic.download} size={14} /> JPG</button>
          <button className="btn btn-sm btn-secondary" onClick={downloadPng} title="Download as PNG"><Icon d={ic.download} size={14} /> PNG</button>
          <button className="btn btn-sm btn-primary" onClick={handleDone}><Icon d={ic.check} size={14} /> Done</button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="editor-body">
        <div className="canvas-area">
          <div style={{ position:"relative", display:"inline-block", lineHeight:0 }}>
          <canvas ref={canvasRef} width={1280} height={960}
            style={{ borderRadius:8, cursor, border:"1px solid var(--border)", maxWidth:"100%", maxHeight:"100%", display:"block" }}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
            onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
          />

          {/* ── Crop overlay ── */}
          {tool === "crop" && cropRect && (() => {
            const c = canvasRef.current;
            if (!c) return null;
            const rect = c.getBoundingClientRect();
            const scaleX = rect.width  / c.width;
            const scaleY = rect.height / c.height;
            const cx = (cropRect.w < 0 ? cropRect.x + cropRect.w : cropRect.x) * scaleX;
            const cy = (cropRect.h < 0 ? cropRect.y + cropRect.h : cropRect.y) * scaleY;
            const cw = Math.abs(cropRect.w) * scaleX;
            const ch = Math.abs(cropRect.h) * scaleY;
            const W = rect.width, H = rect.height;
            return (
              <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
                {/* dark overlay outside crop */}
                <svg width={W} height={H} style={{ position:"absolute", inset:0 }}>
                  <defs>
                    <mask id="crop-mask">
                      <rect width={W} height={H} fill="white" />
                      <rect x={cx} y={cy} width={cw} height={ch} fill="black" />
                    </mask>
                  </defs>
                  <rect width={W} height={H} fill="rgba(0,0,0,0.55)" mask="url(#crop-mask)" />
                  {/* crop border */}
                  <rect x={cx} y={cy} width={cw} height={ch} fill="none" stroke="white" strokeWidth="1.5" strokeDasharray="6 3" />
                  {/* rule-of-thirds grid */}
                  {cw > 20 && ch > 20 && [1,2].map(i => (
                    <g key={i}>
                      <line x1={cx + cw*i/3} y1={cy} x2={cx + cw*i/3} y2={cy+ch} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
                      <line x1={cx} y1={cy + ch*i/3} x2={cx+cw} y2={cy + ch*i/3} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
                    </g>
                  ))}
                  {/* corner handles */}
                  {[[cx,cy],[cx+cw,cy],[cx,cy+ch],[cx+cw,cy+ch]].map(([hx,hy],i) => (
                    <g key={i}>
                      <rect x={hx-5} y={hy-5} width={10} height={10} fill="white" rx="2" />
                    </g>
                  ))}
                  {/* dimensions label */}
                  {cw > 60 && ch > 30 && (
                    <text x={cx + cw/2} y={cy + ch/2} textAnchor="middle" dominantBaseline="middle"
                      fill="white" fontSize="12" fontFamily="sans-serif"
                      style={{ textShadow:"0 1px 3px rgba(0,0,0,0.8)" }}>
                      {Math.round(Math.abs(cropRect.w))} × {Math.round(Math.abs(cropRect.h))}
                    </text>
                  )}
                </svg>
              </div>
            );
          })()}

          </div>{/* end canvas inner wrapper */}
        </div>

        {/* ── Sidebar ── */}
        <div className="editor-side">
          <h4>Stroke Color</h4>
          <div className="color-grid">
            {COLORS.map(c => <div key={c} className={`color-dot ${color===c?"sel":""}`} style={{ background:c }}
              onClick={() => setColor(c)} />)}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
            <span style={{ fontSize:11,color:"var(--text2)" }}>Custom</span>
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              style={{ width:28,height:28,borderRadius:6,border:"1px solid var(--border)",cursor:"pointer",padding:2,background:"none" }} />
          </div>

          <h4>Background / Fill</h4>
          <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginBottom:6 }}>
            <div onClick={() => setBgColor("transparent")}
              style={{ width:22,height:22,borderRadius:5,cursor:"pointer",border:`2px solid ${bgColor==="transparent"?"white":"transparent"}`,
                backgroundImage:"linear-gradient(45deg,#666 25%,transparent 25%,transparent 75%,#666 75%),linear-gradient(45deg,#666 25%,transparent 25%,transparent 75%,#666 75%)",
                backgroundSize:"8px 8px",backgroundPosition:"0 0,4px 4px" }} />
            {["rgba(0,0,0,0.5)","rgba(255,255,255,0.5)","#e86c3a","#4a90d9","#3dba7e","#e8c53a","#ff6b6b","#000","#fff","#8b7cf8","#f0954e","#1a1e28"].map(c => (
              <div key={c} className={`color-dot ${bgColor===c?"sel":""}`} style={{ background:c }}
                onClick={() => setBgColor(c)} />
            ))}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
            <span style={{ fontSize:11,color:"var(--text2)" }}>Custom</span>
            <input type="color" value={bgColor==="transparent"?"#000000":bgColor}
              onChange={e => setBgColor(e.target.value)}
              style={{ width:28,height:28,borderRadius:6,border:"1px solid var(--border)",cursor:"pointer",padding:2,background:"none" }} />
          </div>

          <h4>Brush / Line Size</h4>
          <input type="range" min="10" max="80" value={size} onChange={e => setSize(+e.target.value)} className="size-slider" />
          <div style={{ fontSize:11.5,color:"var(--text2)",marginBottom:12 }}>
            <span>{size}px</span>
          </div>

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
const ROLE_META = {
  admin:   { label:"Admin",   color:"#e86c3a", desc:"Full system control"                            },
  manager: { label:"Manager", color:"#8b7cf8", desc:"Create projects, view reports, manage users"    },
  user:    { label:"User",    color:"#3dba7e", desc:"Upload photos, fill reports, complete checklists"},
};

function ProjectModal({ project, teamUsers = [], settings = {}, onSave, onClose }) {
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
    // New fields
    projectNumber:       project?.projectNumber       || "",
    propertyType:        project?.propertyType        || "",
    causeOfLoss:         project?.causeOfLoss         || "",
    dateInspection:      project?.dateInspection      || "",
    timeInspection:      project?.timeInspection      || "12:00",
    dateWorkPerformed:   project?.dateWorkPerformed   || "",
    accessLimitations:   project?.accessLimitations   || "",
    powerStatus:         project?.powerStatus         || "on",
    waterStatus:         project?.waterStatus         || "on",
    ppeItems:            project?.ppeItems            || [],
    ppeOtherText:        project?.ppeOtherText        || "",
    // Insurance
    insuranceEnabled:    project?.insuranceEnabled    || false,
    insuranceCarrier:    project?.insuranceCarrier    || "",
    insurancePolicyNum:  project?.insurancePolicyNum  || "",
    claimNumber:         project?.claimNumber         || "",
    adjusterName:        project?.adjusterName        || "",
    adjusterPhone:       project?.adjusterPhone       || "",
    adjusterEmail:       project?.adjusterEmail       || "",
    adjusterCompany:     project?.adjusterCompany     || "",
    dateOfLoss:          project?.dateOfLoss          || "",
    coverageType:        project?.coverageType        || "",
    // Timeline
    timelineStage:       project?.timelineStage       || "",
    timelineNotes:       project?.timelineNotes       || {},
  });
  const [teamMembers, setTeamMembers] = useState(project?.teamMembers || []);
  // assignedUserIds: array of user IDs from the account's teamUsers
  const [assignedUserIds, setAssignedUserIds] = useState(project?.assignedUserIds || []);
  const toggleAssignUser = (id) => setAssignedUserIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  const assignableUsers = teamUsers.filter(u => u.status === "active" && (u.role === "manager" || u.role === "user"));
  const [customRooms, setCustomRooms] = useState(
    project?.rooms?.map(r => r.name) || []
  );
  const [newRoom, setNewRoom] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const COLORS_PROJECT = ["#4a90d9","#3dba7e","#8b7cf8","#e85a3a","#e8703a","#e8c53a","#3ab8e8","#f0954e"];
  const PROJECT_TYPES = ["Renovation","Insurance Claim","Inspection","Repair","New Construction","Mitigation","Remediation","Demolition","Consultation","Quote Request","Other"];
  const PROPERTY_TYPES = ["Single Family Home","Multi-Family Unit","Apartment","Commercial Building","Warehouse","Other"];
  const CAUSE_OF_LOSS = ["Water — Pipe Burst","Water — Flooding","Water — Sewage Backup","Water — Roof Leak","Fire — Structure","Fire — Smoke/Soot","Wind / Storm Damage","Mold / Microbial","Impact / Collision","Vandalism / Break-In","Earthquake","Hail","Electrical","Other"];
  const PPE_OPTIONS = ["Hard Hat","Safety Glasses / Goggles","Work Boots","Respirator","Tyvek Suit","Gloves","High Viz"];
  const togglePPE = item => set("ppeItems", form.ppeItems.includes(item) ? form.ppeItems.filter(x => x !== item) : [...form.ppeItems, item]);
  const TIMELINE_STAGES = [
    { id:"lead",        label:"Lead",           icon:"📋" },
    { id:"assessment",  label:"Assessment",     icon:"🔍" },
    { id:"approved",    label:"Approved",       icon:"✅" },
    { id:"in_progress", label:"In Progress",    icon:"🔨" },
    { id:"final_walk",  label:"Final Walk",     icon:"🚶" },
    { id:"invoiced",    label:"Invoiced",       icon:"🧾" },
    { id:"completed",   label:"Completed",      icon:"🏁" },
  ];

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
      assignedUserIds,
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
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22} /></button>
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
            <div className="form-row">
              <div className="form-group" style={{ flex:2 }}>
                <label className="form-label">Job Title *</label>
                <input className="form-input" placeholder="e.g. 123 Oak Street Full Renovation" value={form.title} onChange={e => set("title", e.target.value)} />
              </div>
              <div className="form-group" style={{ flex:1 }}>
                <label className="form-label">Project Number</label>
                <input className="form-input" placeholder="e.g. PRJ-2024-001" value={form.projectNumber} onChange={e => set("projectNumber", e.target.value)} />
              </div>
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
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Property Type</label>
                <select className="form-input form-select" value={form.propertyType} onChange={e => set("propertyType", e.target.value)}>
                  <option value="">— Select —</option>
                  {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cause of Loss / Issue</label>
                <select className="form-input form-select" value={form.causeOfLoss} onChange={e => set("causeOfLoss", e.target.value)}>
                  <option value="">— Select —</option>
                  {CAUSE_OF_LOSS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date of Inspection / Assessment</label>
                <div className="date-input-wrap">
                  <input className="form-input" type="date" value={form.dateInspection} onChange={e => set("dateInspection", e.target.value)} />
                  <span className="date-icon"><Icon d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" size={18} stroke="var(--accent)" strokeWidth={2} /></span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Time of Inspection / Assessment</label>
                <input className="form-input" type="time"
                  value={form.timeInspection}
                  onChange={e => set("timeInspection", e.target.value)}
                  style={{ colorScheme:"dark" }}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date Work Performed</label>
                <div className="date-input-wrap">
                  <input className="form-input" type="date" value={form.dateWorkPerformed} onChange={e => set("dateWorkPerformed", e.target.value)} />
                  <span className="date-icon"><Icon d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" size={18} stroke="var(--accent)" strokeWidth={2} /></span>
                </div>
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

          {/* Site Conditions */}
          <div className="form-section">
            <div className="form-section-title"><Icon d={ic.alert} size={15} stroke="var(--accent)" /> Site Conditions</div>

            <div className="form-group">
              <label className="form-label">Access Limitations / Restricted Areas</label>
              <input className="form-input" placeholder="e.g. Basement locked, roof access restricted…" value={form.accessLimitations} onChange={e => set("accessLimitations", e.target.value)} />
            </div>

            <div className="form-row">
              {/* Power Status */}
              <div className="form-group">
                <label className="form-label">Power Status</label>
                <div style={{ display:"flex", gap:8, marginTop:4 }}>
                  {["on","off"].map(v => (
                    <div key={v} onClick={() => set("powerStatus", v)}
                      style={{ flex:1, padding:"9px 0", textAlign:"center", borderRadius:"var(--radius-sm)", border:`2px solid ${form.powerStatus===v ? "var(--accent)" : "var(--border)"}`, background: form.powerStatus===v ? "var(--accent-glow)" : "var(--surface2)", cursor:"pointer", fontSize:13, fontWeight:600, color: form.powerStatus===v ? "var(--accent)" : "var(--text2)", transition:"all .15s" }}>
                      {v === "on" ? "⚡ On" : "🔌 Off"}
                    </div>
                  ))}
                </div>
              </div>
              {/* Water Status */}
              <div className="form-group">
                <label className="form-label">Water Status</label>
                <div style={{ display:"flex", gap:8, marginTop:4 }}>
                  {["on","off"].map(v => (
                    <div key={v} onClick={() => set("waterStatus", v)}
                      style={{ flex:1, padding:"9px 0", textAlign:"center", borderRadius:"var(--radius-sm)", border:`2px solid ${form.waterStatus===v ? "var(--accent)" : "var(--border)"}`, background: form.waterStatus===v ? "var(--accent-glow)" : "var(--surface2)", cursor:"pointer", fontSize:13, fontWeight:600, color: form.waterStatus===v ? "var(--accent)" : "var(--text2)", transition:"all .15s" }}>
                      {v === "on" ? "💧 On" : "🚱 Off"}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* PPE */}
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">PPE Required On Site</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:6 }}>
                {PPE_OPTIONS.map(item => {
                  const active = form.ppeItems.includes(item);
                  return (
                    <div key={item} onClick={() => togglePPE(item)}
                      style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent-glow)" : "var(--surface2)", cursor:"pointer", fontSize:12.5, fontWeight:600, color: active ? "var(--accent)" : "var(--text2)", transition:"all .15s", userSelect:"none" }}>
                      {active ? "✓ " : ""}{item}
                    </div>
                  );
                })}
                {/* Other option */}
                <div onClick={() => togglePPE("Other")}
                  style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${form.ppeItems.includes("Other") ? "var(--accent)" : "var(--border)"}`, background: form.ppeItems.includes("Other") ? "var(--accent-glow)" : "var(--surface2)", cursor:"pointer", fontSize:12.5, fontWeight:600, color: form.ppeItems.includes("Other") ? "var(--accent)" : "var(--text2)", transition:"all .15s", userSelect:"none" }}>
                  {form.ppeItems.includes("Other") ? "✓ " : ""}Other
                </div>
              </div>
              {form.ppeItems.includes("Other") && (
                <input className="form-input" style={{ marginTop:10 }} placeholder="Describe other PPE required…" value={form.ppeOtherText} onChange={e => set("ppeOtherText", e.target.value)} />
              )}
            </div>
          </div>

          {/* Insurance — collapsible */}
          <div className="form-section">
            <div className="form-section-title" style={{ cursor:"pointer", userSelect:"none" }} onClick={() => set("insuranceEnabled", !form.insuranceEnabled)}>
              <Icon d={ic.briefcase} size={15} stroke="var(--accent)" /> Insurance Information
              <span style={{ marginLeft:"auto", fontSize:12, color:"var(--text3)", fontWeight:400, background:"var(--surface3)", padding:"2px 10px", borderRadius:10 }}>
                {form.insuranceEnabled ? "▲ Hide" : "▼ Add"}
              </span>
            </div>
            {form.insuranceEnabled && (
              <>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Insurance Carrier</label><input className="form-input" placeholder="e.g. State Farm" value={form.insuranceCarrier} onChange={e => set("insuranceCarrier", e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Policy Number</label><input className="form-input" placeholder="POL-000000" value={form.insurancePolicyNum} onChange={e => set("insurancePolicyNum", e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Claim Number</label><input className="form-input" placeholder="CLM-000000" value={form.claimNumber} onChange={e => set("claimNumber", e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Date of Loss</label><div className="date-input-wrap"><input className="form-input" type="date" value={form.dateOfLoss} onChange={e => set("dateOfLoss", e.target.value)} /><span className="date-icon"><Icon d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" size={18} stroke="var(--accent)" strokeWidth={2} /></span></div></div>
                </div>
                <div className="form-group">
                  <label className="form-label">Coverage Type</label>
                  <select className="form-input form-select" value={form.coverageType} onChange={e => set("coverageType", e.target.value)}>
                    <option value="">— Select —</option>
                    {["Dwelling","Contents","Liability","ALE (Additional Living Expenses)","Commercial Property","Business Interruption","Flood","Other"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ borderTop:"1px solid var(--border)", paddingTop:14, marginTop:4 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:12 }}>Adjuster Contact</div>
                  <div className="form-group"><label className="form-label">Adjuster Name</label><input className="form-input" placeholder="John Smith" value={form.adjusterName} onChange={e => set("adjusterName", e.target.value)} /></div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Adjuster Company</label><input className="form-input" placeholder="e.g. Crawford & Company" value={form.adjusterCompany} onChange={e => set("adjusterCompany", e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">Phone</label><input className="form-input" placeholder="(555) 000-0000" value={form.adjusterPhone} onChange={e => set("adjusterPhone", e.target.value)} /></div>
                  </div>
                  <div className="form-group"><label className="form-label">Email</label><input className="form-input" placeholder="adjuster@carrier.com" value={form.adjusterEmail} onChange={e => set("adjusterEmail", e.target.value)} /></div>
                </div>
              </>
            )}
          </div>

          {/* Team Members */}
          <div className="form-section">
            <div className="form-section-title"><Icon d={ic.users} size={15} stroke="var(--accent)" /> Team Members</div>

            {assignableUsers.length === 0 ? (
              <div style={{ padding:"14px 16px",background:"var(--surface2)",border:"1px dashed var(--border)",borderRadius:"var(--radius-sm)",fontSize:13,color:"var(--text2)",display:"flex",alignItems:"center",gap:10 }}>
                <Icon d={ic.users} size={16} stroke="var(--text3)" />
                <span>No managers or users in your account yet. Add team members in <strong style={{ color:"var(--accent)" }}>Account → Team Members</strong> first.</span>
              </div>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {assignableUsers.map(u => {
                  const sel = assignedUserIds.includes(u.id);
                  const meta = ROLE_META[u.role] || ROLE_META.user;
                  return (
                    <div key={u.id} onClick={() => toggleAssignUser(u.id)}
                      style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 13px",borderRadius:"var(--radius-sm)",border:`1px solid ${sel?"var(--accent)":"var(--border)"}`,background:sel?"var(--accent-glow)":"var(--surface2)",cursor:"pointer",transition:"all .15s" }}>
                      <div style={{ width:34,height:34,borderRadius:"50%",background:meta.color,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:13,color:"white",flexShrink:0 }}>
                        {`${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase()||"?"}
                      </div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontWeight:600,fontSize:13.5 }}>{u.firstName} {u.lastName}</div>
                        <div style={{ fontSize:12,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{u.title||u.email}</div>
                      </div>
                      <span style={{ fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:20,background:`${meta.color}18`,color:meta.color,flexShrink:0 }}>{meta.label}</span>
                      <div style={{ width:20,height:20,borderRadius:"50%",border:`2px solid ${sel?"var(--accent)":"var(--border)"}`,background:sel?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s" }}>
                        {sel && <Icon d={ic.check} size={11} stroke="white" strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {assignedUserIds.length > 0 && (
              <div style={{ marginTop:10,fontSize:12,color:"var(--text2)" }}>
                {assignedUserIds.length} user{assignedUserIds.length!==1?"s":""} assigned to this jobsite
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

          {/* Project Timeline */}
          <div className="form-section" style={{ marginBottom:0 }}>
            <div className="form-section-title"><Icon d={ic.activity} size={15} stroke="var(--accent)" /> Project Timeline</div>
            {/* Stage track */}
            <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch", scrollbarWidth:"none", marginBottom:16 }}>
            <div style={{ position:"relative", minWidth:480 }}>
              {/* Connector line */}
              <div style={{ position:"absolute", top:18, left:18, right:18, height:2, background:"var(--border)", zIndex:0 }} />
              {/* Active fill */}
              {(() => {
                const idx = TIMELINE_STAGES.findIndex(s => s.id === form.timelineStage);
                const pct = idx < 0 ? 0 : (idx / (TIMELINE_STAGES.length - 1)) * 100;
                return <div style={{ position:"absolute", top:18, left:18, height:2, width:`calc(${pct}% * (1 - 36/${TIMELINE_STAGES.length * 52}))`, background:"var(--accent)", zIndex:1, transition:"width .3s" }} />;
              })()}
              <div style={{ display:"flex", justifyContent:"space-between", position:"relative", zIndex:2 }}>
                {TIMELINE_STAGES.map((stage, i) => {
                  const activeIdx = TIMELINE_STAGES.findIndex(s => s.id === form.timelineStage);
                  const isDone    = activeIdx >= 0 && i < activeIdx;
                  const isActive  = form.timelineStage === stage.id;
                  return (
                    <div key={stage.id} onClick={() => set("timelineStage", form.timelineStage === stage.id ? "" : stage.id)}
                      style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, cursor:"pointer", flex:1 }}>
                      <div style={{
                        width:36, height:36, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:15, border:`2px solid ${isActive ? "var(--accent)" : isDone ? "var(--accent)" : "var(--border)"}`,
                        background: isActive ? "var(--accent)" : isDone ? "var(--accent-glow)" : "var(--surface)",
                        transition:"all .2s", boxShadow: isActive ? "0 0 0 4px var(--accent-glow)" : "none",
                      }}>
                        {isDone ? <Icon d={ic.check} size={14} stroke={isActive ? "white" : "var(--accent)"} /> : stage.icon}
                      </div>
                      <span style={{ fontSize:10, fontWeight: isActive ? 700 : 500, color: isActive ? "var(--accent)" : isDone ? "var(--text2)" : "var(--text3)", textAlign:"center", lineHeight:1.2, whiteSpace:"nowrap" }}>
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
            {/* Stage note */}
            {form.timelineStage && (
              <input className="form-input" style={{ fontSize:12.5 }}
                placeholder={`Add a note for "${TIMELINE_STAGES.find(s=>s.id===form.timelineStage)?.label}"…`}
                value={form.timelineNotes?.[form.timelineStage] || ""}
                onChange={e => set("timelineNotes", { ...form.timelineNotes, [form.timelineStage]: e.target.value })}
              />
            )}
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
function ProjectsList({ projects, teamUsers = [], settings = {}, onSelect, onNew, onEdit, onDelete }) {
  const [showDeleteId, setShowDeleteId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [myOnly, setMyOnly] = useState(false);

  // Current user is __admin__ (the logged-in account holder)
  const currentUserId = "__admin__";

  const filtered = projects
    .filter(p => !myOnly || (p.assignedUserIds||[]).includes(currentUserId))
    .filter(p => filterStatus === "all" || p.status === filterStatus)
    .filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.address.toLowerCase().includes(search.toLowerCase()) || p.clientName.toLowerCase().includes(search.toLowerCase()))
    .slice()
    .sort((a, b) => {
      const sort = settings.projectSort || "recent";
      if (sort === "alpha")  return a.title.localeCompare(b.title);
      if (sort === "oldest") return new Date(a.createdAt||0) - new Date(b.createdAt||0);
      if (sort === "newest") return new Date(b.createdAt||0) - new Date(a.createdAt||0);
      // "recent" — by updatedAt falling back to createdAt
      return new Date(b.updatedAt||b.createdAt||0) - new Date(a.updatedAt||a.createdAt||0);
    });

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
      <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:20 }}>
        <input className="form-input" style={{ width:"100%",padding:"8px 14px",boxSizing:"border-box" }} placeholder="Search jobsites, addresses, clients…" value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
          <div style={{ display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none",width:"100%",paddingBottom:2 }}>
            {[["all","All"],["active","Active"],["onhold","On Hold"],["completed","Completed"],["archived","Archived"]].map(([k,l]) => (
              <button key={k} className={`btn btn-sm ${filterStatus===k?"btn-primary":"btn-secondary"}`} style={{ flexShrink:0 }} onClick={() => setFilterStatus(k)}>{l}</button>
            ))}
          </div>
          <button
            onClick={() => setMyOnly(v => !v)}
            style={{ display:"flex",alignItems:"center",gap:7,padding:"6px 13px",borderRadius:"var(--radius-sm)",border:`1.5px solid ${myOnly?"var(--accent)":"var(--border)"}`,background:myOnly?"var(--accent-glow)":"var(--surface2)",cursor:"pointer",fontSize:12.5,fontWeight:600,color:myOnly?"var(--accent)":"var(--text2)",transition:"all .15s",flexShrink:0 }}>
            <div style={{ width:16,height:16,borderRadius:4,border:`2px solid ${myOnly?"var(--accent)":"var(--border)"}`,background:myOnly?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",flexShrink:0 }}>
              {myOnly && <Icon d={ic.check} size={10} stroke="white" strokeWidth={3} />}
            </div>
            My Jobsites
          </button>
          <button className="btn btn-primary" style={{ marginLeft:"auto" }} onClick={onNew}><Icon d={ic.plus} size={16} /> New Jobsite</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><Icon d={ic.briefcase} size={28} stroke="var(--text3)" /></div>
          <h3>{search ? "No results found" : myOnly ? "No assigned jobsites" : "No jobsites yet"}</h3>
          <p>{search ? "Try a different search term." : myOnly ? "You haven't been assigned to any jobsites yet." : "Create your first jobsite to start capturing photos and building reports."}</p>
          {!search && !myOnly && <button className="btn btn-primary" onClick={onNew}><Icon d={ic.plus} size={15} /> Create First Jobsite</button>}
        </div>
      ) : (
        <div className="grid-3">
          {filtered.map(project => {
            const sm = STATUS_META[project.status] || STATUS_META.active;
            return (
              <div key={project.id} className="project-card" onClick={() => onSelect(project)}>
                <div className="project-card-bar" style={{ background: project.color }} />
                <div className="project-card-body">
                  {/* Top row: status + edit/delete */}
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                    <span className={`tag tag-${sm.cls}`}>{sm.label}</span>
                    <div style={{ display:"flex",gap:6 }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-sm btn-ghost btn-icon" title="Edit" onClick={() => onEdit(project)}><Icon d={ic.edit} size={14} /></button>
                      <button className="btn btn-sm btn-ghost btn-icon" title="Delete" onClick={() => setShowDeleteId(project.id)}><Icon d={ic.trash} size={14} /></button>
                    </div>
                  </div>
                  {/* Title + address always below */}
                  <div className="project-card-title" style={{ marginBottom:4,whiteSpace:"normal" }}>{project.title}</div>
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
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    {(project.assignedUserIds||[]).length > 0 && (() => {
                      const assigned = (project.assignedUserIds||[])
                        .map(id => teamUsers.find(u => u.id === id))
                        .filter(Boolean);
                      const show = assigned.slice(0,3);
                      const extra = assigned.length - show.length;
                      return (
                        <div style={{ display:"flex",alignItems:"center" }} onClick={e=>e.stopPropagation()}>
                          {show.map((u,i) => {
                            const m = ROLE_META[u.role]||ROLE_META.user;
                            return (
                              <div key={u.id} title={`${u.firstName} ${u.lastName}`}
                                style={{ width:22,height:22,borderRadius:"50%",background:m.color,border:"2px solid var(--surface)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"white",marginLeft:i>0?-6:0,zIndex:show.length-i,position:"relative" }}>
                                {`${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase()}
                              </div>
                            );
                          })}
                          {extra > 0 && <div style={{ width:22,height:22,borderRadius:"50%",background:"var(--surface3)",border:"2px solid var(--surface)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"var(--text2)",marginLeft:-6 }}>+{extra}</div>}
                        </div>
                      );
                    })()}
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

// ── Checklist System ──────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { id:"checkbox",       label:"Single Checkbox",    icon:"☑" },
  { id:"multi_checkbox", label:"Multi Checkbox",     icon:"☑☑" },
  { id:"dropdown",       label:"Dropdown",           icon:"▾" },
  { id:"text",           label:"Text Answer",        icon:"✏" },
  { id:"yesno",          label:"Yes / No",           icon:"Y/N" },
  { id:"number",         label:"Number",             icon:"#" },
];

// Default checklist templates available to all projects
const DEFAULT_CL_TEMPLATES = [
  {
    id:"tmpl_general", name:"General Site Inspection", desc:"Standard walkthrough for any jobsite visit",
    fields:[
      { id:"f1", type:"checkbox",       label:"Site access confirmed",          required:true },
      { id:"f2", type:"yesno",          label:"PPE in use by all personnel",    required:true },
      { id:"f3", type:"multi_checkbox", label:"Hazards observed",               options:["Trip hazard","Water intrusion","Electrical exposed","Structural concern","Mold visible","None"], required:false },
      { id:"f4", type:"dropdown",       label:"Overall site condition",         options:["Good","Fair","Poor","Unsafe"], required:true },
      { id:"f5", type:"text",           label:"Summary notes",                  required:false },
    ],
  },
  {
    id:"tmpl_water", name:"Water Damage Assessment", desc:"Document extent of water damage",
    fields:[
      { id:"f1", type:"dropdown",       label:"Water source identified",        options:["Pipe burst","Roof leak","Appliance failure","Flood","Sewage backup","Unknown"], required:true },
      { id:"f2", type:"yesno",          label:"Source mitigated / stopped",     required:true },
      { id:"f3", type:"multi_checkbox", label:"Affected materials",             options:["Drywall","Flooring","Insulation","Subfloor","Framing","Ceiling","Cabinets","Contents"], required:false },
      { id:"f4", type:"number",         label:"Estimated affected area (sq ft)", required:false },
      { id:"f5", type:"dropdown",       label:"Moisture readings",              options:["Dry (0-15%)","Slightly wet (16-25%)","Wet (26-40%)","Saturated (>40%)"], required:false },
      { id:"f6", type:"text",           label:"Equipment deployed",             required:false },
      { id:"f7", type:"text",           label:"Additional notes",               required:false },
    ],
  },
  {
    id:"tmpl_ppe", name:"PPE & Safety Compliance", desc:"Verify safety compliance on site",
    fields:[
      { id:"f1", type:"multi_checkbox", label:"PPE confirmed in use",           options:["Hard Hat","Safety Glasses","Work Boots","Respirator","Tyvek Suit","Gloves","High Viz"], required:true },
      { id:"f2", type:"yesno",          label:"Safety signage posted",          required:true },
      { id:"f3", type:"yesno",          label:"First aid kit accessible",       required:true },
      { id:"f4", type:"dropdown",       label:"Site safety rating",             options:["Compliant","Minor issues","Non-compliant","Stopped work"], required:true },
      { id:"f5", type:"text",           label:"Inspector notes",                required:false },
    ],
  },
];

function ChecklistsTab({ project, onUpdateProject }) {
  const [view,          setView]          = useState("list");   // list | run | build
  const [activeChecklist, setActive]      = useState(null);     // checklist being run/built
  const [showTmplPicker, setShowTmplPicker] = useState(false);
  const [templates,     setTemplates]     = useState(DEFAULT_CL_TEMPLATES);
  const [editingTmpl,   setEditingTmpl]   = useState(null);

  const checklists = project.checklists || [];

  const saveChecklist = (cl) => {
    const existing = checklists.find(c => c.id === cl.id);
    const updated  = existing
      ? checklists.map(c => c.id === cl.id ? cl : c)
      : [...checklists, cl];
    onUpdateProject({ ...project, checklists: updated });
  };

  const deleteChecklist = (id) => onUpdateProject({ ...project, checklists: checklists.filter(c => c.id !== id) });

  const startFromTemplate = (tmpl) => {
    const cl = {
      id: uid(), name: tmpl.name, templateId: tmpl.id,
      createdAt: today(), completedAt: null, assignee: "",
      status: "in_progress",
      fields: tmpl.fields.map(f => ({ ...f, value: f.type==="multi_checkbox" ? [] : "" })),
    };
    setActive(cl); setShowTmplPicker(false); setView("run");
  };

  const startBlank = () => {
    const cl = { id:uid(), name:"New Checklist", createdAt:today(), completedAt:null, assignee:"", status:"in_progress", fields:[] };
    setActive(cl); setView("build");
  };

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (view === "list") return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontSize:13, color:"var(--text2)" }}>{checklists.length} checklist{checklists.length!==1?"s":""}</div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-sm btn-secondary desktop-only" onClick={() => setEditingTmpl("new")}><Icon d={ic.edit} size={13} /> Manage Templates</button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowTmplPicker(true)}><Icon d={ic.plus} size={13} /> New Checklist</button>
        </div>
      </div>

      {checklists.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><Icon d={ic.check} size={28} stroke="var(--text3)" /></div>
          <h3>No checklists yet</h3>
          <p>Start a checklist from a template or build a custom one for this site visit.</p>
          <button className="btn btn-primary" onClick={() => setShowTmplPicker(true)}><Icon d={ic.plus} size={15} /> Start Checklist</button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {checklists.map(cl => {
            const total   = cl.fields?.length || 0;
            const done    = cl.fields?.filter(f => {
              if (f.type==="multi_checkbox") return f.value?.length > 0;
              if (f.type==="checkbox") return f.value === true || f.value === "true";
              return f.value !== "" && f.value !== null && f.value !== undefined;
            }).length || 0;
            const pct = total > 0 ? Math.round((done/total)*100) : 0;
            return (
              <div key={cl.id} className="card" style={{ padding:0, overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px" }}>
                  <div style={{ width:44, height:44, borderRadius:10, background:`conic-gradient(var(--accent) ${pct*3.6}deg, var(--surface2) 0)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <div style={{ width:34, height:34, borderRadius:8, background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"var(--accent)" }}>{pct}%</div>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>{cl.name}</div>
                    <div style={{ fontSize:12, color:"var(--text2)" }}>
                      {done}/{total} items · {cl.createdAt}
                      {cl.assignee && <span style={{ marginLeft:8, color:"var(--text3)" }}>· {cl.assignee}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20,
                    background: cl.status==="complete" ? "rgba(61,186,126,.15)" : "rgba(232,108,58,.1)",
                    color: cl.status==="complete" ? "#3dba7e" : "var(--accent)" }}>
                    {cl.status==="complete" ? "✓ Complete" : "In Progress"}
                  </span>
                  <div style={{ display:"flex", gap:6 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => { setActive(cl); setView("run"); }}><Icon d={ic.edit} size={12} /> Open</button>
                    <button className="btn btn-sm btn-danger btn-icon" onClick={() => deleteChecklist(cl.id)}><Icon d={ic.trash} size={12} /></button>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ height:3, background:"var(--surface2)" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background: pct===100 ? "#3dba7e" : "var(--accent)", transition:"width .3s" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Template picker modal */}
      {showTmplPicker && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowTmplPicker(false)}>
          <div className="modal fade-in" style={{ maxWidth:520 }}>
            <div className="modal-header">
              <div className="modal-title">Start a Checklist</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowTmplPicker(false)}><Icon d={ic.close} size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {templates.map(t => (
                  <div key={t.id} onClick={() => startFromTemplate(t)}
                    style={{ padding:"12px 14px", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", cursor:"pointer", display:"flex", alignItems:"center", gap:12, background:"var(--surface2)", transition:"border-color .15s" }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="var(--accent)"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                    <div style={{ width:36, height:36, borderRadius:8, background:"var(--accent-glow)", border:"1px solid var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>📋</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:13.5 }}>{t.name}</div>
                      <div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>{t.desc} · {t.fields.length} fields</div>
                    </div>
                    <Icon d={ic.chevRight} size={14} stroke="var(--text3)" />
                  </div>
                ))}
                <div onClick={startBlank}
                  style={{ padding:"12px 14px", border:"2px dashed var(--border)", borderRadius:"var(--radius-sm)", cursor:"pointer", display:"flex", alignItems:"center", gap:12, transition:"border-color .15s" }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="var(--accent)"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                  <div style={{ width:36, height:36, borderRadius:8, background:"var(--surface2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>➕</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13.5 }}>Build Custom Checklist</div>
                    <div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>Start from scratch with any field types</div>
                  </div>
                  <Icon d={ic.chevRight} size={14} stroke="var(--text3)" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template manager modal */}
      {editingTmpl && (
        <TemplateManagerModal templates={templates} setTemplates={setTemplates} onClose={() => setEditingTmpl(null)} />
      )}
    </div>
  );

  // ── RUN VIEW (fill out checklist) ─────────────────────────────────────────
  if (view === "run") return (
    <ChecklistRunner
      checklist={activeChecklist}
      onSave={cl => { saveChecklist(cl); setView("list"); }}
      onBack={() => setView("list")}
    />
  );

  // ── BUILD VIEW (design checklist) ────────────────────────────────────────
  if (view === "build") return (
    <ChecklistBuilder
      checklist={activeChecklist}
      onSave={cl => { saveChecklist(cl); setView("list"); }}
      onBack={() => setView("list")}
    />
  );
}

// ── Checklist Runner ──────────────────────────────────────────────────────────
function ChecklistRunner({ checklist, onSave, onBack }) {
  const [cl, setCl] = useState({ ...checklist, fields: checklist.fields.map(f => ({ ...f })) });

  const updateField = (id, value) => setCl(prev => ({ ...prev, fields: prev.fields.map(f => f.id===id ? { ...f, value } : f) }));
  const toggleMulti = (id, opt) => {
    const f = cl.fields.find(f => f.id===id);
    const cur = f.value || [];
    updateField(id, cur.includes(opt) ? cur.filter(x=>x!==opt) : [...cur, opt]);
  };

  const complete = cl.fields.filter(f => {
    if (f.type==="multi_checkbox") return f.value?.length > 0;
    if (f.type==="checkbox") return f.value === true;
    return f.value !== "" && f.value !== null && f.value !== undefined;
  }).length;
  const total  = cl.fields.length;
  const pct    = total > 0 ? Math.round((complete/total)*100) : 0;
  const allReqDone = cl.fields.filter(f=>f.required).every(f => {
    if (f.type==="multi_checkbox") return f.value?.length > 0;
    if (f.type==="checkbox") return f.value === true;
    return f.value !== "" && f.value !== null;
  });

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon d={ic.arrowLeft} size={14} /> Back</button>
        <div style={{ flex:1, minWidth:150 }}>
          <div style={{ fontWeight:700, fontSize:16 }}>{cl.name}</div>
          <div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>{complete}/{total} completed · {pct}%</div>
        </div>
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button className="btn btn-sm btn-secondary" onClick={() => onSave({ ...cl, status:"in_progress" })}>Save Draft</button>
          <button className="btn btn-sm btn-primary" disabled={!allReqDone}
            onClick={() => onSave({ ...cl, status:"complete", completedAt:today() })}>
            <Icon d={ic.check} size={13} /> Mark Complete
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height:6, background:"var(--surface2)", borderRadius:3, marginBottom:24, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background: pct===100?"#3dba7e":"var(--accent)", transition:"width .3s", borderRadius:3 }} />
      </div>

      {/* Assignee */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-body" style={{ padding:"12px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <label style={{ fontSize:12, fontWeight:600, color:"var(--text2)", textTransform:"uppercase", letterSpacing:".04em", whiteSpace:"nowrap" }}>Assigned To</label>
            <input className="form-input" style={{ flex:1 }} placeholder="Inspector name…" value={cl.assignee} onChange={e => setCl(p=>({...p, assignee:e.target.value}))} />
          </div>
        </div>
      </div>

      {/* Fields */}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {cl.fields.map((field, i) => {
          const answered = field.type==="multi_checkbox" ? field.value?.length>0 : field.type==="checkbox" ? field.value===true : (field.value!==""&&field.value!=null);
          return (
            <div key={field.id} className="card" style={{ borderLeft:`3px solid ${answered?"var(--accent)":"var(--border)"}`, overflow:"hidden" }}>
              <div className="card-body" style={{ padding:"14px 16px", overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom: field.type==="checkbox"||field.type==="yesno" ? 0 : 10 }}>
                  <div style={{ width:22, height:22, borderRadius:6, background:"var(--surface2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"var(--text3)", flexShrink:0, marginTop:1 }}>{i+1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13.5, fontWeight:600, lineHeight:1.3 }}>
                      {field.label}
                      {field.required && <span style={{ color:"var(--accent)", marginLeft:4 }}>*</span>}
                    </div>
                  </div>
                  {answered && <Icon d={ic.check} size={14} stroke="#3dba7e" />}
                </div>

                {/* Single checkbox */}
                {field.type==="checkbox" && (
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:32, marginTop:6 }}>
                    <input type="checkbox" checked={!!field.value} onChange={e=>updateField(field.id, e.target.checked)} style={{ width:18,height:18,accentColor:"var(--accent)",cursor:"pointer" }} />
                    <span style={{ fontSize:13, color:"var(--text2)" }}>Confirmed</span>
                  </div>
                )}

                {/* Yes / No */}
                {field.type==="yesno" && (
                  <div style={{ display:"flex", gap:8, marginLeft:32, marginTop:6 }}>
                    {["Yes","No","N/A"].map(opt => (
                      <div key={opt} onClick={()=>updateField(field.id, opt)}
                        style={{ padding:"6px 20px", borderRadius:"var(--radius-sm)", border:`2px solid ${field.value===opt?"var(--accent)":"var(--border)"}`, background:field.value===opt?"var(--accent-glow)":"var(--surface2)", cursor:"pointer", fontSize:13, fontWeight:600, color:field.value===opt?"var(--accent)":"var(--text2)", transition:"all .15s" }}>
                        {opt}
                      </div>
                    ))}
                  </div>
                )}

                {/* Multi checkbox */}
                {field.type==="multi_checkbox" && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginLeft:32, marginTop:6 }}>
                    {(field.options||[]).map(opt => {
                      const sel = (field.value||[]).includes(opt);
                      return (
                        <div key={opt} onClick={()=>toggleMulti(field.id, opt)}
                          style={{ padding:"5px 13px", borderRadius:20, border:`1.5px solid ${sel?"var(--accent)":"var(--border)"}`, background:sel?"var(--accent-glow)":"var(--surface2)", cursor:"pointer", fontSize:12.5, fontWeight:600, color:sel?"var(--accent)":"var(--text2)", transition:"all .15s", userSelect:"none" }}>
                          {sel?"✓ ":""}{opt}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Dropdown */}
                {field.type==="dropdown" && (
                  <select className="form-input form-select" style={{ marginLeft:32, marginTop:6, width:"calc(100% - 32px)", minWidth:0 }} value={field.value||""} onChange={e=>updateField(field.id, e.target.value)}>
                    <option value="">— Select —</option>
                    {(field.options||[]).map(o=><option key={o}>{o}</option>)}
                  </select>
                )}

                {/* Text */}
                {field.type==="text" && (
                  <textarea className="form-input form-textarea" style={{ marginLeft:32, marginTop:6, minHeight:72, fontSize:13, resize:"vertical", width:"calc(100% - 32px)", boxSizing:"border-box" }} placeholder="Enter your answer…" value={field.value||""} onChange={e=>updateField(field.id, e.target.value)} />
                )}

                {/* Number */}
                {field.type==="number" && (
                  <input type="number" className="form-input" style={{ marginLeft:32, marginTop:6, width:"calc(100% - 32px)", boxSizing:"border-box" }} placeholder="0" value={field.value||""} onChange={e=>updateField(field.id, e.target.value)} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {cl.fields.length === 0 && (
        <div className="empty"><div className="empty-icon"><Icon d={ic.check} size={28} stroke="var(--text3)" /></div><h3>No fields</h3><p>This checklist has no fields yet. Edit it to add some.</p></div>
      )}
    </div>
  );
}

// ── Checklist Builder ────────────────────────────────────────────────────────
function ChecklistBuilder({ checklist, onSave, onBack }) {
  const [cl, setCl] = useState({ ...checklist });
  const [addingField, setAddingField] = useState(false);
  const [newField, setNewField] = useState({ type:"checkbox", label:"", options:"", required:false });
  const [editingField, setEditingField] = useState(null);

  const addField = () => {
    if (!newField.label.trim()) return;
    const f = {
      id: uid(), type:newField.type, label:newField.label.trim(), required:newField.required,
      options: ["multi_checkbox","dropdown"].includes(newField.type)
        ? newField.options.split("\n").map(s=>s.trim()).filter(Boolean)
        : undefined,
      value: newField.type==="multi_checkbox" ? [] : "",
    };
    setCl(p=>({...p, fields:[...p.fields, f]}));
    setNewField({ type:"checkbox", label:"", options:"", required:false });
    setAddingField(false);
  };

  const removeField = id => setCl(p=>({...p, fields:p.fields.filter(f=>f.id!==id)}));
  const moveField   = (id, dir) => {
    const idx = cl.fields.findIndex(f=>f.id===id); if (idx<0) return;
    const arr = [...cl.fields];
    const swap = idx+dir;
    if (swap<0||swap>=arr.length) return;
    [arr[idx],arr[swap]]=[arr[swap],arr[idx]];
    setCl(p=>({...p,fields:arr}));
  };

  const needsOptions = ["multi_checkbox","dropdown"].includes(newField.type);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon d={ic.arrowLeft} size={14} /> Back</button>
        <input className="form-input" style={{ flex:1, fontWeight:700, fontSize:15 }} value={cl.name} onChange={e=>setCl(p=>({...p,name:e.target.value}))} placeholder="Checklist name…" />
        <button className="btn btn-sm btn-primary" disabled={!cl.name.trim()||cl.fields.length===0}
          onClick={()=>onSave(cl)}><Icon d={ic.check} size={13} /> Save Checklist</button>
      </div>

      {/* Fields list */}
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
        {cl.fields.map((f, i) => (
          <div key={f.id} className="card" style={{ padding:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px" }}>
              <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                <button onClick={()=>moveField(f.id,-1)} disabled={i===0} style={{ background:"none",border:"none",cursor:i===0?"default":"pointer",color:i===0?"var(--border)":"var(--text3)",lineHeight:1,padding:0,fontSize:11 }}>▲</button>
                <button onClick={()=>moveField(f.id,1)} disabled={i===cl.fields.length-1} style={{ background:"none",border:"none",cursor:i===cl.fields.length-1?"default":"pointer",color:i===cl.fields.length-1?"var(--border)":"var(--text3)",lineHeight:1,padding:0,fontSize:11 }}>▼</button>
              </div>
              <div style={{ width:28, height:28, borderRadius:6, background:"var(--surface2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0 }}>
                {FIELD_TYPES.find(t=>t.id===f.type)?.icon || "?"}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{f.label}{f.required && <span style={{ color:"var(--accent)",marginLeft:4 }}>*</span>}</div>
                <div style={{ fontSize:11.5, color:"var(--text3)", marginTop:1 }}>
                  {FIELD_TYPES.find(t=>t.id===f.type)?.label}
                  {f.options?.length > 0 && ` · ${f.options.length} options`}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>removeField(f.id)}><Icon d={ic.trash} size={13} stroke="#ff6b6b" /></button>
            </div>
          </div>
        ))}
        {cl.fields.length===0 && <div style={{ textAlign:"center",padding:"24px 0",color:"var(--text3)",fontSize:13 }}>No fields yet — add one below</div>}
      </div>

      {/* Add field panel */}
      {!addingField ? (
        <button className="btn btn-secondary" style={{ width:"100%", justifyContent:"center", borderStyle:"dashed" }} onClick={()=>setAddingField(true)}>
          <Icon d={ic.plus} size={14} /> Add Field
        </button>
      ) : (
        <div className="card" style={{ border:"1.5px solid var(--accent)" }}>
          <div className="card-body" style={{ padding:"16px" }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:"var(--accent)" }}>New Field</div>
            <div className="form-group">
              <label className="form-label">Field Type</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {FIELD_TYPES.map(ft => (
                  <div key={ft.id} onClick={()=>setNewField(p=>({...p,type:ft.id}))}
                    style={{ padding:"6px 12px", borderRadius:"var(--radius-sm)", border:`1.5px solid ${newField.type===ft.id?"var(--accent)":"var(--border)"}`, background:newField.type===ft.id?"var(--accent-glow)":"var(--surface2)", cursor:"pointer", fontSize:12.5, fontWeight:600, color:newField.type===ft.id?"var(--accent)":"var(--text2)", display:"flex", gap:5, alignItems:"center", transition:"all .15s" }}>
                    <span style={{ fontSize:13 }}>{ft.icon}</span>{ft.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Field Label</label>
              <input className="form-input" placeholder="e.g. Was PPE worn by all personnel?" value={newField.label} onChange={e=>setNewField(p=>({...p,label:e.target.value}))} />
            </div>
            {needsOptions && (
              <div className="form-group">
                <label className="form-label">Options <span style={{ fontWeight:400, color:"var(--text3)" }}>(one per line)</span></label>
                <textarea className="form-input form-textarea" style={{ minHeight:90, fontSize:13 }} placeholder={"Option 1\nOption 2\nOption 3"} value={newField.options} onChange={e=>setNewField(p=>({...p,options:e.target.value}))} />
              </div>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <input type="checkbox" id="req_cb" checked={newField.required} onChange={e=>setNewField(p=>({...p,required:e.target.checked}))} style={{ accentColor:"var(--accent)" }} />
              <label htmlFor="req_cb" style={{ fontSize:13, cursor:"pointer" }}>Required field</label>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-secondary btn-sm" onClick={()=>setAddingField(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={addField} disabled={!newField.label.trim()}><Icon d={ic.plus} size={12} /> Add Field</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Template Manager Modal ────────────────────────────────────────────────────
function TemplateManagerModal({ templates, setTemplates, onClose }) {
  const [editing, setEditing] = useState(null); // null = list, object = editing a template
  const [newTmplName, setNewTmplName] = useState("");

  const startNew = () => {
    setEditing({ id:`tmpl_${uid()}`, name:"", desc:"", fields:[] });
  };
  const saveTmpl = (t) => {
    setTemplates(prev => prev.find(x=>x.id===t.id) ? prev.map(x=>x.id===t.id?t:x) : [...prev,t]);
    setEditing(null);
  };
  const deleteTmpl = (id) => setTemplates(prev => prev.filter(t=>t.id!==id));

  if (editing) return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setEditing(null)}>
      <div className="modal fade-in modal-lg" style={{ maxWidth:600 }}>
        <div className="modal-header">
          <div className="modal-title">{editing.name||"New Template"}</div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>setEditing(null)}><Icon d={ic.close} size={16} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight:"60vh", overflowY:"auto" }}>
          <div className="form-group"><label className="form-label">Template Name</label><input className="form-input" value={editing.name} onChange={e=>setEditing(p=>({...p,name:e.target.value}))} placeholder="e.g. Fire Damage Walkthrough" /></div>
          <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={editing.desc||""} onChange={e=>setEditing(p=>({...p,desc:e.target.value}))} placeholder="Short description…" /></div>
          <ChecklistBuilder checklist={editing} onSave={saveTmpl} onBack={()=>setEditing(null)} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal fade-in" style={{ maxWidth:500 }}>
        <div className="modal-header">
          <div className="modal-title">Checklist Templates</div>
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {templates.map(t => (
              <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", background:"var(--surface2)" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13 }}>{t.name}</div>
                  <div style={{ fontSize:11.5, color:"var(--text3)", marginTop:2 }}>{t.fields.length} fields · {t.desc}</div>
                </div>
                <button className="btn btn-sm btn-secondary" onClick={()=>setEditing({...t})}><Icon d={ic.edit} size={12} /> Edit</button>
                {!t.id.startsWith("tmpl_general")&&!t.id.startsWith("tmpl_water")&&!t.id.startsWith("tmpl_ppe") && (
                  <button className="btn btn-sm btn-danger btn-icon" onClick={()=>deleteTmpl(t.id)}><Icon d={ic.trash} size={12} /></button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={startNew}><Icon d={ic.plus} size={13} /> New Template</button>
        </div>
      </div>
    </div>
  );
}

// ── Reports Tab (with multi-select + email send) ──────────────────────────────
function ReportsTab({ project, onUpdateProject, onOpenReportCreator, settings }) {
  const [selected,    setSelected]    = useState(new Set());
  const [showEmail,   setShowEmail]   = useState(false);

  const reports = project.reports || [];
  const toggleSelect = (id) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const toggleAll = () => setSelected(selected.size === reports.length ? new Set() : new Set(reports.map(r=>r.id)));

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,gap:10 }}>
        <div style={{ fontSize:13,color:"var(--text2)" }}>{reports.length} report{reports.length!==1?"s":""}{selected.size>0&&<span style={{ marginLeft:8,color:"var(--accent)",fontWeight:600 }}>· {selected.size} selected</span>}</div>
        <div style={{ display:"flex",gap:8 }}>
          {selected.size > 0 && (
            <button className="btn btn-sm btn-secondary" onClick={() => setShowEmail(true)}>
              <Icon d={ic.mail} size={13} /> Send {selected.size} Report{selected.size>1?"s":""} via Email
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => onOpenReportCreator(project, null)}>
            <Icon d={ic.plus} size={13} /> New Report
          </button>
        </div>
      </div>

      {reports.length === 0 ? (
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
          {/* Select all row */}
          <div style={{ display:"flex",alignItems:"center",gap:10,padding:"6px 2px",borderBottom:"1px solid var(--border)",marginBottom:4 }}>
            <input type="checkbox" checked={selected.size===reports.length&&reports.length>0} onChange={toggleAll} style={{ accentColor:"var(--accent)",width:15,height:15,cursor:"pointer" }} />
            <span style={{ fontSize:12,color:"var(--text3)" }}>Select all</span>
            {selected.size > 0 && (
              <button className="btn btn-sm btn-secondary" style={{ marginLeft:"auto" }} onClick={() => setShowEmail(true)}>
                <Icon d={ic.mail} size={12} /> Send Selected via Email
              </button>
            )}
          </div>

          {reports.map(r => (
            <div key={r.id} className="report-row" style={{ borderLeft:`3px solid ${selected.has(r.id)?"var(--accent)":"transparent"}`, transition:"border-color .15s" }}>
              <input type="checkbox" checked={selected.has(r.id)} onChange={()=>toggleSelect(r.id)}
                style={{ accentColor:"var(--accent)",width:15,height:15,cursor:"pointer",flexShrink:0 }} />
              <div className="report-row-icon" style={{ background:(r.color||"#4a90d9")+"20" }}>
                <Icon d={ic.reports} size={16} stroke={r.color||"#4a90d9"} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600,fontSize:13.5,marginBottom:2 }}>{r.title}</div>
                <div style={{ fontSize:12,color:"var(--text2)" }}>
                  {r.reportType||r.type} · {r.date} · {r.photos||0} photo{r.photos!==1?"s":""}
                  {r.lastSentTo && <span style={{ marginLeft:8,color:"var(--text3)" }}>· Last sent to {r.lastSentTo}</span>}
                </div>
              </div>
              <span className={`tag tag-${r.status==="sent"?"green":r.status==="final"?"blue":r.status==="review"?"purple":"orange"}`}>{r.status}</span>
              <div className="report-row-actions">
                <button className="btn btn-sm btn-secondary" title="Send via email" onClick={()=>{ setSelected(new Set([r.id])); setShowEmail(true); }}>
                  <Icon d={ic.mail} size={12} />
                </button>
                <button className="btn btn-sm btn-secondary" onClick={() => onOpenReportCreator(project, r)}>
                  <Icon d={ic.edit} size={12} /> Open
                </button>
                <button className="btn btn-sm btn-danger btn-icon" onClick={() => onUpdateProject({ ...project, reports: project.reports.filter(x => x.id !== r.id) })}>
                  <Icon d={ic.trash} size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showEmail && (
        <SendEmailModal
          project={project}
          reports={reports.filter(r => selected.has(r.id))}
          settings={settings}
          onClose={() => setShowEmail(false)}
          onSent={(reportIds, sentTo) => {
            const updated = { ...project, reports: project.reports.map(r =>
              reportIds.includes(r.id) ? { ...r, status:"sent", lastSentTo: sentTo } : r
            )};
            onUpdateProject(updated);
            setSelected(new Set());
            setShowEmail(false);
          }}
        />
      )}
    </div>
  );
}

// ── Send Email Modal ───────────────────────────────────────────────────────────
function SendEmailModal({ project, reports, settings, onClose, onSent }) {
  const interpolate = (str, recipient) => (str||"")
    .replace(/{{company}}/g,     settings?.companyName||"")
    .replace(/{{project}}/g,     project.title||"")
    .replace(/{{address}}/g,     [project.address,project.city,project.state].filter(Boolean).join(", ")||"")
    .replace(/{{recipient}}/g,   recipient||"")
    .replace(/{{date}}/g,        formatDate(new Date().toISOString().slice(0,10), settings))
    .replace(/{{inspector}}/g,   `${settings?.userFirstName||""} ${settings?.userLastName||""}`.trim())
    .replace(/{{reports_list}}/g, reports.map(r=>`  • ${r.title} (${r.reportType||r.type})`).join("\n"));

  const QUICK_RECIPIENTS = [
    project.clientName    && project.clientEmail    ? { label:`Client — ${project.clientName}`,    email:project.clientEmail,    name:project.clientName }    : null,
    project.adjusterName  && project.adjusterEmail  ? { label:`Adjuster — ${project.adjusterName}`,email:project.adjusterEmail,  name:project.adjusterName }  : null,
    project.insuranceCarrier                         ? { label:`Carrier — ${project.insuranceCarrier}`, email:"",                name:project.insuranceCarrier } : null,
  ].filter(Boolean);

  const [toList,    setToList]    = useState(QUICK_RECIPIENTS.length>0 ? [QUICK_RECIPIENTS[0]] : [{ label:"Custom", email:"", name:"" }]);
  const [customEmail, setCustomEmail] = useState("");
  const [customName,  setCustomName]  = useState("");
  const [subject,   setSubject]   = useState(() => interpolate(settings?.emailSubject || "Report from {{company}} — {{project}}", QUICK_RECIPIENTS[0]?.name||""));
  const [body,      setBody]      = useState(() => interpolate(settings?.emailBody || "Hello {{recipient}},\n\nPlease find attached the reports for {{project}}.\n\n{{reports_list}}\n\nBest regards,", QUICK_RECIPIENTS[0]?.name||""));
  const [activeTab, setActiveTab] = useState("compose"); // compose | preview

  const sig = settings ? buildSignature(settings) : "";

  const addQuick = (r) => { if (!toList.find(t=>t.email===r.email)) setToList(p=>[...p,r]); };
  const addCustom = () => {
    if (!customEmail.trim()) return;
    setToList(p=>[...p,{ label:customName||customEmail, email:customEmail.trim(), name:customName||customEmail }]);
    setCustomEmail(""); setCustomName("");
  };
  const removeRecipient = (email) => setToList(p=>p.filter(r=>r.email!==email));

  const handleSend = () => {
    const allEmails = toList.map(r=>r.email).filter(Boolean);
    if (allEmails.length===0) { alert("Add at least one recipient email address."); return; }
    const fullBody = `${body}\n\n${sig}`;
    const mailto = `mailto:${allEmails.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;
    window.open(mailto, "_blank");
    onSent(reports.map(r=>r.id), toList.map(r=>r.name||r.email).join(", "));
  };

  const previewHtml = `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#222;max-width:600px;padding:20px;">
      <p><strong>To:</strong> ${toList.map(r=>r.email||r.name).join(", ")||"—"}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <hr style="border:1px solid #eee;margin:12px 0"/>
      <div style="white-space:pre-wrap">${body}</div>
      <hr style="border:1px solid #eee;margin:16px 0"/>
      ${sig.replace(/\n/g,"<br/>")}
    </div>`;

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal fade-in modal-lg" style={{ maxWidth:660,maxHeight:"90vh",display:"flex",flexDirection:"column" }}>
        <div className="modal-header">
          <div className="modal-title"><Icon d={ic.mail} size={16} /> Send Report{reports.length>1?"s":""} via Email</div>
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22} /></button>
        </div>

        {/* Sub-tabs */}
        <div style={{ display:"flex",borderBottom:"1px solid var(--border)",padding:"0 24px" }}>
          {["compose","preview"].map(t=>(
            <button key={t} className="btn btn-ghost btn-sm"
              style={{ borderBottom:`2px solid ${activeTab===t?"var(--accent)":"transparent"}`,borderRadius:0,paddingBottom:10,color:activeTab===t?"var(--accent)":"var(--text2)",fontWeight:activeTab===t?700:500,textTransform:"capitalize" }}
              onClick={()=>setActiveTab(t)}>{t==="compose"?"✏ Compose":"👁 Preview"}</button>
          ))}
          <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:6,paddingBottom:8 }}>
            <span style={{ fontSize:11.5,color:"var(--text3)" }}>Sending:</span>
            {reports.map(r=>(
              <span key={r.id} style={{ fontSize:11.5,padding:"2px 8px",borderRadius:10,background:"var(--accent-glow)",color:"var(--accent)",fontWeight:600,border:"1px solid var(--accent)" }}>{r.title}</span>
            ))}
          </div>
        </div>

        <div className="modal-body" style={{ flex:1,overflowY:"auto" }}>
          {activeTab==="compose" ? (
            <div>
              {/* Recipients */}
              <div className="form-group">
                <label className="form-label">Recipients</label>
                {/* Quick-add pills */}
                {QUICK_RECIPIENTS.length>0 && (
                  <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
                    {QUICK_RECIPIENTS.map(r=>{
                      const added = toList.find(t=>t.email===r.email);
                      return (
                        <div key={r.email} onClick={()=>added?removeRecipient(r.email):addQuick(r)}
                          style={{ padding:"5px 12px",borderRadius:20,border:`1.5px solid ${added?"var(--accent)":"var(--border)"}`,background:added?"var(--accent-glow)":"var(--surface2)",cursor:"pointer",fontSize:12.5,fontWeight:600,color:added?"var(--accent)":"var(--text2)",transition:"all .15s",userSelect:"none" }}>
                          {added?"✓ ":""}{r.label}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Added recipients */}
                {toList.length>0 && (
                  <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
                    {toList.map(r=>(
                      <div key={r.email||r.name} style={{ display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:20,background:"var(--surface2)",border:"1px solid var(--border)",fontSize:12.5 }}>
                        <span style={{ fontWeight:600 }}>{r.name||r.email}</span>
                        {r.email && <span style={{ color:"var(--text3)" }}>&lt;{r.email}&gt;</span>}
                        <button onClick={()=>removeRecipient(r.email)} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--text3)",padding:0,lineHeight:1,fontSize:14 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Custom email */}
                <div style={{ display:"flex",gap:8 }}>
                  <input className="form-input" style={{ flex:1 }} placeholder="Name (optional)" value={customName} onChange={e=>setCustomName(e.target.value)} />
                  <input className="form-input" style={{ flex:2 }} placeholder="email@address.com" value={customEmail} onChange={e=>setCustomEmail(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&addCustom()} />
                  <button className="btn btn-secondary btn-sm" onClick={addCustom}><Icon d={ic.plus} size={13} /> Add</button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Subject</label>
                <input className="form-input" value={subject} onChange={e=>setSubject(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Message Body</label>
                <textarea className="form-input form-textarea" style={{ minHeight:160,fontSize:13,fontFamily:"inherit",lineHeight:1.7,resize:"vertical" }}
                  value={body} onChange={e=>setBody(e.target.value)} />
              </div>

              {/* Signature preview */}
              <div style={{ padding:"12px 14px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",borderLeft:"3px solid var(--border)",fontSize:12.5 }}>
                <div style={{ fontSize:11,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:8 }}>Signature (from Settings → Email)</div>
                <div style={{ color:"var(--text2)",lineHeight:1.7,whiteSpace:"pre-wrap" }}>{sig||"No signature configured — add one in Settings → Email"}</div>
              </div>
            </div>
          ) : (
            <div style={{ background:"white",borderRadius:"var(--radius-sm)",overflow:"hidden" }}
              dangerouslySetInnerHTML={{ __html: previewHtml }} />
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSend}>
            <Icon d={ic.mail} size={13} /> Send Email
          </button>
        </div>
      </div>
    </div>
  );
}

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

// ── Photo Settings Modal ──────────────────────────────────────────────────────
function PhotoSettingsModal({ photo, rooms, photoTags, onSave, onClose }) {
  const FLOORS = ["Crawlspace", "Basement", "Main Floor", "Second Floor", "Third Floor", "Attic", "Exterior", "Other"];
  const [name,    setName]    = useState(photo.name  || "");
  const [room,    setRoom]    = useState(photo.room  || "");
  const [floor,   setFloor]   = useState(photo.floor || "");
  const [tags,    setTags]    = useState(photo.tags  || []);
  const [gps,     setGps]     = useState(photo.gps   || null);
  const [newTag,  setNewTag]  = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError,   setGpsError]   = useState("");

  const toggleTag = (t) => setTags(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev, t]);
  const addCustomTag = () => {
    const t = newTag.trim();
    if (!t || tags.includes(t)) { setNewTag(""); return; }
    setTags(prev => [...prev, t]);
    setNewTag("");
  };

  const requestGps = () => {
    setGpsLoading(true); setGpsError("");
    navigator.geolocation.getCurrentPosition(
      pos => { setGps({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }); setGpsLoading(false); },
      ()  => { setGpsError("Location access denied or unavailable."); setGpsLoading(false); },
      { timeout: 8000 }
    );
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal fade-in" style={{ maxWidth:440 }}>
        <div className="modal-header">
          <div className="modal-title"><Icon d={ic.image} size={16} /> Photo Settings</div>
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22} /></button>
        </div>

        <div className="modal-body">
          {/* Thumbnail */}
          {photo.dataUrl && (
            <div style={{ marginBottom:16,borderRadius:"var(--radius-sm)",overflow:"hidden",maxHeight:150,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--surface2)" }}>
              <img src={photo.dataUrl} alt={photo.name} style={{ width:"100%",objectFit:"cover",maxHeight:150 }} />
            </div>
          )}

          {/* Name */}
          <div className="form-group">
            <label className="form-label">Photo Name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Enter photo name…" />
          </div>

          {/* Room */}
          <div className="form-group">
            <label className="form-label">Room / Area</label>
            <select className="form-input form-select" value={room} onChange={e => setRoom(e.target.value)}>
              <option value="">— No room assigned —</option>
              {rooms.map(r => <option key={r.id} value={r.name}>{r.icon} {r.name}</option>)}
            </select>
          </div>

          {/* Floor */}
          <div className="form-group">
            <label className="form-label">Floor</label>
            <div style={{ display:"flex",flexWrap:"wrap",gap:7 }}>
              {FLOORS.map(f => (
                <div key={f} onClick={() => setFloor(floor===f?"":f)}
                  style={{ padding:"5px 13px",borderRadius:20,cursor:"pointer",fontSize:12.5,fontWeight:600,userSelect:"none",transition:"all .15s",
                    background:floor===f?"var(--accent)":"var(--surface2)",
                    color:      floor===f?"white":"var(--text2)",
                    border:    `1.5px solid ${floor===f?"var(--accent)":"var(--border)"}` }}>
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Geotag */}
          <div className="form-group">
            <label className="form-label">Geotag</label>
            {gps ? (
              <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)" }}>
                <Icon d={ic.mapPin} size={14} stroke="var(--green)" />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12.5,fontWeight:600,color:"var(--green)" }}>Location tagged</div>
                  <div style={{ fontSize:11.5,color:"var(--text3)",fontFamily:"monospace" }}>{gps.lat}, {gps.lng}</div>
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => setGps(null)}>Remove</button>
              </div>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)" }}>
                  <Icon d={ic.mapPin} size={14} stroke="var(--text3)" />
                  <span style={{ fontSize:12.5,color:"var(--text3)",flex:1 }}>No location data</span>
                  <button className="btn btn-sm btn-secondary" onClick={requestGps} disabled={gpsLoading}>
                    {gpsLoading ? "Getting location…" : "Add Geotag"}
                  </button>
                </div>
                {gpsError && <div style={{ fontSize:12,color:"#ff6b6b",paddingLeft:4 }}>{gpsError}</div>}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="form-group" style={{ marginBottom:0 }}>
            <label className="form-label">Tags</label>
            <div style={{ display:"flex",flexWrap:"wrap",gap:7,marginBottom:10 }}>
              {photoTags.map(t => (
                <div key={t} onClick={() => toggleTag(t)}
                  style={{ padding:"5px 13px",borderRadius:20,cursor:"pointer",fontSize:12.5,fontWeight:600,userSelect:"none",transition:"all .15s",
                    background:tags.includes(t)?"var(--accent)":"var(--surface2)",
                    color:      tags.includes(t)?"white":"var(--text2)",
                    border:    `1.5px solid ${tags.includes(t)?"var(--accent)":"var(--border)"}` }}>
                  {tags.includes(t)?"✓ ":""}{t}
                </div>
              ))}
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <input className="form-input" style={{ flex:1 }} placeholder="Add custom tag…" value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => { if (e.key==="Enter") addCustomTag(); if (e.key==="Escape") setNewTag(""); }} />
              <button className="btn btn-secondary btn-sm" onClick={addCustomTag}><Icon d={ic.plus} size={13} /> Add</button>
            </div>
            {tags.filter(t => !photoTags.includes(t)).length > 0 && (
              <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginTop:8 }}>
                {tags.filter(t => !photoTags.includes(t)).map(t => (
                  <span key={t} style={{ display:"flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:600,
                    background:"var(--accent)",color:"white",border:"1.5px solid var(--accent)" }}>
                    {t}<span onClick={() => toggleTag(t)} style={{ cursor:"pointer",opacity:.8,fontSize:14,lineHeight:1 }}>×</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { onSave({ name: name.trim() || photo.name, room, floor, tags, gps }); onClose(); }}>
            <Icon d={ic.check} size={14} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Videos Tab ────────────────────────────────────────────────────────────────
function VideosTab({ project, onUpdateProject, onOpenCamera }) {
  const videos = project.videos || [];
  const [playing,     setPlaying]     = useState(null);  // video id being viewed
  const [editingVid,  setEditingVid]  = useState(null);  // { id, name, room }
  const [confirmDel,  setConfirmDel]  = useState(null);
  const [filterRoom,  setFilterRoom]  = useState("all");

  const rooms = ["all", ...(project.rooms?.map(r => r.name) || [])];

  const filtered = filterRoom === "all" ? videos : videos.filter(v => v.room === filterRoom);

  const fmtTime = s => {
    if (!s && s !== 0) return "";
    return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(Math.floor(s%60)).padStart(2,"0")}`;
  };

  const deleteVideo = (id) => {
    onUpdateProject({ ...project, videos: videos.filter(v => v.id !== id) });
    if (playing === id) setPlaying(null);
    setConfirmDel(null);
  };

  const saveEdit = () => {
    if (!editingVid) return;
    onUpdateProject({ ...project, videos: videos.map(v => v.id === editingVid.id ? { ...v, name: editingVid.name, room: editingVid.room } : v) });
    setEditingVid(null);
  };

  const playingVid = videos.find(v => v.id === playing);

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div className="section-title" style={{ marginBottom:0 }}>Videos</div>
          <span style={{ fontSize:12,color:"var(--text3)",padding:"2px 9px",background:"var(--surface2)",borderRadius:10,border:"1px solid var(--border)" }}>{videos.length} clip{videos.length!==1?"s":""}</span>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          {rooms.length > 2 && (
            <select className="form-input form-select" value={filterRoom} onChange={e=>setFilterRoom(e.target.value)} style={{ width:"auto",fontSize:12.5,padding:"5px 28px 5px 10px",height:"auto" }}>
              {rooms.map(r=><option key={r} value={r}>{r==="all"?"All Rooms":r}</option>)}
            </select>
          )}
          <button className="btn btn-primary btn-sm" onClick={()=>onOpenCamera(project)}>
            <Icon d={ic.video} size={14}/> Record Video
          </button>
        </div>
      </div>

      {/* Empty state */}
      {videos.length === 0 && (
        <div style={{ textAlign:"center",padding:"70px 20px",color:"var(--text3)" }}>
          <Icon d={ic.video} size={48} stroke="var(--text3)"/>
          <div style={{ fontSize:17,fontWeight:700,marginTop:16,marginBottom:8,color:"var(--text2)" }}>No videos yet</div>
          <div style={{ fontSize:13,marginBottom:20 }}>Record up to 90-second clips directly from the camera.</div>
          <button className="btn btn-primary" onClick={()=>onOpenCamera(project)}><Icon d={ic.video} size={14}/> Record Video</button>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14 }}>
          {filtered.map(v => (
            <div key={v.id} style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",overflow:"hidden",transition:"box-shadow .15s" }}
              onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 18px rgba(0,0,0,.18)"}
              onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
              {/* Thumbnail / play area */}
              <div style={{ position:"relative",aspectRatio:"16/9",background:"#0d0f14",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}
                onClick={()=>setPlaying(v.id)}>
                <div style={{ width:52,height:52,borderRadius:"50%",background:"rgba(255,255,255,.12)",border:"2px solid rgba(255,255,255,.3)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)",transition:"transform .15s" }}
                  onMouseEnter={e=>e.currentTarget.style.transform="scale(1.1)"}
                  onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                  <Icon d="M5 3l14 9-14 9V3z" size={22} stroke="white" fill="white"/>
                </div>
                {v.duration != null && (
                  <span style={{ position:"absolute",bottom:8,right:8,fontSize:11,fontWeight:700,background:"rgba(0,0,0,.75)",color:"white",padding:"2px 7px",borderRadius:6,letterSpacing:".03em" }}>
                    {fmtTime(v.duration)}
                  </span>
                )}
                <span style={{ position:"absolute",top:8,left:8,fontSize:10.5,background:"rgba(0,0,0,.6)",color:"rgba(255,255,255,.85)",padding:"2px 8px",borderRadius:6 }}>
                  🎬 {v.room || "General"}
                </span>
              </div>
              {/* Meta */}
              <div style={{ padding:"11px 13px" }}>
                <div style={{ fontWeight:700,fontSize:13.5,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{v.name}</div>
                <div style={{ display:"flex",alignItems:"center",gap:6,fontSize:11.5,color:"var(--text3)",marginBottom:10 }}>
                  <Icon d={ic.clockIcon} size={11}/>{v.date}
                  {v.gps && <><span>·</span><Icon d={ic.mapPin} size={11} stroke="#3dba7e"/><span style={{ color:"#3dba7e" }}>GPS</span></>}
                </div>
                <div style={{ display:"flex",gap:6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ flex:1,justifyContent:"center" }} onClick={()=>setPlaying(v.id)}>
                    <Icon d="M5 3l14 9-14 9V3z" size={12} fill="var(--accent)" stroke="var(--accent)"/> Play
                  </button>
                  <button className="btn btn-ghost btn-sm btn-icon" style={{ width:30 }} onClick={()=>setEditingVid({ id:v.id, name:v.name, room:v.room||"General" })}>
                    <Icon d={ic.edit} size={13}/>
                  </button>
                  <button className="btn btn-ghost btn-sm btn-icon" style={{ width:30,color:"#e85a3a" }} onClick={()=>setConfirmDel(v)}>
                    <Icon d={ic.trash} size={13}/>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 && videos.length > 0 && (
        <div style={{ textAlign:"center",padding:"40px",color:"var(--text3)",fontSize:13 }}>No videos in "{filterRoom}"</div>
      )}

      {/* Lightbox player */}
      {playing && playingVid && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setPlaying(null); }} style={{ zIndex:150 }}>
          <div style={{ background:"#000",borderRadius:"var(--radius)",overflow:"hidden",width:"min(90vw,900px)",boxShadow:"0 24px 80px rgba(0,0,0,.7)" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",background:"#111",borderBottom:"1px solid #222" }}>
              <div style={{ fontWeight:700,fontSize:14,color:"white" }}>{playingVid.name}</div>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <span style={{ fontSize:11.5,color:"rgba(255,255,255,.5)" }}>{playingVid.room} · {playingVid.date}{playingVid.duration!=null?` · ${fmtTime(playingVid.duration)}`:""}</span>
                <button className="btn btn-ghost btn-icon" style={{ color:"white",width:30,height:30 }} onClick={()=>setPlaying(null)}><Icon d={ic.close} size={16}/></button>
              </div>
            </div>
            <video src={playingVid.dataUrl} controls autoPlay style={{ width:"100%",display:"block",background:"#000",maxHeight:"75vh" }} />
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingVid && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setEditingVid(null)}>
          <div className="modal" style={{ maxWidth:400 }}>
            <div className="modal-header"><div className="modal-title">Edit Video</div><button className="btn btn-ghost btn-icon" onClick={()=>setEditingVid(null)}><Icon d={ic.close} size={16}/></button></div>
            <div className="modal-body" style={{ display:"flex",flexDirection:"column",gap:14 }}>
              <div>
                <div className="form-label">Video Name</div>
                <input className="form-input" value={editingVid.name} onChange={e=>setEditingVid(v=>({...v,name:e.target.value}))} />
              </div>
              <div>
                <div className="form-label">Room</div>
                <select className="form-input form-select" value={editingVid.room} onChange={e=>setEditingVid(v=>({...v,room:e.target.value}))}>
                  {(project.rooms||[]).map(r=><option key={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setEditingVid(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit}><Icon d={ic.check} size={14}/> Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setConfirmDel(null)}>
          <div className="modal" style={{ maxWidth:380 }}>
            <div className="modal-header"><div className="modal-title">Delete Video?</div><button className="btn btn-ghost btn-icon" onClick={()=>setConfirmDel(null)}><Icon d={ic.close} size={16}/></button></div>
            <div className="modal-body"><p style={{ fontSize:13.5,color:"var(--text2)",margin:0 }}>"{confirmDel.name}" will be permanently deleted.</p></div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={()=>deleteVideo(confirmDel.id)}><Icon d={ic.trash} size={14}/> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Photos Tab ────────────────────────────────────────────────────────────────
function PhotosTab({ project, onUpdateProject, onEditPhoto, onOpenCamera, fileRef, addUploadedPhotos }) {
  const photos    = project.photos    || [];
  const rooms     = project.rooms     || [];
  const photoTags = project.photoTags || ["Before", "During", "After"];

  const [filterRoom,    setFilterRoom]    = useState("all");
  const [filterTag,     setFilterTag]     = useState("all");
  const [editingTag,    setEditingTag]    = useState(null);
  const [addingTag,     setAddingTag]     = useState(false);
  const [newTagInput,   setNewTagInput]   = useState("");
  const [settingsPhoto, setSettingsPhoto] = useState(null); // photo being edited in popup

  const updatePhoto = (id, patch) =>
    onUpdateProject({ ...project, photos: photos.map(p => p.id===id ? { ...p, ...patch } : p) });
  const deletePhoto = (id) =>
    onUpdateProject({ ...project, photos: photos.filter(p => p.id!==id) });
  const saveTags = (tags) => onUpdateProject({ ...project, photoTags: tags });

  const togglePhotoTag = (photoId, tag) => {
    const photo = photos.find(p => p.id===photoId);
    const cur   = photo?.tags || [];
    updatePhoto(photoId, { tags: cur.includes(tag) ? cur.filter(t=>t!==tag) : [...cur, tag] });
  };

  const renameTag = (oldName, newName) => {
    if (!newName.trim() || newName===oldName) { setEditingTag(null); return; }
    const t = newName.trim();
    onUpdateProject({
      ...project,
      photoTags: photoTags.map(x => x===oldName ? t : x),
      photos: photos.map(p => ({ ...p, tags: (p.tags||[]).map(x => x===oldName ? t : x) })),
    });
    setEditingTag(null);
  };
  const deleteTag = (tag) => onUpdateProject({
    ...project,
    photoTags: photoTags.filter(t => t!==tag),
    photos: photos.map(p => ({ ...p, tags: (p.tags||[]).filter(t => t!==tag) })),
  });
  const addTag = () => {
    const t = newTagInput.trim();
    if (!t || photoTags.includes(t)) { setAddingTag(false); setNewTagInput(""); return; }
    saveTags([...photoTags, t]);
    setNewTagInput(""); setAddingTag(false);
  };

  const filtered = photos.filter(p => {
    if (filterRoom !== "all" && p.room !== filterRoom) return false;
    if (filterTag  !== "all" && !(p.tags||[]).includes(filterTag)) return false;
    return true;
  });

  return (
    <div>
      {/* Top bar */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:10 }}>
        <div style={{ fontSize:13,color:"var(--text2)" }}>{filtered.length} of {photos.length} photo{photos.length!==1?"s":""}</div>
        <div style={{ display:"flex",gap:8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}><Icon d={ic.image} size={13} /> Upload</button>
          <button className="btn btn-primary btn-sm" onClick={() => onOpenCamera(project)}><Icon d={ic.camera} size={13} /> Live Camera</button>
        </div>
      </div>
      <input ref={fileRef} type="file" multiple accept="image/*" style={{ display:"none" }} onChange={e => addUploadedPhotos(e.target.files)} />

      {/* Tags management row */}
      <div style={{ display:"flex",alignItems:"center",flexWrap:"wrap",gap:7,marginBottom:14,padding:"10px 14px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)" }}>
        <span style={{ fontSize:11,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",whiteSpace:"nowrap" }}>📁 Tags:</span>
        {photoTags.map(tag => (
          <div key={tag} style={{ display:"flex",alignItems:"center",gap:4 }}>
            {editingTag===tag ? (
              <input autoFocus className="form-input" style={{ width:100,padding:"2px 7px",fontSize:12,height:26 }}
                defaultValue={tag}
                onBlur={e => renameTag(tag, e.target.value)}
                onKeyDown={e => { if (e.key==="Enter") renameTag(tag, e.target.value); if (e.key==="Escape") setEditingTag(null); }} />
            ) : (
              <span onClick={() => setFilterTag(filterTag===tag?"all":tag)}
                style={{ fontSize:12,padding:"3px 10px",borderRadius:20,cursor:"pointer",fontWeight:600,userSelect:"none",
                  background:filterTag===tag?"var(--accent)":"var(--surface3)",
                  color:filterTag===tag?"white":"var(--text2)",
                  border:`1.5px solid ${filterTag===tag?"var(--accent)":"var(--border)"}`,transition:"all .15s" }}>
                {tag}
              </span>
            )}
            <button onClick={() => setEditingTag(tag)} title="Rename" style={{ background:"none",border:"none",cursor:"pointer",color:"var(--text3)",padding:"2px 3px",fontSize:11,lineHeight:1 }}>✏</button>
            <button onClick={() => deleteTag(tag)} title="Delete" style={{ background:"none",border:"none",cursor:"pointer",color:"var(--text3)",padding:"2px 3px",fontSize:11,lineHeight:1 }}>×</button>
          </div>
        ))}
        {addingTag ? (
          <input autoFocus className="form-input" style={{ width:110,padding:"2px 8px",fontSize:12,height:26 }}
            placeholder="Tag name…" value={newTagInput} onChange={e => setNewTagInput(e.target.value)}
            onBlur={addTag}
            onKeyDown={e => { if (e.key==="Enter") addTag(); if (e.key==="Escape") { setAddingTag(false); setNewTagInput(""); }}} />
        ) : (
          <button className="btn btn-ghost btn-sm" style={{ fontSize:12,padding:"2px 10px",height:26 }} onClick={() => setAddingTag(true)}>
            <Icon d={ic.plus} size={11} /> New Tag
          </button>
        )}
        {filterTag !== "all" && (
          <button className="btn btn-ghost btn-sm" style={{ marginLeft:"auto",fontSize:11.5,color:"var(--text3)" }} onClick={() => setFilterTag("all")}>× Clear</button>
        )}
      </div>

      {/* Room filter pills */}
      {rooms.length > 0 && (
        <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:16 }}>
          {[{name:"all"}, ...rooms].map(r => (
            <div key={r.name} onClick={() => setFilterRoom(r.name)}
              style={{ fontSize:12,padding:"4px 12px",borderRadius:20,cursor:"pointer",fontWeight:600,userSelect:"none",
                background:filterRoom===r.name?"var(--accent)":"var(--surface2)",
                color:filterRoom===r.name?"white":"var(--text2)",
                border:`1.5px solid ${filterRoom===r.name?"var(--accent)":"var(--border)"}`,transition:"all .15s" }}>
              {r.name==="all"?"All Rooms":r.name}
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      {photos.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><Icon d={ic.camera} size={28} stroke="var(--text3)" /></div>
          <h3>No photos yet</h3>
          <p>Open the live camera or upload photos to start documenting this jobsite.</p>
          <button className="btn btn-primary" onClick={() => onOpenCamera(project)}><Icon d={ic.camera} size={15} /> Open Camera</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty" style={{ padding:"32px 0" }}>
          <div className="empty-icon"><Icon d={ic.image} size={24} stroke="var(--text3)" /></div>
          <h3>No photos match</h3>
          <p>Try a different room or tag filter.</p>
        </div>
      ) : (
        <div className="grid-4">
          {filtered.map(photo => (
            <div key={photo.id} className="photo-card">
              <div className="photo-card-img" onClick={() => onEditPhoto(photo)}>
                {photo.dataUrl
                  ? <img src={photo.dataUrl} alt={photo.name} />
                  : <div className="photo-placeholder"><Icon d={ic.image} size={32} stroke={photo.color||"var(--accent)"} /><span style={{ fontSize:10,color:"var(--text3)" }}>{photo.room}</span></div>}
                {photo.gps && <div style={{ position:"absolute",bottom:5,left:5 }}><span className="pill" style={{ fontSize:9,padding:"3px 7px" }}><Icon d={ic.mapPin} size={9} stroke="#3dba7e" />GPS</span></div>}
                {/* Hover actions */}
                <div style={{ position:"absolute",top:6,right:6,opacity:0,transition:"opacity .15s",display:"flex",gap:6 }} className="photo-actions">
                  <button className="btn btn-sm btn-icon photo-action-btn"
                    style={{ background:"rgba(20,22,30,0.85)",border:"1px solid var(--border)",color:"var(--text2)",width:36,height:36 }}
                    title="Photo settings"
                    onClick={e => { e.stopPropagation(); setSettingsPhoto(photo); }}>
                    <Icon d={ic.settings} size={16} />
                  </button>
                  <button className="btn btn-sm btn-icon photo-action-btn" style={{ background:"#dc3c3c",border:"none",color:"white",width:36,height:36 }}
                    onClick={e => { e.stopPropagation(); deletePhoto(photo.id); }}>
                    <Icon d={ic.trash} size={16} />
                  </button>
                </div>
              </div>

              <div className="photo-card-info">
                <div className="photo-card-name">{photo.name}</div>
                <div style={{ fontSize:11.5,color:"var(--text2)",marginBottom:4,display:"flex",alignItems:"center",gap:4,flexWrap:"wrap" }}>
                  {photo.room && <span><span style={{ fontSize:11 }}>📍</span> {photo.room}</span>}
                  {photo.floor && <><span style={{ color:"var(--border)" }}>·</span><span><span style={{ fontSize:11 }}>🏢</span> {photo.floor}</span></>}
                </div>
                {/* Tag chips */}
                {(photo.tags||[]).length > 0 && (
                  <div style={{ display:"flex",flexWrap:"wrap",gap:4,marginBottom:4 }}>
                    {(photo.tags||[]).map(tag => (
                      <span key={tag} style={{ fontSize:10,padding:"2px 7px",borderRadius:10,fontWeight:600,
                        background:"var(--accent)",color:"white",border:"1px solid var(--accent)" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize:11,color:"var(--text3)" }}>{photo.date}</div>
              </div>
            </div>
          ))}

          {/* Add photo card */}
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

      {/* Photo settings popup */}
      {settingsPhoto && (
        <PhotoSettingsModal
          photo={settingsPhoto}
          rooms={rooms}
          photoTags={photoTags}
          onSave={patch => updatePhoto(settingsPhoto.id, patch)}
          onClose={() => setSettingsPhoto(null)}
        />
      )}
    </div>
  );
}


// ── Sketch Editor ──────────────────────────────────────────────────────────────
const SKETCH_TOOLS = [
  { id:"pan",       icon:"M18 11V6a2 2 0 00-2-2 2 2 0 00-2 2 2 2 0 00-2-2 2 2 0 00-2 2v.5 M14 10.5V4a2 2 0 00-2-2 2 2 0 00-2 2v.5 M10 10.5V6a2 2 0 00-2-2 2 2 0 00-2 2v8a6 6 0 006 6h2a6 6 0 006-6v-2.5",  label:"Pan / Move Screen" },
  { id:"select",    icon:"M3 3l7 18 3-7 7-3z",                        label:"Select Element" },
  { id:"pen",       icon:"M12 20h9 M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z", label:"Pen" },
  { id:"line",      icon:"M5 19L19 5",                                  label:"Line"      },
  { id:"rect",      icon:"M3 3h18v18H3z",                              label:"Rectangle" },
  { id:"circle",    icon:"M12 22a10 10 0 100-20 10 10 0 000 20z",      label:"Circle"    },
  { id:"dimension", icon:"M21 6H3 M3 6l3-3M3 6l3 3 M21 6l-3-3 M21 6l-3 3 M12 6v8", label:"Dimension"},
  { id:"text",      icon:"M4 7V4h16v3 M9 20h6 M12 4v16",               label:"Text"      },
  { id:"eraser",    icon:"M20 20H7L3 16l10-10 7 7-2.5 2.5",            label:"Eraser"    },
];

const MOISTURE_COLORS = [
  { id:"dry",       color:"#4a90d9", label:"Dry"       },
  { id:"damp",      color:"#3dba7e", label:"Damp"      },
  { id:"wet",       color:"#e8c53a", label:"Wet"       },
  { id:"saturated", color:"#e85a3a", label:"Saturated" },
  { id:"mold",      color:"#8b7cf8", label:"Mold Risk" },
];

const STROKE_COLORS = ["#000000","#e86c3a","#4a90d9","#3dba7e","#e8c53a","#e85a3a","#8b7cf8","#ffffff"];

function SketchEditor({ sketch, rooms, reports, onSave, onClose }) {
  const { useState: us, useRef: ur, useEffect: ue, useCallback: uc } = React;
  const canvasRef    = ur(null);
  const overlayRef   = ur(null);  // for live preview of in-progress shapes
  const containerRef = ur(null);

  const [tool,       setTool]       = us("pen");
  const [color,      setColor]      = us("#000000");
  const [strokeW,    setStrokeW]    = us(2);
  const [fontSize,   setFontSize]   = us(16);
  const [zoom,       setZoom]       = us(1);
  const [panOffset,  setPanOffset]  = us({x:0,y:0});
  const [elements,   setElements]   = us(sketch?.elements   || []);
  const [history,    setHistory]    = us([sketch?.elements  || []]);
  const [histIdx,    setHistIdx]    = us(0);
  const [title,      setTitle]      = us(sketch?.title      || "New Sketch");
  const [notes,      setNotes]      = us(sketch?.notes      || "");
  const [scale,      setScale]      = us(sketch?.scale      || "1 sq = 1 ft");
  const [roomTag,    setRoomTag]    = us(sketch?.roomTag    || (rooms?.[0]?.name || ""));
  const [showGrid,   setShowGrid]   = us(true);
  const [showNotes,  setShowNotes]  = us(false);
  const [showExport, setShowExport] = us(false);
  const [selReport,  setSelReport]  = us("");
  const [editingText,setEditingText]= us(null);
  const [tempText,   setTempText]   = us("");
  const [selectedEl, setSelectedEl] = us(null);
  const [saved,      setSaved]      = us(false);
  const textInputRef = ur(null);

  // refs for current zoom/pan (used inside event handlers without stale closure)
  const zoomRef      = ur(1);
  const panRef       = ur({x:0,y:0});
  ue(() => { zoomRef.current = zoom; }, [zoom]);
  ue(() => { panRef.current = panOffset; }, [panOffset]);

  const elementsRef = ur(elements);
  ue(() => { elementsRef.current = elements; }, [elements]);

  // drawing state refs (not state — no re-render needed mid-stroke)
  const drawing   = ur(false);
  const startPt   = ur({x:0,y:0});
  const lastPt    = ur({x:0,y:0});
  const penPoints = ur([]);
  const panStart  = ur({x:0,y:0}); // raw screen coords for pan

  const CANVAS_W = 900;
  const CANVAS_H = 650;

  // ── Render all elements to main canvas ──
  const redraw = uc(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid
    if (showGrid) {
      ctx.strokeStyle = "rgba(180,190,210,0.25)";
      ctx.lineWidth = 0.5;
      const SZ = 30;
      for (let x = 0; x <= CANVAS_W; x += SZ) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,CANVAS_H); ctx.stroke(); }
      for (let y = 0; y <= CANVAS_H; y += SZ) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CANVAS_W,y); ctx.stroke(); }
    }

    elements.forEach(el => {
      drawElement(ctx, el);
      // draw selection highlight
      if (tool === "select" && selectedEl === el.id) {
        ctx.save();
        ctx.strokeStyle = "#4a90d9";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.globalAlpha = 0.8;
        const pad = 6;
        if (el.type === "rect") {
          ctx.strokeRect(el.x-pad, el.y-pad, el.w+pad*2, el.h+pad*2);
        } else if (el.type === "circle") {
          const rx = Math.abs(el.w/2)+pad, ry = Math.abs(el.h/2)+pad;
          ctx.beginPath(); ctx.ellipse(el.x+el.w/2, el.y+el.h/2, rx, ry, 0, 0, Math.PI*2); ctx.stroke();
        } else if (el.type === "line" || el.type === "dimension") {
          const mx=(el.x1+el.x2)/2, my=(el.y1+el.y2)/2;
          ctx.beginPath(); ctx.arc(mx,my,6,0,Math.PI*2); ctx.stroke();
        } else if (el.type === "pen") {
          const xs = el.points.map(p=>p.x), ys = el.points.map(p=>p.y);
          const minX=Math.min(...xs)-pad,minY=Math.min(...ys)-pad,maxX=Math.max(...xs)+pad,maxY=Math.max(...ys)+pad;
          ctx.strokeRect(minX,minY,maxX-minX,maxY-minY);
        } else if (el.type === "text") {
          ctx.strokeRect(el.x-pad, el.y-pad, 200, (el.fontSize||14)*1.5+pad*2);
        }
        ctx.restore();
      }
    });
  }, [elements, showGrid, selectedEl, tool]);

  // ── Keyboard: delete selected element ──
  ue(() => {
    function onKey(e) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedEl && tool === "select") {
        // Don't fire if user is typing in an input
        if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) return;
        pushHistory(elements.filter(el => el.id !== selectedEl));
        setSelectedEl(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedEl, elements, tool]);

  ue(() => { redraw(); }, [redraw]);

  function drawElement(ctx, el, preview = false) {
    ctx.save();
    ctx.strokeStyle = el.color || "#f0f2f7";
    ctx.fillStyle   = el.fillColor || "transparent";
    ctx.lineWidth   = el.strokeW || 2;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    if (preview) { ctx.globalAlpha = 0.7; }

    if (el.type === "pen") {
      if (!el.points || el.points.length < 2) { ctx.restore(); return; }
      ctx.beginPath();
      ctx.moveTo(el.points[0].x, el.points[0].y);
      el.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (el.type === "line") {
      ctx.beginPath(); ctx.moveTo(el.x1,el.y1); ctx.lineTo(el.x2,el.y2); ctx.stroke();
    } else if (el.type === "rect") {
      ctx.beginPath(); ctx.rect(el.x,el.y,el.w,el.h);
      if (el.fillColor && el.fillColor !== "transparent") { ctx.fillStyle=el.fillColor; ctx.fill(); }
      ctx.stroke();
    } else if (el.type === "circle") {
      const rx = Math.abs(el.w/2), ry = Math.abs(el.h/2);
      ctx.beginPath(); ctx.ellipse(el.x+el.w/2, el.y+el.h/2, rx, ry, 0, 0, Math.PI*2);
      if (el.fillColor && el.fillColor !== "transparent") { ctx.fillStyle=el.fillColor; ctx.fill(); }
      ctx.stroke();
    } else if (el.type === "dimension") {
      const dx = el.x2-el.x1, dy = el.y2-el.y1;
      const len = Math.sqrt(dx*dx+dy*dy);
      const label = el.label || `${(len/30).toFixed(1)} ft`;
      // main line
      ctx.strokeStyle = el.color || "#e86c3a";
      ctx.lineWidth = el.strokeW || 1.5;
      ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(el.x1,el.y1); ctx.lineTo(el.x2,el.y2); ctx.stroke();
      ctx.setLineDash([]);
      // arrow heads
      const angle = Math.atan2(dy,dx);
      const aw = 10;
      [[el.x1,el.y1,angle+Math.PI],[el.x2,el.y2,angle]].forEach(([ax,ay,a]) => {
        ctx.beginPath();
        ctx.moveTo(ax,ay);
        ctx.lineTo(ax+aw*Math.cos(a-0.4),ay+aw*Math.sin(a-0.4));
        ctx.moveTo(ax,ay);
        ctx.lineTo(ax+aw*Math.cos(a+0.4),ay+aw*Math.sin(a+0.4));
        ctx.stroke();
      });
      // tick marks perpendicular at endpoints
      const px = -Math.sin(angle)*10, py = Math.cos(angle)*10;
      [[el.x1,el.y1],[el.x2,el.y2]].forEach(([ex,ey]) => {
        ctx.beginPath(); ctx.moveTo(ex+px,ey+py); ctx.lineTo(ex-px,ey-py); ctx.stroke();
      });
      // label
      const mx = (el.x1+el.x2)/2 - Math.sin(angle)*14;
      const my = (el.y1+el.y2)/2 + Math.cos(angle)*14;
      ctx.font = `bold ${el.fontSize||12}px 'Inter',sans-serif`;
      ctx.fillStyle = el.color || "#e86c3a";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, mx, my);
    } else if (el.type === "text") {
      ctx.font = `${el.fontStyle||""}${el.fontSize||14}px 'Inter',sans-serif`;
      ctx.fillStyle = el.color || "#1a1e28";
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      (el.text||"").split("\n").forEach((line,i) => ctx.fillText(line, el.x, el.y + i*(el.fontSize||14)*1.4));
    }
    ctx.restore();
  }

  // ── Preview overlay ──
  function drawPreview(el) {
    const oc = overlayRef.current;
    if (!oc) return;
    const ctx = oc.getContext("2d");
    ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
    drawElement(ctx, el, true);
  }
  function clearPreview() {
    const oc = overlayRef.current;
    if (!oc) return;
    overlayRef.current.getContext("2d").clearRect(0,0,CANVAS_W,CANVAS_H);
  }

  // ── Coordinate helpers ──
  // Returns canvas-space coords accounting for current zoom+pan
  function getPos(e) {
    const canvas = canvasRef.current;
    if (!canvas) return {x:0,y:0};
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    // rect already includes CSS zoom transform, so direct mapping is correct
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return { x:(src.clientX-rect.left)*scaleX, y:(src.clientY-rect.top)*scaleY };
  }

  // Raw screen position (for pan dragging)
  function getRawPos(e) {
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX, y: src.clientY };
  }

  // ── Push to history ──
  function pushHistory(newEls) {
    setHistory(h => {
      const trimmed = h.slice(0, histIdx+1);
      return [...trimmed, newEls];
    });
    setHistIdx(i => i+1);
    setElements(newEls);
  }

  // ── Scale helper: pixels per unit ──
  function pxPerUnit(scaleStr) {
    // "1 sq = X ft" or "1 sq = X in" — 1 grid square = 30px
    if (!scaleStr || scaleStr === "No scale") return null;
    const m = scaleStr.match(/([\d.]+)\s*(ft|in)/i);
    if (!m) return null;
    const val  = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    // 30px = val ft  →  pxPerFt = 30/val
    return unit === "in" ? { px: 30, val, unit:"in" } : { px: 30, val, unit:"ft" };
  }

  function formatDimension(len, scaleStr) {
    const s = pxPerUnit(scaleStr);
    if (!s) return `${Math.round(len)}px`;
    const realUnits = (len / s.px) * s.val;
    if (s.unit === "in") {
      const totalIn = Math.round(realUnits);
      return totalIn >= 12 ? `${Math.floor(totalIn/12)}'-${totalIn%12}"` : `${totalIn}"`;
    }
    return realUnits < 1 ? `${Math.round(realUnits*12)}"` : `${realUnits.toFixed(1)} ft`;
  }

  // ── Hit testing ──
  function hitTest(el, pt, thresh = 8) {
    if (el.type === "pen") {
      const pts = el.points || [];
      for (let i = 0; i < pts.length - 1; i++) {
        if (distToSegment(pt, pts[i], pts[i+1]) < thresh + (el.strokeW||2)) return true;
      }
      return false;
    }
    if (el.type === "line") {
      return distToSegment(pt, {x:el.x1,y:el.y1}, {x:el.x2,y:el.y2}) < thresh + (el.strokeW||2);
    }
    if (el.type === "rect") {
      const inBox = pt.x >= el.x-thresh && pt.x <= el.x+el.w+thresh && pt.y >= el.y-thresh && pt.y <= el.y+el.h+thresh;
      if (!inBox) return false;
      // near edge or inside if filled
      if (el.fillColor && el.fillColor !== "transparent") return true;
      return pt.x <= el.x+thresh || pt.x >= el.x+el.w-thresh || pt.y <= el.y+thresh || pt.y >= el.y+el.h-thresh;
    }
    if (el.type === "circle") {
      const cx = el.x + el.w/2, cy = el.y + el.h/2;
      const rx = Math.abs(el.w/2), ry = Math.abs(el.h/2);
      if (rx < 1 || ry < 1) return false;
      const norm = Math.pow((pt.x-cx)/rx,2) + Math.pow((pt.y-cy)/ry,2);
      return norm <= Math.pow(1 + thresh/Math.min(rx,ry), 2) && norm >= Math.pow(Math.max(0,1-thresh/Math.min(rx,ry)), 2);
    }
    if (el.type === "dimension") {
      return distToSegment(pt, {x:el.x1,y:el.y1}, {x:el.x2,y:el.y2}) < thresh + 6;
    }
    if (el.type === "text") {
      return pt.x >= el.x - thresh && pt.y >= el.y - thresh && pt.x <= el.x + 200 && pt.y <= el.y + (el.fontSize||14) * 1.5;
    }
    return false;
  }

  function distToSegment(p, a, b) {
    const dx = b.x-a.x, dy = b.y-a.y;
    const lenSq = dx*dx + dy*dy;
    if (lenSq === 0) return Math.hypot(p.x-a.x, p.y-a.y);
    const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx + (p.y-a.y)*dy) / lenSq));
    return Math.hypot(p.x - (a.x+t*dx), p.y - (a.y+t*dy));
  }

  // ── Move element by delta ──
  function moveElement(el, dx, dy) {
    if (el.type === "pen") return { ...el, points: el.points.map(p => ({x:p.x+dx,y:p.y+dy})) };
    if (el.type === "line") return { ...el, x1:el.x1+dx,y1:el.y1+dy,x2:el.x2+dx,y2:el.y2+dy };
    if (el.type === "rect" || el.type === "circle") return { ...el, x:el.x+dx,y:el.y+dy };
    if (el.type === "dimension") return { ...el, x1:el.x1+dx,y1:el.y1+dy,x2:el.x2+dx,y2:el.y2+dy };
    if (el.type === "text") return { ...el, x:el.x+dx,y:el.y+dy };
    return el;
  }

  // select tool drag state refs
  const dragEl     = ur(null);  // element being dragged
  const dragOffset = ur({x:0,y:0});

  // ── Pointer down ──
  function onDown(e) {
    e.preventDefault();
    if (tool === "text") return;

    if (tool === "pan") {
      drawing.current = true;
      panStart.current = getRawPos(e);
      return;
    }

    const pt = getPos(e);
    drawing.current = true;
    startPt.current = pt;
    lastPt.current  = pt;

    if (tool === "select") {
      // find topmost element under cursor
      const hit = [...elements].reverse().find(el => hitTest(el, pt));
      if (hit) {
        dragEl.current     = hit.id;
        dragOffset.current = pt;
        setSelectedEl(hit.id);
      } else {
        dragEl.current = null;
        setSelectedEl(null);
      }
      return;
    }

    if (tool === "eraser") {
      penPoints.current = [pt];
      return;
    }
    if (tool === "pen") {
      penPoints.current = [pt];
    }
  }

  // ── Pointer move ──
  function onMove(e) {
    e.preventDefault();
    if (!drawing.current) return;

    if (tool === "pan") {
      const raw = getRawPos(e);
      const dx = raw.x - panStart.current.x;
      const dy = raw.y - panStart.current.y;
      panStart.current = raw;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      return;
    }

    const pt = getPos(e);
    const prev = lastPt.current;
    lastPt.current = pt;

    if (tool === "select") {
      if (dragEl.current) {
        const dx = pt.x - dragOffset.current.x;
        const dy = pt.y - dragOffset.current.y;
        dragOffset.current = pt;
        setElements(els => els.map(el => el.id === dragEl.current ? moveElement(el, dx, dy) : el));
      }
      return;
    }

    if (tool === "pen") {
      penPoints.current.push(pt);
      drawPreview({ type:"pen", points:[...penPoints.current], color, strokeW });
    } else if (tool === "eraser") {
      // live visual: draw semi-transparent circle cursor on overlay
      penPoints.current.push(pt);
      const oc = overlayRef.current;
      if (oc) {
        const ctx = oc.getContext("2d");
        ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
        ctx.strokeStyle = "rgba(200,50,50,0.6)";
        ctx.fillStyle   = "rgba(200,50,50,0.08)";
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, (strokeW*8)/2, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
      }
    } else if (tool === "line") {
      drawPreview({ type:"line", x1:startPt.current.x, y1:startPt.current.y, x2:pt.x, y2:pt.y, color, strokeW });
    } else if (tool === "rect") {
      drawPreview({ type:"rect", x:Math.min(startPt.current.x,pt.x), y:Math.min(startPt.current.y,pt.y), w:Math.abs(pt.x-startPt.current.x), h:Math.abs(pt.y-startPt.current.y), color, strokeW });
    } else if (tool === "circle") {
      drawPreview({ type:"circle", x:Math.min(startPt.current.x,pt.x), y:Math.min(startPt.current.y,pt.y), w:pt.x-startPt.current.x, h:pt.y-startPt.current.y, color, strokeW });
    } else if (tool === "dimension") {
      const dx=pt.x-startPt.current.x, dy=pt.y-startPt.current.y;
      const len=Math.sqrt(dx*dx+dy*dy);
      drawPreview({ type:"dimension", x1:startPt.current.x,y1:startPt.current.y,x2:pt.x,y2:pt.y, label:formatDimension(len, scale), color:"#e86c3a", strokeW:1.5 });
    }
  }

  // ── Pointer up ──
  function onUp(e) {
    if (!drawing.current) return;
    drawing.current = false;

    if (tool === "pan") return; // pan complete, nothing to commit

    clearPreview();

    if (tool === "select") {
      if (dragEl.current) {
        // commit final position to history
        pushHistory([...elementsRef.current]);
        dragEl.current = null;
      }
      return;
    }

    const pt = lastPt.current;
    const sp = startPt.current;

    if (tool === "eraser") {
      // Remove any elements that the eraser path touches
      const eraserR = strokeW * 8;
      const path = penPoints.current;
      const toRemove = new Set();
      elements.forEach(el => {
        for (const p of path) {
          if (hitTest(el, p, eraserR / 2)) { toRemove.add(el.id); break; }
        }
      });
      if (toRemove.size > 0) {
        pushHistory(elements.filter(el => !toRemove.has(el.id)));
      }
      penPoints.current = [];
      return;
    }

    let newEl = null;
    if (tool === "pen") {
      if (penPoints.current.length > 1)
        newEl = { id:uid(), type:"pen", points:[...penPoints.current], color, strokeW };
    } else if (tool === "line") {
      newEl = { id:uid(), type:"line", x1:sp.x,y1:sp.y,x2:pt.x,y2:pt.y, color, strokeW };
    } else if (tool === "rect") {
      const w = Math.abs(pt.x-sp.x), h = Math.abs(pt.y-sp.y);
      if (w > 3 && h > 3) newEl = { id:uid(), type:"rect", x:Math.min(sp.x,pt.x),y:Math.min(sp.y,pt.y),w,h, color, strokeW };
    } else if (tool === "circle") {
      if (Math.abs(pt.x-sp.x) > 3 && Math.abs(pt.y-sp.y) > 3)
        newEl = { id:uid(), type:"circle", x:Math.min(sp.x,pt.x),y:Math.min(sp.y,pt.y),w:pt.x-sp.x,h:pt.y-sp.y, color, strokeW };
    } else if (tool === "dimension") {
      const dx=pt.x-sp.x,dy=pt.y-sp.y,len=Math.sqrt(dx*dx+dy*dy);
      if (len > 10) newEl = { id:uid(), type:"dimension", x1:sp.x,y1:sp.y,x2:pt.x,y2:pt.y, label:formatDimension(len, scale), color:"#e86c3a", strokeW:1.5 };
    }

    if (newEl) pushHistory([...elements, newEl]);
    penPoints.current = [];
  }

  // ── Text tool ──
  function onCanvasClick(e) {
    if (tool !== "text") return;
    const pt = getPos(e);
    setEditingText(pt);
    setTempText("");
    setTimeout(() => textInputRef.current?.focus(), 50);
  }

  function commitText() {
    if (tempText.trim() && editingText) {
      pushHistory([...elements, { id:uid(), type:"text", x:editingText.x, y:editingText.y, text:tempText, color, fontSize }]);
    }
    setEditingText(null);
    setTempText("");
  }

  // ── Undo / Redo ──
  function undo() {
    if (histIdx <= 0) return;
    const ni = histIdx - 1;
    setHistIdx(ni);
    setElements(history[ni]);
  }
  function redo() {
    if (histIdx >= history.length-1) return;
    const ni = histIdx+1;
    setHistIdx(ni);
    setElements(history[ni]);
  }

  // ── Export canvas as dataUrl ──
  function exportDataUrl() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL("image/png");
  }

  // ── Save ──
  function handleSave() {
    const dataUrl = exportDataUrl();
    onSave({ id: sketch?.id || uid(), title, notes, scale, roomTag, elements, dataUrl, date: today() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // ── Add to report ──
  function handleAddToReport() {
    if (!selReport) return;
    const dataUrl = exportDataUrl();
    onSave({ id: sketch?.id || uid(), title, notes, scale, roomTag, elements, dataUrl, date: today() }, selReport);
    setShowExport(false);
  }

  // ── Clear canvas ──
  function clearAll() {
    if (!window.confirm("Clear all drawing content?")) return;
    pushHistory([]);
  }

  const canvasStyle = {
    position:"absolute", top:0, left:0, width:"100%", height:"100%",
    touchAction:"none", userSelect:"none",
    cursor: tool==="pan" ? (drawing.current ? "grabbing" : "grab") : tool==="eraser" ? "cell" : tool==="text" ? "text" : tool==="select" ? "default" : "crosshair",
  };

  // Zoom helpers
  const ZOOM_MIN = 0.25, ZOOM_MAX = 4;
  const zoomIn  = () => setZoom(z => Math.min(ZOOM_MAX, +(z * 1.25).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(ZOOM_MIN, +(z / 1.25).toFixed(2)));
  const zoomReset = () => { setZoom(1); setPanOffset({x:0,y:0}); };

  const activeReports = reports?.filter(r => r.status !== "archived") || [];

  return (
    <div style={{ position:"fixed",inset:0,zIndex:200,background:"var(--bg)",display:"flex",flexDirection:"column",overflow:"hidden" }}>

      {/* ── Top bar ── */}
      <div style={{ height:54,background:"var(--surface)",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10,padding:"0 12px",flexShrink:0 }}>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} title="Close">
          <Icon d={ic.close} size={18} />
        </button>
        <input value={title} onChange={e=>setTitle(e.target.value)}
          style={{ background:"transparent",border:"none",outline:"none",color:"var(--text)",fontWeight:700,fontSize:15,flex:1,minWidth:0 }} />
        <div style={{ display:"flex",alignItems:"center",gap:6,marginLeft:"auto" }}>
          {saved && <span style={{ fontSize:12,color:"var(--green)" }}>✓ Saved</span>}
          <button className="btn btn-ghost btn-sm btn-icon desktop-only" title="Undo" onClick={undo}><Icon d={ic.undo} size={16} /></button>
          <button className="btn btn-ghost btn-sm btn-icon desktop-only" title="Redo" onClick={redo} style={{ transform:"scaleX(-1)" }}><Icon d={ic.undo} size={16} /></button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowNotes(!showNotes)}>
            <Icon d={ic.text} size={14} /><span className="desktop-only" style={{ marginLeft:5 }}>Notes</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowExport(true)}>
            <Icon d={ic.reports} size={14} /><span className="desktop-only" style={{ marginLeft:5 }}>Add to Report</span>
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            <Icon d={ic.check} size={14} /><span style={{ marginLeft:5 }}>Save</span>
          </button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div style={{ flex:1,display:"flex",overflow:"hidden" }}>

        {/* ── Left toolbar ── */}
        <div style={{ width:58,background:"var(--surface)",borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 0",gap:2,flexShrink:0,overflowY:"auto" }}>
          {SKETCH_TOOLS.map(t => (
            <button key={t.id} title={t.label} onClick={()=>setTool(t.id)}
              style={{ width:46,height:46,borderRadius:10,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                background: tool===t.id ? "var(--accent)" : "transparent",
                color: tool===t.id ? "white" : "var(--text2)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d={t.icon} />
              </svg>
            </button>
          ))}

          <div style={{ width:36,height:1,background:"var(--border)",margin:"8px 0" }} />

          {/* Stroke width — big touch targets */}
          {[1,3,5,9].map(w => (
            <button key={w} title={`Stroke ${w}`} onClick={()=>setStrokeW(w)}
              style={{ width:46,height:44,borderRadius:10,border:strokeW===w?"2px solid var(--accent)":"2px solid transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                background: strokeW===w ? "var(--surface3)" : "transparent" }}>
              <div style={{ width:24,height:Math.min(w+1,10),borderRadius:w,background: strokeW===w ? "var(--accent)" : "var(--text2)" }} />
            </button>
          ))}

          <div style={{ width:36,height:1,background:"var(--border)",margin:"8px 0" }} />

          {/* Font size — only when text tool */}
          {tool === "text" && (<>
            <div style={{ fontSize:8,color:"var(--text3)",textAlign:"center",letterSpacing:".04em",marginBottom:2 }}>SIZE</div>
            {[10,14,18,24,32].map(fs => (
              <button key={fs} title={`Font ${fs}px`} onClick={()=>setFontSize(fs)}
                style={{ width:46,height:36,borderRadius:8,border:fontSize===fs?"2px solid var(--accent)":"2px solid transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                  background: fontSize===fs ? "var(--surface3)" : "transparent",
                  color: fontSize===fs ? "var(--accent)" : "var(--text2)",
                  fontSize: Math.max(9, Math.min(fs*0.65, 18)), fontWeight:700 }}>
                {fs}
              </button>
            ))}
            <div style={{ width:36,height:1,background:"var(--border)",margin:"8px 0" }} />
          </>)}

          {/* Color swatches */}
          {STROKE_COLORS.map(c => (
            <button key={c} title={c} onClick={()=>setColor(c)}
              style={{ width:46,height:40,borderRadius:10,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <div style={{ width:22,height:22,borderRadius:"50%",background:c,
                outline: color===c ? "2px solid var(--accent)" : "1.5px solid rgba(255,255,255,0.15)",
                outlineOffset:2,
                boxShadow: c==="#ffffff"||c==="#000000" ? "inset 0 0 0 1px rgba(128,128,128,0.35)" : "none"
              }} />
            </button>
          ))}

          <div style={{ width:36,height:1,background:"var(--border)",margin:"8px 0" }} />

          {/* Grid toggle */}
          <button title="Toggle Grid" onClick={()=>setShowGrid(!showGrid)}
            style={{ width:46,height:46,borderRadius:10,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
              background: showGrid ? "var(--surface3)" : "transparent",
              color: showGrid ? "var(--accent)" : "var(--text3)" }}>
            <Icon d={ic.grid} size={18} />
          </button>

          <div style={{ height:14 }} />

          {/* Clear */}
          <button title="Clear All" onClick={clearAll}
            style={{ width:46,height:46,borderRadius:10,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text3)" }}>
            <Icon d={ic.trash} size={18} />
          </button>
        </div>

        {/* ── Canvas area ── */}
        <div ref={containerRef} style={{ flex:1,overflow:"hidden",background:"#1a1e28",position:"relative" }}>
          {/* Zoom + pan transform wrapper */}
          <div style={{
            position:"absolute", inset:0, overflow:"hidden",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <div style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: tool === "pan" ? "none" : "transform 0.05s",
              position:"relative",
              width:CANVAS_W, height:CANVAS_H,
              flexShrink:0,
              boxShadow:"0 8px 40px rgba(0,0,0,.5)",
              borderRadius:4,
              overflow:"hidden",
            }}>
              <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{ position:"absolute",top:0,left:0,width:"100%",height:"100%" }} />
              <canvas ref={overlayRef} width={CANVAS_W} height={CANVAS_H} style={canvasStyle}
                onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
                onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
                onClick={onCanvasClick} />
              {/* Text input overlay */}
              {editingText && (
                <div style={{ position:"absolute", left:editingText.x/CANVAS_W*100+"%", top:editingText.y/CANVAS_H*100+"%", zIndex:10 }}>
                  <textarea ref={textInputRef} value={tempText} onChange={e=>setTempText(e.target.value)}
                    onBlur={commitText}
                    onKeyDown={e=>{ if(e.key==="Escape"){ setEditingText(null); setTempText(""); } if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); commitText(); } }}
                    rows={2}
                    style={{ background:"rgba(255,255,255,.95)",color:"#1a1e28",border:"2px solid var(--accent)",borderRadius:4,padding:"4px 8px",fontSize:fontSize,fontFamily:"Inter,sans-serif",outline:"none",minWidth:120,resize:"both" }} />
                </div>
              )}
            </div>
          </div>

          {/* ── Undo/Redo overlay — top-right, mobile only ── */}
          <div className="mobile-only" style={{ position:"absolute",top:12,right:12,display:"flex",flexDirection:"row",gap:4,zIndex:20 }}>
            <button onClick={undo} title="Undo"
              style={{ width:40,height:40,borderRadius:10,background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 12px rgba(0,0,0,.4)" }}>
              <Icon d={ic.undo} size={16} />
            </button>
            <button onClick={redo} title="Redo"
              style={{ width:40,height:40,borderRadius:10,background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 12px rgba(0,0,0,.4)",transform:"scaleX(-1)" }}>
              <Icon d={ic.undo} size={16} />
            </button>
          </div>

          {/* ── Zoom controls overlay — bottom-right, horizontal ── */}
          <div style={{ position:"absolute",bottom:12,right:12,display:"flex",flexDirection:"row",alignItems:"center",gap:4,zIndex:20 }}>
            <button onClick={zoomOut} title="Zoom Out"
              style={{ width:40,height:40,borderRadius:10,background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text)",cursor:"pointer",fontSize:20,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 12px rgba(0,0,0,.4)" }}>−</button>
            <button onClick={zoomReset} title={`${Math.round(zoom*100)}% — Click to reset`}
              style={{ height:40,padding:"0 8px",minWidth:44,borderRadius:8,background:"var(--surface2)",border:"1px solid var(--border)",color:"var(--text2)",cursor:"pointer",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center" }}>
              {Math.round(zoom*100)}%
            </button>
            <button onClick={zoomIn} title="Zoom In"
              style={{ width:40,height:40,borderRadius:10,background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text)",cursor:"pointer",fontSize:20,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 12px rgba(0,0,0,.4)" }}>+</button>
          </div>
        </div>

        {/* ── Notes panel — side panel on desktop, bottom sheet on mobile ── */}
        {showNotes && (
          <>
            {/* Mobile bottom sheet backdrop */}
            <div className="mobile-only" onClick={() => setShowNotes(false)}
              style={{ position:"fixed",inset:0,zIndex:299,background:"rgba(0,0,0,.5)" }} />

            {/* Panel */}
            <div style={{
              // desktop: right side panel
              // mobile: fixed bottom sheet
              zIndex:300,
              background:"var(--surface)",
              display:"flex", flexDirection:"column",
              gap:12, overflowY:"auto",
            }}
              className="sketch-notes-panel">
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
                <div style={{ fontWeight:700,fontSize:13 }}>Sketch Details</div>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowNotes(false)}>
                  <Icon d={ic.close} size={16} />
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Sketch Title</label>
                <input className="form-input" style={{ fontSize:13 }} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Living Room Floor Plan" />
              </div>

              <div className="form-group">
                <label className="form-label">Room / Area</label>
                <select className="form-input form-select" style={{ fontSize:12.5 }} value={roomTag} onChange={e=>setRoomTag(e.target.value)}>
                  <option value="">— None —</option>
                  {(rooms||[]).map(r=><option key={r.id} value={r.name}>{r.icon} {r.name}</option>)}
                  <option value="General">General</option>
                  <option value="Exterior">Exterior</option>
                  <option value="Floor Plan">Floor Plan</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Scale</label>
                <select className="form-input form-select" style={{ fontSize:12.5 }} value={scale} onChange={e=>setScale(e.target.value)}>
                  {["1 sq = 1 ft","1 sq = 2 ft","1 sq = 4 ft","1 sq = 6 in","No scale"].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={5} value={notes} onChange={e=>setNotes(e.target.value)}
                  placeholder="Add site notes, observations, moisture readings..." style={{ fontSize:12.5,resize:"vertical" }} />
              </div>

              {/* Moisture legend */}
              <div>
                <div style={{ fontSize:11.5,fontWeight:600,color:"var(--text2)",marginBottom:6 }}>Moisture Legend</div>
                {MOISTURE_COLORS.map(mc=>(
                  <div key={mc.id} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:5 }}>
                    <div style={{ width:14,height:14,borderRadius:3,background:mc.color,flexShrink:0 }} />
                    <span style={{ fontSize:12,color:"var(--text2)" }}>{mc.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Bottom info bar ── */}
      <div style={{ height:36,background:"var(--surface)",borderTop:"1px solid var(--border)",display:"flex",alignItems:"center",padding:"0 14px",gap:16,flexShrink:0 }}>
        <span style={{ fontSize:11.5,color:"var(--text3)" }}>Tool: <b style={{ color:"var(--text2)" }}>{SKETCH_TOOLS.find(t=>t.id===tool)?.label}</b></span>
        <span style={{ fontSize:11.5,color:"var(--text3)" }}>Scale: <b style={{ color:"var(--text2)" }}>{scale}</b></span>
        {roomTag && <span style={{ fontSize:11.5,color:"var(--text3)" }}>Room: <b style={{ color:"var(--text2)" }}>{roomTag}</b></span>}
        {selectedEl && tool === "select" && (
          <button className="btn btn-ghost btn-sm" style={{ color:"#e85a3a",fontSize:11.5,height:24,padding:"0 8px" }}
            onClick={() => { pushHistory(elements.filter(el => el.id !== selectedEl)); setSelectedEl(null); }}>
            <Icon d={ic.trash} size={12} /> Delete selected
          </button>
        )}
        <span style={{ fontSize:11.5,color:"var(--text3)",marginLeft:"auto" }}>{elements.length} element{elements.length!==1?"s":""}</span>
      </div>

      {/* ── Add to Report modal ── */}
      {showExport && (
        <div style={{ position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
          <div style={{ background:"var(--surface)",borderRadius:16,padding:24,width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,.5)" }}>
            <div style={{ fontWeight:700,fontSize:16,marginBottom:4 }}>Add to Report</div>
            <div style={{ fontSize:13,color:"var(--text2)",marginBottom:18 }}>Add this sketch as an image block in a report.</div>
            {activeReports.length === 0 ? (
              <div style={{ fontSize:13,color:"var(--text3)",marginBottom:16 }}>No reports found for this project. Create a report first.</div>
            ) : (
              <div className="form-group" style={{ marginBottom:16 }}>
                <label className="form-label">Select Report</label>
                <select className="form-input form-select" value={selReport} onChange={e=>setSelReport(e.target.value)}>
                  <option value="">— Choose a report —</option>
                  {activeReports.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              </div>
            )}
            <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowExport(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleAddToReport} disabled={!selReport}>
                <Icon d={ic.check} size={14} /> Add to Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Project Detail (tabs: Overview, Photos, Rooms, Reports, Checklists) ────────
function ProjectDetail({ project, teamUsers = [], onBack, onEdit, onOpenCamera, onEditPhoto, onUpdateProject, onOpenReportCreator, settings }) {
  const [tab, setTab] = useState("overview");
  const [editingSketch, setEditingSketch] = useState(null); // null=list, "new"=new, sketch obj=edit
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
    { id:"overview",   label:"Overview",                                          icon:ic.activity },
    { id:"photos",     label:`Photos (${project.photos?.length||0})`,             icon:ic.camera   },
    { id:"videos",     label:`Videos (${project.videos?.length||0})`,             icon:ic.video    },
    { id:"rooms",      label:`Rooms (${project.rooms?.length||0})`,               icon:ic.rooms    },
    { id:"sketches",   label:`Sketches (${project.sketches?.length||0})`,         icon:ic.sketch   },
    { id:"reports",    label:`Reports (${project.reports?.length||0})`,           icon:ic.reports,  desktopOnly:true },
    { id:"checklists", label:`Checklists (${project.checklists?.length||0})`,     icon:ic.check    },
  ];

  return (
    <div className="page fade-in">
      {/* Project hero */}
      <div className="project-hero">
        <div className="project-hero-bar" style={{ background:project.color }} />
        <div className="project-hero-body">
          <div className="proj-hero-header" style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12 }}>
            <div className="proj-hero-text" style={{ flex:1,minWidth:0 }}>
              <div className="project-hero-title">{project.title}</div>
              <div className="project-hero-addr">
                <Icon d={ic.mapPin} size={14} stroke="var(--text3)" />
                {[project.address, project.city, project.state, project.zip].filter(Boolean).length > 0 ? (() => {
                  const addr = [project.address, project.city, project.state, project.zip].filter(Boolean).join(", ");
                  const encoded = encodeURIComponent(addr);
                  const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
                  const mapsUrl = isApple ? `maps://maps.apple.com/?q=${encoded}` : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
                  return <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ color:"var(--text2)",textDecoration:"none" }} onMouseEnter={e=>e.currentTarget.style.color="var(--accent)"} onMouseLeave={e=>e.currentTarget.style.color="var(--text2)"}>{addr}</a>;
                })() : "—"}
              </div>
            </div>
            <div className="proj-hero-btns" style={{ display:"flex",gap:8,alignItems:"center",flexShrink:0 }}>
              <span className={`tag tag-${sm.cls}`}>{sm.label}</span>
              <button className="btn btn-sm btn-secondary" onClick={() => onEdit(project)}><Icon d={ic.edit} size={14} /> Edit</button>
              <button className="btn btn-sm btn-primary" onClick={() => onOpenCamera(project)}><Icon d={ic.camera} size={14} /> Camera</button>
            </div>
          </div>

          <div className="project-info-grid" style={{ marginTop:16 }}>
            <div className="project-info-box">
              <div className="project-info-label"><Icon d={ic.user} size={11} /> Client</div>
              <div className="project-info-value">{project.clientName || "—"}</div>
              {project.clientPhone && <div className="project-info-sub"><a href={`tel:${project.clientPhone.replace(/\D/g,"")}`} style={{ color:"var(--text2)",textDecoration:"none" }} onMouseEnter={e=>e.currentTarget.style.color="var(--accent)"} onMouseLeave={e=>e.currentTarget.style.color="var(--text2)"}>{project.clientPhone}</a></div>}
              {project.clientEmail && <div className="project-info-sub">{project.clientEmail}</div>}
            </div>
            <div className="project-info-box">
              <div className="project-info-label"><Icon d={ic.building} size={11} /> Contractor</div>
              <div className="project-info-value">{project.contractorName || "—"}</div>
              {project.contractorPhone && <div className="project-info-sub"><a href={`tel:${project.contractorPhone.replace(/\D/g,"")}`} style={{ color:"var(--text2)",textDecoration:"none" }} onMouseEnter={e=>e.currentTarget.style.color="var(--accent)"} onMouseLeave={e=>e.currentTarget.style.color="var(--text2)"}>{project.contractorPhone}</a></div>}
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

          {/* ── Assigned team members strip ── */}
          {(() => {
            const assigned = (project.assignedUserIds||[])
              .map(id => teamUsers.find(u => u.id === id))
              .filter(Boolean);
            const adminTagged = (settings?.userAssignedProjects||[]).includes(project.id);
            if (!adminTagged && assigned.length === 0) return null;

            const adminInitials = `${settings?.userFirstName?.[0]||"A"}${settings?.userLastName?.[0]||""}`.toUpperCase();
            const adminCerts = settings?.userCertifications || [];
            const adminHasCertAlert = adminCerts.some(c => ["expired","expiring-soon","expiring-warning"].includes(getCertStatus(c.dateExpires)));
            const adminColor = ROLE_META.admin.color;

            return (
              <div style={{ marginTop:14,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" }}>
                <span style={{ fontSize:10.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",flexShrink:0 }}>
                  Team
                </span>
                <div style={{ display:"flex",flexWrap:"wrap",gap:7,flex:1 }}>
                  {/* Admin pill (when tagged) */}
                  {adminTagged && (
                    <div style={{ display:"flex",alignItems:"center",gap:7,padding:"5px 10px 5px 6px",background:"var(--surface)",borderRadius:20,border:"1px solid var(--border)",transition:"border-color .15s" }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=adminColor}
                      onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                      <div style={{ width:26,height:26,borderRadius:"50%",background:adminColor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"white",flexShrink:0,position:"relative",overflow:"hidden" }}>
                        {settings?.userAvatar
                          ? <img src={settings.userAvatar} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                          : adminInitials
                        }
                        {adminHasCertAlert && (
                          <span style={{ position:"absolute",top:-2,right:-2,width:8,height:8,borderRadius:"50%",background:"#e85a3a",border:"1.5px solid var(--surface)" }} />
                        )}
                      </div>
                      <div style={{ lineHeight:1.2 }}>
                        <div style={{ fontSize:12,fontWeight:700,whiteSpace:"nowrap" }}>{settings?.userFirstName} {settings?.userLastName}</div>
                        <div style={{ fontSize:10,color:adminColor,fontWeight:700 }}>Admin</div>
                      </div>
                    </div>
                  )}
                  {/* Regular team member pills */}
                  {assigned.map(u => {
                    const m = ROLE_META[u.role] || ROLE_META.user;
                    const initials = `${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase();
                    const hasCertAlert = (u.certifications||[]).some(c => ["expired","expiring-soon","expiring-warning"].includes(getCertStatus(c.dateExpires)));
                    return (
                      <div key={u.id} style={{ display:"flex",alignItems:"center",gap:7,padding:"5px 10px 5px 6px",background:"var(--surface)",borderRadius:20,border:"1px solid var(--border)",transition:"border-color .15s" }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=m.color}
                        onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                        <div style={{ width:26,height:26,borderRadius:"50%",background:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"white",flexShrink:0,position:"relative" }}>
                          {initials}
                          {hasCertAlert && (
                            <span style={{ position:"absolute",top:-2,right:-2,width:8,height:8,borderRadius:"50%",background:"#e85a3a",border:"1.5px solid var(--surface)" }} />
                          )}
                        </div>
                        <div style={{ lineHeight:1.2 }}>
                          <div style={{ fontSize:12,fontWeight:700,whiteSpace:"nowrap" }}>{u.firstName} {u.lastName}</div>
                          <div style={{ fontSize:10,color:m.color,fontWeight:700 }}>{m.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ display:"flex",gap:4,marginBottom:20,borderBottom:"1px solid var(--border)",paddingBottom:0 }}>
        {TABS.map(t => (
          <button key={t.id} className={`btn btn-ghost btn-sm tab-item${t.desktopOnly?" desktop-only":""}`} style={{ borderBottom:`2px solid ${tab===t.id?"var(--accent)":"transparent"}`,borderRadius:0,paddingBottom:12,color:tab===t.id?"var(--accent)":"var(--text2)",fontWeight:tab===t.id?700:500 }}
            onClick={() => setTab(t.id)}>
            <Icon d={t.icon} size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {/* Timeline card */}
          {(() => {
            const TL_STAGES = [
              { id:"lead",        label:"Lead",        icon:"📋" },
              { id:"assessment",  label:"Assessment",  icon:"🔍" },
              { id:"approved",    label:"Approved",    icon:"✅" },
              { id:"in_progress", label:"In Progress", icon:"🔨" },
              { id:"final_walk",  label:"Final Walk",  icon:"🚶" },
              { id:"invoiced",    label:"Invoiced",    icon:"🧾" },
              { id:"completed",   label:"Completed",   icon:"🏁" },
            ];
            const aIdx = TL_STAGES.findIndex(s => s.id === project.timelineStage);
            const activeStage = TL_STAGES.find(s => s.id === project.timelineStage);
            const stageNote = project.timelineNotes?.[project.timelineStage];
            return (
              <div className="card">
                <div className="card-header" style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontWeight:700 }}>Project Timeline</span>
                  {activeStage
                    ? <span style={{ fontSize:11.5, fontWeight:600, color:"var(--accent)", background:"var(--accent-glow)", padding:"3px 10px", borderRadius:20 }}>{activeStage.icon} {activeStage.label}</span>
                    : <span style={{ fontSize:11.5, color:"var(--text3)" }}>No stage set — click to update</span>
                  }
                </div>
                <div className="card-body" style={{ padding:"14px 20px 18px" }}>
                  <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch", scrollbarWidth:"none" }}>
                  <div style={{ position:"relative", minWidth:480 }}>
                    <div style={{ position:"absolute", top:17, left:"3.5%", right:"3.5%", height:2, background:"var(--border)", zIndex:0 }} />
                    {aIdx > 0 && <div style={{ position:"absolute", top:17, left:"3.5%", width:`${(aIdx/(TL_STAGES.length-1))*93}%`, height:2, background:"var(--accent)", zIndex:1, transition:"width .4s" }} />}
                    <div style={{ display:"flex", justifyContent:"space-between", position:"relative", zIndex:2 }}>
                      {TL_STAGES.map((stage, i) => {
                        const isDone   = aIdx >= 0 && i < aIdx;
                        const isActive = project.timelineStage === stage.id;
                        return (
                          <div key={stage.id} onClick={() => onUpdateProject({ ...project, timelineStage: isActive ? "" : stage.id })}
                            style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, cursor:"pointer", flex:1 }}>
                            <div style={{ width:34, height:34, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14,
                              border:`2px solid ${isActive||isDone ? "var(--accent)" : "var(--border)"}`,
                              background: isActive ? "var(--accent)" : isDone ? "var(--accent-glow)" : "var(--surface)",
                              boxShadow: isActive ? "0 0 0 4px var(--accent-glow)" : "none", transition:"all .2s" }}>
                              {isDone ? <Icon d={ic.check} size={13} stroke="var(--accent)" /> : <span style={{ filter:isActive?"brightness(10)":"none" }}>{stage.icon}</span>}
                            </div>
                            <span style={{ fontSize:10, fontWeight:isActive?700:500, color:isActive?"var(--accent)":isDone?"var(--text2)":"var(--text3)", textAlign:"center", lineHeight:1.2, whiteSpace:"nowrap" }}>
                              {stage.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  </div>
                  {stageNote && (
                    <div style={{ marginTop:12, padding:"8px 12px", background:"var(--surface2)", borderRadius:"var(--radius-sm)", borderLeft:"3px solid var(--accent)", fontSize:12.5, color:"var(--text2)", lineHeight:1.5 }}>
                      {stageNote}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

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
                  <button className="btn btn-primary" style={{ display:"flex",justifyContent:"center",alignItems:"center",gap:7,width:"100%" }} onClick={() => onOpenCamera(project)}><Icon d={ic.camera} size={15} /> Open Live Camera</button>
                  <button className="btn btn-secondary" style={{ display:"flex",justifyContent:"center",alignItems:"center",gap:7,width:"100%" }} onClick={() => { fileRef.current?.click(); }}><Icon d={ic.image} size={15} /> Upload Photos</button>
                  <button className="btn btn-secondary desktop-only" style={{ display:"flex",justifyContent:"center",alignItems:"center",gap:7,width:"100%" }} onClick={() => setTab("reports")}><Icon d={ic.reports} size={15} /> Create Report</button>
                  <button className="btn btn-secondary" style={{ display:"flex",justifyContent:"center",alignItems:"center",gap:7,width:"100%" }} onClick={() => onEdit(project)}><Icon d={ic.edit} size={15} /> Edit Project Info</button>
                </div>
                <input ref={fileRef} type="file" multiple accept="image/*" style={{ display:"none" }} onChange={e => addUploadedPhotos(e.target.files)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photos tab */}
      {tab === "photos" && (
        <PhotosTab
          project={project}
          onUpdateProject={onUpdateProject}
          onEditPhoto={onEditPhoto}
          onOpenCamera={onOpenCamera}
          fileRef={fileRef}
          addUploadedPhotos={addUploadedPhotos}
        />
      )}

      {/* Videos tab */}
      {tab === "videos" && (
        <VideosTab
          project={project}
          onUpdateProject={onUpdateProject}
          onOpenCamera={onOpenCamera}
        />
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
        <ReportsTab
          project={project}
          onUpdateProject={onUpdateProject}
          onOpenReportCreator={onOpenReportCreator}
          settings={settings}
        />
      )}
      {tab === "sketches" && (
        <SketchesTab
          project={project}
          onUpdateProject={onUpdateProject}
          onNewSketch={() => setEditingSketch("new")}
          onEditSketch={sk => setEditingSketch(sk)}
        />
      )}
      {tab === "checklists" && (
        <ChecklistsTab project={project} onUpdateProject={onUpdateProject} />
      )}
      {editingSketch !== null && (
        <SketchEditor
          sketch={editingSketch === "new" ? null : editingSketch}
          rooms={project.rooms}
          reports={project.reports}
          onSave={(savedSketch, reportId) => {
            const existing = project.sketches || [];
            const updated  = existing.some(s => s.id === savedSketch.id)
              ? existing.map(s => s.id === savedSketch.id ? savedSketch : s)
              : [...existing, savedSketch];
            let updatedProj = { ...project, sketches: updated };
            // optionally attach to report as an image block
            if (reportId) {
              updatedProj = {
                ...updatedProj,
                reports: (updatedProj.reports||[]).map(r =>
                  r.id === reportId
                    ? { ...r, blocks: [...(r.blocks||[]), { id:uid(), type:"sketch", dataUrl:savedSketch.dataUrl, caption:savedSketch.title, sketchId:savedSketch.id }] }
                    : r
                )
              };
            }
            onUpdateProject(updatedProj);
            setEditingSketch(null);
            if (!reportId) setEditingSketch(null);
          }}
          onClose={() => setEditingSketch(null)}
        />
      )}
    </div>
  );
}

// ── Sketches Tab ───────────────────────────────────────────────────────────────
function SketchesTab({ project, onUpdateProject, onNewSketch, onEditSketch }) {
  const sketches = project.sketches || [];

  const deleteSketch = (id) => {
    if (!window.confirm("Delete this sketch?")) return;
    onUpdateProject({ ...project, sketches: sketches.filter(s => s.id !== id) });
  };

  if (sketches.length === 0) return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 24px",gap:16,textAlign:"center" }}>
      <div style={{ width:64,height:64,borderRadius:16,background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center" }}>
        <Icon d={ic.sketch} size={28} stroke="var(--text3)" />
      </div>
      <div style={{ fontSize:16,fontWeight:700 }}>No sketches yet</div>
      <div style={{ fontSize:13.5,color:"var(--text2)",maxWidth:280 }}>Create room layouts, floor plans, and moisture maps. Add dimensions and notes.</div>
      <button className="btn btn-primary" onClick={onNewSketch}><Icon d={ic.plus} size={15} /> New Sketch</button>
    </div>
  );

  return (
    <div style={{ padding:"16px 0" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px 14px" }}>
        <div style={{ fontWeight:700,fontSize:14 }}>Sketches ({sketches.length})</div>
        <button className="btn btn-primary btn-sm" onClick={onNewSketch}><Icon d={ic.plus} size={13} /> New Sketch</button>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:14,padding:"0 16px" }}>
        {sketches.map(sk => (
          <div key={sk.id} style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden",cursor:"pointer" }}
            onClick={() => onEditSketch(sk)}>
            <div style={{ aspectRatio:"4/3",background:"var(--surface2)",overflow:"hidden",position:"relative" }}>
              {sk.dataUrl
                ? <img src={sk.dataUrl} alt={sk.title} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                : <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={ic.sketch} size={32} stroke="var(--text3)" /></div>
              }
              {sk.roomTag && (
                <div style={{ position:"absolute",top:8,left:8,background:"rgba(0,0,0,.6)",color:"white",fontSize:10.5,padding:"2px 8px",borderRadius:20,backdropFilter:"blur(4px)" }}>
                  {sk.roomTag}
                </div>
              )}
            </div>
            <div style={{ padding:"10px 12px 12px" }}>
              <div style={{ fontWeight:600,fontSize:13.5,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{sk.title}</div>
              <div style={{ fontSize:11.5,color:"var(--text3)",display:"flex",gap:8 }}>
                <span>{sk.date}</span>
                {sk.scale && <span>· {sk.scale}</span>}
              </div>
              {sk.notes && <div style={{ fontSize:11.5,color:"var(--text2)",marginTop:5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden" }}>{sk.notes}</div>}
              <div style={{ display:"flex",justifyContent:"flex-end",marginTop:8 }}>
                <button className="btn btn-ghost btn-sm btn-icon" title="Delete" onClick={e=>{e.stopPropagation();deleteSketch(sk.id);}}>
                  <Icon d={ic.trash} size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
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
  if (block.type === "signature") return 130;
  if (block.type === "sketch") return 400;
  if (block.type === "table") {
    const rows = (block.tableRows||[]).length;
    const titleH = block.tableTitle ? 22 : 0;
    const headingH = block.tableHeading ? 18 : 0;
    return 40 + titleH + headingH + rows * 28;
  }
  return 60;
}

function PageFooter({ accentColor, settings, reportDate, reportTime, pageNum, isLast }) {
  const dateStr = reportDate ? formatDate(reportDate, settings) : formatDate(new Date().toISOString().slice(0,10), settings);
  const timeStr = reportTime ? formatTime(reportTime, settings) : null;
  return (
    <>
      <div style={{ padding:"10px 36px",borderTop:`2px solid ${accentColor}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fafafa",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ fontSize:10,color:"#888" }}>{dateStr}</span>
          {timeStr && <span style={{ fontSize:10,color:"#aaa" }}>· {timeStr}</span>}
        </div>
        <span style={{ fontSize:10,color:accentColor,fontWeight:600 }}>{settings?.reportFooterCenter||"Confidential"}</span>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:9,color:"#bbb",letterSpacing:".06em" }}>POWERED BY KRAKEN CAM</div>
          <div style={{ fontSize:9.5,color:"#aaa" }}>Page {pageNum}</div>
        </div>
      </div>
      {isLast && settings?.reportFooterDisclaimer && (
        <div style={{ padding:"8px 36px",fontSize:9.5,color:"#bbb",lineHeight:1.6,background:"#fafafa",borderTop:"1px solid #eee",flexShrink:0 }}>{settings.reportFooterDisclaimer}</div>
      )}
    </>
  );
}

function BlockRenderer({ block, showGps, showTimestamp, showRooms, showTags, gridClass }) {
  if (block.type === "divider") return (
    <div style={{ padding:"14px 36px 8px" }}>
      <div style={{ fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"#444",display:"flex",alignItems:"center",gap:8 }}>
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
              <div style={{ position:"relative" }}>
                {ph.dataUrl ? <img src={ph.dataUrl} alt={ph.name} style={{ width:"100%",display:"block",aspectRatio:"4/3",objectFit:"cover" }} /> : <div style={{ aspectRatio:"4/3",background:"#eee" }} />}
                {showTimestamp && ph.date && (
                  <div style={{ position:"absolute",bottom:4,left:4,background:"rgba(0,0,0,.55)",color:"white",fontSize:7,padding:"2px 5px",borderRadius:3,fontFamily:"monospace",letterSpacing:".02em",pointerEvents:"none" }}>🕐 {ph.date}</div>
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
                  {showRooms && ph.room && <span>📍 {ph.room}{ph.floor ? ` · ${ph.floor}` : ""}</span>}
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
                <div style={{ position:"relative" }}>
                  <img src={block.photos[0].dataUrl} alt="" style={{ width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block" }} />
                  {showTimestamp && block.photos[0].date && (
                    <div style={{ position:"absolute",bottom:4,left:4,background:"rgba(0,0,0,.55)",color:"white",fontSize:7,padding:"2px 5px",borderRadius:3,fontFamily:"monospace",letterSpacing:".02em",pointerEvents:"none" }}>🕐 {block.photos[0].date}</div>
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
                    <span style={{ color:"#aaa",fontSize:8.5 }}>📍 {block.photos[0].room}{block.photos[0].floor ? ` · ${block.photos[0].floor}` : ""}</span>
                  )}
                </div>
              </div>
            : <div style={{ aspectRatio:"4/3",background:"#f0f0f0",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",color:"#ccc",fontSize:12 }}>No photo</div>
          }
        </div>
      </div>
    </div>
  );
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

function ReportPages({ title, reportType, reportDate, reportTime, accentColor, project, coverPhoto, blocks, settings, showCoverInfo, showGps, showTimestamp, showRooms, showTags, gridClass }) {
  const today = reportDate ? formatDate(reportDate, settings) : formatDate(new Date().toISOString().slice(0,10), settings);

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
              {project.powerStatus  && <InfoRow label="Power"  value={project.powerStatus==="on"?"⚡ On":"🔌 Off"} />}
              {project.waterStatus  && <InfoRow label="Water"  value={project.waterStatus==="on"?"💧 On":"🚱 Off"} />}
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
              <BlockRenderer key={block.id} block={block} showGps={showGps} showTimestamp={showTimestamp} showRooms={showRooms} showTags={showTags} gridClass={gridClass} />
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
function SignatureDrawModal({ onSave, onClose }) {
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
          <div className="modal-title">✍ Add Signature</div>
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22} /></button>
        </div>

        {/* Mode tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid var(--border)", padding:"0 24px" }}>
          {[["draw","✏ Draw by Hand"],["upload","📁 Upload Image"]].map(([id,label]) => (
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
  { id:"text",       label:"Text Block",        icon:ic.text      },
  { id:"table",      label:"Table",             icon:"M3 3h18v18H3V3z M3 9h18 M3 15h18 M9 3v18 M15 3v18" },
  { id:"photos",     label:"Photo Grid",        icon:ic.image     },
  { id:"textphoto",  label:"Text + Photo",      icon:ic.copy      },
  { id:"sketch",     label:"Sketch / Map",      icon:ic.sketch    },
  { id:"divider",    label:"Section Divider",   icon:ic.hash      },
  { id:"signature",  label:"Signature",         icon:"M12 19l7-7-7-7 M5 12h14" },
];

// ── AI Writer Modal ──────────────────────────────────────────────────────────
function AiWriterModal({ block, project, settings, onAccept, onClose }) {
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
    setLoading(true); setError("");
    const userMsg = prompt.trim()
      ? `Write the "${blockLabel}" section. Instructions: ${prompt}`
      : `Rewrite this text more professionally: ${result}`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: "user", content: userMsg }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const text = data.content?.filter(c=>c.type==="text").map(c=>c.text).join("") || "";
      setResult(text.trim());
      setPrompt("");
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
function AiWriterUpgradeModal({ onUpgrade, onClose, isAdmin, settings, users }) {
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
            {confirming ? "Confirm Upgrade" : "✦ FieldPro Feature"}
          </div>
          <div style={{ fontSize:13,color:"rgba(255,255,255,.82)",lineHeight:1.5 }}>
            {confirming
              ? "Review the charges below — AI Write unlocks the moment you confirm."
              : isAdmin
                ? "AI Report Writer is included in FieldPro — upgrade to unlock it and all future Pro features"
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
                      <div style={{ fontWeight:700,fontSize:13.5 }}>✦ FieldPro Plan</div>
                      <div style={{ fontSize:11.5,color:"var(--text2)" }}>Admin seat · +${PRICING.monthly.pro.user}/user/mo</div>
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
                      Upgrade to FieldPro
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
                          Your account is on FieldBase. Ask your admin to upgrade to FieldPro in <strong>Account → Billing</strong>. AI Write will unlock for your entire team immediately.
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
                  <span>FieldBase unused credit ({p.daysLeft} of {p.daysTotal} days left)</span>
                  <span style={{ color:"#3dba7e",fontWeight:700 }}>−${p.unusedCredit}</span>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr auto",padding:"9px 13px",borderBottom:"1px solid var(--border)",color:"var(--text2)" }}>
                  <span>FieldPro prorated charge ({p.daysLeft} days)</span>
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
                From <strong>{p.cycleEnd.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</strong> onwards: <strong>${p.toTotal}/mo</strong> · AI Write unlocks immediately for all team members.
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex:1 }} onClick={()=>setConfirming(false)}>← Back</button>
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

function ReportCreator({ project, reportData, settings, templates, users, onSave, onClose, onUpgradeAi, userRole }) {
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
  const [printing, setPrinting] = useState(false);
  const [aiWriterBlock, setAiWriterBlock] = useState(null);   // blockId being written
  const [showAiUpgrade, setShowAiUpgrade] = useState(false);
  const aiEnabled = settings?.plan === "pro";

  const accentColor = settings?.accent || "#e86c3a";

  // Apply template
  const applyTemplate = (tpl) => {
    if (!tpl) return;
    setSelectedTpl(tpl);
    const sectionBlocks = [];
    const sections = ["Cover Page","Property Information","Scope of Work","Report","Damage Summary","Photo Documentation","Sign Off"];
    sections.forEach(s => {
      if (s === "Cover Page") return; // handled separately
      if (s === "Photo Documentation") {
        sectionBlocks.push({ id:uid(), type:"divider", label:s });
        sectionBlocks.push({ id:uid(), type:"photos", photos:[], caption:"" });
      } else if (s === "Signature Block" || s === "Sign Off") {
        sectionBlocks.push({ id:uid(), type:"divider", label:s });
        sectionBlocks.push({ id:uid(), type:"text", content:`Prepared by: ${settings?.userFirstName||""} ${settings?.userLastName||""}\nTitle: ${settings?.userTitle||""}\nDate: ${formatDate(new Date().toISOString().slice(0,10), settings)}` });
        sectionBlocks.push({ id:uid(), type:"signature", label:"Authorized Signature", signatureImg:null, signerName:`${settings?.userFirstName||""} ${settings?.userLastName||""}`.trim(), signerTitle:settings?.userTitle||"", sigDate:formatDate(new Date().toISOString().slice(0,10), settings), signerCertCodes:defaultSignerCertCodes });
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
      label:  type==="divider" ? "Section" : type==="signature" ? "Authorized Signature" : undefined,
      caption: type==="photos"||type==="sketch" ? "" : undefined,
      dataUrl: type==="sketch" ? null : undefined,
      sketchTitle: type==="sketch" ? "Sketch / Map" : undefined,
      sideText: type==="textphoto" ? "Describe what's shown in this photo." : undefined,
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

  // When printing flips to true, React renders the print layer, then this effect fires window.print()
  useEffect(() => {
    if (!printing) return;
    const t = setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 300); // brief delay so React finishes painting
    return () => clearTimeout(t);
  }, [printing]);

  const _doPrint = () => setPrinting(true);

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
          <button className="btn btn-secondary btn-sm" onClick={handlePrintOrExport}><Icon d={ic.download} size={13} /> Export PDF</button>
          <button className="btn btn-secondary btn-sm btn-icon" title="Print" onClick={handlePrintOrExport}><Icon d={ic.printer} size={13} /></button>
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
                      <div style={{ fontSize:10.5,color:"#777" }}>{settings?.phone}{settings?.email?` · ${settings.email}`:""}</div>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontWeight:700,fontSize:14,color:"#111" }}>{settings?.reportHeaderTitle||"Property Report"}</div>
                    <div style={{ fontSize:10.5,color:"#777" }}>{reportType} · {reportDate ? formatDate(reportDate, settings) : formatDate(new Date().toISOString().slice(0,10), settings)}</div>
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
                      ["Power",              project.powerStatus  ? (project.powerStatus==="on"?"⚡ On":"🔌 Off") : null],
                      ["Water",              project.waterStatus  ? (project.waterStatus==="on"?"💧 On":"🚱 Off") : null],
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
          <div style={{ display:"flex",alignItems:"center",gap:3,padding:"3px 8px",background:"var(--surface2)",borderBottom:"1px solid var(--border)",borderTop:"1px solid var(--border)" }}>
            <div style={{ fontSize:11,color:"var(--text3)",marginRight:4,fontWeight:600 }}>Add at top:</div>
            {BLOCK_TYPES.map(bt=>(
              <button key={bt.id} className="btn btn-ghost btn-sm" title={`Add ${bt.label} at top`} style={{ gap:4,fontSize:11,padding:"2px 7px" }}
                onClick={e=>{e.stopPropagation();const nb={id:uid(),type:bt.id,content:bt.id==="text"?"":undefined,photos:bt.id==="photos"||bt.id==="textphoto"?[]:undefined,label:bt.id==="divider"?"Section":bt.id==="signature"?"Authorized Signature":undefined,sideText:bt.id==="textphoto"?"":undefined,signatureImg:bt.id==="signature"?null:undefined,signerName:bt.id==="signature"?(settings?.userFirstName||"")+" "+(settings?.userLastName||""):undefined,signerTitle:bt.id==="signature"?(settings?.userTitle||""):undefined,sigDate:bt.id==="signature"?formatDate(new Date().toISOString().slice(0,10),settings):undefined,signerCertCodes:bt.id==="signature"?defaultSignerCertCodes:undefined,caption:bt.id==="photos"||bt.id==="sketch"?"":undefined,dataUrl:bt.id==="sketch"?null:undefined,sketchTitle:bt.id==="sketch"?"Sketch / Map":undefined};setBlocks(prev=>[nb,...prev]);setEditingBlock(nb.id);}}>
                <Icon d={bt.icon} size={12} />{bt.label}
              </button>
            ))}
          </div>

          {/* Content blocks */}
          {blocks.map((block, idx) => (
            <div key={block.id} className="rc-section-wrap">
              <div className="rp" style={{ minHeight:"auto",borderBottom:"1px solid #eee",marginBottom:0 }}>

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
                      : <div style={{ position:"relative" }}>
                          <div className="rp-text-block" style={{ cursor:"text",minHeight:40,padding:"2px 0",paddingRight:80 }}
                            onClick={()=>{ updateBlock(block.id,{content: block.content===("Enter text here...")||block.content===("Enter your report summary here. Describe the property, the purpose of this report, and any key findings.") ? "" : block.content}); setEditingBlock(block.id); }}>
                            {block.content || <span style={{ color:"#ccc" }}>Click to edit...</span>}
                          </div>
                          <button title="Write with AI" onClick={e=>{e.stopPropagation(); aiEnabled ? setAiWriterBlock(block.id) : setShowAiUpgrade(true);}}
                            style={{ position:"absolute",top:2,right:2,display:"flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:6,border:"1px solid #c084fc",background:"linear-gradient(135deg,#f3e8ff,#ede9fe)",color:"#7c3aed",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                            AI Write
                          </button>
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
                              <div style={{ position:"relative" }}>
                                {ph.dataUrl ? <img src={ph.dataUrl} alt={ph.name} /> : <div style={{ aspectRatio:"4/3",background:"#e8e8e8",display:"flex",alignItems:"center",justifyContent:"center",color:"#ccc" }}><Icon d={ic.image} size={28} stroke="#ccc" /></div>}
                                {showTimestamp && ph.date && (
                                  <div style={{ position:"absolute",bottom:4,left:4,background:"rgba(0,0,0,.55)",color:"white",fontSize:7.5,padding:"2px 5px",borderRadius:3,fontFamily:"monospace",letterSpacing:".02em",pointerEvents:"none" }}>🕐 {ph.date}</div>
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
                                  {showRooms && ph.room && <span>📍 {ph.room}{ph.floor ? ` · ${ph.floor}` : ""}</span>}
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
                          : <div className="rp-text-block" style={{ cursor:"text",minHeight:60 }}
                              onClick={()=>{ updateBlock(block.id,{sideText: block.sideText==="Describe what's shown in this photo."?"":block.sideText}); setEditingBlock(block.id); }}>
                              {block.sideText||<span style={{ color:"#ccc" }}>Click to edit text...</span>}
                            </div>
                        }
                      </div>
                      <div>
                        {(block.photos||[]).length > 0
                          ? <div className="rp-photo-item" style={{ cursor:"pointer" }} onClick={e=>{e.stopPropagation();openPhotoPicker(block.id);}}>
                              <div style={{ position:"relative" }}>
                                <img src={block.photos[0].dataUrl} alt={block.photos[0].name} />
                                {showTimestamp && block.photos[0].date && (
                                  <div style={{ position:"absolute",bottom:4,left:4,background:"rgba(0,0,0,.55)",color:"white",fontSize:7.5,padding:"2px 5px",borderRadius:3,fontFamily:"monospace",pointerEvents:"none" }}>🕐 {block.photos[0].date}</div>
                                )}
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
                                  {showRooms && block.photos[0].room && <span>📍 {block.photos[0].room}{block.photos[0].floor ? ` · ${block.photos[0].floor}` : ""}</span>}
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
                          ✍ {block.signatureImg ? "Replace" : "Add Signature"}
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
                                          style={{padding:"1px 3px",border:"none",borderRadius:3,background:"transparent",cursor:"pointer",color:"#e85a3a",fontSize:12,lineHeight:1}}>×</button>
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
                                          style={{border:"none",background:"transparent",cursor:"pointer",color:"#e85a3a",fontSize:14,lineHeight:1,padding:"0 2px"}}>×</button>
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
              <div style={{ display:"flex",alignItems:"center",gap:3,padding:"3px 8px",background:"var(--surface2)",borderBottom:"1px solid var(--border)" }}>
                <button className="btn btn-ghost btn-sm btn-icon" title="Move Up" onClick={e=>{e.stopPropagation();moveBlock(block.id,-1);}} style={{ opacity:idx===0?.3:1,padding:"2px 5px" }}><Icon d="M12 19V5 M5 12l7-7 7 7" size={13} /></button>
                <button className="btn btn-ghost btn-sm btn-icon" title="Move Down" onClick={e=>{e.stopPropagation();moveBlock(block.id,1);}} style={{ opacity:idx===blocks.length-1?.3:1,padding:"2px 5px" }}><Icon d="M12 5v14 M19 12l-7 7-7-7" size={13} /></button>
                <div style={{ width:1,height:14,background:"var(--border)",margin:"0 3px" }} />
                {BLOCK_TYPES.map(bt=>(
                  <button key={bt.id} className="btn btn-ghost btn-sm" title={`Add ${bt.label} after`} style={{ gap:4,fontSize:11,padding:"2px 7px" }}
                    onClick={e=>{e.stopPropagation();addBlock(bt.id,block.id);}}>
                    <Icon d={bt.icon} size={12} />{bt.label}
                  </button>
                ))}
                <div style={{ flex:1 }} />
                <button className="btn btn-ghost btn-sm btn-icon" title="Delete block" onClick={e=>{e.stopPropagation();deleteBlock(block.id);}} style={{ color:"#e85a3a",padding:"2px 5px" }}><Icon d={ic.trash} size={13} /></button>
              </div>
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
                  {reportTime && <span style={{ fontSize:10,color:"#aaa" }}>· {formatTime(reportTime, settings)}</span>}
                </div>
                <span style={{ color:accentColor,fontWeight:600 }}>{settings?.reportFooterCenter || "Confidential"}</span>
                <div style={{ textAlign:"right" }}>
                  <div className="rp-branding">POWERED BY KRAKEN CAM</div>
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
      <div className={printing ? "print-layer print-layer--active" : "print-layer"}>
        <ReportPages
          title={title} reportType={reportType} reportDate={reportDate} reportTime={reportTime} accentColor={accentColor}
          project={project} coverPhoto={coverPhoto} blocks={blocks}
          settings={settings} showCoverInfo={showCoverInfo}
          showGps={showGps} showTimestamp={showTimestamp} showRooms={showRooms} showTags={showTags}
          gridClass={gridClass}
        />
      </div>

      {/* ── Preview modal ── */}
      {previewOpen && (
        <div style={{ position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,.85)",display:"flex",flexDirection:"column",overflow:"hidden" }}>
          {/* Preview top bar */}
          <div style={{ height:52,background:"#0d1017",borderBottom:"1px solid #2a2f3e",display:"flex",alignItems:"center",padding:"0 20px",gap:12,flexShrink:0 }}>
            <div style={{ fontWeight:700,fontSize:14,color:"white",flex:1 }}>Print Preview — {title}</div>
            <div style={{ fontSize:12,color:"#666",background:"#1a1e28",padding:"4px 12px",borderRadius:20,border:"1px solid #2a2f3e" }}>8.5" × 11" · US Letter</div>
            <button className="btn btn-secondary btn-sm" onClick={()=>_doPrint()}><Icon d={ic.download} size={13} /> Export PDF</button>
            <button className="btn btn-secondary btn-sm btn-icon" title="Print" onClick={()=>_doPrint()}><Icon d={ic.printer} size={13} /></button>
            <button className="btn btn-ghost btn-sm" style={{ color:"white" }} onClick={()=>setPreviewOpen(false)}>
              <Icon d={ic.close} size={15} /> Close Preview
            </button>
          </div>

          {/* Preview scroll area */}
          <div style={{ flex:1,overflowY:"auto",padding:"32px 0",display:"flex",flexDirection:"column",alignItems:"center",gap:0,background:"#1a1e28" }}>
            <ReportPages
              title={title} reportType={reportType} reportDate={reportDate} reportTime={reportTime} accentColor={accentColor}
              project={project} coverPhoto={coverPhoto} blocks={blocks}
              settings={settings} showCoverInfo={showCoverInfo}
              showGps={showGps} showTimestamp={showTimestamp} showRooms={showRooms} showTags={showTags}
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

      {/* Signature draw/upload modal */}
      {showSigModal && (
        <SignatureDrawModal
          onSave={dataUrl => {
            if (signatureTargetId) updateBlock(signatureTargetId, { signatureImg: dataUrl });
          }}
          onClose={() => { setShowSigModal(false); setSignatureTargetId(null); }}
        />
      )}

      {/* AI Writer modal */}
      {aiWriterBlock && (
        <AiWriterModal
          block={blocks.find(b=>b.id===aiWriterBlock)}
          project={project}
          settings={settings}
          onAccept={text=>{ updateBlock(aiWriterBlock,{content:text}); setAiWriterBlock(null); }}
          onClose={()=>setAiWriterBlock(null)}
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

// ── TASKS PAGE ───────────────────────────────────────────────────────────────

const TASK_PRIORITIES = [
  { id:"critical", label:"Critical", color:"#e85a3a" },
  { id:"high",     label:"High",     color:"#e8703a" },
  { id:"medium",   label:"Medium",   color:"#e8c53a" },
  { id:"low",      label:"Low",      color:"#3dba7e" },
];

const DEFAULT_COLUMNS = [
  { id:"backlog",     label:"Backlog",      color:"#6b7280" },
  { id:"todo",        label:"To Do",        color:"#3ab8e8" },
  { id:"inprogress",  label:"In Progress",  color:"#8b7cf8" },
  { id:"review",      label:"In Review",    color:"#e8c53a" },
  { id:"done",        label:"Done",         color:"#3dba7e" },
];

const EMPTY_TASK = {
  id:"", title:"", description:"", priority:"medium", status:"todo",
  assigneeIds:[], projectId:"", dueDate:"", tags:[], checklist:[],
  createdBy:"admin", createdAt:"", comments:[],
};

function TaskModal({ task, projects, teamUsers, settings, onSave, onClose, onNotify }) {
  const isNew = !task?.id;
  const [form, setForm] = useState(isNew
    ? { ...EMPTY_TASK, id:uid(), createdAt:today() }
    : { ...task, checklist: task.checklist||[], comments: task.comments||[], tags: task.tags||[], assigneeIds: task.assigneeIds||[] }
  );
  const [tab, setTab]       = useState("details");
  const [newCheckItem, setNewCheckItem] = useState("");
  const [newComment, setNewComment]     = useState("");
  const [newTag, setNewTag]             = useState("");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const toggleAssignee = id => set("assigneeIds", form.assigneeIds.includes(id) ? form.assigneeIds.filter(x=>x!==id) : [...form.assigneeIds, id]);
  const addCheckItem = () => { if (!newCheckItem.trim()) return; set("checklist", [...form.checklist, { id:uid(), text:newCheckItem.trim(), done:false }]); setNewCheckItem(""); };
  const toggleCheck = id => set("checklist", form.checklist.map(c=>c.id===id?{...c,done:!c.done}:c));
  const removeCheck = id => set("checklist", form.checklist.filter(c=>c.id!==id));

  const addComment = (text) => {
    const t = (text || newComment).trim();
    if (!t) return;
    const authorName = `${settings.userFirstName} ${settings.userLastName}`.trim() || "Admin";
    const comment = { id:uid(), text:t, author:authorName, date:today() };
    set("comments", [...form.comments, comment]);
    setNewComment("");
    // Fire notifications for every @mention found
    if (onNotify) {
      const mentions = t.match(/@(\S+)/g) || [];
      const authorInitials = authorName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
      const authorColor = ROLE_META.admin?.color || "var(--accent)";
      mentions.forEach(mention => {
        onNotify({
          id: uid(),
          author: authorName,
          authorInitials,
          authorColor,
          action: "mentioned",
          context: form.title || "a task",
          preview: t,
          mention,
          date: today(),
          read: false,
        });
      });
    }
  };

  const addTag = () => { if (!newTag.trim() || form.tags.includes(newTag.trim())) return; set("tags", [...form.tags, newTag.trim()]); setNewTag(""); };

  const assignableAll = [
    { id:"__admin__", firstName:settings.userFirstName||"Admin", lastName:settings.userLastName||"", role:"admin" },
    ...teamUsers.filter(u=>u.status==="active"),
  ];

  const pri = TASK_PRIORITIES.find(p=>p.id===form.priority)||TASK_PRIORITIES[2];

  const TABS = [
    { id:"details",   label:"Details"   },
    { id:"checklist", label:`Checklist${form.checklist.length?` (${form.checklist.length})`:""}` },
    { id:"comments",  label:`Comments${form.comments.length?` (${form.comments.length})`:""}` },
  ];

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-lg fade-in" style={{ maxWidth:640 }}>
        <div className="modal-header">
          <div style={{ display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0 }}>
            <div style={{ width:10,height:10,borderRadius:"50%",background:pri.color,flexShrink:0 }} />
            <div className="modal-title" style={{ margin:0 }}>{isNew?"New Task":form.title||"Edit Task"}</div>
          </div>
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22}/></button>
        </div>

        <div style={{ display:"flex",gap:2,borderBottom:"1px solid var(--border)",padding:"0 24px" }}>
          {TABS.map(t=>(
            <button key={t.id} className="btn btn-ghost btn-sm" onClick={()=>setTab(t.id)}
              style={{ borderBottom:`2px solid ${tab===t.id?"var(--accent)":"transparent"}`,borderRadius:0,paddingBottom:10,fontSize:12.5,color:tab===t.id?"var(--accent)":"var(--text2)",fontWeight:tab===t.id?700:500 }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ maxHeight:500,overflowY:"auto" }}>

          {tab==="details" && (
            <div>
              <div className="form-group">
                <label className="form-label">Task Title *</label>
                <input className="form-input" value={form.title} onChange={e=>set("title",e.target.value)} placeholder="What needs to be done?" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input form-textarea" value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Add more detail, context, or instructions…" style={{ minHeight:80 }} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <div style={{ display:"flex",gap:6 }}>
                    {TASK_PRIORITIES.map(p=>(
                      <div key={p.id} onClick={()=>set("priority",p.id)}
                        style={{ flex:1,padding:"7px 4px",borderRadius:"var(--radius-sm)",border:`2px solid ${form.priority===p.id?p.color:"var(--border)"}`,background:form.priority===p.id?`${p.color}15`:"var(--surface2)",cursor:"pointer",textAlign:"center",transition:"all .15s" }}>
                        <div style={{ width:8,height:8,borderRadius:"50%",background:p.color,margin:"0 auto 4px" }} />
                        <div style={{ fontSize:11,fontWeight:700,color:form.priority===p.id?p.color:"var(--text2)" }}>{p.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input form-select" value={form.status} onChange={e=>set("status",e.target.value)}>
                    {DEFAULT_COLUMNS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <div className="date-input-wrap">
                    <input className="form-input" type="date" value={form.dueDate} onChange={e=>set("dueDate",e.target.value)} />
                    <span className="date-icon"><Icon d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" size={18} stroke="var(--accent)" strokeWidth={2}/></span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Linked Project</label>
                  <select className="form-input form-select" value={form.projectId} onChange={e=>set("projectId",e.target.value)}>
                    <option value="">— None —</option>
                    {projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
              </div>

              {/* Assignees */}
              <div className="form-group">
                <label className="form-label">Assign To</label>
                <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
                  {assignableAll.map(u=>{
                    const sel = form.assigneeIds.includes(u.id);
                    const meta = ROLE_META[u.role]||ROLE_META.user;
                    return (
                      <div key={u.id} onClick={()=>toggleAssignee(u.id)}
                        style={{ display:"flex",alignItems:"center",gap:7,padding:"5px 10px",borderRadius:20,border:`1.5px solid ${sel?meta.color:"var(--border)"}`,background:sel?`${meta.color}15`:"var(--surface2)",cursor:"pointer",transition:"all .15s" }}>
                        <div style={{ width:22,height:22,borderRadius:"50%",background:meta.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white",flexShrink:0 }}>
                          {`${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase()||"?"}
                        </div>
                        <span style={{ fontSize:12.5,fontWeight:sel?700:500,color:sel?meta.color:"var(--text)" }}>{u.firstName} {u.lastName}</span>
                        {sel && <Icon d={ic.check} size={12} stroke={meta.color} strokeWidth={2.5}/>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tags */}
              <div className="form-group">
                <label className="form-label">Tags</label>
                <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:8 }}>
                  {form.tags.map(t=>(
                    <span key={t} style={{ display:"flex",alignItems:"center",gap:4,fontSize:12,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:20,padding:"2px 10px" }}>
                      <Icon d={ic.tag} size={11} stroke="var(--accent)"/>{t}
                      <span style={{ cursor:"pointer",color:"var(--text3)",marginLeft:2,fontSize:13,lineHeight:1 }} onClick={()=>set("tags",form.tags.filter(x=>x!==t))}>×</span>
                    </span>
                  ))}
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  <input className="form-input" style={{ flex:1 }} placeholder="Add tag…" value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTag()} />
                  <button className="btn btn-secondary btn-sm" onClick={addTag}><Icon d={ic.plus} size={14}/></button>
                </div>
              </div>
            </div>
          )}

          {tab==="checklist" && (
            <div>
              {form.checklist.length > 0 && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ height:6,background:"var(--surface2)",borderRadius:3,overflow:"hidden",marginBottom:12 }}>
                    <div style={{ height:"100%",background:"var(--accent)",borderRadius:3,width:`${Math.round((form.checklist.filter(c=>c.done).length/form.checklist.length)*100)}%`,transition:"width .3s" }} />
                  </div>
                  <div style={{ fontSize:12,color:"var(--text2)",marginBottom:12,textAlign:"right" }}>{form.checklist.filter(c=>c.done).length} / {form.checklist.length} done</div>
                </div>
              )}
              <div style={{ display:"flex",flexDirection:"column",gap:6,marginBottom:14 }}>
                {form.checklist.map(item=>(
                  <div key={item.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)" }}>
                    <div onClick={()=>toggleCheck(item.id)} style={{ width:18,height:18,borderRadius:4,border:`2px solid ${item.done?"var(--accent)":"var(--border)"}`,background:item.done?"var(--accent)":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s" }}>
                      {item.done && <Icon d={ic.check} size={11} stroke="white" strokeWidth={3}/>}
                    </div>
                    <span style={{ flex:1,fontSize:13,textDecoration:item.done?"line-through":"none",color:item.done?"var(--text3)":"var(--text)",transition:"all .15s" }}>{item.text}</span>
                    <button className="btn btn-ghost btn-icon" style={{ width:24,height:24,color:"var(--text3)" }} onClick={()=>removeCheck(item.id)}><Icon d={ic.close} size={12}/></button>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <input className="form-input" style={{ flex:1 }} placeholder="Add checklist item…" value={newCheckItem} onChange={e=>setNewCheckItem(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCheckItem()} />
                <button className="btn btn-secondary btn-sm" onClick={addCheckItem}><Icon d={ic.plus} size={14}/> Add</button>
              </div>
            </div>
          )}

          {tab==="comments" && (
            <div>
              {form.comments.length === 0 && <div style={{ textAlign:"center",padding:"28px 0",color:"var(--text3)",fontSize:13 }}>No comments yet — start the conversation.</div>}
              <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:16 }}>
                {form.comments.map(c=>(
                  <div key={c.id} style={{ padding:"10px 14px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                      <div style={{ width:26,height:26,borderRadius:"50%",background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white" }}>
                        {c.author.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight:700,fontSize:13 }}>{c.author}</span>
                      <span style={{ fontSize:11.5,color:"var(--text3)",marginLeft:"auto" }}>{c.date}</span>
                    </div>
                    {/* Render comment text with @mentions highlighted */}
                    <div style={{ fontSize:13,color:"var(--text2)",lineHeight:1.6 }}>
                      {c.text.split(/(@\S+)/g).map((part,i) =>
                        part.startsWith("@")
                          ? <span key={i} style={{ color:"var(--accent)",fontWeight:700,background:"var(--accent-glow)",borderRadius:4,padding:"0 3px" }}>{part}</span>
                          : part
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* Comment input with @ picker */}
              <CommentInput
                value={newComment}
                onChange={setNewComment}
                onPost={addComment}
                mentionables={assignableAll}
              />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>onSave(form)} disabled={!form.title.trim()}>
            <Icon d={ic.check} size={14}/> {isNew?"Create Task":"Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── COMMENT INPUT WITH @MENTION ──────────────────────────────────────────────
function CommentInput({ value, onChange, onPost, mentionables }) {
  const [mentionQuery, setMentionQuery] = useState(null); // null = closed, string = filter
  const [menuIndex, setMenuIndex]       = useState(0);
  const textareaRef = useRef();

  const filtered = mentionQuery === null ? [] : mentionables.filter(u => {
    const name = `${u.firstName} ${u.lastName}`.toLowerCase();
    return name.includes(mentionQuery.toLowerCase()) || u.email?.toLowerCase().includes(mentionQuery.toLowerCase());
  });

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    // Detect @ trigger: find last @ before cursor that isn't followed by a space
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/@(\S*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMenuIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (user) => {
    const cursor = textareaRef.current.selectionStart;
    const textBefore = value.slice(0, cursor);
    const textAfter  = value.slice(cursor);
    const atIdx = textBefore.lastIndexOf("@");
    const handle = `@${user.firstName}${user.lastName ? "_" + user.lastName : ""}`.replace(/\s+/g, "_");
    const newVal = textBefore.slice(0, atIdx) + handle + " " + textAfter;
    onChange(newVal);
    setMentionQuery(null);
    // Refocus and move cursor to end of inserted mention
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = atIdx + handle.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (mentionQuery !== null && filtered.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMenuIndex(i => Math.min(i+1, filtered.length-1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setMenuIndex(i => Math.max(i-1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(filtered[menuIndex]); return; }
      if (e.key === "Escape")    { setMentionQuery(null); return; }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { onPost(value); }
  };

  const meta = (role) => ROLE_META[role] || ROLE_META.user;

  return (
    <div style={{ position:"relative" }}>
      {/* Mention dropdown */}
      {mentionQuery !== null && filtered.length > 0 && (
        <div style={{ position:"absolute",bottom:"calc(100% + 6px)",left:0,right:0,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",boxShadow:"0 8px 28px rgba(0,0,0,.25)",zIndex:100,overflow:"hidden",maxHeight:200,overflowY:"auto" }}>
          <div style={{ padding:"6px 10px 4px",fontSize:11,color:"var(--text3)",fontWeight:700,borderBottom:"1px solid var(--border)" }}>
            <Icon d={ic.atSign} size={11} stroke="var(--text3)" /> Mention a team member
          </div>
          {filtered.map((u, i) => {
            const m = meta(u.role);
            return (
              <div key={u.id} onMouseDown={e=>{ e.preventDefault(); insertMention(u); }}
                style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 12px",cursor:"pointer",background:i===menuIndex?"var(--accent-glow)":"transparent",borderLeft:i===menuIndex?`3px solid var(--accent)`:"3px solid transparent",transition:"background .1s" }}>
                <div style={{ width:28,height:28,borderRadius:"50%",background:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white",flexShrink:0 }}>
                  {`${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase()||"?"}
                </div>
                <div>
                  <div style={{ fontWeight:700,fontSize:13 }}>{u.firstName} {u.lastName}</div>
                  <div style={{ fontSize:11,color:"var(--text2)" }}>{m.label}{u.title?` · ${u.title}`:""}</div>
                </div>
                <span style={{ marginLeft:"auto",fontSize:10.5,color:m.color,fontWeight:700,padding:"1px 7px",background:`${m.color}15`,borderRadius:10 }}>{m.label}</span>
              </div>
            );
          })}
          {filtered.length === 0 && mentionQuery.length > 0 && (
            <div style={{ padding:"10px 14px",fontSize:12.5,color:"var(--text3)" }}>No match for "@{mentionQuery}"</div>
          )}
        </div>
      )}
      <div style={{ display:"flex",gap:8,alignItems:"flex-end" }}>
        <div style={{ flex:1,position:"relative" }}>
          <textarea ref={textareaRef} className="form-input form-textarea"
            style={{ flex:1,minHeight:64,width:"100%",resize:"none",paddingRight:60 }}
            placeholder="Write a comment… type @ to mention someone"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
          <span style={{ position:"absolute",bottom:8,right:10,fontSize:10,color:"var(--text3)",pointerEvents:"none" }}>⌘↵ post</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={()=>onPost(value)}>
          <Icon d={ic.message} size={14}/> Post
        </button>
      </div>
    </div>
  );
}

// ── NOTIFICATION BELL ────────────────────────────────────────────────────────
function NotificationBell({ notifications, onMarkRead, onMarkAllRead, onClear }) {
  const [open, setOpen]         = useState(false);
  const [expanded, setExpanded] = useState(null); // notif id that's expanded
  const ref = useRef();
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = notifications.filter(n => !n.read).length;

  const typeIcon = (n) => {
    if (n.type === "assignment")  return "🏗️";
    if (n.type === "cert-alert")  return n.certStatus === "expired" ? "🚨" : "⚠️";
    if (n.type === "mention")     return "💬";
    return "🔔";
  };

  const handleClick = (n) => {
    onMarkRead(n.id);
    setExpanded(v => v === n.id ? null : n.id);
  };

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setOpen(v => !v); setExpanded(null); }}
        style={{ position:"relative", width:36, height:36, color: unread > 0 ? "var(--accent)" : "var(--text2)" }}>
        <Icon d={ic.bell} size={18} />
        {unread > 0 && (
          <span style={{ position:"absolute", top:4, right:4, width:16, height:16, borderRadius:"50%", background:"var(--accent)", color:"white", fontSize:9, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid var(--surface)", lineHeight:1 }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Mobile: full-screen backdrop */}
          {isMobile && <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:199 }} onClick={()=>setOpen(false)} />}

          <div style={{
            position: isMobile ? "fixed" : "absolute",
            ...(isMobile ? { bottom:0, left:0, right:0, top:"auto", borderRadius:"16px 16px 0 0", maxHeight:"80dvh" } : { top:"calc(100% + 8px)", right:0, width:360, borderRadius:"var(--radius)" }),
            background:"var(--surface)", border:"1px solid var(--border)",
            boxShadow:"0 12px 48px rgba(0,0,0,.35)", zIndex:200, overflow:"hidden",
            display:"flex", flexDirection:"column"
          }}>
            {/* Handle bar (mobile) */}
            {isMobile && <div style={{ width:36,height:4,borderRadius:2,background:"var(--border)",margin:"10px auto 0",flexShrink:0 }} />}

            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>
                Notifications
                {unread > 0 && <span style={{ fontSize:11, fontWeight:700, padding:"1px 7px", borderRadius:10, background:"var(--accent)", color:"white", marginLeft:6 }}>{unread}</span>}
              </div>
              <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                {unread > 0 && <button className="btn btn-ghost btn-sm" style={{ fontSize:11.5, color:"var(--accent)", padding:"2px 8px" }} onClick={onMarkAllRead}>Mark all read</button>}
                {notifications.length > 0 && <button className="btn btn-ghost btn-sm" style={{ fontSize:11.5, color:"var(--text3)", padding:"2px 8px" }} onClick={()=>{ onClear(); setExpanded(null); }}>Clear</button>}
                {isMobile && <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>setOpen(false)}><Icon d={ic.close} size={16} /></button>}
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY:"auto", flex:1, ...(isMobile ? { maxHeight:"calc(80dvh - 80px)" } : { maxHeight:420 }) }}>
              {notifications.length === 0 ? (
                <div style={{ padding:"48px 16px", textAlign:"center", color:"var(--text3)" }}>
                  <Icon d={ic.bell} size={28} stroke="var(--text3)" />
                  <div style={{ marginTop:10, fontSize:13 }}>You're all caught up!</div>
                </div>
              ) : (
                notifications.map(n => {
                  const isExpanded = expanded === n.id;
                  return (
                    <div key={n.id}
                      style={{ borderBottom:"1px solid var(--border)", background: n.read ? "transparent" : "var(--accent-glow)", transition:"background .15s", cursor:"pointer" }}
                      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "var(--surface2)"; }}
                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = n.read ? "transparent" : "var(--accent-glow)"; }}>

                      {/* Summary row — always visible */}
                      <div style={{ display:"flex", gap:11, padding:"11px 16px 11px", alignItems:"flex-start" }}
                        onClick={() => handleClick(n)}>
                        {/* Icon */}
                        <div style={{ width:34, height:34, borderRadius:"50%",
                          background: n.type==="cert-alert" ? (n.certStatus==="expired" ? "#e85a3a22" : n.certStatus==="expiring-soon" ? "#e8803a22" : "#e8c53a22")
                            : n.authorColor ? `${n.authorColor}22` : "var(--accent-glow)",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:16, flexShrink:0, border:`1px solid ${n.type==="cert-alert" ? (n.certStatus==="expired" ? "#e85a3a44" : "#e8c53a44") : "var(--border)"}` }}>
                          {typeIcon(n)}
                        </div>

                        <div style={{ flex:1, minWidth:0 }}>
                          {/* Title line */}
                          <div style={{ fontSize:13, lineHeight:1.45, color:"var(--text)", marginBottom:2 }}>
                            {n.type === "assignment"
                              ? <><strong>{n.author}</strong> assigned you to <strong style={{ color:"var(--accent)" }}>{n.context}</strong></>
                              : n.type === "cert-alert"
                                ? <><strong style={{ color: n.certStatus==="expired" ? "#e85a3a" : n.certStatus==="expiring-soon" ? "#e8803a" : "#b8950a" }}>Certification Alert</strong> — {n.context}</>
                                : <><strong>{n.author}</strong> {n.action} <strong style={{ color:"var(--accent)" }}>@you</strong> {n.context && <span style={{ color:"var(--text2)" }}>in <em>{n.context}</em></span>}</>
                            }
                          </div>
                          {/* Preview — truncated when collapsed */}
                          {n.preview && !isExpanded && (
                            <div style={{ fontSize:12, color:"var(--text2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {n.type === "assignment" ? n.preview : `"${n.preview}"`}
                            </div>
                          )}
                          <div style={{ fontSize:11, color:"var(--text3)", marginTop:3, display:"flex", alignItems:"center", gap:6 }}>
                            {n.date}
                            <span style={{ color:"var(--text3)", fontSize:10 }}>{isExpanded ? "▲ collapse" : "▼ expand"}</span>
                          </div>
                        </div>
                        {!n.read && <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--accent)", flexShrink:0, marginTop:5 }} />}
                      </div>

                      {/* Expanded body */}
                      {isExpanded && (
                        <div style={{ padding:"0 16px 14px 61px" }}>
                          <div style={{ padding:"10px 14px", background:"var(--surface2)", borderRadius:9, border:"1px solid var(--border)", fontSize:13, color:"var(--text)", lineHeight:1.7 }}>
                            {n.type === "cert-alert"
                              ? <>
                                  <div style={{ fontWeight:700, marginBottom:4, color: n.certStatus==="expired" ? "#e85a3a" : n.certStatus==="expiring-soon" ? "#e8803a" : "#b8950a" }}>
                                    {n.certStatus==="expired" ? "🚨 Certification Expired" : n.certStatus==="expiring-soon" ? "⚠️ Expiring in 30 Days or Less" : "⚠️ Expiring in 90 Days"}
                                  </div>
                                  <div style={{ color:"var(--text2)", fontSize:12.5 }}>{n.preview}</div>
                                  <div style={{ marginTop:8, fontSize:12, color:"var(--text3)" }}>Go to <strong>Team Members</strong> and click the user to update their certification.</div>
                                </>
                              : n.type === "assignment"
                                ? <>
                                    <div style={{ fontWeight:700, marginBottom:4 }}>Project Assignment</div>
                                    <div style={{ color:"var(--text2)", fontSize:12.5 }}>{n.preview}</div>
                                  </>
                                : <>
                                    <div style={{ fontWeight:700, marginBottom:4 }}>Mention</div>
                                    <div style={{ color:"var(--text2)", fontSize:12.5, fontStyle:"italic" }}>"{n.preview}"</div>
                                    {n.context && <div style={{ marginTop:6, fontSize:12, color:"var(--text3)" }}>In: <strong>{n.context}</strong></div>}
                                  </>
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ListCheckToggle({task, checkDone, checkTotal, onToggleChecklistItem}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ flexShrink:0 }}>
      {/* Pill — only this toggles open/close */}
      <div style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"2px 6px",borderRadius:"var(--radius-sm)",background:"var(--surface2)",border:"1px solid var(--border)" }}
        onClick={e=>{e.stopPropagation();setOpen(v=>!v);}}>
        <Icon d={ic.listCheck} size={12} stroke={checkDone===checkTotal?"#3dba7e":"var(--text3)"}/>
        <span style={{ fontSize:11,fontWeight:700,color:checkDone===checkTotal?"#3dba7e":"var(--text2)" }}>{checkDone}/{checkTotal}</span>
        <span style={{ fontSize:9,color:"var(--text3)" }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ position:"absolute",zIndex:50,marginTop:4,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",boxShadow:"0 8px 24px rgba(0,0,0,.2)",padding:"8px",minWidth:220,maxWidth:300 }}
          onClick={e=>e.stopPropagation()}>
          {(task.checklist||[]).map(item=>(
            <div key={item.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"5px 6px",borderRadius:"var(--radius-sm)",cursor:"pointer",marginBottom:2 }}
              onMouseEnter={e=>e.currentTarget.style.background="var(--surface2)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              onClick={e=>{e.stopPropagation();onToggleChecklistItem(task.id,item.id);}}>
              <div style={{ width:14,height:14,borderRadius:3,border:`2px solid ${item.done?"var(--accent)":"var(--border)"}`,background:item.done?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s" }}>
                {item.done && <Icon d={ic.check} size={9} stroke="white" strokeWidth={3}/>}
              </div>
              <span style={{ fontSize:12,textDecoration:item.done?"line-through":"none",color:item.done?"var(--text3)":"var(--text)" }}>{item.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TasksPage({ projects, teamUsers, settings, tasks, onTasksChange, onNotify }) {
  const [view, setView]           = useState("board");   // board | list
  const [editingTask, setEditingTask]   = useState(null);
  const [addingTask, setAddingTask]     = useState(null);
  const [confirmDel, setConfirmDel]     = useState(null);
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterProject,  setFilterProject]  = useState("all");
  const [searchQ, setSearchQ]           = useState("");
  const [columns, setColumns]           = useState(DEFAULT_COLUMNS);
  const [editingCol, setEditingCol]     = useState(null);
  const [newColLabel, setNewColLabel]   = useState("");
  const [dragTask, setDragTask]         = useState(null);
  const [dragOver, setDragOver]         = useState(null);
  const boardRef = useRef(null);

  const scrollBoard = (dir) => {
    if (!boardRef.current) return;
    boardRef.current.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  const saveTask = t => {
    const exists = tasks.find(x=>x.id===t.id);
    onTasksChange(exists ? tasks.map(x=>x.id===t.id?t:x) : [...tasks, t]);
    setEditingTask(null); setAddingTask(null);
  };
  const deleteTask = id => { onTasksChange(tasks.filter(t=>t.id!==id)); setConfirmDel(null); };
  const moveTask = (taskId, newStatus) => onTasksChange(tasks.map(t=>t.id===taskId?{...t,status:newStatus}:t));

  // Drag-and-drop handlers
  const onDragStart = (e, taskId) => { setDragTask(taskId); e.dataTransfer.effectAllowed="move"; };
  const onDragOver  = (e, colId)  => { e.preventDefault(); setDragOver(colId); };
  const onDrop      = (e, colId)  => { e.preventDefault(); if (dragTask) moveTask(dragTask, colId); setDragTask(null); setDragOver(null); };

  const allAssignees = [
    { id:"__admin__", firstName:settings.userFirstName||"Admin", lastName:settings.userLastName||"", role:"admin" },
    ...teamUsers.filter(u=>u.status==="active"),
  ];

  const filteredTasks = tasks.filter(t => {
    if (filterAssignee !== "all" && !t.assigneeIds?.includes(filterAssignee)) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (filterProject  !== "all" && t.projectId !== filterProject)  return false;
    if (searchQ && !`${t.title} ${t.description} ${(t.tags||[]).join(" ")}`.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  const tasksByCol = col => filteredTasks.filter(t=>t.status===col.id);

  const addColumn = () => {
    const label = newColLabel.trim();
    if (!label) return;
    const colors = ["#6b7280","#3ab8e8","#8b7cf8","#e8c53a","#3dba7e","#e85a3a","#f0954e"];
    setColumns(prev=>[...prev, { id:uid(), label, color:colors[prev.length%colors.length] }]);
    setNewColLabel(""); setEditingCol(null);
  };

  const PriorityDot = ({priority, size=8}) => {
    const p = TASK_PRIORITIES.find(x=>x.id===priority)||TASK_PRIORITIES[2];
    return <span style={{ width:size,height:size,borderRadius:"50%",background:p.color,display:"inline-block",flexShrink:0 }} />;
  };

  const AssigneeAvatars = ({assigneeIds=[]}) => {
    const shown = assigneeIds.slice(0,3);
    return (
      <div style={{ display:"flex",gap:-2 }}>
        {shown.map((id,i)=>{
          const u = allAssignees.find(a=>a.id===id);
          if (!u) return null;
          const meta = ROLE_META[u.role]||ROLE_META.user;
          return (
            <div key={id} title={`${u.firstName} ${u.lastName}`}
              style={{ width:22,height:22,borderRadius:"50%",background:meta.color,border:"2px solid var(--surface)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"white",marginLeft:i>0?-6:0,zIndex:shown.length-i,position:"relative" }}>
              {`${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase()||"?"}
            </div>
          );
        })}
        {assigneeIds.length > 3 && <div style={{ width:22,height:22,borderRadius:"50%",background:"var(--surface3)",border:"2px solid var(--surface)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"var(--text2)",marginLeft:-6 }}>+{assigneeIds.length-3}</div>}
      </div>
    );
  };

  const DueBadge = ({dueDate}) => {
    if (!dueDate) return null;
    const due = new Date(dueDate+"T12:00:00");
    const diff = Math.ceil((due - new Date()) / 86400000);
    const overdue = diff < 0;
    const soon    = diff >= 0 && diff <= 2;
    if (!overdue && !soon) return <span style={{ fontSize:10.5,color:"var(--text3)" }}>Due {formatDate(dueDate, settings)}</span>;
    return <span style={{ fontSize:10.5,fontWeight:700,color:overdue?"#e85a3a":"#e8c53a",background:overdue?"#e85a3a18":"#e8c53a18",padding:"1px 7px",borderRadius:10 }}>{overdue?`Overdue ${Math.abs(diff)}d`:`Due in ${diff}d`}</span>;
  };

  // Self-contained list-view checklist expander
  const toggleChecklistItem = (taskId, itemId) => {
    onTasksChange(tasks.map(t => t.id !== taskId ? t : {
      ...t, checklist: t.checklist.map(c => c.id === itemId ? { ...c, done:!c.done } : c)
    }));
  };

  const progressTask = (taskId, direction) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const idx = columns.findIndex(c => c.id === task.status);
    const next = columns[idx + direction];
    if (next) moveTask(taskId, next.id);
  };

  const TaskCard = ({task}) => {
    const proj = projects.find(p=>p.id===task.projectId);
    const checkDone = (task.checklist||[]).filter(c=>c.done).length;
    const checkTotal = (task.checklist||[]).length;
    const colIdx = columns.findIndex(c=>c.id===task.status);
    const col    = columns[colIdx];
    const canBack = colIdx > 0;
    const canFwd  = colIdx < columns.length - 1;
    const [showChecklist, setShowChecklist] = useState(false);

    return (
      <div draggable onDragStart={e=>onDragStart(e,task.id)}
        style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"11px 13px",cursor:"grab",transition:"box-shadow .15s",userSelect:"none" }}
        onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.18)"}
        onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>

        {/* Top row */}
        <div style={{ display:"flex",alignItems:"flex-start",gap:8,marginBottom:7 }}>
          <PriorityDot priority={task.priority} size={9} />
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:13,fontWeight:700,lineHeight:1.4,marginBottom:3,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" }}>{task.title}</div>
            {task.description && <div style={{ fontSize:11.5,color:"var(--text2)",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",lineHeight:1.5 }}>{task.description}</div>}
          </div>
          <div style={{ display:"flex",gap:3,flexShrink:0 }}>
            <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={e=>{e.stopPropagation();setEditingTask(task);}}><Icon d={ic.edit} size={22}/></button>
            <button className="btn btn-ghost btn-icon" style={{ width:44,height:44,color:"#e85a3a" }} onClick={e=>{e.stopPropagation();setConfirmDel(task);}}><Icon d={ic.trash} size={22}/></button>
          </div>
        </div>

        {/* Tags */}
        {(task.tags||[]).length > 0 && (
          <div style={{ display:"flex",flexWrap:"wrap",gap:4,marginBottom:7 }}>
            {task.tags.slice(0,3).map(t=><span key={t} style={{ fontSize:10,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:10,padding:"1px 7px",color:"var(--text2)" }}>{t}</span>)}
            {task.tags.length>3 && <span style={{ fontSize:10,color:"var(--text3)" }}>+{task.tags.length-3}</span>}
          </div>
        )}

        {/* Inline checklist (expandable) */}
        {checkTotal > 0 && (
          <div style={{ marginBottom:8 }}>
            {/* Progress bar + toggle */}
            <div style={{ display:"flex",alignItems:"center",gap:7,marginBottom:showChecklist?6:0,cursor:"pointer" }}
              onClick={e=>{e.stopPropagation();setShowChecklist(v=>!v);}}>
              <div style={{ flex:1,height:4,background:"var(--surface3)",borderRadius:2,overflow:"hidden" }}>
                <div style={{ height:"100%",background:checkDone===checkTotal?"#3dba7e":"var(--accent)",borderRadius:2,width:`${Math.round((checkDone/checkTotal)*100)}%`,transition:"width .3s" }} />
              </div>
              <span style={{ fontSize:10.5,color:checkDone===checkTotal?"#3dba7e":"var(--text2)",fontWeight:600,flexShrink:0 }}>{checkDone}/{checkTotal}</span>
              <span style={{ fontSize:10,color:"var(--text3)",flexShrink:0 }}>{showChecklist?"▲":"▼"}</span>
            </div>
            {showChecklist && (
              <div style={{ display:"flex",flexDirection:"column",gap:4,paddingTop:2 }}
                onClick={e=>e.stopPropagation()}>
                {(task.checklist||[]).map(item=>(
                  <div key={item.id} style={{ display:"flex",alignItems:"center",gap:7,padding:"4px 6px",borderRadius:"var(--radius-sm)",background:"var(--surface2)",cursor:"pointer" }}
                    onClick={()=>toggleChecklistItem(task.id, item.id)}>
                    <div style={{ width:14,height:14,borderRadius:3,border:`2px solid ${item.done?"var(--accent)":"var(--border)"}`,background:item.done?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s" }}>
                      {item.done && <Icon d={ic.check} size={9} stroke="white" strokeWidth={3}/>}
                    </div>
                    <span style={{ fontSize:11.5,textDecoration:item.done?"line-through":"none",color:item.done?"var(--text3)":"var(--text)",lineHeight:1.3 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom row */}
        <div style={{ display:"flex",alignItems:"center",gap:8,marginTop:6,flexWrap:"wrap" }}>
          <AssigneeAvatars assigneeIds={task.assigneeIds||[]} />
          <div style={{ flex:1 }} />
          {proj && <span style={{ fontSize:10,background:`${proj.color}20`,color:proj.color,borderRadius:10,padding:"1px 7px",fontWeight:600,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{proj.title}</span>}
          <DueBadge dueDate={task.dueDate} />
        </div>

        {/* Progress controls */}
        <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:9,paddingTop:8,borderTop:"1px solid var(--border)" }}
          onClick={e=>e.stopPropagation()}>
          <button className="btn btn-ghost btn-sm" disabled={!canBack}
            style={{ fontSize:11,padding:"3px 8px",color:canBack?"var(--text2)":"var(--text3)",opacity:canBack?1:0.35 }}
            onClick={()=>progressTask(task.id,-1)}>
            ← Back
          </button>
          <div style={{ flex:1,textAlign:"center" }}>
            <span style={{ fontSize:10.5,fontWeight:700,padding:"2px 9px",borderRadius:10,background:`${col?.color||"#888"}18`,color:col?.color||"var(--text2)" }}>{col?.label||task.status}</span>
          </div>
          <button className="btn btn-ghost btn-sm" disabled={!canFwd}
            style={{ fontSize:11,padding:"3px 8px",color:canFwd?"var(--accent)":"var(--text3)",opacity:canFwd?1:0.35,fontWeight:canFwd?700:400 }}
            onClick={()=>progressTask(task.id,1)}>
            {canFwd ? `→ ${columns[colIdx+1]?.label}` : "✓ Done"}
          </button>
        </div>
      </div>
    );
  };

  const totalOpen = tasks.filter(t=>t.status!=="done").length;
  const totalDone = tasks.filter(t=>t.status==="done").length;

  return (
    <div className="page fade-in" style={{ maxWidth:"100%",paddingRight:0 }}>
      {/* Header */}
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,paddingRight:26 }}>
        <div>
          <div className="section-title" style={{ marginBottom:4 }}>Tasks</div>
          <div className="section-sub" style={{ marginBottom:0 }}>
            {totalOpen} open · {totalDone} completed · {tasks.length} total
          </div>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          {/* View toggle */}
          <div style={{ display:"flex",background:"var(--surface2)",borderRadius:"var(--radius-sm)",padding:3,border:"1px solid var(--border)" }}>
            {[{v:"board",icon:ic.kanban},{v:"list",icon:ic.clipboardList}].map(({v,icon})=>(
              <button key={v} onClick={()=>setView(v)} className="btn btn-ghost btn-sm btn-icon"
                style={{ width:44,height:44,background:view===v?"var(--surface)":"transparent",boxShadow:view===v?"0 1px 4px rgba(0,0,0,.15)":"none",color:view===v?"var(--accent)":"var(--text2)",transition:"all .15s" }}>
                <Icon d={icon} size={22}/>
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" style={{ height:44,fontSize:14,padding:"0 16px" }} onClick={()=>setAddingTask("todo")}>
            <Icon d={ic.plus} size={18}/> New Task
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",paddingRight:26,alignItems:"center" }}>
        <input className="form-input" style={{ width:200 }} placeholder="Search tasks…" value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
        <select className="form-input form-select" style={{ width:"auto" }} value={filterAssignee} onChange={e=>setFilterAssignee(e.target.value)}>
          <option value="all">All Assignees</option>
          {allAssignees.map(u=><option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
        </select>
        <select className="form-input form-select" style={{ width:"auto" }} value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}>
          <option value="all">All Priorities</option>
          {TASK_PRIORITIES.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select className="form-input form-select" style={{ width:"auto" }} value={filterProject} onChange={e=>setFilterProject(e.target.value)}>
          <option value="all">All Projects</option>
          {projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        {(searchQ||filterAssignee!=="all"||filterPriority!=="all"||filterProject!=="all") && (
          <button className="btn btn-ghost btn-sm" style={{ color:"var(--text3)" }} onClick={()=>{setSearchQ("");setFilterAssignee("all");setFilterPriority("all");setFilterProject("all");}}>✕ Clear</button>
        )}
        <div style={{ marginLeft:"auto",display:"flex",gap:6,alignItems:"center" }}>
          <span style={{ fontSize:12,color:"var(--text3)" }}>{filteredTasks.length} task{filteredTasks.length!==1?"s":""}</span>
        </div>
      </div>

      {/* ── BOARD VIEW ── */}
      {view==="board" && (
        <div ref={boardRef} style={{ display:"flex",gap:14,overflowX:"auto",paddingBottom:12,paddingRight:26,alignItems:"flex-start",scrollbarWidth:"auto",scrollbarColor:"var(--border) transparent" }}
          className="board-scroll">
        {columns.map(col=>{
            const colTasks = tasksByCol(col);
            const isOver   = dragOver===col.id;
            return (
              <div key={col.id}
                onDragOver={e=>onDragOver(e,col.id)} onDrop={e=>onDrop(e,col.id)}
                style={{ minWidth:272,maxWidth:272,display:"flex",flexDirection:"column",gap:0,flexShrink:0 }}>
                {/* Column header */}
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"0 2px" }}>
                  <div style={{ width:10,height:10,borderRadius:"50%",background:col.color,flexShrink:0 }} />
                  {editingCol===col.id
                    ? <input className="form-input" style={{ flex:1,padding:"3px 8px",fontSize:13 }} autoFocus
                        defaultValue={col.label}
                        onBlur={e=>{ setColumns(prev=>prev.map(c=>c.id===col.id?{...c,label:e.target.value||c.label}:c)); setEditingCol(null); }}
                        onKeyDown={e=>{ if(e.key==="Enter"||e.key==="Escape") e.target.blur(); }} />
                    : <span style={{ fontWeight:700,fontSize:13.5,flex:1,cursor:"text" }} onDoubleClick={()=>setEditingCol(col.id)}>{col.label}</span>
                  }
                  <span style={{ fontSize:12,fontWeight:700,padding:"1px 8px",borderRadius:10,background:`${col.color}20`,color:col.color }}>{colTasks.length}</span>
                  <button className="btn btn-ghost btn-icon" style={{ width:24,height:24,color:"var(--text3)" }} onClick={()=>setAddingTask(col.id)}><Icon d={ic.plus} size={14}/></button>
                </div>

                {/* Drop zone */}
                <div style={{ display:"flex",flexDirection:"column",gap:8,minHeight:60,padding:isOver?"6px":"2px",borderRadius:"var(--radius)",background:isOver?`${col.color}10`:"transparent",border:isOver?`2px dashed ${col.color}`:"2px solid transparent",transition:"all .15s" }}>
                  {colTasks.length===0 && !isOver && (
                    <div onClick={()=>setAddingTask(col.id)}
                      style={{ padding:"20px 10px",borderRadius:"var(--radius-sm)",border:"2px dashed var(--border)",textAlign:"center",cursor:"pointer",color:"var(--text3)",fontSize:12 }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=col.color}
                      onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                      + Add task
                    </div>
                  )}
                  {colTasks.map(task=><TaskCard key={task.id} task={task} />)}
                </div>
              </div>
            );
          })}

          {/* Add column */}
          <div style={{ minWidth:220,flexShrink:0 }}>
            {editingCol==="__new__"
              ? <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  <input className="form-input" style={{ flex:1 }} placeholder="Column name…" autoFocus value={newColLabel} onChange={e=>setNewColLabel(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addColumn()} />
                  <button className="btn btn-primary btn-sm" onClick={addColumn}><Icon d={ic.check} size={14}/></button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>{setEditingCol(null);setNewColLabel("");}}>✕</button>
                </div>
              : <button className="btn btn-ghost btn-sm" style={{ width:"100%",justifyContent:"center",border:"2px dashed var(--border)",padding:"10px",color:"var(--text3)",fontSize:12.5 }}
                  onClick={()=>setEditingCol("__new__")} onMouseEnter={e=>e.currentTarget.style.borderColor="var(--accent)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                  <Icon d={ic.plus} size={14}/> Add Column
                </button>
            }
          </div>
        </div>
      )}

      {/* Board scroll nav buttons */}
      {view==="board" && (
        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,paddingRight:26,paddingTop:10,paddingBottom:8 }}>
          <button className="btn btn-secondary btn-sm" style={{ minWidth:90,gap:6 }} onClick={()=>scrollBoard(-1)}>
            <Icon d={ic.chevLeft} size={14}/> Scroll Left
          </button>
          <button className="btn btn-secondary btn-sm" style={{ minWidth:90,gap:6 }} onClick={()=>scrollBoard(1)}>
            Scroll Right <Icon d={ic.chevRight} size={14}/>
          </button>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view==="list" && (
        <div style={{ paddingRight:26 }}>
          {columns.map(col=>{
            const colTasks = tasksByCol(col);
            if (colTasks.length===0) return null;
            return (
              <div key={col.id} style={{ marginBottom:24 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                  <div style={{ width:10,height:10,borderRadius:"50%",background:col.color }} />
                  <span style={{ fontWeight:700,fontSize:14 }}>{col.label}</span>
                  <span style={{ fontSize:12,fontWeight:700,padding:"1px 8px",borderRadius:10,background:`${col.color}20`,color:col.color }}>{colTasks.length}</span>
                </div>
                <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",overflow:"hidden" }}>
                  {colTasks.map((task,i)=>{
                    const proj = projects.find(p=>p.id===task.projectId);
                    const pri  = TASK_PRIORITIES.find(p=>p.id===task.priority)||TASK_PRIORITIES[2];
                    const checkDone  = (task.checklist||[]).filter(c=>c.done).length;
                    const checkTotal = (task.checklist||[]).length;
                    const colIdx = columns.findIndex(c=>c.id===task.status);
                    const canBack = colIdx > 0;
                    const canFwd  = colIdx < columns.length - 1;
                    return (
                      <div key={task.id} style={{ borderBottom:i<colTasks.length-1?"1px solid var(--border)":"none",padding:"10px 14px" }}
                        onMouseEnter={e=>e.currentTarget.style.background="var(--surface2)"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        {/* Row 1: priority dot + title + edit/delete */}
                        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:6 }}>
                          <div style={{ width:9,height:9,borderRadius:"50%",background:pri.color,flexShrink:0 }} />
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ fontWeight:600,fontSize:13.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{task.title}</div>
                          </div>
                          <div style={{ display:"flex",gap:4,flexShrink:0 }}>
                            <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={()=>setEditingTask(task)}><Icon d={ic.edit} size={22}/></button>
                            <button className="btn btn-ghost btn-icon" style={{ width:44,height:44,color:"#e85a3a" }} onClick={()=>setConfirmDel(task)}><Icon d={ic.trash} size={22}/></button>
                          </div>
                        </div>
                        {/* Row 2: meta — description, tags, project, assignees, due, status */}
                        <div style={{ display:"flex",flexWrap:"wrap",alignItems:"center",gap:6,paddingLeft:19 }}>
                          {task.description && <span style={{ fontSize:11.5,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200 }}>{task.description}</span>}
                          {(task.tags||[]).map(t=><span key={t} style={{ fontSize:10,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:10,padding:"1px 7px",color:"var(--text2)" }}>{t}</span>)}
                          {proj && <span style={{ fontSize:10.5,background:`${proj.color}20`,color:proj.color,borderRadius:10,padding:"1px 8px",fontWeight:600,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{proj.title}</span>}
                          <AssigneeAvatars assigneeIds={task.assigneeIds||[]} />
                          <DueBadge dueDate={task.dueDate} />
                          {checkTotal > 0 && <ListCheckToggle task={task} checkDone={checkDone} checkTotal={checkTotal} onToggleChecklistItem={toggleChecklistItem} />}
                          {/* Status select */}
                          <select className="form-input form-select" value={task.status} onChange={e=>moveTask(task.id,e.target.value)}
                            style={{ width:"auto",fontSize:11,padding:"3px 22px 3px 7px",height:"auto",marginLeft:"auto" }}>
                            {columns.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {filteredTasks.length===0 && (
            <div style={{ textAlign:"center",padding:"60px 20px",color:"var(--text3)" }}>
              <Icon d={ic.clipboardList} size={40} stroke="var(--text3)"/>
              <div style={{ fontSize:16,fontWeight:700,marginTop:14,marginBottom:6,color:"var(--text2)" }}>{tasks.length===0?"No tasks yet":"No tasks match your filters"}</div>
              {tasks.length===0 && <button className="btn btn-primary" style={{ marginTop:8 }} onClick={()=>setAddingTask("todo")}><Icon d={ic.plus} size={14}/> Create First Task</button>}
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ── */}
      {(addingTask || editingTask) && (
        <TaskModal
          task={editingTask||null}
          projects={projects}
          teamUsers={teamUsers}
          settings={settings}
          onSave={saveTask}
          onNotify={onNotify}
          onClose={()=>{ setEditingTask(null); setAddingTask(null); }}
        />
      )}

      {confirmDel && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setConfirmDel(null)}>
          <div className="modal fade-in" style={{ maxWidth:400 }}>
            <div className="modal-header">
              <div className="modal-title">Delete Task</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>setConfirmDel(null)}><Icon d={ic.close} size={16}/></button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize:13.5,color:"var(--text2)",lineHeight:1.7 }}>
                Delete <strong style={{ color:"var(--text)" }}>{confirmDel.title}</strong>? This cannot be undone.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background:"#e85a3a",borderColor:"#e85a3a" }} onClick={()=>deleteTask(confirmDel.id)}>
                <Icon d={ic.trash} size={14}/> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ACCOUNT PAGE ─────────────────────────────────────────────────────────────
const PRICING = {
  monthly: {
    base:  { admin: 39, user: 29 },
    pro:   { admin: 59, user: 29 },
  },
  annual: {
    base:  { admin: 33, user: 26 },   // billed as admin*12 + user*12 per year
    pro:   { admin: 50, user: 26 },
  },
};
const PLAN_NAMES = { base: "FieldBase", pro: "FieldPro" };

const FEATURE_PERMS = [
  { id:"projects",   label:"Projects"          },
  { id:"photos",     label:"Photos & Camera"   },
  { id:"reports",    label:"Reports"           },
  { id:"checklists", label:"Checklists"        },
  { id:"templates",  label:"Templates"         },
  { id:"settings",   label:"Settings"          },
  { id:"team",       label:"Team / Account"    },
];

const DEFAULT_PERMS = {
  admin:   { projects:"edit", photos:"edit", reports:"edit", checklists:"edit", templates:"edit", settings:"edit", team:"edit" },
  manager: { projects:"edit", photos:"edit", reports:"edit", checklists:"edit", templates:"edit", settings:"none", team:"none" },
  user:    { projects:"view", photos:"edit", reports:"edit", checklists:"edit", templates:"none",  settings:"none", team:"none" },
};

const EMPTY_USER = {
  id:"", firstName:"", lastName:"", email:"", phone:"", mobile:"",
  title:"", department:"", employeeId:"", startDate:"",
  role:"user", status:"active", assignedProjects:[], permissions:{ ...DEFAULT_PERMS.user },
  notes:"", address:"", city:"", state:"", zip:"",
  certifications:[],
};

const EMPTY_CERT = {
  id:"", name:"", certCode:"", certifyingBody:"", dateCertified:"", dateExpires:"", image:null,
};

// Returns "expired" | "expiring-soon" (≤30d) | "expiring-warning" (≤90d) | "valid" | "no-expiry"
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

const CERT_STATUS_META = {
  "expired":          { label:"Expired",       bg:"#e85a3a22", color:"#e85a3a", border:"#e85a3a55" },
  "expiring-soon":    { label:"Expires soon",  bg:"#e8803a22", color:"#e8803a", border:"#e8803a55" },
  "expiring-warning": { label:"Exp. in 3 mo",  bg:"#e8c53a22", color:"#b8950a", border:"#e8c53a66" },
  "valid":            { label:"Valid",          bg:"#3dba7e18", color:"#3dba7e", border:"#3dba7e44" },
  "no-expiry":        { label:"No expiry",      bg:"var(--surface2)", color:"var(--text3)", border:"var(--border)" },
};

function UserModal({ user, projects, onSave, onClose }) {
  const isNew = !user?.id;
  const [form, setForm] = useState(isNew ? { ...EMPTY_USER, id:uid() } : { ...user });
  const [tab, setTab]   = useState("info");
  const [tmpPw, setTmpPw]       = useState("");
  const [tmpPwConfirm, setTmpPwConfirm] = useState("");
  const [tmpPwError, setTmpPwError]     = useState("");
  const [editingCert, setEditingCert]   = useState(null);  // null | EMPTY_CERT | existing cert
  const [certImgPreview, setCertImgPreview] = useState(null);
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));
  const setPermKey = (feat,val) => setForm(f => ({ ...f, permissions:{ ...f.permissions, [feat]:val } }));
  const toggleProject = (pid) => set("assignedProjects", form.assignedProjects.includes(pid) ? form.assignedProjects.filter(x=>x!==pid) : [...form.assignedProjects, pid]);
  const applyRoleDefaults = (role) => { setForm(f => ({ ...f, role, permissions:{ ...DEFAULT_PERMS[role] } })); };

  const validatePassword = (pw) => {
    if (pw.length < 8)       return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(pw))   return "Password must include at least one uppercase letter.";
    if (!/[a-z]/.test(pw))   return "Password must include at least one lowercase letter.";
    if (!/[0-9]/.test(pw))   return "Password must include at least one number.";
    return null;
  };

  const handleSave = () => {
    if (isNew && tmpPw) {
      const err = validatePassword(tmpPw);
      if (err) return setTmpPwError(err);
      if (tmpPw !== tmpPwConfirm) return setTmpPwError("Passwords do not match.");
    }
    setTmpPwError("");
    onSave(form);
  };

  const TABS = [
    { id:"info",    label:"Contact Info"  },
    { id:"access",  label:"Role & Access" },
    { id:"projects",label:"Projects"      },
    { id:"certs",   label:"Certifications", badge: (form.certifications||[]).filter(c=>["expired","expiring-soon","expiring-warning"].includes(getCertStatus(c.dateExpires))).length || null },
    { id:"security",label:"Security"      },
  ];

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal modal-lg fade-in" style={{ maxWidth:640 }}>
        <div className="modal-header">
          <div className="modal-title">{isNew ? "Add New User" : `Edit — ${user.firstName} ${user.lastName}`}</div>
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22} /></button>
        </div>

        {/* Tab bar */}
        <div style={{ display:"flex",gap:2,borderBottom:"1px solid var(--border)",padding:"0 24px" }}>
          {TABS.map(t => (
            <button key={t.id} className="btn btn-ghost btn-sm" onClick={()=>setTab(t.id)}
              style={{ borderBottom:`2px solid ${tab===t.id?"var(--accent)":"transparent"}`,borderRadius:0,paddingBottom:10,fontSize:12.5,color:tab===t.id?"var(--accent)":"var(--text2)",fontWeight:tab===t.id?700:500,position:"relative",gap:5 }}>
              {t.label}
              {t.badge ? <span style={{ fontSize:10,fontWeight:800,minWidth:16,height:16,borderRadius:8,background:"#e85a3a",color:"white",display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 4px" }}>{t.badge}</span> : null}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ maxHeight:480,overflowY:"auto" }}>

          {/* ── INFO ── */}
          {tab==="info" && (
            <div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">First Name *</label><input className="form-input" value={form.firstName} onChange={e=>set("firstName",e.target.value)} placeholder="Jane" /></div>
                <div className="form-group"><label className="form-label">Last Name *</label><input className="form-input" value={form.lastName} onChange={e=>set("lastName",e.target.value)} placeholder="Smith" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Email Address *</label><input className="form-input" type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="jane@company.com" /></div>
                <div className="form-group"><label className="form-label">Mobile Phone</label><input className="form-input" value={form.mobile} onChange={e=>set("mobile",e.target.value)} placeholder="+1 (555) 000-0000" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Office Phone</label><input className="form-input" value={form.phone} onChange={e=>set("phone",e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Employee ID</label><input className="form-input" value={form.employeeId} onChange={e=>set("employeeId",e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Job Title</label><input className="form-input" value={form.title} onChange={e=>set("title",e.target.value)} placeholder="Field Technician" /></div>
                <div className="form-group"><label className="form-label">Department</label><input className="form-input" value={form.department} onChange={e=>set("department",e.target.value)} placeholder="Operations" /></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <div className="date-input-wrap">
                    <input className="form-input" type="date" value={form.startDate} onChange={e=>set("startDate",e.target.value)} />
                    <span className="date-icon"><Icon d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" size={18} stroke="var(--accent)" strokeWidth={2} /></span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input form-select" value={form.status} onChange={e=>set("status",e.target.value)}>
                    <option value="active">Active</option>
                    <option value="inactive">Deactivated</option>
                    <option value="pending">Pending Invite</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label className="form-label">Address</label><input className="form-input" value={form.address} onChange={e=>set("address",e.target.value)} /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">City</label><input className="form-input" value={form.city} onChange={e=>set("city",e.target.value)} /></div>
                <div className="form-group"><label className="form-label">State / Province</label><input className="form-input" value={form.state} onChange={e=>set("state",e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Zip / Postal Code</label><input className="form-input" value={form.zip} onChange={e=>set("zip",e.target.value)} /></div>
              </div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input form-textarea" value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Internal notes about this user…" style={{ minHeight:68 }} /></div>
            </div>
          )}

          {/* ── ACCESS ── */}
          {tab==="access" && (
            <div>
              <div style={{ marginBottom:18 }}>
                <div className="form-label" style={{ marginBottom:8 }}>User Role</div>
                <div style={{ display:"flex",gap:10 }}>
                  {Object.entries(ROLE_META).filter(([r])=>r!=="admin").map(([r,meta])=>(
                    <div key={r} onClick={()=>applyRoleDefaults(r)}
                      style={{ flex:1,padding:"12px 14px",borderRadius:"var(--radius)",border:`2px solid ${form.role===r?meta.color:"var(--border)"}`,cursor:"pointer",background:form.role===r?`${meta.color}12`:"var(--surface2)",transition:"all .15s" }}>
                      <div style={{ fontWeight:700,fontSize:13,color:form.role===r?meta.color:"var(--text)",marginBottom:3 }}>{meta.label}</div>
                      <div style={{ fontSize:11.5,color:"var(--text2)",lineHeight:1.4 }}>{meta.desc}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:8,fontSize:11.5,color:"var(--text3)" }}>Selecting a role applies default permissions below. You can then fine-tune per feature.</div>
              </div>

              <div style={{ background:"var(--surface2)",borderRadius:"var(--radius)",border:"1px solid var(--border)",overflow:"hidden" }}>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 90px 90px 90px",padding:"9px 14px",borderBottom:"1px solid var(--border)",fontSize:11.5,fontWeight:700,color:"var(--text2)" }}>
                  <span>Feature</span><span style={{ textAlign:"center" }}>View</span><span style={{ textAlign:"center" }}>Edit</span><span style={{ textAlign:"center" }}>None</span>
                </div>
                {FEATURE_PERMS.map((f,i) => {
                  const val = form.permissions?.[f.id] || "none";
                  return (
                    <div key={f.id} style={{ display:"grid",gridTemplateColumns:"1fr 90px 90px 90px",padding:"10px 14px",borderBottom:i<FEATURE_PERMS.length-1?"1px solid var(--border)":"none",alignItems:"center" }}>
                      <span style={{ fontSize:13,fontWeight:500 }}>{f.label}</span>
                      {["view","edit","none"].map(opt=>(
                        <div key={opt} style={{ display:"flex",justifyContent:"center" }}>
                          <div onClick={()=>setPermKey(f.id,opt)}
                            style={{ width:18,height:18,borderRadius:"50%",border:`2px solid ${val===opt?"var(--accent)":"var(--border)"}`,background:val===opt?"var(--accent)":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s" }}>
                            {val===opt && <div style={{ width:7,height:7,borderRadius:"50%",background:"white" }} />}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── PROJECTS ── */}
          {tab==="projects" && (
            <div>
              <div style={{ fontSize:12.5,color:"var(--text2)",marginBottom:14,lineHeight:1.6 }}>
                Select which jobsites this user can access. Admins and Managers can see all projects by default.
              </div>
              {form.role==="admin" || form.role==="manager"
                ? <div style={{ padding:16,background:"var(--surface2)",borderRadius:"var(--radius)",border:"1px solid var(--border)",fontSize:13,color:"var(--text2)",display:"flex",gap:10,alignItems:"center" }}>
                    <Icon d={ic.shield} size={16} stroke="var(--accent)" /><span>This role has access to <strong style={{ color:"var(--text)" }}>all projects</strong> automatically.</span>
                  </div>
                : projects.length === 0
                  ? <div style={{ padding:16,color:"var(--text3)",fontSize:13 }}>No projects yet — create a jobsite first.</div>
                  : <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                      {projects.map(p=>{
                        const sel = form.assignedProjects.includes(p.id);
                        return (
                          <div key={p.id} onClick={()=>toggleProject(p.id)}
                            style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:"var(--radius-sm)",border:`1px solid ${sel?"var(--accent)":"var(--border)"}`,background:sel?"var(--accent-glow)":"var(--surface2)",cursor:"pointer",transition:"all .15s" }}>
                            <div style={{ width:10,height:10,borderRadius:"50%",background:p.color,flexShrink:0 }} />
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:600,fontSize:13 }}>{p.title}</div>
                              <div style={{ fontSize:11.5,color:"var(--text2)" }}>{p.address}{p.city?`, ${p.city}`:""}</div>
                            </div>
                            {sel && <Icon d={ic.check} size={15} stroke="var(--accent)" strokeWidth={2.5} />}
                          </div>
                        );
                      })}
                    </div>
              }
            </div>
          )}

          {/* ── CERTIFICATIONS ── */}
          {tab==="certs" && (() => {
            const certs = form.certifications || [];
            const saveCert = (cert) => {
              const exists = certs.find(c => c.id === cert.id);
              const updated = exists ? certs.map(c => c.id===cert.id ? cert : c) : [...certs, cert];
              set("certifications", updated);
              setEditingCert(null);
              setCertImgPreview(null);
            };
            const deleteCert = (id) => set("certifications", certs.filter(c => c.id !== id));

            return (
              <div>
                {/* Alert banner if any certs need attention */}
                {certs.some(c => ["expired","expiring-soon","expiring-warning"].includes(getCertStatus(c.dateExpires))) && (
                  <div style={{ padding:"10px 14px",background:"#e85a3a12",border:"1px solid #e85a3a40",borderRadius:8,marginBottom:14,display:"flex",alignItems:"center",gap:10 }}>
                    <Icon d={ic.alert} size={15} stroke="#e85a3a" />
                    <span style={{ fontSize:12.5,color:"var(--text2)" }}>
                      <strong style={{ color:"#e85a3a" }}>
                        {certs.filter(c=>getCertStatus(c.dateExpires)==="expired").length > 0
                          ? `${certs.filter(c=>getCertStatus(c.dateExpires)==="expired").length} certification(s) expired`
                          : `${certs.filter(c=>["expiring-soon","expiring-warning"].includes(getCertStatus(c.dateExpires))).length} certification(s) expiring soon`}
                      </strong>
                      {" — update or renew before the expiry date"}
                    </span>
                  </div>
                )}

                {/* Cert list */}
                {certs.length === 0 && !editingCert && (
                  <div style={{ textAlign:"center",padding:"36px 20px",background:"var(--surface2)",borderRadius:10,border:"2px dashed var(--border)",marginBottom:14 }}>
                    <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={32} stroke="var(--text3)" />
                    <div style={{ fontWeight:700,fontSize:14,marginTop:10,marginBottom:5 }}>No certifications on file</div>
                    <div style={{ fontSize:12.5,color:"var(--text2)",marginBottom:14 }}>Track licenses, safety certs, and trade qualifications for this team member.</div>
                    <button className="btn btn-primary btn-sm" onClick={()=>{ setEditingCert({...EMPTY_CERT,id:uid()}); setCertImgPreview(null); }}>
                      <Icon d={ic.plus} size={14} /> Add First Certification
                    </button>
                  </div>
                )}

                {certs.length > 0 && !editingCert && (
                  <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:14 }}>
                    {certs.map(cert => {
                      const status = getCertStatus(cert.dateExpires);
                      const sm     = CERT_STATUS_META[status];
                      const daysLeft = cert.dateExpires ? Math.ceil((new Date(cert.dateExpires+"T00:00:00") - new Date().setHours(0,0,0,0)) / 86400000) : null;
                      return (
                        <div key={cert.id} style={{ display:"flex",gap:12,padding:"12px 14px",background:"var(--surface)",border:`1px solid ${sm.border}`,borderRadius:10,alignItems:"flex-start",transition:"border-color .15s" }}>
                          {/* Cert image thumbnail */}
                          <div style={{ width:44,height:44,borderRadius:7,flexShrink:0,overflow:"hidden",background:"var(--surface2)",border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                            {cert.image
                              ? <img src={cert.image} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                              : <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={20} stroke="var(--text3)" />}
                          </div>
                          {/* Info */}
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4 }}>
                              <span style={{ fontWeight:700,fontSize:13.5 }}>{cert.name||"Unnamed Certification"}</span>
                              {cert.certCode && (
                                <span style={{ fontSize:11,fontWeight:800,padding:"1px 8px",borderRadius:6,background:"var(--surface2)",color:"var(--text2)",border:"1px solid var(--border)",letterSpacing:".04em",fontFamily:"monospace" }}>
                                  {cert.certCode}
                                </span>
                              )}
                              <span style={{ fontSize:10.5,fontWeight:700,padding:"1px 8px",borderRadius:10,background:sm.bg,color:sm.color,border:`1px solid ${sm.border}` }}>
                                {sm.label}
                              </span>
                            </div>
                            <div style={{ fontSize:12,color:"var(--text2)",marginBottom:3 }}>
                              {cert.certifyingBody && <span style={{ marginRight:10 }}>🏢 {cert.certifyingBody}</span>}
                              {cert.dateCertified && <span style={{ marginRight:10 }}>Issued: {new Date(cert.dateCertified+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>}
                            </div>
                            {cert.dateExpires && (
                              <div style={{ fontSize:12,color:sm.color,fontWeight:600 }}>
                                {status==="expired"
                                  ? `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft)!==1?"s":""} ago`
                                  : status==="expiring-soon"
                                    ? `Expires in ${daysLeft} day${daysLeft!==1?"s":""} — renew now`
                                    : status==="expiring-warning"
                                      ? `Expires in ${daysLeft} days`
                                      : `Expires: ${new Date(cert.dateExpires+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`}
                              </div>
                            )}
                          </div>
                          {/* Actions */}
                          <div style={{ display:"flex",gap:4,flexShrink:0 }}>
                            <button className="btn btn-ghost btn-sm btn-icon" title="Edit certification" onClick={()=>{ setEditingCert({...cert}); setCertImgPreview(cert.image||null); }}>
                              <Icon d={ic.edit} size={14} />
                            </button>
                            <button className="btn btn-ghost btn-sm btn-icon" title="Delete" onClick={()=>deleteCert(cert.id)} style={{ color:"#e85a3a" }}>
                              <Icon d={ic.trash} size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add button when there are existing certs */}
                {certs.length > 0 && !editingCert && (
                  <button className="btn btn-secondary btn-sm" style={{ width:"100%",gap:6,justifyContent:"center" }}
                    onClick={()=>{ setEditingCert({...EMPTY_CERT,id:uid()}); setCertImgPreview(null); }}>
                    <Icon d={ic.plus} size={14} /> Add Certification
                  </button>
                )}

                {/* ── Cert edit/add form ── */}
                {editingCert && (
                  <div style={{ background:"var(--surface2)",borderRadius:12,border:"1px solid var(--border)",overflow:"hidden" }}>
                    <div style={{ padding:"13px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between",background:"var(--surface)" }}>
                      <div style={{ fontWeight:700,fontSize:14 }}>
                        {certs.find(c=>c.id===editingCert.id) ? "Edit Certification" : "Add Certification"}
                      </div>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>{ setEditingCert(null); setCertImgPreview(null); }}>
                        <Icon d={ic.close} size={16} />
                      </button>
                    </div>
                    <div style={{ padding:"16px" }}>

                      {/* Image upload */}
                      <div style={{ marginBottom:16 }}>
                        <label className="form-label">Certification Document / Photo</label>
                        <div style={{ display:"flex",alignItems:"flex-start",gap:12 }}>
                          <div style={{ width:80,height:80,borderRadius:10,overflow:"hidden",flexShrink:0,background:"var(--surface)",border:`2px dashed ${certImgPreview?"var(--accent)":"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"border-color .15s" }}
                            onClick={()=>document.getElementById("cert-img-upload").click()}>
                            {certImgPreview
                              ? <img src={certImgPreview} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                              : <div style={{ textAlign:"center",padding:"6px" }}>
                                  <Icon d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" size={22} stroke="var(--text3)" />
                                  <div style={{ fontSize:10,color:"var(--text3)",marginTop:3 }}>Upload</div>
                                </div>}
                          </div>
                          <input id="cert-img-upload" type="file" accept="image/*" style={{ display:"none" }}
                            onChange={e=>{
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = ev => {
                                setCertImgPreview(ev.target.result);
                                setEditingCert(ec => ({...ec, image: ev.target.result}));
                              };
                              reader.readAsDataURL(file);
                              e.target.value = "";
                            }} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12,color:"var(--text2)",lineHeight:1.6,marginBottom:8 }}>Upload a photo or scan of the certificate. Supports JPEG, PNG, HEIC.</div>
                            {certImgPreview && (
                              <button className="btn btn-ghost btn-sm" style={{ fontSize:11,color:"#e85a3a" }}
                                onClick={()=>{ setCertImgPreview(null); setEditingCert(ec=>({...ec,image:null})); }}>
                                Remove image
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Cert name + code row */}
                      <div className="form-row" style={{ marginBottom:12 }}>
                        <div className="form-group" style={{ flex:2 }}>
                          <label className="form-label">Certification Name *</label>
                          <input className="form-input" placeholder="e.g. Water Restoration Technician, First Aid, Forklift Operator" value={editingCert.name}
                            onChange={e=>setEditingCert(ec=>({...ec,name:e.target.value}))} />
                        </div>
                        <div className="form-group" style={{ flex:1 }}>
                          <label className="form-label">Code <span style={{ fontSize:11,color:"var(--text3)",fontWeight:400 }}>(abbreviation)</span></label>
                          <input className="form-input" placeholder="e.g. WRT, OSHA30" value={editingCert.certCode||""}
                            onChange={e=>setEditingCert(ec=>({...ec,certCode:e.target.value.toUpperCase()}))}
                            style={{ fontFamily:"monospace",letterSpacing:".06em",textTransform:"uppercase" }} />
                        </div>
                      </div>

                      {/* Certifying body */}
                      <div className="form-group" style={{ marginBottom:12 }}>
                        <label className="form-label">Certifying Body / Issuing Organization</label>
                        <input className="form-input" placeholder="e.g. OSHA, Red Cross, NCCER" value={editingCert.certifyingBody}
                          onChange={e=>setEditingCert(ec=>({...ec,certifyingBody:e.target.value}))} />
                      </div>

                      {/* Dates */}
                      <div className="form-row" style={{ marginBottom:4 }}>
                        <div className="form-group">
                          <label className="form-label">Date Certified</label>
                          <div className="date-input-wrap">
                            <input className="form-input" type="date" value={editingCert.dateCertified}
                              onChange={e=>setEditingCert(ec=>({...ec,dateCertified:e.target.value}))} />
                            <span className="date-icon"><Icon d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" size={18} stroke="var(--accent)" strokeWidth={2} /></span>
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Expiry Date <span style={{ fontSize:11,color:"var(--text3)",fontWeight:400 }}>(leave blank if no expiry)</span></label>
                          <div className="date-input-wrap">
                            <input className="form-input" type="date" value={editingCert.dateExpires}
                              onChange={e=>setEditingCert(ec=>({...ec,dateExpires:e.target.value}))} />
                            <span className="date-icon"><Icon d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" size={18} stroke="var(--accent)" strokeWidth={2} /></span>
                          </div>
                        </div>
                      </div>

                      {/* Live status preview */}
                      {editingCert.dateExpires && (() => {
                        const st = getCertStatus(editingCert.dateExpires);
                        const sm = CERT_STATUS_META[st];
                        const days = Math.ceil((new Date(editingCert.dateExpires+"T00:00:00") - new Date().setHours(0,0,0,0)) / 86400000);
                        return (
                          <div style={{ padding:"8px 12px",borderRadius:8,background:sm.bg,border:`1px solid ${sm.border}`,marginBottom:12,fontSize:12,color:sm.color,fontWeight:600,display:"flex",alignItems:"center",gap:7 }}>
                            <span style={{ width:7,height:7,borderRadius:"50%",background:sm.color,display:"inline-block",flexShrink:0 }} />
                            {st==="expired" ? `Expired ${Math.abs(days)} days ago`
                              : st==="expiring-soon" ? `Expires in ${days} days — will trigger urgent notification`
                              : st==="expiring-warning" ? `Expires in ${days} days — will trigger 90-day warning`
                              : `Valid · expires ${new Date(editingCert.dateExpires+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`}
                          </div>
                        );
                      })()}

                      <div style={{ display:"flex",gap:8,paddingTop:4 }}>
                        <button className="btn btn-secondary btn-sm" style={{ flex:1 }} onClick={()=>{ setEditingCert(null); setCertImgPreview(null); }}>Cancel</button>
                        <button className="btn btn-primary btn-sm" style={{ flex:2 }} disabled={!editingCert.name?.trim()}
                          onClick={()=>saveCert(editingCert)}>
                          <Icon d={ic.check} size={13} /> {certs.find(c=>c.id===editingCert.id) ? "Update Certification" : "Add Certification"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          {tab==="security" && (
            <div>
              {!isNew && (
                <div className="card" style={{ marginBottom:16 }}>
                  <div className="card-header"><span style={{ fontWeight:700 }}>Reset Password</span></div>
                  <div className="card-body">
                    <div style={{ fontSize:12.5,color:"var(--text2)",marginBottom:14,lineHeight:1.6 }}>
                      Send a password reset link to <strong style={{ color:"var(--text)" }}>{form.email}</strong>. The user will receive an email with instructions.
                    </div>
                    <button className="btn btn-secondary btn-sm"><Icon d={ic.key} size={13} /> Send Reset Link</button>
                  </div>
                </div>
              )}
              {isNew && (
                <div className="card" style={{ marginBottom:16 }}>
                  <div className="card-header"><span style={{ fontWeight:700 }}>Set Temporary Password</span></div>
                  <div className="card-body">
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Temporary Password</label>
                        <input className="form-input" type="password" placeholder="Min 8 characters" value={tmpPw}
                          onChange={e => { setTmpPw(e.target.value); setTmpPwError(""); }}
                          style={{ borderColor: tmpPw && validatePassword(tmpPw) ? "#c0392b" : undefined }} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Confirm Password</label>
                        <input className="form-input" type="password" placeholder="Repeat password" value={tmpPwConfirm}
                          onChange={e => { setTmpPwConfirm(e.target.value); setTmpPwError(""); }}
                          style={{ borderColor: tmpPwConfirm && tmpPwConfirm !== tmpPw ? "#c0392b" : undefined }} />
                      </div>
                    </div>
                    {tmpPw.length > 0 && (
                      <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
                        {[
                          { label:"8+ chars",  ok: tmpPw.length >= 8 },
                          { label:"Uppercase", ok: /[A-Z]/.test(tmpPw) },
                          { label:"Lowercase", ok: /[a-z]/.test(tmpPw) },
                          { label:"Number",    ok: /[0-9]/.test(tmpPw) },
                        ].map(r => (
                          <span key={r.label} style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:10,
                            background: r.ok ? "#3dba7e22" : "var(--surface2)",
                            color: r.ok ? "#3dba7e" : "var(--text3)",
                            border: `1px solid ${r.ok ? "#3dba7e44" : "var(--border)"}` }}>
                            {r.ok ? "✓" : "✗"} {r.label}
                          </span>
                        ))}
                      </div>
                    )}
                    {tmpPwError && <div style={{ fontSize:12.5,color:"#c0392b",padding:"8px 12px",background:"#c0392b15",borderRadius:"var(--radius-sm)",border:"1px solid #c0392b44",marginBottom:4 }}>{tmpPwError}</div>}
                    <div style={{ fontSize:11.5,color:"var(--text2)",marginTop:6 }}>User will be prompted to change this on first login.</div>
                  </div>
                </div>
              )}
              <div className="card">
                <div className="card-header"><span style={{ fontWeight:700 }}>Account Status</span></div>
                <div className="card-body">
                  <div style={{ display:"flex",gap:10 }}>
                    {[{v:"active",label:"Active",icon:ic.check,col:"#3dba7e"},{v:"inactive",label:"Deactivated",icon:ic.userX,col:"#e85a3a"},{v:"pending",label:"Pending",icon:ic.timer,col:"#e8c53a"}].map(s=>(
                      <div key={s.v} onClick={()=>set("status",s.v)}
                        style={{ flex:1,padding:"10px 12px",borderRadius:"var(--radius-sm)",border:`2px solid ${form.status===s.v?s.col:"var(--border)"}`,background:form.status===s.v?`${s.col}15`:"var(--surface2)",cursor:"pointer",textAlign:"center",transition:"all .15s" }}>
                        <Icon d={s.icon} size={16} stroke={form.status===s.v?s.col:"var(--text2)"} />
                        <div style={{ fontSize:12,fontWeight:600,marginTop:5,color:form.status===s.v?s.col:"var(--text2)" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!form.firstName||!form.email}>
            <Icon d={ic.check} size={14} /> {isNew?"Add User & Confirm Charge":"Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BillingHistoryModal({ monthlyTotal, signupDate, cycle, onClose }) {
  const anchorDay = new Date(signupDate||"2025-03-11").getDate();
  const isAnnual  = cycle === "annual";
  const invoices  = Array.from({ length: isAnnual ? 3 : 12 }, (_, i) => {
    const d = new Date();
    if (isAnnual) {
      d.setFullYear(d.getFullYear() - (i + 1));
      d.setDate(anchorDay);
    } else {
      d.setMonth(d.getMonth() - (i + 1));
      d.setDate(anchorDay);
    }
    return {
      id: `INV-${2025000 + (12 - i)}`,
      date: isAnnual
        ? d.toLocaleDateString("en-US", { month:"long", year:"numeric" })
        : d.toLocaleDateString("en-US", { month:"long", year:"numeric" }),
      amount: isAnnual ? monthlyTotal * 12 : monthlyTotal,
      status: "Paid",
    };
  });

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div className="modal-title"><Icon d={ic.creditCard} size={16} /> Billing History</div>
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22} /></button>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          <div className="bill-row" style={{ display: "grid", gridTemplateColumns: "1fr 120px 80px 80px", padding: "9px 18px", borderBottom: "1px solid var(--border)", fontSize: 11.5, fontWeight: 700, color: "var(--text2)" }}>
            <span>Invoice</span><span>Date</span><span style={{ textAlign: "right" }}>Amount</span><span style={{ textAlign: "right" }}>Status</span>
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {invoices.map((inv, i) => (
              <div key={inv.id} className="bill-row" style={{ display: "grid", gridTemplateColumns: "1fr 120px 80px 80px", padding: "11px 18px", borderBottom: i < invoices.length - 1 ? "1px solid var(--border)" : "none", alignItems: "center", fontSize: 13, transition: "background .1s" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ fontWeight: 600, color: "var(--accent)", cursor: "pointer", fontSize: 12.5 }}>{inv.id}</span>
                <span style={{ color: "var(--text2)", fontSize: 12.5 }}>{inv.date}</span>
                <span style={{ textAlign: "right", fontWeight: 600 }}>${inv.amount}.00</span>
                <span style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "#3dba7e18", color: "#3dba7e" }}>{inv.status}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>Showing last 12 months</span>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function UpdateCardModal({ current, onSave, onClose }) {
  const [num,    setNum]    = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc,    setCvc]    = useState("");
  const [name,   setName]   = useState("");
  const [errors, setErrors] = useState({});
  const [saved,  setSaved]  = useState(false);

  const detectBrand = (n) => {
    const d = n.replace(/\D/g,"");
    if (/^4/.test(d))            return "Visa";
    if (/^5[1-5]/.test(d))       return "Mastercard";
    if (/^3[47]/.test(d))        return "Amex";
    if (/^6(?:011|5)/.test(d))   return "Discover";
    return "Card";
  };

  const fmtNum = (v) => {
    const d = v.replace(/\D/g,"").slice(0,16);
    return d.replace(/(.{4})/g,"$1 ").trim();
  };
  const fmtExpiry = (v) => {
    const d = v.replace(/\D/g,"").slice(0,4);
    return d.length > 2 ? d.slice(0,2)+"/"+d.slice(2) : d;
  };

  const validate = () => {
    const e = {};
    const digits = num.replace(/\D/g,"");
    if (digits.length < 13) e.num = "Enter a valid card number";
    const parts = expiry.split("/");
    const mm = parts[0], yy = parts[1];
    if (!mm||!yy||+mm<1||+mm>12||+("20"+yy)<new Date().getFullYear()) e.expiry = "Enter a valid expiry";
    if (cvc.length < 3) e.cvc = "Enter a valid CVC";
    if (!name.trim()) e.name = "Enter the cardholder name";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const digits = num.replace(/\D/g,"");
    setSaved(true);
    setTimeout(() => onSave({ brand:detectBrand(num), last4:digits.slice(-4), displayExpiry:expiry }), 800);
  };

  const brand = detectBrand(num);
  const brandColor = {Visa:"#1a1f71",Mastercard:"#eb001b",Amex:"#007bc1",Discover:"#ff6600"}[brand]||"var(--accent)";

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:420 }}>
        <div className="modal-header">
          <div className="modal-title"><Icon d={ic.creditCard} size={16}/> Update Payment Method</div>
          <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22}/></button>
        </div>
        <div className="modal-body" style={{ display:"flex",flexDirection:"column",gap:16 }}>

          {/* Card preview */}
          <div style={{ background:"linear-gradient(135deg,#1a1f2e,#2a3050)",borderRadius:12,padding:"18px 20px",color:"white",position:"relative",overflow:"hidden",minHeight:110 }}>
            <div style={{ position:"absolute",top:-20,right:-20,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,.05)" }}/>
            <div style={{ position:"absolute",bottom:-30,right:30,width:80,height:80,borderRadius:"50%",background:"rgba(255,255,255,.04)" }}/>
            <div style={{ fontSize:11,letterSpacing:".12em",opacity:.7,marginBottom:10,fontWeight:600 }}>PAYMENT METHOD</div>
            <div style={{ fontSize:15,fontWeight:700,letterSpacing:".18em",marginBottom:14,fontFamily:"monospace" }}>
              {num ? num.padEnd(19,"·").slice(0,19) : "•••• •••• •••• ••••"}
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-end" }}>
              <div>
                <div style={{ fontSize:9,opacity:.6,letterSpacing:".1em" }}>CARDHOLDER</div>
                <div style={{ fontSize:12,fontWeight:600 }}>{name||"YOUR NAME"}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:9,opacity:.6,letterSpacing:".1em" }}>EXPIRES</div>
                <div style={{ fontSize:12,fontWeight:600 }}>{expiry||"MM/YY"}</div>
              </div>
              {num && <div style={{ fontSize:13,fontWeight:800,color:brandColor,background:"white",padding:"3px 8px",borderRadius:6 }}>{brand}</div>}
            </div>
          </div>

          <div>
            <div className="form-label">Card Number</div>
            <input className="form-input" placeholder="1234 5678 9012 3456" value={num}
              onChange={e=>setNum(fmtNum(e.target.value))} maxLength={19}
              style={{ fontFamily:"monospace",letterSpacing:".08em",borderColor:errors.num?"#e85a3a":"" }}/>
            {errors.num && <div style={{ fontSize:11.5,color:"#e85a3a",marginTop:4 }}>{errors.num}</div>}
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <div>
              <div className="form-label">Expiry Date</div>
              <input className="form-input" placeholder="MM/YY" value={expiry}
                onChange={e=>setExpiry(fmtExpiry(e.target.value))} maxLength={5}
                style={{ borderColor:errors.expiry?"#e85a3a":"" }}/>
              {errors.expiry && <div style={{ fontSize:11.5,color:"#e85a3a",marginTop:4 }}>{errors.expiry}</div>}
            </div>
            <div>
              <div className="form-label">CVC</div>
              <input className="form-input" placeholder="•••" value={cvc} type="password"
                onChange={e=>setCvc(e.target.value.replace(/\D/g,"").slice(0,4))}
                style={{ borderColor:errors.cvc?"#e85a3a":"" }}/>
              {errors.cvc && <div style={{ fontSize:11.5,color:"#e85a3a",marginTop:4 }}>{errors.cvc}</div>}
            </div>
          </div>

          <div>
            <div className="form-label">Cardholder Name</div>
            <input className="form-input" placeholder="Name on card" value={name}
              onChange={e=>setName(e.target.value)}
              style={{ borderColor:errors.name?"#e85a3a":"" }}/>
            {errors.name && <div style={{ fontSize:11.5,color:"#e85a3a",marginTop:4 }}>{errors.name}</div>}
          </div>

          <div style={{ display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--text3)" }}>
            <Icon d={ic.lock} size={12}/> Your card details are encrypted and stored securely.
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} style={{ minWidth:130 }}>
            {saved ? <><Icon d={ic.check} size={14}/> Saved!</> : <><Icon d={ic.creditCard} size={14}/> Save Card</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountPage({ settings, onSettingsChange, projects, users, onUsersChange, onProjectsChange, onNotify }) {
  const [tab, setTab]         = useState("team");
  const [editingUser, setEditingUser] = useState(null);
  const [addingUser, setAddingUser]   = useState(false);
  const [viewingUser, setViewingUser] = useState(null); // user id being viewed inline
  const [viewingAdmin, setViewingAdmin] = useState(false); // admin self-edit panel
  const [adminForm, setAdminForm] = useState(null); // working copy of admin profile
  const [adminEditingCert, setAdminEditingCert] = useState(null);
  const [adminCertImgPreview, setAdminCertImgPreview] = useState(null);
  const [confirmDel, setConfirmDel]   = useState(null);
  const [searchQ, setSearchQ]         = useState("");
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardInfo, setCardInfo] = useState({ number:"", expiry:"", cvc:"", name:"", brand:"Visa", last4:"4242", displayExpiry:"08/27" });
  const [showBillingHistory, setShowBillingHistory] = useState(false);
  const [confirmUpgrade,   setConfirmUpgrade]   = useState(false);
  const [confirmDowngrade, setConfirmDowngrade] = useState(false);

  const activeUsers   = users.filter(u => u.status !== "inactive");
  const isPro         = settings?.plan === "pro";
  const cycle         = settings?.billingCycle || "monthly";
  const prices        = PRICING[cycle][settings?.plan || "base"];
  const adminSeat     = prices.admin;
  const userSeat      = prices.user;
  const monthlyTotal  = adminSeat + (users.filter(u=>u.status!=="inactive").length * userSeat);

  // Fire cert expiry notifications on mount and whenever users change
  const notifiedCertsRef = React.useRef(new Set());
  React.useEffect(() => {
    if (!onNotify) return;
    users.forEach(u => {
      (u.certifications||[]).forEach(cert => {
        const status = getCertStatus(cert.dateExpires);
        if (status === "valid" || status === "no-expiry") return;
        const key = `${u.id}-${cert.id}-${status}`;
        if (notifiedCertsRef.current.has(key)) return;
        notifiedCertsRef.current.add(key);
        const name = `${u.firstName||""} ${u.lastName||""}`.trim();
        const days = Math.ceil((new Date(cert.dateExpires+"T00:00:00") - new Date().setHours(0,0,0,0)) / 86400000);
        const meta = CERT_STATUS_META[status];
        onNotify({
          id: uid(),
          author: "Certification Alert",
          authorInitials: "⚠",
          authorColor: meta.color,
          action: status==="expired" ? "certification expired" : "certification expiring",
          context: cert.name,
          preview: status==="expired"
            ? `${name}'s "${cert.name}" expired ${Math.abs(days)} day${Math.abs(days)!==1?"s":""} ago`
            : `${name}'s "${cert.name}" expires in ${days} day${days!==1?"s":""}`,
          date: today(),
          read: false,
          type: "cert-alert",
          certStatus: status,
        });
      });
    });
  }, [users]);

  const saveUser = (u) => {
    const exists = users.find(x => x.id === u.id);
    onUsersChange(exists ? users.map(x => x.id===u.id ? u : x) : [...users, u]);

    // Sync user.assignedProjects → each project's assignedUserIds
    if (onProjectsChange) {
      onProjectsChange(prev => prev.map(proj => {
        const userWantsThisProject = (u.assignedProjects||[]).includes(proj.id);
        const projHasUser          = (proj.assignedUserIds||[]).includes(u.id);
        if (userWantsThisProject && !projHasUser)
          return { ...proj, assignedUserIds: [...(proj.assignedUserIds||[]), u.id] };
        if (!userWantsThisProject && projHasUser)
          return { ...proj, assignedUserIds: (proj.assignedUserIds||[]).filter(id => id !== u.id) };
        return proj;
      }));
    }

    // Fire notifications for newly assigned projects
    if (onNotify) {
      const prevUser           = users.find(x => x.id === u.id);
      const prevProjectIds     = prevUser?.assignedProjects || [];
      const newlyAssignedProjs = (u.assignedProjects||[]).filter(pid => !prevProjectIds.includes(pid));
      const isNewUser          = !prevUser;
      const assignerName       = `${settings?.userFirstName||""} ${settings?.userLastName||""}`.trim() || "Admin";
      const assignerInitials   = assignerName.split(" ").map(w=>w[0]||"").join("").slice(0,2).toUpperCase() || "AD";
      const userName           = `${u.firstName||""} ${u.lastName||""}`.trim();
      newlyAssignedProjs.forEach(pid => {
        const proj = projects.find(p => p.id === pid);
        if (!proj) return;
        onNotify({
          id: uid(),
          author: assignerName,
          authorInitials: assignerInitials,
          authorColor: "var(--accent)",
          action: isNewUser ? "added you to jobsite" : "assigned you to jobsite",
          context: proj.title,
          preview: userName
            ? `${userName} — assigned to: ${proj.title}`
            : `You've been assigned to "${proj.title}"`,
          date: today(),
          read: false,
          type: "assignment",
        });
      });
    }

    setEditingUser(null); setAddingUser(false);
  };
  const removeUser = (id) => {
    onUsersChange(users.filter(u => u.id !== id));
    if (onProjectsChange) {
      onProjectsChange(prev => prev.map(proj => ({
        ...proj,
        assignedUserIds: (proj.assignedUserIds||[]).filter(uid => uid !== id)
      })));
    }
    setConfirmDel(null);
  };

  const filtered = users.filter(u => {
    const q = searchQ.toLowerCase();
    return !q || `${u.firstName} ${u.lastName} ${u.email} ${u.role} ${u.title}`.toLowerCase().includes(q);
  });

  const TABS = [
    { id:"team",    label:"Team Members", icon:ic.users       },
    { id:"billing", label:"Billing",      icon:ic.creditCard  },
    { id:"perms",   label:"Permissions",  icon:ic.sliders     },
  ];

  const RoleBadge = ({role}) => {
    const m = ROLE_META[role]||ROLE_META.user;
    return <span style={{ fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:20,background:`${m.color}18`,color:m.color }}>{m.label}</span>;
  };
  const StatusDot = ({status}) => {
    const col = status==="active"?"#3dba7e":status==="pending"?"#e8c53a":"#e85a3a";
    const lbl = status==="active"?"Active":status==="pending"?"Pending":"Deactivated";
    return <span style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,color:col,fontWeight:600 }}><span style={{ width:7,height:7,borderRadius:"50%",background:col,display:"inline-block" }}/>{lbl}</span>;
  };

  return (
    <div className="page fade-in" style={{ maxWidth:860 }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:6 }}>
          <div style={{ width:40,height:40,borderRadius:12,background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
            <Icon d={ic.shield} size={20} stroke="white" />
          </div>
          <div>
            <div className="section-title" style={{ marginBottom:0 }}>Account Management</div>
            <div className="section-sub" style={{ marginBottom:0 }}>Admin-only · Manage your team, billing, and permissions</div>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginTop:20 }} className="account-stats-grid">
          {[
            { label:"Team Members",    val:users.length,                      icon:ic.users,      col:"#8b7cf8" },
            { label:"Active Users",    val:activeUsers.length,                icon:ic.check,      col:"#3dba7e" },
            { label:"Monthly Cost",    val:`$${monthlyTotal}/mo`,             icon:ic.creditCard, col:"var(--accent)" },
            { label:"Projects",        val:projects.length,                   icon:ic.folder,     col:"#3ab8e8" },
          ].map(s=>(
            <div key={s.label} style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:"14px 16px",display:"flex",alignItems:"center",gap:12 }}>
              <div style={{ width:36,height:36,borderRadius:10,background:`${s.col}18`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <Icon d={s.icon} size={16} stroke={s.col} />
              </div>
              <div>
                <div style={{ fontSize:18,fontWeight:800,color:"var(--text)",lineHeight:1.1 }}>{s.val}</div>
                <div style={{ fontSize:11.5,color:"var(--text2)",marginTop:2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex",borderBottom:"1px solid var(--border)",marginBottom:24 }}>
        {TABS.map(t=>(
          <button key={t.id} className="btn btn-ghost btn-sm" onClick={()=>setTab(t.id)}
            style={{ borderBottom:`2px solid ${tab===t.id?"var(--accent)":"transparent"}`,borderRadius:0,paddingBottom:12,paddingLeft:10,paddingRight:10,color:tab===t.id?"var(--accent)":"var(--text2)",fontWeight:tab===t.id?700:500,gap:5,flex:1,justifyContent:"center",fontSize:12.5 }}>
            <Icon d={t.icon} size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* ── TEAM MEMBERS ── */}
      {tab==="team" && (
        <div className="fade-in">
          <div style={{ display:"flex",gap:10,marginBottom:18,alignItems:"center" }}>
            <input className="form-input" style={{ flex:1,maxWidth:320 }} placeholder="Search users…" value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={()=>setAddingUser(true)}>
              <Icon d={ic.userPlus} size={14} /> Add User <span style={{ opacity:.7,fontSize:11 }}>+${PRICING.monthly.base.user}/mo</span>
            </button>
          </div>

          {/* Admin row — clickable self-edit */}
          {(() => {
            const accentColor = ROLE_META.admin.color;
            const adminInitials = `${settings.userFirstName?.[0]||"A"}${settings.userLastName?.[0]||""}`.toUpperCase();
            const adminCerts = adminForm?.certifications || settings.userCertifications || [];
            const certAlertCount = adminCerts.filter(c => ["expired","expiring-soon","expiring-warning"].includes(getCertStatus(c.dateExpires))).length;
            const adminAssignedProjs = (adminForm?.assignedProjects || settings.userAssignedProjects || []).map(pid => projects.find(p=>p.id===pid)).filter(Boolean);

            const openAdmin = () => {
              setAdminForm({
                firstName:     settings.userFirstName || "",
                lastName:      settings.userLastName  || "",
                email:         settings.userEmail     || "",
                title:         settings.userTitle     || "",
                phone:         settings.userPhone     || "",
                mobile:        settings.userMobile    || "",
                address:       settings.userAddress   || "",
                city:          settings.userCity      || "",
                state:         settings.userState     || "",
                zip:           settings.userZip       || "",
                avatar:        settings.userAvatar    || null,
                certifications: settings.userCertifications || [],
                assignedProjects: settings.userAssignedProjects || [],
                notes:         settings.userNotes     || "",
              });
              setAdminEditingCert(null);
              setAdminCertImgPreview(null);
              setViewingAdmin(true);
              setViewingUser(null);
            };

            const closeAdmin = () => { setViewingAdmin(false); setAdminForm(null); };

            const saveAdmin = () => {
              if (!adminForm) return;
              // Sync project assignments
              if (onProjectsChange) {
                onProjectsChange(prev => prev.map(proj => {
                  const wants = (adminForm.assignedProjects||[]).includes(proj.id);
                  const has   = (proj.assignedAdminIds||[]).length > 0; // admin always has full access anyway
                  return proj;
                }));
              }
              onSettingsChange({
                ...settings,
                userFirstName:        adminForm.firstName,
                userLastName:         adminForm.lastName,
                userEmail:            adminForm.email,
                userTitle:            adminForm.title,
                userPhone:            adminForm.phone,
                userMobile:           adminForm.mobile,
                userAddress:          adminForm.address,
                userCity:             adminForm.city,
                userState:            adminForm.state,
                userZip:              adminForm.zip,
                userAvatar:           adminForm.avatar,
                userCertifications:   adminForm.certifications,
                userAssignedProjects: adminForm.assignedProjects,
                userNotes:            adminForm.notes,
              });
              closeAdmin();
            };

            const setAF = (key, val) => setAdminForm(f => ({...f, [key]: val}));

            return (
              <div style={{ background:"var(--surface)", border:`1px solid ${viewingAdmin ? accentColor : "var(--border)"}`, borderRadius:"var(--radius)", overflow:"hidden", marginBottom:12, boxShadow: viewingAdmin ? `0 0 0 3px ${accentColor}22` : "none", transition:"border-color .15s,box-shadow .15s" }}>

                {/* Header band */}
                <div style={{ padding:"11px 16px", background:`${accentColor}0e`, borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:8 }}>
                  <Icon d={ic.shield} size={14} stroke={accentColor} />
                  <span style={{ fontSize:12, fontWeight:700, color:accentColor }}>Account Owner</span>
                  <span style={{ fontSize:11, color:"var(--text3)", marginLeft:"auto" }}>Included in {PLAN_NAMES[settings?.plan||"base"]}</span>
                </div>

                {/* Clickable summary row */}
                <div style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", cursor:"pointer" }}
                  onClick={() => viewingAdmin ? closeAdmin() : openAdmin()}>
                  <div style={{ width:40, height:40, borderRadius:"50%", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:14, color:"white", flexShrink:0, overflow:"hidden", border:`2px solid ${accentColor}`, boxShadow:`0 0 0 2px ${accentColor}33` }}>
                    {settings.userAvatar ? <img src={settings.userAvatar} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} /> : adminInitials}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:14, display:"flex", alignItems:"center", gap:8 }}>
                      {settings.userFirstName} {settings.userLastName}
                      <span style={{ fontSize:11, color:"var(--text3)", fontWeight:400 }}>(you)</span>
                      {certAlertCount > 0 && <span style={{ fontSize:10, fontWeight:800, padding:"1px 6px", borderRadius:8, background:"#e85a3a22", color:"#e85a3a", border:"1px solid #e85a3a44" }}>⚠ {certAlertCount} cert{certAlertCount!==1?"s":""}</span>}
                    </div>
                    <div style={{ fontSize:12, color:"var(--text2)" }}>{settings.userEmail} · {settings.userTitle||"Administrator"}</div>
                  </div>
                  <RoleBadge role="admin" />
                  <StatusDot status="active" />
                  <span style={{ fontSize:12, color:"var(--text3)", marginLeft:4 }}>{viewingAdmin ? "▲" : "▼"}</span>
                </div>

                {/* ── Expanded self-edit panel ── */}
                {viewingAdmin && adminForm && (
                  <div style={{ borderTop:"1px solid var(--border)", display:"flex", flexWrap:"wrap" }}>

                    {/* Left sidebar */}
                    <div style={{ width:200, flexShrink:0, background:`${accentColor}08`, borderRight:"1px solid var(--border)", padding:"20px 16px", display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
                      {/* Avatar */}
                      <div style={{ position:"relative" }}>
                        <div style={{ width:72, height:72, borderRadius:"50%", background:accentColor, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, fontWeight:700, color:"white", overflow:"hidden", border:`3px solid ${accentColor}`, boxShadow:"0 0 0 3px var(--surface)" }}>
                          {adminForm.avatar ? <img src={adminForm.avatar} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} /> : `${adminForm.firstName?.[0]||""}${adminForm.lastName?.[0]||""}`.toUpperCase()}
                        </div>
                        <label style={{ position:"absolute", bottom:0, right:0, width:22, height:22, borderRadius:"50%", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", border:"2px solid var(--surface)" }}>
                          <Icon d={ic.camera} size={11} stroke="white" />
                          <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{
                            const f = e.target.files?.[0]; if(!f) return;
                            const r = new FileReader(); r.onload=ev=>setAF("avatar",ev.target.result); r.readAsDataURL(f);
                          }} />
                        </label>
                      </div>
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontWeight:700, fontSize:13 }}>{adminForm.firstName} {adminForm.lastName}</div>
                        <div style={{ fontSize:11, color:accentColor, fontWeight:700 }}>Administrator</div>
                      </div>
                      {adminForm.avatar && (
                        <button className="btn btn-ghost btn-sm" style={{ fontSize:11, color:"var(--text3)", padding:"3px 8px" }} onClick={()=>setAF("avatar",null)}>Remove Photo</button>
                      )}
                      <div style={{ width:"100%", borderTop:"1px solid var(--border)", paddingTop:12, display:"flex", flexDirection:"column", gap:8 }}>
                        <button className="btn btn-primary btn-sm" style={{ width:"100%", gap:5, justifyContent:"center", fontSize:12 }} onClick={saveAdmin}>
                          <Icon d={ic.check} size={13} /> Save Changes
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ width:"100%", gap:5, justifyContent:"center", fontSize:12 }} onClick={closeAdmin}>
                          Cancel
                        </button>
                      </div>
                    </div>

                    {/* Right: scrollable edit sections */}
                    <div style={{ flex:1, minWidth:0, background:"var(--surface2)", overflowY:"auto", maxHeight:600 }}>

                      {/* Profile */}
                      <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)" }}>
                        <div style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", color:"var(--text3)", marginBottom:12, display:"flex", alignItems:"center", gap:7 }}>
                          <Icon d={ic.user} size={11} stroke="var(--text3)" /> Profile
                        </div>
                        <div className="form-row" style={{ marginBottom:10 }}>
                          <div className="form-group">
                            <label className="form-label">First Name</label>
                            <input className="form-input" value={adminForm.firstName} onChange={e=>setAF("firstName",e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Last Name</label>
                            <input className="form-input" value={adminForm.lastName} onChange={e=>setAF("lastName",e.target.value)} />
                          </div>
                        </div>
                        <div className="form-row" style={{ marginBottom:10 }}>
                          <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" type="email" value={adminForm.email} onChange={e=>setAF("email",e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Job Title</label>
                            <input className="form-input" value={adminForm.title} onChange={e=>setAF("title",e.target.value)} />
                          </div>
                        </div>
                        <div className="form-row" style={{ marginBottom:0 }}>
                          <div className="form-group">
                            <label className="form-label">Mobile</label>
                            <input className="form-input" value={adminForm.mobile} onChange={e=>setAF("mobile",e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Office Phone</label>
                            <input className="form-input" value={adminForm.phone} onChange={e=>setAF("phone",e.target.value)} />
                          </div>
                        </div>
                      </div>

                      {/* Address */}
                      <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)" }}>
                        <div style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", color:"var(--text3)", marginBottom:12, display:"flex", alignItems:"center", gap:7 }}>
                          <Icon d={ic.mapPin} size={11} stroke="var(--text3)" /> Address
                        </div>
                        <div className="form-group" style={{ marginBottom:10 }}>
                          <label className="form-label">Street Address</label>
                          <input className="form-input" value={adminForm.address} onChange={e=>setAF("address",e.target.value)} placeholder="123 Main St" />
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">City</label>
                            <input className="form-input" value={adminForm.city} onChange={e=>setAF("city",e.target.value)} />
                          </div>
                          <div className="form-group" style={{ maxWidth:80 }}>
                            <label className="form-label">State</label>
                            <input className="form-input" value={adminForm.state} onChange={e=>setAF("state",e.target.value)} />
                          </div>
                          <div className="form-group" style={{ maxWidth:90 }}>
                            <label className="form-label">ZIP</label>
                            <input className="form-input" value={adminForm.zip} onChange={e=>setAF("zip",e.target.value)} />
                          </div>
                        </div>
                      </div>

                      {/* Certifications */}
                      <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)" }}>
                        <div style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", color:"var(--text3)", marginBottom:12, display:"flex", alignItems:"center", gap:7 }}>
                          <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={11} stroke="var(--text3)" />
                          Certifications ({adminForm.certifications.length})
                        </div>

                        {/* Alert banner */}
                        {adminForm.certifications.some(c=>["expired","expiring-soon"].includes(getCertStatus(c.dateExpires))) && (
                          <div style={{ padding:"8px 12px", background:"#e85a3a18", border:"1px solid #e85a3a44", borderRadius:7, fontSize:12, color:"#e85a3a", marginBottom:12 }}>
                            ⚠ One or more certifications need attention.
                          </div>
                        )}

                        {/* Cert list */}
                        {adminForm.certifications.length > 0 && !adminEditingCert && (
                          <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
                            {adminForm.certifications.map(cert => {
                              const status = getCertStatus(cert.dateExpires);
                              const sm = CERT_STATUS_META[status];
                              const days = cert.dateExpires ? Math.ceil((new Date(cert.dateExpires+"T00:00:00") - new Date().setHours(0,0,0,0)) / 86400000) : null;
                              return (
                                <div key={cert.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"var(--surface)", borderRadius:8, border:`1px solid ${sm.border}` }}>
                                  {cert.image && <img src={cert.image} alt="" style={{ width:32, height:32, borderRadius:5, objectFit:"cover", flexShrink:0 }} />}
                                  <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                                      <span style={{ fontWeight:700, fontSize:13 }}>{cert.name||"Unnamed"}</span>
                                      {cert.certCode && <span style={{ fontSize:10, fontWeight:800, padding:"0 6px", borderRadius:4, background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)", fontFamily:"monospace" }}>{cert.certCode}</span>}
                                      <span style={{ fontSize:10.5, fontWeight:700, padding:"1px 8px", borderRadius:10, background:sm.bg, color:sm.color, border:`1px solid ${sm.border}` }}>
                                        {status==="expired" ? `Expired ${Math.abs(days)}d ago` : status==="expiring-soon"||status==="expiring-warning" ? `${days}d left` : sm.label}
                                      </span>
                                    </div>
                                    {cert.certifyingBody && <div style={{ fontSize:11, color:"var(--text3)" }}>{cert.certifyingBody}</div>}
                                  </div>
                                  <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                                    <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:"3px 8px" }}
                                      onClick={()=>{ setAdminEditingCert({...cert}); setAdminCertImgPreview(cert.image||null); }}>Edit</button>
                                    <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:"3px 8px", color:"#e85a3a" }}
                                      onClick={()=>setAF("certifications", adminForm.certifications.filter(c=>c.id!==cert.id))}>Delete</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Add cert button */}
                        {!adminEditingCert && (
                          <button className="btn btn-secondary btn-sm" onClick={()=>{ setAdminEditingCert({...EMPTY_CERT, id:uid()}); setAdminCertImgPreview(null); }}>
                            <Icon d={ic.plus} size={13} /> {adminForm.certifications.length===0 ? "Add First Certification" : "Add Certification"}
                          </button>
                        )}

                        {/* Inline cert form */}
                        {adminEditingCert && (
                          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:"14px 16px", marginTop:8 }}>
                            {/* Image upload */}
                            <div style={{ display:"flex", gap:14, alignItems:"flex-start", marginBottom:14 }}>
                              <label style={{ width:64, height:64, borderRadius:8, border:"2px dashed var(--border)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer", background:"var(--surface2)", overflow:"hidden", flexShrink:0 }}>
                                {adminCertImgPreview
                                  ? <img src={adminCertImgPreview} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                                  : <><Icon d={ic.camera} size={18} stroke="var(--text3)" /><span style={{ fontSize:10,color:"var(--text3)",marginTop:4 }}>Upload</span></>
                                }
                                <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{
                                  const f=e.target.files?.[0]; if(!f) return;
                                  const r=new FileReader(); r.onload=ev=>{ setAdminCertImgPreview(ev.target.result); setAdminEditingCert(ec=>({...ec,image:ev.target.result})); }; r.readAsDataURL(f);
                                }} />
                              </label>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:12, color:"var(--text2)", lineHeight:1.5 }}>Upload a photo of this certification card or document. Optional but recommended.</div>
                                {adminCertImgPreview && <button className="btn btn-ghost btn-sm" style={{ fontSize:11,marginTop:6,color:"var(--text3)" }} onClick={()=>{ setAdminCertImgPreview(null); setAdminEditingCert(ec=>({...ec,image:null})); }}>Remove image</button>}
                              </div>
                            </div>

                            {/* Name + Code */}
                            <div className="form-row" style={{ marginBottom:10 }}>
                              <div className="form-group" style={{ flex:2 }}>
                                <label className="form-label">Certification Name *</label>
                                <input className="form-input" placeholder="e.g. Water Restoration Technician" value={adminEditingCert.name}
                                  onChange={e=>setAdminEditingCert(ec=>({...ec,name:e.target.value}))} />
                              </div>
                              <div className="form-group" style={{ flex:1 }}>
                                <label className="form-label">Code <span style={{ fontSize:11,color:"var(--text3)",fontWeight:400 }}>(abbrev.)</span></label>
                                <input className="form-input" placeholder="WRT" value={adminEditingCert.certCode||""}
                                  onChange={e=>setAdminEditingCert(ec=>({...ec,certCode:e.target.value.toUpperCase()}))}
                                  style={{ fontFamily:"monospace",letterSpacing:".06em",textTransform:"uppercase" }} />
                              </div>
                            </div>

                            {/* Issuing org */}
                            <div className="form-group" style={{ marginBottom:10 }}>
                              <label className="form-label">Certifying Body / Issuing Organization</label>
                              <input className="form-input" placeholder="e.g. IICRC, OSHA, Red Cross" value={adminEditingCert.certifyingBody}
                                onChange={e=>setAdminEditingCert(ec=>({...ec,certifyingBody:e.target.value}))} />
                            </div>

                            {/* Dates */}
                            <div className="form-row" style={{ marginBottom:12 }}>
                              <div className="form-group">
                                <label className="form-label">Date Certified</label>
                                <input className="form-input" type="date" value={adminEditingCert.dateCertified}
                                  onChange={e=>setAdminEditingCert(ec=>({...ec,dateCertified:e.target.value}))} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Expiry Date <span style={{ fontWeight:400,color:"var(--text3)",fontSize:11 }}>(optional)</span></label>
                                <input className="form-input" type="date" value={adminEditingCert.dateExpires}
                                  onChange={e=>setAdminEditingCert(ec=>({...ec,dateExpires:e.target.value}))} />
                              </div>
                            </div>

                            {/* Live status preview */}
                            {adminEditingCert.dateExpires && (() => {
                              const s2=getCertStatus(adminEditingCert.dateExpires); const sm2=CERT_STATUS_META[s2];
                              return <div style={{ fontSize:11,padding:"4px 10px",borderRadius:8,background:sm2.bg,color:sm2.color,border:`1px solid ${sm2.border}`,display:"inline-block",marginBottom:12 }}>{sm2.label}</div>;
                            })()}

                            <div style={{ display:"flex", gap:8 }}>
                              <button className="btn btn-ghost btn-sm" onClick={()=>{ setAdminEditingCert(null); setAdminCertImgPreview(null); }}>Cancel</button>
                              <button className="btn btn-primary btn-sm" disabled={!adminEditingCert.name}
                                onClick={()=>{
                                  const existing = adminForm.certifications.find(c=>c.id===adminEditingCert.id);
                                  const updated = existing
                                    ? adminForm.certifications.map(c=>c.id===adminEditingCert.id ? adminEditingCert : c)
                                    : [...adminForm.certifications, adminEditingCert];
                                  setAF("certifications", updated);
                                  setAdminEditingCert(null); setAdminCertImgPreview(null);
                                }}>
                                <Icon d={ic.check} size={13} /> {adminForm.certifications.find(c=>c.id===adminEditingCert.id) ? "Update" : "Add"} Certification
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Jobsite assignment */}
                      <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)" }}>
                        <div style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", color:"var(--text3)", marginBottom:8, display:"flex", alignItems:"center", gap:7 }}>
                          <Icon d={ic.folder} size={11} stroke="var(--text3)" /> Jobsite Access
                        </div>
                        <div style={{ fontSize:12, color:"var(--accent)", fontWeight:600, padding:"7px 10px", background:"var(--accent-glow)", borderRadius:7, border:"1px solid var(--accent)", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
                          <Icon d={ic.shield} size={13} stroke="var(--accent)" /> As Account Owner, you have full access to all jobsites.
                        </div>
                        <div style={{ fontSize:11, color:"var(--text3)", marginBottom:8 }}>You can optionally tag specific jobsites you're personally responsible for:</div>
                        {/* Assigned chips */}
                        {adminAssignedProjs.length > 0 && (
                          <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:10 }}>
                            {adminAssignedProjs.map(p=>(
                              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 10px", background:"var(--surface)", borderRadius:7, border:"1px solid var(--border)" }}>
                                <span style={{ width:9, height:9, borderRadius:"50%", background:p.color, display:"inline-block", flexShrink:0 }} />
                                <span style={{ fontSize:12.5, fontWeight:600, flex:1 }}>{p.title}</span>
                                <button style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 6px", borderRadius:4, color:"var(--text3)", fontSize:16, lineHeight:1 }}
                                  onClick={()=>setAF("assignedProjects",(adminForm.assignedProjects||[]).filter(id=>id!==p.id))}>×</button>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Unassigned picker */}
                        {(() => {
                          const unassigned = projects.filter(p=>!(adminForm.assignedProjects||[]).includes(p.id));
                          if (unassigned.length === 0) return <div style={{ fontSize:12, color:"var(--text3)", fontStyle:"italic" }}>{projects.length===0 ? "No projects yet." : "All jobsites tagged ✓"}</div>;
                          return (
                            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                              {unassigned.map(p=>(
                                <div key={p.id}
                                  style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 10px", background:"var(--surface2)", borderRadius:7, border:"1px solid var(--border)", cursor:"pointer", transition:"border-color .12s,background .12s" }}
                                  onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.background="var(--accent-glow)";}}
                                  onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.background="var(--surface2)";}}
                                  onClick={()=>setAF("assignedProjects",[...(adminForm.assignedProjects||[]),p.id])}>
                                  <span style={{ width:9, height:9, borderRadius:"50%", background:p.color, display:"inline-block", flexShrink:0 }} />
                                  <span style={{ fontSize:12.5, fontWeight:600, flex:1 }}>{p.title}</span>
                                  {p.address && <span style={{ fontSize:11, color:"var(--text3)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:130 }}>{p.address}{p.city?`, ${p.city}`:""}</span>}
                                  <Icon d={ic.plus} size={13} stroke="var(--accent)" />
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Notes */}
                      <div style={{ padding:"16px 20px" }}>
                        <div style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", color:"var(--text3)", marginBottom:8, display:"flex", alignItems:"center", gap:7 }}>
                          <Icon d={ic.text} size={11} stroke="var(--text3)" /> Notes
                        </div>
                        <textarea className="form-input" rows={3} style={{ resize:"vertical" }} placeholder="Personal notes, certifications summary, etc."
                          value={adminForm.notes} onChange={e=>setAF("notes",e.target.value)} />
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Additional users */}
          {filtered.length === 0 && searchQ === "" && (
            <div style={{ textAlign:"center",padding:"48px 20px",background:"var(--surface)",borderRadius:"var(--radius)",border:"2px dashed var(--border)" }}>
              <Icon d={ic.userPlus} size={36} stroke="var(--text3)" />
              <div style={{ fontWeight:700,fontSize:15,marginTop:12,marginBottom:6 }}>No team members yet</div>
              <div style={{ fontSize:13,color:"var(--text2)",marginBottom:18 }}>Add users to collaborate on jobsites. Each additional user is billed at <strong style={{ color:"var(--accent)" }}>${PRICING.monthly.base.user}/mo</strong>.</div>
              <button className="btn btn-primary" onClick={()=>setAddingUser(true)}><Icon d={ic.userPlus} size={14} /> Add First User</button>
            </div>
          )}

          {filtered.map(u => {
            const isViewing = viewingUser === u.id;
            const meta = ROLE_META[u.role] || ROLE_META.user;
            const initials = `${u.firstName?.[0]||""}${u.lastName?.[0]||""}`.toUpperCase() || "?";
            const assignedProjs = (u.assignedProjects||[]).map(pid => projects.find(p=>p.id===pid)).filter(Boolean);
            return (
              <div key={u.id} style={{ background:"var(--surface)",border:`1px solid ${isViewing ? "var(--accent)" : "var(--border)"}`,borderRadius:"var(--radius)",marginBottom:8,opacity:u.status==="inactive"?0.7:1,transition:"border-color .15s,box-shadow .15s",boxShadow:isViewing?"0 0 0 3px var(--accent-glow)":"none",overflow:"hidden" }}>

                {/* ── Clickable summary row ── */}
                <div style={{ display:"flex",alignItems:"center",gap:14,padding:"13px 16px",cursor:"pointer" }}
                  onClick={()=>setViewingUser(isViewing ? null : u.id)}>
                  <div style={{ width:40,height:40,borderRadius:"50%",background:meta.color,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:"white",flexShrink:0 }}>
                    {initials}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:700,fontSize:14,marginBottom:2,display:"flex",alignItems:"center",gap:8 }}>
                      {u.firstName} {u.lastName}
                      {u.status==="inactive" && <span style={{ fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:"rgba(232,90,58,.12)",color:"#e85a3a",border:"1px solid rgba(232,90,58,.25)" }}>Deactivated</span>}
                      {u.status==="pending" && <span style={{ fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:"rgba(232,197,58,.12)",color:"#b8950a",border:"1px solid rgba(232,197,58,.3)" }}>Pending Invite</span>}
                    </div>
                    <div style={{ fontSize:12,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                      {u.email}{u.title ? ` · ${u.title}` : ""}{u.department ? ` · ${u.department}` : ""}
                    </div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:10,flexShrink:0 }}>
                    <RoleBadge role={u.role} />
                    <span style={{ fontSize:12,color:"var(--text3)" }}>${PRICING.monthly.base.user}/mo</span>
                    <Icon d={isViewing ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} size={16} stroke="var(--text3)" />
                  </div>
                </div>

                {/* ── Expanded profile panel ── */}
                {isViewing && (() => {
                  const statusColor = u.status==="active" ? "#3dba7e" : u.status==="pending" ? "#e8c53a" : "#e85a3a";
                  const statusLabel = u.status==="active" ? "Active" : u.status==="pending" ? "Pending Invite" : "Deactivated";
                  return (
                    <div style={{ borderTop:"1px solid var(--border)" }}>

                      {/* ── Accent bar ── */}
                      <div style={{ height:3,background:`linear-gradient(90deg,${meta.color},${meta.color}55,transparent)` }} />

                      <div style={{ display:"flex",gap:0 }}>

                        {/* ── LEFT: profile sidebar ── */}
                        <div style={{ width:200,flexShrink:0,padding:"20px 16px 20px 20px",borderRight:"1px solid var(--border)",background:"var(--surface)",display:"flex",flexDirection:"column",gap:16 }}>

                          {/* Avatar */}
                          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:10,paddingBottom:16,borderBottom:"1px solid var(--border)" }}>
                            <div style={{ width:64,height:64,borderRadius:"50%",background:`linear-gradient(135deg,${meta.color},${meta.color}99)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:22,color:"white",boxShadow:`0 0 0 3px var(--surface), 0 0 0 5px ${meta.color}44` }}>
                              {initials}
                            </div>
                            <div style={{ textAlign:"center" }}>
                              <div style={{ fontWeight:800,fontSize:14,lineHeight:1.3 }}>{u.firstName}<br/>{u.lastName}</div>
                            </div>
                            <RoleBadge role={u.role} />
                            <div style={{ display:"flex",alignItems:"center",gap:5,fontSize:11.5,fontWeight:600,color:statusColor }}>
                              <span style={{ width:6,height:6,borderRadius:"50%",background:statusColor,display:"inline-block" }} />
                              {statusLabel}
                            </div>
                          </div>

                          {/* Quick facts */}
                          <div style={{ display:"flex",flexDirection:"column",gap:11 }}>
                            {u.title && (
                              <div>
                                <div style={{ fontSize:9.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:2 }}>Title</div>
                                <div style={{ fontSize:12,color:"var(--text)",fontWeight:500 }}>{u.title}</div>
                              </div>
                            )}
                            {u.department && (
                              <div>
                                <div style={{ fontSize:9.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:2 }}>Department</div>
                                <div style={{ fontSize:12,color:"var(--text)",fontWeight:500 }}>{u.department}</div>
                              </div>
                            )}
                            {u.employeeId && (
                              <div>
                                <div style={{ fontSize:9.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:2 }}>Employee ID</div>
                                <div style={{ fontSize:12,color:"var(--text)",fontWeight:500 }}>{u.employeeId}</div>
                              </div>
                            )}
                            {u.startDate && (
                              <div>
                                <div style={{ fontSize:9.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:2 }}>Start Date</div>
                                <div style={{ fontSize:12,color:"var(--text)",fontWeight:500 }}>{new Date(u.startDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
                              </div>
                            )}
                            <div>
                              <div style={{ fontSize:9.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:2 }}>Billing</div>
                              <div style={{ fontSize:12,color:"var(--accent)",fontWeight:700 }}>${PRICING.monthly.base.user}/mo</div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ display:"flex",flexDirection:"column",gap:6,marginTop:"auto",paddingTop:14,borderTop:"1px solid var(--border)" }}>
                            <button className="btn btn-primary btn-sm" style={{ width:"100%",gap:5,justifyContent:"center" }}
                              onClick={e=>{e.stopPropagation();setEditingUser(u);}}>
                              <Icon d={ic.edit} size={13} /> Edit Profile
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ width:"100%",gap:5,justifyContent:"center",color:"#e85a3a",fontSize:12 }}
                              onClick={e=>{e.stopPropagation();setConfirmDel(u);}}>
                              <Icon d={ic.userX} size={13} /> Remove User
                            </button>
                          </div>
                        </div>

                        {/* ── RIGHT: detail sections ── */}
                        <div style={{ flex:1,minWidth:0,background:"var(--surface2)" }}>

                          {/* Contact */}
                          <div style={{ padding:"18px 20px",borderBottom:"1px solid var(--border)" }}>
                            <div style={{ fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em",color:"var(--text3)",marginBottom:12,display:"flex",alignItems:"center",gap:7 }}>
                              <Icon d={ic.user} size={11} stroke="var(--text3)" /> Contact
                            </div>
                            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 20px" }}>
                              {u.email && (
                                <div style={{ gridColumn:"1/-1" }}>
                                  <div style={{ fontSize:10,color:"var(--text3)",marginBottom:1 }}>Email</div>
                                  <div style={{ fontSize:13,color:"var(--text)",wordBreak:"break-all" }}>{u.email}</div>
                                </div>
                              )}
                              {u.mobile && (
                                <div>
                                  <div style={{ fontSize:10,color:"var(--text3)",marginBottom:1 }}>Mobile</div>
                                  <div style={{ fontSize:13,color:"var(--text)" }}>{u.mobile}</div>
                                </div>
                              )}
                              {u.phone && (
                                <div>
                                  <div style={{ fontSize:10,color:"var(--text3)",marginBottom:1 }}>Office Phone</div>
                                  <div style={{ fontSize:13,color:"var(--text)" }}>{u.phone}</div>
                                </div>
                              )}
                              {(u.address || u.city) && (
                                <div style={{ gridColumn:"1/-1" }}>
                                  <div style={{ fontSize:10,color:"var(--text3)",marginBottom:1 }}>Address</div>
                                  <div style={{ fontSize:13,color:"var(--text)" }}>{[u.address,u.city,u.state,u.zip].filter(Boolean).join(", ")}</div>
                                </div>
                              )}
                              {!u.email && !u.mobile && !u.phone && !u.address && (
                                <div style={{ gridColumn:"1/-1",fontSize:12,color:"var(--text3)",fontStyle:"italic" }}>No contact details on file</div>
                              )}
                            </div>
                          </div>

                          {/* Certifications */}
                          {(u.certifications||[]).length > 0 && (
                            <div style={{ padding:"0 20px 16px" }}>
                              <div style={{ fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em",color:"var(--text3)",marginBottom:8,display:"flex",alignItems:"center",gap:7 }}>
                                <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={11} stroke="var(--text3)" />
                                Certifications ({u.certifications.length})
                              </div>
                              <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                                {u.certifications.map(cert => {
                                  const status = getCertStatus(cert.dateExpires);
                                  const sm = CERT_STATUS_META[status];
                                  const days = cert.dateExpires ? Math.ceil((new Date(cert.dateExpires+"T00:00:00") - new Date().setHours(0,0,0,0)) / 86400000) : null;
                                  return (
                                    <div key={cert.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:"var(--surface)",borderRadius:7,border:`1px solid ${sm.border}` }}>
                                      {cert.image && <img src={cert.image} alt="" style={{ width:28,height:28,borderRadius:5,objectFit:"cover",flexShrink:0 }} />}
                                      <div style={{ flex:1,minWidth:0 }}>
                                        <div style={{ fontSize:12.5,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6 }}>
                                          {cert.name}
                                          {cert.certCode && <span style={{ fontSize:10,fontWeight:800,padding:"0px 5px",borderRadius:4,background:"var(--surface2)",color:"var(--text3)",border:"1px solid var(--border)",fontFamily:"monospace",flexShrink:0 }}>{cert.certCode}</span>}
                                        </div>
                                        {cert.certifyingBody && <div style={{ fontSize:11,color:"var(--text3)" }}>{cert.certifyingBody}</div>}
                                      </div>
                                      <span style={{ fontSize:10.5,fontWeight:700,padding:"2px 8px",borderRadius:10,background:sm.bg,color:sm.color,border:`1px solid ${sm.border}`,whiteSpace:"nowrap",flexShrink:0 }}>
                                        {status==="expired" ? `Expired ${Math.abs(days)}d ago`
                                          : status==="expiring-soon" ? `${days}d left`
                                          : status==="expiring-warning" ? `${days}d left`
                                          : cert.dateExpires ? sm.label : sm.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Projects */}
                          <div style={{ padding:"18px 20px" }}>
                            <div style={{ fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em",color:"var(--text3)",marginBottom:12,display:"flex",alignItems:"center",gap:7 }}>
                              <Icon d={ic.folder} size={11} stroke="var(--text3)" />
                              {u.role==="admin" || u.role==="manager" ? "Project Access" : `Assigned Projects (${assignedProjs.length})`}
                            </div>
                            {u.role==="admin" || u.role==="manager" ? (
                              <div style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"var(--accent-glow)",borderRadius:8,border:"1px solid var(--accent)" }}>
                                <Icon d={ic.shield} size={13} stroke="var(--accent)" />
                                <span style={{ fontSize:12,color:"var(--accent)",fontWeight:600 }}>Full access to all jobsites</span>
                              </div>
                            ) : (
                              <>
                                {/* Assigned chips with quick-remove */}
                                {assignedProjs.length > 0 && (
                                  <div style={{ display:"flex",flexDirection:"column",gap:5,marginBottom:10 }}>
                                    {assignedProjs.map(p=>(
                                      <div key={p.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:"var(--surface)",borderRadius:7,border:"1px solid var(--border)" }}>
                                        <span style={{ width:9,height:9,borderRadius:"50%",background:p.color,display:"inline-block",flexShrink:0 }} />
                                        <span style={{ fontSize:12.5,fontWeight:600,flex:1 }}>{p.title}</span>
                                        <button style={{ background:"none",border:"none",cursor:"pointer",padding:"2px 6px",borderRadius:4,color:"var(--text3)",fontSize:16,lineHeight:1 }}
                                          title="Remove from project"
                                          onClick={e=>{ e.stopPropagation();
                                            saveUser({...u, assignedProjects:(u.assignedProjects||[]).filter(id=>id!==p.id)});
                                          }}>×</button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* Inline picker: all unassigned projects */}
                                {(() => {
                                  const unassigned = projects.filter(p=>!(u.assignedProjects||[]).includes(p.id));
                                  if (unassigned.length === 0 && assignedProjs.length === 0)
                                    return <div style={{ fontSize:12,color:"var(--text3)",fontStyle:"italic" }}>No projects in the system yet.</div>;
                                  if (unassigned.length === 0)
                                    return <div style={{ fontSize:12,color:"var(--text3)",fontStyle:"italic" }}>All jobsites assigned ✓</div>;
                                  return (
                                    <div>
                                      <div style={{ fontSize:11,color:"var(--text3)",fontWeight:600,marginBottom:7 }}>
                                        {assignedProjs.length > 0 ? "Add more jobsites:" : "Click a jobsite to assign:"}
                                      </div>
                                      <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
                                        {unassigned.map(p=>(
                                          <div key={p.id}
                                            style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:"var(--surface2)",borderRadius:7,border:"1px solid var(--border)",cursor:"pointer",transition:"border-color .12s,background .12s" }}
                                            onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.background="var(--accent-glow)";}}
                                            onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.background="var(--surface2)";}}
                                            onClick={e=>{ e.stopPropagation();
                                              saveUser({...u, assignedProjects:[...(u.assignedProjects||[]), p.id]});
                                            }}>
                                            <span style={{ width:9,height:9,borderRadius:"50%",background:p.color,display:"inline-block",flexShrink:0 }} />
                                            <span style={{ fontSize:12.5,fontWeight:600,flex:1 }}>{p.title}</span>
                                            {p.address && <span style={{ fontSize:11,color:"var(--text3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:130 }}>{p.address}{p.city?`, ${p.city}`:""}</span>}
                                            <Icon d={ic.plus} size={13} stroke="var(--accent)" />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </>
                            )}
                            {u.notes && (
                              <div style={{ marginTop:14 }}>
                                <div style={{ fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em",color:"var(--text3)",marginBottom:6 }}>Notes</div>
                                <div style={{ fontSize:12.5,color:"var(--text2)",lineHeight:1.7,padding:"10px 12px",background:"var(--surface)",borderRadius:8,border:"1px solid var(--border)" }}>{u.notes}</div>
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
          {filtered.length===0 && searchQ && (
            <div style={{ textAlign:"center",padding:32,color:"var(--text3)" }}>No users match "{searchQ}"</div>
          )}
        </div>
      )}

      {/* ── BILLING ── */}
      {tab==="billing" && (
        <div className="fade-in">

          {/* ── Billing cycle toggle ── */}
          <div style={{ display:"flex",alignItems:"center",justifyContent:"center",marginBottom:20 }}>
            <div style={{ display:"inline-flex",alignItems:"center",gap:0,background:"var(--surface2)",borderRadius:40,border:"1px solid var(--border)",padding:3 }}>
              <button onClick={()=>onSettingsChange({...settings,billingCycle:"monthly"})}
                style={{ padding:"7px 22px",borderRadius:36,border:"none",fontWeight:700,fontSize:13,cursor:"pointer",transition:"all .2s",
                  background: cycle==="monthly" ? "var(--accent)" : "transparent",
                  color:       cycle==="monthly" ? "white"         : "var(--text2)" }}>
                Monthly
              </button>
              <button onClick={()=>onSettingsChange({...settings,billingCycle:"annual"})}
                style={{ padding:"7px 22px",borderRadius:36,border:"none",fontWeight:700,fontSize:13,cursor:"pointer",transition:"all .2s",display:"flex",alignItems:"center",gap:7,
                  background: cycle==="annual" ? "var(--accent)" : "transparent",
                  color:       cycle==="annual" ? "white"         : "var(--text2)" }}>
                Annual
                <span style={{ fontSize:10,fontWeight:800,padding:"2px 7px",borderRadius:8,
                  background: cycle==="annual" ? "rgba(255,255,255,.25)" : "#3dba7e22",
                  color:       cycle==="annual" ? "white"                 : "#3dba7e",
                  border:      cycle==="annual" ? "none"                  : "1px solid #3dba7e55" }}>
                  Save up to 15%
                </span>
              </button>
            </div>
          </div>

          {/* ── Current Plan card ── */}
          <div className="card" style={{ marginBottom:16 }}>
            <div className="card-header" style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <span style={{ fontWeight:700 }}>Current Plan</span>
              <span style={{ fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:10,
                background: isPro ? "linear-gradient(135deg,#7c3aed22,#a855f722)" : "var(--surface2)",
                color: isPro ? "#a855f7" : "var(--text3)",
                border: `1px solid ${isPro ? "#a855f750" : "var(--border)"}` }}>
                {isPro ? "✦ FieldPro" : "FieldBase"} · {cycle==="annual" ? "Annual" : "Monthly"}
              </span>
            </div>
            <div className="card-body">
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20 }}>

                {/* FieldBase card */}
                <div style={{ padding:16,background:"var(--surface2)",borderRadius:"var(--radius)",border: !isPro ? "2px solid var(--accent)" : "1px solid var(--border)",position:"relative" }}>
                  {!isPro && <div style={{ position:"absolute",top:-10,left:16,fontSize:10,fontWeight:800,padding:"2px 10px",borderRadius:10,background:"var(--accent)",color:"white",textTransform:"uppercase",letterSpacing:".06em" }}>Current</div>}
                  <div style={{ fontSize:12,fontWeight:700,color:"var(--text2)",marginBottom:6 }}>FieldBase</div>
                  <div style={{ display:"flex",alignItems:"baseline",gap:4,marginBottom:2 }}>
                    <span style={{ fontSize:26,fontWeight:900,color:"var(--text)",lineHeight:1 }}>${PRICING[cycle].base.admin}</span>
                    <span style={{ fontSize:12,color:"var(--text2)" }}>/mo</span>
                  </div>
                  {cycle==="annual" && <div style={{ fontSize:11,color:"#3dba7e",fontWeight:700,marginBottom:2 }}>Save ${(PRICING.monthly.base.admin - PRICING.annual.base.admin)*12}/yr vs monthly</div>}
                  <div style={{ fontSize:11,color:"var(--text3)",marginBottom:12 }}>admin · +${PRICING[cycle].base.user}/user/mo</div>
                  <div style={{ display:"flex",flexDirection:"column",gap:5,marginBottom:12 }}>
                    {["All core features","Unlimited projects","Photo & video capture","Reports & templates","Sketches & checklists"].map(f=>(
                      <div key={f} style={{ display:"flex",alignItems:"center",gap:5,fontSize:11.5,color:"var(--text2)" }}>
                        <Icon d={ic.check} size={11} stroke="#3dba7e" /> {f}
                      </div>
                    ))}
                  </div>
                  {isPro
                    ? settings?.pendingPlan === "base"
                      ? <div style={{ fontSize:11,color:"#e85a3a",textAlign:"center",fontStyle:"italic" }}>Downgrade scheduled — active until cycle end</div>
                      : <button className="btn btn-ghost btn-sm" style={{ fontSize:11,color:"var(--text3)",width:"100%" }} onClick={()=>setConfirmDowngrade(true)}>Downgrade to FieldBase</button>
                    : <div style={{ fontSize:11,color:"var(--text3)",textAlign:"center",fontStyle:"italic" }}>Your current plan</div>
                  }
                </div>

                {/* FieldPro card */}
                <div style={{ padding:16,background: isPro ? "linear-gradient(135deg,#7c3aed0d,#a855f70d)" : "var(--surface2)",borderRadius:"var(--radius)",border: isPro ? "2px solid #a855f7" : "1px solid var(--border)",position:"relative" }}>
                  {isPro && <div style={{ position:"absolute",top:-10,left:16,fontSize:10,fontWeight:800,padding:"2px 10px",borderRadius:10,background:"linear-gradient(135deg,#7c3aed,#a855f7)",color:"white",textTransform:"uppercase",letterSpacing:".06em" }}>Current</div>}
                  <div style={{ fontSize:12,fontWeight:700,color:"#a855f7",marginBottom:6 }}>✦ FieldPro</div>
                  <div style={{ display:"flex",alignItems:"baseline",gap:4,marginBottom:2 }}>
                    <span style={{ fontSize:26,fontWeight:900,color:"var(--text)",lineHeight:1 }}>${PRICING[cycle].pro.admin}</span>
                    <span style={{ fontSize:12,color:"var(--text2)" }}>/mo</span>
                  </div>
                  {cycle==="annual" && <div style={{ fontSize:11,color:"#3dba7e",fontWeight:700,marginBottom:2 }}>Save ${(PRICING.monthly.pro.admin - PRICING.annual.pro.admin)*12}/yr vs monthly</div>}
                  <div style={{ fontSize:11,color:"var(--text3)",marginBottom:12 }}>admin · +${PRICING[cycle].pro.user}/user/mo</div>
                  <div style={{ display:"flex",flexDirection:"column",gap:5,marginBottom:12 }}>
                    {["Everything in FieldBase","✦ AI Report Writer","✦ Priority support","✦ Advanced analytics (soon)","✦ More features coming"].map(f=>(
                      <div key={f} style={{ display:"flex",alignItems:"center",gap:5,fontSize:11.5,color: f.startsWith("✦") ? "#a855f7" : "var(--text2)" }}>
                        <Icon d={ic.check} size={11} stroke={f.startsWith("✦") ? "#a855f7" : "#3dba7e"} /> {f.replace("✦ ","")}
                      </div>
                    ))}
                  </div>
                  {isPro
                    ? settings?.pendingPlan === "base"
                      ? <button className="btn btn-ghost btn-sm" style={{ fontSize:11,color:"#3dba7e",width:"100%",borderColor:"rgba(61,186,126,.3)" }} onClick={()=>onSettingsChange({...settings,pendingPlan:null})}>Cancel downgrade — stay on FieldPro</button>
                      : <div style={{ fontSize:11,color:"#a855f7",textAlign:"center",fontStyle:"italic" }}>Your current plan</div>
                    : <button className="btn btn-primary btn-sm" style={{ width:"100%",background:"linear-gradient(135deg,#7c3aed,#a855f7)",border:"none",fontWeight:700,gap:6,fontSize:12 }} onClick={()=>setConfirmUpgrade(true)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                        Upgrade to FieldPro
                      </button>
                  }
                </div>
              </div>

              {/* Total banner */}
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",background:"var(--accent-glow)",borderRadius:"var(--radius)",border:"1px solid var(--accent)" }}>
                <div>
                  <div style={{ fontWeight:700,fontSize:15,marginBottom:2 }}>{cycle==="annual" ? "Annual Total" : "Monthly Total"}</div>
                  <div style={{ fontSize:12.5,color:"var(--text2)" }}>
                    {cycle==="annual"
                      ? `$${monthlyTotal*12}/yr · renews on the ${billingDaySuffix(settings?.signupDate)} each year`
                      : `Renews on the ${billingDaySuffix(settings?.signupDate)} each month`
                    }
                    {" · "}{PLAN_NAMES[settings?.plan||"base"]}
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:28,fontWeight:900,color:"var(--accent)" }}>${monthlyTotal}<span style={{ fontSize:13,fontWeight:400,color:"var(--text2)" }}>/mo</span></div>
                  {cycle==="annual" && <div style={{ fontSize:11,color:"#3dba7e",fontWeight:700 }}>= ${monthlyTotal*12}/yr total</div>}
                </div>
              </div>
            </div>
          </div>

          {/* ── Pricing Breakdown ── */}
          <div className="card" style={{ marginBottom:16 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>Pricing Breakdown</span></div>
            <div className="card-body">
              <div style={{ background:"var(--surface2)",borderRadius:"var(--radius)",overflow:"hidden",border:"1px solid var(--border)" }}>
                <div className="price-row" style={{ display:"grid",gridTemplateColumns:"1fr 110px 110px",padding:"9px 14px",borderBottom:"1px solid var(--border)",fontSize:11.5,fontWeight:700,color:"var(--text2)",gap:8 }}>
                  <span>Line Item</span><span>Rate</span><span style={{ textAlign:"right" }}>Amount/mo</span>
                </div>
                <div className="price-row" style={{ display:"grid",gridTemplateColumns:"1fr 110px 110px",padding:"10px 14px",borderBottom:"1px solid var(--border)",alignItems:"center",fontSize:13,gap:8 }}>
                  <span style={{ display:"flex",alignItems:"center",gap:6 }}>
                    {isPro && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>}
                    {PLAN_NAMES[settings?.plan||"base"]} — Admin seat
                  </span>
                  <span style={{ color:"var(--text2)" }}>${adminSeat}/mo</span>
                  <span style={{ textAlign:"right",fontWeight:600 }}>${adminSeat}.00</span>
                </div>
                {users.map(u=>(
                  <div key={u.id} className="price-row" style={{ display:"grid",gridTemplateColumns:"1fr 110px 110px",padding:"10px 14px",borderBottom:"1px solid var(--border)",alignItems:"center",fontSize:13,opacity:u.status==="inactive"?0.5:1,gap:8 }}>
                    <span style={{ display:"flex",alignItems:"center",gap:8,minWidth:0 }}>
                      <span style={{ width:7,height:7,borderRadius:"50%",background:ROLE_META[u.role]?.color||"#888",display:"inline-block",flexShrink:0 }} />
                      <span style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{u.firstName} {u.lastName} <span style={{ color:"var(--text3)",fontSize:11 }}>({ROLE_META[u.role]?.label}){u.status==="inactive"?" · Deactivated":""}</span></span>
                    </span>
                    <span style={{ color:"var(--text2)" }}>${userSeat}/mo</span>
                    <span style={{ textAlign:"right",fontWeight:600 }}>{u.status==="inactive"?"$0.00":`$${userSeat}.00`}</span>
                  </div>
                ))}
                {/* Proration line — shown when plan changed mid-cycle this billing period */}
                {settings?.planChangeDate && (() => {
                  const changeDate = new Date(settings.planChangeDate);
                  const info = getBillingCycleInfo(settings?.signupDate, cycle);
                  const withinCycle = changeDate >= info.cycleStart && changeDate <= info.cycleEnd;
                  if (!withinCycle) return null;
                  const prevPlan = isPro ? "base" : "pro";
                  const p = calcProration({...settings, plan: prevPlan}, users, prevPlan, settings.plan);
                  return (
                    <div className="price-row" style={{ display:"grid",gridTemplateColumns:"1fr 110px 110px",padding:"10px 14px",borderBottom:"1px solid var(--border)",alignItems:"center",fontSize:12,gap:8,background:"linear-gradient(90deg,#3dba7e08,transparent)" }}>
                      <span style={{ color:"var(--text2)",fontStyle:"italic" }}>
                        Mid-cycle adjustment ({changeDate.toLocaleDateString("en-US",{month:"short",day:"numeric"})}) · {p.daysLeft} days prorated
                      </span>
                      <span style={{ color:"var(--text2)" }}>—</span>
                      <span style={{ textAlign:"right",fontWeight:600,color: p.netCharge > 0 ? "var(--accent)" : "#3dba7e" }}>
                        {p.netCharge > 0 ? `+$${p.netCharge}` : `-$${Math.abs(p.netCharge)}`}
                      </span>
                    </div>
                  );
                })()}
                <div className="price-row" style={{ display:"grid",gridTemplateColumns:"1fr 110px 110px",padding:"11px 14px",alignItems:"center",fontSize:13.5,fontWeight:800,background:"var(--surface3)",gap:8,borderTop:"1px solid var(--border)" }}>
                  <span>Monthly subtotal</span><span></span><span style={{ textAlign:"right",color:"var(--accent)" }}>${monthlyTotal}/mo</span>
                </div>
                {cycle==="annual" && (
                  <div className="price-row" style={{ display:"grid",gridTemplateColumns:"1fr 110px 110px",padding:"11px 14px",alignItems:"center",fontSize:13,fontWeight:700,background:"linear-gradient(90deg,#3dba7e0d,transparent)",gap:8 }}>
                    <span style={{ color:"#3dba7e" }}>Annual charge (×12)</span><span></span><span style={{ textAlign:"right",color:"#3dba7e",fontWeight:800 }}>${monthlyTotal*12}/yr</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Payment Method ── */}
          <div className="card">
            <div className="card-header"><span style={{ fontWeight:700 }}>Payment Method</span></div>
            <div className="card-body">
              <div style={{ display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",marginBottom:12 }}>
                <Icon d={ic.creditCard} size={22} stroke="var(--accent)" />
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600,fontSize:13.5 }}>{cardInfo.brand} ending in {cardInfo.last4}</div>
                  <div style={{ fontSize:12,color:"var(--text2)" }}>Expires {cardInfo.displayExpiry} · Auto-renews {cycle==="annual"?"annually":"monthly"} on the {billingDaySuffix(settings?.signupDate)}</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={()=>setShowCardModal(true)}>Update Card</button>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ color:"var(--text2)",fontSize:12 }} onClick={()=>setShowBillingHistory(true)}>View billing history →</button>
            </div>
          </div>

          {/* ── Pending downgrade banner ── */}
          {settings?.pendingPlan === "base" && (
            <div style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"rgba(232,90,58,.08)",border:"1px solid rgba(232,90,58,.3)",borderRadius:10,marginBottom:16 }}>
              <Icon d={ic.alert} size={16} stroke="#e85a3a" />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700,fontSize:13 }}>Downgrade scheduled</div>
                <div style={{ fontSize:12,color:"var(--text2)" }}>
                  Your account will switch to FieldBase on <strong>{getBillingCycleInfo(settings?.signupDate, cycle).cycleEnd.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</strong>. FieldPro features remain active until then.
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ fontSize:12,whiteSpace:"nowrap" }}
                onClick={()=>onSettingsChange({...settings, pendingPlan:null})}>
                Cancel downgrade
              </button>
            </div>
          )}

          {/* Upgrade confirm */}
          {confirmUpgrade && (() => {
            const p = calcProration(settings, users, "base", "pro");
            return (
              <div style={{ position:"fixed",inset:0,zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.55)" }}
                onClick={e=>{if(e.target===e.currentTarget)setConfirmUpgrade(false);}}>
                <div style={{ background:"var(--surface)",border:"1px solid #a855f750",borderRadius:16,boxShadow:"0 16px 60px rgba(0,0,0,.7)",width:"min(460px,95vw)",overflow:"hidden" }}>
                  <div style={{ padding:"22px 24px 18px",background:"linear-gradient(135deg,#7c3aed12,#a855f712)",borderBottom:"1px solid #a855f730" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                      <div style={{ width:36,height:36,borderRadius:9,background:"linear-gradient(135deg,#7c3aed,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                      </div>
                      <div style={{ fontWeight:800,fontSize:16 }}>Upgrade to ✦ FieldPro</div>
                    </div>
                    <div style={{ fontSize:13,color:"var(--text2)",lineHeight:1.6 }}>AI Report Writer and all Pro features unlock immediately. You're only charged for the remaining days in your current billing cycle.</div>
                  </div>
                  <div style={{ padding:"16px 24px" }}>
                    {/* Proration breakdown */}
                    <div style={{ background:"var(--surface2)",borderRadius:8,overflow:"hidden",border:"1px solid var(--border)",marginBottom:14,fontSize:12.5 }}>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr auto",padding:"8px 12px",borderBottom:"1px solid var(--border)",color:"var(--text2)" }}>
                        <span>FieldBase unused credit ({p.daysLeft} of {p.daysTotal} days)</span>
                        <span style={{ color:"#3dba7e",fontWeight:700 }}>−${p.unusedCredit}</span>
                      </div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr auto",padding:"8px 12px",borderBottom:"1px solid var(--border)",color:"var(--text2)" }}>
                        <span>FieldPro prorated charge ({p.daysLeft} days)</span>
                        <span style={{ fontWeight:600 }}>+${p.newCharge}</span>
                      </div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr auto",padding:"10px 12px",fontWeight:800,fontSize:13 }}>
                        <span>Charged today</span>
                        <span style={{ color: p.netCharge > 0 ? "var(--accent)" : "#3dba7e" }}>${p.netCharge > 0 ? p.netCharge : "0.00"}{p.netCharge <= 0 ? " (credit applied)" : ""}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:11.5,color:"var(--text3)",marginBottom:14 }}>
                      From <strong>{p.cycleEnd.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</strong> onwards: <strong>${p.toTotal}/mo</strong> ({cycle})
                    </div>
                    <div style={{ display:"flex",gap:8 }}>
                      <button className="btn btn-secondary btn-sm" style={{ flex:1 }} onClick={()=>setConfirmUpgrade(false)}>Cancel</button>
                      <button className="btn btn-primary btn-sm" style={{ flex:2,background:"linear-gradient(135deg,#7c3aed,#a855f7)",border:"none",fontWeight:700,gap:6 }}
                        onClick={()=>{ onSettingsChange({...settings, plan:"pro", pendingPlan:null, planChangeDate: new Date().toISOString().slice(0,10) }); setConfirmUpgrade(false); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                        Confirm — Pay ${Math.max(0, p.netCharge)} now
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Downgrade confirm */}
          {confirmDowngrade && (() => {
            const p = calcProration(settings, users, "pro", "base");
            const cycleEndStr = p.cycleEnd.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
            return (
              <div style={{ position:"fixed",inset:0,zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.55)" }}
                onClick={e=>{if(e.target===e.currentTarget)setConfirmDowngrade(false);}}>
                <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16,boxShadow:"0 16px 60px rgba(0,0,0,.7)",width:"min(460px,95vw)",overflow:"hidden" }}>
                  <div style={{ padding:"22px 24px 18px",borderBottom:"1px solid var(--border)" }}>
                    <div style={{ fontWeight:800,fontSize:16,marginBottom:8 }}>Downgrade to FieldBase?</div>
                    <div style={{ fontSize:13,color:"var(--text2)",lineHeight:1.6 }}>
                      FieldPro features stay active until your current cycle ends on <strong>{cycleEndStr}</strong>. After that, AI Writer and all Pro features will be locked.
                    </div>
                  </div>
                  <div style={{ padding:"16px 24px" }}>
                    {/* What you lose */}
                    <div style={{ background:"rgba(232,90,58,.06)",border:"1px solid rgba(232,90,58,.2)",borderRadius:8,padding:"10px 14px",marginBottom:12 }}>
                      <div style={{ fontSize:12,fontWeight:700,color:"#e85a3a",marginBottom:6 }}>Features you'll lose on {p.cycleEnd.toLocaleDateString("en-US",{month:"short",day:"numeric"})}:</div>
                      {["AI Report Writer","Priority support","Advanced analytics (when released)","Future FieldPro features"].map(f=>(
                        <div key={f} style={{ display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--text2)",marginBottom:3 }}>
                          <Icon d={ic.close} size={11} stroke="#e85a3a" /> {f}
                        </div>
                      ))}
                    </div>
                    {/* Billing change */}
                    <div style={{ background:"var(--surface2)",borderRadius:8,overflow:"hidden",border:"1px solid var(--border)",marginBottom:14,fontSize:12.5 }}>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr auto",padding:"8px 12px",borderBottom:"1px solid var(--border)",color:"var(--text2)" }}>
                        <span>Current rate (FieldPro)</span>
                        <span style={{ fontWeight:600 }}>${p.fromTotal}/mo</span>
                      </div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr auto",padding:"8px 12px",borderBottom:"1px solid var(--border)",color:"var(--text2)" }}>
                        <span>Rate after {p.cycleEnd.toLocaleDateString("en-US",{month:"short",day:"numeric"})} (FieldBase)</span>
                        <span style={{ fontWeight:600,color:"#3dba7e" }}>${p.toTotal}/mo</span>
                      </div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr auto",padding:"10px 12px",fontWeight:800,fontSize:13 }}>
                        <span>Monthly savings</span>
                        <span style={{ color:"#3dba7e" }}>−${p.fromTotal - p.toTotal}/mo</span>
                      </div>
                    </div>
                    <div style={{ fontSize:11.5,color:"var(--text3)",marginBottom:14 }}>No refund for the current period. Your data will not be affected.</div>
                    <div style={{ display:"flex",gap:8 }}>
                      <button className="btn btn-secondary btn-sm" style={{ flex:1 }} onClick={()=>setConfirmDowngrade(false)}>Keep FieldPro</button>
                      <button className="btn btn-ghost btn-sm" style={{ flex:1,color:"#e85a3a",borderColor:"rgba(232,90,58,.3)" }}
                        onClick={()=>{ onSettingsChange({...settings, pendingPlan:"base", planChangeDate: new Date().toISOString().slice(0,10) }); setConfirmDowngrade(false); }}>
                        Schedule downgrade
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {showCardModal && (
            <UpdateCardModal
              current={cardInfo}
              onSave={info=>{ setCardInfo(info); setShowCardModal(false); }}
              onClose={()=>setShowCardModal(false)}
            />
          )}

          {showBillingHistory && (
            <BillingHistoryModal
              monthlyTotal={monthlyTotal}
              signupDate={settings?.signupDate}
              cycle={cycle}
              onClose={()=>setShowBillingHistory(false)}
            />
          )}
        </div>
      )}

      {/* ── PERMISSIONS ── */}
      {tab==="perms" && (
        <div className="fade-in">
          <div style={{ fontSize:12.5,color:"var(--text2)",marginBottom:18,lineHeight:1.6,padding:"12px 16px",background:"var(--surface2)",borderRadius:"var(--radius)",border:"1px solid var(--border)" }}>
            <Icon d={ic.alert} size={14} stroke="var(--accent)" style={{ marginRight:6 }} /> These are the <strong style={{ color:"var(--text)" }}>default permissions</strong> by role. You can override them per-user when editing a team member.
          </div>
          {Object.entries(ROLE_META).map(([role,meta])=>(
            <div key={role} className="card" style={{ marginBottom:14 }}>
              <div className="card-header">
                <span style={{ fontWeight:700,color:meta.color }}>{meta.label}</span>
                <span style={{ fontSize:12,color:"var(--text2)" }}>{meta.desc}</span>
              </div>
              <div className="card-body" style={{ padding:0 }}>
                <div className="perm-row" style={{ display:"grid",gridTemplateColumns:"1fr 80px 80px 80px",padding:"8px 16px",borderBottom:"1px solid var(--border)",fontSize:11.5,fontWeight:700,color:"var(--text2)" }}>
                  <span>Feature</span><span style={{ textAlign:"center" }}>View</span><span style={{ textAlign:"center" }}>Edit</span><span style={{ textAlign:"center" }}>None</span>
                </div>
                {FEATURE_PERMS.map((f,i)=>{
                  const val = DEFAULT_PERMS[role]?.[f.id]||"none";
                  return (
                    <div key={f.id} className="perm-row" style={{ display:"grid",gridTemplateColumns:"1fr 80px 80px 80px",padding:"10px 16px",borderBottom:i<FEATURE_PERMS.length-1?"1px solid var(--border)":"none",alignItems:"center",fontSize:13 }}>
                      <span>{f.label}</span>
                      {["view","edit","none"].map(opt=>(
                        <div key={opt} style={{ display:"flex",justifyContent:"center" }}>
                          <div style={{ width:16,height:16,borderRadius:"50%",border:`2px solid ${val===opt?meta.color:"var(--border)"}`,background:val===opt?meta.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center" }}>
                            {val===opt && <div style={{ width:6,height:6,borderRadius:"50%",background:"white" }} />}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODALS ── */}
      {(addingUser || editingUser) && (
        <UserModal
          user={editingUser||null}
          projects={projects}
          onSave={saveUser}
          onClose={()=>{ setEditingUser(null); setAddingUser(false); }}
        />
      )}

      {confirmDel && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setConfirmDel(null)}>
          <div className="modal fade-in" style={{ maxWidth:420 }}>
            <div className="modal-header">
              <div className="modal-title">Remove User</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>setConfirmDel(null)}><Icon d={ic.close} size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize:13.5,lineHeight:1.7,color:"var(--text2)" }}>
                Remove <strong style={{ color:"var(--text)" }}>{confirmDel.firstName} {confirmDel.lastName}</strong> from your account?
                Their data will be retained but they will lose access immediately.
                Your monthly bill will decrease by <strong style={{ color:"var(--accent)" }}>${PRICING.monthly.base.user}/mo</strong>.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background:"#e85a3a",borderColor:"#e85a3a" }} onClick={()=>removeUser(confirmDel.id)}>
                <Icon d={ic.trash} size={14} /> Remove User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsPage({ settings, onSave, onDeleteAccount }) {
  const [tab, setTab]   = useState(typeof window !== "undefined" && window.innerWidth <= 768 ? "appearance" : "company");
  const [form, setForm] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [pwForm, setPwForm] = useState({ current:"", newPw:"", confirm:"" });
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const validatePassword = (pw) => {
    if (pw.length < 8)             return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(pw))         return "Password must include at least one uppercase letter.";
    if (!/[a-z]/.test(pw))         return "Password must include at least one lowercase letter.";
    if (!/[0-9]/.test(pw))         return "Password must include at least one number.";
    return null;
  };

  const handleUpdatePassword = () => {
    setPwError(""); setPwSuccess(false);
    if (!pwForm.current) return setPwError("Please enter your current password.");
    const err = validatePassword(pwForm.newPw);
    if (err) return setPwError(err);
    if (pwForm.newPw !== pwForm.confirm) return setPwError("New passwords do not match.");
    setPwSuccess(true);
    setPwForm({ current:"", newPw:"", confirm:"" });
  };
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
    { id:"company",    label:"Company",        icon:ic.building,  mobileHidden:true },
    { id:"appearance", label:"Appearance",     icon:ic.grid       },
    { id:"account",    label:"Account",        icon:ic.user       },
    { id:"reports",    label:"Report Defaults",icon:ic.reports,   mobileHidden:true },
    { id:"email",      label:"Email",          icon:ic.mail,      mobileHidden:true },
    { id:"prefs",      label:"Settings",       icon:ic.settings   },
  ];

  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  const visibleTabs = TABS.filter(t => !(isMobile && t.mobileHidden));

  return (
    <div className="page fade-in" style={{ maxWidth:820 }}>
      <div style={{ marginBottom:24 }}>
        <div className="section-title">Settings</div>
        <div className="section-sub">Manage your company profile, appearance, account, and report defaults</div>
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex",borderBottom:"1px solid var(--border)",marginBottom:28 }}>
        {visibleTabs.map(t => (
          <button key={t.id} className="btn btn-ghost btn-sm"
            style={{ borderBottom:`2px solid ${tab===t.id?"var(--accent)":"transparent"}`,borderRadius:0,paddingBottom:12,color:tab===t.id?"var(--accent)":"var(--text2)",fontWeight:tab===t.id?700:500,gap:6,flex:1,justifyContent:"center" }}
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
                    {["General Contractor","Restoration & Remediation","Insurance Adjuster","Property Inspector","Plumbing","Electrical","HVAC","Roofing","Landscaping","Siding","Other"].map(o => <option key={o}>{o}</option>)}
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
                  { id:"system",label:"System",desc:"Follows your device's OS preference automatically.",icon:"💻", mobileHidden:true },
                ].filter(m => !(window.innerWidth <= 768 && m.mobileHidden)).map(m => (
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
          <div className="card" style={{ marginBottom:20 }}>
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

          {/* Camera Roll — mobile only */}
          {false && null}
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
                Must be at least 8 characters and include at least one uppercase letter, one lowercase letter, and one number.
              </div>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input className="form-input" type="password" placeholder="Enter current password" value={pwForm.current} onChange={e => setPwForm(f=>({...f,current:e.target.value}))} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input className="form-input" type="password" placeholder="Min 8 characters" value={pwForm.newPw}
                    onChange={e => { setPwForm(f=>({...f,newPw:e.target.value})); setPwError(""); setPwSuccess(false); }}
                    style={{ borderColor: pwForm.newPw && validatePassword(pwForm.newPw) ? "#c0392b" : undefined }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input className="form-input" type="password" placeholder="Repeat new password" value={pwForm.confirm}
                    onChange={e => { setPwForm(f=>({...f,confirm:e.target.value})); setPwError(""); setPwSuccess(false); }}
                    style={{ borderColor: pwForm.confirm && pwForm.confirm !== pwForm.newPw ? "#c0392b" : undefined }} />
                </div>
              </div>
              {pwForm.newPw.length > 0 && (
                <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:12 }}>
                  {[
                    { label:"8+ chars",  ok: pwForm.newPw.length >= 8 },
                    { label:"Uppercase", ok: /[A-Z]/.test(pwForm.newPw) },
                    { label:"Lowercase", ok: /[a-z]/.test(pwForm.newPw) },
                    { label:"Number",    ok: /[0-9]/.test(pwForm.newPw) },
                  ].map(r => (
                    <span key={r.label} style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:10,
                      background: r.ok ? "#3dba7e22" : "var(--surface2)",
                      color: r.ok ? "#3dba7e" : "var(--text3)",
                      border: `1px solid ${r.ok ? "#3dba7e44" : "var(--border)"}` }}>
                      {r.ok ? "✓" : "✗"} {r.label}
                    </span>
                  ))}
                </div>
              )}
              {pwError   && <div style={{ fontSize:12.5,color:"#c0392b",marginBottom:10,padding:"8px 12px",background:"#c0392b15",borderRadius:"var(--radius-sm)",border:"1px solid #c0392b44" }}>{pwError}</div>}
              {pwSuccess && <div style={{ fontSize:12.5,color:"#3dba7e",marginBottom:10,padding:"8px 12px",background:"#3dba7e15",borderRadius:"var(--radius-sm)",border:"1px solid #3dba7e44" }}>✓ Password updated successfully.</div>}
              <button className="btn btn-secondary btn-sm" onClick={handleUpdatePassword}><Icon d={ic.check} size={13} /> Update Password</button>
            </div>
          </div>

          {/* Danger zone — admin only, desktop only */}
          {form.userRole === "admin" && !isMobile && (
            <div style={{ marginTop:32,paddingTop:24,borderTop:"1px solid var(--border)",display:"flex",justifyContent:"flex-end" }}>
              <button
                onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(""); }}
                style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 14px",fontSize:12,fontWeight:600,borderRadius:"var(--radius-sm)",border:"1px solid #b03030",background:"transparent",color:"#c0392b",cursor:"pointer",opacity:0.8,transition:"opacity .15s" }}
                onMouseEnter={e => e.currentTarget.style.opacity=1}
                onMouseLeave={e => e.currentTarget.style.opacity=0.8}>
                <Icon d={ic.trash} size={13} stroke="#c0392b" /> Delete Account
              </button>
            </div>
          )}

          {/* Delete confirmation modal */}
          {showDeleteModal && form.userRole === "admin" && !isMobile && (
            <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
              <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",maxWidth:460,width:"100%",padding:28,boxShadow:"0 24px 64px rgba(0,0,0,.5)" }}>
                <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
                  <div style={{ width:40,height:40,borderRadius:10,background:"#b0303022",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    <Icon d={ic.alert} size={20} stroke="#c0392b" />
                  </div>
                  <div>
                    <div style={{ fontWeight:700,fontSize:16,color:"#c0392b" }}>Delete Account</div>
                    <div style={{ fontSize:12,color:"var(--text2)",marginTop:2 }}>This action is permanent and cannot be undone</div>
                  </div>
                </div>

                <div style={{ background:"#b0303018",border:"1px solid #b0303040",borderRadius:"var(--radius-sm)",padding:"12px 16px",marginBottom:20,fontSize:13,color:"var(--text)",lineHeight:1.7 }}>
                  <strong>You will permanently lose:</strong>
                  <ul style={{ margin:"8px 0 0 0",paddingLeft:18,color:"var(--text2)" }}>
                    <li>All jobsites and project data</li>
                    <li>All photos, videos, and reports</li>
                    <li>All team members and account settings</li>
                    <li>All checklists and templates</li>
                    <li>Your billing history and subscription</li>
                  </ul>
                </div>

                <div style={{ marginBottom:20 }}>
                  <label style={{ fontSize:12.5,fontWeight:600,color:"var(--text2)",display:"block",marginBottom:8 }}>
                    Type <span style={{ fontFamily:"monospace",background:"var(--surface2)",padding:"1px 6px",borderRadius:4,color:"var(--text)",fontWeight:700 }}>DELETE</span> to confirm
                  </label>
                  <input
                    className="form-input"
                    placeholder="Type DELETE here…"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    style={{ borderColor: deleteConfirmText === "DELETE" ? "#c0392b" : undefined }}
                    autoFocus
                  />
                </div>

                <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(""); }}>Cancel</button>
                  <button
                    disabled={deleteConfirmText !== "DELETE"}
                    onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(""); onDeleteAccount && onDeleteAccount(); }}
                    style={{ display:"flex",alignItems:"center",gap:6,padding:"8px 18px",fontSize:13,fontWeight:600,borderRadius:"var(--radius-sm)",border:"none",background: deleteConfirmText === "DELETE" ? "#c0392b" : "var(--surface3)",color: deleteConfirmText === "DELETE" ? "white" : "var(--text3)",cursor: deleteConfirmText === "DELETE" ? "pointer" : "not-allowed",transition:"all .15s" }}>
                    <Icon d={ic.trash} size={14} stroke="currentColor" /> Delete Everything
                  </button>
                </div>
              </div>
            </div>
          )}

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
                    <span>Page 1 of 1 · {formatDate(new Date().toISOString().slice(0,10), settings)}</span>
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

      {tab === "email" && (
        <div className="fade-in">
          {/* Email Template */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header">
              <span style={{ fontWeight:700 }}>Email Template</span>
              <span style={{ fontSize:11.5,color:"var(--text2)" }}>Used when sending reports to clients or adjusters</span>
            </div>
            <div className="card-body">
              <div style={{ marginBottom:14,padding:"10px 14px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",fontSize:12,color:"var(--text3)",lineHeight:1.7 }}>
                <strong style={{ color:"var(--text2)" }}>Available variables:</strong>{" "}
                {["{{company}}","{{project}}","{{address}}","{{recipient}}","{{reports_list}}","{{date}}","{{inspector}}"].map(v=>(
                  <span key={v} style={{ display:"inline-block",background:"var(--surface3)",border:"1px solid var(--border)",borderRadius:4,padding:"1px 7px",margin:"2px 3px",fontFamily:"monospace",fontSize:11.5,color:"var(--accent)" }}>{v}</span>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">Subject Line</label>
                <input className="form-input" value={form.emailSubject||""} onChange={e=>set("emailSubject",e.target.value)} placeholder="Report from {{company}} — {{project}}" />
              </div>
              <div className="form-group">
                <label className="form-label">Email Body</label>
                <textarea className="form-input form-textarea" style={{ minHeight:180,fontSize:13,fontFamily:"inherit",lineHeight:1.7 }}
                  value={form.emailBody||""} onChange={e=>set("emailBody",e.target.value)}
                  placeholder={"Hello {{recipient}},\n\nPlease find attached the report(s) for {{project}}..."} />
                <div style={{ fontSize:11.5,color:"var(--text3)",marginTop:6 }}>Your email signature will be appended automatically below the body.</div>
              </div>
            </div>
          </div>

          {/* Email Signature */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header">
              <span style={{ fontWeight:700 }}>Email Signature</span>
              <span style={{ fontSize:11.5,color:"var(--text2)" }}>Appended to every outgoing report email</span>
            </div>
            <div className="card-body">
              {/* Signature preview */}
              <div style={{ marginBottom:20,padding:16,background:"var(--surface2)",borderRadius:"var(--radius)",border:"1px solid var(--border)" }}>
                <div style={{ fontSize:11,color:"var(--text3)",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10 }}>Signature Preview</div>
                <div style={{ background:"white",borderRadius:8,padding:"16px 20px",color:"#222",borderLeft:`3px solid ${form.accent}` }}>
                  <div style={{ display:"flex",alignItems:"flex-start",gap:14 }}>
                    {form.emailSignatureLogoEnabled && form.logo && (
                      <img src={form.logo} alt="logo" style={{ height:40,width:40,objectFit:"contain",borderRadius:6,flexShrink:0 }} />
                    )}
                    <div>
                      <div style={{ fontWeight:700,fontSize:14,color:"#111",lineHeight:1.3 }}>
                        {form.emailSignatureName || `${form.userFirstName||""} ${form.userLastName||""}`.trim() || "Your Name"}
                      </div>
                      {(form.emailSignatureTitle||form.userTitle) && (
                        <div style={{ fontSize:12,color:"#555",marginTop:1 }}>{form.emailSignatureTitle||form.userTitle}</div>
                      )}
                      {(form.emailSignatureCompany||form.companyName) && (
                        <div style={{ fontSize:12,color:"#555" }}>{form.emailSignatureCompany||form.companyName}</div>
                      )}
                      <div style={{ marginTop:6,display:"flex",flexDirection:"column",gap:2 }}>
                        {(form.emailSignaturePhone||form.phone) && <div style={{ fontSize:11.5,color:"#666" }}>📞 {form.emailSignaturePhone||form.phone}</div>}
                        {(form.emailSignatureEmail||form.email) && <div style={{ fontSize:11.5,color:"#666" }}>✉ {form.emailSignatureEmail||form.email}</div>}
                        {form.website && <div style={{ fontSize:11.5,color:form.accent }}>{form.website}</div>}
                      </div>
                    </div>
                  </div>
                  {/* Social icons preview — small clickable circles */}
                  {form.sigSocialsEnabled && (() => {
                    const SOCIALS = [
                      { key:"fb",  en:form.sigFacebookEnabled,  url:form.sigFacebookUrl,  icon:"M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z",                                                      color:"#1877f2", label:"Facebook"  },
                      { key:"ig",  en:form.sigInstagramEnabled, url:form.sigInstagramUrl, icon:"M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zM17.5 6.5h.01M7.5 2h9A5.5 5.5 0 0122 7.5v9a5.5 5.5 0 01-5.5 5.5h-9A5.5 5.5 0 012 16.5v-9A5.5 5.5 0 017.5 2z", color:"#e1306c", label:"Instagram" },
                      { key:"x",   en:form.sigXEnabled,         url:form.sigXUrl,         icon:"M4 4l16 16M20 4L4 20",                                                                                                   color:"#111111", label:"X"         },
                      { key:"li",  en:form.sigLinkedInEnabled,  url:form.sigLinkedInUrl,  icon:"M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z M4 6a2 2 0 100-4 2 2 0 000 4z", color:"#0a66c2", label:"LinkedIn"  },
                      { key:"yt",  en:form.sigYoutubeEnabled,   url:form.sigYoutubeUrl,   icon:"M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.4a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z", color:"#ff0000", label:"YouTube"   },
                    ].filter(x => x.en && x.url);
                    if (!SOCIALS.length) return null;
                    return (
                      <div style={{ marginTop:12,paddingTop:12,borderTop:"1px solid #eee",display:"flex",gap:8,alignItems:"center" }}>
                        {SOCIALS.map(s => (
                          <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" title={s.label}
                            style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",width:32,height:32,borderRadius:"50%",background:s.color,flexShrink:0,textDecoration:"none",cursor:"pointer" }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon}/></svg>
                          </a>
                        ))}
                      </div>
                    );
                  })()}
                  {/* Review button — clickable link */}
                  {form.sigReviewEnabled && form.sigReviewUrl && (
                    <div style={{ marginTop:10,paddingTop:10,borderTop:"1px solid #eee" }}>
                      <a href={form.sigReviewUrl} target="_blank" rel="noopener noreferrer"
                        style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"7px 16px",borderRadius:6,background:"#f59e0b",color:"white",fontSize:12.5,fontWeight:700,textDecoration:"none",cursor:"pointer" }}>
                        ⭐ {form.sigReviewLabel||"Leave us a Review"}
                      </a>
                    </div>
                  )}
                  {form.emailSignatureCustomHtml && (
                    <div style={{ marginTop:10,paddingTop:10,borderTop:"1px solid #eee",fontSize:11.5,color:"#888" }}
                      dangerouslySetInnerHTML={{ __html: form.emailSignatureCustomHtml }} />
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input className="form-input" value={form.emailSignatureName||""} onChange={e=>set("emailSignatureName",e.target.value)} placeholder={`${form.userFirstName||""} ${form.userLastName||""}`.trim()||"Your name"} />
                </div>
                <div className="form-group">
                  <label className="form-label">Title / Role</label>
                  <input className="form-input" value={form.emailSignatureTitle||""} onChange={e=>set("emailSignatureTitle",e.target.value)} placeholder={form.userTitle||"e.g. Project Manager"} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input className="form-input" value={form.emailSignatureCompany||""} onChange={e=>set("emailSignatureCompany",e.target.value)} placeholder={form.companyName||"Company name"} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.emailSignaturePhone||""} onChange={e=>set("emailSignaturePhone",e.target.value)} placeholder={form.phone||"Phone number"} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" value={form.emailSignatureEmail||""} onChange={e=>set("emailSignatureEmail",e.target.value)} placeholder={form.email||"your@email.com"} />
                </div>
                <div className="form-group" style={{ display:"flex",alignItems:"center",gap:10,paddingTop:22 }}>
                  <input type="checkbox" id="sig_logo" checked={!!form.emailSignatureLogoEnabled} onChange={e=>set("emailSignatureLogoEnabled",e.target.checked)} style={{ accentColor:"var(--accent)" }} />
                  <label htmlFor="sig_logo" style={{ fontSize:13,cursor:"pointer" }}>Show company logo in signature</label>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Custom HTML <span style={{ fontWeight:400,color:"var(--text3)" }}>(optional — added below signature)</span></label>
                <textarea className="form-input form-textarea" style={{ minHeight:72,fontSize:12,fontFamily:"monospace" }}
                  value={form.emailSignatureCustomHtml||""} onChange={e=>set("emailSignatureCustomHtml",e.target.value)}
                  placeholder={'<p style="color:#999">Licensed & Insured · CO License #12345</p>'} />
              </div>
            </div>
          </div>

          {/* Social Media Links */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header">
              <span style={{ fontWeight:700 }}>Social Media Buttons</span>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginLeft:"auto" }}>
                <span style={{ fontSize:12,color:"var(--text3)" }}>Show in signature</span>
                <div onClick={() => set("sigSocialsEnabled", !form.sigSocialsEnabled)}
                  style={{ width:42,height:24,borderRadius:12,background:form.sigSocialsEnabled?"var(--accent)":"var(--surface3)",border:"1px solid var(--border)",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0 }}>
                  <div style={{ width:18,height:18,borderRadius:"50%",background:"white",position:"absolute",top:2,left:form.sigSocialsEnabled?21:3,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)" }} />
                </div>
              </div>
            </div>
            <div className="card-body" style={{ opacity:form.sigSocialsEnabled?1:0.45,pointerEvents:form.sigSocialsEnabled?"auto":"none",transition:"opacity .2s" }}>
              {[
                { enKey:"sigFacebookEnabled",  urlKey:"sigFacebookUrl",  color:"#1877f2", icon:"M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z",                                                      label:"Facebook",  placeholder:"https://facebook.com/yourpage"   },
                { enKey:"sigInstagramEnabled", urlKey:"sigInstagramUrl", color:"#e1306c", icon:"M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zM17.5 6.5h.01M7.5 2h9A5.5 5.5 0 0122 7.5v9a5.5 5.5 0 01-5.5 5.5h-9A5.5 5.5 0 012 16.5v-9A5.5 5.5 0 017.5 2z", label:"Instagram", placeholder:"https://instagram.com/yourhandle" },
                { enKey:"sigXEnabled",         urlKey:"sigXUrl",         color:"#000000", icon:"M4 4l16 16M20 4L4 20",                                                                                                   label:"X (Twitter)",placeholder:"https://x.com/yourhandle"          },
                { enKey:"sigLinkedInEnabled",  urlKey:"sigLinkedInUrl",  color:"#0a66c2", icon:"M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z M4 6a2 2 0 100-4 2 2 0 000 4z", label:"LinkedIn",   placeholder:"https://linkedin.com/company/yourco" },
                { enKey:"sigYoutubeEnabled",   urlKey:"sigYoutubeUrl",   color:"#ff0000", icon:"M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.4a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z", label:"YouTube", placeholder:"https://youtube.com/@yourchannel" },
              ].map(s => (
                <div key={s.enKey} style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}>
                  {/* Toggle */}
                  <div onClick={() => set(s.enKey, !form[s.enKey])}
                    style={{ width:38,height:22,borderRadius:11,background:form[s.enKey]?"var(--accent)":"var(--surface3)",border:"1px solid var(--border)",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0 }}>
                    <div style={{ width:16,height:16,borderRadius:"50%",background:"white",position:"absolute",top:2,left:form[s.enKey]?19:2,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)" }} />
                  </div>
                  {/* Icon badge */}
                  <div style={{ width:30,height:30,borderRadius:6,background:s.color,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={s.icon}/>
                    </svg>
                  </div>
                  <span style={{ fontSize:13,fontWeight:600,width:90,flexShrink:0,color:form[s.enKey]?"var(--text)":"var(--text3)" }}>{s.label}</span>
                  <input className="form-input" style={{ flex:1,opacity:form[s.enKey]?1:0.5 }}
                    value={form[s.urlKey]||""} onChange={e=>set(s.urlKey,e.target.value)}
                    placeholder={s.placeholder} disabled={!form[s.enKey]} />
                </div>
              ))}
            </div>
          </div>

          {/* Leave a Review */}
          <div className="card">
            <div className="card-header">
              <span style={{ fontWeight:700 }}>Leave a Review Button</span>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginLeft:"auto" }}>
                <span style={{ fontSize:12,color:"var(--text3)" }}>Show in signature</span>
                <div onClick={() => set("sigReviewEnabled", !form.sigReviewEnabled)}
                  style={{ width:42,height:24,borderRadius:12,background:form.sigReviewEnabled?"var(--accent)":"var(--surface3)",border:"1px solid var(--border)",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0 }}>
                  <div style={{ width:18,height:18,borderRadius:"50%",background:"white",position:"absolute",top:2,left:form.sigReviewEnabled?21:3,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)" }} />
                </div>
              </div>
            </div>
            <div className="card-body" style={{ opacity:form.sigReviewEnabled?1:0.45,pointerEvents:form.sigReviewEnabled?"auto":"none",transition:"opacity .2s" }}>
              <div style={{ marginBottom:16,padding:"10px 14px",background:"var(--surface2)",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",fontSize:12.5,color:"var(--text3)" }}>
                Add a button that links clients to your Google Business review page, Yelp, Houzz, or any other review site.
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Button Label</label>
                  <input className="form-input" value={form.sigReviewLabel||""} onChange={e=>set("sigReviewLabel",e.target.value)} placeholder="Leave us a Review ⭐" />
                </div>
                <div className="form-group">
                  <label className="form-label">Review Link URL</label>
                  <input className="form-input" value={form.sigReviewUrl||""} onChange={e=>set("sigReviewUrl",e.target.value)} placeholder="https://g.page/r/your-google-review-link" />
                </div>
              </div>
              {form.sigReviewUrl && (
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <span style={{ fontSize:12,color:"var(--text3)" }}>Preview:</span>
                  <a href={form.sigReviewUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"7px 16px",borderRadius:6,background:"#f59e0b",color:"white",fontSize:12.5,fontWeight:700,textDecoration:"none",cursor:"pointer" }}>
                    ⭐ {form.sigReviewLabel||"Leave us a Review"}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PREFS (Settings) ── */}
      {tab === "prefs" && (
        <div className="fade-in">
          {/* Notifications */}
          <div className="card" style={{ marginBottom:20 }}>
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

          {/* Camera */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>📷 Camera</span></div>
            <div className="card-body" style={{ display:"flex",flexDirection:"column",gap:0 }}>

              {/* Save to Camera Roll — mobile only */}
              {isMobile && (
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,cursor:"pointer",paddingBottom:14,marginBottom:14,borderBottom:"1px solid var(--border)" }}
                  onClick={() => set("saveToCameraRoll", !form.saveToCameraRoll)}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600,fontSize:13.5,marginBottom:3 }}>Save to Camera Roll</div>
                    <div style={{ fontSize:12,color:"var(--text2)",lineHeight:1.5 }}>Automatically save every photo you take to a KRAKEN CAM folder on your device.</div>
                  </div>
                  <div style={{ flexShrink:0,width:48,height:28,borderRadius:14,background:form.saveToCameraRoll?"var(--accent)":"var(--border)",transition:"background .2s",position:"relative" }}>
                    <div style={{ position:"absolute",top:3,left:form.saveToCameraRoll?22:3,width:22,height:22,borderRadius:"50%",background:"white",boxShadow:"0 1px 4px rgba(0,0,0,.3)",transition:"left .2s" }} />
                  </div>
                </div>
              )}

              {/* Photo Quality */}
              <div>
                <div style={{ fontWeight:600,fontSize:13.5,marginBottom:4 }}>Picture Quality</div>
                <div style={{ fontSize:12,color:"var(--text2)",marginBottom:12,lineHeight:1.5 }}>Higher quality produces sharper images but larger file sizes.</div>
                <div style={{ display:"flex",gap:8 }}>
                  {[
                    { id:"low",      label:"Low",      desc:"~800KB",  icon:"🔋" },
                    { id:"moderate", label:"Moderate", desc:"~1.5MB",  icon:"⚡" },
                    { id:"high",     label:"High",     desc:"~3MB",    icon:"💎" },
                  ].map(q => (
                    <div key={q.id} onClick={() => set("photoQuality", q.id)}
                      style={{ flex:1,border:`2px solid ${form.photoQuality===q.id?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius)",padding:"12px 10px",cursor:"pointer",background:form.photoQuality===q.id?"var(--accent-glow)":"var(--surface2)",transition:"all .15s",textAlign:"center" }}>
                      <div style={{ fontSize:20,marginBottom:6 }}>{q.icon}</div>
                      <div style={{ fontWeight:700,fontSize:13,marginBottom:2,color:form.photoQuality===q.id?"var(--accent)":"var(--text)" }}>{q.label}</div>
                      <div style={{ fontSize:11,color:"var(--text3)" }}>{q.desc}</div>
                      {form.photoQuality===q.id && <div style={{ marginTop:6,fontSize:11,color:"var(--accent)",fontWeight:600 }}>✓ Active</div>}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* General preferences */}
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><span style={{ fontWeight:700 }}>General</span></div>
            <div className="card-body" style={{ display:"flex",flexDirection:"column",gap:20 }}>

              {/* Timezone */}
              <div>
                <label className="form-label" style={{ marginBottom:6,display:"block" }}>Timezone</label>
                <select className="form-input form-select" value={form.timezone||"America/Denver"} onChange={e => set("timezone", e.target.value)}>
                  {[
                    ["Pacific/Honolulu",   "Hawaii (UTC−10)"],
                    ["America/Anchorage",  "Alaska (UTC−9)"],
                    ["America/Los_Angeles","Pacific Time (UTC−8)"],
                    ["America/Denver",     "Mountain Time (UTC−7)"],
                    ["America/Chicago",    "Central Time (UTC−6)"],
                    ["America/New_York",   "Eastern Time (UTC−5)"],
                    ["America/Halifax",    "Atlantic Time (UTC−4)"],
                    ["America/St_Johns",   "Newfoundland (UTC−3:30)"],
                    ["America/Sao_Paulo",  "Brasília (UTC−3)"],
                    ["UTC",                "UTC (UTC+0)"],
                    ["Europe/London",      "London (UTC+0/+1)"],
                    ["Europe/Paris",       "Central European (UTC+1/+2)"],
                    ["Europe/Helsinki",    "Eastern European (UTC+2/+3)"],
                    ["Europe/Moscow",      "Moscow (UTC+3)"],
                    ["Asia/Dubai",         "Gulf (UTC+4)"],
                    ["Asia/Karachi",       "Pakistan (UTC+5)"],
                    ["Asia/Kolkata",       "India (UTC+5:30)"],
                    ["Asia/Dhaka",         "Bangladesh (UTC+6)"],
                    ["Asia/Bangkok",       "Indochina (UTC+7)"],
                    ["Asia/Shanghai",      "China (UTC+8)"],
                    ["Asia/Tokyo",         "Japan (UTC+9)"],
                    ["Australia/Sydney",   "Sydney (UTC+10/+11)"],
                    ["Pacific/Auckland",   "New Zealand (UTC+12/+13)"],
                  ].map(([val,label]) => <option key={val} value={val}>{label}</option>)}
                </select>
                <div style={{ fontSize:11.5,color:"var(--text3)",marginTop:5 }}>
                  Current time: {new Date().toLocaleTimeString("en-US", { timeZone: form.timezone||"America/Denver", hour:"2-digit", minute:"2-digit", hour12: form.timeFormat!=="24hr" })} — {form.timezone||"America/Denver"}
                </div>
              </div>

              {/* Date format */}
              <div>
                <label className="form-label" style={{ marginBottom:8,display:"block" }}>Date Format</label>
                <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
                  {[
                    { id:"MM/DD/YYYY", example: "03/25/2025" },
                    { id:"DD/MM/YYYY", example: "25/03/2025" },
                    { id:"YYYY-MM-DD", example: "2025-03-25" },
                    { id:"MMM D, YYYY",example: "Mar 25, 2025" },
                  ].map(d => (
                    <div key={d.id} onClick={() => set("dateFormat", d.id)}
                      style={{ flex:1,minWidth:120,border:`2px solid ${form.dateFormat===d.id?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius-sm)",padding:"10px 14px",cursor:"pointer",background:form.dateFormat===d.id?"var(--accent-glow)":"var(--surface2)",transition:"all .15s" }}>
                      <div style={{ fontWeight:700,fontSize:12.5,color:form.dateFormat===d.id?"var(--accent)":"var(--text)",marginBottom:2 }}>{d.id}</div>
                      <div style={{ fontSize:11.5,color:"var(--text3)" }}>{d.example}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time format */}
              <div>
                <label className="form-label" style={{ marginBottom:8,display:"block" }}>Time Format</label>
                <div style={{ display:"flex",gap:8 }}>
                  {[
                    { id:"12hr", label:"12-Hour", example:"2:30 PM" },
                    { id:"24hr", label:"24-Hour", example:"14:30"   },
                  ].map(t => (
                    <div key={t.id} onClick={() => set("timeFormat", t.id)}
                      style={{ flex:1,border:`2px solid ${form.timeFormat===t.id?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius-sm)",padding:"12px 16px",cursor:"pointer",background:form.timeFormat===t.id?"var(--accent-glow)":"var(--surface2)",transition:"all .15s",textAlign:"center" }}>
                      <div style={{ fontWeight:700,fontSize:13.5,color:form.timeFormat===t.id?"var(--accent)":"var(--text)",marginBottom:3 }}>{t.label}</div>
                      <div style={{ fontSize:12,color:"var(--text3)" }}>{t.example}</div>
                      {form.timeFormat===t.id && <div style={{ fontSize:11,color:"var(--accent)",fontWeight:600,marginTop:4 }}>✓ Active</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Measurement units */}
              <div>
                <label className="form-label" style={{ marginBottom:8,display:"block" }}>Measurement Units</label>
                <div style={{ display:"flex",gap:8 }}>
                  {[
                    { id:"imperial", label:"Imperial", example:"ft, in, lbs, °F", icon:"🇺🇸" },
                    { id:"metric",   label:"Metric",   example:"m, cm, kg, °C",   icon:"🌍" },
                  ].map(u => (
                    <div key={u.id} onClick={() => set("units", u.id)}
                      style={{ flex:1,border:`2px solid ${form.units===u.id?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius-sm)",padding:"12px 16px",cursor:"pointer",background:form.units===u.id?"var(--accent-glow)":"var(--surface2)",transition:"all .15s",textAlign:"center" }}>
                      <div style={{ fontSize:22,marginBottom:5 }}>{u.icon}</div>
                      <div style={{ fontWeight:700,fontSize:13.5,color:form.units===u.id?"var(--accent)":"var(--text)",marginBottom:3 }}>{u.label}</div>
                      <div style={{ fontSize:12,color:"var(--text3)" }}>{u.example}</div>
                      {form.units===u.id && <div style={{ fontSize:11,color:"var(--accent)",fontWeight:600,marginTop:4 }}>✓ Active</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Default project sort order */}
              <div>
                <label className="form-label" style={{ marginBottom:8,display:"block" }}>Default Project Sorting Order</label>
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {[
                    { id:"recent",   label:"Most Recent",          desc:"Last modified or updated first" },
                    { id:"newest",   label:"Newest to Oldest",     desc:"By creation date, newest first" },
                    { id:"oldest",   label:"Oldest to Newest",     desc:"By creation date, oldest first" },
                    { id:"alpha",    label:"Name A → Z",           desc:"Alphabetical by project name"   },
                  ].map(s => (
                    <div key={s.id} onClick={() => set("projectSort", s.id)}
                      style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 14px",border:`2px solid ${form.projectSort===s.id?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius-sm)",cursor:"pointer",background:form.projectSort===s.id?"var(--accent-glow)":"var(--surface2)",transition:"all .15s" }}>
                      <div>
                        <div style={{ fontWeight:600,fontSize:13,color:form.projectSort===s.id?"var(--accent)":"var(--text)" }}>{s.label}</div>
                        <div style={{ fontSize:11.5,color:"var(--text3)",marginTop:1 }}>{s.desc}</div>
                      </div>
                      {form.projectSort===s.id && <Icon d={ic.check} size={16} stroke="var(--accent)" />}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* About */}
          <div className="card">
            <div className="card-header"><span style={{ fontWeight:700 }}>About</span></div>
            <div className="card-body" style={{ display:"flex",flexDirection:"column",gap:16 }}>
              <div style={{ display:"flex",alignItems:"center",gap:14 }}>
                <div style={{ width:48,height:48,borderRadius:12,background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                  <Icon d={ic.camera} size={24} stroke="white" strokeWidth={2} />
                </div>
                <div>
                  <div style={{ fontWeight:700,fontSize:15 }}>Kraken Cam</div>
                  <div style={{ fontSize:12,color:"var(--text2)",marginTop:2 }}>Version 1.0.0</div>
                </div>
              </div>

              <div style={{ borderTop:"1px solid var(--border)",paddingTop:14,display:"flex",flexDirection:"column",gap:8 }}>
                <div style={{ fontSize:12.5,color:"var(--text2)",lineHeight:1.6 }}>
                  Built for field professionals who need fast, reliable jobsite documentation. Questions, feedback, or issues? Our team is happy to help.
                </div>
                <button
                  onClick={() => window.location.href = "mailto:support@yourdomain.com?subject=Kraken%20Cam%20Support"}
                  className="btn btn-secondary btn-sm"
                  style={{ alignSelf:"flex-start",display:"flex",alignItems:"center",gap:7 }}>
                  <Icon d={ic.mail} size={14} /> Get Help
                </button>
              </div>

              <div style={{ borderTop:"1px solid var(--border)",paddingTop:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8 }}>
                <div style={{ fontSize:11.5,color:"var(--text3)" }}>
                  © {new Date().getFullYear()} Your Company Name, Inc. All rights reserved.
                </div>
                <div style={{ display:"flex",gap:12 }}>
                  <span style={{ fontSize:11.5,color:"var(--text3)",cursor:"pointer",textDecoration:"underline" }} onClick={() => alert("Privacy Policy — coming soon.")}>Privacy Policy</span>
                  <span style={{ fontSize:11.5,color:"var(--text3)",cursor:"pointer",textDecoration:"underline" }} onClick={() => alert("Terms of Service — coming soon.")}>Terms of Use</span>
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

function TemplatesPage({ projects, onUseTemplate }) {
  const [templates,   setTemplates]   = useState(TEMPLATES);
  const [editTmpl,    setEditTmpl]    = useState(null);   // null | template obj | "new"
  const [deleteTmpl,  setDeleteTmpl]  = useState(null);
  const [useTmpl,     setUseTmpl]     = useState(null);   // template to use — triggers project picker

  const REPORT_TYPES = ["Insurance","Inspection","Contractor","Damage","Progress","Assessment","Quote","Other"];

  // Map report type → tag colour class
  const typeTag = type => {
    if (!type) return "orange";
    const t = type.toLowerCase();
    if (t.includes("insur") || t.includes("damage")) return "blue";
    if (t.includes("inspect") || t.includes("assess")) return "green";
    if (t.includes("contractor") || t.includes("quote")) return "purple";
    return "orange";
  };

  const imgRefs = useRef({});

  const TP = ({ color, img, tmplId, onImgChange }) => (
    <div className="template-preview" style={{ position:"relative", overflow:"hidden", cursor:"default" }}
      onClick={e => e.stopPropagation()}>
      {img
        ? <img src={img} alt="template cover" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
        : <>
            <div className="tmpl-line" style={{ height:16, width:"60%", background:color+"40" }} />
            <div className="tmpl-line" style={{ height:9,  width:"90%" }} />
            <div className="tmpl-line" style={{ height:9,  width:"75%" }} />
            <div style={{ display:"flex", gap:5, marginTop:3 }}>
              <div className="tmpl-line" style={{ height:44, flex:1 }} />
              <div className="tmpl-line" style={{ height:44, flex:1 }} />
            </div>
            <div className="tmpl-line" style={{ height:9, width:"50%" }} />
          </>
      }
      {/* Image upload overlay button */}
      <div style={{ position:"absolute", bottom:6, right:6, display:"flex", gap:5 }}>
        <div title="Change cover image"
          onClick={() => { imgRefs.current[tmplId]?.click(); }}
          style={{ width:28, height:28, borderRadius:6, background:"rgba(0,0,0,.65)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", border:"1px solid rgba(255,255,255,.2)" }}>
          <Icon d={ic.image} size={14} stroke="white" />
        </div>
        {img && (
          <div title="Remove image"
            onClick={() => onImgChange(null)}
            style={{ width:28, height:28, borderRadius:6, background:"rgba(180,30,30,.8)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", border:"1px solid rgba(255,255,255,.2)" }}>
            <Icon d={ic.close} size={13} stroke="white" />
          </div>
        )}
        <input ref={el => imgRefs.current[tmplId] = el} type="file" accept="image/*" style={{ display:"none" }}
          onChange={e => {
            const file = e.target.files?.[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => onImgChange(ev.target.result);
            reader.readAsDataURL(file);
            e.target.value = "";
          }} />
      </div>
    </div>
  );

  // ── Template edit/create modal ──────────────────────────────────────────────
  function TemplateModal({ tmpl, onClose }) {
    const isNew = !tmpl || tmpl === "new";
    const base  = isNew ? { name:"", type:"Inspection", desc:"", color:"#4a90d9" } : tmpl;

    const AUTO_SECTIONS = ["Cover Page","Property Information","Photo Documentation"];
    const TEXT_SECTIONS = ["Scope of Work","Report","Damage Summary","Sign Off"];
    const ALL_SECTIONS  = ["Cover Page","Property Information","Scope of Work","Report","Damage Summary","Photo Documentation","Sign Off"];

    const [name,      setName]      = useState(base.name || "");
    const [type,      setType]      = useState(base.type || "Inspection");
    const [desc,      setDesc]      = useState(base.desc || "");
    const [secEnabled, setSecEnabled] = useState(() => {
      const d = {}; ALL_SECTIONS.forEach((s,i) => { d[s] = base.sections?.[s]?.enabled ?? i < 5; }); return d;
    });
    const [secText,   setSecText]   = useState(() => {
      const d = {}; TEXT_SECTIONS.forEach(s => { d[s] = base.sections?.[s]?.text || ""; }); return d;
    });
    const [sigImg,    setSigImg]    = useState(base.signatureImg || null);
    const [expanded,  setExpanded]  = useState({});
    const sigRef = useRef();

    const toggle       = s => setSecEnabled(p => ({ ...p, [s]: !p[s] }));
    const toggleExpand = s => setExpanded(p => ({ ...p, [s]: !p[s] }));

    // Colour follows type
    const colorForType = t => {
      const lc = (t||"").toLowerCase();
      if (lc.includes("insur")||lc.includes("damage")) return "#4a90d9";
      if (lc.includes("inspect")||lc.includes("assess")) return "#3dba7e";
      if (lc.includes("contractor")||lc.includes("quote")) return "#8b7cf8";
      return "#e86c3a";
    };

    const handleSave = () => {
      if (!name.trim()) return;
      const saved = {
        ...base,
        id: isNew ? uid() : base.id,
        name: name.trim(), type, desc,
        color: colorForType(type),
        sections: Object.fromEntries(ALL_SECTIONS.map(s => [s, { enabled: secEnabled[s], text: secText[s]||"" }])),
        signatureImg: sigImg,
      };
      setTemplates(prev => isNew ? [...prev, saved] : prev.map(t => t.id===saved.id ? saved : t));
      onClose();
    };

    return (
      <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
        <div className="modal fade-in modal-lg">
          <div className="modal-header">
            <div className="modal-title">{isNew ? "Create Template" : `Edit: ${base.name}`}</div>
            <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22} /></button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Template Name</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Water Damage Assessment" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Report Type <span style={{ fontWeight:400, color:"var(--text3)" }}>— sets the tag</span></label>
                <select className="form-input form-select" value={type} onChange={e => setType(e.target.value)}>
                  {REPORT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                {/* Tag preview */}
                <div style={{ marginTop:7, display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:11.5, color:"var(--text3)" }}>Tag preview:</span>
                  <span className={`tag tag-${typeTag(type)}`}>{type}</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Recipient</label>
                <select className="form-input form-select" defaultValue={base.recipient||"Client"}>
                  {["Client","Adjuster","Insurance Company","Contractor","N/A","Other"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input form-textarea" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Short description of when to use this template…" />
            </div>

            {/* Sections */}
            <div className="form-group">
              <label className="form-label" style={{ marginBottom:12 }}>Sections</label>
              {ALL_SECTIONS.map(s => {
                const isAuto   = AUTO_SECTIONS.includes(s);
                const isText   = TEXT_SECTIONS.includes(s);
                const isSignOff = s === "Sign Off";
                const isOn     = secEnabled[s];
                const isOpen   = expanded[s];
                return (
                  <div key={s} style={{ borderBottom:"1px solid var(--border)" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0" }}>
                      <input type="checkbox" checked={!!isOn} onChange={() => toggle(s)} style={{ accentColor:"var(--accent)", flexShrink:0 }} />
                      <span style={{ fontSize:13, flex:1, fontWeight:500 }}>{s}</span>
                      {isAuto && <span style={{ fontSize:11, color:"var(--text3)", background:"var(--surface2)", padding:"2px 8px", borderRadius:10 }}>Auto-filled</span>}
                      {isText && isOn && (
                        <button onClick={() => toggleExpand(s)} style={{ background:"none", border:"1px solid var(--border)", borderRadius:6, padding:"3px 10px", fontSize:11.5, color:"var(--text2)", cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                          {isOpen ? "▲ Hide" : "▼ Edit"}
                        </button>
                      )}
                    </div>
                    {isText && isOn && isOpen && (
                      <div style={{ paddingBottom:14, display:"flex", flexDirection:"column", gap:10 }}>
                        <textarea className="form-input form-textarea" value={secText[s]} onChange={e => setSecText(p => ({ ...p, [s]: e.target.value }))} placeholder={`Default ${s} text…`} style={{ minHeight:100, fontSize:13, resize:"vertical" }} />
                        {isSignOff && (
                          <div>
                            <div style={{ fontSize:12, fontWeight:600, color:"var(--text2)", marginBottom:8 }}>Company Signature</div>
                            <input ref={sigRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => { const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>setSigImg(ev.target.result); r.readAsDataURL(f); }} />
                            {sigImg ? (
                              <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                                <div style={{ border:"1px solid var(--border)", borderRadius:8, padding:"10px 16px", background:"#fff", flex:1, minHeight:64, display:"flex", alignItems:"center" }}>
                                  <img src={sigImg} alt="Signature" style={{ maxHeight:56, maxWidth:"100%", objectFit:"contain" }} />
                                </div>
                                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                                  <button className="btn btn-sm btn-secondary" onClick={() => sigRef.current?.click()}>Replace</button>
                                  <button className="btn btn-sm btn-ghost" style={{ color:"var(--text3)", fontSize:12 }} onClick={() => setSigImg(null)}>Remove</button>
                                </div>
                              </div>
                            ) : (
                              <button className="btn btn-secondary btn-sm" onClick={() => sigRef.current?.click()} style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <Icon d={ic.upload} size={13} /> Upload Signature Image
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!name.trim()} onClick={handleSave}><Icon d={ic.check} size={14} /> {isNew ? "Create Template" : "Save Changes"}</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Project picker modal for "Use" ─────────────────────────────────────────
  function ProjectPickerModal({ tmpl, onClose }) {
    return (
      <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
        <div className="modal fade-in" style={{ maxWidth:480 }}>
          <div className="modal-header">
            <div className="modal-title">Choose a Jobsite</div>
            <button className="btn btn-ghost btn-icon" style={{ width:44,height:44 }} onClick={onClose}><Icon d={ic.close} size={22} /></button>
          </div>
          <div className="modal-body">
            <div style={{ fontSize:13, color:"var(--text2)", marginBottom:14 }}>
              Using <strong style={{ color:"var(--text)" }}>{tmpl.name}</strong> — select which jobsite to create the report under:
            </div>
            {projects?.length > 0 ? (
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {projects.map(p => (
                  <div key={p.id} onClick={() => { onUseTemplate(tmpl, p); onClose(); }}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", cursor:"pointer", background:"var(--surface2)", transition:"border-color .15s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor="var(--accent)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor="var(--border)"}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:p.color, flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:13 }}>{p.title}</div>
                      <div style={{ fontSize:11.5, color:"var(--text3)", marginTop:1 }}>{[p.address, p.city, p.state].filter(Boolean).join(", ") || "No address"}</div>
                    </div>
                    <Icon d={ic.chevRight} size={14} stroke="var(--text3)" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty" style={{ padding:"24px 0" }}>
                <div className="empty-icon"><Icon d={ic.folder} size={24} stroke="var(--text3)" /></div>
                <h3 style={{ fontSize:14 }}>No jobsites yet</h3>
                <p>Create a jobsite first, then come back to use this template.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page fade-in">
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:22 }}>
        <div><div className="section-title">Report Templates</div><div className="section-sub">Reusable templates for insurance, contractors, inspections & more</div></div>
        <button className="btn btn-primary" onClick={() => setEditTmpl("new")}><Icon d={ic.plus} size={15} /> New Template</button>
      </div>

      <div className="grid-3">
        {templates.map(t => (
          <div key={t.id} className="template-card">
            <TP color={t.color} img={t.coverImg || null} tmplId={t.id}
              onImgChange={img => setTemplates(prev => prev.map(x => x.id===t.id ? { ...x, coverImg: img } : x))} />
            <div className="template-info">
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:5 }}>
                <div className="template-name">{t.name}</div>
                <span className={`tag tag-${typeTag(t.type)}`} style={{ flexShrink:0 }}>{t.type}</span>
              </div>
              <div className="template-desc">{t.desc}</div>
              <div style={{ display:"flex", gap:8, marginTop:12 }}>
                <button className="btn btn-sm btn-secondary" style={{ flex:1 }} onClick={() => setEditTmpl(t)}><Icon d={ic.edit} size={12} /> Edit</button>
                <button className="btn btn-sm btn-primary"   style={{ flex:1 }} onClick={() => setUseTmpl(t)}><Icon d={ic.copy} size={12} /> Use</button>
                <button className="btn btn-sm btn-danger btn-icon" onClick={() => setDeleteTmpl(t)}><Icon d={ic.trash} size={13} /></button>
              </div>
            </div>
          </div>
        ))}
        <div className="template-card" style={{ border:"2px dashed var(--border)", cursor:"pointer" }} onClick={() => setEditTmpl("new")}>
          <div style={{ height:130, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8 }}>
            <div style={{ width:46, height:46, borderRadius:"50%", background:"var(--surface2)", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon d={ic.plus} size={20} stroke="var(--accent)" /></div>
            <span style={{ fontSize:13, color:"var(--text2)", fontWeight:600 }}>Create Template</span>
          </div>
          <div className="template-info"><div className="template-name" style={{ color:"var(--text2)" }}>Blank Template</div><div className="template-desc">Start from scratch.</div></div>
        </div>
      </div>

      {editTmpl !== null && <TemplateModal tmpl={editTmpl} onClose={() => setEditTmpl(null)} />}
      {useTmpl   && <ProjectPickerModal tmpl={useTmpl} onClose={() => setUseTmpl(null)} />}

      {deleteTmpl && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setDeleteTmpl(null)}>
          <div className="modal fade-in" style={{ maxWidth:420 }}>
            <div className="modal-header">
              <div className="modal-title">Delete Template?</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDeleteTmpl(null)}><Icon d={ic.close} size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize:13.5, lineHeight:1.6, color:"var(--text2)" }}>Are you sure you want to delete <strong style={{ color:"var(--text)" }}>{deleteTmpl.name}</strong>? This cannot be undone.</p>
              <div className="confirm-box"><Icon d={ic.alert} size={20} stroke="#ff6b6b" /><span style={{ fontSize:13, color:"#ff6b6b" }}>This action cannot be undone.</span></div>
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
  userRole: "admin",
  photoQuality: "moderate",
  timezone: "America/Denver",
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12hr",
  units: "imperial",
  projectSort: "recent",
  notifReports: true, notifPhotos: true, notifUpdates: false,
  // Report defaults
  reportHeaderTitle: "Property Inspection Report",
  reportHeaderNote: "Licensed & Insured · Serving the Greater Denver Area",
  reportFooterLeft: "", reportFooterCenter: "Confidential",
  reportFooterDisclaimer: "",
  defaultReportType: "Assessment", reportPhotoLayout: "3 per row",
  reportShowGps: "yes", reportShowTimestamp: "yes",
  // Email
  emailSubject: "Report from {{company}} — {{project}}",
  emailBody: "Hello {{recipient}},\n\nPlease find attached the report(s) for {{project}} located at {{address}}.\n\n{{reports_list}}\n\nIf you have any questions or require additional information, please don't hesitate to reach out.\n\nBest regards,",
  emailSignatureName: "",
  emailSignatureTitle: "",
  emailSignaturePhone: "",
  emailSignatureEmail: "",
  emailSignatureCompany: "",
  emailSignatureLogoEnabled: true,
  emailSignatureCustomHtml: "",
  // Social links
  sigSocialsEnabled: true,
  sigFacebookEnabled: false, sigFacebookUrl: "",
  sigInstagramEnabled: false, sigInstagramUrl: "",
  sigXEnabled: false, sigXUrl: "",
  sigLinkedInEnabled: false, sigLinkedInUrl: "",
  sigYoutubeEnabled: false, sigYoutubeUrl: "",
  // Review link
  sigReviewEnabled: false,
  sigReviewUrl: "",
  sigReviewLabel: "Leave us a Review ⭐",
  // Add-ons
  aiWriterEnabled: false,
  plan: "base",             // "base" = FieldBase, "pro" = FieldPro
  billingCycle: "monthly",  // "monthly" | "annual"
  signupDate: "2025-03-11", // billing anchor date
  planChangeDate: null,     // ISO date of last plan change (for proration)
  pendingPlan: null,        // plan scheduled to take effect next cycle (null = no pending change)
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
  const [reportCreatorData, setReportCreatorData] = useState(null);
  const [teamUsers,     setTeamUsers]     = useState([]);
  const [tasks,         setTasks]         = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [navCollapsed,  setNavCollapsed]  = useState(false);
  const isPro = settings?.plan === "pro";

  const addNotification = (n) => setNotifications(prev => [n, ...prev]);
  const markRead    = (id) => setNotifications(prev => prev.map(n => n.id===id ? {...n,read:true} : n));
  const markAllRead = ()   => setNotifications(prev => prev.map(n => ({...n,read:true})));
  const clearNotifs = ()   => setNotifications([]);

  // Apply accent color as CSS variable whenever it changes
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", settings.accent);
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
    const now = new Date().toISOString();
    const prevProj = projects.find(p => p.id === proj.id);
    const prevIds  = prevProj?.assignedUserIds || [];
    const newlyAssignedIds = (proj.assignedUserIds||[]).filter(id => !prevIds.includes(id));
    const stamped = { ...proj, updatedAt: now, createdAt: proj.createdAt || now };

    setProjects(prev => prev.some(p => p.id===proj.id) ? prev.map(p => p.id===proj.id ? stamped : p) : [...prev, stamped]);

    // Sync assignedUserIds → each user's assignedProjects list
    // Capture updated users snapshot so notifications can look up names
    let currentUsers = teamUsers;
    setTeamUsers(prev => {
      currentUsers = prev.map(u => {
        const isAssigned = (proj.assignedUserIds||[]).includes(u.id);
        const already    = (u.assignedProjects||[]).includes(proj.id);
        if (isAssigned && !already) return { ...u, assignedProjects: [...(u.assignedProjects||[]), proj.id] };
        if (!isAssigned && already) return { ...u, assignedProjects: (u.assignedProjects||[]).filter(id => id !== proj.id) };
        return u;
      });
      return currentUsers;
    });

    // Fire a notification for each newly assigned user
    const assignerName     = `${settings.userFirstName||""} ${settings.userLastName||""}`.trim() || "Admin";
    const assignerInitials = assignerName.split(" ").map(w=>w[0]||"").join("").slice(0,2).toUpperCase() || "AD";
    const isNew = !prevProj;
    newlyAssignedIds.forEach(userId => {
      const u = teamUsers.find(x => x.id === userId);
      const userName = u ? `${u.firstName} ${u.lastName}`.trim() : "";
      addNotification({
        id: uid(),
        author: assignerName,
        authorInitials: assignerInitials,
        authorColor: "var(--accent)",
        action: isNew ? "added you to new jobsite" : "assigned you to jobsite",
        context: proj.title,
        preview: userName
          ? `${userName} — ${isNew ? "new jobsite" : "jobsite assignment"}: ${proj.title}`
          : `You've been assigned to "${proj.title}"`,
        date: today(),
        read: false,
        type: "assignment",
      });
    });

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
  const handleCameraSave = (items) => {
    if (!cameraProject) return;
    const newPhotos = items.filter(i => !i.isVideo);
    const newVideos = items.filter(i =>  i.isVideo);
    const updated = {
      ...cameraProject,
      photos: [...(cameraProject.photos||[]), ...newPhotos],
      videos: [...(cameraProject.videos||[]), ...newVideos],
    };
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
    { id:"projects",   label:"All Jobsites",   icon:ic.folder,        section:"main"  },
    { id:"tasks",      label:"Tasks",           icon:ic.clipboardList, section:"main"  },
    { id:"templates",  label:"Templates",       icon:ic.templates,     section:"tools" },
    { id:"account",    label:"Account",         icon:ic.shield,        section:"tools" },
    { id:"settings",   label:"Settings",        icon:ic.settings,      section:"tools" },
  ];

  const userInitials = `${settings.userFirstName?.[0]||"J"}${settings.userLastName?.[0]||"D"}`.toUpperCase();

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* ── LEFT NAV ── */}
        <nav className={`nav${navCollapsed ? " collapsed" : ""}`}>
          <div className="nav-brand">
            {settings.logo
              ? <img src={settings.logo} alt="logo" style={{ width:36,height:36,borderRadius:10,objectFit:"contain",background:"white",padding:3,flexShrink:0 }} />
              : <div className="nav-brand-icon"><Icon d={ic.camera} size={18} stroke="white" strokeWidth={2} /></div>
            }
            <div>
              <div className="nav-brand-text">{settings.companyName || "KrakenCam"}</div>
              <div className="nav-brand-sub">Kraken Cam</div>
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
                <div key={item.id} className={`nav-item ${page===item.id?"active":""}`} title={navCollapsed ? item.label : ""}
                  onClick={() => item.id==="cam_quick" ? openCamera(activeProject) : setPage(item.id)}>
                  <Icon d={item.icon} size={15} /><span className="nav-item-label">{item.label}</span>
                </div>
              ))}
            </div>
          )}

          <div className="nav-section">
            <div className="nav-section-label">Navigation</div>
            {NAV.filter(i => i.section==="main").map(item => (
              <div key={item.id} className={`nav-item ${page===item.id?"active":""}`} title={navCollapsed ? item.label : ""} onClick={() => setPage(item.id)}>
                <Icon d={item.icon} size={15} />
                <span className="nav-item-label">{item.label}</span>
                {item.id==="projects" && <span className="nav-badge">{projects.length}</span>}
                {item.id==="tasks"    && tasks.filter(t=>t.status!=="done").length > 0 && <span className="nav-badge">{tasks.filter(t=>t.status!=="done").length}</span>}
                {item.id==="account"  && teamUsers.length > 0 && <span className="nav-badge">{teamUsers.length + 1}</span>}
              </div>
            ))}
          </div>
          <div className="nav-section">
            <div className="nav-section-label">Tools</div>
            {NAV.filter(i => i.section==="tools").map(item => (
              <div key={item.id} className={`nav-item ${page===item.id?"active":""}`} title={navCollapsed ? item.label : ""} onClick={() => setPage(item.id)}>
                <Icon d={item.icon} size={15} /><span className="nav-item-label">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="nav-footer">
            <div className="nav-collapse-btn" title={navCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setNavCollapsed(v => !v)}
              style={{ width:"100%", height:34, borderRadius:8, border:"1px solid var(--border)", marginBottom:10, background:"var(--surface2)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {navCollapsed
                  ? <><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></>
                  : <><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></>
                }
              </svg>
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:"var(--radius-sm)",background:"var(--surface2)",cursor:"pointer",width:"100%",boxSizing:"border-box" }}
              onClick={() => setPage("settings")}>
              <div style={{ width:32,height:32,borderRadius:"50%",background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12,color:"white",flexShrink:0,overflow:"hidden" }}>
                {settings.userAvatar
                  ? <img src={settings.userAvatar} alt="avatar" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                  : userInitials
                }
              </div>
              <div className="nav-footer-text">
                <div style={{ fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{settings.userFirstName} {settings.userLastName}</div>
                <div style={{ fontSize:11,color:"var(--text2)" }}>{isPro ? "✦ FieldPro" : "FieldBase"} · {settings?.billingCycle==="annual"?"Annual":"Monthly"}</div>
              </div>
              {!navCollapsed && <div className="dot" />}
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
                {page==="templates" && <div className="topbar-title desktop-only">Report Templates</div>}
                {page==="tasks"     && <div className="topbar-title">Tasks</div>}
                {page==="settings"  && <div className="topbar-title">Settings</div>}
                {page==="account"   && <div className="topbar-title">Team</div>}
              </div>
              <div className="topbar-actions">
                <button className="btn btn-secondary btn-sm" style={{ display:"flex",alignItems:"center",gap:6 }} onClick={() => { if(window.confirm("Sign out of Kraken Cam?")) alert("Signed out."); }}>
                  <Icon d={ic.logOut} size={14} /> Sign Out
                </button>
                <NotificationBell notifications={notifications} onMarkRead={markRead} onMarkAllRead={markAllRead} onClear={clearNotifs} />
              </div>
            </div>
          )}

          {page === "projects" && (
            <ProjectsList projects={projects} teamUsers={teamUsers} settings={settings} onSelect={p => { setActiveProject(p); setPage("detail"); }} onNew={() => setShowNewProject(true)} onEdit={p => setEditingProject(p)} onDelete={deleteProject} />
          )}
          {page === "detail" && activeProject && (
            <ProjectDetail
              project={projects.find(p => p.id===activeProject.id) || activeProject}
              teamUsers={teamUsers}
              onBack={() => { setPage("projects"); setActiveProject(null); }}
              onEdit={p => setEditingProject(p)}
              onOpenCamera={openCamera}
              onEditPhoto={photo => { setEditingPhoto(photo); setPage("editor"); }}
              onUpdateProject={updateProject}
              onOpenReportCreator={openReportCreator}
              settings={settings}
            />
          )}
          {page === "camera" && (
            <CameraPage project={cameraProject} defaultRoom={cameraProject?._defaultRoom} onSave={handleCameraSave} onClose={() => { setCameraProject(null); setPage(activeProject ? "detail" : "projects"); }} settings={settings} />
          )}
          {page === "editor" && (
            <ImageEditor
              photo={editingPhoto}
              onClose={() => setPage(activeProject ? "detail" : "projects")}
              onSave={dataUrl => {
                if (!editingPhoto || !activeProject) return;
                const proj = projects.find(p => p.id === activeProject.id);
                if (!proj) return;
                const updatedPhotos = proj.photos.map(p =>
                  p.id === editingPhoto.id ? { ...p, dataUrl } : p
                );
                updateProject({ ...proj, photos: updatedPhotos });
              }}
            />
          )}
          {page === "templates" && (
            <div className="desktop-only" style={{ flex:1 }}>
              <TemplatesPage projects={projects} onUseTemplate={(tmpl, proj) => { openReportCreator(proj, { id:uid(), title:tmpl.name, type:tmpl.type, reportType:tmpl.type, date:today(), status:"draft", photos:0, color:tmpl.color, _fromTemplate:tmpl.id }); }} />
            </div>
          )}
          {page === "tasks"     && <TasksPage projects={projects} teamUsers={teamUsers} settings={settings} tasks={tasks} onTasksChange={setTasks} onNotify={addNotification} />}
          {page === "account"   && <AccountPage settings={settings} onSettingsChange={setSettings} projects={projects} users={teamUsers} onUsersChange={setTeamUsers} onProjectsChange={setProjects} onNotify={addNotification} />}
          {page === "settings" && (
            <SettingsPage settings={settings} onSave={s => setSettings(s)} onDeleteAccount={() => {
              setProjects([]);
              setTasks([]);
              setTeamUsers([]);
              setNotifications([]);
              setActiveProject(null);
              setSettings({});
              setPage("projects");
            }} />
          )}
        </div>

        {/* ── PROJECT MODAL ── */}
        {(showNewProject || editingProject) && (
          <ProjectModal
            project={editingProject}
            teamUsers={teamUsers}
            settings={settings}
            onSave={proj => { saveProject(proj); if (editingProject && activeProject?.id===proj.id) setActiveProject(proj); }}
            onClose={() => { setShowNewProject(false); setEditingProject(null); }}
          />
        )}

        {/* ── REPORT CREATOR (fullscreen overlay, desktop only) ── */}
        {reportCreatorData && (
          <div className="desktop-only" style={{ position:"fixed",inset:0,zIndex:200,background:"var(--bg)" }}>
            <ReportCreator
              project={projects.find(p => p.id===reportCreatorData.project.id) || reportCreatorData.project}
              reportData={reportCreatorData.report}
              settings={settings}
              templates={TEMPLATES}
              users={teamUsers}
              onSave={saved => saveReport(reportCreatorData.project, saved)}
              onClose={() => setReportCreatorData(null)}
              onUpgradeAi={() => setSettings(s => ({...s, plan: "pro"}))}
              userRole={settings?.userRole || "admin"}
            />
          </div>
        )}

        {/* MOBILE BOTTOM NAV */}
        <nav className={"mob-nav" + (isFullscreen ? " hidden" : "")}>
          <div className="mob-nav-inner">
            <div className={`mob-nav-item ${page==="projects"||page==="detail"?"active":""}`} onClick={() => setPage("projects")}>
              <Icon d={ic.folder} size={22} strokeWidth={page==="projects"||page==="detail"?2.5:1.8} />
            </div>
            <div className={`mob-nav-item ${page==="tasks"?"active":""}`} onClick={() => setPage("tasks")} style={{ position:"relative" }}>
              <Icon d={ic.clipboardList} size={22} strokeWidth={page==="tasks"?2.5:1.8} />
              {tasks.filter(t=>t.status!=="done").length > 0 && (
                <span className="mob-badge">{tasks.filter(t=>t.status!=="done").length}</span>
              )}
            </div>
            <div className={`mob-nav-item ${page==="settings"?"active":""}`} onClick={() => setPage("settings")}>
              <Icon d={ic.settings} size={22} strokeWidth={page==="settings"?2.5:1.8} />
            </div>
            <div className="mob-nav-cam-wrap" onClick={() => activeProject ? openCamera(activeProject) : setPage("projects")}>
              <div className="mob-nav-cam">
                <Icon d={ic.camera} size={20} stroke="white" strokeWidth={2} />
              </div>
            </div>
          </div>
        </nav>
      </div>
    </>
  );
}
