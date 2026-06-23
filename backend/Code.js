// ==========================================
// ENVIRONMENT DATA MAP
// Evaluated lazily to prevent Google Apps Script load-order Reference Errors 
// ==========================================

function getParentFolderId() {
const config = {
Dev: DEV_Drive_Folder_ID,
Prod: PROD_Drive_Folder_ID,
Exp: EXP_Drive_Folder_ID
};
return config[ENV];
}

function getTemplateFolderId() {
const parentId = getParentFolderId();
const parentFolder = DriveApp.getFolderById(parentId);
const folders = parentFolder.getFoldersByName("01. Template Files");
if (folders.hasNext()) {
return folders.next().getId();
}
throw new Error("Template folder '01. Template Files' not found in the parent directory.");
}

// --- ACTIVE CONSTANTS ---
const PROP_SETTINGS = "VOL_APP_SETTINGS";

// --- API ROUTER ---
function doGet(e) {
return ContentService.createTextOutput(`MINDS MYG API is Online (${ENV} Environment).`);
}

function doPost(e) {
let request;
try {
request = JSON.parse(e.postData.contents);
} catch (err) {
return response({ success: false, message: "Invalid JSON" });
}

const action = request.action;
const payload = request.data;
let result;

try {
switch (action) {
case 'verifyAdminPassword':
result = verifyAdminPassword(payload);
break;
case 'getRecentOutingSheets':
result = getRecentOutingSheets();
break;
case 'createOuting':
result = createOuting(payload);
break;
case 'runAutoPairing':
result = runAutoPairing(payload);
break;
case 'runAutoGrouping':
result = runAutoGrouping(payload);
break;
case 'getNamesList':
result = getNamesList(payload.url, payload.type);
break;
case 'getPersonData':
result = getPersonData(payload.url, payload.type, payload.name);
break;
case 'submitAttendanceData':
result = submitAttendanceData(payload);
break;
case 'getTemplateHeaders':
result = getTemplateHeaders();
break;
case 'getAppSettings':
result = getAppSettings();
break;
case 'saveAppSettings':
result = saveAppSettings(payload);
break;
case 'getOutingDetails':
result = getOutingDetails(payload);
break;
case 'fetchCommAttendance':
result = fetchCommAttendance(payload.sheetUrl);
break;
case 'addCommJuncture':
result = addCommJuncture(payload.sheetUrl, payload.junctureName);
break;
case 'deleteCommJuncture':
result = deleteCommJuncture(payload.sheetUrl, payload.junctureName);
break;
case 'syncCommAttendance':
result = syncCommAttendance(payload.sheetUrl, payload.multipleUpdates);
break;
case 'fetchMassPairingData':
result = fetchMassPairingData(payload.sheetUrl);
break;
case 'syncMassPairingUpdates':
result = syncMassPairingUpdates(payload.sheetUrl, payload.updates);
break;
default:
result = { success: false, message: "Unknown Action: " + action };
}
} catch (error) {
result = { success: false, message: "Server Error: " + error.toString() };
}

return response(result);
}

function response(data) {
return ContentService.createTextOutput(JSON.stringify(data))
.setMimeType(ContentService.MimeType.JSON);
}

// --- SHARED HELPER: AGGRESSIVE NORMALIZATION ---
function normalizeHeader(str) {
if (!str) return "";
return str.toString().toLowerCase().replace(/[^a-z0-9]/g, "");
}

// --- SHARED HELPER: KEYWORD COLUMN FINDER ---
function getColIndex(headers, keyword) {
if (!headers || !keyword) return -1;
const key = keyword.toString().toLowerCase().replace(/[^a-z0-9]/g, "");
return headers.findIndex(h => {
if (h == null) return false;
return h.toString().toLowerCase().replace(/[^a-z0-9]/g, "").includes(key);
});
}

function getGroupingSheet(ss) {
let sheet = ss.getSheetByName("Groupings");
if (!sheet) sheet = ss.getSheetByName("Grouping");
return sheet;
}

/* =========================================
AUTH LOGIC
========================================= */
function verifyAdminPassword(inputPassword) {
const correctPassword = PropertiesService.getScriptProperties().getProperty("Admin");
return inputPassword === correctPassword;
}

/* =========================================
HELPER: GET PROJECT LIST FROM LOOKUP TAB
========================================= */
function getProjectList(sheetUrl) {
try {
const ss = SpreadsheetApp.openByUrl(sheetUrl);
const sheet = ss.getSheetByName("Lookup");
if (!sheet) return [];

const lastRow = sheet.getLastRow();
const lastCol = sheet.getLastColumn();
if (lastRow < 2) return [];

const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
const projIdx = getColIndex(headers, "project");

if (projIdx === -1) return [];

const data = sheet.getRange(2, projIdx + 1, lastRow - 1, 1).getValues().flat();
const projects = [...new Set(data.filter(p => p && p.toString().trim() !== ""))];
return projects.sort();
} catch (e) {
return [];
}
}

/* =========================================
CORE LOGIC (COMM PROFILE)
========================================= */

function createOuting(form) {
try {
const parentFolder = DriveApp.getFolderById(getParentFolderId());
const templateFolder = DriveApp.getFolderById(getTemplateFolderId());

const rawDate = new Date(form.eventDate);
const yyyy = rawDate.getFullYear();
const mm = String(rawDate.getMonth() + 1).padStart(2, '0');
const dd = String(rawDate.getDate()).padStart(2, '0');

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mmm = monthNames[rawDate.getMonth()];
const dateForSheet = `${dd} ${mmm} ${yyyy}`;

const folderName = `${yyyy}${mm}${dd}_${form.eventName}`;

if (parentFolder.getFoldersByName(folderName).hasNext()) return { success: false, message: "A folder with this name already exists!" };

const newFolder = parentFolder.createFolder(folderName);
const templateFiles = templateFolder.getFiles();
let sheetUrl = "";

while (templateFiles.hasNext()) {
const file = templateFiles.next();
if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
const sheetName = `${form.eventName} ${dateForSheet}`;
const newFile = file.makeCopy(sheetName, newFolder);
updateSpecificCells(newFile.getId(), form, dateForSheet);
sheetUrl = newFile.getUrl();
} else {
file.makeCopy(file.getName(), newFolder);
}
}
return { success: true, message: "Folder created & Sheet populated!", url: newFolder.getUrl(), sheetUrl: sheetUrl };
} catch (e) {
return { success: false, message: "Error: " + e.toString() };
}
}

