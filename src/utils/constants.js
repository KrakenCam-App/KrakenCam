// ── Plan limits ──────────────────────────────────────────────────────────────
const PLAN_AI_LIMITS   = { base: 10, pro: 75, command: 1000 }; // weekly Krakens per account
const PLAN_CHAT_LIMITS     = { base: 4, pro: 15, command: 50  }; // max chat groups per account
const PLAN_CALENDAR_USERS  = { base: 10, pro: 25, command: Infinity }; // max users visible on calendar
const PLAN_VIDEO_LIMIT_SECS = { base: 90, pro: 360, command: 720 }; // max video recording seconds (90s=1.5min, 360s=6min, 720s=12min)
const PLAN_CALENDAR_RECUR  = { base: false, pro: true, command: true }; // can use recurring events
const PLAN_CALENDAR_DISPATCH = { base: false, pro: false, command: true }; // dispatch board view

// ── AI/generation week window helpers ────────────────────────────────────────
// All resets are keyed to Saturday 23:59 PM Central Time (America/Chicago).
// This ensures ALL organizations reset at the same moment regardless of user timezone.

// Helper: given a Date, return which day-of-week it is in Central time (0=Sun…6=Sat)
const _centralDow = (date) => {
  const parts = {};
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short' })
    .formatToParts(date).forEach(({ type, value }) => { parts[type] = value; });
  return { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }[parts.weekday] ?? 0;
};

// Helper: return the UTC Date corresponding to midnight Central on a given Central calendar date
const _centralMidnightUTC = (centralYear, centralMonth, centralDay) => {
  // Start with 06:00 UTC (≈ midnight CST). Check actual Central hour and adjust.
  const candidate = new Date(Date.UTC(centralYear, centralMonth - 1, centralDay, 6, 0, 0));
  const hourStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: '2-digit', hour12: false }).format(candidate);
  const centralHour = parseInt(hourStr, 10) || 0;
  candidate.setUTCHours(candidate.getUTCHours() - centralHour);
  return candidate;
};

// Helper: get today's date parts in Central time
const _centralDateParts = (date) => {
  const parts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'
  }).formatToParts(date).forEach(({ type, value }) => { parts[type] = value; });
  return { y: parseInt(parts.year), mo: parseInt(parts.month), d: parseInt(parts.day), weekday: parts.weekday };
};

// Returns the UTC Date representing the start of the current AI generation window.
// Window starts at Sunday 00:00 AM Central (= immediately after Saturday 23:59 Central reset).
const getWeekWindowStart = () => {
  const now = new Date();
  const { y, mo, d, weekday } = _centralDateParts(now);
  const dow = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }[weekday] ?? 0;
  // Sunday's date in Central calendar (subtract dow days)
  let sunD = d - dow, sunMo = mo, sunY = y;
  if (sunD < 1) {
    sunMo -= 1;
    if (sunMo < 1) { sunMo = 12; sunY -= 1; }
    sunD += new Date(sunY, sunMo, 0).getDate();
  }
  return _centralMidnightUTC(sunY, sunMo, sunD);
};

// Returns the UTC Date of the next Saturday 23:59 Central Time reset.
const getNextResetDate = () => {
  const now = new Date();
  const { y, mo, d, weekday } = _centralDateParts(now);
  const dow = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }[weekday] ?? 0;
  // Days until next Saturday (if today is Saturday, next reset is 7 days away)
  const daysUntilSat = dow === 6 ? 7 : 6 - dow;
  let satD = d + daysUntilSat, satMo = mo, satY = y;
  const daysInMo = new Date(satY, satMo, 0).getDate();
  if (satD > daysInMo) { satD -= daysInMo; satMo += 1; if (satMo > 12) { satMo = 1; satY += 1; } }
  // Saturday 23:59 Central = Sunday 00:00 Central - 1 minute
  const sunMidnight = _centralMidnightUTC(satY, satMo, satD + 1 > new Date(satY, satMo, 0).getDate() ? 1 : satD + 1);
  // Adjust month if satD+1 overflows
  let nextSunD = satD + 1, nextSunMo = satMo, nextSunY = satY;
  if (nextSunD > daysInMo) { nextSunD = 1; nextSunMo += 1; if (nextSunMo > 12) { nextSunMo = 1; nextSunY += 1; } }
  const resetUTC = _centralMidnightUTC(nextSunY, nextSunMo, nextSunD);
  resetUTC.setUTCMinutes(resetUTC.getUTCMinutes() - 1); // back to 23:59 Central on Saturday
  return resetUTC;
};

// ── Permission system ─────────────────────────────────────────────────────────
const PERMISSION_LEVELS = ["none","view","edit"];

