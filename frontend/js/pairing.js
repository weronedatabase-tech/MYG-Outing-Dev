let currentMassPairingSheetUrl = null;
let massPairingData = { trainees: [], volunteers: [], priVolMap: new Map() };
let pendingPairingUpdates = [];
let isMassPairingSyncing = false;
let massPairingSyncTimeout = null;
let massPairingPollInterval = null;

let isFilteredMassPairingMode = false;

// Expose DND state globally
let dndState = {
isDragging: false,
el: null,
clone: null,
startX: 0,
startY: 0,
nameNode: null,
rectWidth: 0,
rectHeight: 0
};

// ==========================================
// DRAG & DROP ENGINE (Mouse + Touch)
// ==========================================
if (!window.dndInitialized) {
window.dndInitialized = true;

// --- TOUCH EVENTS (MOBILE) ---
document.addEventListener('touchstart', (e) => {
   if(e.touches.length > 1) return;
   startDrag(e, e.touches[0].clientX, e.touches[0].clientY, true);
}, {passive: false});

document.addEventListener('touchmove', (e) => {
   moveDrag(e, e.touches[0].clientX, e.touches[0].clientY, true);
}, {passive: false});

document.addEventListener('touchend', (e) => {
   const touch = e.changedTouches ? e.changedTouches[0] : e.touches[0];
   endDrag(e, touch.clientX, touch.clientY);
});

document.addEventListener('touchcancel', (e) => {
   const touch = e.changedTouches ? e.changedTouches[0] : e.touches[0];
   endDrag(e, touch.clientX, touch.clientY);
});

// --- MOUSE EVENTS (DESKTOP) ---
document.addEventListener('mousedown', (e) => {
   if (e.button !== 0) return; 
   startDrag(e, e.clientX, e.clientY, false);
});

document.addEventListener('mousemove', (e) => {
   moveDrag(e, e.clientX, e.clientY, false);
});

document.addEventListener('mouseup', (e) => {
   endDrag(e, e.clientX, e.clientY);
});

// --- CORE LOGIC ---
function startDrag(e, clientX, clientY, isTouch) {
   // CRITICAL: Ignore clicks/touches on buttons, inputs, or the 'X' remove pill
   if(e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('.remove-x')) return;

   let draggable = e.target.closest('.dnd-draggable');
   if(!draggable) return;

   const pairingContainer = document.getElementById('view-mass-pairing');
   if(!pairingContainer || pairingContainer.classList.contains('hidden')) return;
   
   dndState.el = draggable;
   dndState.nameNode = dndState.el.querySelector('.main-name-pill') || dndState.el;

   const rect = dndState.nameNode.getBoundingClientRect();
   dndState.rectWidth = rect.width;
   dndState.rectHeight = rect.height;

   dndState.startX = clientX;
   dndState.startY = clientY;
   dndState.isDragging = false;
}

function moveDrag(e, clientX, clientY, isTouch) {
   if (!dndState.el) return;

   const deltaX = Math.abs(clientX - dndState.startX);
   const deltaY = Math.abs(clientY - dndState.startY);

   // If user hasn't triggered drag, check direction of movement
   if (!dndState.isDragging) {
       const threshold = 8;

       if (deltaX > threshold && deltaX > deltaY) {
           dndState.isDragging = true;
           
           if(isTouch && navigator.vibrate) navigator.vibrate(20);
           
           dndState.el.classList.add('locked-for-drag');
           
           // Generate visually identical clone
           dndState.clone = dndState.nameNode.cloneNode(true);
           dndState.clone.classList.add('dragging-clone');
           
           // Force size to exact bounding box constraints so centering works perfectly
           dndState.clone.style.width = dndState.rectWidth + 'px';
           dndState.clone.style.height = dndState.rectHeight + 'px';
           dndState.clone.style.margin = '0px';
           
           document.body.appendChild(dndState.clone);
       } else if (deltaY > 8) {
           dndState.el = null;
           return;
       }
   }

   if (dndState.isDragging && dndState.clone) {
       if(e.cancelable) e.preventDefault(); 

       updateClonePosition(clientX, clientY);

       // Highlight valid drop zones
       const elAtPoint = document.elementFromPoint(clientX, clientY);
       const activeDz = elAtPoint ? elAtPoint.closest('.dnd-dropzone') : null;
       document.querySelectorAll('.dnd-dropzone').forEach(dz => {
           if (dz === activeDz && dz.dataset.role !== dndState.el.dataset.role) {
               dz.classList.add('border-primary', 'bg-blue-50', 'dark:bg-blue-900/30', 'ring-1', 'ring-primary');
           } else {
               dz.classList.remove('border-primary', 'bg-blue-50', 'dark:bg-blue-900/30', 'ring-1', 'ring-primary');
           }
       });
   }
}

function endDrag(e, clientX, clientY) {
   if(dndState.el) dndState.el.classList.remove('locked-for-drag');

   if (dndState.isDragging && dndState.clone) {
       dndState.clone.remove(); 
       dndState.clone = null; 
       dndState.isDragging = false;

       document.querySelectorAll('.dnd-dropzone').forEach(dz => dz.classList.remove('border-primary', 'bg-blue-50', 'dark:bg-blue-900/30', 'ring-1', 'ring-primary'));

       const elAtPoint = document.elementFromPoint(clientX, clientY);
       const dropZone = elAtPoint ? elAtPoint.closest('.dnd-dropzone') : null;
       
       if(dropZone && dndState.el && dropZone.dataset.role !== dndState.el.dataset.role) {
           const sourceName = dndState.el.dataset.name;
           const sourceRole = dndState.el.dataset.role;
           const targetName = dropZone.dataset.name;
           if(sourceName && targetName) handleDndDrop(sourceName, sourceRole, targetName);
       }
   }
   dndState.el = null;
   dndState.nameNode = null;
}

function updateClonePosition(x, y) {
   if(dndState.clone) {
       const centerX = x - (dndState.rectWidth / 2);
       const centerY = y - (dndState.rectHeight / 2);
       dndState.clone.style.transform = `translate3d(${centerX}px, ${centerY}px, 0px) scale(1.05)`;
   }
}
}

