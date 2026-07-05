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
        window.appSettings = res;
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
    if (state.commSheet) window.currentCommAttSheetUrl = state.commSheet;
    if (state.pairSheet) window.currentManualPairingSheetUrl = state.pairSheet;
    if (state.groupSheet) window.currentGroupingSheetUrl = state.groupSheet;
    if (state.isFiltered !== undefined) window.isFilteredManualPairingMode = state.isFiltered;
    if (state.filteredSource) window.filteredManualPairingSourceView = state.filteredSource;

    // Set placeholder context titles until the data payload completely evaluates
    const titleEl = document.getElementById('navContextTitle');
    if (titleEl) {
        if (view === 'comm-attendance') titleEl.innerText = "Live Tracker (Restoring...)";
        if (view === 'manual-pairing') titleEl.innerText = state.isFiltered ? "Filtered Manual Pair" : "Manual Pair (Restoring...)";
        if (view === 'manual-grouping') titleEl.innerText = "Manual Group (Restoring...)";
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
        window.currentSheetList = res.data;
        
        // Select the most immediate upcoming event
        const immediateEventUrl = res.data[0].sheetUrl;
        hydratedEventUrl = immediateEventUrl;
        
        // Silently pre-fetch trainee and volunteer names for the most immediate event
        // This ensures that clicking "Volunteer/Trainee" has zero wait time
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