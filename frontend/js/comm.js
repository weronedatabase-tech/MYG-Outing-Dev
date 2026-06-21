let currentCommAttSheetUrl = null;
let commAttData = { participants: [], junctures: [], attendance: { '__GONE_HOME__': {} } };
let commAttState = {
   currentJuncture: null,
   selectedGroups: [],
   selectedMeets: [],
   selectedDismissals: []
}; 
let pendingCommAttUpdates = {};
let isCommAttSyncing = false;
let commAttSyncTimeout = null;
let commAttPollInterval = null;
let commAttFiltersChanged = false;

function hasPendingUpdates() {
for(let junc in pendingCommAttUpdates) {
  if(Object.keys(pendingCommAttUpdates[junc]).length > 0) return true;
}
return false;
}

function loadSheets(viewId) {
let selectorId, loadingId;
if (viewId === 'comm') { 
selectorId = 'commSheetSelector'; 
loadingId = 'commSheetSpinner'; 
} else if (viewId === 'actual-attendance') {
selectorId = 'actualSheetSelector'; 
loadingId = 'actualSheetSpinner'; 
} else { 
selectorId = 'volSheetSelector'; 
loadingId = 'volSheetSpinner'; 
}

const selector = document.getElementById(selectorId);
const spinner = document.getElementById(loadingId);
const listContainer = document.getElementById('upcomingList');

selector.innerHTML = '<option disabled selected>↻ Searching events...</option>';
selector.disabled = true;
if(spinner) spinner.classList.remove('hidden');
if(viewId === 'comm' && listContainer) listContainer.innerHTML = '<p class="text-xs italic"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading events...</p>';

apiCall('getRecentOutingSheets', null).then(res => {
if(spinner) spinner.classList.add('hidden');
selector.disabled = false;
selector.innerHTML = '';

if (res.success) {
    if(viewId === 'comm' && listContainer) {
        listContainer.innerHTML = '';
        outingReminders = {}; 
        if(res.data.length > 0) {
            let allCards = '';
            res.data.forEach((item, index) => {
                allCards += `
                <div class="flex flex-col gap-2 p-4 bg-slate-700/50 rounded-xl border border-slate-600 shadow-md relative">
                   <div class="flex justify-between items-start">
                     <div><div class="font-bold text-white text-sm">${item.displayName}</div><div class="text-slate-400 text-xs">${item.formattedDate}</div></div>
                     <div class="flex gap-2 text-xs"><a href="${item.folderUrl}" target="_blank" class="text-blue-400 hover:text-blue-300"><i class="fa-regular fa-folder-open"></i></a><a href="${item.sheetUrl}" target="_blank" class="text-green-400 hover:text-green-300"><i class="fa-regular fa-file-excel"></i></a></div>
                   </div>
                   <div id="stats-${index}" class="text-xs text-slate-500 animate-pulse mt-2">Loading stats...</div>
                   <div id="btn-group-${index}" class="hidden flex gap-2 mt-2 pt-2 border-t border-slate-600/50">
                       <button onclick="openReminderModal('${index}')" class="flex-1 bg-slate-800 hover:bg-slate-600 text-slate-300 text-xs py-2 px-3 rounded border border-slate-600 transition-colors"><i class="fa-regular fa-message mr-1"></i> Reminder Message</button>
                       <button onclick="copyReminderDirect('${index}', this)" class="bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white text-xs py-2 px-3 rounded border border-slate-600 transition-colors"><i class="fa-regular fa-copy"></i></button>
                   </div>
                </div>`;
            });
            listContainer.innerHTML = allCards;
            res.data.forEach((item, index) => fetchOutingStats(item.sheetUrl, index));
        } else {
            listContainer.innerHTML = '<p class="text-xs text-slate-500 italic">No upcoming outings found.</p>';
        }
    }
    if(res.data.length > 0) {
        currentSheetList = res.data;
        res.data.forEach(item => {
            let opt = document.createElement('option');
            opt.value = item.sheetUrl;
            opt.text = item.displayName;
            selector.appendChild(opt);
        });
        selector.selectedIndex = 0;
        
        if(viewId === 'volunteer') {
            resetVolForm();
        } else if (viewId === 'actual-attendance' && res.data.length === 1) {
            setTimeout(() => openLiveAttendance(), 100);
        }
    } else {
        selector.innerHTML = '<option disabled selected>No upcoming events</option>';
    }
} else {
    selector.innerHTML = `<option disabled selected>Error: ${res.message}</option>`;
    if(viewId === 'comm' && listContainer) {
        listContainer.innerHTML = `<p class="text-xs text-red-500 italic font-bold">Failed to load events: ${res.message}</p>`;
    }
}
});
}

