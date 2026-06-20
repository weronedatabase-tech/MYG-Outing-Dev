function showView(viewId) { 
  currentActiveView = viewId; 
  document.querySelectorAll('main > div').forEach(div => div.classList.add('hidden')); 
  document.getElementById('view-' + viewId).classList.remove('hidden'); 
  document.getElementById('volFormStatus').classList.add('hidden'); 
  document.getElementById('scrubStatus').classList.add('hidden'); 
  document.getElementById('createStatusArea').classList.add('hidden'); 
  document.getElementById('settingsStatus').classList.add('hidden'); 
  
  const mainContainer = document.getElementById('mainContainer');
  if (viewId === 'comm-attendance') {
      document.body.classList.add('overflow-hidden', 'overscroll-none');
      document.body.classList.remove('pb-20');
      mainContainer.classList.remove('p-4', 'mt-2');
      mainContainer.classList.add('p-1', 'mt-1');
  } else {
      document.body.classList.remove('overflow-hidden', 'overscroll-none');
      document.body.classList.add('pb-20');
      mainContainer.classList.remove('p-1', 'mt-1');
      mainContainer.classList.add('p-4', 'mt-2');
  }

  // Handle Dynamic Navbar
  const navDefault = document.getElementById('navDefault');
  const navContext = document.getElementById('navContext');
  const titleEl = document.getElementById('navContextTitle');
  
  navDefault.classList.add('hidden');
  navContext.classList.remove('hidden');
  
  if (viewId === 'comm') {
      titleEl.innerText = 'Comm Dashboard';
      titleEl.className = 'text-sm font-extrabold text-blue-400 leading-none mb-0.5 truncate';
  } else if (viewId === 'actual-attendance') {
      titleEl.innerText = 'Select Event for Tracker';
      titleEl.className = 'text-sm font-extrabold text-teal-400 leading-none mb-0.5 truncate';
  } else if (viewId === 'comm-attendance') {
      // Title is updated dynamically in loadCommAttendanceData
      titleEl.className = 'text-sm font-extrabold text-teal-400 leading-none mb-0.5 truncate';
  } else if (viewId === 'volunteer') {
      titleEl.innerText = 'Attendance Update';
      titleEl.className = 'text-sm font-extrabold text-green-400 leading-none mb-0.5 truncate';
  } else if (viewId === 'settings') {
      titleEl.innerText = 'Field Configuration';
      titleEl.className = 'text-sm font-extrabold text-purple-400 leading-none mb-0.5 truncate';
  } else {
      // Landing page shows default logo
      navDefault.classList.remove('hidden');
      navContext.classList.add('hidden');
  }

  if (viewId === 'comm' || viewId === 'volunteer' || viewId === 'actual-attendance') loadSheets(viewId); 
  if (viewId === 'settings') loadSettings(); 
}

window.handleNavBack = function() {
  if (currentActiveView === 'comm-attendance') {
      showView('actual-attendance');
  } else {
      showView('landing');
  }
};

function refreshApp() { 
  const icon = document.getElementById('refreshIcon'); 
  icon.classList.add('fa-spin'); 
  
  // Force Service Worker Update
  if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
          for (let reg of regs) {
              reg.update();
          }
      });
  }
  
  // Clear caches to force UI update, then reload securely
  if ('caches' in window) {
      caches.keys().then(names => {
          Promise.all(names.map(name => caches.delete(name))).then(() => {
              window.location.reload(true);
          });
      });
  } else {
      setTimeout(() => { window.location.reload(true); }, 300);
  }
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