// ==========================================
// MASS PAIRING LOGIC
// ==========================================

function openMassPairing() {
const selector = document.getElementById('commSheetSelector');
const url = selector.value;
if(!url || url.includes("Select") || url.includes("Loading") || url.includes("Error")) return alert("Select an event first");

isFilteredMassPairingMode = false;
currentMassPairingSheetUrl = url;
document.getElementById('navContextTitle').innerText = "Mass Pair: " + selector.options[selector.selectedIndex].text;

showView('mass-pairing');
loadMassPairingData();
}

function openFilteredMassPairing(overrideUrl = null) {
const url = overrideUrl || currentCommAttSheetUrl || currentMassPairingSheetUrl;
if(!url) return;

// Capture the exact view we are coming from BEFORE we switch
window.filteredMassPairingSourceView = window.currentActiveView;

isFilteredMassPairingMode = true;
currentMassPairingSheetUrl = url;
document.getElementById('navContextTitle').innerText = "Filtered Mass Pair";

showView('mass-pairing');
loadMassPairingData();
}

function loadMassPairingData() {
const overlay = document.getElementById('massPairingLoadingOverlay');
overlay.classList.remove('hidden');

apiCall('fetchMassPairingData', { sheetUrl: currentMassPairingSheetUrl }).then(res => {
   overlay.classList.add('hidden');
   if (res.success) {
       massPairingData = res.data;
       renderMassPairings();
       startMassPairingPolling();
   } else {
       alert("Error: " + res.message);
       if (isFilteredMassPairingMode) {
           showView('comm-attendance');
       } else {
           showView('comm');
       }
   }
});
}

function filterPairingPools() {
   renderMassPairings();
}

