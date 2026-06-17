function autoScrollAndFocus(input) { toggleSearchList(true); setTimeout(() => { input.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 300); }

function setVolType(type, btn) { 
    selectedVolType = type; 
    currentVolTypeRequest = type; 
    allNames = []; 
    document.getElementById('volNameList').innerHTML = ""; 
    resetSearch(); 
    document.querySelectorAll('.vol-type-btn').forEach(b => { 
        b.classList.remove('bg-green-600', 'text-white', 'border-transparent'); 
        b.classList.add('bg-slate-900', 'text-slate-300', 'border-slate-600'); 
    }); 
    btn.classList.remove('bg-slate-900', 'text-slate-300', 'border-slate-600'); 
    btn.classList.add('bg-green-600', 'text-white', 'border-transparent'); 
    document.getElementById('volNameSection').classList.remove('hidden'); 
    document.getElementById('volFormContainer').classList.add('hidden'); 
    if (type === 'volunteer') { 
        document.getElementById('addNewVolContainer').classList.remove('hidden'); 
    } else { 
        document.getElementById('addNewVolContainer').classList.add('hidden'); 
    } 
    loadVolNames(type); 
}

function resetVolForm() { 
    document.getElementById('volNameSection').classList.add('hidden'); 
    document.getElementById('volFormContainer').classList.add('hidden'); 
    document.getElementById('volSubmitBtn').innerText = "Update Attendance"; 
    selectedVolType = null; 
    currentVolTypeRequest = null; 
    allNames = []; 
    document.querySelectorAll('.vol-type-btn').forEach(b => { 
        b.classList.remove('bg-green-600', 'text-white', 'border-transparent'); 
        b.classList.add('bg-slate-900', 'text-slate-300', 'border-slate-600'); 
    }); 
    resetSearch(); 
}

function resetSearch() { 
    const input = document.getElementById('volNameSearch'); 
    input.value = ""; 
    toggleSearchList(false); 
    document.getElementById('clearSearchBtn').classList.add('hidden'); 
}

function loadVolNames(requestedType) { 
    const url = document.getElementById('volSheetSelector').value; 
    const loader = document.getElementById('nameLoader'); 
    const input = document.getElementById('volNameSearch'); 
    if(!url || !requestedType || url === "Select an Event") return; 
    input.placeholder = "Loading names..."; 
    input.disabled = true; 
    loader.classList.remove('hidden'); 
    apiCall('getNamesList', { url: url, type: requestedType }).then(res => { 
        if (currentVolTypeRequest !== requestedType) return; 
        loader.classList.add('hidden'); 
        input.disabled = false; 
        input.placeholder = "Type to search..."; 
        if(res.success) allNames = res.names; 
    }); 
}

function toggleSearchList(show) { 
    const list = document.getElementById('volNameList'); 
    if(show) { 
        list.classList.remove('hidden'); 
        if(document.getElementById('volNameSearch').value.length > 0) filterNames(); 
    } else { 
        setTimeout(() => list.classList.add('hidden'), 200); 
    } 
}

function clearSearch() { 
    document.getElementById('volNameSearch').value = ""; 
    filterNames(); 
    document.getElementById('volFormContainer').classList.add('hidden'); 
    document.getElementById('clearSearchBtn').classList.add('hidden'); 
}

function filterNames() { 
    const input = document.getElementById('volNameSearch'); 
    const filter = input.value.toLowerCase(); 
    const list = document.getElementById('volNameList'); 
    const clearBtn = document.getElementById('clearSearchBtn'); 
    if(filter.length > 0) { 
        list.classList.remove('hidden'); 
        clearBtn.classList.remove('hidden'); 
    } else { 
        list.classList.add('hidden'); 
        clearBtn.classList.add('hidden'); 
        return; 
    } 
    list.innerHTML = ""; 
    const matches = allNames.filter(n => n.toLowerCase().includes(filter)); 
    matches.forEach(name => { 
        const li = document.createElement('li'); 
        li.className = "px-4 py-3 bg-slate-800 text-slate-200 border-b border-slate-600 hover:bg-cyan-600 hover:text-white cursor-pointer text-sm transition-colors last:border-0"; 
        li.innerText = name; 
        li.onmousedown = () => selectName(name); 
        list.appendChild(li); 
    }); 
    if(matches.length === 0) { 
        const li = document.createElement('li'); 
        li.className = "px-4 py-3 text-sm text-slate-500 italic"; 
        li.innerText = "No matches found."; 
        list.appendChild(li); 
    } 
}

function selectName(name) { 
    document.getElementById('volNameSearch').value = name; 
    document.getElementById('volNameList').classList.add('hidden'); 
    loadVolData(name, false); 
}

function showAddNewForm() { 
    const input = document.getElementById('volNameSearch'); 
    input.value = ""; 
    document.getElementById('volNameList').classList.add('hidden'); 
    loadVolData(null, true); 
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

function toggleDependentFields(el) { 
    const val = el.value; 
    const deps = document.querySelectorAll('.attendance-dependent'); 
    deps.forEach(d => { 
        if(val === 'N') d.classList.add('hidden'); 
        else d.classList.remove('hidden'); 
    }); 
}

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
    list.innerHTML = ""; 
    const matches = allProjects.filter(p => p.toLowerCase().includes(filter)); 
    matches.forEach(proj => { 
        const li = document.createElement('li'); 
        li.className = "px-4 py-3 bg-slate-800 text-slate-200 border-b border-slate-600 hover:bg-cyan-600 hover:text-white cursor-pointer text-sm transition-colors last:border-0"; 
        li.innerText = proj; 
        li.onmousedown = () => selectProject(proj); 
        list.appendChild(li); 
    }); 
    if(matches.length === 0) { 
        const li = document.createElement('li'); 
        li.className = "px-4 py-3 text-sm text-slate-500 italic"; 
        li.innerText = "No matches found."; 
        list.appendChild(li); 
    } 
}

function selectProject(proj) { 
    document.getElementById('newVolProjectSearch').value = proj; 
    document.getElementById('projectList').classList.add('hidden'); 
}

function loadVolData(name, isManualNew) { 
    const url = document.getElementById('volSheetSelector').value; 
    const container = document.getElementById('volFormContainer'); 
    const fieldsDiv = document.getElementById('dynamicFields'); 
    const title = document.getElementById('formTitle'); 
    const submitBtn = document.getElementById('volSubmitBtn'); 
    const projectContainer = document.getElementById('newVolProjectContainer'); 
    
    container.classList.remove('hidden'); 
    fieldsDiv.innerHTML = '<div class="text-center"><div class="loader inline-block"></div></div>'; 
    
    if (isManualNew) { 
        title.innerText = "Add New Volunteer"; 
        submitBtn.innerText = "Add New Volunteer & Update Attendance"; 
        projectContainer.classList.remove('hidden'); 
        document.getElementById('newVolProjectSearch').value = ""; 
        document.getElementById('newVolProjectSearch').required = true; 
    } else { 
        title.innerText = "Loading..."; 
        submitBtn.innerText = "Update Attendance"; 
        projectContainer.classList.add('hidden'); 
        document.getElementById('newVolProjectSearch').required = false; 
    } 
    
    apiCall('getPersonData', { url: url, type: selectedVolType, name: name }).then(res => { 
        fieldsDiv.innerHTML = ''; 
        if(res.success) { 
            const data = res.data; 
            const config = res.config; 
            const meetingOpts = res.meetingOpts || []; 
            const dismissalOpts = res.dismissalOpts || []; 
            const isNew = res.isNew || isManualNew; 
            allProjects = res.projectOpts || []; 
            
            title.innerHTML = isNew ? `Add New: <span class="text-green-400">Volunteer</span>` : `Update: <span class="text-blue-400">${name}</span>`; 
            if(isNew) submitBtn.innerText = "Add New Volunteer & Update Attendance"; 
            else submitBtn.innerText = "Update Attendance"; 
            
            let fieldsToShow = (config && config.length > 0) ? config : res.headers.map(h => h.replace(/\[.*?\]/g,"").trim()); 
            if (isNew) { 
                const nameFieldExists = fieldsToShow.some(f => f.toLowerCase().includes("name")); 
                if (!nameFieldExists) { 
                    const rawNameHeader = res.headers.find(h => h.toLowerCase().includes("name")) || "Volunteer Name"; 
                    fieldsToShow.unshift(rawNameHeader.replace(/\[.*?\]/g,"").trim()); 
                } 
            } 
            
            fieldsToShow.forEach(header => { 
                let val = isNew ? "" : (getValueFuzzy(data, header)); 
                let cleanH = header.toLowerCase(); 
                let isNameField = cleanH.includes("name"); 
                if(isNew && cleanH.includes("project")) return; 
                let isReadOnly = isNameField && !isNew; 
                if(isNew && isNameField) val = ""; 
                if(!isNew && isNameField) val = name; 
                let inputHtml = ""; 
                let wrapperClass = "mb-1"; 
                if (!isNameField && !cleanH.includes("attending")) { wrapperClass += " attendance-dependent"; } 
                
                if (cleanH.includes("attending")) { 
                    inputHtml = ` <select name="${header}" onchange="toggleDependentFields(this)" class="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 text-sm focus:border-green-500"> <option value="" ${val===""?"selected":""}>Select...</option> <option value="Y" ${val.toLowerCase()==="y"?"selected":""}>Y (Yes)</option> <option value="N" ${val.toLowerCase()==="n"?"selected":""}>N (No)</option> </select>`; 
                } else if (cleanH.includes("meeting location") || cleanH.includes("dismissal location")) { 
                    const isDismissal = cleanH.includes("dismissal"); 
                    const optionsList = isDismissal ? dismissalOpts : meetingOpts; 
                    const placeholder = isDismissal ? "Select Dismissal..." : "Select Meeting..."; 
                    let optionsHtml = optionsList.map(opt => { 
                        const isSelected = val.toString().trim().toLowerCase() === opt.toString().trim().toLowerCase(); 
                        return `<option value="${opt}" ${isSelected ? "selected" : ""}>${opt}</option>`; 
                    }).join(""); 
                    const valTrimmed = val.toString().trim(); 
                    if (valTrimmed !== "") { 
                        const listHasValue = optionsList.some(opt => opt.toString().trim().toLowerCase() === valTrimmed.toLowerCase()); 
                        if (!listHasValue) { 
                            optionsHtml += `<option value="${val}" selected>${val} (Current)</option>`; 
                        } 
                    } 
                    inputHtml = ` <select name="${header}" class="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 text-sm focus:border-green-500"> <option value="">${placeholder}</option> ${optionsHtml} </select>`; 
                } else if (cleanH.includes("remark")) { 
                    inputHtml = `<textarea name="${header}" rows="8" ${isReadOnly ? 'readonly' : ''} class="w-full bg-slate-900 border ${isReadOnly ? 'border-slate-700 text-slate-500' : 'border-slate-600 text-white focus:border-green-500'} rounded p-2 text-sm resize-y [color-scheme:dark]">${val}</textarea>`; 
                } else { 
                    let type = "text"; 
                    if(cleanH.includes("date")) type = "date"; 
                    if(cleanH.includes("time")) type = "time"; 
                    inputHtml = `<input name="${header}" type="${type}" value="${val}" ${isReadOnly ? 'readonly' : ''} class="w-full bg-slate-900 border ${isReadOnly ? 'border-slate-700 text-slate-500' : 'border-slate-600 text-white focus:border-green-500'} rounded p-2 text-sm [color-scheme:dark]">`; 
                } 
                fieldsDiv.innerHTML += `<div class="${wrapperClass}"><label class="block text-xs font-bold text-slate-400 mb-1">${header}</label>${inputHtml}</div>`; 
            }); 
            
            const attSelect = document.querySelector('select[name*="Attending"], select[name*="attending"]'); 
            if(attSelect) toggleDependentFields(attSelect); 
        } else { 
            fieldsDiv.innerHTML = '<div class="text-red-400">Error: ' + res.message + '</div>'; 
        } 
    }); 
}

function submitAttendance(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('volSubmitBtn'); 
    
    showOverlay('loading', 'Saving Attendance...');
    
    const formEl = document.getElementById('attendanceForm'); 
    const formData = new FormData(formEl); 
    let dataObj = {}; 
    formData.forEach((value, key) => dataObj[key] = value); 
    let target = document.getElementById('volNameSearch').value; 
    if (!target || target === "") { 
        for (let k in dataObj) { 
            if (k.toLowerCase().includes("name")) { 
                target = dataObj[k]; 
                break; 
            } 
        } 
    } 
    
    const payload = { sheetUrl: document.getElementById('volSheetSelector').value, type: selectedVolType, data: dataObj, targetName: target }; 
    
    apiCall('submitAttendanceData', payload).then(res => { 
        if(res.success) {
            showOverlay('success', res.message);
            if(selectedVolType === 'volunteer') { 
                if(res.message.includes("added")) { 
                    resetVolForm(); 
                    document.getElementById('volNameSearch').value = ""; 
                } 
                const url = document.getElementById('volSheetSelector').value; 
                apiCall('getNamesList', { url: url, type: 'volunteer' }).then(r => { if(r.success) allNames = r.names; }); 
            } 
        } else {
            showOverlay('error', res.message);
        }
    }); 
}