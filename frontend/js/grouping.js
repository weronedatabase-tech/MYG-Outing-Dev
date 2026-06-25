let currentGroupingSheetUrl = null;
let groupingData = { trainees: [], volunteers: [] };
let pendingGroupingUpdates = [];
let isGroupingSyncing = false;
let groupingSyncTimeout = null;
let groupingPollInterval = null;

// ==========================================
// MANUAL GROUPING LOGIC
// ==========================================

function openManualGrouping() {
const selector = document.getElementById('commSheetSelector');
const url = selector.value;
if(!url || url.includes("Select") || url.includes("Loading") || url.includes("Error")) return alert("Select an event first");

currentGroupingSheetUrl = url;
document.getElementById('navContextTitle').innerText = "Manual Group: " + selector.options[selector.selectedIndex].text;

showView('manual-grouping');
loadGroupingData();
}

function loadGroupingData() {
const overlay = document.getElementById('groupingLoadingOverlay');
overlay.classList.remove('hidden');

// We re-use the pairing data fetcher since it pulls everything we need
apiCall('fetchManualPairingData', { sheetUrl: currentGroupingSheetUrl }).then(res => {
  overlay.classList.add('hidden');
  if (res.success) {
      groupingData = res.data;
      renderGroupingBoard();
      startGroupingPolling();
  } else {
      alert("Error: " + res.message);
      showView('comm');
  }
});
}

function renderGroupingBoard() {
const board = document.getElementById('groupingKanbanBoard');

// Collect all unique groups, numeric sort. 
// Any trainee without a group goes into "Unassigned"
let groupSet = new Set();
let unassignedTrainees = [];

let activeTrainees = (groupingData.trainees || []).filter(t => {
    const att = t.attending ? String(t.attending).toLowerCase().trim() : "";
    return att === 'y';
});

activeTrainees.forEach(t => {
    const g = String(t.group || "").trim();
    if (g === "") {
        unassignedTrainees.push(t);
    } else {
        groupSet.add(g);
    }
});

let groups = Array.from(groupSet).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));

// Ensure there is always at least one group to drag into if unassigned exists
if (groups.length === 0) {
    groups = ["1"];
}

// Generate the columns HTML
let boardHtml = '';

// Unassigned Column
boardHtml += generateKanbanColumn("Unassigned", unassignedTrainees);

// Group Columns
groups.forEach(g => {
    const traineesInGroup = activeTrainees.filter(t => String(t.group || "").trim() === g);
    boardHtml += generateKanbanColumn(g, traineesInGroup);
});

// "Add Group" Column button
boardHtml += `
<div class="flex-none w-64 md:w-72 shrink-0 flex flex-col h-full opacity-50 hover:opacity-100 transition-opacity">
    <button onclick="addNewGroupColumn()" class="w-full h-full min-h-[100px] border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg text-gray-500 dark:text-gray-400 font-bold flex flex-col items-center justify-center gap-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
        <i class="fa-solid fa-plus text-2xl"></i>
        <span>Add Group</span>
    </button>
</div>
`;

board.innerHTML = boardHtml;

