// ==========================================
// VOLUNTEER.JS - Concurrency Optimized
// Zero-Latency Cached Hydration Engine
// ==========================================

let currentEventUrl = null;
let currentEventData = null; 
let selectedRole = 'TRAINEE';
let selectedPerson = null;
let isNewVolunteer = false;
let originalVolData = {};
let allProjects = [];
let currentActiveVols = [];
let currentVolPairedValue = [];
let backgroundFetchActive = false;

// PILLAR 3: Zero-Latency Hydration Data Stores
let preFetchedNames = { trainee: null, volunteer: null };

// ==========================================
// 1. API RETRY ENGINE (CONCURRENCY LOCK BYPASS)
// ==========================================
async function fetchWithRetry(action, payload, maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
        const res = await apiCall(action, payload);
        if (res && res.success) return res;
        
        const isLockError = res && res.message && /lock|timeout|concurrent|too many|invalid response|server error/i.test(res.message);
        
        if (isLockError && i < maxRetries - 1) {
            const wait = (Math.pow(2, i) * 1000) + (Math.random() * 1000);
            if (action === 'submitAttendanceData') {
                showOverlay('loading', `High Traffic. Retrying in ${Math.round(wait/1000)}s...`);
            }
            await new Promise(r => setTimeout(r, wait));
        } else {
            return res || { success: false, message: "Network connection error." };
        }
    }
    return { success: false, message: "Server is congested. Please try again." };
}

// ==========================================
// 2. INITIALIZATION & EVENT SELECTION
// ==========================================
function initVolunteerApp() {
    const localDataStr = localStorage.getItem('myg_sheetList');
    if (localDataStr) {
        try {
            const parsed = JSON.parse(localDataStr);
            renderEventOptions(parsed);
            fetchEventsInBackground(); 
            return;
        } catch(e){}
    }
    fetchEventsInBackground(true);
}

function fetchEventsInBackground(showSpinner = false) {
    const select = document.getElementById('eventSelector');
    if (showSpinner) select.innerHTML = '<option disabled selected>Loading events...</option>';
    
    fetchWithRetry('getRecentOutingSheets', null).then(res => {
        if (res && res.success) {
            localStorage.setItem('myg_sheetList', JSON.stringify(res.data));
            renderEventOptions(res.data);
        } else if (showSpinner) {
            select.innerHTML = '<option disabled selected>Error loading events</option>';
        }
    });
}

function renderEventOptions(data) {
    const select = document.getElementById('eventSelector');
    select.innerHTML = '<option disabled selected>Select an Event...</option>';
    data.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.sheetUrl;
        opt.text = item.displayName;
        select.appendChild(opt);
    });
    
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('url');
    if (urlParam && data.find(x => x.sheetUrl === urlParam)) {
        select.value = urlParam;
        onEventChange();
    } else if (data.length > 0) {
        const closest = window.getClosestEventUrl ? window.getClosestEventUrl(data) : data[0].sheetUrl;
        if (closest) {
            select.value = closest;
            onEventChange();
        }
    }
}

function onEventChange() {
    currentEventUrl = document.getElementById('eventSelector').value;
    if (!currentEventUrl || currentEventUrl.includes("Select")) return;

    cancelForm();
    document.getElementById('roleSearchCard').classList.add('hidden');
    
    const spinner = document.getElementById('eventSelectSpinner');
    spinner.classList.remove('hidden');
    
    // Fetch manual pairing data which acts as a massive global cache (0ms latency usually)
    fetchWithRetry('fetchManualPairingData', { sheetUrl: currentEventUrl }).then(res => {
        spinner.classList.add('hidden');
        if (res && res.success) {
            currentEventData = res.data;
            allProjects = [...new Set((currentEventData.volunteers || []).map(v => v.project).filter(p => p))];
            currentActiveVols = (currentEventData.volunteers || []).filter(v => v.attending === 'y').map(v => v.name);
            
            document.getElementById('roleSearchCard').classList.remove('hidden');
            setRole(selectedRole); 
        } else {
            alert("Failed to load event data. " + (res.message || ""));
        }
    });
}

