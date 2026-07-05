let currentGroupingSheetUrl = null;
let groupingData = { trainees: [], volunteers: [], meetingLocs: [], dismissalLocs: [] };
let pendingGroupingUpdates = [];
let isGroupingSyncing = false;
let groupingSyncTimeout = null;
let groupingPollInterval = null;
let currentGroupingSearch = "";
let lastGroupingLocalChange = 0;
let activeGroups = ["1", "2", "3", "4", "5"]; // Pre-populate standard groups

const EXPORT_COLORS = [
'#fef2f2', '#eff6ff', '#f0fdf4', '#fefce8', 
'#faf5ff', '#fff7ed', '#f0fdfa', '#fdf2f8', '#eef2ff'
];

// ==========================================
// VERTICAL GROUPING CORE
// ==========================================

function openManualGrouping() {
const selector = document.getElementById('commSheetSelector');
const url = selector.value;
if(!url || url.includes("Select") || url.includes("Loading") || url.includes("Error")) return alert("Select an event first");

currentGroupingSheetUrl = url;
document.getElementById('navContextTitle').innerText = "Manual Group: " + selector.options[selector.selectedIndex].text;

currentGroupingSearch = "";
document.getElementById('groupingSearchInput').value = "";
if (typeof toggleClearBtn === 'function') toggleClearBtn('groupingSearchInput');

showView('manual-grouping');
loadGroupingData();
}

function loadGroupingData() {
const overlay = document.getElementById('groupingLoadingOverlay');
overlay.classList.remove('hidden');

apiCall('fetchManualPairingData', { sheetUrl: currentGroupingSheetUrl }).then(res => {
overlay.classList.add('hidden');
if (res.success) {
groupingData = res.data;
renderGroupingList();
startGroupingPolling();
} else {
alert("Error: " + res.message);
showView('comm');
}
});
}

let groupingSearchTimeout = null;
function changeGroupingSearch() {
if (groupingSearchTimeout) clearTimeout(groupingSearchTimeout);
groupingSearchTimeout = setTimeout(() => {
currentGroupingSearch = document.getElementById('groupingSearchInput').value.toLowerCase().trim();
renderGroupingList();
}, 300);
}

// ==========================================
// RENDER VERTICAL LIST UI
// ==========================================

function renderGroupingList() {
const container = document.getElementById('groupingList');

// SAVE SCROLL POSITION FOR SEAMLESS BACKGROUND POLLING UPDATES
const scrollPos = container ? container.scrollTop : 0;

let activeTrainees = (groupingData.trainees || []).filter(t => t.attending === 'y' && !t.isGoneHome);

// Detect dynamically created groups in the data
let groupSet = new Set(activeGroups);
activeTrainees.forEach(t => {
const g = String(t.group || "").trim();
if (g) groupSet.add(g);
});
activeGroups = Array.from(groupSet).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));

// Search Filtering
if (currentGroupingSearch) {
activeTrainees = activeTrainees.filter(item => {
return item.name.toLowerCase().includes(currentGroupingSearch) || 
      (item.volPaired && item.volPaired.toLowerCase().includes(currentGroupingSearch));
});
}

// Columns/Sections Setup
const cols = ["UNASSIGNED", ...activeGroups];
let html = '';

