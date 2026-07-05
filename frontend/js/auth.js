function requestAccess(viewId, actionFn = null) { 
  if (isAdminAuthenticated) { 
      executeAccess(viewId, actionFn);
  } else { 
      const savedKey = localStorage.getItem('adminKey');
      if (savedKey) {
          // Instantly verify with server before proceeding to ensure password wasn't changed
          showOverlay('loading', 'Verifying session...');
          apiCall('verifyAdminPassword', savedKey).then(isValid => {
              closeOverlay();
              if (isValid) {
                  isAdminAuthenticated = true;
                  executeAccess(viewId, actionFn);
              } else {
                  // Password was changed elsewhere, wipe invalid token and prompt
                  localStorage.removeItem('adminKey');
                  promptAuthModal(viewId, actionFn);
              }
          });
      } else {
          promptAuthModal(viewId, actionFn);
      }
  } 
}

function executeAccess(viewId, actionFn) {
  if (actionFn) {
      actionFn();
  } else if (viewId) {
      showView(viewId); 
  }
}

function promptAuthModal(viewId, actionFn) {
  pendingView = viewId; 
  pendingAction = actionFn;
  document.getElementById('authModal').classList.remove('hidden'); 
  document.getElementById('adminPassword').value = ""; 
  document.getElementById('authError').classList.add('hidden'); 
  document.getElementById('adminPassword').focus(); 
}

function closeAuthModal() { 
  document.getElementById('authModal').classList.add('hidden'); 
  pendingView = ""; 
  pendingAction = null;
}

function handleAuth(e) { 
  e.preventDefault(); 
  const pwd = document.getElementById('adminPassword').value; 
  const btn = document.getElementById('authBtn'); 
  btn.disabled = true; 
  btn.innerText = "Checking..."; 
  
  apiCall('verifyAdminPassword', pwd).then(isValid => { 
      btn.disabled = false; 
      btn.innerText = "Access"; 
      if (isValid) { 
          isAdminAuthenticated = true; 
          localStorage.setItem('adminKey', pwd); // Save for persistence
          const target = pendingView; 
          const action = pendingAction;
          closeAuthModal(); 
          executeAccess(target, action);
      } else { 
          document.getElementById('authError').classList.remove('hidden'); 
          document.getElementById('adminPassword').value = ""; 
      } 
  }); 
}