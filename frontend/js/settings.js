function loadSettings() { 
    const loader = document.getElementById('settingsLoader'); 
    const content = document.getElementById('settingsContent'); 
    loader.classList.remove('hidden'); 
    content.classList.add('hidden'); 
    apiCall('getAppSettings', null).then(savedSettings => { 
        apiCall('getTemplateHeaders', null).then(res => { 
            document.getElementById('settingsLoader').classList.add('hidden'); 
            document.getElementById('settingsContent').classList.remove('hidden'); 
            if(res.success) { 
                renderSettingsCheckboxes(res.tHeaders, res.vHeaders, savedSettings); 
            } else { 
                alert("Error loading template headers: " + res.message); 
            } 
        }); 
    }); 
}

function renderSettingsCheckboxes(tHeaders, vHeaders, saved) { 
    const tContainer = document.getElementById('traineeColsContainer'); 
    const vContainer = document.getElementById('volColsContainer'); 
    tContainer.innerHTML = ''; 
    vContainer.innerHTML = ''; 
    tHeaders.forEach(h => { 
        let checked = (saved.traineeCols.includes(h) || saved.traineeCols.length === 0) ? 'checked' : ''; 
        tContainer.innerHTML += `<label class="flex items-center gap-2"><input type="checkbox" class="t-col-check accent-purple-500" value="${h}" ${checked}> <span class="text-slate-300">${h}</span></label>`; 
    }); 
    vHeaders.forEach(h => { 
        let checked = (saved.volCols.includes(h) || saved.volCols.length === 0) ? 'checked' : ''; 
        vContainer.innerHTML += `<label class="flex items-center gap-2"><input type="checkbox" class="v-col-check accent-purple-500" value="${h}" ${checked}> <span class="text-slate-300">${h}</span></label>`; 
    }); 
}

function saveSettings() { 
    const tCols = Array.from(document.querySelectorAll('.t-col-check:checked')).map(cb => cb.value); 
    const vCols = Array.from(document.querySelectorAll('.v-col-check:checked')).map(cb => cb.value); 
    const settings = { traineeCols: tCols, volCols: vCols }; 
    showFlashMessage('settingsStatus', "Saving...", 'success'); 
    apiCall('saveAppSettings', settings).then(res => { 
        showFlashMessage('settingsStatus', res.message, 'success'); 
    }); 
}