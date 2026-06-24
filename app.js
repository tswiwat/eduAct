// State & Configuration Management
let state = {
  activities: [],
  scans: [],
  activeActivityId: '',
  theme: 'light',
  currentTab: 'scan',
  activeCameraId: '',
  isScanning: false
};

let config = {
  formScansUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSdSWjomjgkgdqmhs5qniDg_v8kfl3RjJlnk6cZaLNJ9Ody15w/formResponse',
  formScansEntryId: 'entry.516759243',
  formScansEntryAct: 'entry.1191458563',
  sheetScansTsvUrl: '',
  
  formActsUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSeDRWFcB1z6szNOYi4CwXNlsViOwLUIrRv3k4gPD1tOv9LKeQ/formResponse',
  formActsEntryId: 'entry.1257509628',
  formActsEntryName: 'entry.1200865155',
  formActsEntryDate: 'entry.468554742',
  formActsEntryTime: 'entry.1824685290',
  sheetActsTsvUrl: ''
};

// Scanner instance and pause state
let html5QrCode = null;
let isScanPaused = false;

// Audio Synthesizer Beep (Success & Error tones)
function playBeep(success = true) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (success) {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      oscillator.stop(audioCtx.currentTime + 0.15);
      
      if (navigator.vibrate) {
        navigator.vibrate(60);
      }
    } else {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, audioCtx.currentTime); // Low frequency
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      oscillator.stop(audioCtx.currentTime + 0.35);
      
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    }
  } catch (e) {
    console.warn("Web Audio API not supported or blocked on this device.");
  }
}

// Toast Notifications System
function showToast(title, message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconSVG = '';
  if (type === 'success') {
    iconSVG = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>`;
  } else if (type === 'error') {
    iconSVG = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>`;
  } else {
    iconSVG = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
  }

  toast.innerHTML = `
    <div class="toast-icon">${iconSVG}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeIn 0.3s ease-in-out reverse';
    setTimeout(() => {
      if (toast.parentNode === container) {
        container.removeChild(toast);
      }
    }, 300);
  }, 3500);
}

// LocalStorage Helper Functions
const STORAGE_KEYS = {
  ACTIVITIES: 'edu_activities_v1',
  SCANS: 'edu_scans_v1',
  ACTIVE_ACTIVITY: 'edu_active_activity_v1',
  THEME: 'edu_theme_v1',
  
  FORM_SCANS_URL: 'edu_f_scans_url_v1',
  FORM_SCANS_ENTRY_ID: 'edu_f_scans_entry_id_v1',
  FORM_SCANS_ENTRY_ACT: 'edu_f_scans_entry_act_v1',
  SHEET_SCANS_TSV_URL: 'edu_s_scans_tsv_v1',
  
  FORM_ACTS_URL: 'edu_f_acts_url_v1',
  FORM_ACTS_ENTRY_ID: 'edu_f_acts_entry_id_v1',
  FORM_ACTS_ENTRY_NAME: 'edu_f_acts_entry_name_v1',
  FORM_ACTS_ENTRY_DATE: 'edu_f_acts_entry_date_v1',
  FORM_ACTS_ENTRY_TIME: 'edu_f_acts_entry_time_v1',
  SHEET_ACTS_TSV_URL: 'edu_s_acts_tsv_v1'
};

function loadFromStorage() {
  try {
    const storedActivities = localStorage.getItem(STORAGE_KEYS.ACTIVITIES);
    state.activities = storedActivities ? JSON.parse(storedActivities) : [];
  } catch (e) {
    console.error("Failed to load activities:", e);
    state.activities = [];
  }

  try {
    const storedScans = localStorage.getItem(STORAGE_KEYS.SCANS);
    state.scans = storedScans ? JSON.parse(storedScans) : [];
  } catch (e) {
    console.error("Failed to load scans:", e);
    state.scans = [];
  }

  try {
    state.activeActivityId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ACTIVITY) || '';
    state.theme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    
    const getStored = (key, fallback) => {
      const val = localStorage.getItem(key);
      return val !== null ? val : fallback;
    };
    
    config.formScansUrl = getStored(STORAGE_KEYS.FORM_SCANS_URL, 'https://docs.google.com/forms/d/e/1FAIpQLSdSWjomjgkgdqmhs5qniDg_v8kfl3RjJlnk6cZaLNJ9Ody15w/formResponse');
    config.formScansEntryId = getStored(STORAGE_KEYS.FORM_SCANS_ENTRY_ID, 'entry.516759243');
    config.formScansEntryAct = getStored(STORAGE_KEYS.FORM_SCANS_ENTRY_ACT, 'entry.1191458563');
    config.sheetScansTsvUrl = getStored(STORAGE_KEYS.SHEET_SCANS_TSV_URL, '');
    
    config.formActsUrl = getStored(STORAGE_KEYS.FORM_ACTS_URL, 'https://docs.google.com/forms/d/e/1FAIpQLSeDRWFcB1z6szNOYi4CwXNlsViOwLUIrRv3k4gPD1tOv9LKeQ/formResponse');
    config.formActsEntryId = getStored(STORAGE_KEYS.FORM_ACTS_ENTRY_ID, 'entry.1257509628');
    config.formActsEntryName = getStored(STORAGE_KEYS.FORM_ACTS_ENTRY_NAME, 'entry.1200865155');
    config.formActsEntryDate = getStored(STORAGE_KEYS.FORM_ACTS_ENTRY_DATE, 'entry.468554742');
    config.formActsEntryTime = getStored(STORAGE_KEYS.FORM_ACTS_ENTRY_TIME, 'entry.1824685290');
    config.sheetActsTsvUrl = getStored(STORAGE_KEYS.SHEET_ACTS_TSV_URL, '');
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(state.activities));
    localStorage.setItem(STORAGE_KEYS.SCANS, JSON.stringify(state.scans));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ACTIVITY, state.activeActivityId);
    localStorage.setItem(STORAGE_KEYS.THEME, state.theme);
    
    localStorage.setItem(STORAGE_KEYS.FORM_SCANS_URL, config.formScansUrl);
    localStorage.setItem(STORAGE_KEYS.FORM_SCANS_ENTRY_ID, config.formScansEntryId);
    localStorage.setItem(STORAGE_KEYS.FORM_SCANS_ENTRY_ACT, config.formScansEntryAct);
    localStorage.setItem(STORAGE_KEYS.SHEET_SCANS_TSV_URL, config.sheetScansTsvUrl);
    
    localStorage.setItem(STORAGE_KEYS.FORM_ACTS_URL, config.formActsUrl);
    localStorage.setItem(STORAGE_KEYS.FORM_ACTS_ENTRY_ID, config.formActsEntryId);
    localStorage.setItem(STORAGE_KEYS.FORM_ACTS_ENTRY_NAME, config.formActsEntryName);
    localStorage.setItem(STORAGE_KEYS.FORM_ACTS_ENTRY_DATE, config.formActsEntryDate);
    localStorage.setItem(STORAGE_KEYS.FORM_ACTS_ENTRY_TIME, config.formActsEntryTime);
    localStorage.setItem(STORAGE_KEYS.SHEET_ACTS_TSV_URL, config.sheetActsTsvUrl);
  } catch (e) {
    console.error("Failed to save to local storage:", e);
  }
}

// Init Application
window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.innerHTML = `
    #scanner-reader video {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
    }
  `;
  document.head.appendChild(style);

  loadFromStorage();
  initThemeToggle();
  initTabs();
  initActivityForm();
  initDashboard();
  initScannerSettings();
  initDataManagement();
  
  // Render lists initially
  renderActivityDropdowns();
  renderActivityTable();
  updateScanStats();
  
  // Populate form input values from storage
  document.getElementById('form-scans-url').value = config.formScansUrl;
  document.getElementById('form-scans-entry-id').value = config.formScansEntryId;
  document.getElementById('form-scans-entry-act').value = config.formScansEntryAct;
  document.getElementById('sheet-scans-tsv-url').value = config.sheetScansTsvUrl;
  
  document.getElementById('form-acts-url').value = config.formActsUrl;
  document.getElementById('form-acts-entry-id').value = config.formActsEntryId;
  document.getElementById('form-acts-entry-name').value = config.formActsEntryName;
  document.getElementById('form-acts-entry-date').value = config.formActsEntryDate;
  document.getElementById('form-acts-entry-time').value = config.formActsEntryTime;
  document.getElementById('sheet-acts-tsv-url').value = config.sheetActsTsvUrl;
  
  updateSyncButtonVisibility();
  
  // Auto-sync database from Sheets TSV on startup
  if (config.sheetScansTsvUrl || config.sheetActsTsvUrl) {
    syncFromSheets();
  }
});

// Theme Toggle Setup
function initThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle');
  document.documentElement.setAttribute('data-theme', state.theme);
  
  toggleBtn.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    saveToStorage();
    showToast("เปลี่ยนธีม", `เปลี่ยนเป็นธีม ${state.theme === 'light' ? 'สว่าง' : 'มืด'} เรียบร้อย`, "success");
  });
}

// Tab Switching Setup
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      
      if (state.currentTab === 'scan' && tabName !== 'scan') {
        stopScanner();
      }
      
      state.currentTab = tabName;
      
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${tabName}-tab`) {
          content.classList.add('active');
        }
      });
      
      if (tabName === 'scan') {
        renderActivityDropdowns();
        renderRecentScans();
      } else if (tabName === 'activity') {
        renderActivityTable();
        if (config.sheetActsTsvUrl || config.sheetScansTsvUrl) {
          syncFromSheets(true);
        }
      } else if (tabName === 'dashboard') {
        renderActivityDropdowns();
        refreshDashboard();
      }
    });
  });
}

