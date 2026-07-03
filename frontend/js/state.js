// Global Application State Variables
let currentSheetList = [];
let selectedVolType = null;
let allNames = [];
let allProjects = []; 
let currentVolTypeRequest = null;
let isAdminAuthenticated = false;
let pendingView = "";
let currentActiveView = 'landing';
let outingReminders = {};

// Setting defaults
const DEF_SHARE_FORMAT = "{{Groups}} | {{Meetings}} | {{Dismissals}} | Total: {{Count}}\n\n{{List}}";
let appSettings = null;