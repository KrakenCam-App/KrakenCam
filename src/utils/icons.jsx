import React from "react";
import { getRoomIcon } from "./helpers.js";

// ── Icon component ────────────────────────────────────────────────────────────
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
  mic:      "M12 2a3 3 0 013 3v7a3 3 0 11-6 0V5a3 3 0 013-3z M19 10a7 7 0 01-14 0 M12 19v3 M8 22h8",
  ruler:    "M5 3l4 4-8 8a2 2 0 000 2.83l.17.17a2 2 0 002.83 0L12 10l4 4 2-2L4 2 3 3z M15 5l2 2 M12 8l2 2 M9 11l2 2",
  dimension:"M21 6H3 M3 6l3-3M3 6l3 3 M21 6l-3-3 M21 6l-3 3 M12 6v12",
  eraser:   "M20 20H7L3 16l10-10 7 7-2.5 2.5 M6.0 11.0l5 5",
  square:   "M3 3h18v18H3z",
  circle:   "M12 22a10 10 0 100-20 10 10 0 000 20z",
  minus:    "M5 12h14",
  arrowUpRight: "M7 17L17 7 M7 7h10v10",
  droplet:  "M12 2.69l5.66 5.66a8 8 0 11-11.31 0z",
  move:     "M5 9l-3 3 3 3 M9 5l3-3 3 3 M15 19l-3 3-3-3 M19 9l3 3-3 3 M2 12h20 M12 2v20",
  calendarIcon: "M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  dispatch: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v4H3z M14 14h7v4h-7z M7 17h4m-2-2v4",
  pieChart: "M21.21 15.89A10 10 0 118 2.83 M22 12A10 10 0 0012 2v10z",
  zap:      "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
};

// ── Room icon helpers ─────────────────────────────────────────────────────────
export const ROOM_ICON_BLUE = "#4a90d9";

function RoomIcon({ name = "Other", size = 18, stroke = ROOM_ICON_BLUE, strokeWidth = 1.8 }) {
  return <Icon d={getRoomIcon(name)} size={size} stroke={stroke} strokeWidth={strokeWidth} />;
}
function RoomIconBadge({ name = "Other", size = 18, box = 38 }) {
  return (
    <div style={{ width:box,height:box,borderRadius:12,border:`1.5px solid ${ROOM_ICON_BLUE}33`,background:"#f4f9ff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
      <RoomIcon name={name} size={size} />
    </div>
  );
}

export { Icon, ic, RoomIcon, RoomIconBadge };