function fetchOutingStats(url, index) {
apiCall('getOutingDetails', url).then(res => {
const container = document.getElementById(`stats-${index}`);
const btnGroup = document.getElementById(`btn-group-${index}`);
if(res.success) {
    let html = '<table class="w-full text-[10px] text-left border-collapse"><tr class="text-slate-400 border-b border-slate-600"><th>Proj</th><th class="text-center">Trainees</th><th class="text-center">CG</th><th class="text-center">Vols</th></tr>';
    const sortedKeys = Object.keys(res.stats).sort();
    if(sortedKeys.length === 0) {
        html += '<tr><td colspan="4" class="text-center py-2 text-slate-500 italic">No data yet</td></tr>';
    } else {
        for(const proj of sortedKeys) {
            const d = res.stats[proj];
            html += `<tr class="border-b border-slate-600/50 last:border-0"><td class="py-1 font-bold text-slate-300">${proj}</td><td class="text-center text-slate-400"><span class="text-white">${d.tY}</span>/${d.tTot}</td><td class="text-center text-slate-400 text-white">${d.cY}</td><td class="text-center text-slate-400"><span class="text-white">${d.vY}</span>/${d.vTot}</td></tr>`;
        }
    }
    html += '</table>';
    container.innerHTML = html;
    container.classList.remove('animate-pulse');
    
    let msg = "";
    if(res.pending && res.pending.length > 0) {
        const list = res.pending.join('\n');
        msg = `Hello👋, gentle reminder for volunteers of these trainees to update their attendance by tomorrow:\n${list}\n\nVolunteers please update your own attendance as well, Thank You!!🙏`;
    } else {
        msg = "Great news! All trainees have updated their attendance.\n\nVolunteers please ensure your own attendance is updated too, Thank You!!🙏";
    }
    outingReminders[index] = msg;
    if(btnGroup) btnGroup.classList.remove('hidden');
} else {
    container.innerHTML = '<span class="text-red-400">Error loading stats</span>';
}
});
}

function openReminderModal(index) {
const msg = outingReminders[index];
if(!msg) return;
document.getElementById('modalReminderText').value = msg;
document.getElementById('reminderModal').classList.remove('hidden');
}

function closeReminderModal() { document.getElementById('reminderModal').classList.add('hidden'); }
function copyFromModal(btn) { performCopy(document.getElementById('modalReminderText').value, btn); }
function copyReminderDirect(index, btn) { performCopy(outingReminders[index], btn); }

function performCopy(text, btn) {
navigator.clipboard.writeText(text).then(() => {
const original = btn.innerHTML;
btn.innerHTML = '<i class="fa-solid fa-check"></i>';
btn.classList.add('text-green-400', 'border-green-500');
setTimeout(() => {
    btn.innerHTML = original;
    btn.classList.remove('text-green-400', 'border-green-500');
}, 2000);
});
}

function handlePair() { 
const url = document.getElementById('commSheetSelector').value; 
const btn = document.getElementById('scrubBtn'); 
const status = document.getElementById('scrubStatus'); 
if(!url || url.includes("Select") || url.includes("Loading") || url.includes("Error")) return alert("Select an event first"); 
btn.disabled = true; 
btn.innerText = "Pairing..."; 
status.classList.add('hidden'); 
apiCall('runAutoPairing', url).then(res => { 
btn.disabled = false; 
btn.innerText = "Pair Now"; 
showFlashMessage('scrubStatus', res.message, res.success ? 'success' : 'error'); 
}); 
}

function handleGroup() { 
const url = document.getElementById('commSheetSelector').value; 
const btn = document.getElementById('groupBtn'); 
if(!url || url.includes("Select") || url.includes("Loading") || url.includes("Error")) return alert("Select an event first"); 
btn.disabled = true; 
btn.innerText = "Grouping..."; 
apiCall('runAutoGrouping', url).then(res => { 
btn.disabled = false; 
btn.innerText = "Group Now"; 
showFlashMessage('scrubStatus', res.message, res.success ? 'success' : 'error'); 
}); 
}

function openModal() { 
const modal = document.getElementById('createModal'); 
const modalPanel = document.getElementById('modalPanel');
modal.classList.remove('hidden'); 
setTimeout(() => { 
modal.classList.remove('opacity-0'); 
modalPanel.classList.remove('scale-95'); 
modalPanel.classList.add('scale-100'); 
}, 10); 
} 

function closeModal() { 
const modal = document.getElementById('createModal'); 
const modalPanel = document.getElementById('modalPanel');
modal.classList.add('opacity-0'); 
modalPanel.classList.remove('scale-100'); 
modalPanel.classList.add('scale-95'); 
setTimeout(() => { 
modal.classList.add('hidden'); 
}, 300); 
} 

function handleCreate(e) { 
e.preventDefault(); 
showOverlay('loading', 'Creating Outing...');

const form = document.getElementById('outingForm'); 
const formData = { 
eventName: document.getElementById('eventName').value, 
eventDate: document.getElementById('eventDate').value, 
meetingLocs: Array.from(document.getElementsByName('meetingLoc')).map(i=>i.value), 
meetingTimes: Array.from(document.getElementsByName('meetingTime')).map(i=>i.value), 
dismissalLocs: Array.from(document.getElementsByName('dismissalLoc')).map(i=>i.value), 
dismissalTimes: Array.from(document.getElementsByName('dismissalTime')).map(i=>i.value), 
}; 

apiCall('createOuting', formData).then(res => { 
if(res.success) { 
    showOverlay('success', 'Outing Created Successfully!');
    closeModal(); 
    loadSheets('comm'); 
    showFlashMessage('commGlobalStatus', "Outing Created Successfully!", 'success');
} else { 
    showOverlay('error', res.message);
} 
}); 
}

