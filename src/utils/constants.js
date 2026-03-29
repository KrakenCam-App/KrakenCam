// ── Plan limits ──────────────────────────────────────────────────────────────
const PLAN_AI_LIMITS   = { base: 5, pro: 75, command: 1000 }; // weekly Krakens per account
const PLAN_CHAT_LIMITS     = { base: 4, pro: 15, command: 50  }; // max chat groups per account
const PLAN_CALENDAR_USERS  = { base: 10, pro: 25, command: Infinity }; // max users visible on calendar
const PLAN_VIDEO_LIMIT_SECS = { base: 90, pro: 360, command: 720 }; // max video recording seconds (90s=1.5min, 360s=6min, 720s=12min)
const PLAN_CALENDAR_RECUR  = { base: false, pro: true, command: true }; // can use recurring events
const PLAN_CALENDAR_DISPATCH = { base: false, pro: false, command: true }; // dispatch board view

// ── AI/generation week window helpers ────────────────────────────────────────
const getWeekWindowStart = () => {
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat
  // Window resets Saturday at 23:59 — so window START is Sunday 00:00 after last Saturday reset
  // Days since last Sunday: day (since Sunday=0)
  const daysSinceSunday = day;
  const start = new Date(now);
  start.setDate(start.getDate() - daysSinceSunday);
  start.setHours(0, 0, 0, 0);
  return start;
};

// Returns ISO date string of next Saturday 23:59 reset
const getNextResetDate = () => {
  const now = new Date();
  const day = now.getDay(); // 0=Sun…6=Sat
  const daysUntilSat = day === 6 ? 7 : 6 - day;
  const reset = new Date(now);
  reset.setDate(reset.getDate() + daysUntilSat);
  reset.setHours(23, 59, 0, 0);
  return reset;
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
const TEMPLATES = [
  { id:1, name:"Insurance Claim Report",     desc:"Property damage insurance claims. Includes liability and damage assessment fields.", type:"Insurance",  color:"#4a90d9" },
  { id:2, name:"Contractor Quote Package",   desc:"Send to contractors for bid requests with scope of work and material specs.",        type:"Contractor", color:"#3dba7e" },
  { id:3, name:"Property Inspection",        desc:"Full property walkthrough covering all rooms and systems.",                          type:"Inspection", color:"#8b7cf8" },
  { id:4, name:"Water Damage Assessment",    desc:"Specialized template for water damage and moisture documentation.",                  type:"Damage",     color:"#e85a3a" },
  { id:5, name:"Renovation Progress Report", desc:"Track renovation phases, completed work, and remaining tasks.",                     type:"Progress",   color:"#e8c53a" },
  { id:6, name:"Fire Damage Documentation",  desc:"Detailed fire and smoke damage assessment for restoration companies.",              type:"Damage",     color:"#e8703a" },
];

// ── Default checklist templates ───────────────────────────────────────────────
const DEFAULT_CL_TEMPLATES = [
  {
    id:"tmpl_general", name:"General Site Inspection", desc:"Standard walkthrough for any jobsite visit",
    category:"General", tags:["inspection","walkthrough","general"],
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
    category:"Water Damage", tags:["water","restoration","insurance","damage"],
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
    category:"Safety", tags:["ppe","safety","compliance"],
    fields:[
      { id:"f1", type:"multi_checkbox", label:"PPE confirmed in use",           options:["Hard Hat","Safety Glasses","Work Boots","Respirator","Tyvek Suit","Gloves","High Viz"], required:true },
      { id:"f2", type:"yesno",          label:"Safety signage posted",          required:true },
      { id:"f3", type:"yesno",          label:"First aid kit accessible",       required:true },
      { id:"f4", type:"dropdown",       label:"Site safety rating",             options:["Compliant","Minor issues","Non-compliant","Stopped work"], required:true },
      { id:"f5", type:"text",           label:"Inspector notes",                required:false },
    ],
  },
];

// ── Task columns ─────────────────────────────────────────────────────────────
const DEFAULT_COLUMNS = [
  { id:"backlog",     label:"Backlog",      color:"#6b7280" },
  { id:"todo",        label:"To Do",        color:"#3ab8e8" },
  { id:"inprogress",  label:"In Progress",  color:"#8b7cf8" },
  { id:"review",      label:"In Review",    color:"#e8c53a" },
  { id:"done",        label:"Done",         color:"#3dba7e" },
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
  TEMPLATES, DEFAULT_CL_TEMPLATES, DEFAULT_COLUMNS,
  getWeekWindowStart, getNextResetDate,
};