// Activity Management Form setup
function initActivityForm() {
  const form = document.getElementById('activity-form');
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const nameInput = document.getElementById('activity-name');
    const dateInput = document.getElementById('activity-date');
    const timeInput = document.getElementById('activity-time');
    
    const name = nameInput.value.trim();
    const date = dateInput.value;
    const time = timeInput.value || '00:00';
    
    if (!name || !date) {
      showToast("กรอกข้อมูลไม่ครบ", "โปรดระบุชื่อกิจกรรมและวันที่จัดกิจกรรม", "warning");
      return;
    }
    
    const exists = state.activities.some(act => act.name.toLowerCase() === name.toLowerCase() && act.date === date);
    if (exists) {
      showToast("กิจกรรมซ้ำ", "มีกิจกรรมชื่อนี้ในวันที่กำหนดอยู่แล้ว", "warning");
      return;
    }
    
    const newActivity = {
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: name,
      date: date,
      time: time,
      synced: false
    };
    
    state.activities.push(newActivity);
    
    if (!state.activeActivityId) {
      state.activeActivityId = newActivity.id;
    }
    
    saveToStorage();
    form.reset();
    document.getElementById('activity-date').valueAsDate = new Date();
    
    renderActivityDropdowns();
    renderActivityTable();
    showToast("บันทึกในเครื่อง", `สร้างกิจกรรม "${name}" เรียบร้อยแล้ว`, "success");
    
    // Send to Google Sheets via Form POST
    if (config.formActsUrl) {
      const params = {};
      params[config.formActsEntryId] = newActivity.id;
      params[config.formActsEntryName] = newActivity.name;
      params[config.formActsEntryDate] = newActivity.date;
      params[config.formActsEntryTime] = newActivity.time;
      
      submitToForm(config.formActsUrl, params).then(success => {
        if (success) {
          newActivity.synced = true;
          saveToStorage();
          renderActivityTable();
          updateSyncButtonVisibility();
          showToast("ออนไลน์", "บันทึกข้อมูลกิจกรรมลง Google Sheets แล้ว", "success");
        } else {
          showToast("โหมดออฟไลน์", "เก็บประวัติในเครื่องแล้ว จะอัปโหลดเมื่ออินเทอร์เน็ตพร้อม", "warning");
          updateSyncButtonVisibility();
        }
      });
    } else {
      updateSyncButtonVisibility();
    }
  });
  
  document.getElementById('activity-date').valueAsDate = new Date();
}