function updateSpecificCells(spreadsheetId, form, formattedDate) {
const ss = SpreadsheetApp.openById(spreadsheetId);
let sheet = ss.getSheetByName("OutingInformation");
if (!sheet) sheet = ss.getSheets()[0];

sheet.getRange("G4").setValue(form.eventName);
sheet.getRange("G5").setValue(formattedDate);

const mLocs = form.meetingLocs; const mTimes = form.meetingTimes;
sheet.getRange("F7").setValue(mLocs[0] || ""); sheet.getRange("G7").setValue(mTimes[0] || "");
sheet.getRange("F8").setValue(mLocs[1] || ""); sheet.getRange("G8").setValue(mTimes[1] || "");
sheet.getRange("F9").setValue(mLocs[2] || ""); sheet.getRange("G9").setValue(mTimes[2] || "");
sheet.getRange("F10").setValue(mLocs[3] || ""); sheet.getRange("G10").setValue(mTimes[3] || "");
const dLocs = form.dismissalLocs; const dTimes = form.dismissalTimes;
sheet.getRange("F12").setValue(dLocs[0] || ""); sheet.getRange("G12").setValue(dTimes[0] || "");
sheet.getRange("F13").setValue(dLocs[1] || ""); sheet.getRange("G13").setValue(dTimes[1] || "");
sheet.getRange("F14").setValue(dLocs[2] || ""); sheet.getRange("G14").setValue(dTimes[2] || "");
sheet.getRange("F15").setValue(dLocs[3] || ""); sheet.getRange("G15").setValue(dTimes[3] || "");
}

function getRecentOutingSheets() {
try {
const parentFolder = DriveApp.getFolderById(getParentFolderId());
const subfolders = parentFolder.getFolders();
const folderList = [];

const regex = /(\d{8})/;
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Calculate the threshold date: current day - 1 day
const today = new Date();
today.setDate(today.getDate() - 1);
const tY = today.getFullYear();
const tM = String(today.getMonth() + 1).padStart(2, '0');
const tD = String(today.getDate()).padStart(2, '0');
const thresholdDateNum = parseInt(`${tY}${tM}${tD}`);

let count = 0;
const maxScan = 500; // Prevent GAS Timeout limit

while (subfolders.hasNext()) {
count++;
if (count > maxScan && folderList.length >= 20) break;

let folder = subfolders.next();
let name = folder.getName();
let match = name.match(regex);

// Strictly require the YYYYMMDD string pattern in the folder name
if (match) {
let dStr = match[1];
let folderDateNum = parseInt(dStr);

// Exclude folders that are older than (current day - 1 day)
if (folderDateNum < thresholdDateNum) {
 continue;
}

let cleanName = name.replace(dStr, "").replace(/^[_-\s]+|[_-\s]+$/g, "").trim();

let y = dStr.substring(0, 4);
let mIndex = parseInt(dStr.substring(4, 6), 10) - 1;
let d = parseInt(dStr.substring(6, 8), 10);

let prettyDate = "";
if (mIndex >= 0 && mIndex < 12 && d > 0 && d <= 31) {
  prettyDate = `${d} ${monthNames[mIndex]} ${y}`;
} else {
  prettyDate = dStr;
}

folderList.push({
 id: folder.getId(),
 fullName: name,
 displayName: cleanName || name,
 formattedDate: prettyDate,
 folderDateNum: folderDateNum,
 folderUrl: folder.getUrl(),
 sheetUrl: ""
});
}
}

// Sort by date descending
folderList.sort((a, b) => {
if (b.folderDateNum !== a.folderDateNum) {
   return b.folderDateNum - a.folderDateNum;
}
return a.fullName.localeCompare(b.fullName);
});

const result = [];
const limit = Math.min(folderList.length, 20);

for (let i = 0; i < limit; i++) {
let f = folderList[i];
let folderObj = DriveApp.getFolderById(f.id);

let files = folderObj.getFilesByType("application/vnd.google-apps.spreadsheet");

if (files.hasNext()) {
let sheet = files.next();
f.sheetUrl = sheet.getUrl();
result.push(f);
}
}
return { success: true, data: result };
} catch (e) { 
return { success: false, message: e.toString() }; 
}
}

/* =========================================
FEATURE: GET DETAILED STATS & REMINDERS
========================================= */
function getOutingDetails(sheetUrl) {
try {
const ss = SpreadsheetApp.openByUrl(sheetUrl);
const tSheet = ss.getSheetByName("Trainee Attendance");
const vSheet = ss.getSheetByName("Volunteer Attendance");

if(!tSheet || !vSheet) return { success: false, message: "Missing Tabs" };

const stats = {};
const pendingTrainees = [];

const initProj = (p) => {
if(!stats[p]) stats[p] = { tY: 0, tTot: 0, cY: 0, vY: 0, vTot: 0 };
};

// 1. PROCESS TRAINEES
const tLastRow = tSheet.getLastRow();
if(tLastRow > 1) {
const tData = tSheet.getRange(2, 1, tLastRow-1, tSheet.getLastColumn()).getValues();
const tHeaders = tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0];

const tAttIdx = getColIndex(tHeaders, "attending");
const tProjIdx = getColIndex(tHeaders, "project");
const tCareIdx = getColIndex(tHeaders, "caregiver");
const tVolPairedIdx = getColIndex(tHeaders, "vol paired");
let tNameIdx = getColIndex(tHeaders, "name");
if (tNameIdx === -1) tNameIdx = 0; // Fallback

tData.forEach(row => {
const name = row[tNameIdx] ? row[tNameIdx].toString().trim() : "";
if(!name) return; // Skip empty rows

const project = (tProjIdx > -1 && row[tProjIdx]) ? row[tProjIdx].toString().trim() : "Unassigned";
const att = (tAttIdx > -1 && row[tAttIdx]) ? row[tAttIdx].toString().trim().toLowerCase() : "";
const cgCount = (tCareIdx > -1 && row[tCareIdx]) ? parseInt(row[tCareIdx]) : 0;
const volPaired = (tVolPairedIdx > -1 && row[tVolPairedIdx]) ? row[tVolPairedIdx].toString().trim() : "";

initProj(project);
stats[project].tTot++;

if(att === 'y') {
 stats[project].tY++;
 if(!isNaN(cgCount) && cgCount > 0) stats[project].cY += cgCount;
} else if (att === 'n') {
 // Do nothing for N
} else {
 // BLANK -> Add to pending
 pendingTrainees.push(name);
}
});
}

// 2. PROCESS VOLUNTEERS
const vLastRow = vSheet.getLastRow();
if(vLastRow > 1) {
const vData = vSheet.getRange(2, 1, vLastRow-1, vSheet.getLastColumn()).getValues();
const vHeaders = vSheet.getRange(1, 1, 1, vSheet.getLastColumn()).getValues()[0];

const vAttIdx = getColIndex(vHeaders, "attending");
const vProjIdx = getColIndex(vHeaders, "project");
let vNameIdx = getColIndex(vHeaders, "name");
if (vNameIdx === -1) vNameIdx = 0;

vData.forEach(row => {
const name = row[vNameIdx] ? row[vNameIdx].toString().trim() : "";
if(!name) return;

const project = (vProjIdx > -1 && row[vProjIdx]) ? row[vProjIdx].toString().trim() : "Unassigned";
const att = (vAttIdx > -1 && row[vAttIdx]) ? row[vAttIdx].toString().trim().toLowerCase() : "";

initProj(project);
stats[project].vTot++;
if(att === 'y') stats[project].vY++;
});
}

pendingTrainees.sort();

return {
success: true,
stats: stats,
pending: pendingTrainees
};

} catch(e) {
return { success: false, message: e.toString() };
}
}