function triggerMassPairingPulse(sourceName, targetName, isPaired) {
  setTimeout(() => {
      requestAnimationFrame(() => {
          const cleanSource = sourceName.replace(/[^a-zA-Z0-9]/g, '');
          const cleanTarget = targetName.replace(/[^a-zA-Z0-9]/g, '');
          
          // Try to find the exact dropzone elements based on their data attributes
          const sourceCard = document.querySelector(`.dnd-dropzone[data-name="${sourceName.replace(/'/g, "\\'")}"]`);
          const targetCard = document.querySelector(`.dnd-dropzone[data-name="${targetName.replace(/'/g, "\\'")}"]`);
          
          [sourceCard, targetCard].forEach(card => {
              if (card) {
                  const container = card.parentElement;
                  if (container) {
                      const containerRect = container.getBoundingClientRect();
                      const cardRect = card.getBoundingClientRect();
                      
                      if (cardRect.height > 0) {
                          const scrollTop = container.scrollTop + (cardRect.top - containerRect.top) - (containerRect.height / 2) + (cardRect.height / 2);
                          
                          container.scrollTo({
                              top: scrollTop,
                              behavior: 'smooth'
                          });
                      }
                  }
                  
                  const pulseClass = isPaired ? 'pulse-green' : 'pulse-red';
                  
                  card.classList.add(pulseClass);
                  setTimeout(() => {
                      card.classList.remove(pulseClass);
                  }, 800);
              }
          });
      });
  }, 150);
}

function generatePillHtml(pillName, traineeName, volName, isTraineeGoneHome = false) {
const goneHomeBadge = isTraineeGoneHome ? `<i class="fa-solid fa-house-user text-blue-500 ml-1" title="Gone Home"></i>` : '';
const removeBtn = isTraineeGoneHome ? '' : `<div class="remove-x flex items-center justify-center font-bold text-[10px] bg-transparent text-red-500 shadow-none border-none hover:bg-transparent hover:text-red-700 hover:scale-125 top-0 right-1" onclick="unpairTrainee('${traineeName.replace(/'/g, "\\'")}', '${volName.replace(/'/g, "\\'")}')">✕</div>`;

return `<div class="relative flex w-full align-top pointer-events-auto">
<div class="bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 text-gray-900 dark:text-gray-100 text-[10px] md:text-[11px] pl-2 ${isTraineeGoneHome ? 'pr-2' : 'pr-6'} py-1 rounded shadow-sm border font-bold opacity-90 leading-tight break-words whitespace-normal text-left w-full flex items-center">
<span>${pillName}</span>${goneHomeBadge}
</div>
${removeBtn}
</div>`;
}

