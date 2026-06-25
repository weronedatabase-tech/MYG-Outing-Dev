let currentGroupingSheetUrl = null;
let groupingData = { trainees: [], volunteers: [] };
let pendingGroupingUpdates = [];
let isGroupingSyncing = false;
let groupingSyncTimeout = null;
let groupingPollInterval = null;
let currentGroupingFilter = "ALL";
let currentGroupingSearch = "";
let currentGroupingTargetName = "";

const EXPORT_COLORS = [
   '#fef2f2', // red-50
   '#eff6ff', // blue-50
   '#f0fdf4', // green-50
   '#fefce8', // yellow-50
   '#faf5ff', // purple-50
   '#fff7ed', // orange-50
   '#f0fdfa', // teal-50
   '#fdf2f8', // pink-50
   '#eef2ff'  // indigo-50
];

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

// Remove Volunteers from Manual Grouping - strictly Trainees now
let activeTrainees = (groupingData.trainees || [])
  .filter(t => t.attending === 'y' && !t.isGoneHome);

let groupSet = new Set();
activeTrainees.forEach(item => {
  let g = String(item.group || "").trim();
  if (g !== "") groupSet.add(g);
});

let groups = Array.from(groupSet).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));

const filterSelect = document.getElementById('groupingFilterSelect');
let filterHtml = `<option value="ALL">All Groups</option><option value="UNASSIGNED">Unassigned</option>`;
groups.forEach(g => {
  filterHtml += `<option value="${g}">Group ${g}</option>`;
});
filterSelect.innerHTML = filterHtml;

if (["ALL", "UNASSIGNED", ...groups].includes(currentGroupingFilter)) {
  filterSelect.value = currentGroupingFilter;
} else {
  currentGroupingFilter = "ALL";
  filterSelect.value = "ALL";
}

if (currentGroupingSearch) {
  activeTrainees = activeTrainees.filter(item => {
      const nameMatch = item.name.toLowerCase().includes(currentGroupingSearch);
      const volMatch = item.volPaired && item.volPaired.toLowerCase().includes(currentGroupingSearch);
      const groupMatch = String(item.group || "").toLowerCase().includes(currentGroupingSearch);
      return nameMatch || volMatch || groupMatch;
  });
}

if (currentGroupingFilter === "UNASSIGNED") {
  activeTrainees = activeTrainees.filter(item => String(item.group || "").trim() === "");
} else if (currentGroupingFilter !== "ALL") {
  activeTrainees = activeTrainees.filter(item => String(item.group || "").trim() === currentGroupingFilter);
}

activeTrainees.sort((a, b) => {
  const groupA = String(a.group || "").trim();
  const groupB = String(b.group || "").trim();

  if (groupA === "" && groupB !== "") return -1;
  if (groupA !== "" && groupB === "") return 1;

  if (groupA !== groupB) {
      const numA = parseInt(groupA);
      const numB = parseInt(groupB);
      if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
      }
      return groupA.localeCompare(groupB, undefined, {numeric: true});
  }
  
  return a.name.localeCompare(b.name);
});

let html = '';

if (activeTrainees.length === 0) {
  html = `<div class="p-4 text-center text-gray-500 dark:text-gray-400 font-bold text-xs italic">No trainees match the current filters.</div>`;
} else {
  activeTrainees.forEach(item => {
      const groupStr = String(item.group || "").trim();
      const groupBadgeClass = groupStr !== "" 
          ? `bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800` 
          : `bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50`;
          
      const roleBadge = `<span class="bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 px-1 py-0.5 rounded text-[8px] uppercase font-black tracking-wider shadow-sm">Trainee</span>`;

      let subInfo = '';
      if (item.volPaired) {
          subInfo = `<div class="text-[10px] text-teal-600 dark:text-teal-400 font-bold line-clamp-2 mt-1"><i class="fa-solid fa-handshake-angle opacity-80 mr-1"></i>${item.volPaired}</div>`;
      }

      const safeName = item.name.replace(/'/g, "\\'");
      
      html += `
      <div class="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-sm cursor-pointer hover:border-orange-500 transition active:scale-[0.98] select-none" onclick="openQuickGroupModal('${safeName}')">
          <div class="flex justify-between items-start w-full gap-2">
              <div class="flex flex-col gap-1 min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                      <span class="font-extrabold text-xs md:text-sm text-gray-900 dark:text-white leading-tight truncate">${item.name}</span>
                      ${roleBadge}
                  </div>
                  ${subInfo}
              </div>
              <div class="shrink-0 flex items-center justify-end">
                  <span class="${groupBadgeClass} border px-2 py-0.5 rounded font-black text-[10px] uppercase shadow-sm">${groupStr ? `Grp ${groupStr}` : 'Unassigned'}</span>
              </div>
          </div>
      </div>
      `;
  });
}

container.innerHTML = html;
}

