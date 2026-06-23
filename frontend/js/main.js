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
});

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