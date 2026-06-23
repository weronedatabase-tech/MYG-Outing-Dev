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

// Disable action buttons while loading
document.getElementById('scrubBtn').disabled = true;
document.getElementById('scrubBtn').classList.add('opacity-50', 'cursor-not-allowed');
document.getElementById('massPairBtn').disabled = true;
document.getElementById('massPairBtn').classList.add('opacity-50', 'cursor-not-allowed');
document.getElementById('groupBtn').disabled = true;
document.getElementById('groupBtn').classList.add('opacity-50', 'cursor-not-allowed');

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
if(viewId === 'comm' && listContainer) listContainer.innerHTML = '<p class="text-xs italic text-gray-500 dark:text-gray-400"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading events...</p>';

apiCall('getRecentOutingSheets', null).then(res => {
if(spinner) spinner.classList.add('hidden');
selector.disabled = false;
selector.innerHTML = '';

if (res.success) {
 if(viewId === 'comm' && listContainer) {
     listContainer.innerHTML = '';
     outingReminders = {}; 
     if(res.data.length > 0) {
         // Re-enable action buttons now that we have data
         document.getElementById('scrubBtn').disabled = false;
         document.getElementById('scrubBtn').classList.remove('opacity-50', 'cursor-not-allowed');
         document.getElementById('massPairBtn').disabled = false;
         document.getElementById('massPairBtn').classList.remove('opacity-50', 'cursor-not-allowed');
         document.getElementById('groupBtn').disabled = false;
         document.getElementById('groupBtn').classList.remove('opacity-50', 'cursor-not-allowed');

         let allCards = '';
         res.data.forEach((item, index) => {
             allCards += `
             <div class="flex flex-col gap-2 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm relative transition-colors">
                <div class="flex justify-between items-start">
                  <div>
                      <div class="font-bold text-gray-900 dark:text-white text-sm">${item.displayName}</div>
                      <div class="text-gray-500 dark:text-gray-400 text-xs">${item.formattedDate}</div>
                      <div id="pending-badge-${index}" class="mt-1 hidden"></div>
                  </div>
                  <div class="flex gap-2 text-xs"><a href="${item.folderUrl}" target="_blank" class="p-2 bg-gray-100 dark:bg-zinc-800 rounded text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"><i class="fa-regular fa-folder-open text-base"></i></a><a href="${item.sheetUrl}" target="_blank" class="p-2 bg-gray-100 dark:bg-zinc-800 rounded text-green-500 dark:text-green-400 hover:text-green-600 dark:hover:text-green-300 transition-colors"><i class="fa-regular fa-file-excel text-base"></i></a></div>
                </div>
                <div id="stats-${index}" class="text-xs text-gray-400 dark:text-gray-500 animate-pulse mt-2">Loading stats...</div>
                <div id="btn-group-${index}" class="hidden flex gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                    <button onclick="openReminderModal('${index}')" class="flex-1 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 text-xs py-2 px-3 rounded border border-gray-200 dark:border-zinc-700 transition-colors"><i class="fa-regular fa-message mr-1"></i> Reminder Message</button>
                    <button onclick="copyReminderDirect('${index}', this)" class="bg-gray-50 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-xs py-2 px-3 rounded border border-gray-200 dark:border-zinc-700 hover:border-blue-200 dark:hover:border-blue-800 transition-colors"><i class="fa-regular fa-copy"></i></button>
                </div>
             </div>`;
         });
         listContainer.innerHTML = allCards;
         res.data.forEach((item, index) => fetchOutingStats(item.sheetUrl, index));
     } else {
         listContainer.innerHTML = '<p class="text-xs text-gray-500 dark:text-gray-400 italic">No upcoming outings found.</p>';
     }
 }
 if(res.data.length > 0) {
     window.currentSheetList = res.data;
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
 let html = '<table class="w-full text-[10px] text-left border-collapse"><tr class="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-zinc-700"><th>Proj</th><th class="text-center">Trainees</th><th class="text-center">CG</th><th class="text-center">Vols</th></tr>';
 const sortedKeys = Object.keys(res.stats).sort();
 if(sortedKeys.length === 0) {
     html += '<tr><td colspan="4" class="text-center py-2 text-gray-400 dark:text-gray-500 italic">No data yet</td></tr>';
 } else {
     for(const proj of sortedKeys) {
         const d = res.stats[proj];
         html += `<tr class="border-b border-gray-100 dark:border-zinc-800/50 last:border-0"><td class="py-1 font-bold text-gray-700 dark:text-gray-300">${proj}</td><td class="text-center text-gray-500 dark:text-gray-400"><span class="text-gray-900 dark:text-white">${d.tY}</span>/${d.tTot}</td><td class="text-center text-gray-900 dark:text-white">${d.cY}</td><td class="text-center text-gray-500 dark:text-gray-400"><span class="text-gray-900 dark:text-white">${d.vY}</span>/${d.vTot}</td></tr>`;
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
 container.innerHTML = '<span class="text-red-500 dark:text-red-400">Error loading stats</span>';
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
btn.classList.add('text-green-600', 'dark:text-green-400', 'border-green-200', 'dark:border-green-800');
setTimeout(() => {
 btn.innerHTML = original;
 btn.classList.remove('text-green-600', 'dark:text-green-400', 'border-green-200', 'dark:border-green-800');
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
btn.innerText = "Auto Pair"; 
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
btn.innerText = "Auto Group"; 
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

let btnText = type === 'group' ? 'Grp: ' : (type === 'meet' ? 'Meeting: ' : 'Dismissal: ');

if (selectedArray.length === 0) {
    btnText += 'All';
    btn.classList.remove('ring-1', 'ring-gray-900', 'dark:ring-gray-100');
} else {
    btnText += `(${selectedArray.length})`;
    btn.classList.add('ring-1', 'ring-gray-900', 'dark:ring-gray-100');
}

btn.innerText = btnText;

let html = `<div class="p-1.5 flex justify-between border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-black sticky top-0 z-10">
    <button onclick="clearCommAttFilter('${type}', event)" class="text-[10px] bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded transition">Clear</button>
    <button onclick="closeAllCommAttFilters(event)" class="text-[10px] bg-primary hover:bg-blue-600 text-white px-3 py-1 rounded transition">Done</button>
</div>`;

if (availableItems.length === 0) {
    html += `<div class="p-2 text-center text-xs text-gray-500 dark:text-gray-400 italic">No options</div>`;
} else {
    availableItems.forEach(item => {
        const isChecked = selectedArray.includes(item);
        html += `
        <div class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800 last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center justify-between transition-colors" onclick="toggleCommAttFilterItem('${type}', '${item.replace(/'/g, "\\'")}', event)">
            <span class="text-xs text-gray-700 dark:text-gray-300 font-bold break-words pr-2">${type === 'group' ? 'Grp ' + item : item}</span>
            <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isChecked ? 'bg-blue-500 border-blue-600 text-white' : 'bg-gray-100 border-gray-300 dark:bg-black dark:border-zinc-600 text-transparent'}">
                <i class="fa-solid fa-check text-[10px]"></i>
            </div>
        </div>`;
    });
}

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
let unpairedCount = 0;

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

// Check if Unpaired and not Gone Home
if (!isGoneHome && (!p.volPaired || p.volPaired.trim() === '')) {
  unpairedCount++;
}

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

notCheckedList.innerHTML = notCheckedHtml || '<p class="text-[10px] text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';
checkedList.innerHTML = checkedHtml || '<p class="text-[10px] text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';
goneHomeList.innerHTML = goneHomeHtml || '<p class="text-[10px] text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';

document.getElementById('commAttNotCheckedCount').textContent = notCheckedCount;
document.getElementById('commAttCheckedCount').textContent = checkedCount;
document.getElementById('commAttGoneHomeCount').textContent = goneHomeCount;

updateUnpairedNotification(unpairedCount);

notCheckedList.scrollTop = scrollNC;
checkedList.scrollTop = scrollC;
goneHomeList.scrollTop = scrollGH;
}

function handleTraineeLongPress(e, name) {
e.preventDefault(); 
e.stopPropagation();
showTraineeInfo(name);
}

function showTraineeInfo(name) {
if (window.navigator && window.navigator.vibrate) {
    try { window.navigator.vibrate(50); } catch(e){}
}

const p = commAttData.participants.find(x => x.name === name);
if (!p) return;

let format = (window.appSettings && window.appSettings.popupFormat) ? window.appSettings.popupFormat : DEF_POPUP_FORMAT;

const dataDict = {};
dataDict['name'] = p.name || '';
dataDict['group'] = p.group || '';
dataDict['meetingloc'] = p.meetingLoc || '';
dataDict['dismissalloc'] = p.dismissalLoc || '';
dataDict['volpaired'] = p.volPaired || '';
dataDict['caregivers'] = p.caregivers || '0';

if (p.extra) {
    for (const [key, val] of Object.entries(p.extra)) {
        dataDict[key.toLowerCase().replace(/[^a-z0-9]/g, "")] = val || '';
    }
}

const formattedText = format.replace(/\{\{([^}]+)\}\}/g, (match, p1) => {
    const cleanKey = p1.toLowerCase().replace(/[^a-z0-9]/g, "");
    return dataDict[cleanKey] !== undefined && dataDict[cleanKey] !== null && dataDict[cleanKey] !== "" 
        ? dataDict[cleanKey] 
        : "-";
});

document.getElementById('traineeInfoContent').textContent = formattedText;
document.getElementById('traineeInfoModal').classList.remove('hidden');
}

function closeTraineeInfoModal() {
document.getElementById('traineeInfoModal').classList.add('hidden');
}

function generateCommAttCard(p, isChecked, isGoneHome) {
const safeName = p.name.replace(/'/g, "\\'");

const caregiverBadge = p.caregivers > 0 ? `<span class="inline-flex shrink-0 items-center justify-center min-w-[16px] md:min-w-[20px] h-4 md:h-5 px-1 bg-red-500 rounded-full text-[9px] md:text-[11px] font-black text-white shadow-sm mt-px" title="${p.caregivers} Caregiver(s)">${p.caregivers > 1 ? p.caregivers + 'C' : 'C'}</span>` : '';

let volHtml = '';
if (p.volPaired) {
const vols = p.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
if (vols.length > 0) {
  volHtml = vols.map(v => `<span class="text-[9px] md:text-[11px] text-teal-700 dark:text-teal-400 leading-tight font-bold bg-teal-50 dark:bg-teal-900/30 px-1.5 md:px-2 py-0.5 md:py-1 rounded border border-teal-200 dark:border-teal-800/50 whitespace-normal break-words w-fit max-w-full text-left"><i class="fa-solid fa-handshake-angle mr-1"></i>${v}</span>`).join('');
}
} else if (!isGoneHome) {
// Highlight unpaired explicitly
  volHtml = `<span class="text-[9px] md:text-[11px] text-red-700 dark:text-red-400 leading-tight font-black bg-red-50 dark:bg-red-900/30 px-1.5 md:px-2 py-0.5 md:py-1 rounded border border-red-200 dark:border-red-800/50 whitespace-normal break-words w-fit max-w-full text-left uppercase"><i class="fa-solid fa-circle-exclamation mr-1"></i>Unpaired</span>`;
}

let locHtml = '';
if (p.meetingLoc || p.dismissalLoc) {
locHtml = '<div class="flex flex-col gap-1 w-full mt-1 border-t border-gray-100 dark:border-zinc-700/60 pt-1.5">';
if (p.meetingLoc) {
  locHtml += `<span class="text-[9px] md:text-[11px] text-blue-700 dark:text-blue-300 leading-tight bg-blue-50 dark:bg-blue-900/20 px-1.5 md:px-2 py-1 md:py-1.5 rounded whitespace-normal break-words w-full text-left"><i class="fa-solid fa-location-dot mr-1 text-blue-500 dark:text-blue-400"></i>Meeting: ${p.meetingLoc}</span>`;
}
if (p.dismissalLoc) {
  locHtml += `<span class="text-[9px] md:text-[11px] text-purple-700 dark:text-purple-300 leading-tight bg-purple-50 dark:bg-purple-900/20 px-1.5 md:px-2 py-1 md:py-1.5 rounded whitespace-normal break-words w-full text-left"><i class="fa-solid fa-flag-checkered mr-1 text-purple-500 dark:text-purple-400"></i>Dismissal: ${p.dismissalLoc}</span>`;
}
locHtml += '</div>';
}

const groupBadge = p.group ? `<span class="text-[9px] md:text-[11px] bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 px-1.5 md:px-2 py-0.5 md:py-1 rounded border border-gray-200 dark:border-zinc-700 whitespace-nowrap">Grp ${p.group}</span>` : '';

const homeBtnClass = isGoneHome ? 'bg-blue-500 text-white border-blue-600 shadow-inner' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-700 hover:text-blue-500 dark:hover:text-blue-400 hover:border-blue-500';
const checkBtnClass = isChecked ? 'bg-green-500 border-green-600 text-white shadow-inner' : 'bg-gray-50 dark:bg-black border-gray-300 dark:border-zinc-600 text-transparent';

return `
<div id="comm-att-card-${p.name.replace(/[^a-zA-Z0-9]/g, '')}" 
class="relative bg-white dark:bg-zinc-900 p-2 md:p-3 rounded border border-gray-200 dark:border-zinc-700 shadow-sm transition-all duration-300 flex flex-col gap-1.5 md:gap-2 select-none active:scale-95 cursor-pointer hover:border-teal-500" 
onclick="toggleCommAttStatus('${safeName}', ${!isChecked}, event)"
oncontextmenu="handleTraineeLongPress(event, '${safeName}')">
<div class="flex items-start gap-1.5 md:gap-2 w-full">
  <span class="font-extrabold text-xs md:text-sm text-gray-900 dark:text-white leading-tight break-words">${p.name}</span>
  ${caregiverBadge}
</div>
<div class="flex justify-between items-center w-full">
  <div class="shrink-0 flex items-center">
      ${groupBadge}
  </div>
  <div class="shrink-0 flex items-center gap-1.5 md:gap-2">
      <button onclick="toggleGoneHomeStatus('${safeName}', ${!isGoneHome}, event)" class="w-6 h-6 md:w-8 md:h-8 rounded flex items-center justify-center border transition-colors ${homeBtnClass}" title="Toggle Gone Home">
          <i class="fa-solid fa-house-user text-[10px] md:text-xs"></i>
      </button>
      <div class="w-6 h-6 md:w-8 md:h-8 rounded flex items-center justify-center border transition-colors ${checkBtnClass}">
          <i class="fa-solid fa-check text-xs md:text-sm"></i>
      </div>
  </div>
</div>
${volHtml ? `<div class="flex flex-col gap-1 md:gap-1.5 w-full">${volHtml}</div>` : ''}
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

// When gone home is true, clear volunteers paired locally as well
if (forceState) {
  const pIndex = commAttData.participants.findIndex(p => p.name === name);
  if (pIndex > -1) {
      commAttData.participants[pIndex].volPaired = "";
  }
}

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
  
  let ringColor = 'ring-red-400';
  let bgColor = 'bg-red-50 dark:bg-red-900/30';
  
  if (stateType === 'checked') {
      ringColor = 'ring-green-400';
      bgColor = 'bg-green-50 dark:bg-green-900/30';
  } else if (stateType === 'gonehome') {
      ringColor = 'ring-blue-400';
      bgColor = 'bg-blue-50 dark:bg-blue-900/30';
  }
  
  card.classList.add('ring-2', ringColor, 'scale-[1.02]', bgColor, 'z-10');
  setTimeout(() => {
      card.classList.remove('ring-2', ringColor, 'scale-[1.02]', bgColor, 'z-10');
  }, 800);
}
}, 50);
}

function generateColumnText(columnType) {
    const juncture = commAttState.currentJuncture;
    let participants = commAttData.participants || [];
    let listTitle = "";

    if (columnType === 'notChecked') listTitle = "NOT PRESENT";
    if (columnType === 'checked') listTitle = "PRESENT";
    if (columnType === 'goneHome') listTitle = "GONE HOME";

    if (commAttState.selectedGroups.length > 0) {
        participants = participants.filter(p => commAttState.selectedGroups.includes(String(p.group)));
    }
    if (commAttState.selectedMeets.length > 0) {
        participants = participants.filter(p => commAttState.selectedMeets.includes(String(p.meetingLoc)));
    }
    if (commAttState.selectedDismissals.length > 0) {
        participants = participants.filter(p => commAttState.selectedDismissals.includes(String(p.dismissalLoc)));
    }

    const targetNames = [];
    participants.forEach(p => {
        const isGoneHome = commAttData.attendance['__GONE_HOME__'] && commAttData.attendance['__GONE_HOME__'][p.name] === true;
        const isChecked = juncture && commAttData.attendance[juncture] ? commAttData.attendance[juncture][p.name] === true : false;
        
        if (columnType === 'goneHome' && isGoneHome) targetNames.push(p.name);
        else if (columnType === 'checked' && !isGoneHome && isChecked) targetNames.push(p.name);
        else if (columnType === 'notChecked' && !isGoneHome && !isChecked) targetNames.push(p.name);
    });

    const groupsStr = commAttState.selectedGroups.length > 0 ? "Grp: " + commAttState.selectedGroups.join(", ") : "All Groups";
    const meetsStr = commAttState.selectedMeets.length > 0 ? "Meeting: " + commAttState.selectedMeets.join(", ") : "All Meetings";
    const dismissStr = commAttState.selectedDismissals.length > 0 ? "Dismissal: " + commAttState.selectedDismissals.join(", ") : "All Dismissals";

    let format = (window.appSettings && window.appSettings.shareFormat) ? window.appSettings.shareFormat : DEF_SHARE_FORMAT;

    const formattedText = format
        .replace(/\{\{Groups\}\}/gi, groupsStr)
        .replace(/\{\{Meetings\}\}/gi, meetsStr)
        .replace(/\{\{Dismissals\}\}/gi, dismissStr)
        .replace(/\{\{Count\}\}/gi, targetNames.length)
        .replace(/\{\{List\}\}/gi, targetNames.join('\n'));

    return `[${listTitle}]\n${formattedText}`;
}

function copyColumnData(columnType) {
    const finalMessage = generateColumnText(columnType);
    navigator.clipboard.writeText(finalMessage).then(() => {
        showFlashMessage('commGlobalStatus', "List copied to clipboard!", 'success');
    }).catch(() => {
        alert("Failed to copy list. Clipboard access denied.");
    });
}

function shareColumnData(columnType) {
    const finalMessage = generateColumnText(columnType);
    const listTitle = finalMessage.split('\n')[0].replace(/\[|\]/g, '');
    
    if (navigator.share) {
        navigator.share({
            title: `${listTitle} List`,
            text: finalMessage
        }).catch(err => {
            console.error("Share failed", err);
        });
    } else {
        copyColumnData(columnType);
    }
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

btn.className = "text-[10px] px-2 py-0.5 rounded font-bold transition flex items-center border border-gray-300 dark:border-zinc-700 focus:outline-none shadow-sm";
spinner.classList.add('hidden');

if (state === 'saving') {
btn.classList.add('bg-yellow-50', 'dark:bg-yellow-900/30', 'text-yellow-700', 'dark:text-yellow-400', 'border-yellow-200', 'dark:border-yellow-800');
textSpan.textContent = "Saving...";
spinner.classList.remove('hidden');
} else if (state === 'saved') {
btn.classList.add('bg-green-50', 'dark:bg-green-900/30', 'text-green-700', 'dark:text-green-400', 'border-green-200', 'dark:border-green-800');
textSpan.textContent = "Saved";
setTimeout(() => {
  if (!hasPendingUpdates()) {
      btn.classList.remove('bg-green-50', 'dark:bg-green-900/30', 'text-green-700', 'dark:text-green-400', 'border-green-200', 'dark:border-green-800');
      btn.classList.add('bg-gray-100', 'dark:bg-zinc-800', 'text-gray-700', 'dark:text-gray-300');
      textSpan.textContent = "Saved";
  }
}, 2000);
} else if (state === 'error') {
btn.classList.add('bg-red-50', 'dark:bg-red-900/30', 'text-red-700', 'dark:text-red-400', 'border-red-200', 'dark:border-red-800');
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
  statusBadge = '<span class="text-[9px] md:text-[11px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1 py-0.5 rounded font-black uppercase border border-blue-200 dark:border-blue-800">Gone Home</span>';
} else if (isChecked) {
  statusBadge = '<span class="text-[9px] md:text-[11px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1 py-0.5 rounded font-black uppercase border border-green-200 dark:border-green-800">Checked</span>';
} else {
  statusBadge = '<span class="text-[9px] md:text-[11px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1 py-0.5 rounded font-black uppercase border border-red-200 dark:border-red-800">NOT Checked</span>';
}

let volHtml = '';
if (p.volPaired) {
  const vols = p.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
  if (vols.length > 0) {
      volHtml = vols.map(v => `<span class="text-[9px] md:text-[11px] text-teal-700 dark:text-teal-400 leading-tight font-bold bg-teal-50 dark:bg-teal-900/30 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800/50 whitespace-normal break-words w-fit max-w-full text-left"><i class="fa-solid fa-handshake-angle mr-1"></i>${v}</span>`).join('');
  }
} else if (!isGoneHome) {
  volHtml = `<span class="text-[9px] md:text-[11px] text-red-700 dark:text-red-400 leading-tight font-black bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800/50 whitespace-normal break-words w-fit max-w-full text-left uppercase"><i class="fa-solid fa-circle-exclamation mr-1"></i>Unpaired</span>`;
}

let locHtml = '';
if (p.meetingLoc || p.dismissalLoc) {
  locHtml = '<div class="flex flex-col gap-1 w-full mt-1 border-t border-gray-100 dark:border-zinc-700/60 pt-1.5">';
  if (p.meetingLoc) {
      locHtml += `<span class="text-[9px] md:text-[11px] text-blue-700 dark:text-blue-300 leading-tight bg-blue-50 dark:bg-blue-900/20 px-1.5 py-1 rounded whitespace-normal break-words w-full text-left"><i class="fa-solid fa-location-dot mr-1 text-blue-500 dark:text-blue-400"></i>Meeting: ${p.meetingLoc}</span>`;
  }
  if (p.dismissalLoc) {
      locHtml += `<span class="text-[9px] md:text-[11px] text-purple-700 dark:text-purple-300 leading-tight bg-purple-50 dark:bg-purple-900/20 px-1.5 py-1 rounded whitespace-normal break-words w-full text-left"><i class="fa-solid fa-flag-checkered mr-1 text-purple-500 dark:text-purple-400"></i>Dismissal: ${p.dismissalLoc}</span>`;
  }
  locHtml += '</div>';
}

const caregiverBadge = p.caregivers > 0 ? `<span class="inline-flex shrink-0 items-center justify-center min-w-[16px] md:min-w-[20px] h-4 md:h-5 px-1 bg-red-500 rounded-full text-[9px] md:text-[11px] font-black text-white shadow-sm mt-px" title="${p.caregivers} Caregiver(s)">${p.caregivers > 1 ? p.caregivers + 'C' : 'C'}</span>` : '';
const groupBadge = p.group ? `<span class="text-[9px] md:text-[11px] bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded border border-gray-200 dark:border-zinc-700 whitespace-nowrap">Grp ${p.group}</span>` : '';

html += `
<li class="px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer flex flex-col gap-1.5 border-b border-gray-200 dark:border-zinc-800 last:border-0 transition" onclick="selectFromCommAttSearch('${safeName}')">
  <div class="flex items-start gap-1.5 w-full">
      <span class="font-bold text-xs md:text-sm text-gray-900 dark:text-white break-words leading-tight">${p.name}</span>
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

resultsContainer.innerHTML = html || '<li class="px-3 py-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 text-center">No matches found.</li>';
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