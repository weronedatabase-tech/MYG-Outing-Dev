function showView(viewId) { 
currentActiveView = viewId; 
document.querySelectorAll('main > div').forEach(div => div.classList.add('hidden')); 
const viewElement = document.getElementById('view-' + viewId);
if (viewElement) viewElement.classList.remove('hidden'); 

['volFormStatus', 'scrubStatus', 'commGlobalStatus', 'settingsStatus'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
});

const mainContainer = document.getElementById('mainContainer');
if (viewId === 'comm-attendance' || viewId === 'manual-pairing' || viewId === 'manual-grouping') {
// Ironclad Lock on root scroll to prevent scrollIntoView or programmatic focus from shifting the entire window
document.documentElement.classList.add('overflow-hidden', 'overscroll-none');
document.body.classList.add('overflow-hidden', 'overscroll-none');
document.body.classList.remove('pb-20');
if(mainContainer) {
    mainContainer.classList.remove('p-4', 'mt-2');
    mainContainer.classList.add('p-1', 'mt-1');
}
} else {
document.documentElement.classList.remove('overflow-hidden', 'overscroll-none');
document.body.classList.remove('overflow-hidden', 'overscroll-none');
document.body.classList.add('pb-20');
if(mainContainer) {
    mainContainer.classList.remove('p-1', 'mt-1');
    mainContainer.classList.add('p-4', 'mt-2');
}
}

// Handle Dynamic Navbar
const navDefault = document.getElementById('navDefault');
const navContext = document.getElementById('navContext');
const titleEl = document.getElementById('navContextTitle');
const manualPairingActions = document.getElementById('navContextActionsManualPairing');
const manualGroupingActions = document.getElementById('navContextActionsManualGrouping');
const commAttActions = document.getElementById('navContextActionsCommAtt');

if(navDefault) navDefault.classList.add('hidden');
if(navContext) navContext.classList.remove('hidden');

if (manualPairingActions) {
   manualPairingActions.classList.add('hidden');
   manualPairingActions.classList.remove('flex');
}
if (manualGroupingActions) {
   manualGroupingActions.classList.add('hidden');
   manualGroupingActions.classList.remove('flex');
}
if (commAttActions) {
   commAttActions.classList.add('hidden');
   commAttActions.classList.remove('flex');
}

if (viewId === 'comm') {
if(titleEl) {
    titleEl.innerText = 'Comm Dashboard';
    titleEl.className = 'text-xs md:text-sm font-extrabold text-blue-600 dark:text-blue-400 leading-tight break-words whitespace-normal';
}
} else if (viewId === 'actual-attendance') {
if(titleEl) {
    titleEl.innerText = 'Select Event for Tracker';
    titleEl.className = 'text-xs md:text-sm font-extrabold text-teal-600 dark:text-teal-400 leading-tight break-words whitespace-normal';
}
} else if (viewId === 'comm-attendance') {
// Title is updated dynamically in loadCommAttendanceData
if(titleEl) titleEl.className = 'text-xs md:text-sm font-extrabold text-teal-600 dark:text-teal-400 leading-tight break-words whitespace-normal';
if (commAttActions) {
   commAttActions.classList.remove('hidden');
   commAttActions.classList.add('flex');
}
} else if (viewId === 'manual-pairing') {
// Title is updated dynamically in loadManualPairingData
if(titleEl) titleEl.className = 'text-xs md:text-sm font-extrabold text-blue-600 dark:text-blue-400 leading-tight break-words whitespace-normal';
if (manualPairingActions) {
   manualPairingActions.classList.remove('hidden');
   manualPairingActions.classList.add('flex');
}
} else if (viewId === 'manual-grouping') {
// Title is updated dynamically in loadGroupingData
if(titleEl) titleEl.className = 'text-xs md:text-sm font-extrabold text-orange-600 dark:text-orange-400 leading-tight break-words whitespace-normal';
if (manualGroupingActions) {
   manualGroupingActions.classList.remove('hidden');
   manualGroupingActions.classList.add('flex');
}
} else if (viewId === 'volunteer') {
if(titleEl) {
    titleEl.innerText = 'Attendance Update';
    titleEl.className = 'text-xs md:text-sm font-extrabold text-green-600 dark:text-green-400 leading-tight break-words whitespace-normal';
}
} else if (viewId === 'settings') {
if(titleEl) {
    titleEl.innerText = 'Field Configuration';
    titleEl.className = 'text-xs md:text-sm font-extrabold text-purple-600 dark:text-purple-400 leading-tight break-words whitespace-normal';
}
} else {
// Landing page shows default logo
if(navDefault) navDefault.classList.remove('hidden');
if(navContext) navContext.classList.add('hidden');
}

if (viewId === 'comm' || viewId === 'volunteer' || viewId === 'actual-attendance') loadSheets(viewId); 
if (viewId === 'settings') loadSettings(); 
}

