let currentCommAttSheetUrl = null;
let commAttData = { participants: [], junctures: [], attendance: {} };
let commAttState = {}; 
let pendingCommAttUpdates = new Set();
let isCommAttSyncing = false;
let commAttSyncTimeout = null;
let commAttPollInterval = null;

function loadSheets(viewId) {
   const selectorId = viewId === 'comm' ? 'commSheetSelector' : 'volSheetSelector';
   const loadingId = viewId === 'comm' ? 'commSheetSpinner' : 'volSheetSpinner';
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
       
       if(viewId === 'comm' && listContainer) {
           listContainer.innerHTML = '';
           outingReminders = {}; 
           if(res.success && res.data.length > 0) {
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
       if(res.success && res.data.length > 0) {
           currentSheetList = res.data;
           res.data.forEach(item => {
               let opt = document.createElement('option');
               opt.value = item.sheetUrl;
               opt.text = item.displayName;
               selector.appendChild(opt);
           });
           selector.selectedIndex = 0;
           if(viewId === 'volunteer') resetVolForm();
       } else {
           selector.innerHTML = '<option disabled selected>No upcoming events</option>';
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
   if(!url || url.includes("Select") || url.includes("Loading")) return alert("Select an event first"); 
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
   if(!url || url.includes("Select") || url.includes("Loading")) return alert("Select an event first"); 
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
    const selector = document.getElementById('commSheetSelector');
    const url = selector.value;
    if(!url || url.includes("Select") || url.includes("Loading")) return alert("Select an event first");
    
    currentCommAttSheetUrl = url;
    document.getElementById('commAttEventName').innerText = "Attendance: " + selector.options[selector.selectedIndex].text;
    
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
            renderCommAttJunctures();
            startCommAttPolling();
        } else {
            alert("Error: " + res.message);
            showView('comm');
        }
    });
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
    
    if (!juncture) {
        renderCommAttLists();
        return;
    }
    
    renderCommAttLists();
}

function renderCommAttLists() {
    const notCheckedList = document.getElementById('commAttNotCheckedList');
    const checkedList = document.getElementById('commAttCheckedList');
    
    if (!notCheckedList || !checkedList) return;
    
    const juncture = commAttState.currentJuncture;
    if (!juncture || !commAttData.attendance[juncture]) {
        notCheckedList.innerHTML = '<p class="text-[10px] text-slate-500 font-bold p-2 text-center mt-2">Empty</p>';
        checkedList.innerHTML = '<p class="text-[10px] text-slate-500 font-bold p-2 text-center mt-2">Empty</p>';
        document.getElementById('commAttNotCheckedCount').textContent = '0';
        document.getElementById('commAttCheckedCount').textContent = '0';
        return;
    }
    
    let notCheckedHtml = '';
    let checkedHtml = '';
    let notCheckedCount = 0;
    let checkedCount = 0;
    
    const participants = commAttData.participants || [];
    
    participants.sort((a, b) => a.name.localeCompare(b.name));
    
    participants.forEach(p => {
        const isChecked = commAttData.attendance[juncture][p.name] === true;
        const cardHtml = generateCommAttCard(p, isChecked);
        
        if (isChecked) {
            checkedHtml += cardHtml;
            checkedCount++;
        } else {
            notCheckedHtml += cardHtml;
            notCheckedCount++;
        }
    });
    
    notCheckedList.innerHTML = notCheckedHtml || '<p class="text-[10px] text-slate-500 font-bold p-2 text-center mt-2">Empty</p>';
    checkedList.innerHTML = checkedHtml || '<p class="text-[10px] text-slate-500 font-bold p-2 text-center mt-2">Empty</p>';
    
    document.getElementById('commAttNotCheckedCount').textContent = notCheckedCount;
    document.getElementById('commAttCheckedCount').textContent = checkedCount;
}

function generateCommAttCard(p, isChecked) {
    const groupBadge = p.group ? `<span class="text-[8px] bg-slate-700 text-slate-300 px-1 py-0.5 rounded border border-slate-600 truncate max-w-[80px]">${p.group}</span>` : '';
    const safeName = p.name.replace(/'/g, "\\'");
    
    return `
    <div id="comm-att-card-${p.name.replace(/[^a-zA-Z0-9]/g, '')}" class="relative bg-slate-800 p-2 rounded border border-slate-700 shadow-sm transition-all duration-300 flex items-center justify-between gap-1 select-none active:scale-95 cursor-pointer hover:border-teal-500" onclick="toggleCommAttStatus('${safeName}', ${!isChecked})">
        <div class="flex flex-col min-w-0 flex-1 gap-1">
            <span class="font-extrabold text-xs text-white max-w-full break-words whitespace-normal leading-tight text-left inline-block self-start">${p.name}</span>
            ${groupBadge}
        </div>
        <div class="shrink-0 flex items-center justify-center pl-1">
            <div class="w-5 h-5 rounded flex items-center justify-center border transition-colors ${isChecked ? 'bg-green-500 border-green-600 text-white shadow-inner' : 'bg-slate-900 border-slate-600 text-transparent'}">
                <i class="fa-solid fa-check text-xs"></i>
            </div>
        </div>
    </div>`;
}

function toggleCommAttStatus(name, forceState) {
    const juncture = commAttState.currentJuncture;
    if (!juncture) return;
    
    commAttData.attendance[juncture][name] = forceState;
    pendingCommAttUpdates.add(name);
    
    renderCommAttLists();
    triggerCommAttPulse(name, forceState);
    
    if (commAttSyncTimeout) clearTimeout(commAttSyncTimeout);
    commAttSyncTimeout = setTimeout(() => {
        executeCommAttSync();
    }, 800);
}

function triggerCommAttPulse(name, isChecked) {
    setTimeout(() => {
        const id = `comm-att-card-${name.replace(/[^a-zA-Z0-9]/g, '')}`;
        const card = document.getElementById(id);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            const ringColor = isChecked ? 'ring-green-500' : 'ring-red-500';
            const bgColor = isChecked ? 'bg-green-900/30' : 'bg-red-900/30';
            
            card.classList.add('ring-1', ringColor, 'scale-[1.02]', bgColor, 'z-10');
            setTimeout(() => {
                card.classList.remove('ring-1', ringColor, 'scale-[1.02]', bgColor, 'z-10');
            }, 800);
        }
    }, 50);
}

