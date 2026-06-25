let currentGroupingSheetUrl = null;
let groupingData = { trainees: [], volunteers: [] };
let pendingGroupingUpdates = [];
let isGroupingSyncing = false;
let groupingSyncTimeout = null;
let groupingPollInterval = null;
let currentGroupingFilter = "ALL";
let currentGroupingSearch = "";

// ==========================================
// MANUAL GROUPING LOGIC (Vertical List UI)
// ==========================================

function openManualGrouping() {
const selector = document.getElementById('commSheetSelector');
const url = selector.value;
if(!url || url.includes("Select") || url.includes("Loading") || url.includes("Error")) return alert("Select an event first");

currentGroupingSheetUrl = url;
document.getElementById('navContextTitle').innerText = "Manual Group: " + selector.options[selector.selectedIndex].text;

currentGroupingFilter = "ALL";
currentGroupingSearch = "";
document.getElementById('groupingFilterSelect').value = "ALL";
document.getElementById('groupingSearchInput').value = "";

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

function changeGroupingFilter() {
currentGroupingFilter = document.getElementById('groupingFilterSelect').value;
renderGroupingList();
}

function changeGroupingSearch() {
currentGroupingSearch = document.getElementById('groupingSearchInput').value.toLowerCase().trim();
renderGroupingList();
}

function renderGroupingList() {
const container = document.getElementById('groupingList');

let activeTrainees = (groupingData.trainees || []).filter(t => {
    const att = t.attending ? String(t.attending).toLowerCase().trim() : "";
    return att === 'y' && !t.isGoneHome;
});

// Apply Search
if (currentGroupingSearch) {
    activeTrainees = activeTrainees.filter(t => 
        t.name.toLowerCase().includes(currentGroupingSearch) || 
        (t.volPaired && t.volPaired.toLowerCase().includes(currentGroupingSearch)) ||
        (t.group && String(t.group).toLowerCase().includes(currentGroupingSearch))
    );
}

// Apply Filter
if (currentGroupingFilter === "UNASSIGNED") {
    activeTrainees = activeTrainees.filter(t => String(t.group || "").trim() === "");
}

// Sort alphabetically by name
activeTrainees.sort((a,b) => a.name.localeCompare(b.name));

let html = '';

if (activeTrainees.length === 0) {
    html = `<div class="p-4 text-center text-gray-500 dark:text-gray-400 font-bold text-xs italic">No trainees match the current filters.</div>`;
} else {
    activeTrainees.forEach(t => {
        const groupStr = String(t.group || "").trim();
        const groupBadge = groupStr !== "" 
            ? `<span class="bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800 px-2 py-0.5 rounded font-black text-[10px] uppercase shadow-sm">Grp ${groupStr}</span>` 
            : `<span class="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-900/50 px-2 py-0.5 rounded font-bold text-[10px] uppercase shadow-sm">Unassigned</span>`;
            
        let volInfo = '';
        if (t.volPaired) {
            volInfo = `<div class="text-[10px] text-teal-600 dark:text-teal-400 font-bold line-clamp-2 leading-tight mt-1 flex items-start gap-1"><i class="fa-solid fa-handshake-angle mt-0.5 opacity-80"></i><span>${t.volPaired}</span></div>`;
        }

        const safeName = t.name.replace(/'/g, "\\'");
        
        html += `
        <div class="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-sm cursor-pointer hover:border-orange-500 transition active:scale-[0.98] select-none" onclick="openQuickGroupModal('${safeName}')">
            <div class="flex justify-between items-start w-full gap-2">
                <div class="font-extrabold text-xs md:text-sm text-gray-900 dark:text-white leading-tight break-words whitespace-normal flex-1">
                    ${t.name}
                </div>
                <div class="shrink-0 flex items-center justify-end min-w-[70px]">
                    ${groupBadge}
                </div>
            </div>
            ${volInfo}
        </div>
        `;
    });
}

container.innerHTML = html;
}

// ==========================================
// QUICK GROUP MODAL (Vertical List Logic)
// ==========================================
let currentGroupingTargetTrainee = "";

function openQuickGroupModal(traineeName) {
currentGroupingTargetTrainee = traineeName;
const trainee = groupingData.trainees.find(t => t.name === traineeName);
if(!trainee) return;

const title = document.getElementById('quickGroupModalTitle');
title.innerHTML = `Assign <span class="text-orange-500">${traineeName}</span>`;

const grid = document.getElementById('quickGroupGrid');

// Find highest group number currently active
let activeTrainees = (groupingData.trainees || []).filter(t => {
    const att = t.attending ? String(t.attending).toLowerCase().trim() : "";
    return att === 'y';
});

let highest = 0;
let groupSet = new Set();

activeTrainees.forEach(t => {
    const g = String(t.group || "").trim();
    if (g !== "") {
        groupSet.add(g);
        const num = parseInt(g);
        if (!isNaN(num) && num > highest) highest = num;
    }
});

let groups = Array.from(groupSet).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
const currentGroup = String(trainee.group || "").trim();

let gridHtml = '';
groups.forEach(g => {
    const isCurrent = g === currentGroup;
    gridHtml += `
    <button onclick="handleGroupSelection('${g}')" class="py-3 px-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition ${isCurrent ? 'bg-orange-100 border-orange-500 text-orange-800 dark:bg-orange-900/50 dark:border-orange-500 dark:text-orange-200' : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-orange-50 hover:border-orange-300 dark:bg-black dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800'}">
        <span class="text-[10px] font-bold uppercase opacity-80 leading-none">Group</span>
        <span class="text-lg font-black leading-none">${g}</span>
    </button>
    `;
});

grid.innerHTML = gridHtml || `<div class="col-span-3 text-center text-xs text-gray-500 p-2">No groups exist yet.</div>`;

document.getElementById('quickGroupModal').classList.remove('hidden');
}

function closeQuickGroupModal() {
document.getElementById('quickGroupModal').classList.add('hidden');
}

function handleNewGroupSelection() {
let activeTrainees = (groupingData.trainees || []).filter(t => {
    const att = t.attending ? String(t.attending).toLowerCase().trim() : "";
    return att === 'y';
});

let highest = 0;
activeTrainees.forEach(t => {
    const num = parseInt(t.group);
    if (!isNaN(num) && num > highest) highest = num;
});

const newGroup = String(highest + 1);
handleGroupSelection(newGroup);
}

function handleGroupSelection(targetGroupRaw) {
const targetGroup = targetGroupRaw === "UNASSIGNED" ? "" : targetGroupRaw;
const traineeName = currentGroupingTargetTrainee;

let trainee = groupingData.trainees.find(t => t.name === traineeName);
if (!trainee) {
    closeQuickGroupModal();
    return;
}

const currentGroup = String(trainee.group || "").trim();
if (currentGroup === targetGroup) {
    closeQuickGroupModal();
    return;
}

// Logic: Build a graph of all trainees connected through shared volunteers
const traineesToMove = new Set([traineeName]);

if (targetGroup !== "" && trainee.volPaired) {
    let changed = true;
    while(changed) {
        changed = false;
        
        // Build an aggregate list of all volunteers currently attached to any trainee in the "Move List"
        let aggregateVols = new Set();
        traineesToMove.forEach(name => {
            const t = groupingData.trainees.find(x => x.name === name);
            if (t && t.volPaired) {
                const vols = t.volPaired.split(/[,|\n]+/).map(v => v.trim().toLowerCase()).filter(v => v);
                vols.forEach(v => aggregateVols.add(v));
            }
        });
        
        // Scan all other trainees to see if they share ANY volunteer with the aggregate list
        groupingData.trainees.forEach(otherT => {
            if (traineesToMove.has(otherT.name) || !otherT.volPaired) return;
            
            const otherVols = otherT.volPaired.split(/[,|\n]+/).map(v => v.trim().toLowerCase()).filter(v => v);
            const hasSharedVol = otherVols.some(v => aggregateVols.has(v));
            
            if (hasSharedVol) {
                traineesToMove.add(otherT.name);
                changed = true; // Loop again because adding a new trainee might introduce NEW volunteers to the aggregate list
            }
        });
    }
}

// Apply updates
traineesToMove.forEach(name => {
    let t = groupingData.trainees.find(x => x.name === name);
    if(t) {
        t.group = targetGroup;
        const updateIndex = pendingGroupingUpdates.findIndex(u => u.traineeName === name);
        if (updateIndex > -1) {
            pendingGroupingUpdates[updateIndex].group = targetGroup;
        } else {
            pendingGroupingUpdates.push({ traineeName: name, group: targetGroup });
        }
    }
});

renderGroupingList();
triggerGroupingSync();
closeQuickGroupModal();

// If cascade happened, notify the user immediately
if (traineesToMove.size > 1 && targetGroup !== "") {
    showFlashMessage('groupingGlobalStatus', `Auto-Grouped ${traineesToMove.size} trainees together due to shared volunteers.`, 'success');
}
}


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
      const idx = pendingGroupingUpdates.findIndex(p => p.traineeName === u.traineeName);
      if (idx === -1) pendingGroupingUpdates.push(u);
  });
} finally {
  isGroupingSyncing = false;
}
}

function startGroupingPolling() {
if (groupingPollInterval) clearInterval(groupingPollInterval);

groupingPollInterval = setInterval(async () => {
  const view = document.getElementById('view-manual-grouping');
  if(!view || view.classList.contains('hidden') || isGroupingSyncing) return;

  try {
      const res = await apiCall('fetchManualPairingData', { sheetUrl: currentGroupingSheetUrl });
      if(res.success && !isGroupingSyncing && pendingGroupingUpdates.length === 0) {
          const newDataStr = JSON.stringify(res.data);
          const oldDataStr = JSON.stringify(groupingData);
          
          if (newDataStr !== oldDataStr) {
              groupingData = res.data;
              renderGroupingList();
          }
      }
  } catch(e) { }
}, 8000);
}

async function manualSyncGrouping() {
if (pendingGroupingUpdates.length > 0) {
  await executeGroupingSync();
}

setGroupingSyncButtonState('loading');
const overlay = document.getElementById('groupingLoadingOverlay');
overlay.classList.remove('hidden');

try {
  const res = await apiCall('fetchManualPairingData', { sheetUrl: currentGroupingSheetUrl });
  overlay.classList.add('hidden');
  if (res.success) {
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