cols.forEach(g => {
const isUnassigned = g === "UNASSIGNED";
const title = isUnassigned ? "Unassigned" : `Group ${g}`;

const colTrainees = activeTrainees.filter(t => isUnassigned ? String(t.group||"").trim() === "" : String(t.group||"").trim() === g);

// Skip empty groups unless it's Unassigned
if (colTrainees.length === 0 && !isUnassigned) return;

// Sort alphabetically within sections
colTrainees.sort((a,b) => a.name.localeCompare(b.name));

let cardsHtml = '';
colTrainees.forEach(t => {
const safeName = t.name.replace(/'/g, "\\'");

let volBadge = '';
if (t.volPaired) {
   volBadge = `<div class="mt-2 text-[10px] text-teal-600 dark:text-teal-400 font-bold leading-tight bg-teal-50 dark:bg-teal-900/30 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800/50 inline-block"><i class="fa-solid fa-handshake-angle mr-1"></i>${t.volPaired}</div>`;
} else {
   volBadge = `<div class="mt-2 text-[9px] uppercase tracking-wider text-red-500 font-black bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded inline-block"><i class="fa-solid fa-circle-exclamation mr-1"></i>Unpaired</div>`;
}

let extras = '';
if (t.extra?.t_one_on_one) {
   const oneOnOneRaw = String(t.extra.t_one_on_one).trim().toLowerCase();
   if (oneOnOneRaw !== '' && !['no', 'n', 'false', '0'].includes(oneOnOneRaw)) {
       extras += `<i class="fa-solid fa-star text-yellow-500 text-[10px] ml-1" title="1-1 Required: ${String(t.extra.t_one_on_one).replace(/"/g, '&quot;')}"></i>`;
   }
}
if (t.extra?.remark) {
   extras += `<i class="fa-solid fa-note-sticky text-yellow-500 text-[10px] ml-1 cursor-help" title="${t.extra.remark.replace(/"/g, '&quot;')}"></i>`;
}

let cgBadge = '';
if (t.caregivers > 0) {
   cgBadge = `<span class="inline-flex shrink-0 items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-[9px] font-black text-white shadow-sm ml-1">${t.caregivers > 1 ? t.caregivers + 'C' : 'C'}</span>`;
}

cardsHtml += `
<div class="bg-white dark:bg-zinc-800 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-sm cursor-pointer hover:border-orange-500 transition relative grouping-card group select-none active:scale-95" data-name="${safeName}" onclick="openQuickGroupModal('${safeName}')">
   <div class="flex justify-between items-start gap-1 w-full">
       <div class="text-sm font-black text-gray-900 dark:text-white leading-tight break-words flex-1 flex items-center flex-wrap gap-1">
           <span>${t.name}</span>
           <div class="flex items-center">
               ${extras}
               ${cgBadge}
           </div>
       </div>
   </div>
   ${volBadge}
</div>
`;
});

const headerBg = isUnassigned ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300' : 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300';
const borderCol = isUnassigned ? 'border-red-200 dark:border-red-800' : 'border-orange-200 dark:border-orange-800';
const innerBorderCol = isUnassigned ? 'border-red-100 dark:border-red-900/20' : 'border-orange-100 dark:border-orange-900/20';

html += `
<div class="flex flex-col mb-4">
<div class="${headerBg} px-3 py-2 rounded-t-lg font-black flex justify-between items-center text-xs md:text-sm uppercase tracking-wide border-b-2 ${borderCol}">
   <span>${title}</span>
   <span class="bg-white/60 dark:bg-black/50 px-2.5 py-0.5 rounded-full text-[10px] shadow-inner">${colTrainees.length}</span>
</div>
<div class="bg-white/50 dark:bg-zinc-900/50 p-2 md:p-3 rounded-b-lg border border-t-0 ${innerBorderCol} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
   ${cardsHtml || `<div class="col-span-full text-center p-3 text-xs font-bold text-gray-400 italic bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-dashed border-gray-200 dark:border-zinc-700">No trainees</div>`}
</div>
</div>
`;
});

container.innerHTML = html;

// RESTORE SCROLL POSITION
if (container) container.scrollTop = scrollPos;

// Bind UI Long Press safely
document.querySelectorAll('#groupingList .grouping-card').forEach(el => {
uiBindLongPress(el, () => {
const name = el.getAttribute('data-name');
const p = (groupingData.trainees || []).find(x => x.name.replace(/'/g, "\\'") === name);
if (p) showPersonInfo(p);
});
});
}

// ==========================================
// QUICK GROUP ALGORITHM & MODAL
// ==========================================

let currentGroupingTrainee = null;

function openQuickGroupModal(traineeName) {
currentGroupingTrainee = traineeName;
const title = document.getElementById('quickGroupModalTitle');
if(title) title.innerHTML = `Group for <span class="text-orange-500">${traineeName}</span>`;

const grid = document.getElementById('quickGroupGrid');
if(grid) {
grid.innerHTML = '';
// List standard groups 1-5 + any custom ones dynamically generated
let allG = new Set(["1","2","3","4","5", ...activeGroups]);
Array.from(allG).sort((a,b) => a.localeCompare(b, undefined, {numeric: true})).forEach(g => {
grid.innerHTML += `<button onclick="handleGroupSelection('${g}')" class="bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-zinc-700 py-2 md:py-3 rounded-lg text-sm font-bold hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-900/30 dark:hover:text-orange-400 transition-colors shadow-sm focus:outline-none">Grp ${g}</button>`;
});
}

const modal = document.getElementById('quickGroupModal');
const panel = document.getElementById('modalPanelQuickGroup');
modal.classList.remove('hidden');
setTimeout(() => {
modal.classList.remove('opacity-0');
if(panel) { panel.classList.remove('scale-95'); panel.classList.add('scale-100'); }
}, 10);
}

function closeQuickGroupModal() {
const modal = document.getElementById('quickGroupModal');
const panel = document.getElementById('modalPanelQuickGroup');
modal.classList.add('opacity-0');
if(panel) { panel.classList.remove('scale-100'); panel.classList.add('scale-95'); }
setTimeout(() => {
modal.classList.add('hidden');
currentGroupingTrainee = null;
}, 300);
}

// Safe Breadth-First-Search Algorithm to resolve connected trainees instantly
function getConnectedTrainees(startName) {
const connected = new Set([startName]);
const queue = [startName];

while(queue.length > 0) {
const current = queue.shift();
const t = groupingData.trainees.find(x => x.name === current);
if (!t || !t.volPaired) continue;

const vols = t.volPaired.split(/[,|\n]+/).map(v => v.trim().toLowerCase()).filter(v => v);

groupingData.trainees.forEach(otherT => {
if (connected.has(otherT.name) || !otherT.volPaired) return;
const otherVols = otherT.volPaired.split(/[,|\n]+/).map(v => v.trim().toLowerCase()).filter(v => v);
const hasShared = otherVols.some(v => vols.includes(v));
if (hasShared) {
   connected.add(otherT.name);
   queue.push(otherT.name);
}
});
}
return Array.from(connected);
}

function handleGroupSelection(targetGroupRaw) {
if(!currentGroupingTrainee) return;
const traineeName = currentGroupingTrainee;
const targetGroup = targetGroupRaw === "UNASSIGNED" ? "" : targetGroupRaw;
lastGroupingLocalChange = Date.now();

// 1. Resolve all trainees sharing volunteers via BFS
const connectedTrainees = getConnectedTrainees(traineeName);

let changed = false;
connectedTrainees.forEach(tName => {
let t = groupingData.trainees.find(x => x.name === tName);
if (t && String(t.group).trim() !== targetGroup) {
t.group = targetGroup;
changed = true;

const updateIndex = pendingGroupingUpdates.findIndex(u => u.name === tName && u.role === 'TRAINEE');
if (updateIndex > -1) {
   pendingGroupingUpdates[updateIndex].group = targetGroup;
} else {
   pendingGroupingUpdates.push({ role: 'TRAINEE', name: tName, group: targetGroup });
}
}
});

if (changed) {
if (targetGroup !== "" && !activeGroups.includes(targetGroup)) {
activeGroups.push(targetGroup);
}

if (connectedTrainees.length > 1 && targetGroup !== "") {
showFlashMessage('groupingGlobalStatus', `Auto-Grouped ${connectedTrainees.length} trainees due to shared volunteers.`, 'success');
}

renderGroupingList();
triggerGroupingSync();
}

closeQuickGroupModal();
}

function handleNewGroupSelection() {
if(!currentGroupingTrainee) return;
const g = prompt("Enter new Group Name or Number:");
if (g && g.trim()) {
const cleanName = g.trim();
if (!activeGroups.includes(cleanName)) {
activeGroups.push(cleanName);
}
handleGroupSelection(cleanName);
}
}

// ==========================================
// SYNC ENGINE
// ==========================================

function setGroupingSyncButtonState(state) {
const btn = document.getElementById('btn-sync-manual-grouping');
if(!btn) return;
const textSpan = btn.querySelector('.btn-text'); const spinner = btn.querySelector('.btn-spinner');

btn.className = "text-[10px] md:text-xs px-1.5 py-1 rounded font-bold transition flex items-center justify-center border shadow-sm focus:outline-none shrink-0"; 
spinner.className = "fa-solid fa-circle-notch fa-spin btn-spinner ml-1 hidden"; 

if (state === 'loading' || state === 'saving') { 
btn.classList.add('bg-yellow-50', 'text-yellow-700', 'border-yellow-200', 'dark:bg-yellow-900/30', 'dark:text-yellow-400', 'dark:border-yellow-800'); 
textSpan.textContent = state === 'loading' ? "Loading..." : "Saving..."; 
spinner.classList.remove('hidden'); 
} else if (state === 'saved') { 
btn.classList.add('bg-green-50', 'text-green-700', 'border-green-200', 'dark:bg-green-900/30', 'dark:text-green-400', 'dark:border-green-800'); 
textSpan.textContent = "Saved"; 
setTimeout(() => {
if (pendingGroupingUpdates.length === 0) {
btn.className = "text-[10px] md:text-xs px-1.5 py-1 rounded font-bold transition flex items-center border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 shadow-sm focus:outline-none shrink-0";
textSpan.textContent = "Saved";
}
}, 2000);
} else if (state === 'error') { 
btn.classList.add('bg-red-50', 'text-red-700', 'border-red-200', 'dark:bg-red-900/30', 'dark:text-red-400', 'dark:border-red-800'); 
textSpan.textContent = "Save Failed"; 
}
}

function triggerGroupingSync() {
setGroupingSyncButtonState('saving');
if (groupingSyncTimeout) clearTimeout(groupingSyncTimeout);
groupingSyncTimeout = setTimeout(() => {
executeGroupingSync();
}, 800); 
}

async function executeGroupingSync() {
if (isGroupingSyncing) return; // Prevent concurrent syncs
if (pendingGroupingUpdates.length === 0) return;

isGroupingSyncing = true;
setGroupingSyncButtonState('saving');

const updatesToSync = [...pendingGroupingUpdates];
pendingGroupingUpdates = [];

try {
const res = await apiCall('syncManualGroupingUpdates', { sheetUrl: currentGroupingSheetUrl, updates: updatesToSync });

if (res.success) {
setGroupingSyncButtonState('saved');
} else {
throw new Error(res.message);
}
} catch(e) {
console.error(e);
setGroupingSyncButtonState('error');
// Push back failed updates
updatesToSync.forEach(u => {
const idx = pendingGroupingUpdates.findIndex(p => p.name === u.name && p.role === u.role);
if (idx === -1) pendingGroupingUpdates.push(u);
});
} finally {
isGroupingSyncing = false;
if (pendingGroupingUpdates.length > 0) {
  triggerGroupingSync();
}
}
}

function startGroupingPolling() {
if (groupingPollInterval) clearInterval(groupingPollInterval);

groupingPollInterval = setInterval(async () => {
const view = document.getElementById('view-manual-grouping');
if(!view || view.classList.contains('hidden') || isGroupingSyncing) return;

// Lockout polling if the user is typing in the search box to prevent UI disruption
if (document.activeElement && document.activeElement.id === 'groupingSearchInput') return;

if (pendingGroupingUpdates.length > 0) return;

const fetchStartTime = Date.now();

try {
const res = await apiCall('fetchManualPairingData', { sheetUrl: currentGroupingSheetUrl });
if(res.success && !isGroupingSyncing && pendingGroupingUpdates.length === 0) {
if (lastGroupingLocalChange > fetchStartTime) return;

const newDataStr = JSON.stringify(res.data);
const oldDataStr = JSON.stringify(groupingData);

if (newDataStr !== oldDataStr) {
 groupingData = res.data;
 renderGroupingList();
}
}
} catch(e) { }
}, 10000); // Backed off to 10 seconds to ease server load
}

async function manualSyncGrouping() {
if (isGroupingSyncing) return; // Prevent overlapping with automated sync

if (pendingGroupingUpdates.length > 0) {
await executeGroupingSync();
}

setGroupingSyncButtonState('loading');
const overlay = document.getElementById('groupingLoadingOverlay');
overlay.classList.remove('hidden');

const fetchStartTime = Date.now();

try {
const res = await apiCall('fetchManualPairingData', { sheetUrl: currentGroupingSheetUrl });
overlay.classList.add('hidden');
if (res.success) {
if (lastGroupingLocalChange > fetchStartTime) return;

groupingData = res.data;
renderGroupingList();
setGroupingSyncButtonState('saved');
} else {
setGroupingSyncButtonState('error');
}
} catch (e) {
overlay.classList.add('hidden');
setGroupingSyncButtonState('error');
}
}

// ==========================================
// ASSIGN ICs MODAL LOGIC
// ==========================================

function openAssignICModal(sheetUrl) {
if(!sheetUrl || sheetUrl.includes("Select")) return alert("Select an event first");

currentGroupingSheetUrl = sheetUrl;
showOverlay('loading', 'Loading Roles...');

apiCall('fetchManualPairingData', { sheetUrl: sheetUrl }).then(res => {
closeOverlay();
if (res.success) {
 groupingData = res.data;
 renderAssignICModal();
 document.getElementById('assignICModal').classList.remove('hidden');
} else {
 alert("Error: " + res.message);
}
});
}

function closeAssignICModal() {
document.getElementById('assignICModal').classList.add('hidden');
if (pendingGroupingUpdates.length > 0) {
triggerGroupingSync();
}
}

window.toggleAssignICDropdown = function(id, e) {
if(e) e.stopPropagation();
const el = document.getElementById(id);
const isHidden = el.classList.contains('hidden');
document.querySelectorAll('.assign-ic-dropdown-list').forEach(list => list.classList.add('hidden'));
if(isHidden) el.classList.remove('hidden');
};

document.addEventListener('click', function(e) {
if(!e.target.closest('.assign-ic-dropdown-list') && !e.target.closest('button[onclick^="toggleAssignICDropdown"]')) {
document.querySelectorAll('.assign-ic-dropdown-list').forEach(list => list.classList.add('hidden'));
}
});

function generateCustomDropdownHtml(type, targetId, label, options, currentICName) {
const safeTarget = targetId.replace(/'/g, "\\'");
const dropdownId = `dropdown-${type}-${safeTarget.replace(/[^a-zA-Z0-9]/g, '')}`;

let listHtml = `<div class="p-2 border-b border-gray-100 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors" onclick="handleAssignICChange('${type}', '${safeTarget}', '')">
<div class="font-bold text-sm text-gray-500">-- No IC Assigned --</div>
</div>`;

if (options.length === 0) {
listHtml += `<div class="p-3 text-xs text-gray-400 italic text-center">No eligible volunteers active.</div>`;
} else {
options.forEach(v => {
 const remark = (v.extra && v.extra.remark) ? `<div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 whitespace-normal leading-tight break-words"><i class="fa-solid fa-note-sticky text-yellow-500 mr-1"></i>${v.extra.remark}</div>` : '';
 const isSelected = (v.name === currentICName);
 const bgClass = isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500' : 'hover:bg-gray-50 dark:hover:bg-zinc-700 border-l-2 border-transparent';
 
 listHtml += `<div class="p-2 border-b border-gray-100 dark:border-zinc-800 ${bgClass} cursor-pointer transition-colors" onclick="handleAssignICChange('${type}', '${safeTarget}', '${v.name.replace(/'/g, "\\'")}')">
     <div class="font-bold text-sm text-gray-900 dark:text-white flex justify-between items-center">
         <span>${v.name}</span>
         ${isSelected ? '<i class="fa-solid fa-check text-blue-500 text-xs"></i>' : ''}
     </div>
     ${remark}
 </div>`;
});
}

const displayLabel = currentICName || "-- No IC Assigned --";

return `
<div class="bg-gray-50 dark:bg-zinc-800/50 p-3 md:p-4 rounded-xl border border-gray-200 dark:border-zinc-700 relative">
<label class="block text-xs font-black text-gray-900 dark:text-white mb-2 uppercase tracking-wide">${label}</label>
<div class="relative">
 <button type="button" onclick="toggleAssignICDropdown('${dropdownId}', event)" class="w-full bg-white dark:bg-black border border-gray-300 dark:border-zinc-600 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white shadow-sm focus:outline-none focus:border-blue-500 flex justify-between items-center">
     <span class="truncate">${displayLabel}</span>
     <i class="fa-solid fa-chevron-down text-xs text-gray-400"></i>
 </button>
 <div id="${dropdownId}" class="assign-ic-dropdown-list hidden absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar text-left">
     ${listHtml}
 </div>
</div>
</div>
`;
}

function renderAssignICModal() {
const container = document.getElementById('assignICContainer');
let html = '<div class="space-y-6">';

const volLookup = new Map();
(groupingData.volunteers || []).forEach(v => volLookup.set(v.name.toLowerCase(), v));

// --- 1. GROUP ICs ---
let activeTrainees = (groupingData.trainees || []).filter(t => t.attending === 'y' && !t.isGoneHome && String(t.group).trim() !== "");
let allGroups = new Set();
activeTrainees.forEach(t => allGroups.add(String(t.group).trim()));
let sortedGroups = Array.from(allGroups).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));

if (sortedGroups.length > 0) {
html += `<div><h4 class="font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-zinc-700 pb-2 mb-3"><i class="fa-solid fa-users text-orange-500 mr-2"></i>Group ICs</h4><div class="space-y-3">`;
sortedGroups.forEach(g => {
 let tList = activeTrainees.filter(t => String(t.group).trim() === g);
 let groupVolKeys = new Set();
 tList.forEach(t => {
     if (t.volPaired) {
         const vols = t.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
         vols.forEach(v => groupVolKeys.add(v.toLowerCase()));
     }
 });
 
 let options = [];
 let currentICName = "";
 Array.from(groupVolKeys).sort().forEach(vKey => {
     const vObj = volLookup.get(vKey);
     if (vObj) {
         if (vObj.groupIC) currentICName = vObj.name;
         options.push(vObj);
     }
 });
 html += generateCustomDropdownHtml('group', g, `Group ${g} IC`, options, currentICName);
});
html += `</div></div>`;
} else {
html += `<div><h4 class="font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-zinc-700 pb-2 mb-3"><i class="fa-solid fa-users text-orange-500 mr-2"></i>Group ICs</h4>
<p class="text-xs text-gray-500 italic text-center py-2">No groups assigned yet.</p></div>`;
}

// --- 2. MEETING ICs ---
let meetingLocs = groupingData.meetingLocs || [];
if (meetingLocs.length > 0) {
html += `<div><h4 class="font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-zinc-700 pb-2 mb-3"><i class="fa-solid fa-location-dot text-blue-500 mr-2"></i>Meeting ICs</h4><div class="space-y-3">`;
meetingLocs.forEach(loc => {
 let options = [];
 let currentICName = "";
 (groupingData.volunteers || []).forEach(v => {
     if(v.extra && v.extra.v_meet && v.extra.v_meet.toLowerCase() === loc.toLowerCase()) {
         if(v.meetIC) currentICName = v.name;
         options.push(v);
     }
 });
 options.sort((a,b) => a.name.localeCompare(b.name));
 html += generateCustomDropdownHtml('meet', loc, `Meet: ${loc}`, options, currentICName);
});
html += `</div></div>`;
}

// --- 3. DISMISSAL ICs ---
let dismissalLocs = groupingData.dismissalLocs || [];
if (dismissalLocs.length > 0) {
html += `<div><h4 class="font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-zinc-700 pb-2 mb-3"><i class="fa-solid fa-flag-checkered text-purple-500 mr-2"></i>Dismissal ICs</h4><div class="space-y-3">`;
dismissalLocs.forEach(loc => {
 let options = [];
 let currentICName = "";
 (groupingData.volunteers || []).forEach(v => {
     if(v.extra && v.extra.v_dismiss && v.extra.v_dismiss.toLowerCase() === loc.toLowerCase()) {
         if(v.dismissIC) currentICName = v.name;
         options.push(v);
     }
 });
 options.sort((a,b) => a.name.localeCompare(b.name));
 html += generateCustomDropdownHtml('dismiss', loc, `Dismiss: ${loc}`, options, currentICName);
});
html += `</div></div>`;
}

html += '</div>';
container.innerHTML = html;
}

function handleAssignICChange(type, target, newVolName) {
lastGroupingLocalChange = Date.now();
document.querySelectorAll('.assign-ic-dropdown-list').forEach(list => list.classList.add('hidden'));

let groupVolKeys = new Set();

if (type === 'group') {
let tList = (groupingData.trainees || []).filter(t => t.attending === 'y' && !t.isGoneHome && String(t.group).trim() === String(target));
tList.forEach(t => {
 if (t.volPaired) {
     t.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v).forEach(v => groupVolKeys.add(v.toLowerCase()));
 }
});
} else if (type === 'meet') {
(groupingData.volunteers || []).forEach(v => {
 if (v.extra && v.extra.v_meet && v.extra.v_meet.toLowerCase() === target.toLowerCase()) {
     groupVolKeys.add(v.name.toLowerCase());
 }
});
} else if (type === 'dismiss') {
(groupingData.volunteers || []).forEach(v => {
 if (v.extra && v.extra.v_dismiss && v.extra.v_dismiss.toLowerCase() === target.toLowerCase()) {
     groupVolKeys.add(v.name.toLowerCase());
 }
});
}

const newVolKey = newVolName ? newVolName.toLowerCase() : null;

(groupingData.volunteers || []).forEach(v => {
const vKey = v.name.toLowerCase();

if (groupVolKeys.has(vKey)) {
 const shouldBeIC = (vKey === newVolKey);
 
 let changed = false;
 if (type === 'group' && v.groupIC !== shouldBeIC) { v.groupIC = shouldBeIC; changed = true; }
 else if (type === 'meet' && v.meetIC !== shouldBeIC) { v.meetIC = shouldBeIC; changed = true; }
 else if (type === 'dismiss' && v.dismissIC !== shouldBeIC) { v.dismissIC = shouldBeIC; changed = true; }
 
 if (changed) {
     let updateIndex = pendingGroupingUpdates.findIndex(u => u.name === v.name && u.role === 'VOLUNTEER');
     if (updateIndex === -1) {
         pendingGroupingUpdates.push({ role: 'VOLUNTEER', name: v.name });
         updateIndex = pendingGroupingUpdates.length - 1;
     }
     if (type === 'group') pendingGroupingUpdates[updateIndex].groupIC = shouldBeIC;
     if (type === 'meet') pendingGroupingUpdates[updateIndex].meetIC = shouldBeIC;
     if (type === 'dismiss') pendingGroupingUpdates[updateIndex].dismissIC = shouldBeIC;
 }
}
});

renderAssignICModal(); // Re-render instantly
triggerGroupingSync();
}