/* =========================================
MASS PAIRING LOGIC
========================================= */

function fetchMassPairingData(sheetUrl) {
try {
const ss = SpreadsheetApp.openByUrl(sheetUrl);
const tSheet = ss.getSheetByName("Trainee Attendance");
const vSheet = ss.getSheetByName("Volunteer Attendance");
const gSheet = getGroupingSheet(ss);

if (!tSheet || !vSheet || !gSheet) return { success: false, message: "Missing Tabs" };

// 1. Get Trainees & Active Volunteers
const trainees = [];
const volunteers = [];

// Trainees Logic
const tLastRow = tSheet.getLastRow();
if (tLastRow > 1) {
    const tData = tSheet.getRange(2, 1, tLastRow - 1, tSheet.getLastColumn()).getValues();
    const tHeaders = tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0];
    const tNameIdx = getColIndex(tHeaders, "name") > -1 ? getColIndex(tHeaders, "name") : 0;
    const tAttIdx = getColIndex(tHeaders, "attending");
    const tVolPairedIdx = getColIndex(tHeaders, "vol paired");
    const tProjIdx = getColIndex(tHeaders, "project");
    
    tData.forEach(row => {
        const name = row[tNameIdx] ? row[tNameIdx].toString().trim() : "";
        if (name) {
            const att = (tAttIdx > -1 && row[tAttIdx]) ? row[tAttIdx].toString().toLowerCase() : "";
            const volPaired = (tVolPairedIdx > -1 && row[tVolPairedIdx]) ? row[tVolPairedIdx].toString().trim() : "";
            const project = (tProjIdx > -1 && row[tProjIdx]) ? row[tProjIdx].toString().trim() : "";
            
            trainees.push({
                name: name,
                role: 'TRAINEE',
                attending: att,
                volPaired: volPaired,
                project: project,
                isAttendingN: att === 'n',
                isAttendingUnknown: att === '',
                isGoneHome: false // Pulled next
            });
        }
    });
}

// Gone Home logic
const gLastRow = gSheet.getLastRow();
const gHeaders = gLastRow > 1 ? gSheet.getRange(2, 1, 1, gSheet.getLastColumn()).getValues()[0] : [];
const goneHomeIdx = gHeaders.indexOf("[Sys] Gone Home");
let gNameIdx = getColIndex(gHeaders, "traineename");
if (gNameIdx === -1) gNameIdx = getColIndex(gHeaders, "trainee");
if (gNameIdx === -1) gNameIdx = getColIndex(gHeaders, "name");
if (gNameIdx === -1) gNameIdx = 0;

if (goneHomeIdx > -1 && gLastRow > 2) {
    const gData = gSheet.getRange(3, 1, gLastRow - 2, gSheet.getLastColumn()).getValues();
    const goneHomeMap = {};
    gData.forEach(row => {
        const name = String(row[gNameIdx]).trim().toLowerCase();
        if (name) {
            goneHomeMap[name] = (row[goneHomeIdx] === true || String(row[goneHomeIdx]).toLowerCase() === 'true');
        }
    });
    
    trainees.forEach(t => {
        const key = t.name.toLowerCase();
        if (goneHomeMap[key]) t.isGoneHome = true;
    });
}

// Volunteers Logic
const vLastRow = vSheet.getLastRow();
if (vLastRow > 1) {
    const vData = vSheet.getRange(2, 1, vLastRow - 1, vSheet.getLastColumn()).getValues();
    const vHeaders = vSheet.getRange(1, 1, 1, vSheet.getLastColumn()).getValues()[0];
    const vNameIdx = getColIndex(vHeaders, "name") > -1 ? getColIndex(vHeaders, "name") : 0;
    const vAttIdx = getColIndex(vHeaders, "attending");
    const vProjIdx = getColIndex(vHeaders, "project");

    vData.forEach(row => {
        const att = (vAttIdx > -1 && row[vAttIdx]) ? row[vAttIdx].toString().toLowerCase() : "";
        if (att === 'y') {
            const name = row[vNameIdx] ? row[vNameIdx].toString().trim() : "";
            if (name) {
                const project = (vProjIdx > -1 && row[vProjIdx]) ? row[vProjIdx].toString().trim() : "";
                volunteers.push({
                    name: name,
                    role: 'VOLUNTEER',
                    project: project
                });
            }
        }
    });
}

return { 
    success: true, 
    data: { trainees: trainees, volunteers: volunteers } 
};
} catch(e) {
return { success: false, message: e.toString() };
}
}

function syncMassPairingUpdates(sheetUrl, updates) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(10000);
const ss = SpreadsheetApp.openByUrl(sheetUrl);
const tSheet = ss.getSheetByName("Trainee Attendance");
if (!tSheet) return { success: false, message: "Missing Trainee Attendance Tab" };

const tLastRow = tSheet.getLastRow();
if (tLastRow < 2) return { success: true };

const tHeaders = tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0];
const tNameIdx = getColIndex(tHeaders, "name") > -1 ? getColIndex(tHeaders, "name") : 0;
const tVolPairedIdx = getColIndex(tHeaders, "vol paired");

if (tVolPairedIdx === -1) return { success: false, message: "Missing 'Vol Paired' column" };

const tRange = tSheet.getRange(2, 1, tLastRow - 1, tSheet.getLastColumn());
const tData = tRange.getValues();

const updatesMap = {};
updates.forEach(u => {
    updatesMap[u.traineeName.trim().toLowerCase()] = u.volPaired;
});

let changed = false;

for (let i = 0; i < tData.length; i++) {
    const name = tData[i][tNameIdx] ? tData[i][tNameIdx].toString().trim().toLowerCase() : "";
    if (name && updatesMap.hasOwnProperty(name)) {
        if (tData[i][tVolPairedIdx] !== updatesMap[name]) {
            tData[i][tVolPairedIdx] = updatesMap[name];
            changed = true;
        }
    }
}

if (changed) {
    tRange.setValues(tData);
    
    // Also mirror to Groupings tab if active
    const gSheet = getGroupingSheet(ss);
    if (gSheet) {
        const gLastRow = gSheet.getLastRow();
        if (gLastRow > 2) {
            const gHeaders = gSheet.getRange(2, 1, 1, gSheet.getLastColumn()).getValues()[0];
            let gNameIdx = getColIndex(gHeaders, "traineename");
            if (gNameIdx === -1) gNameIdx = getColIndex(gHeaders, "trainee");
            if (gNameIdx === -1) gNameIdx = getColIndex(gHeaders, "name");
            if (gNameIdx === -1) gNameIdx = 0;
            const gVolIdx = getColIndex(gHeaders, "volunteerpaired");
            
            if (gVolIdx > -1) {
                const gRange = gSheet.getRange(3, 1, gLastRow - 2, gSheet.getLastColumn());
                const gData = gRange.getValues();
                let gChanged = false;
                
                for(let j=0; j<gData.length; j++) {
                    const gName = gData[j][gNameIdx] ? gData[j][gNameIdx].toString().trim().toLowerCase() : "";
                    if (gName && updatesMap.hasOwnProperty(gName)) {
                        if(gData[j][gVolIdx] !== updatesMap[gName]) {
                            gData[j][gVolIdx] = updatesMap[gName];
                            gChanged = true;
                        }
                    }
                }
                if (gChanged) gRange.setValues(gData);
            }
        }
    }
}