const FEATURE_PERMS = [
  { id:"projects",   label:"Jobsites",          desc:"View, create, edit, and organize projects." },
  { id:"photos",     label:"Photos & Camera",   desc:"Capture, edit, and manage jobsite photos." },
  { id:"videos",     label:"Videos",            desc:"Record and manage jobsite video walkthroughs." },
  { id:"voiceNotes", label:"Voice Notes",       desc:"Record jobsite and chat voice notes." },
  { id:"files",      label:"Files",             desc:"Upload, preview, and manage project files." },
  { id:"reports",    label:"Reports",           desc:"Build, edit, and review reports." },
  { id:"checklists", label:"Checklists",        desc:"Run inspections, checklists, and punchlists." },
  { id:"sketches",   label:"Sketches",          desc:"Create sketches and floor plans." },
  { id:"tasks",      label:"Tasks",             desc:"Assign and complete tasks." },
  { id:"calendar",   label:"Calendar",          desc:"View and manage calendar events." },
  { id:"templates",  label:"Templates",         desc:"Manage reusable report and checklist templates." },
  { id:"analytics",  label:"Analytics",         desc:"Open dashboards and manager KPIs." },
  { id:"messages",   label:"Chats & DMs",       desc:"Use team chat, group chat, and direct messages." },
  { id:"exports",    label:"Export / Print",    desc:"Print and export reports and files." },
  { id:"deletes",    label:"Delete Content",    desc:"Delete records, uploads, and other stored items." },
  { id:"team",       label:"Team Management",   desc:"View and edit users, roles, and access." },
  { id:"billing",    label:"Billing",           desc:"See billing, plan, and payment details." },
  { id:"settings",   label:"Company Settings",  desc:"Manage account-wide settings and permissions." },
];

const DEFAULT_ROLE_PERMISSIONS = {
  admin: {
    projects:"edit", photos:"edit", videos:"edit", voiceNotes:"edit", files:"edit",
    reports:"edit", checklists:"edit", sketches:"edit", tasks:"edit", calendar:"edit",
    templates:"edit", analytics:"edit", messages:"edit", exports:"edit", deletes:"edit",
    team:"edit", billing:"edit", settings:"edit",
  },
  manager: {
    projects:"edit", photos:"edit", videos:"edit", voiceNotes:"edit", files:"edit",
    reports:"edit", checklists:"edit", sketches:"edit", tasks:"edit", calendar:"edit",
    templates:"view", analytics:"view", messages:"edit", exports:"edit", deletes:"view",
    team:"edit", billing:"none", settings:"none",
  },
  user: {
    projects:"view", photos:"edit", videos:"edit", voiceNotes:"edit", files:"view",
    reports:"view", checklists:"edit", sketches:"edit", tasks:"view", calendar:"view",
    templates:"none", analytics:"none", messages:"edit", exports:"none", deletes:"none",
    team:"none", billing:"none", settings:"none",
  },
};

const DEFAULT_PERMISSION_POLICIES = {
  chatAllowDirect: true,
  chatAllowUserMsg: true,
  allowUserExports: false,
  allowUserDeletes: false,
  allowUserFileDownloads: true,
  allowUserFileUploads: true,
  allowUserProjectCreation: false,
  allowManagerBillingAccess: false,
  allowManagerPermissionEditing: false,
};

const normalisePermissionValue = (value, fallback = "none") =>
  PERMISSION_LEVELS.includes(value) ? value : fallback;

const normalisePermissionMap = (raw = {}, fallback = {}) =>
  FEATURE_PERMS.reduce((acc, feature) => {
    acc[feature.id] = normalisePermissionValue(raw?.[feature.id], fallback?.[feature.id] || "none");
    return acc;
  }, {});

const getPermissionPolicies = (settings = {}) => ({
  ...DEFAULT_PERMISSION_POLICIES,
  ...(settings?.permissionPolicies || {}),
  chatAllowDirect: settings?.chatAllowDirect !== undefined
    ? settings.chatAllowDirect !== false
    : (settings?.permissionPolicies?.chatAllowDirect ?? DEFAULT_PERMISSION_POLICIES.chatAllowDirect),
  chatAllowUserMsg: settings?.chatAllowUserMsg !== undefined
    ? settings.chatAllowUserMsg !== false
    : (settings?.permissionPolicies?.chatAllowUserMsg ?? DEFAULT_PERMISSION_POLICIES.chatAllowUserMsg),
});

const getRolePermissionDefaults = (role = "user", settings = {}) => {
  const base = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.user;
  const custom = settings?.rolePermissions?.[role];
  const merged = normalisePermissionMap(custom || {}, base);
  const policies = getPermissionPolicies(settings);

  if (role === "manager" && policies.allowManagerBillingAccess) merged.billing = "view";
  if (role === "user" && policies.allowUserExports && merged.exports === "none") merged.exports = "view";
  if (role === "user" && policies.allowUserDeletes && merged.deletes === "none") merged.deletes = "view";
  if (role === "user" && policies.allowUserProjectCreation && merged.projects === "view") merged.projects = "edit";
  if (role === "user" && policies.allowUserFileDownloads && merged.files === "none") merged.files = "view";
  if (role === "user" && policies.allowUserFileUploads && merged.files === "view") merged.files = "edit";

  return merged;
};

const getEffectivePermissions = (role = "user", overrides = {}, settings = {}) =>
  normalisePermissionMap(overrides || {}, getRolePermissionDefaults(role, settings));

const hasPermissionLevel = (permissions = {}, featureId, required = "view") => {
  const current = PERMISSION_LEVELS.indexOf(normalisePermissionValue(permissions?.[featureId], "none"));
  const needed = PERMISSION_LEVELS.indexOf(required);
  return current >= needed;
};