// ==========================================
// EXPORT TABLE LOGIC
// ==========================================

function openTableExportModal() {
buildExportTable();
// Reset preview area
const preview = document.getElementById('exportTablePreview');
if(preview) preview.innerHTML = '';

document.getElementById('exportTableContainer').classList.remove('hidden');
document.getElementById('exportTableModal').classList.remove('hidden');
}

function closeTableExportModal() {
document.getElementById('exportTableModal').classList.add('hidden');
}

function buildExportTable() {
const container = document.getElementById('exportTableContainer');
// Strip min-w-max dynamically and enforce full width for mobile screen wrap
container.classList.remove('min-w-max');
container.classList.add('w-full');

let allGroups = new Set();
groupingData.trainees.forEach(t => {
if (t.attending === 'y' && !t.isGoneHome && String(t.group).trim() !== "") {
allGroups.add(String(t.group).trim());
}
});

let sortedGroups = Array.from(allGroups).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));

let html = `
<table class="w-full text-left border-collapse text-[9px] md:text-xs text-gray-800" style="font-family: Arial, sans-serif; border: 1px solid #333; table-layout: fixed; width: 100%; word-wrap: break-word;">
<thead>
<tr style="background-color: #333; color: #fff;">
    <th style="padding: 4px; border: 1px solid #555; width: 30%; vertical-align: middle; text-align: left; line-height: 1.2;"><div style="text-align: left; display: block; width: 100%;">Volunteer</div></th>
    <th style="padding: 4px; border: 1px solid #555; width: 30%; vertical-align: middle; text-align: left; line-height: 1.2;"><div style="text-align: left; display: block; width: 100%;">Trainee(s)</div></th>
    <th style="padding: 4px; border: 1px solid #555; width: 10%; vertical-align: middle; text-align: center; line-height: 1.2;"><div style="text-align: center; display: block; width: 100%;">Grp</div></th>
    <th style="padding: 4px; border: 1px solid #555; width: 30%; vertical-align: middle; text-align: left; line-height: 1.2;"><div style="text-align: left; display: block; width: 100%;">Remarks</div></th>
</tr>
</thead>
<tbody>
`;