return { success: true };
} catch(e) {
return { success: false, message: e.toString() };
} finally {
lock.releaseLock();
}
}


/* =========================================
CORE LOGIC 1: MANUAL PAIRING BUTTON
(Updates STRICTLY "Vol Paired" Column ONLY)
========================================= */
function runAutoPairing(sheetUrl) {
try {
if (!sheetUrl) throw new Error("Invalid URL");
const ss = SpreadsheetApp.openByUrl(sheetUrl);
const tSheet = ss.getSheetByName("Trainee Attendance");
const vSheet = ss.getSheetByName("Volunteer Attendance");
const mSheet = ss.getSheetByName("MISC PriVol");
if (!tSheet || !vSheet || !mSheet) return { success: false, message: "Missing Tabs" };

// 1. Get Active Volunteers
const vLastRow = vSheet.getLastRow();
const vActive = new Set();
if (vLastRow > 1) {
const vHeaders = vSheet.getRange(1,1,1,vSheet.getLastColumn()).getValues()[0];
const vAttIdx = getColIndex(vHeaders, "attending");
const vNameIdx = getColIndex(vHeaders, "name") > -1 ? getColIndex(vHeaders, "name") : 0;
const vData = vSheet.getRange(2,1,vLastRow-1,vSheet.getLastColumn()).getValues();
for(let r of vData) {
if(r[vAttIdx] && r[vAttIdx].toString().toLowerCase() === 'y') {
 if(r[vNameIdx]) vActive.add(r[vNameIdx].toString().toLowerCase());
}
}
}

// 2. Get Mapping (Primary & Fallback)
const priVolMap = new Map();
const mHeaders = mSheet.getRange(1,1,1,mSheet.getLastColumn()).getValues()[0];
const mPairIdx = getColIndex(mHeaders, "outing pairing");
const mVolIdx = getColIndex(mHeaders, "vol"); // Fallback column

const mData = mSheet.getDataRange().getValues();
for(let j=1; j<mData.length; j++){
const name = mData[j][0] ? mData[j][0].toString().toLowerCase().trim() : "";
if(name) {
const primary = (mPairIdx > -1 && mData[j][mPairIdx]) ? mData[j][mPairIdx].toString().trim() : "";
const secondary = (mVolIdx > -1 && mData[j][mVolIdx]) ? mData[j][mVolIdx].toString().trim() : "";

priVolMap.set(name, { primary: primary, secondary: secondary });
}
}

// 3. Populate Trainee Vol Paired (Single Column Write)
const tLastRow = tSheet.getLastRow();
if (tLastRow > 1) {
const tHeaders = tSheet.getRange(1,1,1,tSheet.getLastColumn()).getValues()[0];
const tNameIdx = 0;
const tAttIdx = getColIndex(tHeaders, "attending");
const tVolPairedIdx = getColIndex(tHeaders, "vol paired");

if (tVolPairedIdx > -1) {
const tFullData = tSheet.getRange(2, 1, tLastRow - 1, tSheet.getLastColumn()).getValues();
const volPairedRange = tSheet.getRange(2, tVolPairedIdx + 1, tLastRow - 1, 1);
let volPairedValues = volPairedRange.getValues();

for(let k=0; k<tFullData.length; k++){
 const tName = tFullData[k][tNameIdx] ? tFullData[k][tNameIdx].toString().toLowerCase().trim() : "";
 const tAtt = tFullData[k][tAttIdx] ? tFullData[k][tAttIdx].toString().toLowerCase().trim() : "";

 if(tName && tAtt === 'y') {
   const assignmentInfo = priVolMap.get(tName);
   if(assignmentInfo) {
      if(assignmentInfo.primary && vActive.has(assignmentInfo.primary.toLowerCase())) {
          volPairedValues[k][0] = assignmentInfo.primary;
      } else if (assignmentInfo.secondary && vActive.has(assignmentInfo.secondary.toLowerCase())) {
          volPairedValues[k][0] = assignmentInfo.secondary;
      }
   }
 }
}

volPairedRange.setValues(volPairedValues);

// Mirror to Grouping Tab
const gSheet = getGroupingSheet(ss);
if (gSheet) {
    const gLastRow = gSheet.getLastRow();
    if (gLastRow > 2) {
        const gHeaders = gSheet.getRange(2, 1, 1, gSheet.getLastColumn()).getValues()[0];
        let gNameIdx = getColIndex(gHeaders, "traineename");
        if (gNameIdx === -1) gNameIdx = getColIndex(gHeaders, "trainee");
        if (gNameIdx === -1) gNameIdx = getColIndex(gHeaders, "name");
        if (gNameIdx === -1) gNameIdx = 0;
        const gVolIdx = getColIndex(gHeaders, "volunteerpaired");
        
        if (gVolIdx > -1) {
            const gRange = gSheet.getRange(3, gVolIdx + 1, gLastRow - 2, 1);
            const gNamesData = gSheet.getRange(3, gNameIdx + 1, gLastRow - 2, 1).getValues();
            let gVolValues = gRange.getValues();
            
            for(let j=0; j<gNamesData.length; j++) {
                const gName = gNamesData[j][0] ? gNamesData[j][0].toString().toLowerCase().trim() : "";
                for(let k=0; k<tFullData.length; k++){
                     const tName = tFullData[k][tNameIdx] ? tFullData[k][tNameIdx].toString().toLowerCase().trim() : "";
                     if(gName === tName) {
                         gVolValues[j][0] = volPairedValues[k][0];
                         break;
                     }
                }
            }
            gRange.setValues(gVolValues);
        }
    }
}
}
}
return { success: true, message: "✅ Auto Pairing Complete!\nVolunteer Paired column updated." };
} catch (e) { return { success: false, message: e.toString() }; }
}

