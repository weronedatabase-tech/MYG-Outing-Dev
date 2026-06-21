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
const DEF_SHARE_FORMAT = "{{Groups}} | {{Meets}} | {{Dismissals}} | Total: {{Count}}\n\n{{List}}";
const DEF_POPUP_FORMAT = "👤 {{name}} (Grp {{group}})\n\n📍 Meet: {{meetingloc}}\n🏁 Dismiss: {{dismissalloc}}\n🤝 Paired Vol(s): {{volpaired}}\n\n🍽️ Dietary: {{dietaryrestrictions}}\n📞 CG Contact: {{caregivercontacts}}\n📝 Remarks: {{remarks}}";
let appSettings = null;