function generateCardHtml(item, pairedNames) {
const isVol = item.role === 'VOLUNTEER';
let pairedPills = '';

pairedNames.forEach(pairedName => {
   const tName = isVol ? pairedName : item.name;
   const vName = isVol ? item.name : pairedName;
   
   let isTraineeGoneHome = false;
   if (isVol) {
       const traineeObj = (massPairingData.trainees || []).find(t => t.name === tName);
       if (traineeObj && traineeObj.isGoneHome) {
           isTraineeGoneHome = true;
       }
   }

   pairedPills += generatePillHtml(pairedName, tName, vName, isTraineeGoneHome);
});

const safeName = item.name.replace(/'/g, "\\'");
const displayName = item.name;
const isGoneHome = item.isGoneHome === true;

let sysBadge = '';
let opacityClass = '';

if (isGoneHome) {
   sysBadge = `<i class="fa-solid fa-house-user text-blue-500 dark:text-blue-400 shrink-0 text-[10px] md:text-xs ml-0.5" title="Gone Home"></i>`;
   opacityClass = 'opacity-50 grayscale pointer-events-none';
} else if (item.isAttendingUnknown) {
   sysBadge = `<span class="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800 text-[8px] uppercase font-black tracking-wider px-1 py-0.5 rounded shrink-0 shadow-sm pointer-events-none whitespace-nowrap">? ATTENDING</span>`;
}

let cgBadge = '';
if (!isVol && item.caregivers > 0) {
   cgBadge = `<span class="inline-flex shrink-0 items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-[9px] font-black text-white shadow-sm">${item.caregivers > 1 ? item.caregivers + 'C' : 'C'}</span>`;
}

let projectInfo = '';
if (item.project) {
   projectInfo = `<span class="text-[10px] text-gray-500 dark:text-gray-400 font-medium">${item.project} ${!isVol && item.group ? '• Grp ' + item.group : ''}</span>`;
} else if (!isVol && item.group) {
   projectInfo = `<span class="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Grp ${item.group}</span>`;
}

const addBtnHtml = isGoneHome ? '' : `<button class="shrink-0 text-xs text-gray-500 dark:text-gray-400 hover:text-primary transition-colors bg-gray-50 dark:bg-black hover:bg-gray-100 dark:hover:bg-zinc-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-zinc-700 shadow-sm pointer-events-auto flex items-center justify-center font-bold" onclick="openQuickPairModal('${safeName}', '${item.role}')">+${isVol ? 'Trn' : 'Vol'}</button>`;

return `
<div class="dnd-draggable dnd-dropzone bg-white dark:bg-zinc-900 p-2 rounded-md border border-gray-200 dark:border-zinc-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] cursor-grab active:cursor-grabbing hover:border-primary transition select-none flex flex-col min-h-[70px] gap-1.5 ${opacityClass}" data-name="${safeName}" data-role="${item.role}" oncontextmenu="handleTraineeLongPress(event, '${safeName}')">
   <div class="flex justify-between items-center w-full gap-2">
       <div class="main-name-pill font-extrabold text-[11px] md:text-[12px] text-gray-900 dark:text-white leading-tight break-words flex items-center gap-1 min-w-0">
           <span class="whitespace-normal">${displayName}</span>
           ${cgBadge}
           ${sysBadge}
       </div>
       ${addBtnHtml}
   </div>
   <div class="flex flex-col w-full">
       ${projectInfo}
   </div>
   <div class="flex flex-col pointer-events-auto bg-gray-50/50 dark:bg-black/50 p-1.5 rounded min-h-[36px] border border-dashed border-gray-200 dark:border-zinc-700 mt-1 w-full gap-1.5">
       ${pairedPills || `<span class="text-[9px] md:text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-0.5 pointer-events-none text-center w-full py-1">Drop ${isVol ? 'trainee' : 'volunteer'} here</span>`}
   </div>
</div>
`;
}

function renderMassPairings() {
// STRICT FILTERING: Exclude any trainees that do not have explicitly 'Y' or 'y' in the attending column
let trainees = (massPairingData.trainees || []).filter(t => {
   const att = t.attending ? String(t.attending).toLowerCase().trim() : "";
   return att === 'y';
});

let vols = [...(massPairingData.volunteers || [])]; 

// Fuzzy Search logic
const volSearchQuery = document.getElementById('pairingVolSearch')?.value.toLowerCase().trim() || "";
const traSearchQuery = document.getElementById('pairingTraineeSearch')?.value.toLowerCase().trim() || "";

if (volSearchQuery) {
   vols = vols.filter(v => 
       v.name.toLowerCase().includes(volSearchQuery) || 
       (v.project && v.project.toLowerCase().includes(volSearchQuery))
   );
}
if (traSearchQuery) {
   trainees = trainees.filter(t => 
       t.name.toLowerCase().includes(traSearchQuery) || 
       (t.project && t.project.toLowerCase().includes(traSearchQuery)) ||
       (t.group && String(t.group).toLowerCase().includes(traSearchQuery))
   );
}

// Sorting Logic: Project Alphabetical, followed by Name Alphabetical
const sortFn = (a, b) => {
   const projA = a.project ? a.project.toString().toLowerCase().trim() : "zzzz";
   const projB = b.project ? b.project.toString().toLowerCase().trim() : "zzzz";
   const projCmp = projA.localeCompare(projB);
   if (projCmp !== 0) return projCmp;

   const nameA = a.name ? a.name.toString().toLowerCase().trim() : "";
   const nameB = b.name ? b.name.toString().toLowerCase().trim() : "";
   return nameA.localeCompare(nameB);
};

vols.sort(sortFn);
trainees.sort(sortFn);

// Calculate unpaired trainees
let unpairedCount = 0;
(massPairingData.trainees || []).forEach(t => {
   if (!t.isGoneHome && (!t.volPaired || t.volPaired.trim() === '')) {
       unpairedCount++;
   }
});
updateUnpairedNotification(unpairedCount);

// Build Volunteer Pairings Map
const volPairingsMap = new Map();
(massPairingData.trainees || []).forEach(t => {
   if (t.volPaired) {
       const pairedVols = t.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
       pairedVols.forEach(v => {
           const cleanVol = v.toLowerCase();
           if (!volPairingsMap.has(cleanVol)) volPairingsMap.set(cleanVol, []);
           volPairingsMap.get(cleanVol).push(t.name);
       });
   }
});

// If filtered mode is active, exclusively show Unpaired Trainees in the Target list
// Enforce that Gone Home trainees never appear in the Target list during Filtered Mode
if (isFilteredMassPairingMode) {
   trainees = trainees.filter(t => !t.isGoneHome && (!t.volPaired || t.volPaired.trim() === ''));
}

let sourceHtml = '';
vols.forEach(item => { 
   const myTrainees = volPairingsMap.get(item.name.toLowerCase()) || [];
   sourceHtml += generateCardHtml(item, myTrainees); 
});
document.getElementById('dnd-source-pool').innerHTML = sourceHtml || '<p class="text-[10px] text-gray-500 font-bold p-2 text-center mt-2">No active volunteers matching search.</p>';

let targetHtml = '';
trainees.forEach(item => { 
   const myVols = item.volPaired ? item.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v) : [];
   targetHtml += generateCardHtml(item, myVols); 
});

if (isFilteredMassPairingMode && targetHtml === '') {
   document.getElementById('dnd-target-list').innerHTML = '<p class="text-[10px] text-green-500 font-bold p-2 text-center mt-2">All trainees are paired!</p>';
} else {
   document.getElementById('dnd-target-list').innerHTML = targetHtml || '<p class="text-[10px] text-gray-500 font-bold p-2 text-center mt-2">No active trainees matching search.</p>';
}
}