/* =========================================
CORE LOGIC 2: MANUAL GROUPING BUTTON
(Strictly populates Outing Grouping only - PRESERVES FORMULAS)
========================================= */
function runAutoGrouping(sheetUrl) {
try {
if (!sheetUrl) throw new Error("Invalid URL");
const ss = SpreadsheetApp.openByUrl(sheetUrl);
const tSheet = ss.getSheetByName("Trainee Attendance");
const mSheet = ss.getSheetByName("MISC PriVol");
if (!tSheet || !mSheet) return { success: false, message: "Missing Tabs" };

const groupMap = new Map();
const mHeaders = mSheet.getRange(1,1,1,mSheet.getLastColumn()).getValues()[0];
const mGroupIdx = getColIndex(mHeaders, "group");
const mData = mSheet.getDataRange().getValues();
for(let j=1; j<mData.length; j++){
if(mData[j][0] && mGroupIdx > -1) {
groupMap.set(mData[j][0].toString().toLowerCase(), mData[j][mGroupIdx]);
}
}

const tLastRow = tSheet.getLastRow();
if (tLastRow > 1) {
const tRange = tSheet.getRange(2,1,tLastRow-1,tSheet.getLastColumn());
let tValues = tRange.getValues();
let tFormulas = tRange.getFormulas();

const tHeaders = tSheet.getRange(1,1,1,tSheet.getLastColumn()).getValues()[0];
const tNameIdx = 0;
const tGroupIdx = getColIndex(tHeaders, "outing grouping");

if (tGroupIdx > -1) {
for(let k=0; k<tValues.length; k++){
 const name = tValues[k][tNameIdx] ? tValues[k][tNameIdx].toString().toLowerCase() : "";
 if(name && groupMap.has(name)) {
   tValues[k][tGroupIdx] = groupMap.get(name);
   tFormulas[k][tGroupIdx] = ""; // Clear formula
 }
}

let output = tValues.map((vals, i) => vals.map((v, c) => tFormulas[i][c] !== "" ? tFormulas[i][c] : v));
tRange.setValues(output);
}
}
return { success: true, message: "✅ Auto Grouping Complete!\nOuting Grouping column updated." };
} catch (e) { return { success: false, message: e.toString() }; }
}

/* =========================================
CORE LOGIC 3: SHEET MAINTENANCE (AUTO)
(Sorts ONLY. NO Pairing, NO Grouping, NO Data Validation)
========================================= */
function runSheetMaintenance(sheetUrl) {
try {
const ss = SpreadsheetApp.openByUrl(sheetUrl);
const tSheet = ss.getSheetByName("Trainee Attendance");
const vSheet = ss.getSheetByName("Volunteer Attendance");
if (!tSheet || !vSheet) return;

const performNativeSort = (sheet, attIdx, projIdx) => {
const lastRow = sheet.getLastRow();
const lastCol = sheet.getLastColumn();
if (lastRow < 2) return;

const nameData = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
const attData = sheet.getRange(2, attIdx + 1, lastRow - 1, 1).getValues();

const weights = nameData.map((r, i) => {
const name = r[0] ? r[0].toString().trim() : "";
const att = attData[i][0] ? attData[i][0].toString().trim().toLowerCase() : "";
if (name === "") return [9];
if (att === 'y') return [1];
if (att === 'n') return [2];
return [3];
});

const tempColIdx = lastCol + 1;
sheet.getRange(2, tempColIdx, lastRow - 1, 1).setValues(weights);

const sortSpec = [{ column: tempColIdx, ascending: true }];
if (projIdx > -1) {
sortSpec.push({ column: projIdx + 1, ascending: true });
}
sortSpec.push({ column: 1, ascending: true }); // Priority 6: Name

const sortRange = sheet.getRange(2, 1, lastRow - 1, tempColIdx);
sortRange.sort(sortSpec);

sheet.deleteColumn(tempColIdx);
sheet.showRows(2, lastRow - 1);
};

let vLastRow = vSheet.getLastRow();
if (vLastRow > 1) {
const vHeaders = vSheet.getRange(1, 1, 1, vSheet.getLastColumn()).getValues()[0];
const vAttIdx = getColIndex(vHeaders, "attending");
const vProjIdx = getColIndex(vHeaders, "project");

if (vAttIdx > -1) {
performNativeSort(vSheet, vAttIdx, vProjIdx);
}
}

let tLastRow = tSheet.getLastRow();
if (tLastRow > 1) {
const tHeaders = tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0];
const tAttIdx = getColIndex(tHeaders, "attending");
const tProjIdx = getColIndex(tHeaders, "project");

if (tAttIdx > -1) {
performNativeSort(tSheet, tAttIdx, tProjIdx);
}
}

} catch (e) { console.log(e); }
}

/* =========================================
LIVE ATTENDANCE LOGIC (GROUPING TAB)
========================================= */