function openLiveAttendance() {
const selector = document.getElementById('actualSheetSelector');
const url = selector.value;
if(!url || url.includes("Select") || url.includes("Loading") || url.includes("Error")) return alert("Select an event first");

currentCommAttSheetUrl = url;
document.getElementById('navContextTitle').innerText = "Live: " + selector.options[selector.selectedIndex].text;

showView('comm-attendance');
loadCommAttendanceData();
}

function loadCommAttendanceData() {
const overlay = document.getElementById('commAttLoadingOverlay');
overlay.classList.remove('hidden');

apiCall('fetchCommAttendance', { sheetUrl: currentCommAttSheetUrl }).then(res => {
 overlay.classList.add('hidden');
 if (res.success) {
     commAttData = res;
     if(!commAttData.attendance['__GONE_HOME__']) commAttData.attendance['__GONE_HOME__'] = {};
     renderCommAttFilters();
     renderCommAttJunctures();
     startCommAttPolling();
 } else {
     alert("Error: " + res.message);
     showView('actual-attendance');
 }
});
}

function renderCommAttFilters() {
let groups = new Set();
let meets = new Set();
let dismissals = new Set();

(commAttData.participants || []).forEach(p => {
  if (p.group) groups.add(String(p.group));
  if (p.meetingLoc) meets.add(String(p.meetingLoc));
  if (p.dismissalLoc) dismissals.add(String(p.dismissalLoc));
});

const sortedGroups = Array.from(groups).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
const sortedMeets = Array.from(meets).sort();
const sortedDismissals = Array.from(dismissals).sort();

commAttState.availableGroups = sortedGroups;
commAttState.availableMeets = sortedMeets;
commAttState.availableDismissals = sortedDismissals;

updateCommAttFilterUI('group', sortedGroups, commAttState.selectedGroups);
updateCommAttFilterUI('meet', sortedMeets, commAttState.selectedMeets);
updateCommAttFilterUI('dismiss', sortedDismissals, commAttState.selectedDismissals);
}

function updateCommAttFilterUI(type, availableItems, selectedArray) {
   const btnId = type === 'group' ? 'commAttGroupBtn' : (type === 'meet' ? 'commAttMeetBtn' : 'commAttDismissBtn');
   const dropdownId = type === 'group' ? 'commAttGroupDropdown' : (type === 'meet' ? 'commAttMeetDropdown' : 'commAttDismissDropdown');
   const btn = document.getElementById(btnId);
   const dropdown = document.getElementById(dropdownId);
   
   if(!btn || !dropdown) return;

   let btnText = type === 'group' ? 'Grp: ' : (type === 'meet' ? 'Meet: ' : 'Dis: ');
   
   if (selectedArray.length === 0) {
       btnText += 'All';
       btn.classList.remove('ring-1', 'ring-white');
   } else {
       btnText += `(${selectedArray.length})`;
       btn.classList.add('ring-1', 'ring-white');
   }
   
   btn.innerText = btnText;

   let html = `<div class="p-1.5 flex justify-between border-b border-slate-700 bg-slate-900 sticky top-0 z-10">
       <button onclick="clearCommAttFilter('${type}', event)" class="text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition">Clear</button>
       <button onclick="closeAllCommAttFilters(event)" class="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded transition">Done</button>
   </div>`;

   if (availableItems.length === 0) {
       html += `<div class="p-2 text-center text-xs text-slate-500 italic">No options</div>`;
   } else {
       availableItems.forEach(item => {
           const isChecked = selectedArray.includes(item);
           html += `
           <div class="px-3 py-2 border-b border-slate-700 last:border-0 hover:bg-slate-700 cursor-pointer flex items-center justify-between transition-colors" onclick="toggleCommAttFilterItem('${type}', '${item.replace(/'/g, "\\'")}', event)">
               <span class="text-xs text-slate-300 font-bold break-words pr-2">${type === 'group' ? 'Grp ' + item : item}</span>
               <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isChecked ? 'bg-blue-500 border-blue-600 text-white' : 'bg-slate-900 border-slate-600 text-transparent'}">
                   <i class="fa-solid fa-check text-[10px]"></i>
               </div>
           </div>`;
       });
   }

   // Preserve the exact scroll position to prevent snapping to top when selecting items
   const scrollTop = dropdown.scrollTop;
   dropdown.innerHTML = html;
   dropdown.scrollTop = scrollTop;
}

