function loadSettings() { 
  const loader = document.getElementById('settingsLoader'); 
  const content = document.getElementById('settingsContent'); 
  loader.classList.remove('hidden'); 
  content.classList.add('hidden'); 
  
  apiCall('getAppSettings', null).then(savedSettings => { 
      if (!savedSettings || savedSettings.success === false) savedSettings = {};
      
      window.appSettings = savedSettings;
      if (!savedSettings.shareFormat) savedSettings.shareFormat = DEF_SHARE_FORMAT;
      if (!savedSettings.popupFormat) savedSettings.popupFormat = DEF_POPUP_FORMAT;
      
      const shareEl = document.getElementById('settingShareFormat');
      const popupEl = document.getElementById('settingPopupFormat');
      if (shareEl) shareEl.value = savedSettings.shareFormat;
      if (popupEl) popupEl.value = savedSettings.popupFormat;
      
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
      let checked = (saved.traineeCols && saved.traineeCols.includes(h) || (!saved.traineeCols || saved.traineeCols.length === 0)) ? 'checked' : ''; 
      tContainer.innerHTML += `<label class="flex items-center gap-2"><input type="checkbox" class="t-col-check accent-purple-600 dark:accent-purple-500 w-4 h-4 cursor-pointer" value="${h}" ${checked}> <span class="text-gray-700 dark:text-gray-300 font-medium">${h}</span></label>`; 
  }); 
  vHeaders.forEach(h => { 
      let checked = (saved.volCols && saved.volCols.includes(h) || (!saved.volCols || saved.volCols.length === 0)) ? 'checked' : ''; 
      vContainer.innerHTML += `<label class="flex items-center gap-2"><input type="checkbox" class="v-col-check accent-purple-600 dark:accent-purple-500 w-4 h-4 cursor-pointer" value="${h}" ${checked}> <span class="text-gray-700 dark:text-gray-300 font-medium">${h}</span></label>`; 
  }); 
}

function saveSettings() { 
  const tCols = Array.from(document.querySelectorAll('.t-col-check:checked')).map(cb => cb.value); 
  const vCols = Array.from(document.querySelectorAll('.v-col-check:checked')).map(cb => cb.value); 
  
  const shareEl = document.getElementById('settingShareFormat');
  const popupEl = document.getElementById('settingPopupFormat');
  
  const shareFmt = shareEl ? shareEl.value : DEF_SHARE_FORMAT;
  const popupFmt = popupEl ? popupEl.value : DEF_POPUP_FORMAT;
  
  const settings = { 
      traineeCols: tCols, 
      volCols: vCols,
      shareFormat: shareFmt,
      popupFormat: popupFmt
  }; 
  
  window.appSettings = settings;
  
  showFlashMessage('settingsStatus', "Saving...", 'success'); 
  apiCall('saveAppSettings', settings).then(res => { 
      showFlashMessage('settingsStatus', res.message, 'success'); 
  }); 
}

function resetSetting(type) {
  if (type === 'share') document.getElementById('settingShareFormat').value = DEF_SHARE_FORMAT;
  if (type === 'popup') document.getElementById('settingPopupFormat').value = DEF_POPUP_FORMAT;
}