function fetchCommAttendance(sheetUrl) {
try {
const ss = SpreadsheetApp.openByUrl(sheetUrl);
const sheet = getGroupingSheet(ss);
if (!sheet) return { success: false, message: "Groupings tab not found." };

const lastRow = sheet.getLastRow();
const lastCol = sheet.getLastColumn();
if (lastRow < 2) return { success: true, participants: [], junctures: [], attendance: { '__GONE_HOME__': {} } };

const headers = sheet.getRange(2, 1, 1, lastCol).getValues()[0];

const cgIdx = getColIndex(headers, "caregiversfollowing");
const volIdx = getColIndex(headers, "volunteerpaired");
const meetIdx = getColIndex(headers, "meetinglocation");
const dismissIdx = getColIndex(headers, "dismissallocation");
const goneHomeIdx = headers.indexOf("[Sys] Gone Home");

let nameIdx = getColIndex(headers, "traineename");
if (nameIdx === -1) nameIdx = getColIndex(headers, "trainee");
if (nameIdx === -1) nameIdx = getColIndex(headers, "name");
if (nameIdx === -1) nameIdx = 0; // Fallback to first column

const junctures = [];
const junctureColMap = {}; 
headers.forEach((h, i) => {
    const str = String(h);
    if (str.startsWith("[Att] ")) {
        const jName = str.substring(6).trim();
        junctures.push(jName);
        junctureColMap[jName] = i;
    }
});

// ---------- EXTRA INFO PULL FOR LONG PRESS MODAL ----------
const extraData = {};

// Trainee Attendance Info (e.g., Dietary, Remarks)
const tSheet = ss.getSheetByName("Trainee Attendance");
if (tSheet) {
    const tLastRow = tSheet.getLastRow();
    if (tLastRow > 1) {
        const tData = tSheet.getRange(2, 1, tLastRow - 1, tSheet.getLastColumn()).getValues();
        const tHeaders = tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0].map(h => normalizeHeader(h));
        
        let tNameIdx = tHeaders.indexOf("name");
        if (tNameIdx === -1) tNameIdx = tHeaders.indexOf("traineename");
        if (tNameIdx === -1) tNameIdx = 0;
        
        tData.forEach(row => {
            const tName = String(row[tNameIdx]).trim();
            if (tName) {
                const normName = tName.toLowerCase();
                if (!extraData[normName]) extraData[normName] = {};
                tHeaders.forEach((h, i) => {
                    if (h) {
                        let val = row[i];
                        if (val instanceof Date) {
                            val = Utilities.formatDate(val, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
                        }
                        extraData[normName][h] = val;
                    }
                });
            }
        });
    }
}

// MISC PriVol Info (e.g., Caregiver Contacts)
const mSheet = ss.getSheetByName("MISC PriVol");
if (mSheet) {
    const mLastRow = mSheet.getLastRow();
    if (mLastRow > 1) {
        const mData = mSheet.getRange(2, 1, mLastRow - 1, mSheet.getLastColumn()).getValues();
        const mHeaders = mSheet.getRange(1, 1, 1, mSheet.getLastColumn()).getValues()[0].map(h => normalizeHeader(h));
        let mNameIdx = 0; // Usually column A
        
        mData.forEach(row => {
            const mName = String(row[mNameIdx]).trim();
            if (mName) {
                const normName = mName.toLowerCase();
                if (!extraData[normName]) extraData[normName] = {};
                mHeaders.forEach((h, i) => {
                    if (h && (extraData[normName][h] === undefined || extraData[normName][h] === "")) {
                        let val = row[i];
                        if (val instanceof Date) {
                            val = Utilities.formatDate(val, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
                        }
                        extraData[normName][h] = val;
                    }
                });
            }
        });
    }
}
// -----------------------------------------------------------

const data = lastRow > 2 ? sheet.getRange(3, 1, lastRow - 2, lastCol).getValues() : [];
const participants = [];
const attendance = { '__GONE_HOME__': {} };

junctures.forEach(j => attendance[j] = {});

data.forEach(row => {
    const name = String(row[nameIdx]).trim();
    if (name) {
        const group = String(row[0]).trim(); // Column A contains the group number
        const caregivers = cgIdx > -1 ? parseInt(row[cgIdx]) || 0 : 0;
        const volPaired = volIdx > -1 ? String(row[volIdx]).trim() : "";
        const meetingLoc = meetIdx > -1 ? String(row[meetIdx]).trim() : "";
        const dismissalLoc = dismissIdx > -1 ? String(row[dismissIdx]).trim() : "";
        
        // Attach the extra data safely
        const extra = extraData[name.toLowerCase()] || {};
        
        participants.push({ 
            name: name, 
            group: group, 
            caregivers: caregivers, 
            volPaired: volPaired,
            meetingLoc: meetingLoc,
            dismissalLoc: dismissalLoc,
            extra: extra
        });
        
        if (goneHomeIdx > -1) {
            attendance['__GONE_HOME__'][name] = (row[goneHomeIdx] === true || String(row[goneHomeIdx]).toLowerCase() === 'true');
        } else {
            attendance['__GONE_HOME__'][name] = false;
        }
        
        junctures.forEach(j => {
            const val = row[junctureColMap[j]];
            attendance[j][name] = (val === true || String(val).toLowerCase() === 'true');
        });
    }
});

return { success: true, participants: participants, junctures: junctures, attendance: attendance };
} catch(e) { return { success: false, message: e.toString() }; }
}

function addCommJuncture(sheetUrl, junctureName) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(10000);
const ss = SpreadsheetApp.openByUrl(sheetUrl);
const sheet = getGroupingSheet(ss);
if (!sheet) return { success: false, message: "Groupings tab not found." };

const headerName = `[Att] ${junctureName}`;
const lastCol = sheet.getLastColumn();
const headers = sheet.getRange(2, 1, 1, lastCol).getValues()[0];

if (headers.includes(headerName)) return { success: false, message: "Juncture already exists." };

const newColIdx = lastCol + 1;
sheet.insertColumnAfter(lastCol);
sheet.getRange(2, newColIdx).setValue(headerName);

const lastRow = sheet.getLastRow();
if (lastRow > 2) {
    sheet.getRange(3, newColIdx, lastRow - 2).insertCheckboxes();
}

SpreadsheetApp.flush();
return fetchCommAttendance(sheetUrl);
} catch(e) {
return { success: false, message: e.toString() };
} finally {
lock.releaseLock();
}
}

function deleteCommJuncture(sheetUrl, junctureName) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(10000);
const ss = SpreadsheetApp.openByUrl(sheetUrl);
const sheet = getGroupingSheet(ss);
if (!sheet) return { success: false, message: "Groupings tab not found." };

const headerName = `[Att] ${junctureName}`;
const lastCol = sheet.getLastColumn();
const headers = sheet.getRange(2, 1, 1, lastCol).getValues()[0];

const colIdx = headers.indexOf(headerName);
if (colIdx === -1) return { success: false, message: "Juncture not found." };

sheet.deleteColumn(colIdx + 1);
SpreadsheetApp.flush();
return fetchCommAttendance(sheetUrl);
} catch(e) {
return { success: false, message: e.toString() };
} finally {
lock.releaseLock();
}
}

function syncCommAttendance(sheetUrl, multipleUpdates) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(10000);
const ss = SpreadsheetApp.openByUrl(sheetUrl);
const sheet = getGroupingSheet(ss);
if (!sheet) return { success: false, message: "Groupings tab not found." };

let lastRow = sheet.getLastRow();
let lastCol = sheet.getLastColumn();

if (lastRow < 3) return { success: true };

let headers = sheet.getRange(2, 1, 1, lastCol).getValues()[0];

let nameIdx = getColIndex(headers, "traineename");
if (nameIdx === -1) nameIdx = getColIndex(headers, "trainee");
if (nameIdx === -1) nameIdx = getColIndex(headers, "name");
if (nameIdx === -1) nameIdx = 0;

const namesData = sheet.getRange(3, nameIdx + 1, lastRow - 2).getValues();
let changedGlobal = false;

// Gather all updates into memory first
for (const [junctureName, updates] of Object.entries(multipleUpdates)) {
    let targetHeader = junctureName === '__GONE_HOME__' ? "[Sys] Gone Home" : `[Att] ${junctureName}`;
    let juncIdx = headers.indexOf(targetHeader);
    
    if (juncIdx === -1 && junctureName === '__GONE_HOME__') {
        const newColIdx = lastCol + 1;
        sheet.insertColumnAfter(lastCol);
        sheet.getRange(2, newColIdx).setValue(targetHeader);
        sheet.getRange(3, newColIdx, lastRow - 2).insertCheckboxes();
        SpreadsheetApp.flush();
        headers = sheet.getRange(2, 1, 1, newColIdx).getValues()[0];
        lastCol = newColIdx;
        juncIdx = newColIdx - 1;
    } else if (juncIdx === -1) {
        continue; 
    }
    
    const juncRange = sheet.getRange(3, juncIdx + 1, lastRow - 2);
    const juncData = juncRange.getValues();
    
    const updateMap = {};
    updates.forEach(u => updateMap[u.name.toLowerCase()] = u.status);
    
    let changed = false;
    for (let i = 0; i < namesData.length; i++) {
        const name = String(namesData[i][0]).trim().toLowerCase();
        if (name && updateMap.hasOwnProperty(name)) {
            if (juncData[i][0] !== updateMap[name]) {
                juncData[i][0] = updateMap[name];
                changed = true;
            }
        }
    }
    
    if (changed) {
        juncRange.setValues(juncData);
        changedGlobal = true;
        
        // --- LOGICAL CASCADE: if Gone Home updated, unpair volunteer locally ---
        if (junctureName === '__GONE_HOME__') {
            const tSheet = ss.getSheetByName("Trainee Attendance");
            if (tSheet) {
                const tLastRow = tSheet.getLastRow();
                if (tLastRow > 1) {
                    const tHeaders = tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0];
                    const tNameIdx = getColIndex(tHeaders, "name") > -1 ? getColIndex(tHeaders, "name") : 0;
                    const tVolPairedIdx = getColIndex(tHeaders, "vol paired");
                    
                    if (tVolPairedIdx > -1) {
                        const tRange = tSheet.getRange(2, 1, tLastRow - 1, tSheet.getLastColumn());
                        const tData = tRange.getValues();
                        let tChanged = false;
                        
                        for(let k=0; k<tData.length; k++){
                            const tName = tData[k][tNameIdx] ? tData[k][tNameIdx].toString().toLowerCase().trim() : "";
                            if(tName && updateMap.hasOwnProperty(tName) && updateMap[tName] === true) {
                                // Trainee has gone home, remove volunteer assignment
                                if(tData[k][tVolPairedIdx] !== "") {
                                    tData[k][tVolPairedIdx] = "";
                                    tChanged = true;
                                }
                            }
                        }
                        if (tChanged) tRange.setValues(tData);
                    }
                }
            }
        }
    }
}

