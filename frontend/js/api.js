/**
* API Caller Wrapper
* Uses API_URL globally defined in backend/config.js
*/

// Global deduplication cache to merge identical simultaneous requests, 
// completely eliminating Google 500 errors caused by concurrent request rate limits.
const pendingRequests = {};

async function apiCall(action, data = {}) {
  const reqKey = action + JSON.stringify(data);
  
  // If the exact same request is already in transit, join the promise instead of sending a new one
  if (pendingRequests[reqKey]) {
      return pendingRequests[reqKey];
  }

  const promise = (async () => {
      try {
          const response = await fetch(API_URL, {
              method: 'POST',
              body: JSON.stringify({ action: action, data: data }),
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              redirect: 'follow'
          });
          
          const text = await response.text();
          try {
              return JSON.parse(text);
          } catch (e) {
              console.error("API Response is not JSON:", text);
              return { success: false, message: "Server Error: Invalid Response. Contact Support." };
          }
      } catch (error) {
          console.error("API Error:", error);
          return { success: false, message: "Connection Error. Please check internet." };
      } finally {
          // Cleanup to allow fresh subsequent requests
          delete pendingRequests[reqKey];
      }
  })();

  pendingRequests[reqKey] = promise;
  return promise;
}