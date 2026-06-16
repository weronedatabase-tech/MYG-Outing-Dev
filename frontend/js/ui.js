function showView(viewId) { 
    currentActiveView = viewId; 
    document.querySelectorAll('main > div').forEach(div => div.classList.add('hidden')); 
    document.getElementById('view-' + viewId).classList.remove('hidden'); 
    document.getElementById('volFormStatus').classList.add('hidden'); 
    document.getElementById('scrubStatus').classList.add('hidden'); 
    document.getElementById('createStatusArea').classList.add('hidden'); 
    document.getElementById('settingsStatus').classList.add('hidden'); 
    
    if (viewId === 'comm' || viewId === 'volunteer') loadSheets(viewId); 
    if (viewId === 'settings') loadSettings(); 
}

function refreshApp() { 
    const icon = document.getElementById('refreshIcon'); 
    icon.classList.add('fa-spin'); 
    
    // Clear caches to force UI update
    if ('caches' in window) {
        caches.keys().then(names => {
            for (let name of names) caches.delete(name);
        });
    }
    
    // Hard reload the window to bypass local storage/cache and fetch the newest HTML
    setTimeout(() => {
        window.location.reload(true);
    }, 300);
}

// --- OVERLAY LOGIC ---
function showOverlay(type, msg) {
    document.getElementById('fullPageOverlay').classList.remove('hidden');
    document.getElementById('overlayLoading').classList.add('hidden');
    document.getElementById('overlaySuccess').classList.add('hidden');
    document.getElementById('overlayError').classList.add('hidden');
    
    if (type === 'loading') {
        document.getElementById('overlayLoading').classList.remove('hidden');
        document.getElementById('overlayLoadingText').innerText = msg || "Processing...";
    } else if (type === 'success') {
        document.getElementById('overlaySuccess').classList.remove('hidden');
        document.getElementById('overlaySuccessText').innerText = msg;
    } else {
        document.getElementById('overlayError').classList.remove('hidden');
        document.getElementById('overlayErrorText').innerText = msg;
    }
}

function closeOverlay() {
    document.getElementById('fullPageOverlay').classList.add('hidden');
}

function showFlashMessage(elementId, message, type) { 
    const el = document.getElementById(elementId); 
    el.innerText = message; 
    el.classList.remove('hidden', 'bg-green-900/20', 'text-green-400', 'border-green-500/30', 'bg-red-900/20', 'text-red-400', 'border-red-500/30'); 
    if (type === 'success') { 
        el.classList.add('bg-green-900/20', 'text-green-400', 'border', 'border-green-500/30'); 
    } else { 
        el.classList.add('bg-red-900/20', 'text-red-400', 'border', 'border-red-500/30'); 
    } 
    el.classList.remove('hidden'); 
    setTimeout(() => { el.classList.add('hidden'); }, 5000); 
}

function formatDateDisplay(input) { 
    const val = input.value; 
    if(!val) { input.type='text'; return; } 
    const date = new Date(val); 
    if(isNaN(date.getTime())) { input.type='text'; return; } 
    const day = date.getDate().toString().padStart(2, '0'); 
    const month = date.toLocaleString('default', { month: 'short' }); 
    const year = date.getFullYear(); 
    input.type = 'text'; 
    input.value = `${day} ${month} ${year}`; 
}