return { success: true };
} catch(e) {
return { success: false, message: e.toString() };
} finally {
lock.releaseLock();
}
}


/* =========================================
VOLUNTEER & SETTINGS LOGIC
========================================= */

function cleanHeader(header) {
if (!header) return "";
return header.toString().replace(/\[.*?\]/g, "").trim();
}

function getAppSettings() {
const props = PropertiesService.getScriptProperties();
const saved = props.getProperty(PROP_SETTINGS);
let settings = saved ? JSON.parse(saved) : {};
if (!settings.traineeCols) settings.traineeCols = [];
if (!settings.volCols) settings.volCols = [];
return settings;
}

function saveAppSettings(settings) {
PropertiesService.getScriptProperties().setProperty(PROP_SETTINGS, JSON.stringify(settings));
return { success: true, message: "Settings saved successfully!" };
}

function getTemplateHeaders() {
try {
const folder = DriveApp.getFolderById(getTemplateFolderId());
const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
if (!files.hasNext()) throw new Error("No Template Sheet found.");
const file = files.next();
const ss = SpreadsheetApp.openById(file.getId());
const tSheet = ss.getSheetByName("Trainee Attendance");
const vSheet = ss.getSheetByName("Volunteer Attendance");
if(!tSheet || !vSheet) throw new Error("Template missing required tabs.");
const tRaw = tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0];
const vRaw = vSheet.getRange(1, 1, 1, vSheet.getLastColumn()).getValues()[0];
const tHeaders = tRaw.map(h => cleanHeader(h)).filter(h => h !== "");
const vHeaders = vRaw.map(h => cleanHeader(h)).filter(h => h !== "");
return { success: true, tHeaders: tHeaders, vHeaders: vHeaders };
} catch(e) { return { success: false, message: e.toString() }; }
}

function getNamesList(sheetUrl, type) {
try {
if (!sheetUrl || sheetUrl === "") return { success: false, message: "Invalid Sheet URL" };
const ss = SpreadsheetApp.openByUrl(sheetUrl);
const tabName = type === 'trainee' ? "Trainee Attendance" : "Volunteer Attendance";
const sheet = ss.getSheetByName(tabName);
if(!sheet) throw new Error(tabName + " not found.");
const lastRow = sheet.getLastRow();
if (lastRow < 2) return { success: true, names: [] };
const names = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
const cleanNames = names.filter(n => n !== "");
return { success: true, names: cleanNames };
} catch(e) { return { success: false, message: e.toString() }; }
}

