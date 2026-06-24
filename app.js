// State Management
let state = {
  activities: [],
  scans: [],
  activeActivityId: '',
  theme: 'light',
  currentTab: 'scan',
  activeCameraId: '',
  isScanning: false
};

// Scanner instance reference
let html5QrCode = null;

// Audio Synthesizer Beep (Success & Error tones)
function playBeep(success = true) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (success) {
      // High pitch double-beep or single clear chime for success
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      oscillator.stop(audioCtx.currentTime + 0.15);
      
      // Trigger mobile haptic feedback if supported
      if (navigator.vibrate) {
        navigator.vibrate(60);
      }
    } else {
      // Low buzz tone for error
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
    console.warn("Web Audio API is blocked or not supported on this device. Beep skipped.");
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
  
  // Slide out and remove toast after 3.5 seconds
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
  THEME: 'edu_theme_v1'
};

function loadFromStorage() {
  try {
    state.activities = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITIES)) || [];
    state.scans = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCANS)) || [];
    state.activeActivityId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ACTIVITY) || '';
    state.theme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    
    // Set theme attribute on html node
    document.documentElement.setAttribute('data-theme', state.theme);
  } catch (e) {
    console.error("Failed to load local storage:", e);
    showToast("ข้อผิดพลาด", "ไม่สามารถอ่านข้อมูลระบบนำเสนอได้", "error");
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(state.activities));
    localStorage.setItem(STORAGE_KEYS.SCANS, JSON.stringify(state.scans));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ACTIVITY, state.activeActivityId);
    localStorage.setItem(STORAGE_KEYS.THEME, state.theme);
  } catch (e) {
    console.error("Failed to save to local storage:", e);
    showToast("คำเตือน", "พื้นที่จัดเก็บข้อมูลเต็ม! กรุณาส่งออกข้อมูลออกบ้าง", "warning");
  }
}

// Init Application
window.addEventListener('DOMContentLoaded', () => {
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
});

// Theme Toggle Setup
function initThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle');
  
  // Set initial state
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
      
      // If leaving scan tab, stop camera scanning if active
      if (state.currentTab === 'scan' && tabName !== 'scan') {
        stopScanner();
      }
      
      state.currentTab = tabName;
      
      // Update buttons
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update views
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${tabName}-tab`) {
          content.classList.add('active');
        }
      });
      
      // Refresh views on tab entry
      if (tabName === 'dashboard') {
        refreshDashboard();
      } else if (tabName === 'scan') {
        renderRecentScans();
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
    
    // Check for duplicate activity name
    const exists = state.activities.some(act => act.name.toLowerCase() === name.toLowerCase() && act.date === date);
    if (exists) {
      showToast("กิจกรรมซ้ำ", "มีกิจกรรมชื่อนี้ในวันที่กำหนดอยู่แล้ว", "warning");
      return;
    }
    
    const newActivity = {
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: name,
      date: date,
      time: time
    };
    
    state.activities.push(newActivity);
    
    // If there is no active activity, set this new one as active
    if (!state.activeActivityId) {
      state.activeActivityId = newActivity.id;
    }
    
    saveToStorage();
    form.reset();
    
    // Set default date to today again
    document.getElementById('activity-date').valueAsDate = new Date();
    
    renderActivityDropdowns();
    renderActivityTable();
    showToast("บันทึกสำเร็จ", `สร้างกิจกรรม "${name}" เรียบร้อยแล้ว`);
  });
  
  // Set default date to today
  document.getElementById('activity-date').valueAsDate = new Date();
}

// Render Activities in Table (Configuration Tab)
function renderActivityTable() {
  const tbody = document.getElementById('activity-table-body');
  
  if (state.activities.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <p>ยังไม่มีรายการกิจกรรมในระบบ เริ่มสร้างโดยกรอกฟอร์มด้านบน</p>
        </td>
      </tr>
    `;
    return;
  }
  
  // Sort activities by date and time (newest first)
  const sortedActivities = [...state.activities].sort((a, b) => {
    return new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`);
  });
  
  tbody.innerHTML = sortedActivities.map((act, index) => {
    const scanCount = state.scans.filter(s => s.activityName === act.name).length;
    // Format Date to Thai local format
    const thaiDate = formatThaiDate(act.date);
    
    return `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHTML(act.name)}</strong></td>
        <td>${thaiDate} (${act.time} น.)</td>
        <td><span class="badge badge-primary">${scanCount} คน</span></td>
        <td>
          <button class="btn btn-secondary btn-danger cursor-pointer" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="deleteActivity('${act.id}')">
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
    confirmMessage += `\n*คำเตือน: กิจกรรมนี้มีข้อมูลการสแกนแล้ว ${scanCount} รายการ ข้อมูลการสแกนในกิจกรรมนี้จะยังคงอยู่ในประวัติ แต่อาจแสดงผลไม่สมบูรณ์ในรายงานแดชบอร์ด`;
  }
  
  if (confirm(confirmMessage)) {
    state.activities = state.activities.filter(a => a.id !== id);
    if (state.activeActivityId === id) {
      state.activeActivityId = state.activities.length > 0 ? state.activities[0].id : '';
    }
    saveToStorage();
    renderActivityDropdowns();
    renderActivityTable();
    showToast("ลบสำเร็จ", `ลบกิจกรรมเรียบร้อยแล้ว`, "success");
  }
};