function toggleCommAttFilter(type) {
   const dropdownId = type === 'group' ? 'commAttGroupDropdown' : (type === 'meet' ? 'commAttMeetDropdown' : 'commAttDismissDropdown');
   const dropdown = document.getElementById(dropdownId);
   
   const wasHidden = dropdown.classList.contains('hidden');
   
   closeAllCommAttFilters();
   
   if (wasHidden) {
       dropdown.classList.remove('hidden');
   }
}

function closeAllCommAttFilters(e) {
   if (e) e.stopPropagation();
   ['commAttGroupDropdown', 'commAttMeetDropdown', 'commAttDismissDropdown'].forEach(id => {
       const el = document.getElementById(id);
       if(el) el.classList.add('hidden');
   });
   
   if (commAttFiltersChanged) {
       changeCommAttContext();
       commAttFiltersChanged = false;
   }
}

// Click-away listener for dropdowns
document.addEventListener('click', function(e) {
   const isDropdownClick = e.target.closest('#commAttGroupDropdown') || 
                           e.target.closest('#commAttMeetDropdown') || 
                           e.target.closest('#commAttDismissDropdown');
   
   const isBtnClick = e.target.closest('#commAttGroupBtn') || 
                      e.target.closest('#commAttMeetBtn') || 
                      e.target.closest('#commAttDismissBtn');

   if (!isDropdownClick && !isBtnClick) {
       closeAllCommAttFilters();
   }
});

function toggleCommAttFilterItem(type, item, e) {
   if (e) e.stopPropagation();
   
   let targetArray = type === 'group' ? commAttState.selectedGroups : (type === 'meet' ? commAttState.selectedMeets : commAttState.selectedDismissals);
   const available = type === 'group' ? commAttState.availableGroups : (type === 'meet' ? commAttState.availableMeets : commAttState.availableDismissals);

   const index = targetArray.indexOf(item);
   if (index > -1) {
       targetArray.splice(index, 1);
   } else {
       targetArray.push(item);
   }

   commAttFiltersChanged = true;
   updateCommAttFilterUI(type, available, targetArray);
}

function clearCommAttFilter(type, e) {
   if (e) e.stopPropagation();

   if (type === 'group') commAttState.selectedGroups = [];
   if (type === 'meet') commAttState.selectedMeets = [];
   if (type === 'dismiss') commAttState.selectedDismissals = [];

   const available = type === 'group' ? commAttState.availableGroups : (type === 'meet' ? commAttState.availableMeets : commAttState.availableDismissals);
   
   commAttFiltersChanged = true;
   updateCommAttFilterUI(type, available, []);
}

function renderCommAttJunctures() {
const select = document.getElementById('commAttJunctureSelect');
select.innerHTML = '';
if (commAttData.junctures.length === 0) {
 select.innerHTML = '<option value="">No Junctures Defined</option>';
} else {
 commAttData.junctures.forEach(j => {
     select.innerHTML += `<option value="${j}">${j}</option>`;
 });
}

if (commAttState.currentJuncture && commAttData.junctures.includes(commAttState.currentJuncture)) {
 select.value = commAttState.currentJuncture;
}

changeCommAttContext();
}

function changeCommAttContext() {
const juncture = document.getElementById('commAttJunctureSelect').value;
commAttState.currentJuncture = juncture;

renderCommAttLists();
}

function renderCommAttLists() {
const notCheckedList = document.getElementById('commAttNotCheckedList');
const checkedList = document.getElementById('commAttCheckedList');
const goneHomeList = document.getElementById('commAttGoneHomeList');

if (!notCheckedList || !checkedList || !goneHomeList) return;

// Save current scroll positions to prevent jumping
const scrollNC = notCheckedList.scrollTop;
const scrollC = checkedList.scrollTop;
const scrollGH = goneHomeList.scrollTop;

const juncture = commAttState.currentJuncture;

let notCheckedHtml = '';
let checkedHtml = '';
let goneHomeHtml = '';
let notCheckedCount = 0;
let checkedCount = 0;
let goneHomeCount = 0;

let participants = commAttData.participants || [];
participants.sort((a, b) => a.name.localeCompare(b.name));

if (commAttState.selectedGroups.length > 0) {
   participants = participants.filter(p => commAttState.selectedGroups.includes(String(p.group)));
}
if (commAttState.selectedMeets.length > 0) {
   participants = participants.filter(p => commAttState.selectedMeets.includes(String(p.meetingLoc)));
}
if (commAttState.selectedDismissals.length > 0) {
   participants = participants.filter(p => commAttState.selectedDismissals.includes(String(p.dismissalLoc)));
}

participants.forEach(p => {
 const isGoneHome = commAttData.attendance['__GONE_HOME__'] && commAttData.attendance['__GONE_HOME__'][p.name] === true;
 const isChecked = juncture && commAttData.attendance[juncture] ? commAttData.attendance[juncture][p.name] === true : false;
 
 const cardHtml = generateCommAttCard(p, isChecked, isGoneHome);
 
 if (isGoneHome) {
     goneHomeHtml += cardHtml;
     goneHomeCount++;
 } else if (isChecked) {
     checkedHtml += cardHtml;
     checkedCount++;
 } else {
     notCheckedHtml += cardHtml;
     notCheckedCount++;
 }
});

notCheckedList.innerHTML = notCheckedHtml || '<p class="text-[10px] text-slate-500 font-bold p-2 text-center mt-2">Empty</p>';
checkedList.innerHTML = checkedHtml || '<p class="text-[10px] text-slate-500 font-bold p-2 text-center mt-2">Empty</p>';
goneHomeList.innerHTML = goneHomeHtml || '<p class="text-[10px] text-slate-500 font-bold p-2 text-center mt-2">Empty</p>';

document.getElementById('commAttNotCheckedCount').textContent = notCheckedCount;
document.getElementById('commAttCheckedCount').textContent = checkedCount;
document.getElementById('commAttGoneHomeCount').textContent = goneHomeCount;

// Restore scroll positions
notCheckedList.scrollTop = scrollNC;
checkedList.scrollTop = scrollC;
goneHomeList.scrollTop = scrollGH;
}

