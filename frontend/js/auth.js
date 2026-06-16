function requestAccess(viewId) { 
    if (isAdminAuthenticated) { 
        showView(viewId); 
    } else { 
        pendingView = viewId; 
        document.getElementById('authModal').classList.remove('hidden'); 
        document.getElementById('adminPassword').value = ""; 
        document.getElementById('authError').classList.add('hidden'); 
        document.getElementById('adminPassword').focus(); 
    } 
}

function closeAuthModal() { 
    document.getElementById('authModal').classList.add('hidden'); 
    pendingView = ""; 
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
            const target = pendingView; 
            closeAuthModal(); 
            if(target) showView(target); 
        } else { 
            document.getElementById('authError').classList.remove('hidden'); 
            document.getElementById('adminPassword').value = ""; 
        } 
    }); 
}