// Render Activity dropdowns on Scan Tab and Dashboard Tab
function renderActivityDropdowns() {
  const scanSelect = document.getElementById('scan-activity-select');
  const dashSelect = document.getElementById('dash-activity-select');
  
  // Sort activities by date/time (newest first)
  const sorted = [...state.activities].sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`));
  
  // Scan Dropdown (Requires select an active activity)
  if (sorted.length === 0) {
    scanSelect.innerHTML = `<option value="">-- โปรดสร้างกิจกรรมก่อนในแท็บจัดการกิจกรรม --</option>`;
  } else {
    scanSelect.innerHTML = sorted.map(act => {
      const selectedAttr = act.id === state.activeActivityId ? 'selected' : '';
      return `<option value="${act.id}" ${selectedAttr}>${escapeHTML(act.name)} (${formatThaiDate(act.date)})</option>`;
    }).join('');
    
    // Update active id in state if it was empty
    if (!state.activeActivityId && sorted.length > 0) {
      state.activeActivityId = sorted[0].id;
    }
  }
  
  // Dashboard Dropdown (Allows selecting a specific activity or "All")
  dashSelect.innerHTML = `<option value="ALL">-- แสดงทุกกิจกรรมรวมกัน --</option>` + sorted.map(act => {
    return `<option value="${escapeHTML(act.name)}">${escapeHTML(act.name)} (${formatThaiDate(act.date)})</option>`;
  }).join('');
}

// Scanner Settings (Camera initialization, Start/Stop toggle)
function initScannerSettings() {
  const startBtn = document.getElementById('btn-start-scan');
  const stopBtn = document.getElementById('btn-stop-scan');
  const cameraSelect = document.getElementById('camera-select');
  const scanSelect = document.getElementById('scan-activity-select');
  
  // Update state activeActivityId when select changes
  scanSelect.addEventListener('change', (e) => {
    state.activeActivityId = e.target.value;
    saveToStorage();
    renderRecentScans();
  });
  
  startBtn.addEventListener('click', () => {
    if (!state.activeActivityId) {
      showToast("เลือกกิจกรรมก่อน", "กรุณาเลือกกิจกรรมที่ต้องการสแกน หรือสร้างขึ้นใหม่", "warning");
      return;
    }
    
    // Set selected camera
    state.activeCameraId = cameraSelect.value;
    startScanner();
  });
  
  stopBtn.addEventListener('click', () => {
    stopScanner();
  });
  
  // Populate cameras dropdown
  Html5Qrcode.getCameras().then(devices => {
    if (devices && devices.length > 0) {
      cameraSelect.innerHTML = devices.map((device, index) => {
        // Prefer back camera if available by default
        const isBack = device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear');
        const selectedAttr = isBack || index === 0 ? 'selected' : '';
        return `<option value="${device.id}" ${selectedAttr}>${device.label || `กล้องที่ ${index + 1}`}</option>`;
      }).join('');
    } else {
      cameraSelect.innerHTML = `<option value="">ไม่พบกล้องในอุปกรณ์นี้</option>`;
    }
  }).catch(err => {
    console.error("Error listing cameras:", err);
    cameraSelect.innerHTML = `<option value="">ขอสิทธิ์เข้าใช้งานกล้องไม่สำเร็จ</option>`;
  });
  
  // Show recent scans
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
  
  // Create camera instance
  html5QrCode = new Html5Qrcode("scanner-reader");
  
  const config = {
    fps: 15,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.333333 // 4:3 aspect ratio
  };
  
  // Start Camera Scan
  html5QrCode.start(
    state.activeCameraId || { facingMode: "environment" },
    config,
    onScanSuccess,
    onScanFailure
  ).then(() => {
    state.isScanning = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-flex';
    cameraSelect.disabled = true;
    showToast("เปิดกล้องแล้ว", "เริ่มบันทึกข้อมูลการสแกนอัตโนมัติ", "success");
  }).catch(err => {
    console.error("Camera start error:", err);
    showToast("เปิดกล้องล้มเหลว", "กรุณาอนุญาตสิทธิ์การเข้าถึงกล้องและลองใหม่อีกครั้ง", "error");
    placeholder.style.display = 'flex';
    videoElem.style.display = 'none';
  });
}

function stopScanner() {
  const startBtn = document.getElementById('btn-start-scan');
  const stopBtn = document.getElementById('btn-stop-scan');
  const cameraSelect = document.getElementById('camera-select');
  const placeholder = document.getElementById('scanner-placeholder');
  const videoElem = document.getElementById('scanner-reader');
  
  if (!state.isScanning || !html5QrCode) return;
  
  html5QrCode.stop().then(() => {
    html5QrCode = null;
    state.isScanning = false;
    startBtn.style.display = 'inline-flex';
    stopBtn.style.display = 'none';
    cameraSelect.disabled = false;
    placeholder.style.display = 'flex';
    videoElem.style.display = 'none';
    showToast("ปิดกล้องแล้ว", "หยุดการสแกนบัตรนักศึกษา", "warning");
  }).catch(err => {
    console.error("Camera stop error:", err);
  });
}

// Handle QR/Barcode successfully detected
let lastScannedText = '';
let lastScannedTime = 0;

function onScanSuccess(decodedText, decodedResult) {
  const now = Date.now();
  const scanData = decodedText.trim();
  
  // 1. Debounce same scan string immediately within 3 seconds to avoid multi-register on glitchy camera
  if (scanData === lastScannedText && (now - lastScannedTime) < 3000) {
    return; 
  }
  
  lastScannedText = scanData;
  lastScannedTime = now;
  
  // 2. Validate Student ID format: 9 digits (e.g. 661121301)
  const isStudentIdValid = /^\d{9}$/.test(scanData);
  
  if (!state.activeActivityId) {
    playBeep(false);
    showToast("ไม่ได้เลือกกิจกรรม", "โปรดระบุหรือเลือกกิจกรรมที่จะลงบันทึกในดรอปดาวน์ก่อน", "error");
    return;
  }
  
  const activeAct = state.activities.find(a => a.id === state.activeActivityId);
  const activityName = activeAct ? activeAct.name : 'กิจกรรมทั่วไป';
  
  if (!isStudentIdValid) {
    playBeep(false);
    // Add to logs as invalid scan
    addScanRecord(scanData, activityName, false, "รหัสไม่ถูกต้อง (ต้องเป็นตัวเลข 9 หลัก)");
    showToast("รหัสไม่ถูกต้อง", `สแกนพบ "${scanData}" แต่รหัสนักศึกษาต้องเป็นตัวเลข 9 หลักเท่านั้น`, "error");
    renderRecentScans();
    return;
  }
  
  // 3. Prevent duplicate scan for the SAME activity
  const isDuplicate = state.scans.some(s => s.studentId === scanData && s.activityName === activityName && s.isValid === true);
  
  if (isDuplicate) {
    playBeep(false);
    showToast("ลงทะเบียนแล้ว", `รหัสนักศึกษา ${scanData} ได้ลงทะเบียนกิจกรรม "${activityName}" เรียบร้อยแล้ว`, "warning");
    addScanRecord(scanData, activityName, false, "ลงทะเบียนซ้ำซ้อน");
    renderRecentScans();
    return;
  }
  
  // 4. Save scan to local storage
  playBeep(true);
  addScanRecord(scanData, activityName, true, "บันทึกสำเร็จ");
  showToast("บันทึกสำเร็จ", `รหัส ${scanData} เข้าร่วมกิจกรรม "${activityName}"`, "success");
  
  // Re-render recent scans UI
  renderRecentScans();
  
  // Simple scan HUD flash animation feedback
  const targetBox = document.querySelector('.scanner-target-box');
  if (targetBox) {
    targetBox.style.borderColor = 'var(--success-color)';
    setTimeout(() => {
      targetBox.style.borderColor = 'rgba(255, 255, 255, 0.4)';
    }, 500);
  }
}

function onScanFailure(error) {
  // Silent scan failures (normal behavior when scanning frames do not contain code)
}

// Add a scan log item to State
function addScanRecord(studentId, activityName, isValid, statusMsg) {
  const newScan = {
    id: 'scan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    studentId: studentId,
    activityName: activityName,
    isValid: isValid,
    status: statusMsg
  };
  
  state.scans.unshift(newScan); // Insert at beginning (newest first)
  saveToStorage();
}

// Render Recent Scans in the Sidebar
function renderRecentScans() {
  const container = document.getElementById('recent-scans-list');
  const activeAct = state.activities.find(a => a.id === state.activeActivityId);
  const currentActivityName = activeAct ? activeAct.name : '';
  
  // Filter scans that belong to the active activity only
  const filteredScans = state.scans.filter(s => s.activityName === currentActivityName);
  
  if (filteredScans.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; margin: 2rem 0;">ยังไม่มีการสแกนในกิจกรรมนี้</p>`;
    return;
  }
  
  // Only display the 10 most recent scans
  const recent = filteredScans.slice(0, 10);
  
  container.innerHTML = recent.map(scan => {
    const timeStr = new Date(scan.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const itemClass = scan.isValid ? 'scan-item' : 'scan-item invalid';
    const statusClass = scan.isValid ? 'scan-item-status success' : 'scan-item-status invalid';
    
    return `
      <div class="${itemClass}">
        <div class="scan-item-info">
          <div class="scan-item-id">${scan.studentId}</div>
          <div class="scan-item-time">เวลา: ${timeStr} น. | ${scan.status}</div>
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
  
  // Scans filter
  let activeScans = state.scans.filter(s => s.isValid === true);
  let failedScans = state.scans.filter(s => s.isValid === false);
  
  if (selectedAct !== 'ALL') {
    activeScans = activeScans.filter(s => s.activityName === selectedAct);
    failedScans = failedScans.filter(s => s.activityName === selectedAct);
  }
  
  // Total Scanned (Unique Student IDs who succeeded)
  const uniqueStudents = new Set(activeScans.map(s => s.studentId));
  
  document.getElementById('stat-total-scans').innerText = activeScans.length;
  document.getElementById('stat-unique-students').innerText = uniqueStudents.size;
  document.getElementById('stat-failed-scans').innerText = failedScans.length;
}

// Filter the table inside dashboard based on dropdown activity and search query
function filterDashboardTable() {
  const selectedAct = document.getElementById('dash-activity-select').value;
  const searchQuery = document.getElementById('dash-search-input').value.trim();
  const tbody = document.getElementById('dashboard-table-body');
  
  let filtered = state.scans;
  
  // 1. Filter by activity name
  if (selectedAct !== 'ALL') {
    filtered = filtered.filter(s => s.activityName === selectedAct);
  }
  
  // 2. Filter by search query (StudentID)
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
    
    return `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${scan.studentId}</strong></td>
        <td>${escapeHTML(scan.activityName)}</td>
        <td>${formattedTime} น.</td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
      </tr>
    `;
  }).join('');
}

// Export dashboard data to Excel or CSV
function exportReport(formatType) {
  const selectedAct = document.getElementById('dash-activity-select').value;
  let dataToExport = state.scans.filter(s => s.isValid === true); // Only export successful participants
  
  if (selectedAct !== 'ALL') {
    dataToExport = dataToExport.filter(s => s.activityName === selectedAct);
  }
  
  if (dataToExport.length === 0) {
    showToast("ไม่มีข้อมูล", "ไม่มีข้อมูลการเข้าร่วมที่ถูกต้องในการส่งออกสำหรับเงื่อนไขนี้", "warning");
    return;
  }
  
  // Prepare formatted array for Excel/CSV
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
      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(rows);
      
      // Auto-fit column widths
      const colWidths = [
        { wch: 8 },  // ลำดับ
        { wch: 18 }, // รหัสนักศึกษา
        { wch: 40 }, // ชื่อกิจกรรม
        { wch: 25 }  // วันเวลาที่บันทึก
      ];
      ws['!cols'] = colWidths;
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "รายชื่อผู้เข้าร่วม");
      
      // Download
      XLSX.writeFile(wb, `${filename}.xlsx`);
      showToast("ดาวน์โหลดสำเร็จ", `ดาวน์โหลดไฟล์ Excel เรียบร้อยแล้ว (${rows.length} รายการ)`, "success");
    } catch (e) {
      console.error(e);
      showToast("ส่งออกล้มเหลว", "เกิดข้อผิดพลาดในการสร้างไฟล์ Excel", "error");
    }
  } else if (formatType === 'csv') {
    try {
      // Create CSV string with BOM to support Thai characters in Excel
      const headers = ["ลำดับ", "รหัสนักศึกษา", "ชื่อกิจกรรม", "วันเวลาที่บันทึก"];
      let csvContent = "\uFEFF"; // UTF-8 BOM
      csvContent += headers.join(",") + "\n";
      
      rows.forEach(r => {
        const rowData = [
          r["ลำดับ"],
          `"${r["รหัสนักศึกษา"]}"`, // Wrap in quotes to avoid excel stripping leading zeros
          `"${r["ชื่อกิจกรรม"].replace(/"/g, '""')}"`,
          `"${r["วันเวลาที่บันทึก"]}"`
        ];
        csvContent += rowData.join(",") + "\n";
      });
      
      // Trigger download
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