window.handleNavBack = function() {
if (currentActiveView === 'comm-attendance') {
showView('actual-attendance');
} else if (currentActiveView === 'manual-pairing') {
if (typeof isFilteredManualPairingMode !== 'undefined' && isFilteredManualPairingMode) {
  isFilteredManualPairingMode = false;
  
  let targetView = window.filteredManualPairingSourceView || 'comm';
  
  if (targetView === 'manual-pairing') {
      // Re-initialize standard manual pairing to effectively exit filtered mode safely
      openManualPairing();
  } else if (targetView === 'comm-attendance') {
      // Restore Live Tracker title securely before showing
      const selector = document.getElementById('actualSheetSelector');
      if (selector && selector.options.length > 0 && selector.selectedIndex >= 0) {
          const titleEl = document.getElementById('navContextTitle');
          if(titleEl) titleEl.innerText = "Live: " + selector.options[selector.selectedIndex].text;
      }
      showView('comm-attendance');
  } else {
      showView('comm');
  }
} else {
  showView('comm');
}
} else if (currentActiveView === 'manual-grouping') {
showView('comm');
} else {
showView('landing');
}
};

function refreshApp() { 
const icon = document.getElementById('refreshIcon'); 
if(icon) icon.classList.add('fa-spin'); 

// Force Service Worker Update
if ('serviceWorker' in navigator) {
navigator.serviceWorker.getRegistrations().then(regs => {
  for (let reg of regs) {
      reg.update();
  }
});
}

// Clear caches to force UI update, then reload securely
if ('caches' in window) {
caches.keys().then(names => {
  Promise.all(names.map(name => caches.delete(name))).then(() => {
      window.location.reload(true);
  });
});
} else {
setTimeout(() => { window.location.reload(true); }, 300);
}
}

function toggleTheme() { 
document.documentElement.classList.toggle('dark'); 
localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light'); 
}

// --- OVERLAY LOGIC ---
function showOverlay(type, msg) {
const overlay = document.getElementById('fullPageOverlay');
if(!overlay) return;
overlay.classList.remove('hidden');

['overlayLoading', 'overlaySuccess', 'overlayError'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.classList.add('hidden');
});

if (type === 'loading') {
const el = document.getElementById('overlayLoading');
if(el) el.classList.remove('hidden');
const txt = document.getElementById('overlayLoadingText');
if(txt) txt.innerText = msg || "Processing...";
} else if (type === 'success') {
const el = document.getElementById('overlaySuccess');
if(el) el.classList.remove('hidden');
const txt = document.getElementById('overlaySuccessText');
if(txt) txt.innerText = msg;
} else {
const el = document.getElementById('overlayError');
if(el) el.classList.remove('hidden');
const txt = document.getElementById('overlayErrorText');
if(txt) txt.innerText = msg;
}
}

function closeOverlay() {
const el = document.getElementById('fullPageOverlay');
if(el) el.classList.add('hidden');
}

function showFlashMessage(elementId, message, type) { 
const el = document.getElementById(elementId); 
if(!el) return;
el.innerText = message; 
el.classList.remove('hidden', 'bg-green-100', 'dark:bg-green-900/30', 'text-green-600', 'dark:text-green-400', 'border-green-200', 'dark:border-green-800', 'bg-red-100', 'dark:bg-red-900/30', 'text-red-600', 'dark:text-red-400', 'border-red-200', 'dark:border-red-800'); 
if (type === 'success') { 
el.classList.add('bg-green-100', 'dark:bg-green-900/30', 'text-green-600', 'dark:text-green-400', 'border', 'border-green-200', 'dark:border-green-800'); 
} else { 
el.classList.add('bg-red-100', 'dark:bg-red-900/30', 'text-red-600', 'dark:text-red-400', 'border', 'border-red-200', 'dark:border-red-800'); 
} 
el.classList.remove('hidden'); 
setTimeout(() => { el.classList.add('hidden'); }, 5000); 
}

function formatDateDisplay(input) { 
const val = input.value; 
if(!val) { input.type='text'; return; } 
const date = new Date(val); 
if(isNaN(date.getTime())) { input.type='text'; return; } 
const day = date.getDate().toString().padStart(2, '0'); 
const month = date.toLocaleString('default', { month: 'short' }); 
const year = date.getFullYear(); 
input.type = 'text'; 
input.value = `${day} ${month} ${year}`; 
}