// ==========================================
// QUICK GROUP MODAL (Vertical List Logic)
// ==========================================

function openQuickGroupModal(name) {
currentGroupingTargetName = name;

const title = document.getElementById('quickGroupModalTitle');
title.innerHTML = `Assign <span class="text-orange-500">${name}</span>`;

const grid = document.getElementById('quickGroupGrid');

let currentGroup = "";
const t = groupingData.trainees.find(x => x.name === name);
if(t) currentGroup = String(t.group || "").trim();

let activeTrainees = (groupingData.trainees || []).filter(tr => tr.attending === 'y');

let highest = 0;
let groupSet = new Set();

activeTrainees.forEach(tr => {
  const g = String(tr.group || "").trim();
  if (g !== "") {
      groupSet.add(g);
      const num = parseInt(g);
      if (!isNaN(num) && num > highest) highest = num;
  }
});

let groups = Array.from(groupSet).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));

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
let activeTrainees = (groupingData.trainees || []).filter(t => t.attending === 'y');

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
const name = currentGroupingTargetName;

let trainee = groupingData.trainees.find(t => t.name === name);
if (!trainee) { closeQuickGroupModal(); return; }

const currentGroup = String(trainee.group || "").trim();
if (currentGroup === targetGroup) { closeQuickGroupModal(); return; }

const traineesToMove = new Set([name]);

if (targetGroup !== "" && trainee.volPaired) {
  let changed = true;
  while(changed) {
      changed = false;
      
      let aggregateVols = new Set();
      traineesToMove.forEach(tName => {
          const t = groupingData.trainees.find(x => x.name === tName);
          if (t && t.volPaired) {
              const vols = t.volPaired.split(/[,|\n]+/).map(v => v.trim().toLowerCase()).filter(v => v);
              vols.forEach(v => aggregateVols.add(v));
          }
      });
      
      groupingData.trainees.forEach(otherT => {
          if (traineesToMove.has(otherT.name) || !otherT.volPaired) return;
          
          const otherVols = otherT.volPaired.split(/[,|\n]+/).map(v => v.trim().toLowerCase()).filter(v => v);
          const hasSharedVol = otherVols.some(v => aggregateVols.has(v));
          
          if (hasSharedVol) {
              traineesToMove.add(otherT.name);
              changed = true; 
          }
      });
  }
}

traineesToMove.forEach(tName => {
  let t = groupingData.trainees.find(x => x.name === tName);
  if(t) {
      t.group = targetGroup;
      const updateIndex = pendingGroupingUpdates.findIndex(u => u.name === tName && u.role === 'TRAINEE');
      if (updateIndex > -1) {
          pendingGroupingUpdates[updateIndex].group = targetGroup;
      } else {
          pendingGroupingUpdates.push({ role: 'TRAINEE', name: tName, group: targetGroup });
      }
  }
});

if (traineesToMove.size > 1 && targetGroup !== "") {
  showFlashMessage('groupingGlobalStatus', `Auto-Grouped ${traineesToMove.size} trainees together due to shared volunteers.`, 'success');
}

renderGroupingList();
triggerGroupingSync();
closeQuickGroupModal();
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
    const idx = pendingGroupingUpdates.findIndex(p => p.name === u.name && p.role === u.role);
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