// Data Import/Export/Reset Control Panel (System tab)
function initDataManagement() {
  const exportBtn = document.getElementById('btn-export-backup');
  const importInput = document.getElementById('import-file-input');
  const resetBtn = document.getElementById('btn-reset-data');
  
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
        
        // 1. Merge Activities (Avoid duplicate IDs)
        data.activities.forEach(incomingAct => {
          const exists = state.activities.some(a => a.id === incomingAct.id || (a.name === incomingAct.name && a.date === incomingAct.date));
          if (!exists) {
            state.activities.push(incomingAct);
            newActCount++;
          }
        });
        
        // 2. Merge Scan Records (Avoid duplicates by scan ID or combination of studentId + activityName + timestamp)
        data.scans.forEach(incomingScan => {
          const exists = state.scans.some(s => s.id === incomingScan.id || (s.studentId === incomingScan.studentId && s.activityName === incomingScan.activityName && s.timestamp === incomingScan.timestamp));
          if (!exists) {
            state.scans.push(incomingScan);
            newScanCount++;
          }
        });
        
        // Sort scans by timestamp descending (newest first)
        state.scans.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        saveToStorage();
        
        // Refresh UI components
        renderActivityDropdowns();
        renderActivityTable();
        renderRecentScans();
        refreshDashboard();
        
        showToast("นำเข้าข้อมูลเสร็จสิ้น", `เพิ่มกิจกรรมใหม่ ${newActCount} รายการ และข้อมูลสแกนใหม่ ${newScanCount} รายการ`, "success");
        importInput.value = ''; // Reset input file
      } catch (err) {
        console.error(err);
        showToast("นำเข้าข้อมูลล้มเหลว", "รูปแบบไฟล์สำรองไม่ถูกต้อง โปรดใช้ไฟล์ JSON ที่ดาวน์โหลดมาจากระบบนี้เท่านั้น", "error");
        importInput.value = '';
      }
    };
    reader.readAsText(file);
  });
  
  resetBtn.addEventListener('click', () => {
    if (confirm("คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลกิจกรรมและประวัติการสแกนทั้งหมดในเบราว์เซอร์นี้? การกระทำนี้ไม่สามารถย้อนกลับได้ (แนะนำให้ดาวน์โหลดไฟล์สำรองเก็บไว้ก่อน)")) {
      localStorage.clear();
      state.activities = [];
      state.scans = [];
      state.activeActivityId = '';
      saveToStorage();
      
      renderActivityDropdowns();
      renderActivityTable();
      renderRecentScans();
      refreshDashboard();
      
      showToast("ล้างระบบเรียบร้อย", "ข้อมูลทั้งหมดถูกลบออกจากเครื่องนี้แล้ว", "warning");
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
  const y = parseInt(parts[0]) + 543; // Convert AD to Buddhist Era
  
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
  const y = date.getFullYear() + 543; // Buddhist Era
  
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