if (sortedGroups.length === 0 && groupingData.volunteers.length === 0 && groupingData.trainees.length === 0) {
html += `<tr><td colspan="4" style="padding: 10px; text-align: center; font-style: italic;"><div style="text-align: center; display: block; width: 100%;">No data.</div></td></tr>`;
}

const volLookup = new Map();
groupingData.volunteers.forEach(v => {
volLookup.set(v.name.toLowerCase(), v);
});

let displayedVols = new Set();

sortedGroups.forEach((g, index) => {
const bgColor = EXPORT_COLORS[index % EXPORT_COLORS.length];

let tList = groupingData.trainees.filter(t => t.attending === 'y' && !t.isGoneHome && String(t.group).trim() === g);

let volMap = new Map();
let unpairedTrainees = [];

tList.forEach(t => {
const remarks = t.extra?.remarks || t.extra?.remark || '';
if (t.volPaired) {
    const vols = t.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
    vols.forEach(v => {
        const vKey = v.toLowerCase();
        displayedVols.add(vKey);
        if (!volMap.has(vKey)) {
            const vObj = volLookup.get(vKey);
            volMap.set(vKey, {
                name: vObj ? vObj.name : v, 
                isGroupIC: vObj ? vObj.groupIC === true : false,
                isMeetIC: vObj ? vObj.meetIC === true : false,
                isDismissIC: vObj ? vObj.dismissIC === true : false,
                meetLoc: vObj ? (vObj.extra?.v_meet || '').trim() : '',
                dismissLoc: vObj ? (vObj.extra?.v_dismiss || '').trim() : '',
                volRemark: vObj ? (vObj.extra?.remarks || vObj.extra?.remark || '') : '',
                trainees: [],
                remarks: []
            });
        }
        const vData = volMap.get(vKey);
        vData.trainees.push(t.name);
        if (remarks) vData.remarks.push(`<strong>[Trn] ${t.name}:</strong> ${remarks}`);
    });
} else {
    unpairedTrainees.push({ name: t.name, remarks: remarks });
}
});

let rows = Array.from(volMap.values());

rows.sort((a, b) => {
const aIsIC = a.isGroupIC || a.isMeetIC || a.isDismissIC;
const bIsIC = b.isGroupIC || b.isMeetIC || b.isDismissIC;
if (aIsIC && !bIsIC) return -1;
if (!aIsIC && bIsIC) return 1;
return a.name.localeCompare(b.name);
});

if (rows.length === 0 && unpairedTrainees.length === 0) {
html += `<tr style="background-color: ${bgColor};">
    <td colspan="2" style="padding: 4px; border: 1px solid #ccc; font-style: italic; vertical-align: middle; text-align: left; line-height: 1.2;"><div style="text-align: left; display: block; width: 100%;">No assignments</div></td>
    <td style="padding: 4px; border: 1px solid #ccc; text-align: center; font-weight: bold; vertical-align: middle; line-height: 1.2;"><div style="text-align: center; display: block; width: 100%;">${g}</div></td>
    <td style="padding: 4px; border: 1px solid #ccc; vertical-align: middle; text-align: left; line-height: 1.2;"><div style="text-align: left; display: block; width: 100%;"></div></td>
</tr>`;
}

rows.forEach(r => {
let volDisplay = `<span style="font-weight: bold;">${r.name}</span>`;
if (r.isGroupIC) volDisplay += `<br><strong style="color: #0369a1; font-size: 0.9em; display:inline-block; margin-top:2px;">(Grp ${g} IC)</strong>`;
if (r.isMeetIC) {
    const locDisplay = r.meetLoc ? `Meeting - ${r.meetLoc}` : 'Meeting';
    volDisplay += `<br><strong style="color: #047857; font-size: 0.9em; display:inline-block; margin-top:2px;">(${locDisplay} IC)</strong>`;
}
if (r.isDismissIC) {
    const locDisplay = r.dismissLoc ? `Dismissal - ${r.dismissLoc}` : 'Dismissal';
    volDisplay += `<br><strong style="color: #6d28d9; font-size: 0.9em; display:inline-block; margin-top:2px;">(${locDisplay} IC)</strong>`;
}

let tDisplay = r.trainees.length > 0 ? r.trainees.join('<br>') : '-';

let allRemarks = [];
if (r.volRemark) allRemarks.push(`<strong>[Vol] ${r.name}:</strong> ${r.volRemark}`);
if (r.remarks.length > 0) allRemarks = allRemarks.concat(r.remarks);
let rDisplay = allRemarks.join('<br><br>');

html += `<tr style="background-color: ${bgColor};">
    <td style="padding: 4px; border: 1px solid #ccc; vertical-align: middle; text-align: left; line-height: 1.2;"><div style="text-align: left; display: block; width: 100%;">${volDisplay}</div></td>
    <td style="padding: 4px; border: 1px solid #ccc; vertical-align: middle; text-align: left; line-height: 1.2;"><div style="text-align: left; display: block; width: 100%;">${tDisplay}</div></td>
    <td style="padding: 4px; border: 1px solid #ccc; text-align: center; font-weight: bold; vertical-align: middle; line-height: 1.2;"><div style="text-align: center; display: block; width: 100%;">${g}</div></td>
    <td contenteditable="true" style="padding: 4px; border: 1px solid #ccc; outline: none; transition: background 0.2s; vertical-align: middle; text-align: left; line-height: 1.2;" onfocus="this.style.backgroundColor='#fff'" onblur="this.style.backgroundColor='transparent'"><div style="text-align: left; display: block; width: 100%;">${rDisplay}</div></td>
</tr>`;
});

unpairedTrainees.forEach(ut => {
let rDisplay = ut.remarks ? `<strong>[Trn] ${ut.name}:</strong> ${ut.remarks}` : '';
html += `<tr style="background-color: ${bgColor};">
    <td style="padding: 4px; border: 1px solid #ccc; font-weight: bold; color: #dc2626; text-align: center; vertical-align: middle; line-height: 1.2;"><div style="text-align: center; display: block; width: 100%;">-</div></td>
    <td style="padding: 4px; border: 1px solid #ccc; vertical-align: middle; text-align: left; line-height: 1.2;"><div style="text-align: left; display: block; width: 100%;">${ut.name}</div></td>
    <td style="padding: 4px; border: 1px solid #ccc; text-align: center; font-weight: bold; vertical-align: middle; line-height: 1.2;"><div style="text-align: center; display: block; width: 100%;">${g}</div></td>
    <td contenteditable="true" style="padding: 4px; border: 1px solid #ccc; outline: none; transition: background 0.2s; vertical-align: middle; text-align: left; line-height: 1.2;" onfocus="this.style.backgroundColor='#fff'" onblur="this.style.backgroundColor='transparent'"><div style="text-align: left; display: block; width: 100%;">${rDisplay}</div></td>
</tr>`;
});
});