// Render Activities in Table
function renderActivityTable() {
  const tbody = document.getElementById('activity-table-body');
  
  if (state.activities.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <p>ยังไม่มีรายการกิจกรรมในระบบ เริ่มสร้างโดยกรอกฟอร์มด้านบน</p>
        </td>
      </tr>
    `;
    return;
  }
  
  const sortedActivities = [...state.activities].sort((a, b) => {
    return new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`);
  });
  
  tbody.innerHTML = sortedActivities.map((act, index) => {
    const scanCount = state.scans.filter(s => s.activityName === act.name && s.isValid === true).length;
    const thaiDate = formatThaiDate(act.date);
    const syncStatus = act.synced 
      ? '<span class="badge" style="background-color: rgba(16, 185, 129, 0.1); color: var(--success-color);">ซิงค์แล้ว</span>'
      : '<span class="badge" style="background-color: rgba(249, 115, 22, 0.1); color: var(--secondary-color);">รอซิงค์</span>';
    
    return `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHTML(act.name)}</strong></td>
        <td>${thaiDate} (${act.time} น.)</td>
        <td><span class="badge badge-primary">${scanCount} คน</span> ${syncStatus}</td>
        <td>
          <button type="button" class="btn btn-secondary btn-danger cursor-pointer" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="deleteActivity('${act.id}')">
            ลบ
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Delete Activity
window.deleteActivity = function(id) {
  const act = state.activities.find(a => a.id === id);
  if (!act) return;
  
  const scanCount = state.scans.filter(s => s.activityName === act.name).length;
  let confirmMessage = `ยืนยันการลบกิจกรรม "${act.name}"?`;
  if (scanCount > 0) {
    confirmMessage += `\n*คำเตือน: กิจกรรมนี้มีข้อมูลการสแกนแล้ว ${scanCount} รายการ ข้อมูลในเครื่องจะคงอยู่ แต่อาจแสดงผลไม่ครบในแดชบอร์ด`;
  }
  
  if (confirm(confirmMessage)) {
    state.activities = state.activities.filter(a => a.id !== id);
    if (state.activeActivityId === id) {
      state.activeActivityId = state.activities.length > 0 ? state.activities[0].id : '';
    }
    saveToStorage();
    renderActivityDropdowns();
    renderActivityTable();
    updateSyncButtonVisibility();
    showToast("ลบสำเร็จ", `ลบกิจกรรมเรียบร้อยแล้ว (หากอัปโหลดขึ้น Google Sheet แล้ว ต้องเข้าไปลบแถวเองในชีต)`, "success");
  }
};

// Render Activity dropdowns
function renderActivityDropdowns() {
  const scanSelect = document.getElementById('scan-activity-select');
  const dashSelect = document.getElementById('dash-activity-select');
  
  const sorted = [...state.activities].sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`));
  
  if (sorted.length === 0) {
    scanSelect.innerHTML = `<option value="">-- โปรดสร้างกิจกรรมก่อนในแท็บจัดการกิจกรรม --</option>`;
    state.activeActivityId = '';
  } else {
    const activeExists = sorted.some(act => act.id === state.activeActivityId);
    if (!state.activeActivityId || !activeExists) {
      state.activeActivityId = sorted[0].id;
    }
    
    scanSelect.innerHTML = sorted.map(act => {
      const selectedAttr = act.id === state.activeActivityId ? 'selected' : '';
      return `<option value="${act.id}" ${selectedAttr}>${escapeHTML(act.name)} (${formatThaiDate(act.date)})</option>`;
    }).join('');
  }
  
  const currentDashVal = dashSelect ? dashSelect.value : 'ALL';
  let dashOptions = `<option value="ALL">-- แสดงทุกกิจกรรมรวมกัน --</option>` + sorted.map(act => {
    const isSelected = act.name === currentDashVal ? 'selected' : '';
    return `<option value="${escapeHTML(act.name)}" ${isSelected}>${escapeHTML(act.name)} (${formatThaiDate(act.date)})</option>`;
  }).join('');
  
  if (dashSelect) {
    dashSelect.innerHTML = dashOptions;
  }
}

// Scanner Settings
function initScannerSettings() {
  const startBtn = document.getElementById('btn-start-scan');
  const stopBtn = document.getElementById('btn-stop-scan');
  const cameraSelect = document.getElementById('camera-select');
  const scanSelect = document.getElementById('scan-activity-select');
  
  scanSelect.addEventListener('change', (e) => {
    state.activeActivityId = e.target.value;
    saveToStorage();
    renderRecentScans();
  });
  
  cameraSelect.addEventListener('change', (e) => {
    state.activeCameraId = e.target.value;
    if (state.isScanning) {
      stopScanner().then(() => {
        startScanner();
      });
    }
  });
  
  startBtn.addEventListener('click', () => {
    if (!state.activeActivityId) {
      showToast("เลือกกิจกรรมก่อน", "กรุณาเลือกกิจกรรมที่ต้องการสแกน หรือสร้างขึ้นใหม่", "warning");
      return;
    }
    startScanner();
  });
  
  stopBtn.addEventListener('click', () => {
    stopScanner();
  });
  
  cameraSelect.innerHTML = `<option value="">-- กล้องเริ่มต้นของอุปกรณ์ --</option>`;
  renderRecentScans();
}