function handleDndDrop(sourceName, sourceRole, targetName) {
let volName = sourceRole === 'VOLUNTEER' ? sourceName : targetName;
let traineeName = sourceRole === 'TRAINEE' ? sourceName : targetName;

let trainee = massPairingData.trainees.find(t => t.name === traineeName);
if (!trainee || trainee.isGoneHome) return;

// Check if already paired
const currentVols = trainee.volPaired ? trainee.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v) : [];

// Fuzzy matching for exact names
const cleanVol = volName.toLowerCase();
const exists = currentVols.some(v => v.toLowerCase() === cleanVol);

if (!exists) {
   currentVols.push(volName);
   trainee.volPaired = currentVols.join(', ');
   
   // Add to pending updates map
   const updateIndex = pendingPairingUpdates.findIndex(u => u.traineeName === traineeName);
   if (updateIndex > -1) {
       pendingPairingUpdates[updateIndex].volPaired = trainee.volPaired;
   } else {
       pendingPairingUpdates.push({ traineeName: traineeName, volPaired: trainee.volPaired });
   }

   renderMassPairings(); 
   triggerMassPairingPulse(sourceName, targetName, true);
   triggerMassPairingSync();
} else {
   showToast("Already paired!", true);
}
}

function unpairTrainee(traineeName, volName) {
let trainee = massPairingData.trainees.find(t => t.name === traineeName);
if (!trainee || trainee.isGoneHome) return;

let currentVols = trainee.volPaired ? trainee.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v) : [];
const cleanVolToRemove = volName.toLowerCase();

currentVols = currentVols.filter(v => v.toLowerCase() !== cleanVolToRemove);
trainee.volPaired = currentVols.join(', ');

// Add to pending updates map
const updateIndex = pendingPairingUpdates.findIndex(u => u.traineeName === traineeName);
if (updateIndex > -1) {
    pendingPairingUpdates[updateIndex].volPaired = trainee.volPaired;
} else {
    pendingPairingUpdates.push({ traineeName: traineeName, volPaired: trainee.volPaired });
}