async function executeCommAttSync() {
    if (pendingCommAttUpdates.size === 0) return;
    const juncture = commAttState.currentJuncture;
    if (!juncture) return;
    
    isCommAttSyncing = true;
    setCommAttBtnState('saving');
    
    const batch = Array.from(pendingCommAttUpdates);
    pendingCommAttUpdates.clear();
    
    const updates = batch.map(name => ({
        name: name,
        status: commAttData.attendance[juncture][name]
    }));
    
    try {
        const res = await apiCall('syncCommAttendance', { sheetUrl: currentCommAttSheetUrl, junctureName: juncture, updates: updates });
        if (res.success) {
            setCommAttBtnState('saved');
        } else {
            throw new Error(res.message);
        }
    } catch (e) {
        console.error(e);
        setCommAttBtnState('error');
        batch.forEach(name => pendingCommAttUpdates.add(name));
    } finally {
        isCommAttSyncing = false;
    }
}

function setCommAttBtnState(state) {
    const btn = document.getElementById('btn-sync-comm-att');
    if (!btn) return;
    
    const textSpan = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.btn-spinner');
    
    btn.className = "text-xs px-2 py-1 rounded-md font-bold transition flex items-center border border-slate-600 focus:outline-none";
    spinner.classList.add('hidden');
    
    if (state === 'saving') {
        btn.classList.add('bg-yellow-900/50', 'text-yellow-400', 'border-yellow-600');
        textSpan.textContent = "Saving...";
        spinner.classList.remove('hidden');
    } else if (state === 'saved') {
        btn.classList.add('bg-green-900/50', 'text-green-400', 'border-green-600');
        textSpan.textContent = "Saved";
        setTimeout(() => {
            if (pendingCommAttUpdates.size === 0) {
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
            commAttState.currentJuncture = name.trim();
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
            commAttState.currentJuncture = null;
            renderCommAttJunctures();
            showFlashMessage('commGlobalStatus', "Juncture deleted.", 'success');
        } else {
            alert(res.message);
        }
    });
}

async function manualSyncCommAttendance() {
    if (pendingCommAttUpdates.size > 0) {
        await executeCommAttSync();
    }
    
    setCommAttBtnState('saving');
    const overlay = document.getElementById('commAttLoadingOverlay');
    overlay.classList.remove('hidden');
    
    apiCall('fetchCommAttendance', { sheetUrl: currentCommAttSheetUrl }).then(res => {
        overlay.classList.add('hidden');
        if (res.success) {
            commAttData = res;
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
        
        if (isCommAttSyncing || pendingCommAttUpdates.size > 0) return;
        
        apiCall('fetchCommAttendance', { sheetUrl: currentCommAttSheetUrl }).then(res => {
            if (res.success && !isCommAttSyncing && pendingCommAttUpdates.size === 0) {
                const oldJunctures = JSON.stringify(commAttData.junctures);
                commAttData = res;
                if (oldJunctures !== JSON.stringify(commAttData.junctures)) {
                    renderCommAttJunctures();
                } else {
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
    if (!juncture) return;
    
    const participants = commAttData.participants || [];
    const matches = participants.filter(p => p.name.toLowerCase().includes(query) || (p.group && p.group.toLowerCase().includes(query)));
    
    let html = '';
    matches.forEach(p => {
        const isChecked = commAttData.attendance[juncture][p.name] === true;
        const safeName = p.name.replace(/'/g, "\\'");
        
        html += `
        <li class="px-3 py-2 hover:bg-slate-700 cursor-pointer flex justify-between items-center border-b border-slate-700 last:border-0 transition" onclick="selectFromCommAttSearch('${safeName}')">
            <span class="font-bold text-xs text-white max-w-[70%] break-words">${p.name}</span>
            ${isChecked ? '<span class="text-[9px] bg-green-900/50 text-green-400 px-1 py-0.5 rounded font-black uppercase border border-green-700">Checked</span>' : '<span class="text-[9px] bg-red-900/50 text-red-400 px-1 py-0.5 rounded font-black uppercase border border-red-700">NOT Checked</span>'}
        </li>`;
    });
    
    resultsContainer.innerHTML = html || '<li class="px-3 py-2 text-[10px] font-bold text-slate-500 text-center">No matches found.</li>';
    resultsContainer.classList.remove('hidden');
}

function selectFromCommAttSearch(name) {
    document.getElementById('commAttSearchInput').value = '';
    document.getElementById('commAttSearchResults').classList.add('hidden');
    toggleCommAttStatus(name, true);
}

document.addEventListener('click', (e) => {
    const results = document.getElementById('commAttSearchResults');
    const input = document.getElementById('commAttSearchInput');
    if(results && !results.classList.contains('hidden') && e.target !== input && !results.contains(e.target)) {
        results.classList.add('hidden');
    }
});