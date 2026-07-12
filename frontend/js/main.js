document.addEventListener("DOMContentLoaded", () => {
// Theme initialization
if(localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

// Environment Bar Setup based on config.js variable ENV
const envBar = document.getElementById('envBar');
if (ENV === 'Dev') {
  envBar.innerText = 'Testing';
  envBar.classList.add('bg-red-600', 'border-red-800');
  envBar.classList.remove('hidden');
} else if (ENV === 'Exp') {
  envBar.innerText = 'Experimentation';
  envBar.classList.add('bg-purple-600', 'border-purple-800');
  envBar.classList.remove('hidden');
}

console.log(`Running in ${ENV} mode connected to: ${API_URL}`);

// Preload Settings
apiCall('getAppSettings', null).then(res => {
  if (res && res.success !== false) {
      appSettings = res;
  }
});

// Admin Auth Silent Verification
const savedKey = localStorage.getItem('adminKey');
if (savedKey) {
  apiCall('verifyAdminPassword', savedKey).then(isValid => {
      if (isValid) {
          isAdminAuthenticated = true;
      } else {
          localStorage.removeItem('adminKey');
          isAdminAuthenticated = false;
      }
  });
}

// Restore State Logic (After Refresh)
const savedStateStr = sessionStorage.getItem('restoreState');
if (savedStateStr) {
  sessionStorage.removeItem('restoreState');
  try {
      const savedState = JSON.parse(savedStateStr);
      restoreAppState(savedState);
  } catch(e) {}
}

// Start silent idle-time hydration
silentHydration();
});

// --- STATE RESTORATION LOGIC ---
function restoreAppState(state) {
const view = state.view;
if (!view || view === 'landing') return;

const executeRestore = () => {
  // Re-assign global states
  if (state.commSheet) currentCommAttSheetUrl = state.commSheet;
  if (state.pairSheet) currentManualPairingSheetUrl = state.pairSheet;
  if (state.groupSheet) currentGroupingSheetUrl = state.groupSheet;
  if (state.isFiltered !== undefined) isFilteredManualPairingMode = state.isFiltered;
  if (state.filteredSource) filteredManualPairingSourceView = state.filteredSource;

  // Helper to instantly map the actual title if hydration finished early
  const getName = (url) => {
      if (currentSheetList && currentSheetList.length > 0) {
          const s = currentSheetList.find(x => x.sheetUrl === url);
          if (s) return s.displayName;
      }
      return null;
  };

  // Set context titles reliably
  const titleEl = document.getElementById('navContextTitle');
  if (titleEl) {
      if (view === 'comm-attendance') {
          const n = getName(state.commSheet);
          titleEl.innerText = n ? "Live: " + n : "Live Tracker (Restoring...)";
      } else if (view === 'manual-pairing') {
          const n = getName(state.pairSheet);
          const prefix = state.isFiltered ? "Filtered Pair: " : "Manual Pair: ";
          titleEl.innerText = n ? prefix + n : prefix + "(Restoring...)";
      } else if (view === 'manual-grouping') {
          const n = getName(state.groupSheet);
          titleEl.innerText = n ? "Manual Group: " + n : "Manual Group (Restoring...)";
      }
  }

  // View Routing
  if (view === 'comm' || view === 'settings' || view === 'actual-attendance' || view === 'volunteer') {
      showView(view);
  } else if (view === 'comm-attendance') {
      if (typeof loadCommAttendanceData === 'function') {
          showView('comm-attendance');
          loadCommAttendanceData();
      } else {
          setTimeout(() => restoreAppState(state), 100);
      }
  } else if (view === 'manual-pairing') {
      if (typeof loadManualPairingData === 'function') {
          showView('manual-pairing');
          loadManualPairingData();
      } else {
          setTimeout(() => restoreAppState(state), 100);
      }
  } else if (view === 'manual-grouping') {
      if (typeof loadGroupingData === 'function') {
          showView('manual-grouping');
          loadGroupingData();
      } else {
          setTimeout(() => restoreAppState(state), 100);
      }
  }
};

const adminViews = ['comm', 'settings', 'manual-pairing', 'manual-grouping', 'comm-attendance'];
if (adminViews.includes(view)) {
  requestAccess(null, executeRestore);
} else {
  executeRestore();
}
}

// --- IDLE-TIME HYDRATION LOGIC ---
function silentHydration() {
if (isHydrated) return;
console.log("Starting silent hydration...");

// Pre-fetch the recent outing sheets without blocking UI
apiCall('getRecentOutingSheets', null).then(res => {
  if (res && res.success && res.data && res.data.length > 0) {
      currentSheetList = res.data;
      
      // Automatically resolve restoring titles securely!
      const titleEl = document.getElementById('navContextTitle');
      if (titleEl && titleEl.innerText.includes('(Restoring...)')) {
          if (currentActiveView === 'comm-attendance' && currentCommAttSheetUrl) {
              const s = currentSheetList.find(x => x.sheetUrl === currentCommAttSheetUrl);
              if (s) titleEl.innerText = "Live: " + s.displayName;
          } else if (currentActiveView === 'manual-pairing' && currentManualPairingSheetUrl) {
              const s = currentSheetList.find(x => x.sheetUrl === currentManualPairingSheetUrl);
              if (s) titleEl.innerText = (isFilteredManualPairingMode ? "Filtered Pair: " : "Manual Pair: ") + s.displayName;
          } else if (currentActiveView === 'manual-grouping' && currentGroupingSheetUrl) {
              const s = currentSheetList.find(x => x.sheetUrl === currentGroupingSheetUrl);
              if (s) titleEl.innerText = "Manual Group: " + s.displayName;
          }
      }
      
      // Select the most immediate upcoming event
      const immediateEventUrl = res.data[0].sheetUrl;
      hydratedEventUrl = immediateEventUrl;
      
      // Silently pre-fetch trainee and volunteer names for the most immediate event
      apiCall('getNamesList', { url: immediateEventUrl, type: 'volunteer' });
      apiCall('getNamesList', { url: immediateEventUrl, type: 'trainee' });
      
      isHydrated = true;
      console.log("Silent hydration complete.");
  }
}).catch(e => console.warn("Hydration failed silently", e));
}

// --- SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
window.addEventListener('load', () => {
  navigator.serviceWorker.register('sw.js').then(reg => {
      console.log('Service Worker Registered successfully');
  }).catch(err => {
      console.warn('Service Worker registration failed:', err);
  });
});
}