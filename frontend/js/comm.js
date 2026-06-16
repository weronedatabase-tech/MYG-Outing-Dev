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
    if(!url || url.includes("Select")) return alert("Select a sheet first"); 
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
    if(!url || url.includes("Select")) return alert("Select a sheet first"); 
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