function getPersonData(sheetUrl, type, name) {
try {
if (!sheetUrl || sheetUrl === "") return { success: false, message: "Invalid Sheet URL" };
const ss = SpreadsheetApp.openByUrl(sheetUrl);
const tabName = type === 'trainee' ? "Trainee Attendance" : "Volunteer Attendance";
const sheet = ss.getSheetByName(tabName);

const infoSheet = ss.getSheetByName("OutingInformation");
let meetingLocations = [];
let dismissalLocations = [];

if (infoSheet) {
const mRange = infoSheet.getRange("F7:F10").getValues();
meetingLocations = mRange.flat().filter(l => l && l.toString().trim() !== "");
const dRange = infoSheet.getRange("F12:F15").getValues();
dismissalLocations = dRange.flat().filter(l => l && l.toString().trim() !== "");
}

let projects = [];
if (type === 'volunteer') {
projects = getProjectList(sheetUrl);
}

let activeVolunteers = [];
if (type === 'trainee') {
try {
const vSheet = ss.getSheetByName("Volunteer Attendance");
if (vSheet) {
  const vLastRow = vSheet.getLastRow();
  if (vLastRow > 1) {
    const vHeaders = vSheet.getRange(1, 1, 1, vSheet.getLastColumn()).getValues()[0];
    let vAttIdx = getColIndex(vHeaders, "attend");
    let vNameIdx = getColIndex(vHeaders, "name");
    if (vNameIdx === -1) vNameIdx = 0;
    if (vAttIdx > -1) {
      const vData = vSheet.getRange(2, 1, vLastRow - 1, vSheet.getLastColumn()).getValues();
      activeVolunteers = vData
        .filter(r => r[vAttIdx] && r[vAttIdx].toString().trim().toLowerCase() === 'y' && r[vNameIdx])
        .map(r => r[vNameIdx].toString().trim());
    }
  }
}
} catch (err) {
console.log("Failed fetching active volunteers: " + err.toString());
}
}

const lastCol = sheet.getLastColumn();
const rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

const settings = getAppSettings();
let configCols = type === 'trainee' ? settings.traineeCols : settings.volCols;
if (!configCols || configCols.length === 0) {
const templateInfo = getTemplateHeaders();
if (templateInfo.success) configCols = type === 'trainee' ? templateInfo.tHeaders : templateInfo.vHeaders;
}

if (!name && type === 'volunteer') {
return {
success: true,
isNew: true,
data: {},
headers: rawHeaders,
config: configCols,
meetingOpts: meetingLocations,
dismissalOpts: dismissalLocations,
projectOpts: projects,
activeVolunteers: activeVolunteers
};
}

if (!name) return { success: false, message: "No name provided to search." };

const textFinder = sheet.getRange("A:A").createTextFinder(name).matchEntireCell(true);
const cell = textFinder.findNext();

if(!cell) {
if (type === 'volunteer') {
return {
success: true,
isNew: true,
data: {},
headers: rawHeaders,
config: configCols,
meetingOpts: meetingLocations,
dismissalOpts: dismissalLocations,
projectOpts: projects,
activeVolunteers: activeVolunteers
};
}
return { success: false, message: "Name not found in Trainee list." };
}

const row = cell.getRow();
const rowData = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
let record = {};

rawHeaders.forEach((h, i) => {
let normH = normalizeHeader(h);
let key = normH;
if (normH.includes("meetinglocation")) key = "meetinglocation";
else if (normH.includes("dismissallocation")) key = "dismissallocation";
else if (normH.includes("attending")) key = "attendingyn";
else if (normH.includes("caregiver")) key = "caregiver";

if(key) {
let val = rowData[i];
if (val instanceof Date) val = Utilities.formatDate(val, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
record[key] = val;
}
});

return {
success: true, isNew: false, data: record,
headers: rawHeaders, config: configCols,
meetingOpts: meetingLocations, dismissalOpts: dismissalLocations,
projectOpts: projects,
activeVolunteers: activeVolunteers
};
} catch(e) { return { success: false, message: e.toString() }; }
}

function submitAttendanceData(form) {
try {
if (!form.sheetUrl || form.sheetUrl === "") return { success: false, message: "Invalid Sheet URL" };

const ss = SpreadsheetApp.openByUrl(form.sheetUrl);
const tabName = form.type === 'trainee' ? "Trainee Attendance" : "Volunteer Attendance";
const sheet = ss.getSheetByName(tabName);

const name = form.targetName || form.data['Name'] || form.data[Object.keys(form.data)[0]];

if (!name) return { success: false, message: "No name selected to update." };

const textFinder = sheet.getRange("A:A").createTextFinder(name).matchEntireCell(true);
const cell = textFinder.findNext();
const rawHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

let targetRow;
let attendingStatus = '';

if (!cell) {
if (form.type === 'volunteer') {
let newRow = new Array(rawHeaders.length).fill("");
newRow[0] = name;

let projectVal = "";

for (const [cleanKey, value] of Object.entries(form.data)) {
const normKey = normalizeHeader(cleanKey);
if(normKey.includes("project")) projectVal = value;

for(let i=0; i<rawHeaders.length; i++) {
   const normHeader = normalizeHeader(rawHeaders[i]);
   const isMatch = normHeader === normKey ||
                   (normKey.includes("meetinglocation") && normHeader.includes("meetinglocation")) ||
                   (normKey.includes("dismissallocation") && normHeader.includes("dismissallocation")) ||
                   (normKey.includes("attending") && normHeader.includes("attending")) ||
                   (normKey.includes("caregiver") && normHeader.includes("caregiver"));
   if (isMatch) {
     newRow[i] = value;
     if (normHeader.includes("attending")) attendingStatus = value.toString().toLowerCase();
     break;
   }
}
}

const colAVals = sheet.getRange("A:A").getValues();
let insertRow = -1;
for (let k = 1; k < colAVals.length; k++) {
 if (!colAVals[k][0]) {
    insertRow = k + 1;
    break;
 }
}
if (insertRow === -1) insertRow = sheet.getLastRow() + 1;
sheet.getRange(insertRow, 1, 1, newRow.length).setValues([newRow]);

// --- UPDATE TEMPLATE (Name AND Project) ---
try {
  const templateFolder = DriveApp.getFolderById(getTemplateFolderId());
  const tFiles = templateFolder.getFilesByType(MimeType.GOOGLE_SHEETS);
  if (tFiles.hasNext()) {
      const tFile = tFiles.next();
      const tSS = SpreadsheetApp.open(tFile);
      const tSheet = tSS.getSheetByName("Volunteer Attendance");
      const tFinder = tSheet.getRange("A:A").createTextFinder(name).matchEntireCell(true);
      
      if (!tFinder.findNext()) {
         const tColA = tSheet.getRange("A:A").getValues();
         let tInsertRow = -1;
         for (let m = 1; m < tColA.length; m++) {
            if (!tColA[m][0]) {
               tInsertRow = m + 1;
               break;
            }
         }
         if (tInsertRow === -1) tInsertRow = tSheet.getLastRow() + 1;
        
         tSheet.getRange(tInsertRow, 1).setValue(name);

         if(projectVal) {
           const tHeaders = tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0];
           const tProjIdx = getColIndex(tHeaders, "project");
           if (tProjIdx > -1) {
             tSheet.getRange(tInsertRow, tProjIdx + 1).setValue(projectVal);
           }
         }
      }
  }
} catch (err) { console.log("Template update failed: " + err.toString()); }

runSheetMaintenance(form.sheetUrl);

return { success: true, message: "New volunteer added successfully & Attendance updated!" };
}
return { success: false, message: "Record not found to update for: " + name };
} else {
targetRow = cell.getRow();
for (const [cleanKey, value] of Object.entries(form.data)) {
const normKey = normalizeHeader(cleanKey);
for(let i=0; i<rawHeaders.length; i++) {
 const normHeader = normalizeHeader(rawHeaders[i]);
 const isMatch = normHeader === normKey ||
                 (normKey.includes("meetinglocation") && normHeader.includes("meetinglocation")) ||
                 (normKey.includes("dismissallocation") && normHeader.includes("dismissallocation")) ||
                 (normKey.includes("attending") && normHeader.includes("attending")) ||
                 (normKey.includes("caregiver") && normHeader.includes("caregiver"));

 if (isMatch) {
   if (normHeader.includes("project")) {
       break;
   }
   
   if (normHeader.includes("attending")) attendingStatus = value.toString().toLowerCase();
  
   sheet.getRange(targetRow, i + 1).setValue(value);
   break;
 }
}
}

// --- LOGICAL CASCADE: If 'N' attending, unpair globally ---
if (attendingStatus === 'n') {
    const tSheet = ss.getSheetByName("Trainee Attendance");
    if (form.type === 'trainee') {
        // Trainee is not attending -> Clear their volunteer paired
        const tHeaders = tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0];
        const tVolPairedIdx = getColIndex(tHeaders, "vol paired");
        if (tVolPairedIdx > -1) {
            tSheet.getRange(targetRow, tVolPairedIdx + 1).setValue("");
        }
    } else if (form.type === 'volunteer') {
        // Volunteer is not attending -> Strip them from ANY trainee's 'vol paired' column
        if (tSheet) {
            const tLastRow = tSheet.getLastRow();
            if (tLastRow > 1) {
                const tHeaders = tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0];
                const tVolPairedIdx = getColIndex(tHeaders, "vol paired");
                if (tVolPairedIdx > -1) {
                    const tRange = tSheet.getRange(2, 1, tLastRow - 1, tSheet.getLastColumn());
                    const tData = tRange.getValues();
                    let tChanged = false;
                    
                    const nameClean = name.toLowerCase();
                    for(let k=0; k<tData.length; k++){
                        const currentPaired = tData[k][tVolPairedIdx] ? tData[k][tVolPairedIdx].toString() : "";
                        if (currentPaired.toLowerCase().includes(nameClean)) {
                            // Splice the name out
                            const vols = currentPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
                            const updatedVols = vols.filter(v => v.toLowerCase() !== nameClean);
                            tData[k][tVolPairedIdx] = updatedVols.join(', ');
                            tChanged = true;
                        }
                    }
                    if (tChanged) tRange.setValues(tData);
                }
            }
        }
    }
}

runSheetMaintenance(form.sheetUrl);

return { success: true, message: "Attendance updated successfully!" };
}
} catch(e) { return { success: false, message: e.toString() }; }
}