// ==========================================
// EXPORT TABLE LOGIC
// ==========================================

function openTableExportModal() {
   buildExportTable();
   document.getElementById('exportTableModal').classList.remove('hidden');
}

function closeTableExportModal() {
   document.getElementById('exportTableModal').classList.add('hidden');
}

function toggleGroupIC(volName, isChecked) {
   let v = groupingData.volunteers.find(x => x.name === volName);
   if (v) {
       v.groupIC = isChecked;
       const updateIndex = pendingGroupingUpdates.findIndex(u => u.name === volName && u.role === 'VOLUNTEER');
       if (updateIndex > -1) {
           pendingGroupingUpdates[updateIndex].groupIC = isChecked;
       } else {
           pendingGroupingUpdates.push({ role: 'VOLUNTEER', name: volName, groupIC: isChecked });
       }
       triggerGroupingSync();
       buildExportTable();
   }
}

function buildExportTable() {
   const container = document.getElementById('exportTableContainer');
   
   let allGroups = new Set();
   groupingData.trainees.forEach(t => {
       if (t.attending === 'y' && !t.isGoneHome && String(t.group).trim() !== "") {
           allGroups.add(String(t.group).trim());
       }
   });
   
   let sortedGroups = Array.from(allGroups).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
   
   let html = `
   <table class="w-full text-left border-collapse text-[9px] md:text-xs text-gray-800" style="font-family: Arial, sans-serif; border: 1px solid #333; table-layout: fixed; word-wrap: break-word;">
       <thead>
           <tr style="background-color: #333; color: #fff;">
               <th style="padding: 3px; border: 1px solid #555; width: 30%;">Volunteer</th>
               <th style="padding: 3px; border: 1px solid #555; width: 30%;">Trainee(s)</th>
               <th style="padding: 3px; border: 1px solid #555; width: 10%; text-align: center;">Grp</th>
               <th style="padding: 3px; border: 1px solid #555; width: 30%;">Remarks</th>
           </tr>
       </thead>
       <tbody>
   `;
   
   if (sortedGroups.length === 0) {
       html += `<tr><td colspan="4" style="padding: 10px; text-align: center; font-style: italic;">No groups assigned yet.</td></tr>`;
   }

   const volLookup = new Map();
   groupingData.volunteers.forEach(v => {
       volLookup.set(v.name.toLowerCase(), v);
   });

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
                   if (!volMap.has(vKey)) {
                       const vObj = volLookup.get(vKey);
                       volMap.set(vKey, {
                           name: vObj ? vObj.name : v, 
                           isIC: vObj ? vObj.groupIC === true : false,
                           trainees: [],
                           remarks: []
                       });
                   }
                   const vData = volMap.get(vKey);
                   vData.trainees.push(t.name);
                   if (remarks) vData.remarks.push(`${t.name}: ${remarks}`);
               });
           } else {
               unpairedTrainees.push({ name: t.name, remarks: remarks });
           }
       });
       
       let rows = Array.from(volMap.values());
       
       rows.sort((a, b) => {
           if (a.isIC && !b.isIC) return -1;
           if (!a.isIC && b.isIC) return 1;
           return a.name.localeCompare(b.name);
       });
       
       if (rows.length === 0 && unpairedTrainees.length === 0) {
           html += `<tr style="background-color: ${bgColor};">
               <td colspan="2" style="padding: 3px; border: 1px solid #ccc; font-style: italic;">No assignments</td>
               <td style="padding: 3px; border: 1px solid #ccc; text-align: center; font-weight: bold;">${g}</td>
               <td style="padding: 3px; border: 1px solid #ccc;"></td>
           </tr>`;
       }
       
       rows.forEach(r => {
           const safeName = r.name.replace(/'/g, "\\'");
           const toggleHtml = `<label class="flex items-center gap-1 mt-1 text-[8px] md:text-[10px] font-normal text-gray-500 ic-toggle-container select-none cursor-pointer"><input type="checkbox" onchange="toggleGroupIC('${safeName}', this.checked)" ${r.isIC ? 'checked' : ''} class="accent-blue-500 w-3 h-3"> Group IC</label>`;
           
           let volDisplay = `<span style="font-weight: bold;">${r.name}</span>`;
           if (r.isIC) volDisplay += `<br><strong style="color: #0369a1; font-size: 0.9em;">(Grp ${g} IC)</strong>`;
           volDisplay += toggleHtml;
           
           let tDisplay = r.trainees.length > 0 ? r.trainees.join('<br>') : '-';
           let rDisplay = r.remarks.join('<br><br>');
           
           html += `<tr style="background-color: ${bgColor};">
               <td style="padding: 3px; border: 1px solid #ccc; vertical-align: top;">${volDisplay}</td>
               <td style="padding: 3px; border: 1px solid #ccc; vertical-align: top;">${tDisplay}</td>
               <td style="padding: 3px; border: 1px solid #ccc; text-align: center; font-weight: bold; vertical-align: top;">${g}</td>
               <td contenteditable="true" style="padding: 3px; border: 1px solid #ccc; outline: none; transition: background 0.2s; vertical-align: top;" onfocus="this.style.backgroundColor='#fff'" onblur="this.style.backgroundColor='transparent'">${rDisplay}</td>
           </tr>`;
       });
       
       unpairedTrainees.forEach(ut => {
           html += `<tr style="background-color: ${bgColor};">
               <td style="padding: 3px; border: 1px solid #ccc; font-weight: bold; color: #dc2626; text-align: center; vertical-align: top;">-</td>
               <td style="padding: 3px; border: 1px solid #ccc; vertical-align: top;">${ut.name}</td>
               <td style="padding: 3px; border: 1px solid #ccc; text-align: center; font-weight: bold; vertical-align: top;">${g}</td>
               <td contenteditable="true" style="padding: 3px; border: 1px solid #ccc; outline: none; transition: background 0.2s; vertical-align: top;" onfocus="this.style.backgroundColor='#fff'" onblur="this.style.backgroundColor='transparent'">${ut.remarks}</td>
           </tr>`;
       });
   });
   
   html += `</tbody></table>`;
   container.innerHTML = html;
}