// Handle Unpaired Volunteers and Unassigned Trainees
let unassignedTrainees = groupingData.trainees.filter(t => t.attending === 'y' && !t.isGoneHome && String(t.group).trim() === "");
let volMapUnassigned = new Map();
let orphanedTrainees = [];

unassignedTrainees.forEach(t => {
const remarks = t.extra?.remarks || t.extra?.remark || '';
if (t.volPaired) {
  const vols = t.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
  vols.forEach(v => {
      const vKey = v.toLowerCase();
      displayedVols.add(vKey);
      if (!volMapUnassigned.has(vKey)) {
          const vObj = volLookup.get(vKey);
          volMapUnassigned.set(vKey, {
              name: vObj ? vObj.name : v, 
              isGroupIC: false,
              isMeetIC: vObj ? vObj.meetIC === true : false,
              isDismissIC: vObj ? vObj.dismissIC === true : false,
              meetLoc: vObj ? (vObj.extra?.v_meet || '').trim() : '',
              dismissLoc: vObj ? (vObj.extra?.v_dismiss || '').trim() : '',
              volRemark: vObj ? (vObj.extra?.remarks || vObj.extra?.remark || '') : '',
              trainees: [],
              remarks: []
          });
      }
      const vData = volMapUnassigned.get(vKey);
      vData.trainees.push(t.name);
      if (remarks) vData.remarks.push(`<strong>[Trn] ${t.name}:</strong> ${remarks}`);
  });
} else {
  orphanedTrainees.push({ name: t.name, remarks: remarks });
}
});