function startScanner() {
  const startBtn = document.getElementById('btn-start-scan');
  const stopBtn = document.getElementById('btn-stop-scan');
  const cameraSelect = document.getElementById('camera-select');
  const placeholder = document.getElementById('scanner-placeholder');
  const videoElem = document.getElementById('scanner-reader');
  
  if (state.isScanning) return;
  
  placeholder.style.display = 'none';
  videoElem.style.display = 'block';
  
  html5QrCode = new Html5Qrcode("scanner-reader");
  
  const config = {
    fps: 10, // Capped to 10 FPS to prevent CPU overheating and freezing on mobile
    qrbox: (width, height) => {
      const size = Math.max(200, Math.min(320, Math.min(width, height) * 0.75));
      return { width: size, height: size };
    }
  };
  
  const cameraIdOrFacing = state.activeCameraId ? state.activeCameraId : { facingMode: "environment" };
  
  html5QrCode.start(
    cameraIdOrFacing,
    config,
    onScanSuccess,
    onScanFailure
  ).then(() => {
    state.isScanning = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-flex';
    
    // Retrieve other camera devices on success
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length > 0) {
        let activeId = '';
        try {
          if (html5QrCode && typeof html5QrCode.getCameraId === 'function') {
            activeId = html5QrCode.getCameraId();
          }
        } catch (e) {
          console.warn(e);
        }
        
        let selectOptions = '';
        devices.forEach((device, index) => {
          const label = device.label || `กล้องที่ ${index + 1}`;
          const isSelected = device.id === activeId || device.id === state.activeCameraId;
          if (isSelected && !state.activeCameraId) {
            state.activeCameraId = device.id;
          }
          selectOptions += `<option value="${device.id}" ${isSelected ? 'selected' : ''}>${label}</option>`;
        });
        cameraSelect.innerHTML = selectOptions;
      }
    }).catch(err => {
      console.warn("Could not retrieve camera list names:", err);
    });
    
    showToast("เปิดกล้องแล้ว", "หันบาร์โค้ดหรือ QR Code หน้าบัตรให้อยู่ในกรอบเป้าเล็ง", "success");
  }).catch(err => {
    console.error("Camera start error:", err);
    showToast("เปิดกล้องล้มเหลว", "โปรดอนุญาตสิทธิ์กล้อง และเปิดเข้าใช้ผ่านลิงก์ HTTPS", "error");
    placeholder.style.display = 'flex';
    videoElem.style.display = 'none';
    cameraSelect.innerHTML = `<option value="">-- ขอสิทธิ์กล้องล้มเหลว --</option>`;
  });
}

function stopScanner() {
  return new Promise((resolve) => {
    const startBtn = document.getElementById('btn-start-scan');
    const stopBtn = document.getElementById('btn-stop-scan');
    const placeholder = document.getElementById('scanner-placeholder');
    const videoElem = document.getElementById('scanner-reader');
    
    if (!state.isScanning || !html5QrCode) {
      resolve();
      return;
    }
    
    html5QrCode.stop().then(() => {
      html5QrCode = null;
      state.isScanning = false;
      startBtn.style.display = 'inline-flex';
      stopBtn.style.display = 'none';
      placeholder.style.display = 'flex';
      videoElem.style.display = 'none';
      showToast("ปิดกล้องแล้ว", "หยุดการใช้งานกล้องสแกนเนอร์", "warning");
      resolve();
    }).catch(err => {
      console.error("Camera stop error:", err);
      resolve();
    });
  });
}

// Handle QR/Barcode successfully detected
let lastScannedText = '';
let lastScannedTime = 0;

function onScanSuccess(decodedText, decodedResult) {
  if (isScanPaused) return; // Prevent loop scan glitch
  
  const scanData = decodedText.trim();
  const now = Date.now();
  
  if (scanData === lastScannedText && (now - lastScannedTime) < 3000) {
    return; 
  }
  
  // Pause scanner for 2.5 seconds to allow UI updates and prevent duplicate scan triggers
  isScanPaused = true;
  setTimeout(() => {
    isScanPaused = false;
  }, 2500);
  
  lastScannedText = scanData;
  lastScannedTime = now;
  
  const isStudentIdValid = /^\d{9}$/.test(scanData);
  
  if (!state.activeActivityId) {
    playBeep(false);
    showToast("ไม่ได้เลือกกิจกรรม", "โปรดเลือกกิจกรรมที่จะลงบันทึกก่อน", "error");
    return;
  }
  
  const activeAct = state.activities.find(a => a.id === state.activeActivityId);
  const activityName = activeAct ? activeAct.name : 'กิจกรรมทั่วไป';
  
  if (!isStudentIdValid) {
    playBeep(false);
    addScanRecord(scanData, activityName, false, "รหัสไม่ถูกต้อง (ต้องเป็นตัวเลข 9 หลัก)");
    showToast("รหัสไม่ถูกต้อง", `รหัสนักศึกษาต้องเป็นตัวเลข 9 หลักเท่านั้น (พบ: ${scanData})`, "error");
    renderRecentScans();
    return;
  }
  
  const isDuplicate = state.scans.some(s => s.studentId === scanData && s.activityName === activityName && s.isValid === true);
  
  if (isDuplicate) {
    playBeep(false);
    showToast("ลงทะเบียนแล้ว", `รหัส ${scanData} เคยลงชื่อในกิจกรรม "${activityName}" แล้ว`, "warning");
    addScanRecord(scanData, activityName, false, "ลงทะเบียนซ้ำซ้อน");
    renderRecentScans();
    return;
  }
  
  // Save scan locally
  playBeep(true);
  
  const newScan = {
    id: 'scan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    studentId: scanData,
    activityName: activityName,
    isValid: true,
    status: "บันทึกสำเร็จ",
    synced: false
  };
  
  state.scans.unshift(newScan);
  saveToStorage();
  renderRecentScans();
  showToast("บันทึกในเครื่อง", `บันทึกรหัสนักศึกษา ${scanData} สำเร็จ`, "success");
  
  // Scanning visual HUD green flash
  const targetBox = document.querySelector('.scanner-target-box');
  if (targetBox) {
    targetBox.style.borderColor = 'var(--success-color)';
    setTimeout(() => {
      targetBox.style.borderColor = 'rgba(255, 255, 255, 0.4)';
    }, 600);
  }
  
  // Send scan data online to Google Sheets via Forms
  if (config.formScansUrl) {
    const params = {};
    params[config.formScansEntryId] = newScan.studentId;
    params[config.formScansEntryAct] = newScan.activityName;
    
    submitToForm(config.formScansUrl, params).then(success => {
      if (success) {
        newScan.synced = true;
        saveToStorage();
        showToast("ออนไลน์", `บันทึกข้อมูลรหัส ${scanData} ลง Google Sheet แล้ว`, "success");
      } else {
        showToast("โหมดออฟไลน์", "ไม่สามารถส่งลง Google Sheet ได้ แต่ประวัติเซฟในเครื่องแล้ว", "warning");
      }
      updateSyncButtonVisibility();
    });
  } else {
    updateSyncButtonVisibility();
  }
}