async function shareExportTable() {
   const container = document.getElementById('exportTableContainer');
   const btn = document.getElementById('shareTableBtn');
   if(!container || !btn) return;
   
   const originalText = btn.innerHTML;
   btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating Image...';
   btn.disabled = true;

   // Temporarily hide UI elements for clean image
   const toggles = container.querySelectorAll('.ic-toggle-container');
   toggles.forEach(t => t.style.display = 'none');
   
   container.querySelectorAll('[contenteditable]').forEach(el => {
       el.style.outline = 'none';
   });

   try {
       if (typeof html2canvas === 'undefined') throw new Error("html2canvas not loaded");
       
       const canvas = await html2canvas(container, {
           scale: 3, // High quality resolution
           backgroundColor: '#ffffff',
           useCORS: true
       });
       
       const dataUrl = canvas.toDataURL('image/png');

       btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up fa-spin"></i> Uploading to Drive...';

       const res = await apiCall('uploadExportTable', {
           sheetUrl: currentGroupingSheetUrl,
           imageBase64: dataUrl
       });

       if (res.success) {
           if (navigator.share) {
               await navigator.share({
                   title: 'Outing Groups',
                   text: 'Here is the generated outing groups table.',
                   url: res.url
               }).catch(e => console.log('Share canceled or failed', e));
           } else {
               // Fallback: Open URL in new tab
               window.open(res.url, '_blank');
           }
           showFlashMessage('groupingGlobalStatus', "Table successfully saved to Drive!", 'success');
       } else {
           throw new Error(res.message);
       }
   } catch (e) {
       console.error(e);
       alert("Failed to share table: " + e.message);
   } finally {
       toggles.forEach(t => t.style.display = 'flex');
       btn.innerHTML = originalText;
       btn.disabled = false;
   }
}