// Any remaining volunteers not displayed
let unpairedVols = groupingData.volunteers.filter(v => !displayedVols.has(v.name.toLowerCase()));
unpairedVols.forEach(v => {
volMapUnassigned.set(v.name.toLowerCase(), {
  name: v.name,
  isGroupIC: false,
  isMeetIC: v.meetIC === true,
  isDismissIC: v.dismissIC === true,
  meetLoc: (v.extra?.v_meet || '').trim(),
  dismissLoc: (v.extra?.v_dismiss || '').trim(),
  volRemark: (v.extra?.remarks || v.extra?.remark || ''),
  trainees: [],
  remarks: []
});
});

let unassignedRows = Array.from(volMapUnassigned.values());

if (unassignedRows.length > 0 || orphanedTrainees.length > 0) {
const bgColor = '#f3f4f6'; // Light gray for unassigned

unassignedRows.sort((a, b) => {
  const aIsIC = a.isMeetIC || a.isDismissIC;
  const bIsIC = b.isMeetIC || b.isDismissIC;
  if (aIsIC && !bIsIC) return -1;
  if (!aIsIC && bIsIC) return 1;
  return a.name.localeCompare(b.name);
});

unassignedRows.forEach(r => {
  let volDisplay = `<span style="font-weight: bold;">${r.name}</span>`;
  if (r.isMeetIC) {
      const locDisplay = r.meetLoc ? `Meeting - ${r.meetLoc}` : 'Meeting';
      volDisplay += `<br><strong style="color: #047857; font-size: 0.9em; display:inline-block; margin-top:2px;">(${locDisplay} IC)</strong>`;
  }
  if (r.isDismissIC) {
      const locDisplay = r.dismissLoc ? `Dismissal - ${r.dismissLoc}` : 'Dismissal';
      volDisplay += `<br><strong style="color: #6d28d9; font-size: 0.9em; display:inline-block; margin-top:2px;">(${locDisplay} IC)</strong>`;
  }
  
  let tDisplay = r.trainees.length > 0 ? r.trainees.join('<br>') : '-';
  
  let allRemarks = [];
  if (r.volRemark) allRemarks.push(`<strong>[Vol] ${r.name}:</strong> ${r.volRemark}`);
  if (r.remarks.length > 0) allRemarks = allRemarks.concat(r.remarks);
  let rDisplay = allRemarks.join('<br><br>');
  
  html += `<tr style="background-color: ${bgColor};">
      <td style="padding: 4px; border: 1px solid #ccc; vertical-align: middle; text-align: left; line-height: 1.2;"><div style="text-align: left; display: block; width: 100%;">${volDisplay}</div></td>
      <td style="padding: 4px; border: 1px solid #ccc; vertical-align: middle; text-align: left; line-height: 1.2;"><div style="text-align: left; display: block; width: 100%;">${tDisplay}</div></td>
      <td style="padding: 4px; border: 1px solid #ccc; text-align: center; font-weight: bold; vertical-align: middle; line-height: 1.2;"><div style="text-align: center; display: block; width: 100%;">-</div></td>
      <td contenteditable="true" style="padding: 4px; border: 1px solid #ccc; outline: none; transition: background 0.2s; vertical-align: middle; text-align: left; line-height: 1.2;" onfocus="this.style.backgroundColor='#fff'" onblur="this.style.backgroundColor='transparent'"><div style="text-align: left; display: block; width: 100%;">${rDisplay}</div></td>
  </tr>`;
});

orphanedTrainees.forEach(ut => {
  let rDisplay = ut.remarks ? `<strong>[Trn] ${ut.name}:</strong> ${ut.remarks}` : '';
  html += `<tr style="background-color: ${bgColor};">
      <td style="padding: 4px; border: 1px solid #ccc; font-weight: bold; color: #dc2626; text-align: center; vertical-align: middle; line-height: 1.2;"><div style="text-align: center; display: block; width: 100%;">-</div></td>
      <td style="padding: 4px; border: 1px solid #ccc; vertical-align: middle; text-align: left; line-height: 1.2;"><div style="text-align: left; display: block; width: 100%;">${ut.name}</div></td>
      <td style="padding: 4px; border: 1px solid #ccc; text-align: center; font-weight: bold; vertical-align: middle; line-height: 1.2;"><div style="text-align: center; display: block; width: 100%;">-</div></td>
      <td contenteditable="true" style="padding: 4px; border: 1px solid #ccc; outline: none; transition: background 0.2s; vertical-align: middle; text-align: left; line-height: 1.2;" onfocus="this.style.backgroundColor='#fff'" onblur="this.style.backgroundColor='transparent'"><div style="text-align: left; display: block; width: 100%;">${rDisplay}</div></td>
  </tr>`;
});
}