function updateUnpairedNotification(count) {
// Update Comm Dashboard List
if(window.currentSheetList) {
window.currentSheetList.forEach((item, index) => {
    if (item.sheetUrl === currentCommAttSheetUrl || item.sheetUrl === currentManualPairingSheetUrl || (typeof currentGroupingSheetUrl !== 'undefined' && item.sheetUrl === currentGroupingSheetUrl)) {
        const pendingDiv = document.getElementById(`pending-badge-${index}`);
        if (pendingDiv) {
            if (count > 0) {
                pendingDiv.innerHTML = `<button onclick="openFilteredManualPairing('${item.sheetUrl}')" class="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800 animate-pulse shadow-sm flex items-center justify-center w-fit pointer-events-auto cursor-pointer">${count} Unpaired</button>`;
                pendingDiv.classList.remove('hidden');
                pendingDiv.classList.add('flex');
            } else {
                pendingDiv.classList.add('hidden');
                pendingDiv.classList.remove('flex');
            }
        }
    }
});
}

// Update Live Tracker
const liveBadgeBtn = document.getElementById('liveUnpairedBtn');
const liveBadgeCount = document.getElementById('liveUnpairedCount');
if (liveBadgeBtn && liveBadgeCount) {
if (count > 0) {
    liveBadgeCount.innerText = `${count} Unpaired`;
    liveBadgeBtn.classList.remove('hidden');
    liveBadgeBtn.classList.add('flex');
} else {
    liveBadgeBtn.classList.add('hidden');
    liveBadgeBtn.classList.remove('flex');
}
}

// Update Manual Pairing View
const manualBadge = document.getElementById('manualPairingUnpairedCount');
if (manualBadge) {
if (count > 0) {
    manualBadge.innerText = `${count} Unpaired`;
    manualBadge.classList.remove('hidden');
    manualBadge.classList.add('flex');
} else {
    manualBadge.classList.add('hidden');
    manualBadge.classList.remove('flex');
}
}
}

// --- UNIVERSAL LONG PRESS LOGIC ---

function uiBindLongPress(element, callback) {
let pressTimer = null;
let startX = 0, startY = 0;
let hasFired = false;

const clearTimer = () => {
 if (pressTimer !== null) {
     clearTimeout(pressTimer);
     pressTimer = null;
 }
};

const handleStart = (e) => {
 if (e.button !== undefined && e.button !== 0) return; // Ignore right-click/middle-click
 
 hasFired = false;
 if (e.touches && e.touches.length > 0) {
     startX = e.touches[0].clientX;
     startY = e.touches[0].clientY;
 } else {
     startX = e.clientX;
     startY = e.clientY;
 }
 
 pressTimer = setTimeout(() => {
     hasFired = true;
     callback();
     // Force visual reset on the element just in case it got stuck in active state
     element.classList.remove('active:scale-95');
     setTimeout(() => element.classList.add('active:scale-95'), 100);
 }, 500); // 500ms threshold
};

const handleMove = (e) => {
 if (!pressTimer) return;
 let currentX, currentY;
 
 if (e.touches && e.touches.length > 0) {
     currentX = e.touches[0].clientX;
     currentY = e.touches[0].clientY;
 } else {
     currentX = e.clientX;
     currentY = e.clientY;
 }
 
 // Cancel if moved more than 10px
 if (Math.abs(currentX - startX) > 10 || Math.abs(currentY - startY) > 10) {
     clearTimer();
 }
};

const handleEnd = (e) => {
 clearTimer();
 // Optional: If you want to swallow the click event immediately following a long press
 if (hasFired) {
     e.preventDefault();
     e.stopPropagation();
 }
};

element.addEventListener('touchstart', handleStart, {passive: false});
element.addEventListener('touchmove', handleMove, {passive: false});
element.addEventListener('touchend', handleEnd);
element.addEventListener('touchcancel', handleEnd);

// Also attach Context Menu event for desktop right-click as fallback/alternative
element.addEventListener('contextmenu', (e) => {
 e.preventDefault();
 e.stopPropagation();
 callback();
});
}

function showPersonInfo(personObj) {
if (window.navigator && window.navigator.vibrate) {
 try { window.navigator.vibrate(50); } catch(e){}
}

if (!personObj) return;

let format = (window.appSettings && window.appSettings.popupFormat) ? window.appSettings.popupFormat : DEF_POPUP_FORMAT;

const dataDict = {};
dataDict['name'] = personObj.name || '';
dataDict['group'] = personObj.group || '';
dataDict['meetingloc'] = personObj.meetingLoc || '';
dataDict['dismissalloc'] = personObj.dismissalLoc || '';
dataDict['volpaired'] = personObj.volPaired || '';
dataDict['caregivers'] = personObj.caregivers || '0';

if (personObj.extra) {
 for (const [key, val] of Object.entries(personObj.extra)) {
     dataDict[key.toLowerCase().replace(/[^a-z0-9]/g, "")] = val || '';
 }
}

const formattedText = format.replace(/\{\{([^}]+)\}\}/g, (match, p1) => {
 const cleanKey = p1.toLowerCase().replace(/[^a-z0-9]/g, "");
 return dataDict[cleanKey] !== undefined && dataDict[cleanKey] !== null && dataDict[cleanKey] !== "" 
     ? dataDict[cleanKey] 
     : "-";
});

const infoContent = document.getElementById('personInfoContent');
if(infoContent) infoContent.textContent = formattedText;
const infoModal = document.getElementById('personInfoModal');
if(infoModal) infoModal.classList.remove('hidden');
}

function closePersonInfoModal() {
const infoModal = document.getElementById('personInfoModal');
if(infoModal) infoModal.classList.add('hidden');
}