// Bind Long Press globally to items
document.querySelectorAll('.dnd-draggable').forEach(el => {
  uiBindLongPress(el, () => {
      const name = el.getAttribute('data-name');
      const p = (groupingData.trainees || []).find(x => x.name.replace(/'/g, "\\'") === name);
      if (p) showPersonInfo(p);
  });
});
}

function generateKanbanColumn(groupName, trainees) {
const isUnassigned = groupName === "Unassigned";
const colTitle = isUnassigned ? "Unassigned" : `Group ${groupName}`;
const targetValue = isUnassigned ? "" : groupName;

let cardsHtml = '';
trainees.sort((a,b) => a.name.localeCompare(b.name)).forEach(t => {
    cardsHtml += generateGroupingCardHtml(t);
});

if (cardsHtml === '') {
    cardsHtml = `<div class="text-[10px] text-gray-400 font-medium text-center p-4 border border-dashed border-gray-200 dark:border-zinc-700 rounded pointer-events-none">Drop trainees here</div>`;
}

return `
<div class="flex-none w-64 md:w-72 flex flex-col h-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm dnd-dropzone" data-grouptarget="${targetValue}">
    <div class="bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-3 py-2 flex justify-between items-center shrink-0">
        <h3 class="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wider">${colTitle}</h3>
        <span class="bg-white dark:bg-black text-xs font-bold px-2 py-0.5 rounded-full border border-gray-200 dark:border-zinc-700">${trainees.length}</span>
    </div>
    <div class="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar pb-6 bg-gray-50 dark:bg-black/20">
        ${cardsHtml}
    </div>
</div>
`;
}

function generateGroupingCardHtml(trainee) {
const safeName = trainee.name.replace(/'/g, "\\'");
let cgBadge = '';
if (trainee.caregivers > 0) {
  cgBadge = `<span class="inline-flex shrink-0 items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-[9px] font-black text-white shadow-sm">${trainee.caregivers > 1 ? trainee.caregivers + 'C' : 'C'}</span>`;
}

let volInfo = '';
if (trainee.volPaired) {
    volInfo = `<div class="text-[10px] text-teal-600 dark:text-teal-400 font-bold bg-teal-50 dark:bg-teal-900/30 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800/50 mt-1 line-clamp-2 leading-tight">🤝 ${trainee.volPaired}</div>`;
}

return `
<div class="dnd-draggable bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary transition select-none flex flex-col gap-1" data-name="${safeName}">
  <div class="flex justify-between items-start w-full gap-2">
      <div class="main-name-pill font-extrabold text-[12px] text-gray-900 dark:text-white leading-tight break-words whitespace-normal flex items-start gap-1 min-w-0 flex-1">
          <span class="break-words">${trainee.name}</span>
          ${cgBadge}
      </div>
  </div>
  ${volInfo}
</div>
`;
}

function addNewGroupColumn() {
const activeTrainees = (groupingData.trainees || []).filter(t => {
    const att = t.attending ? String(t.attending).toLowerCase().trim() : "";
    return att === 'y';
});

let highest = 0;
activeTrainees.forEach(t => {
    const num = parseInt(t.group);
    if (!isNaN(num) && num > highest) highest = num;
});

const newGroup = String(highest + 1);

// Visual simulation - no trainees in it yet, but it forces a render
let groupSet = new Set();
activeTrainees.forEach(t => {
    const g = String(t.group || "").trim();
    if (g !== "") groupSet.add(g);
});
groupSet.add(newGroup);

// Temporarily hijack the render logic to force the new group
const board = document.getElementById('groupingKanbanBoard');
let boardHtml = generateKanbanColumn("Unassigned", activeTrainees.filter(t => String(t.group || "").trim() === ""));
let groups = Array.from(groupSet).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));

groups.forEach(g => {
    const traineesInGroup = activeTrainees.filter(t => String(t.group || "").trim() === g);
    boardHtml += generateKanbanColumn(g, traineesInGroup);
});
boardHtml += `<div class="flex-none w-64 md:w-72 shrink-0 flex flex-col h-full opacity-50 hover:opacity-100 transition-opacity"><button onclick="addNewGroupColumn()" class="w-full h-full min-h-[100px] border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg text-gray-500 dark:text-gray-400 font-bold flex flex-col items-center justify-center gap-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"><i class="fa-solid fa-plus text-2xl"></i><span>Add Group</span></button></div>`;
board.innerHTML = boardHtml;

// Bind Long Press globally to items
document.querySelectorAll('.dnd-draggable').forEach(el => {
  uiBindLongPress(el, () => {
      const name = el.getAttribute('data-name');
      const p = (groupingData.trainees || []).find(x => x.name.replace(/'/g, "\\'") === name);
      if (p) showPersonInfo(p);
  });
});

// Scroll to the far right smoothly
setTimeout(() => {
    board.scrollTo({ left: board.scrollWidth, behavior: 'smooth' });
}, 100);
}

function handleGroupingDrop(traineeName, targetGroup) {
let trainee = groupingData.trainees.find(t => t.name === traineeName);
if (!trainee) return;

const currentGroup = String(trainee.group || "").trim();
if (currentGroup === targetGroup) return;

const namesToMove = new Set([traineeName]);

// Advanced Logic: Auto-move connected trainees.
// If this trainee has paired volunteers, find all OTHER trainees paired with these same volunteers.
if (trainee.volPaired && targetGroup !== "") {
    const volArray = trainee.volPaired.split(/[,|\n]+/).map(v => v.trim().toLowerCase()).filter(v => v);
    
    groupingData.trainees.forEach(otherT => {
        if (otherT.name === traineeName || !otherT.volPaired) return;
        const otherVols = otherT.volPaired.split(/[,|\n]+/).map(v => v.trim().toLowerCase()).filter(v => v);
        
        const hasSharedVol = volArray.some(v => otherVols.includes(v));
        if (hasSharedVol && String(otherT.group || "").trim() !== targetGroup) {
            namesToMove.add(otherT.name);
        }
    });
}

// Apply updates
namesToMove.forEach(name => {
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

renderGroupingBoard();
triggerGroupingSync();

// Pulse animations
setTimeout(() => {
    namesToMove.forEach(name => {
        const card = document.querySelector(`.dnd-draggable[data-name="${name.replace(/'/g, "\\'")}"]`);
        if (card) {
            card.classList.add('pulse-blue');
            setTimeout(() => card.classList.remove('pulse-blue'), 800);
        }
    });
}, 150);
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
  if(!view || view.classList.contains('hidden') || isGroupingSyncing || (dndState.el || dndState.isDragging)) return;

  try {
      const res = await apiCall('fetchManualPairingData', { sheetUrl: currentGroupingSheetUrl });
      if(res.success && !isGroupingSyncing && pendingGroupingUpdates.length === 0) {
          const newDataStr = JSON.stringify(res.data);
          const oldDataStr = JSON.stringify(groupingData);
          
          if (newDataStr !== oldDataStr) {
              groupingData = res.data;
              renderGroupingBoard();
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
      renderGroupingBoard();
      setGroupingSyncButtonState('saved');
  } else {
      setGroupingSyncButtonState('error');
  }
} catch (e) {
  overlay.classList.add('hidden');
  setGroupingSyncButtonState('error');
}
}