function showView(viewId) { 
currentActiveView = viewId; 
document.querySelectorAll('main > div').forEach(div => div.classList.add('hidden')); 
const viewElement = document.getElementById('view-' + viewId);
if (viewElement) viewElement.classList.remove('hidden'); 

['volFormStatus', 'scrubStatus', 'commGlobalStatus', 'settingsStatus', 'pairingGlobalStatus'].forEach(id => {
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
titleEl.className = 'text-base md:text-lg font-extrabold text-blue-600 dark:text-blue-400 leading-tight break-words whitespace-normal';
}
} else if (viewId === 'actual-attendance') {
if(titleEl) {
titleEl.innerText = 'Select Event for Tracker';
titleEl.className = 'text-base md:text-lg font-extrabold text-teal-600 dark:text-teal-400 leading-tight break-words whitespace-normal';
}
} else if (viewId === 'comm-attendance') {
// Title is updated dynamically in loadCommAttendanceData
if(titleEl) titleEl.className = 'text-base md:text-lg font-extrabold text-teal-600 dark:text-teal-400 leading-tight break-words whitespace-normal';
if (commAttActions) {
commAttActions.classList.remove('hidden');
commAttActions.classList.add('flex');
}
} else if (viewId === 'manual-pairing') {
// Title is updated dynamically in loadManualPairingData
if(titleEl) titleEl.className = 'text-base md:text-lg font-extrabold text-blue-600 dark:text-blue-400 leading-tight break-words whitespace-normal';
if (manualPairingActions) {
manualPairingActions.classList.remove('hidden');
manualPairingActions.classList.add('flex');
}
} else if (viewId === 'manual-grouping') {
// Title is updated dynamically in loadGroupingData
if(titleEl) titleEl.className = 'text-base md:text-lg font-extrabold text-orange-600 dark:text-orange-400 leading-tight break-words whitespace-normal';
if (manualGroupingActions) {
manualGroupingActions.classList.remove('hidden');
manualGroupingActions.classList.add('flex');
}
} else if (viewId === 'volunteer') {
if(titleEl) {
titleEl.innerText = 'Attendance Update';
titleEl.className = 'text-base md:text-lg font-extrabold text-green-600 dark:text-green-400 leading-tight break-words whitespace-normal';
}
} else if (viewId === 'settings') {
if(titleEl) {
titleEl.innerText = 'Field Configuration';
titleEl.className = 'text-base md:text-lg font-extrabold text-purple-600 dark:text-purple-400 leading-tight break-words whitespace-normal';
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
if (window.currentSheetList && window.currentSheetList.length === 1) {
showView('landing');
} else {
showView('actual-attendance');
}
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

function togglePasswordVisibility(inputId) {
const input = document.getElementById(inputId);
const icon = document.getElementById(inputId + 'Icon');
if(input.type === 'password') {
input.type = 'text';
icon.classList.remove('fa-eye');
icon.classList.add('fa-eye-slash');
} else {
input.type = 'password';
icon.classList.remove('fa-eye-slash');
icon.classList.add('fa-eye');
}
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
if (hasFired) {
if (e.cancelable) e.preventDefault();
e.stopPropagation();

// Block the next click event that normally fires after touch ends
const preventClick = (clickEvent) => {
    clickEvent.preventDefault();
    clickEvent.stopPropagation();
    element.removeEventListener('click', preventClick, true);
};
element.addEventListener('click', preventClick, true);
setTimeout(() => element.removeEventListener('click', preventClick, true), 300);
}
};

// Set passive to true to prevent scroll blocking on mobile devices, vastly improving UI performance
element.addEventListener('touchstart', handleStart, {passive: true});
element.addEventListener('touchmove', handleMove, {passive: true});
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

const ex = personObj.extra || {};
const role = personObj.role || ex.role || 'TRAINEE';
let htmlContent = "";

const nameStr = personObj.name || '-';
const groupNum = personObj.group || ex.v_group || '';
const groupBadge = groupNum 
? `<span class="bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800 border px-2 py-0.5 rounded font-black text-xs uppercase shadow-sm">Grp ${groupNum}</span>` 
: `<span class="bg-gray-100 text-gray-500 border-gray-200 dark:bg-zinc-800 dark:text-gray-400 dark:border-zinc-700 border px-2 py-0.5 rounded font-black text-xs uppercase shadow-sm">Unassigned</span>`;

const roleBadge = role === 'TRAINEE' 
? `<span class="bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 px-1.5 py-0.5 rounded text-[10px] uppercase font-black tracking-wider shadow-sm">Trainee</span>`
: `<span class="bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800 px-1.5 py-0.5 rounded text-[10px] uppercase font-black tracking-wider shadow-sm">Volunteer</span>`;

let detailsHtml = "";
let remarks = ex.remark || '-';

if (role === 'TRAINEE') {
const meetArr = ex.t_meet || '-';
const meetFetch = ex.t_meet_fetching || '-';
const disArr = ex.t_dismiss || '-';
const disFetch = ex.t_dismiss_fetching || '-';
const volPaired = personObj.volPaired || ex.t_paired_vol || '-';
const dietary = ex.t_dietary || '-';
const cgContact = ex.m_cg_contact || '-';

detailsHtml += `
  <div class="space-y-3 mt-4 text-sm text-gray-700 dark:text-gray-300">
      <div class="flex items-start gap-3 bg-gray-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800">
          <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 shrink-0 mt-0.5"><i class="fa-solid fa-location-dot"></i></div>
          <div class="flex-1 min-w-0">
              <div class="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-0.5">Meeting</div>
              <div class="font-medium text-gray-900 dark:text-white break-words whitespace-pre-wrap">${meetArr}</div>
              ${meetFetch !== '-' && meetFetch !== '' ? `<div class="text-[11px] text-gray-500 break-words whitespace-pre-wrap mt-1"><i class="fa-solid fa-car-side mr-1 opacity-70"></i>Fetch: ${meetFetch}</div>` : ''}
          </div>
      </div>

      <div class="flex items-start gap-3 bg-gray-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800">
          <div class="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-500 shrink-0 mt-0.5"><i class="fa-solid fa-flag-checkered"></i></div>
          <div class="flex-1 min-w-0">
              <div class="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-0.5">Dismissal</div>
              <div class="font-medium text-gray-900 dark:text-white break-words whitespace-pre-wrap">${disArr}</div>
              ${disFetch !== '-' && disFetch !== '' ? `<div class="text-[11px] text-gray-500 break-words whitespace-pre-wrap mt-1"><i class="fa-solid fa-car-side mr-1 opacity-70"></i>Fetch: ${disFetch}</div>` : ''}
          </div>
      </div>

      <div class="flex items-start gap-3 bg-gray-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800">
          <div class="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-500 shrink-0 mt-0.5"><i class="fa-solid fa-handshake-angle"></i></div>
          <div class="flex-1 min-w-0">
              <div class="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-0.5">Paired Vol(s)</div>
              <div class="font-bold text-teal-700 dark:text-teal-400 break-words whitespace-pre-wrap">${volPaired}</div>
          </div>
      </div>

      <div class="flex items-start gap-3 bg-gray-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800">
          <div class="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 shrink-0 mt-0.5"><i class="fa-solid fa-utensils"></i></div>
          <div class="flex-1 min-w-0">
              <div class="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-0.5">Dietary Restrictions</div>
              <div class="font-medium text-gray-900 dark:text-white break-words whitespace-pre-wrap">${dietary}</div>
          </div>
      </div>

      <div class="flex items-start gap-3 bg-gray-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800">
          <div class="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-500 shrink-0 mt-0.5"><i class="fa-solid fa-phone"></i></div>
          <div class="flex-1 min-w-0">
              <div class="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-0.5">CG Contact</div>
              <div class="font-medium text-gray-900 dark:text-white break-words whitespace-pre-wrap">${cgContact}</div>
          </div>
      </div>
  </div>
`;
} else if (role === 'VOLUNTEER') {
const meet = ex.v_meet || '-';
const dismiss = ex.v_dismiss || '-';
const pairedTrainees = ex.v_paired_trainee || '-';

detailsHtml += `
  <div class="space-y-3 mt-4 text-sm text-gray-700 dark:text-gray-300">
      <div class="flex items-start gap-3 bg-gray-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800">
          <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 shrink-0 mt-0.5"><i class="fa-solid fa-location-dot"></i></div>
          <div class="flex-1 min-w-0">
              <div class="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-0.5">Meeting</div>
              <div class="font-medium text-gray-900 dark:text-white break-words whitespace-pre-wrap">${meet}</div>
          </div>
      </div>

      <div class="flex items-start gap-3 bg-gray-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800">
          <div class="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-500 shrink-0 mt-0.5"><i class="fa-solid fa-flag-checkered"></i></div>
          <div class="flex-1 min-w-0">
              <div class="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-0.5">Dismissal</div>
              <div class="font-medium text-gray-900 dark:text-white break-words whitespace-pre-wrap">${dismiss}</div>
          </div>
      </div>

      <div class="flex items-start gap-3 bg-gray-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800">
          <div class="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-500 shrink-0 mt-0.5"><i class="fa-solid fa-user-group"></i></div>
          <div class="flex-1 min-w-0">
              <div class="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-0.5">Paired Trainee(s)</div>
              <div class="font-bold text-teal-700 dark:text-teal-400 break-words whitespace-pre-wrap">${pairedTrainees}</div>
          </div>
      </div>
  </div>
`;
}

let remarksHtml = "";
if (remarks && remarks !== '-' && remarks.trim() !== '') {
remarksHtml = `
  <div class="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 border-l-4 border-l-yellow-400 dark:border-l-yellow-500 p-3 rounded-r-lg shadow-sm">
      <div class="flex items-center gap-2 mb-1">
          <i class="fa-solid fa-triangle-exclamation text-yellow-600 dark:text-yellow-500 text-sm"></i>
          <span class="font-black text-yellow-800 dark:text-yellow-400 text-[10px] uppercase tracking-wider">Remarks</span>
      </div>
      <p class="text-yellow-900 dark:text-yellow-100 text-sm whitespace-pre-wrap font-medium leading-relaxed">${remarks}</p>
  </div>
`;
}

htmlContent = `
<div class="flex flex-col gap-2 pb-2">
  <div class="flex items-start justify-between gap-2">
      <h4 class="text-lg md:text-xl font-black text-gray-900 dark:text-white break-words leading-tight flex-1">${nameStr}</h4>
      <div class="shrink-0 mt-0.5">${roleBadge}</div>
  </div>
  <div class="flex items-center">${groupBadge}</div>
</div>
${remarksHtml}
${detailsHtml}
`;

const infoContent = document.getElementById('personInfoContent');
if(infoContent) {
infoContent.className = "w-full"; // Clear out pre-wrap/mono text utility classes
infoContent.innerHTML = htmlContent;
}

const infoModal = document.getElementById('personInfoModal');
if(infoModal) infoModal.classList.remove('hidden');
}

function closePersonInfoModal() {
const infoModal = document.getElementById('personInfoModal');
if(infoModal) infoModal.classList.add('hidden');
}