renderMassPairings(); 
triggerMassPairingPulse(traineeName, volName, false);
triggerMassPairingSync();
}

function setMassPairingSyncButtonState(state) {
const btn = document.getElementById('btn-sync-mass-pairing');
if(!btn) return;
const textSpan = btn.querySelector('.btn-text'); const spinner = btn.querySelector('.btn-spinner');

btn.className = "text-[10px] md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm focus:outline-none shrink-0"; 
spinner.className = "fa-solid fa-circle-notch fa-spin btn-spinner ml-1 hidden"; 

if (state === 'loading' || state === 'saving') { 
   btn.classList.add('bg-yellow-50', 'text-yellow-700', 'border-yellow-200', 'dark:bg-yellow-900/30', 'dark:text-yellow-400', 'dark:border-yellow-800'); 
   textSpan.textContent = state === 'loading' ? "Loading..." : "Saving..."; 
   spinner.classList.remove('hidden'); 
} else if (state === 'saved') { 
   btn.classList.add('bg-green-50', 'text-green-700', 'border-green-200', 'dark:bg-green-900/30', 'dark:text-green-400', 'dark:border-green-800'); 
   textSpan.textContent = "Saved"; 
   setTimeout(() => {
       if (pendingPairingUpdates.length === 0) {
           btn.className = "text-[10px] md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 shadow-sm focus:outline-none shrink-0";
           textSpan.textContent = "Saved";
       }
   }, 2000);
} else if (state === 'error') { 
   btn.classList.add('bg-red-50', 'text-red-700', 'border-red-200', 'dark:bg-red-900/30', 'dark:text-red-400', 'dark:border-red-800'); 
   textSpan.textContent = "Save Failed"; 
}
}

function triggerMassPairingSync() {
setMassPairingSyncButtonState('saving');
if (massPairingSyncTimeout) clearTimeout(massPairingSyncTimeout);
massPairingSyncTimeout = setTimeout(() => {
   executeMassPairingSync();
}, 800); 
}

async function executeMassPairingSync() {
if (pendingPairingUpdates.length === 0) return;

isMassPairingSyncing = true;
setMassPairingSyncButtonState('saving');

const updatesToSync = [...pendingPairingUpdates];
pendingPairingUpdates = [];

try {
   const res = await apiCall('syncMassPairingUpdates', { sheetUrl: currentMassPairingSheetUrl, updates: updatesToSync });

   if (res.success) {
       setMassPairingSyncButtonState('saved');
   } else {
       throw new Error(res.message);
   }
} catch(e) {
   console.error(e);
   setMassPairingSyncButtonState('error');
   // Push back failed updates
   updatesToSync.forEach(u => {
       const idx = pendingPairingUpdates.findIndex(p => p.traineeName === u.traineeName);
       if (idx === -1) pendingPairingUpdates.push(u);
   });
} finally {
   isMassPairingSyncing = false;
}
}

function startMassPairingPolling() {
if (massPairingPollInterval) clearInterval(massPairingPollInterval);

massPairingPollInterval = setInterval(async () => {
   const view = document.getElementById('view-mass-pairing');
   if(!view || view.classList.contains('hidden') || isMassPairingSyncing || (dndState.el || dndState.isDragging)) return;

   try {
       const res = await apiCall('fetchMassPairingData', { sheetUrl: currentMassPairingSheetUrl });
       if(res.success && !isMassPairingSyncing && pendingPairingUpdates.length === 0) {
           const newDataStr = JSON.stringify(res.data);
           const oldDataStr = JSON.stringify(massPairingData);
           
           if (newDataStr !== oldDataStr) {
               massPairingData = res.data;
               renderMassPairings();
           }
       }
   } catch(e) { }
}, 8000);
}