const canAccessFeature = (settings = {}, featureId, required = "view", overrides = null, role = null) => {
  const resolvedRole = role || settings?.userRole || "admin";
  const effective = getEffectivePermissions(resolvedRole, overrides ?? settings?.userPermissions, settings);
  return hasPermissionLevel(effective, featureId, required);
};

const setRolePermissionLevel = (settings = {}, role, featureId, value) => ({
  ...(settings?.rolePermissions || {}),
  [role]: {
    ...getRolePermissionDefaults(role, settings),
    [featureId]: normalisePermissionValue(value, "none"),
  },
});

// ── User/cert skeletons ───────────────────────────────────────────────────────
const EMPTY_USER = {
  id:"", firstName:"", lastName:"", email:"", phone:"", mobile:"",
  title:"", department:"", employeeId:"", startDate:"",
  role:"user", status:"active", assignedProjects:[], permissions:{ ...DEFAULT_ROLE_PERMISSIONS.user },
  notes:"", address:"", city:"", state:"", zip:"",
  certifications:[],
};

const EMPTY_CERT = {
  id:"", name:"", certCode:"", certifyingBody:"", dateCertified:"", dateExpires:"", image:null,
};

// ── Project defaults ──────────────────────────────────────────────────────────
const DEFAULT_CLIENT_PORTAL = {
  enabled: false,
  slug: "",
  welcomeTitle: "",
  welcomeMessage: "Welcome to your project portal. We’ll keep this page updated with progress, files, and the latest project media so you always know what’s happening.",
  shareProgress: true,
  sharePhotos: true,
  shareVideos: true,
  shareSketches: true,
  shareReports: true,
  shareFiles: true,
  allowClientNotes: true,
  reviewEnabled: false,
  reviewLabel: "Leave us a Review",
  reviewUrl: "",
  passwordEnabled: false,
  password: "",
  clientNotes: [],
  teamMessages: [],
};

const DEFAULT_ROOMS = ["Living Room","Kitchen","Master Bedroom","Bathroom","Garage","Basement","Exterior"];

// ── Report templates ─────────────────────────────────────────────────────────
const TEMPLATES = [];

// ── Default checklist templates ───────────────────────────────────────────────
const DEFAULT_CL_TEMPLATES = [];

// ── Task columns ─────────────────────────────────────────────────────────────
const DEFAULT_COLUMNS = [
  { id:"backlog",     label:"Backlog",      color:"#6b7280" },
  { id:"todo",        label:"To Do",        color:"#3ab8e8" },
  { id:"inprogress",  label:"In Progress",  color:"#8b7cf8" },
  { id:"review",      label:"In Review",    color:"#e8c53a" },
  { id:"done",        label:"Done",         color:"#3dba7e" },
];

// ── Task skeleton ────────────────────────────────────────────────────────────
const EMPTY_TASK = {
  id:"", title:"", description:"", priority:"medium", status:"todo",
  assigneeIds:[], projectId:"", dueDate:"", dueTime:"", tags:[], checklist:[],
  createdBy:"admin", createdByUserId:null, visibility:"shared", createdAt:"", comments:[],
  repeatEnabled: false, repeatType:"days", repeatValue:1, repeatDay:1, repeatWeekday:1,
  attachments:[],
};

// ── Plan display names ───────────────────────────────────────────────────────
const PLAN_NAMES = { base: "Capture I", pro: "Intelligence II", command: "Command III" };

// ── Checklist field types ────────────────────────────────────────────────────
const FIELD_TYPES = [
  { id:"checkbox",       label:"Single Checkbox",    icon:"☑"  },
  { id:"multi_checkbox", label:"Multi Checkbox",     icon:"☑☑" },
  { id:"dropdown",       label:"Dropdown",           icon:"▾"  },
  { id:"text",           label:"Text Answer",        icon:"T"  },
  { id:"yesno",          label:"Yes / No",           icon:"Y/N"},
  { id:"number",         label:"Number",             icon:"#"  },
];

export {
  PLAN_AI_LIMITS, PLAN_CHAT_LIMITS, PLAN_CALENDAR_USERS, PLAN_VIDEO_LIMIT_SECS,
  PLAN_CALENDAR_RECUR, PLAN_CALENDAR_DISPATCH,
  PERMISSION_LEVELS, FEATURE_PERMS,
  DEFAULT_ROLE_PERMISSIONS, DEFAULT_PERMISSION_POLICIES,
  normalisePermissionValue, normalisePermissionMap,
  getPermissionPolicies, getRolePermissionDefaults,
  getEffectivePermissions, hasPermissionLevel,
  canAccessFeature, setRolePermissionLevel,
  EMPTY_USER, EMPTY_CERT,
  DEFAULT_CLIENT_PORTAL, DEFAULT_ROOMS,
  EMPTY_TASK, PLAN_NAMES,
  TEMPLATES, DEFAULT_CL_TEMPLATES, DEFAULT_COLUMNS,
  FIELD_TYPES,
  getWeekWindowStart, getNextResetDate,
};
