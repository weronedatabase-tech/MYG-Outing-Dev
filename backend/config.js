// ==========================================
// config.js - Application Configuration
// ==========================================
// ENVIRONMENT TOGGLE
// Options: 'Exp' (Experimental) | 'Dev' (Development) | 'Prod' (Production)
const ENV = 'Prod';

// ENVIRONMENT API ENDPOINTS (Google Apps Script Web App URLs)
const EXP_URL = 'https://script.google.com/macros/s/AKfycby16sDgMLOCkZah70i3GV50aAbNIVcQ9GEYDx83YZjJkoK49FXbw-_tgqE0emQfB0TISw/exec';
const DEV_URL = 'https://script.google.com/macros/s/AKfycbywS4uXR4G_S-Xqvqrkohckp76SEzp78dIyOLwBp6a5pLtHjUxwGjDyo4grEsHxerta/exec';
const PROD_URL = 'https://script.google.com/macros/s/AKfycbwOQHiPXoVB10_T81K1mfWPZyahHFXHnrbR7KuM4GI0tQjnsaGjQMunDJWcXRP5g0aENQ/exec';
const API_URL = ENV === 'Exp' ? EXP_URL : (ENV === 'Dev' ? DEV_URL : PROD_URL);

// ENVIRONMENT Google Drive Folders (Google Drive Folder IDs)
const EXP_Drive_Folder_ID = '18nZ7uA7Bt-eOhLmGz0XJATDvZ7ZO_o7R';
const DEV_Drive_Folder_ID= '1IPeu_EPJuWkHzKcIs18cG4fHi_CL0mwf';
const PROD_Drive_Folder_ID = '1bb_MhkjNYFRCvnt5hg235o7HWDgGdMDE';
const Drive_Folder_ID = ENV === 'Exp' ? EXP_Drive_Folder_ID : (ENV === 'Dev' ? DEV_Drive_Folder_ID : PROD_Drive_Folder_ID);