// ==========================================
// 3. UI STATE & SEARCHING
// ==========================================
function setRole(role) {
    selectedRole = role;
    const btnT = document.getElementById('btnRoleTrainee');
    const btnV = document.getElementById('btnRoleVolunteer');
    const searchInput = document.getElementById('searchInput');
    
    if (role === 'TRAINEE') {
        btnT.className = "flex-1 py-2 text-sm font-bold rounded-md bg-white dark:bg-zinc-800 shadow text-blue-600 dark:text-blue-400 transition-all border border-gray-200 dark:border-zinc-700";
        btnV.className = "flex-1 py-2 text-sm font-bold rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-all border border-transparent";
        document.getElementById('newVolBtnWrapper').classList.add('hidden');
        searchInput.placeholder = "Search Trainee...";
    } else {
        btnV.className = "flex-1 py-2 text-sm font-bold rounded-md bg-white dark:bg-zinc-800 shadow text-green-600 dark:text-green-400 transition-all border border-gray-200 dark:border-zinc-700";
        btnT.className = "flex-1 py-2 text-sm font-bold rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-all border border-transparent";
        document.getElementById('newVolBtnWrapper').classList.remove('hidden');
        searchInput.placeholder = "Search Volunteer...";
    }
    
    clearSearch();
}

function handleSearch() {
    if (!currentEventData) return;
    const input = document.getElementById('searchInput').value.toLowerCase().trim();
    const dropdown = document.getElementById('searchDropdown');
    const clearBtn = document.getElementById('clearSearchBtn');
    
    if (input.length > 0) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
    
    if (!input && selectedRole !== 'TRAINEE') {
        dropdown.classList.add('hidden');
        return;
    }
    
    dropdown.innerHTML = '';
    const list = selectedRole === 'TRAINEE' ? (currentEventData.trainees || []) : (currentEventData.volunteers || []);
    const matches = list.filter(p => p.name.toLowerCase().includes(input));
    
    if (matches.length > 0) {
        matches.forEach(m => {
            const li = document.createElement('li');
            li.className = `px-4 py-3 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-zinc-700 hover:text-white cursor-pointer text-sm transition-colors last:border-0 ${selectedRole === 'TRAINEE' ? 'hover:bg-blue-600' : 'hover:bg-green-600'}`;
            li.innerText = m.name;
            li.onmousedown = (e) => { e.preventDefault(); selectPerson(m.name); };
            dropdown.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.className = "px-4 py-3 text-sm text-gray-500 dark:text-gray-400 italic bg-white dark:bg-zinc-800";
        li.innerText = "No matches found.";
        dropdown.appendChild(li);
    }
    dropdown.classList.remove('hidden');
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearchBtn').classList.add('hidden');
    document.getElementById('searchDropdown').classList.add('hidden');
}

// ==========================================
// 4. FORM GENERATION & HYDRATION
// ==========================================
function selectPerson(name) {
    selectedPerson = name;
    isNewVolunteer = false;
    
    document.getElementById('roleSearchCard').classList.add('hidden');
    document.getElementById('formCard').classList.remove('hidden');
    document.getElementById('newVolProjectContainer').classList.add('hidden');
    document.getElementById('newVolProjectSearch').required = false;
    
    const personObj = (selectedRole === 'TRAINEE' ? currentEventData.trainees : currentEventData.volunteers).find(p => p.name === name);
    
    const safeName = name.replace(/"/g, '&quot;');
    const color = selectedRole === 'TRAINEE' ? 'text-blue-500 dark:text-blue-400' : 'text-green-500 dark:text-green-400';
    const icon = selectedRole === 'TRAINEE' ? 'fa-user-graduate' : 'fa-handshake-angle';
    
    document.getElementById('formTitle').innerHTML = `<i class="fa-solid ${icon} ${color} mr-2"></i> Update <span class="${color} ml-1">${safeName}</span>`;
    document.getElementById('submitBtnText').innerText = "Update Attendance";
    
    renderForm(personObj);
}

function setupNewVolunteer() {
    selectedPerson = null;
    isNewVolunteer = true;
    
    document.getElementById('roleSearchCard').classList.add('hidden');
    document.getElementById('formCard').classList.remove('hidden');
    
    document.getElementById('newVolProjectContainer').classList.remove('hidden');
    document.getElementById('newVolProjectSearch').value = '';
    document.getElementById('newVolProjectSearch').required = true;
    
    document.getElementById('formTitle').innerHTML = `<i class="fa-solid fa-user-plus text-green-500 dark:text-green-400 mr-2"></i> Add New <span class="text-green-500 dark:text-green-400 ml-1">Volunteer</span>`;
    document.getElementById('submitBtnText').innerText = "Add & Update Attendance";
    
    renderForm(null);
}

function cancelForm() {
    document.getElementById('formCard').classList.add('hidden');
    const rCard = document.getElementById('roleSearchCard');
    if(rCard && !rCard.classList.contains('hidden')) return;
    if(currentEventUrl) rCard.classList.remove('hidden');
    clearSearch();
    selectedPerson = null;
}

function mapKnownData(header, person, role) {
    if (!person) return null; 
    const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
    const ex = person.extra || {};
    
    // Core Columns
    if (h.includes("name")) return person.name || "";
    if (h.includes("attending")) return person.attending || "";
    if (h.includes("meetinglocation")) return (role === 'TRAINEE' ? ex.t_meet : ex.v_meet) || "";
    if (h.includes("dismissallocation")) return (role === 'TRAINEE' ? ex.t_dismiss : ex.v_dismiss) || "";
    if (h.includes("vol") && h.includes("paired")) return person.volPaired || "";
    if (h.includes("project")) return person.project || "";
    if (h.includes("remark")) return ex.remark || "";
    if (h.includes("group")) return person.group || ex.v_group || "";
    
    // Extended Dynamic Columns natively mapped for 0-latency loads
    if (h.includes("diet")) return ex.t_dietary || "";
    if (h.includes("caregiver") || h.includes("cgcontact")) return ex.m_cg_contact || "";
    if (h.includes("meeting") && h.includes("fetch")) return ex.t_meet_fetching || "";
    if (h.includes("dismissal") && h.includes("fetch")) return ex.t_dismiss_fetching || "";
    if (h.includes("oneonone") || h.includes("11")) return ex.t_one_on_one || "";
    
    return null; // Will cleanly trigger background hydration only for fully custom columns
}

function renderForm(personObj) {
    const container = document.getElementById('dynamicFields');
    container.innerHTML = '';
    originalVolData = {};
    
    let schema = selectedRole === 'TRAINEE' ? window.appSettings?.traineeCols : window.appSettings?.volCols;
    
    if (!schema || schema.length === 0) {
        schema = ['Name', 'Attending (Y/N)', 'Meeting Location', 'Dismissal Location'];
        if (selectedRole === 'TRAINEE') schema.push('Vol Paired');
        if (selectedRole === 'VOLUNTEER') schema.push('Project');
        schema.push('Remarks');
    }
    
    const meetingOpts = currentEventData?.meetingLocs || [];
    const dismissalOpts = currentEventData?.dismissalLocs || [];
    let hasUnknowns = false;
    
    schema.forEach(header => {
        let mappedVal = "";
        let isUnknown = false;
        
        if (isNewVolunteer) {
            mappedVal = "";
            isUnknown = false; // Never fetch if it's a blank new form
        } else {
            mappedVal = mapKnownData(header, personObj, selectedRole);
            if (mappedVal === null) {
                isUnknown = true;
                hasUnknowns = true;
                mappedVal = "";
            }
        }
        
        const cleanH = header.toLowerCase().replace(/[^a-z0-9]/g, "");
        const isNameField = cleanH.includes("name");
        
        if (isNewVolunteer && cleanH.includes("project")) return; 
        if (isNameField && !isNewVolunteer && selectedPerson) mappedVal = selectedPerson;
        
        originalVolData[header] = mappedVal; 
        
        const isReadOnly = isNameField && !isNewVolunteer;
        let wrapperClass = "mb-2";
        if (!isNameField && !cleanH.includes("attending")) wrapperClass += " attendance-dependent";
        
        let inputHtml = "";
        
        const colorClass = isUnknown 
            ? "text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-zinc-800 animate-pulse placeholder-gray-400" 
            : "text-gray-900 dark:text-white bg-gray-50 dark:bg-black";
            
        const ph = isUnknown ? "Loading details..." : "";
        
        // 1. Attending Select
        if (cleanH.includes("attending")) {
            inputHtml = `
            <select name="${header}" onchange="toggleDependentFields(this)" data-unknown="${isUnknown}" class="w-full ${colorClass} border border-gray-300 dark:border-zinc-700 rounded-lg p-3 text-sm focus:border-primary shadow-sm outline-none transition-colors">
                <option value="" ${mappedVal===""?"selected":""}>Select...</option>
                <option value="Y" ${mappedVal.toLowerCase()==="y"?"selected":""}>Y (Yes)</option>
                <option value="N" ${mappedVal.toLowerCase()==="n"?"selected":""}>N (No)</option>
            </select>`;
        } 
        // 2. Locations
        else if (cleanH.includes("meetinglocation") || cleanH.includes("dismissallocation")) {
            const isDismissal = cleanH.includes("dismissal");
            const optionsList = isDismissal ? dismissalOpts : meetingOpts;
            const placeholder = isDismissal ? "Select Dismissal..." : "Select Meeting...";
            
            let optionsHtml = optionsList.map(opt => {
                const isSelected = mappedVal.toString().trim().toLowerCase() === opt.toString().trim().toLowerCase();
                return `<option value="${opt.replace(/"/g, '&quot;')}" ${isSelected ? "selected" : ""}>${opt}</option>`;
            }).join("");
            
            const valTrimmed = mappedVal.toString().trim();
            if (valTrimmed !== "" && !optionsList.some(o => o.toString().trim().toLowerCase() === valTrimmed.toLowerCase())) {
                optionsHtml += `<option value="${mappedVal.replace(/"/g, '&quot;')}" selected>${mappedVal} (Current)</option>`;
            }
            
            inputHtml = `
            <select name="${header}" data-unknown="${isUnknown}" class="w-full ${colorClass} border border-gray-300 dark:border-zinc-700 rounded-lg p-3 text-sm focus:border-primary shadow-sm outline-none transition-colors">
                <option value="">${placeholder}</option>
                ${optionsHtml}
            </select>`;
        }
        // 3. Vol Paired Typeahead
        else if (cleanH.includes("vol") && cleanH.includes("paired")) {
            currentVolPairedValue = mappedVal.toString().split(/[,|\n]+/).map(s=>s.trim()).filter(s=>s);
            inputHtml = `
            <div class="w-full ${colorClass} border ${isReadOnly ? 'border-gray-200 dark:border-zinc-800' : 'border-gray-300 dark:border-zinc-700 focus-within:border-primary'} rounded-lg p-2 text-sm shadow-sm transition-colors">
                <div id="volPairedTags" class="flex flex-wrap gap-1 ${currentVolPairedValue.length > 0 ? 'mb-2' : ''}">
                    ${currentVolPairedValue.map(v => {
                        const jsSafeVol = v.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        return `<span class="bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700/50 px-2 py-1 rounded text-xs flex items-center gap-1">${v} <i class="fa-solid fa-xmark cursor-pointer hover:text-red-500 ml-1" onclick="removeVolPaired('${jsSafeVol}')"></i></span>`;
                    }).join('')}
                </div>
                <input type="hidden" name="${header}" id="volPairedHidden" value="${currentVolPairedValue.join(', ').replace(/"/g, '&quot;')}">
                <div class="relative">
                    <input type="text" id="volPairedInput" ${isReadOnly ? 'readonly' : ''} class="w-full bg-transparent outline-none placeholder-gray-400 dark:placeholder-gray-500 text-sm p-1" placeholder="Type volunteer name..." autocomplete="off" oninput="filterActiveVols()" onfocus="filterActiveVols()">
                    <ul id="activeVolsList" class="absolute z-50 w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg mt-1 shadow-xl hidden max-h-40 overflow-y-auto pb-6 custom-scrollbar"></ul>
                </div>
            </div>`;
        }
        // 4. Remarks
        else if (cleanH.includes("remark")) {
            inputHtml = `<textarea name="${header}" rows="4" placeholder="${ph}" data-unknown="${isUnknown}" ${isReadOnly ? 'readonly' : ''} class="w-full ${colorClass} border ${isReadOnly ? 'border-gray-200 dark:border-zinc-800 text-gray-500' : 'border-gray-300 dark:border-zinc-700 focus:border-primary'} rounded-lg p-3 text-sm resize-y shadow-sm outline-none transition-colors">${mappedVal}</textarea>`;
        }
        // 5. Default
        else {
            let type = "text";
            if(cleanH.includes("date")) type = "date";
            if(cleanH.includes("time")) type = "time";
            
            inputHtml = `<input name="${header}" type="${type}" value="${mappedVal.replace(/"/g, '&quot;')}" placeholder="${ph}" data-unknown="${isUnknown}" ${isReadOnly ? 'readonly' : ''} class="w-full ${colorClass} border ${isReadOnly ? 'border-gray-200 dark:border-zinc-800 text-gray-500' : 'border-gray-300 dark:border-zinc-700 focus:border-primary'} rounded-lg p-3 text-sm shadow-sm outline-none transition-colors">`;
        }
        
        container.innerHTML += `<div class="${wrapperClass}"><label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 tracking-wide uppercase">${header}</label>${inputHtml}</div>`;
    });
    
    const attSelect = document.querySelector('select[name*="Attending"], select[name*="attending"]');
    if(attSelect) toggleDependentFields(attSelect);
    
    // Only fire background sync if there's actually a completely unknown custom column
    if (hasUnknowns && !isNewVolunteer && selectedPerson) {
        syncBackgroundData(selectedPerson, selectedRole);
    }
}

function toggleDependentFields(el) { 
    const val = el.value; 
    const deps = document.querySelectorAll('.attendance-dependent'); 
    deps.forEach(d => { 
        if(val === 'N') d.classList.add('hidden'); 
        else d.classList.remove('hidden'); 
    }); 
}

// Background Hydration of completely custom dynamic columns (Skeleton UI Replacer)
async function syncBackgroundData(name, role) {
    if (backgroundFetchActive) return;
    backgroundFetchActive = true;
    
    try {
        const res = await apiCall('getPersonData', { url: currentEventUrl, type: role.toLowerCase(), name });
        if (res && res.success && res.data) {
            const form = document.getElementById('attendanceForm');
            const inputs = form.querySelectorAll('input[data-unknown="true"], select[data-unknown="true"], textarea[data-unknown="true"]');
            
            inputs.forEach(input => {
                const headerName = input.name;
                if (headerName) {
                    const fetchedVal = getValueFuzzy(res.data, headerName);
                    
                    if (input.tagName === 'SELECT') {
                        const opts = Array.from(input.options).map(o => o.value.toLowerCase());
                        if (fetchedVal && !opts.includes(fetchedVal.toLowerCase())) {
                            input.add(new Option(`${fetchedVal} (Current)`, fetchedVal));
                        }
                    }
                    
                    input.value = fetchedVal;
                    originalVolData[headerName] = fetchedVal; 
                    
                    input.classList.remove('text-gray-400', 'dark:text-gray-500', 'bg-gray-100', 'dark:bg-zinc-800', 'animate-pulse', 'placeholder-gray-400');
                    input.classList.add('text-gray-900', 'dark:text-white', 'bg-gray-50', 'dark:bg-black');
                    
                    if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') input.placeholder = "";
                    input.dataset.unknown = "false";
                }
            });
        }
    } catch(e) {} finally {
        backgroundFetchActive = false;
    }
}

function getValueFuzzy(dataObj, lookupKey) { 
    if (!dataObj) return ""; 
    if (dataObj[lookupKey] !== undefined) return dataObj[lookupKey]; 
    const cleanLookup = lookupKey.toLowerCase().replace(/[^a-z0-9]/g, ""); 
    for (let key in dataObj) { 
        const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, ""); 
        if (cleanKey === cleanLookup) return dataObj[key]; 
        if (cleanLookup.includes("caregiver") && cleanKey.includes("caregiver")) return dataObj[key]; 
    } 
    return ""; 
}

// ==========================================
// 5. COMPONENT HELPERS (PROJECTS & VOL PAIRED)
// ==========================================

function toggleProjectList(show) { 
    const list = document.getElementById('projectList'); 
    if(show) { 
        list.classList.remove('hidden'); 
        filterProjects(); 
    } else { 
        setTimeout(() => list.classList.add('hidden'), 200); 
    } 
}

function filterProjects() { 
    const input = document.getElementById('newVolProjectSearch'); 
    const filter = input.value.toLowerCase(); 
    const list = document.getElementById('projectList'); 
    const clearBtn = document.getElementById('clearBtn-newVolProjectSearch');
    
    if (filter.length > 0) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
    
    list.innerHTML = ""; 
    const matches = allProjects.filter(p => p.toLowerCase().includes(filter)); 
    
    matches.forEach(proj => { 
        const li = document.createElement('li'); 
        li.className = "px-4 py-3 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-zinc-700 hover:bg-green-600 hover:text-white cursor-pointer text-sm transition-colors last:border-0"; 
        li.innerText = proj; 
        li.onmousedown = (e) => { e.preventDefault(); selectProject(proj); }; 
        list.appendChild(li); 
    }); 
    
    if(matches.length === 0) { 
        const li = document.createElement('li'); 
        li.className = "px-4 py-3 text-sm text-gray-500 dark:text-gray-400 italic bg-white dark:bg-zinc-800"; 
        li.innerText = "No matches found. Typing will save as new project."; 
        list.appendChild(li); 
    } 
}

function selectProject(proj) { 
    document.getElementById('newVolProjectSearch').value = proj; 
    document.getElementById('projectList').classList.add('hidden'); 
    document.getElementById('clearBtn-newVolProjectSearch').classList.remove('hidden');
}

function clearProjectSearch() {
    document.getElementById('newVolProjectSearch').value = '';
    document.getElementById('clearBtn-newVolProjectSearch').classList.add('hidden');
    filterProjects();
}

function filterActiveVols() {
    const input = document.getElementById('volPairedInput');
    const list = document.getElementById('activeVolsList');
    if(!input || !list) return;

    const filter = input.value.toLowerCase().trim();
    list.innerHTML = "";

    if (filter.length === 0) {
        list.classList.add('hidden');
        return;
    }

    const matches = (currentActiveVols || []).filter(v => 
        v.toLowerCase().includes(filter) && !currentVolPairedValue.includes(v)
    );

    list.classList.remove('hidden');

    matches.forEach(match => {
        const li = document.createElement('li');
        li.className = "px-4 py-3 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-zinc-700 hover:bg-blue-600 hover:text-white cursor-pointer text-sm transition-colors last:border-0";
        li.innerText = match;
        li.onmousedown = (e) => { e.preventDefault(); addVolPaired(match); };
        list.appendChild(li);
    });

    if (matches.length === 0) {
        const li = document.createElement('li');
        li.className = "px-4 py-3 text-sm text-gray-500 dark:text-gray-400 italic bg-white dark:bg-zinc-800 cursor-pointer hover:bg-blue-50 dark:hover:bg-zinc-700";
        li.innerText = `Press Enter to add "${input.value.trim()}"`;
        li.onmousedown = (e) => { e.preventDefault(); addVolPaired(input.value.trim()); };
        list.appendChild(li);
    }
}

function addVolPaired(name) {
    if (!name) return;
    if (!currentVolPairedValue.includes(name)) {
        currentVolPairedValue.push(name);
        updateVolPairedUI();
    }
    const input = document.getElementById('volPairedInput');
    input.value = "";
    input.focus();
    filterActiveVols(); 
}

function removeVolPaired(name) {
    currentVolPairedValue = currentVolPairedValue.filter(v => v !== name);
    updateVolPairedUI();
    filterActiveVols();
}

function updateVolPairedUI() {
    const tagsContainer = document.getElementById('volPairedTags');
    const hiddenInput = document.getElementById('volPairedHidden');
    if(!tagsContainer || !hiddenInput) return;

    tagsContainer.innerHTML = currentVolPairedValue.map(v => {
        const jsSafeVol = v.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `<span class="bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700/50 px-2 py-1 rounded text-xs flex items-center gap-1">${v} <i class="fa-solid fa-xmark cursor-pointer hover:text-red-500 ml-1" onclick="removeVolPaired('${jsSafeVol}')"></i></span>`;
    }).join('');

    if (currentVolPairedValue.length > 0) tagsContainer.classList.add('mb-2');
    else tagsContainer.classList.remove('mb-2');

    hiddenInput.value = currentVolPairedValue.join(', ');
}

document.addEventListener('keydown', function(e) {
    if (e.target && e.target.id === 'volPairedInput') {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            if (e.target.value.trim()) addVolPaired(e.target.value.trim());
        }
    }
});

document.addEventListener('click', function(e) {
    const list = document.getElementById('activeVolsList');
    const input = document.getElementById('volPairedInput');
    if(list && !list.classList.contains('hidden') && e.target !== input && !list.contains(e.target)) {
        list.classList.add('hidden');
    }
});

// ==========================================
// 6. FORM SUBMISSION (DELTA)
// ==========================================
function submitForm(e) { 
    e.preventDefault(); 
    
    const volInput = document.getElementById('volPairedInput');
    if (volInput && volInput.value.trim()) {
        addVolPaired(volInput.value.trim());
    }
    
    let currentFormData = {}; 
    const formData = new FormData(document.getElementById('attendanceForm')); 
    formData.forEach((value, key) => currentFormData[key] = value); 
    
    let target = selectedPerson; 
    if (!target) { 
        for (let k in currentFormData) { 
            if (k.toLowerCase().includes("name")) { 
                target = currentFormData[k]; 
                break; 
            } 
        } 
    }
    
    let deltaObj = {};
    let isChanged = false;
    for (let key in currentFormData) {
        // Handle undefined edge cases securely
        let oldV = originalVolData[key] || "";
        let newV = currentFormData[key] || "";
        if (oldV.toString().trim() !== newV.toString().trim()) {
            deltaObj[key] = newV;
            isChanged = true;
        }
    }
    
    if (!isChanged) {
        showOverlay('success', 'No changes detected.');
        setTimeout(() => { closeOverlay(); cancelForm(); }, 1500);
        return;
    }
    
    // Crucial identifiers for backend lookup
    for (let k in currentFormData) {
        if (k.toLowerCase().includes("name") || k.toLowerCase().includes("project")) {
            deltaObj[k] = currentFormData[k];
        }
    }
    
    const btnText = document.getElementById('submitBtnText');
    const btnSpin = document.getElementById('submitBtnSpinner');
    const btn = document.getElementById('submitBtn');
    
    btnText.innerText = "Saving...";
    btnSpin.classList.remove('hidden');
    btn.disabled = true;
    
    const payload = { sheetUrl: currentEventUrl, type: selectedRole, data: deltaObj, targetName: target }; 
    
    fetchWithRetry('submitAttendanceData', payload).then(res => { 
        btn.disabled = false;
        btnText.innerText = "Update Attendance";
        btnSpin.classList.add('hidden');
        
        if (res && res.success) {
            showOverlay('success', res.message || "Attendance updated.");
            
            // Instantly update Local Event Cache to preserve Optimistic UI bounds
            if (currentEventData) {
                const arr = selectedRole === 'TRAINEE' ? currentEventData.trainees : currentEventData.volunteers;
                let cachedP = arr.find(p => p.name === target);
                if (!cachedP && isNewVolunteer) {
                    cachedP = { name: target, role: selectedRole, extra: {} };
                    arr.push(cachedP);
                }
                if (cachedP) {
                    for (let key in deltaObj) {
                        const h = key.toLowerCase().replace(/[^a-z0-9]/g, "");
                        const val = deltaObj[key];
                        if (h.includes("attending")) cachedP.attending = val.toLowerCase();
                        if (h.includes("meetinglocation")) { if (selectedRole==='TRAINEE') {if(!cachedP.extra) cachedP.extra={}; cachedP.extra.t_meet=val;} else {if(!cachedP.extra) cachedP.extra={}; cachedP.extra.v_meet=val;} }
                        if (h.includes("dismissallocation")) { if (selectedRole==='TRAINEE') {if(!cachedP.extra) cachedP.extra={}; cachedP.extra.t_dismiss=val;} else {if(!cachedP.extra) cachedP.extra={}; cachedP.extra.v_dismiss=val;} }
                        if (h.includes("vol") && h.includes("paired")) cachedP.volPaired = val;
                        if (h.includes("project")) cachedP.project = val;
                    }
                }
            }
            
            setTimeout(() => { 
                closeOverlay(); 
                cancelForm(); 
            }, 1500);
        } else {
            showOverlay('error', res ? res.message : "Failed to connect to backend.");
        }
    }); 
}