function onScanFailure(error) {
  // Silent scan failures
}

// Add a local scan log item
function addScanRecord(studentId, activityName, isValid, statusMsg) {
  const newScan = {
    id: 'scan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    studentId: studentId,
    activityName: activityName,
    isValid: isValid,
    status: statusMsg,
    synced: false
  };
  
  state.scans.unshift(newScan);
  saveToStorage();
}

// Render Recent Scans in the Sidebar
function renderRecentScans() {
  const container = document.getElementById('recent-scans-list');
  const activeAct = state.activities.find(a => a.id === state.activeActivityId);
  const currentActivityName = activeAct ? activeAct.name : '';
  
  const filteredScans = state.scans.filter(s => s.activityName === currentActivityName);
  
  if (filteredScans.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; margin: 2rem 0;">ยังไม่มีการสแกนในกิจกรรมนี้</p>`;
    return;
  }
  
  const recent = filteredScans.slice(0, 10);
  
  container.innerHTML = recent.map(scan => {
    const timeStr = new Date(scan.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const itemClass = scan.isValid ? 'scan-item' : 'scan-item invalid';
    const statusClass = scan.isValid ? 'scan-item-status success' : 'scan-item-status invalid';
    const syncStatus = scan.synced 
      ? '<span style="color: var(--success-color);">• ซิงค์แล้ว</span>'
      : '<span style="color: var(--secondary-color);">• รอซิงค์</span>';
    
    return `
      <div class="${itemClass}">
        <div class="scan-item-info">
          <div class="scan-item-id">${scan.studentId}</div>
          <div class="scan-item-time">เวลา: ${timeStr} น. ${syncStatus} | ${scan.status}</div>
        </div>
        <div class="${statusClass}">
          ${scan.isValid ? 'ผ่าน' : 'ไม่ผ่าน'}
        </div>
      </div>
    `;
  }).join('');
}

// Dashboard tab controller
function initDashboard() {
  const dashSelect = document.getElementById('dash-activity-select');
  const searchInput = document.getElementById('dash-search-input');
  const exportExcelBtn = document.getElementById('btn-export-excel');
  const exportCsvBtn = document.getElementById('btn-export-csv');
  
  dashSelect.addEventListener('change', () => {
    refreshDashboard();
  });
  
  searchInput.addEventListener('input', () => {
    filterDashboardTable();
  });
  
  exportExcelBtn.addEventListener('click', () => {
    exportReport('excel');
  });
  
  exportCsvBtn.addEventListener('click', () => {
    exportReport('csv');
  });
}

function refreshDashboard() {
  updateScanStats();
  filterDashboardTable();
}

// Update the summary numbers (Key Metrics Cards)
function updateScanStats() {
  const selectedAct = document.getElementById('dash-activity-select').value;
  
  let activeScans = state.scans.filter(s => s.isValid === true);
  let failedScans = state.scans.filter(s => s.isValid === false);
  
  if (selectedAct !== 'ALL') {
    activeScans = activeScans.filter(s => s.activityName === selectedAct);
    failedScans = failedScans.filter(s => s.activityName === selectedAct);
  }
  
  const uniqueStudents = new Set(activeScans.map(s => s.studentId));
  
  document.getElementById('stat-total-scans').innerText = activeScans.length;
  document.getElementById('stat-unique-students').innerText = uniqueStudents.size;
  document.getElementById('stat-failed-scans').innerText = failedScans.length;
}

// Filter the table inside dashboard
function filterDashboardTable() {
  const selectedAct = document.getElementById('dash-activity-select').value;
  const searchQuery = document.getElementById('dash-search-input').value.trim();
  const tbody = document.getElementById('dashboard-table-body');
  
  let filtered = state.scans;
  
  if (selectedAct !== 'ALL') {
    filtered = filtered.filter(s => s.activityName === selectedAct);
  }
  
  if (searchQuery) {
    filtered = filtered.filter(s => s.studentId.includes(searchQuery));
  }
  
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <p>ไม่พบรายการประวัติสแกนที่ตรงกับเงื่อนไขที่เลือก</p>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = filtered.map((scan, index) => {
    const formattedTime = formatThaiDateTime(scan.timestamp);
    const badgeClass = scan.isValid ? 'badge-primary' : 'btn-danger';
    const statusText = scan.isValid ? 'สำเร็จ' : `ล้มเหลว (${scan.status})`;
    const syncBadge = scan.synced
      ? '<span style="color: var(--success-color);">• ซิงค์แล้ว</span>'
      : '<span style="color: var(--secondary-color);">• ออฟไลน์</span>';
    
    return `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${scan.studentId}</strong></td>
        <td>${escapeHTML(scan.activityName)}</td>
        <td>${formattedTime} น. ${syncBadge}</td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
      </tr>
    `;
  }).join('');
}

// Export dashboard data to Excel or CSV
function exportReport(formatType) {
  const selectedAct = document.getElementById('dash-activity-select').value;
  let dataToExport = state.scans.filter(s => s.isValid === true);
  
  if (selectedAct !== 'ALL') {
    dataToExport = dataToExport.filter(s => s.activityName === selectedAct);
  }
  
  if (dataToExport.length === 0) {
    showToast("ไม่มีข้อมูล", "ไม่มีข้อมูลการเข้าร่วมที่ถูกต้องในการส่งออกสำหรับเงื่อนไขนี้", "warning");
    return;
  }
  
  const rows = dataToExport.map((item, index) => ({
    "ลำดับ": index + 1,
    "รหัสนักศึกษา": item.studentId,
    "ชื่อกิจกรรม": item.activityName,
    "วันเวลาที่บันทึก": formatThaiDateTime(item.timestamp) + ' น.'
  }));
  
  const filename = `รายงานการเข้าร่วมกิจกรรม_${selectedAct === 'ALL' ? 'ทุกกิจกรรม' : selectedAct.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}_${new Date().toISOString().slice(0,10)}`;
  
  if (formatType === 'excel') {
    if (typeof XLSX === 'undefined') {
      showToast("ข้อผิดพลาด", "ระบบกำลังโหลดไลบรารีส่งออกไฟล์ โปรดรอสักครู่หรือตรวจสอบอินเทอร์เน็ต", "error");
      return;
    }
    
    try {
      const ws = XLSX.utils.json_to_sheet(rows);
      const colWidths = [
        { wch: 8 },  // ลำดับ
        { wch: 18 }, // รหัสนักศึกษา
        { wch: 40 }, // ชื่อกิจกรรม
        { wch: 25 }  // วันเวลาที่บันทึก
      ];
      ws['!cols'] = colWidths;
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "รายชื่อผู้เข้าร่วม");
      
      XLSX.writeFile(wb, `${filename}.xlsx`);
      showToast("ดาวน์โหลดสำเร็จ", `ดาวน์โหลดไฟล์ Excel เรียบร้อยแล้ว (${rows.length} รายการ)`, "success");
    } catch (e) {
      console.error(e);
      showToast("ส่งออกล้มเหลว", "เกิดข้อผิดพลาดในการสร้างไฟล์ Excel", "error");
    }
  } else if (formatType === 'csv') {
    try {
      const headers = ["ลำดับ", "รหัสนักศึกษา", "ชื่อกิจกรรม", "วันเวลาที่บันทึก"];
      let csvContent = "\uFEFF"; // UTF-8 BOM
      csvContent += headers.join(",") + "\n";
      
      rows.forEach(r => {
        const rowData = [
          r["ลำดับ"],
          `"${r["รหัสนักศึกษา"]}"`,
          `"${r["ชื่อกิจกรรม"].replace(/"/g, '""')}"`,
          `"${r["วันเวลาที่บันทึก"]}"`
        ];
        csvContent += rowData.join(",") + "\n";
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("ดาวน์โหลดสำเร็จ", `ดาวน์โหลดไฟล์ CSV เรียบร้อยแล้ว (${rows.length} รายการ)`, "success");
    } catch (e) {
      console.error(e);
      showToast("ส่งออกล้มเหลว", "เกิดข้อผิดพลาดในการสร้างไฟล์ CSV", "error");
    }
  }
}

// Google Form Submit Integration (no-cors)
async function submitToForm(formUrl, params) {
  if (!formUrl) return false;
  
  const formData = new URLSearchParams();
  for (const key in params) {
    formData.append(key, params[key]);
  }
  
  try {
    await fetch(formUrl, {
      method: 'POST',
      mode: 'no-cors', // Bypasses CORS policy issues for cross-origin forms
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });
    // no-cors returns an opaque response, which we treat as a successful submit trigger
    return true;
  } catch (e) {
    console.error("Form submission failed:", e);
    return false;
  }
}

// Fetch activities and scans from Google Sheets published TSV URLs
async function syncFromSheets(silent = false) {
  if (!config.sheetScansTsvUrl && !config.sheetActsTsvUrl) return;
  
  if (!silent) {
    showToast("กำลังซิงค์", "กำลังดึงข้อมูลอัปเดตล่าสุดจาก Google Sheets (TSV)...", "warning");
  }
  
  let newActCount = 0;
  let newScanCount = 0;
  
  // 1. Fetch Activities
  if (config.sheetActsTsvUrl) {
    try {
      const response = await fetch(config.sheetActsTsvUrl);
      const text = await response.text();
      const lines = text.split(/\r?\n/);
      
      if (lines.length > 1 && lines[0]) {
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const values = line.split('\t').map(v => v.trim().replace(/^"|"$/g, ''));
          
          // Index mapping based on form response columns: 0=Timestamp, 1=ActivityID, 2=Name, 3=Date, 4=Time
          if (values.length >= 5) {
            const actId = values[1];
            const actName = values[2];
            const actDate = values[3];
            const actTime = values[4];
            
            if (actId && actName) {
              const exists = state.activities.some(a => a.id === actId || (a.name === actName && a.date === actDate));
              if (!exists) {
                state.activities.push({
                  id: actId,
                  name: actName,
                  date: actDate,
                  time: actTime,
                  synced: true
                });
                newActCount++;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to fetch remote activities TSV:", e);
    }
  }
  
  // 2. Fetch Scans
  if (config.sheetScansTsvUrl) {
    try {
      const response = await fetch(config.sheetScansTsvUrl);
      const text = await response.text();
      const lines = text.split(/\r?\n/);
      
      if (lines.length > 1 && lines[0]) {
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const values = line.split('\t').map(v => v.trim().replace(/^"|"$/g, ''));
          
          // Index mapping: 0=Timestamp, 1=StudentID, 2=ActivityName
          if (values.length >= 3) {
            const timestamp = values[0];
            const studentId = values[1];
            const activityName = values[2];
            
            if (studentId && activityName) {
              let isoTimestamp = new Date(timestamp).toISOString();
              if (isNaN(new Date(timestamp).getTime())) {
                isoTimestamp = timestamp;
              }
              
              const exists = state.scans.some(s => s.studentId === studentId && s.activityName === activityName);
              if (!exists) {
                state.scans.push({
                  id: 'scan_remote_' + Math.random().toString(36).substr(2, 5),
                  timestamp: isoTimestamp,
                  studentId: studentId,
                  activityName: activityName,
                  isValid: true,
                  status: "บันทึกสำเร็จ",
                  synced: true
                });
                newScanCount++;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to fetch remote scans TSV:", e);
    }
  }
  
  if (newActCount > 0 || newScanCount > 0) {
    state.scans.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    saveToStorage();
    renderActivityDropdowns();
    renderActivityTable();
    renderRecentScans();
    refreshDashboard();
    showToast("ดึงข้อมูลเสร็จสิ้น", `ได้รับกิจกรรมใหม่ ${newActCount} รายการ และข้อมูลสแกน ${newScanCount} รายการจาก Google Sheets`, "success");
  } else {
    if (!silent) {
      showToast("ซิงค์สำเร็จ", "ข้อมูลตรงกับ Google Sheets ล่าสุดแล้ว", "success");
    }
  }
}

function getUnsyncedCount() {
  const unsyncedActs = state.activities.filter(a => !a.synced).length;
  const unsyncedScans = state.scans.filter(s => !s.synced).length;
  return unsyncedActs + unsyncedScans;
}

function updateSyncButtonVisibility() {
  const syncBtn = document.getElementById('btn-sync-unsynced');
  const count = getUnsyncedCount();
  
  if ((config.formScansUrl || config.formActsUrl) && count > 0) {
    syncBtn.innerHTML = `
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="animation: spin 3s infinite linear; margin-right: 0.5rem; vertical-align: middle;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89"></path>
      </svg>
      มีข้อมูลยังไม่ซิงค์ลง Google Sheet (${count} รายการ) - คลิกเพื่อซิงค์ด่วน
    `;
    syncBtn.style.display = 'block';
  } else {
    syncBtn.style.display = 'none';
  }
}

async function syncUnsyncedItems() {
  if (!config.formScansUrl && !config.formActsUrl) {
    showToast("ไม่ได้ตั้งค่าฟอร์ม", "โปรดตั้งค่า Google Form URL ก่อนทำการกดซิงค์", "warning");
    return;
  }
  
  const count = getUnsyncedCount();
  if (count === 0) {
    showToast("ไม่มีข้อมูลซิงค์", "ข้อมูลทั้งหมดได้รับการบันทึกออนไลน์เรียบร้อยแล้ว", "success");
    return;
  }
  
  showToast("กำลังเริ่มซิงค์", `กำลังประมวลผลข้อมูลออฟไลน์ ${count} รายการไปยัง Google Sheets...`, "warning");
  
  let successCount = 0;
  
  // 1. Sync Activities
  for (let i = 0; i < state.activities.length; i++) {
    const act = state.activities[i];
    if (!act.synced && config.formActsUrl) {
      const params = {};
      params[config.formActsEntryId] = act.id;
      params[config.formActsEntryName] = act.name;
      params[config.formActsEntryDate] = act.date;
      params[config.formActsEntryTime] = act.time;
      
      const success = await submitToForm(config.formActsUrl, params);
      if (success) {
        act.synced = true;
        successCount++;
        saveToStorage();
      }
    }
  }
  
  // 2. Sync Scans
  for (let i = 0; i < state.scans.length; i++) {
    const scan = state.scans[i];
    if (!scan.synced && config.formScansUrl && scan.isValid) {
      const params = {};
      params[config.formScansEntryId] = scan.studentId;
      params[config.formScansEntryAct] = scan.activityName;
      
      const success = await submitToForm(config.formScansUrl, params);
      if (success) {
        scan.synced = true;
        successCount++;
        saveToStorage();
      }
    }
  }
  
  updateSyncButtonVisibility();
  
  if (successCount > 0) {
    showToast("ซิงค์สำเร็จ", `ส่งข้อมูลไปยัง Google Sheets เรียบร้อยแล้ว ${successCount} รายการ!`, "success");
    refreshDashboard();
  } else {
    showToast("ซิงค์ล้มเหลว", "ไม่สามารถส่งข้อมูลได้ โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ต", "error");
  }
}

function saveSheetSettings() {
  config.formScansUrl = document.getElementById('form-scans-url').value.trim();
  config.formScansEntryId = document.getElementById('form-scans-entry-id').value.trim();
  config.formScansEntryAct = document.getElementById('form-scans-entry-act').value.trim();
  config.sheetScansTsvUrl = document.getElementById('sheet-scans-tsv-url').value.trim();
  
  config.formActsUrl = document.getElementById('form-acts-url').value.trim();
  config.formActsEntryId = document.getElementById('form-acts-entry-id').value.trim();
  config.formActsEntryName = document.getElementById('form-acts-entry-name').value.trim();
  config.formActsEntryDate = document.getElementById('form-acts-entry-date').value.trim();
  config.formActsEntryTime = document.getElementById('form-acts-entry-time').value.trim();
  config.sheetActsTsvUrl = document.getElementById('sheet-acts-tsv-url').value.trim();
  
  saveToStorage();
  showToast("บันทึกการตั้งค่า", "บันทึกข้อมูลการเชื่อมโยง Google Sheets เรียบร้อยแล้ว", "success");
  updateSyncButtonVisibility();
  
  if (config.sheetScansTsvUrl || config.sheetActsTsvUrl) {
    syncFromSheets();
  }
}

// Data Backup, Merge, Reset Management
function initDataManagement() {
  const exportBtn = document.getElementById('btn-export-backup');
  const importInput = document.getElementById('import-file-input');
  const resetBtn = document.getElementById('btn-reset-data');
  const saveSheetBtn = document.getElementById('btn-save-sheet-settings');
  const syncUnsyncedBtn = document.getElementById('btn-sync-unsynced');
  
  saveSheetBtn.addEventListener('click', () => {
    saveSheetSettings();
  });
  
  syncUnsyncedBtn.addEventListener('click', () => {
    syncUnsyncedItems();
  });

  exportBtn.addEventListener('click', () => {
    if (state.activities.length === 0 && state.scans.length === 0) {
      showToast("ไม่มีข้อมูล", "ไม่มีข้อมูลสำหรับสำรองในระบบ", "warning");
      return;
    }
    
    const backupData = {
      version: "edu_record_v1",
      timestamp: new Date().toISOString(),
      activities: state.activities,
      scans: state.scans
    };
    
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `EDU_Backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("ส่งออกสำเร็จ", "ดาวน์โหลดไฟล์สำรองข้อมูล JSON เรียบร้อยแล้ว");
  });
  
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const data = JSON.parse(evt.target.result);
        if (data.version !== "edu_record_v1") {
          throw new Error("Invalid file version format");
        }
        
        let newActCount = 0;
        let newScanCount = 0;
        
        data.activities.forEach(incomingAct => {
          const exists = state.activities.some(a => a.id === incomingAct.id || (a.name === incomingAct.name && a.date === incomingAct.date));
          if (!exists) {
            state.activities.push(incomingAct);
            newActCount++;
          }
        });
        
        data.scans.forEach(incomingScan => {
          const exists = state.scans.some(s => s.id === incomingScan.id || (s.studentId === incomingScan.studentId && s.activityName === incomingScan.activityName && s.timestamp === incomingScan.timestamp));
          if (!exists) {
            state.scans.push(incomingScan);
            newScanCount++;
          }
        });
        
        state.scans.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        saveToStorage();
        renderActivityDropdowns();
        renderActivityTable();
        renderRecentScans();
        refreshDashboard();
        updateSyncButtonVisibility();
        
        showToast("นำเข้าข้อมูลเสร็จสิ้น", `เพิ่มกิจกรรมใหม่ ${newActCount} รายการ และข้อมูลสแกนใหม่ ${newScanCount} รายการ`, "success");
        importInput.value = '';
      } catch (err) {
        console.error(err);
        showToast("นำเข้าข้อมูลล้มเหลว", "รูปแบบไฟล์สำรองไม่ถูกต้อง", "error");
        importInput.value = '';
      }
    };
    reader.readAsText(file);
  });
  
  resetBtn.addEventListener('click', () => {
    if (confirm("คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลกิจกรรมและประวัติการสแกนทั้งหมดในเบราว์เซอร์นี้? การกระทำนี้ไม่สามารถย้อนกลับได้")) {
      localStorage.clear();
      state.activities = [];
      state.scans = [];
      state.activeActivityId = '';
      
      config.formScansUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSdSWjomjgkgdqmhs5qniDg_v8kfl3RjJlnk6cZaLNJ9Ody15w/formResponse';
      config.formScansEntryId = 'entry.516759243';
      config.formScansEntryAct = 'entry.1191458563';
      config.sheetScansTsvUrl = '';
      
      config.formActsUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSeDRWFcB1z6szNOYi4CwXNlsViOwLUIrRv3k4gPD1tOv9LKeQ/formResponse';
      config.formActsEntryId = 'entry.1257509628';
      config.formActsEntryName = 'entry.1200865155';
      config.formActsEntryDate = 'entry.468554742';
      config.formActsEntryTime = 'entry.1824685290';
      config.sheetActsTsvUrl = '';
      
      saveToStorage();
      
      document.getElementById('form-scans-url').value = config.formScansUrl;
      document.getElementById('form-scans-entry-id').value = config.formScansEntryId;
      document.getElementById('form-scans-entry-act').value = config.formScansEntryAct;
      document.getElementById('sheet-scans-tsv-url').value = '';
      
      document.getElementById('form-acts-url').value = config.formActsUrl;
      document.getElementById('form-acts-entry-id').value = config.formActsEntryId;
      document.getElementById('form-acts-entry-name').value = config.formActsEntryName;
      document.getElementById('form-acts-entry-date').value = config.formActsEntryDate;
      document.getElementById('form-acts-entry-time').value = config.formActsEntryTime;
      document.getElementById('sheet-acts-tsv-url').value = '';
      
      renderActivityDropdowns();
      renderActivityTable();
      renderRecentScans();
      refreshDashboard();
      updateSyncButtonVisibility();
      
      showToast("ล้างระบบเรียบร้อย", "ข้อมูลการตั้งค่าและฐานข้อมูลถูกรีเซ็ตเรียบร้อยแล้ว", "warning");
    }
  });
}

// Helpers & Formatting Functions
function formatThaiDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  
  const d = parseInt(parts[2]);
  const mIndex = parseInt(parts[1]) - 1;
  const y = parseInt(parts[0]) + 543;
  
  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  
  return `${d} ${thaiMonths[mIndex]} ${y}`;
}

function formatThaiDateTime(isoStr) {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return isoStr;
  
  const d = date.getDate();
  const mIndex = date.getMonth();
  const y = date.getFullYear() + 543;
  
  const hr = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const sec = String(date.getSeconds()).padStart(2, '0');
  
  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  
  return `${d} ${thaiMonths[mIndex]} ${y} ${hr}:${min}:${sec}`;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