async function manualSyncMassPairing() {
if (pendingPairingUpdates.length > 0) {
   await executeMassPairingSync();
}

setMassPairingSyncButtonState('loading');
const overlay = document.getElementById('massPairingLoadingOverlay');
overlay.classList.remove('hidden');

try {
   const res = await apiCall('fetchMassPairingData', { sheetUrl: currentMassPairingSheetUrl });
   overlay.classList.add('hidden');
   if (res.success) {
       massPairingData = res.data;
       renderMassPairings();
       setMassPairingSyncButtonState('saved');
   } else {
       setMassPairingSyncButtonState('error');
   }
} catch (e) {
   overlay.classList.add('hidden');
   setMassPairingSyncButtonState('error');
}
}

// ==========================================
// QUICK PAIR MODAL LOGIC
// ==========================================
let quickPairContext = { sourceName: '', sourceRole: '', targetList: [] };

function openQuickPairModal(sourceName, sourceRole) {
quickPairContext.sourceName = sourceName;
quickPairContext.sourceRole = sourceRole;

const modal = document.getElementById('quickPairModal');
const title = document.getElementById('quickPairModalTitle');
const input = document.getElementById('quickPairSearch');

title.innerHTML = `Pairing with <span class="text-primary">${sourceName}</span>`;
input.value = '';

// Sorting Logic for Modal: Project Alphabetical, followed by Name Alphabetical
const sortFn = (a, b) => {
   const projA = a.project ? a.project.toString().toLowerCase().trim() : "zzzz";
   const projB = b.project ? b.project.toString().toLowerCase().trim() : "zzzz";
   const projCmp = projA.localeCompare(projB);
   if (projCmp !== 0) return projCmp;

   const nameA = a.name ? a.name.toString().toLowerCase().trim() : "";
   const nameB = b.name ? b.name.toString().toLowerCase().trim() : "";
   return nameA.localeCompare(nameB);
};

// Build target list
if (sourceRole === 'VOLUNTEER') {
   // Search Trainees (Strictly 'Y' and not gone home)
   quickPairContext.targetList = (massPairingData.trainees || [])
       .filter(t => {
           const att = t.attending ? String(t.attending).toLowerCase().trim() : "";
           return att === 'y' && !t.isGoneHome;
       })
       .sort(sortFn)
       .map(t => t.name);
} else {
   // Search Volunteers
   quickPairContext.targetList = (massPairingData.volunteers || [])
       .sort(sortFn)
       .map(v => v.name);
}

filterQuickPairList();
modal.classList.remove('hidden');
setTimeout(() => input.focus(), 100);
}

function closeQuickPairModal() {
document.getElementById('quickPairModal').classList.add('hidden');
}

function filterQuickPairList() {
const input = document.getElementById('quickPairSearch').value.toLowerCase().trim();
const listEl = document.getElementById('quickPairList');
listEl.innerHTML = '';

const matches = quickPairContext.targetList.filter(name => name.toLowerCase().includes(input));

if (matches.length === 0) {
   listEl.innerHTML = '<li class="text-xs text-gray-500 p-2 text-center">No matches found</li>';
   return;
}

matches.forEach(name => {
   // Check if already paired
   let isPaired = false;
   const traineeName = quickPairContext.sourceRole === 'TRAINEE' ? quickPairContext.sourceName : name;
   const volName = quickPairContext.sourceRole === 'VOLUNTEER' ? quickPairContext.sourceName : name;
   
   const trainee = massPairingData.trainees.find(t => t.name === traineeName);
   if (trainee && trainee.volPaired) {
       const vols = trainee.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
       isPaired = vols.some(v => v.toLowerCase() === volName.toLowerCase());
   }
   
   const li = document.createElement('li');
   li.className = `p-3 rounded border text-sm font-bold flex justify-between items-center transition-colors ${isPaired ? 'bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 opacity-60 cursor-not-allowed' : 'bg-white dark:bg-black border-gray-200 dark:border-zinc-700 hover:border-primary cursor-pointer'}`;
   
   li.innerHTML = `<span>${name}</span> ${isPaired ? '<i class="fa-solid fa-check text-green-500"></i>' : ''}`;
   
   if (!isPaired) {
       li.onclick = () => {
           handleDndDrop(quickPairContext.sourceName, quickPairContext.sourceRole, name);
           closeQuickPairModal();
       };
   }
   listEl.appendChild(li);
});
}