function generateCommAttCard(p, isChecked, isGoneHome) {
const safeName = p.name.replace(/'/g, "\\'");

const caregiverBadge = p.caregivers > 0 ? `<span class="inline-flex shrink-0 items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-[9px] font-black text-white shadow-sm mt-px" title="${p.caregivers} Caregiver(s)">${p.caregivers > 1 ? p.caregivers + 'C' : 'C'}</span>` : '';

let volHtml = '';
if (p.volPaired) {
 const vols = p.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
 if (vols.length > 0) {
     volHtml = vols.map(v => `<span class="text-[9px] text-teal-400 leading-tight font-bold bg-teal-900/30 px-1.5 py-0.5 rounded border border-teal-800/50 whitespace-normal break-words w-fit max-w-full text-left"><i class="fa-solid fa-handshake-angle mr-1"></i>${v}</span>`).join('');
 }
}

let locHtml = '';
if (p.meetingLoc || p.dismissalLoc) {
 locHtml = '<div class="flex flex-col gap-1 w-full mt-1 border-t border-slate-700/60 pt-1.5">';
 if (p.meetingLoc) {
     locHtml += `<span class="text-[9px] text-blue-300 leading-tight bg-blue-900/20 px-1.5 py-1 rounded whitespace-normal break-words w-full text-left"><i class="fa-solid fa-location-dot mr-1 text-blue-400"></i>Meet: ${p.meetingLoc}</span>`;
 }
 if (p.dismissalLoc) {
     locHtml += `<span class="text-[9px] text-purple-300 leading-tight bg-purple-900/20 px-1.5 py-1 rounded whitespace-normal break-words w-full text-left"><i class="fa-solid fa-flag-checkered mr-1 text-purple-400"></i>Dismiss: ${p.dismissalLoc}</span>`;
 }
 locHtml += '</div>';
}

const groupBadge = p.group ? `<span class="text-[9px] bg-slate-700 text-slate-300 px-1 py-0.5 rounded border border-slate-600 whitespace-nowrap">Grp ${p.group}</span>` : '';

const homeBtnClass = isGoneHome ? 'bg-blue-500 text-white border-blue-600 shadow-inner' : 'bg-slate-700 text-slate-400 border-slate-600 hover:text-blue-400 hover:border-blue-500';
const checkBtnClass = isChecked ? 'bg-green-500 border-green-600 text-white shadow-inner' : 'bg-slate-900 border-slate-600 text-transparent';

return `
<div id="comm-att-card-${p.name.replace(/[^a-zA-Z0-9]/g, '')}" class="relative bg-slate-800 p-2 rounded border border-slate-700 shadow-sm transition-all duration-300 flex flex-col gap-1.5 select-none active:scale-95 cursor-pointer hover:border-teal-500" onclick="toggleCommAttStatus('${safeName}', ${!isChecked}, event)">
 <div class="flex items-start gap-1.5 w-full">
     <span class="font-extrabold text-xs text-white leading-tight break-words">${p.name}</span>
     ${caregiverBadge}
 </div>
 <div class="flex justify-between items-center w-full">
     <div class="shrink-0 flex items-center">
         ${groupBadge}
     </div>
     <div class="shrink-0 flex items-center gap-1.5">
         <button onclick="toggleGoneHomeStatus('${safeName}', ${!isGoneHome}, event)" class="w-6 h-6 rounded flex items-center justify-center border transition-colors ${homeBtnClass}" title="Toggle Gone Home">
             <i class="fa-solid fa-house-user text-[10px]"></i>
         </button>
         <div class="w-6 h-6 rounded flex items-center justify-center border transition-colors ${checkBtnClass}">
             <i class="fa-solid fa-check text-xs"></i>
         </div>
     </div>
 </div>
 ${volHtml ? `<div class="flex flex-col gap-1 w-full">${volHtml}</div>` : ''}
 ${locHtml}
</div>`;
}

function triggerSync() {
if (commAttSyncTimeout) clearTimeout(commAttSyncTimeout);
commAttSyncTimeout = setTimeout(() => {
 executeCommAttSync();
}, 800);
}

function toggleCommAttStatus(name, forceState, e) {
if(e) e.stopPropagation();
const juncture = commAttState.currentJuncture;
if (!juncture) return;

commAttData.attendance[juncture][name] = forceState;
if (!pendingCommAttUpdates[juncture]) pendingCommAttUpdates[juncture] = {};
pendingCommAttUpdates[juncture][name] = forceState;

renderCommAttLists();
triggerCommAttPulse(name, forceState ? 'checked' : 'unchecked');
triggerSync();
}

function toggleGoneHomeStatus(name, forceState, e) {
if(e) e.stopPropagation();
if (!commAttData.attendance['__GONE_HOME__']) commAttData.attendance['__GONE_HOME__'] = {};

commAttData.attendance['__GONE_HOME__'][name] = forceState;
if (!pendingCommAttUpdates['__GONE_HOME__']) pendingCommAttUpdates['__GONE_HOME__'] = {};
pendingCommAttUpdates['__GONE_HOME__'][name] = forceState;

renderCommAttLists();
triggerCommAttPulse(name, forceState ? 'gonehome' : 'unchecked');
triggerSync();
}

function triggerCommAttPulse(name, stateType) {
setTimeout(() => {
 const id = `comm-att-card-${name.replace(/[^a-zA-Z0-9]/g, '')}`;
 const card = document.getElementById(id);
 if (card) {
     // Precision scroll targeting ONLY the column container instead of scrolling the whole document
     const container = card.parentElement;
     if (container) {
         const containerRect = container.getBoundingClientRect();
         const cardRect = card.getBoundingClientRect();
         const scrollTop = container.scrollTop + (cardRect.top - containerRect.top) - (containerRect.height / 2) + (cardRect.height / 2);
         
         container.scrollTo({
             top: scrollTop,
             behavior: 'smooth'
         });
     }
     
     let ringColor = 'ring-red-500';
     let bgColor = 'bg-red-900/30';
     
     if (stateType === 'checked') {
         ringColor = 'ring-green-500';
         bgColor = 'bg-green-900/30';
     } else if (stateType === 'gonehome') {
         ringColor = 'ring-blue-500';
         bgColor = 'bg-blue-900/30';
     }
     
     card.classList.add('ring-1', ringColor, 'scale-[1.02]', bgColor, 'z-10');
     setTimeout(() => {
         card.classList.remove('ring-1', ringColor, 'scale-[1.02]', bgColor, 'z-10');
     }, 800);
 }
}, 50);
}

async function executeCommAttSync() {
if (!hasPendingUpdates()) return;

isCommAttSyncing = true;
setCommAttBtnState('saving');

const payloadUpdates = {};
for (let junc in pendingCommAttUpdates) {
 payloadUpdates[junc] = [];
 for (let name in pendingCommAttUpdates[junc]) {
     payloadUpdates[junc].push({ name: name, status: pendingCommAttUpdates[junc][name] });
 }
}

const batchBackup = JSON.parse(JSON.stringify(pendingCommAttUpdates));
pendingCommAttUpdates = {};

try {
 const res = await apiCall('syncCommAttendance', { sheetUrl: currentCommAttSheetUrl, multipleUpdates: payloadUpdates });
 if (res.success) {
     setCommAttBtnState('saved');
 } else {
     throw new Error(res.message);
 }
} catch (e) {
 console.error(e);
 setCommAttBtnState('error');
 for (let junc in batchBackup) {
     if(!pendingCommAttUpdates[junc]) pendingCommAttUpdates[junc] = {};
     for (let name in batchBackup[junc]) {
         pendingCommAttUpdates[junc][name] = batchBackup[junc][name];
     }
 }
} finally {
 isCommAttSyncing = false;
}
}

function setCommAttBtnState(state) {
const btn = document.getElementById('btn-sync-comm-att');
if (!btn) return;

const textSpan = btn.querySelector('.btn-text');
const spinner = btn.querySelector('.btn-spinner');

btn.className = "text-[10px] px-2 py-0.5 rounded font-bold transition flex items-center border border-slate-600 focus:outline-none";
spinner.classList.add('hidden');

if (state === 'saving') {
 btn.classList.add('bg-yellow-900/50', 'text-yellow-400', 'border-yellow-600');
 textSpan.textContent = "Saving...";
 spinner.classList.remove('hidden');
} else if (state === 'saved') {
 btn.classList.add('bg-green-900/50', 'text-green-400', 'border-green-600');
 textSpan.textContent = "Saved";
 setTimeout(() => {
     if (!hasPendingUpdates()) {
         btn.classList.remove('bg-green-900/50', 'text-green-400', 'border-green-600');
         btn.classList.add('bg-slate-700', 'text-slate-300');
         textSpan.textContent = "Saved";
     }
 }, 2000);
} else if (state === 'error') {
 btn.classList.add('bg-red-900/50', 'text-red-400', 'border-red-600');
 textSpan.textContent = "Error";
}
}

function promptNewCommJuncture() {
const name = prompt("Enter new juncture name (e.g. Morning Assembly):");
if (!name || !name.trim()) return;

const overlay = document.getElementById('commAttLoadingOverlay');
overlay.classList.remove('hidden');

apiCall('addCommJuncture', { sheetUrl: currentCommAttSheetUrl, junctureName: name.trim() }).then(res => {
 overlay.classList.add('hidden');
 if (res.success) {
     commAttData = res;
     if(!commAttData.attendance['__GONE_HOME__']) commAttData.attendance['__GONE_HOME__'] = {};
     commAttState.currentJuncture = name.trim();
     renderCommAttFilters();
     renderCommAttJunctures();
     showFlashMessage('commGlobalStatus', "Juncture added.", 'success');
 } else {
     alert(res.message);
 }
});
}

function promptDeleteCommJuncture() {
const juncture = document.getElementById('commAttJunctureSelect').value;
if (!juncture) return;

if (!confirm(`Are you sure you want to delete the juncture "${juncture}"?`)) return;

const overlay = document.getElementById('commAttLoadingOverlay');
overlay.classList.remove('hidden');

apiCall('deleteCommJuncture', { sheetUrl: currentCommAttSheetUrl, junctureName: juncture }).then(res => {
 overlay.classList.add('hidden');
 if (res.success) {
     commAttData = res;
     if(!commAttData.attendance['__GONE_HOME__']) commAttData.attendance['__GONE_HOME__'] = {};
     commAttState.currentJuncture = null;
     renderCommAttFilters();
     renderCommAttJunctures();
     showFlashMessage('commGlobalStatus', "Juncture deleted.", 'success');
 } else {
     alert(res.message);
 }
});
}

async function manualSyncCommAttendance() {
if (hasPendingUpdates()) {
 await executeCommAttSync();
}

setCommAttBtnState('saving');
const overlay = document.getElementById('commAttLoadingOverlay');
overlay.classList.remove('hidden');

apiCall('fetchCommAttendance', { sheetUrl: currentCommAttSheetUrl }).then(res => {
 overlay.classList.add('hidden');
 if (res.success) {
     commAttData = res;
     if(!commAttData.attendance['__GONE_HOME__']) commAttData.attendance['__GONE_HOME__'] = {};
     renderCommAttFilters();
     renderCommAttLists();
     setCommAttBtnState('saved');
 } else {
     setCommAttBtnState('error');
 }
});
}

function startCommAttPolling() {
if (commAttPollInterval) clearInterval(commAttPollInterval);

commAttPollInterval = setInterval(() => {
 const view = document.getElementById('view-comm-attendance');
 if (view && view.classList.contains('hidden')) return;
 
 if (isCommAttSyncing || hasPendingUpdates()) return;
 
 apiCall('fetchCommAttendance', { sheetUrl: currentCommAttSheetUrl }).then(res => {
     if (res.success && !isCommAttSyncing && !hasPendingUpdates()) {
         const oldJunctures = JSON.stringify(commAttData.junctures);
         const oldParticipants = JSON.stringify(commAttData.participants);
         const oldAttendance = JSON.stringify(commAttData.attendance);

         commAttData = res;
         if(!commAttData.attendance['__GONE_HOME__']) commAttData.attendance['__GONE_HOME__'] = {};
         
         const newJunctures = JSON.stringify(commAttData.junctures);
         const newParticipants = JSON.stringify(commAttData.participants);
         const newAttendance = JSON.stringify(commAttData.attendance);

         // ONLY re-render elements if actual data differences exist to prevent jerking/jumping
         if (oldJunctures !== newJunctures || oldParticipants !== newParticipants) {
             renderCommAttFilters();
             renderCommAttJunctures();
         } else if (oldAttendance !== newAttendance) {
             renderCommAttLists();
         }
     }
 });
}, 8000);
}

function handleCommAttSearch() {
const query = document.getElementById('commAttSearchInput').value.toLowerCase().trim();
const resultsContainer = document.getElementById('commAttSearchResults');

if (!query) {
 resultsContainer.classList.add('hidden');
 return;
}

const juncture = commAttState.currentJuncture;

let participants = commAttData.participants || [];

if (commAttState.selectedGroups.length > 0) {
   participants = participants.filter(p => commAttState.selectedGroups.includes(String(p.group)));
}
if (commAttState.selectedMeets.length > 0) {
   participants = participants.filter(p => commAttState.selectedMeets.includes(String(p.meetingLoc)));
}
if (commAttState.selectedDismissals.length > 0) {
   participants = participants.filter(p => commAttState.selectedDismissals.includes(String(p.dismissalLoc)));
}

const matches = participants.filter(p => 
 p.name.toLowerCase().includes(query) || 
 (p.group && String(p.group).toLowerCase().includes(query)) ||
 (p.volPaired && p.volPaired.toLowerCase().includes(query)) ||
 (p.meetingLoc && p.meetingLoc.toLowerCase().includes(query)) ||
 (p.dismissalLoc && p.dismissalLoc.toLowerCase().includes(query))
);

let html = '';
matches.forEach(p => {
 let isChecked = false;
 if (juncture && commAttData.attendance[juncture]) {
     isChecked = commAttData.attendance[juncture][p.name] === true;
 }
 const isGoneHome = commAttData.attendance['__GONE_HOME__'] && commAttData.attendance['__GONE_HOME__'][p.name] === true;
 const safeName = p.name.replace(/'/g, "\\'");
 
 let statusBadge = '';
 if (isGoneHome) {
     statusBadge = '<span class="text-[9px] bg-blue-900/50 text-blue-400 px-1 py-0.5 rounded font-black uppercase border border-blue-700">Gone Home</span>';
 } else if (isChecked) {
     statusBadge = '<span class="text-[9px] bg-green-900/50 text-green-400 px-1 py-0.5 rounded font-black uppercase border border-green-700">Checked</span>';
 } else {
     statusBadge = '<span class="text-[9px] bg-red-900/50 text-red-400 px-1 py-0.5 rounded font-black uppercase border border-red-700">NOT Checked</span>';
 }
 
 let volHtml = '';
 if (p.volPaired) {
     const vols = p.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
     if (vols.length > 0) {
         volHtml = vols.map(v => `<span class="text-[9px] text-teal-400 leading-tight font-bold bg-teal-900/30 px-1.5 py-0.5 rounded border border-teal-800/50 whitespace-normal break-words w-fit max-w-full text-left"><i class="fa-solid fa-handshake-angle mr-1"></i>${v}</span>`).join('');
     }
 }
 
 let locHtml = '';
 if (p.meetingLoc || p.dismissalLoc) {
     locHtml = '<div class="flex flex-col gap-1 w-full mt-1 border-t border-slate-700/60 pt-1.5">';
     if (p.meetingLoc) {
         locHtml += `<span class="text-[9px] text-blue-300 leading-tight bg-blue-900/20 px-1.5 py-1 rounded whitespace-normal break-words w-full text-left"><i class="fa-solid fa-location-dot mr-1 text-blue-400"></i>Meet: ${p.meetingLoc}</span>`;
     }
     if (p.dismissalLoc) {
         locHtml += `<span class="text-[9px] text-purple-300 leading-tight bg-purple-900/20 px-1.5 py-1 rounded whitespace-normal break-words w-full text-left"><i class="fa-solid fa-flag-checkered mr-1 text-purple-400"></i>Dismiss: ${p.dismissalLoc}</span>`;
     }
     locHtml += '</div>';
 }
 
 const caregiverBadge = p.caregivers > 0 ? `<span class="inline-flex shrink-0 items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-[9px] font-black text-white shadow-sm mt-px" title="${p.caregivers} Caregiver(s)">${p.caregivers > 1 ? p.caregivers + 'C' : 'C'}</span>` : '';
 const groupBadge = p.group ? `<span class="text-[9px] bg-slate-700 text-slate-300 px-1 py-0.5 rounded border border-slate-600 whitespace-nowrap">Grp ${p.group}</span>` : '';
 
 html += `
 <li class="px-3 py-2 hover:bg-slate-700 cursor-pointer flex flex-col gap-1.5 border-b border-slate-700 last:border-0 transition" onclick="selectFromCommAttSearch('${safeName}')">
     <div class="flex items-start gap-1.5 w-full">
         <span class="font-bold text-xs text-white break-words leading-tight">${p.name}</span>
         ${caregiverBadge}
     </div>
     <div class="flex justify-between items-center w-full">
         <div class="shrink-0 flex items-center">
             ${groupBadge}
         </div>
         <div class="shrink-0">${statusBadge}</div>
     </div>
     ${volHtml ? `<div class="flex flex-col gap-1 w-full">${volHtml}</div>` : ''}
     ${locHtml}
 </li>`;
});

resultsContainer.innerHTML = html || '<li class="px-3 py-2 text-[10px] font-bold text-slate-500 text-center">No matches found.</li>';
resultsContainer.classList.remove('hidden');
}

function selectFromCommAttSearch(name) {
document.getElementById('commAttSearchInput').value = '';
document.getElementById('commAttSearchResults').classList.add('hidden');

const isGoneHome = commAttData.attendance['__GONE_HOME__'] && commAttData.attendance['__GONE_HOME__'][name] === true;
if (!isGoneHome) {
 toggleCommAttStatus(name, true, null);
} else {
 triggerCommAttPulse(name, 'gonehome');
}
}

document.addEventListener('click', (e) => {
const results = document.getElementById('commAttSearchResults');
const input = document.getElementById('commAttSearchInput');
if(results && !results.classList.contains('hidden') && e.target !== input && !results.contains(e.target)) {
 results.classList.add('hidden');
}
});