html += `</tbody></table>`;
container.innerHTML = html;
}

let generatedImageBlob = null; // Store blob to share via Web Share API

async function shareExportTable() {
const container = document.getElementById('exportTableContainer');
const btn = document.getElementById('shareTableBtn');
const preview = document.getElementById('exportTablePreview');
if(!container || !btn || !preview) return;

const originalText = btn.innerHTML;
btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
btn.disabled = true;

container.querySelectorAll('[contenteditable]').forEach(el => {
el.style.outline = 'none';
});

// Yield to main thread to allow the UI to paint the loading state
// before locking up heavily with html2canvas
setTimeout(async () => {
try {
if (typeof html2canvas === 'undefined') throw new Error("html2canvas not loaded");

const canvas = await html2canvas(container, {
    scale: 3, // High quality resolution
    backgroundColor: '#ffffff',
    useCORS: true
});

const dataUrl = canvas.toDataURL('image/png');

// Hide actual table, show image preview
container.classList.add('hidden');
preview.innerHTML = `<p class="text-xs text-green-600 dark:text-green-400 font-bold mb-2 text-center">Image ready! Long press to save or share directly.</p><img src="${dataUrl}" class="w-full h-auto shadow-md rounded border border-gray-200 dark:border-zinc-700 mx-auto" />`;

// Convert Base64 to Blob for Native Sharing
generatedImageBlob = await (await fetch(dataUrl)).blob();

// Transform button to Share Via Apps
btn.innerHTML = '<i class="fa-solid fa-share-nodes"></i> Share via Apps';
btn.onclick = executeNativeShare;
btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
btn.classList.add('bg-green-600', 'hover:bg-green-700');

// Async Upload to Drive without blocking user
if (currentGroupingSheetUrl) {
    apiCall('uploadExportTable', {
        sheetUrl: currentGroupingSheetUrl,
        imageBase64: dataUrl
    }).then(res => {
        if(res.success) {
            showFlashMessage('groupingGlobalStatus', "Backup saved to Drive.", 'success');
        }
    });
}

} catch (e) {
console.error(e);
alert("Failed to share table: " + e.message);
btn.innerHTML = originalText;
} finally {
btn.disabled = false;
}
}, 100);
}

async function executeNativeShare() {
if (!generatedImageBlob) return;

const file = new File([generatedImageBlob], 'outing-groups.png', { type: 'image/png' });

try {
if (navigator.canShare && navigator.canShare({ files: [file] })) {
await navigator.share({
    title: 'Outing Groups',
    files: [file]
});
} else {
// Fallback to clipboard if share not supported
if (navigator.clipboard && window.ClipboardItem) {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': generatedImageBlob })]);
    showFlashMessage('groupingGlobalStatus', "Table copied to clipboard!", 'success');
} else {
    alert("Sharing not supported on this device. Long press the image to save it.");
}
}
} catch (e) {
console.log('Share canceled or failed', e);
}
}