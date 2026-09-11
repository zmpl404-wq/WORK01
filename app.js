/**
 * ShiftMaster Pro - Core Application Logic
 * Modern, Dependency-free Web Scheduling System
 * Supports: Flexible Periods, Custom Roles, English/Color Shift Toggles,
 * Rule Violations Inspector, Advanced Auto-Schedule Constraints, and Two-Tier Excel Export.
 */

(function () {
  'use strict';

  // --- Storage & State Keys ---
  const STORAGE_KEY = 'shiftmaster_pro_v2';
  const THEME_KEY = 'shiftmaster_theme';

  // --- Default Roles ---
  const DEFAULT_ROLES = ['店長', '正職', '工讀生'];

  // --- Default Shifts Configuration ---
  const DEFAULT_SHIFTS = [
    { id: 'shift_morning', name: '早班', code: '早', enName: 'Morning', enCode: 'M', start: '08:00', end: '16:30', hours: 8, color: '#10b981', targetStaff: 2 },
    { id: 'shift_middle', name: '中班', code: '中', enName: 'Middle', enCode: 'MID', start: '12:00', end: '20:30', hours: 8, color: '#f59e0b', targetStaff: 1 },
    { id: 'shift_evening', name: '晚班', code: '晚', enName: 'Evening', enCode: 'E', start: '16:00', end: '00:30', hours: 8, color: '#8b5cf6', targetStaff: 2 },
    { id: 'shift_night', name: '大夜班', code: '夜', enName: 'Night', enCode: 'N', start: '00:00', end: '08:30', hours: 8, color: '#3b82f6', targetStaff: 1 },
    { id: 'shift_parttime', name: '支援短班', code: '短', enName: 'Part-time', enCode: 'PT', start: '18:00', end: '22:00', hours: 4, color: '#06b6d4', targetStaff: 1 },
    { id: 'shift_off', name: '例休 / 休假', code: '休', enName: 'Off', enCode: 'OFF', start: '-', end: '-', hours: 0, color: '#64748b', targetStaff: 0 }
  ];

  // --- Default Staff Roster (Using only default roles: 店長, 正職, 工讀生) ---
  const DEFAULT_STAFF = [
    { id: 'staff_1', name: '林雅婷', role: '店長', wage: 280, maxHours: 40, color: '#6366f1', offPref: '0' },
    { id: 'staff_2', name: '張志豪', role: '正職', wage: 230, maxHours: 40, color: '#10b981', offPref: '1' },
    { id: 'staff_3', name: '陳美玲', role: '正職', wage: 210, maxHours: 40, color: '#ec4899', offPref: '2' },
    { id: 'staff_4', name: '王大明', role: '正職', wage: 200, maxHours: 40, color: '#f59e0b', offPref: '3' },
    { id: 'staff_5', name: '許家豪', role: '工讀生', wage: 195, maxHours: 28, color: '#06b6d4', offPref: '4' },
    { id: 'staff_6', name: '柯怡君', role: '工讀生', wage: 195, maxHours: 24, color: '#a855f7', offPref: '5' },
    { id: 'staff_7', name: '黃冠宇', role: '工讀生', wage: 190, maxHours: 20, color: '#14b8a6', offPref: 'none' }
  ];

  const DAY_NAMES_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  const DAY_NAMES_SHORT_ZH = ['日', '一', '二', '三', '四', '五', '六'];
  const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // --- App State ---
  let state = {
    staff: [],
    shifts: [],
    roles: [...DEFAULT_ROLES],
    // Keyed by `${staffId}_${dateStr}` => shiftId
    schedules: {},
    // Flexible Period State
    periodMode: 'month', // '7days' | '14days' | 'month' | 'custom'
    periodStart: new Date(),
    periodEnd: new Date(),
    selectedDayIndex: 0,
    currentView: window.innerWidth <= 768 ? 'day' : 'day',
    // Shift Display Language: 'zh' or 'en'
    shiftDisplayLang: 'zh',
    // Regulatory Rules Config
    rules: {
      maxDailyShifts: 1,
      maxConsecutiveDays: 6,
      maxDailyHours: 12
    },
    // Auto-Schedule Advanced Rules
    antiPairs: [], // Array of [staffIdA, staffIdB]
    roleRestrictions: [], // Array of { role: string, shiftId: string }
    shiftFairness: ['shift_morning', 'shift_evening', 'shift_middle'], // Shift IDs that must be balanced
    activeTarget: null
  };

  // --- DOM Elements ---
  const elPeriodModeSelect = document.getElementById('period-mode-select');
  const elCustomDateContainer = document.getElementById('custom-date-range-container');
  const elInputPeriodStart = document.getElementById('input-period-start');
  const elInputPeriodEnd = document.getElementById('input-period-end');
  const elBtnApplyCustomDates = document.getElementById('btn-apply-custom-dates');
  const elPeriodDisplayBadge = document.getElementById('period-display-badge');

  const elDateCarousel = document.getElementById('mobile-date-carousel');
  const elDaySummaryTitle = document.getElementById('day-summary-title');
  const elDaySummaryHeadcount = document.getElementById('day-summary-headcount');
  const elMobileStaffCards = document.getElementById('mobile-staff-cards-list');
  const elStaffWeeklyList = document.getElementById('staff-weekly-cards-list');

  // Containers
  const elContainerDay = document.getElementById('container-day-view');
  const elContainerStaff = document.getElementById('container-staff-view');
  const elContainerTable = document.getElementById('container-table-view');

  // Table
  const elTableHeader = document.getElementById('schedule-table-header');
  const elTableBody = document.getElementById('schedule-table-body');
  const elTableFooter = document.getElementById('schedule-table-footer');
  const elLegend = document.getElementById('shifts-legend-container');

  // KPI elements
  const elStatHours = document.getElementById('stat-total-hours');
  const elStatAvgHours = document.getElementById('stat-avg-hours');
  const elStatShifts = document.getElementById('stat-total-shifts');
  const elStatCoverage = document.getElementById('stat-coverage-rate');
  const elStatCost = document.getElementById('stat-total-cost');
  const elStatAlertCount = document.getElementById('stat-alert-count');
  const elStatAlertDesc = document.getElementById('stat-alert-desc');
  const elCardAlert = document.getElementById('card-alert');

  // Bottom Sheet
  const elBottomSheetBackdrop = document.getElementById('bottom-sheet-backdrop');
  const elBottomSheetTitle = document.getElementById('bottom-sheet-title');
  const elBottomSheetSubtitle = document.getElementById('bottom-sheet-subtitle');
  const elDrawerShiftsList = document.getElementById('drawer-shifts-list');
  const elBtnSheetSetOff = document.getElementById('btn-sheet-set-off');
  const elBtnSheetClear = document.getElementById('btn-sheet-clear');
  const elBtnCloseBottomSheet = document.getElementById('btn-close-bottom-sheet');

  // Desktop Popover & Toast & Modals
  const elShiftPicker = document.getElementById('shift-picker-popover');
  const elToastContainer = document.getElementById('toast-container');
  const elStaffModal = document.getElementById('modal-staff');
  const elShiftsModal = document.getElementById('modal-shifts');
  const elRulesModal = document.getElementById('modal-rules');
  const elAutoRulesModal = document.getElementById('modal-auto-rules');

  // Language display toggle
  const elBtnToggleShiftLang = document.getElementById('btn-toggle-shift-lang');
  const elLabelShiftLang = document.getElementById('label-shift-lang');

  // ==========================================================================
  // Flexible Period Helper Functions
  // ==========================================================================
  function calculatePeriodRange(mode, anchorDate) {
    const base = new Date(anchorDate);
    let start, end;

    if (mode === 'month') {
      start = new Date(base.getFullYear(), base.getMonth(), 1);
      end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    } else if (mode === '7days') {
      const day = base.getDay();
      const diff = base.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(base.setDate(diff));
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (mode === '14days') {
      const day = base.getDay();
      const diff = base.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(base.setDate(diff));
      end = new Date(start);
      end.setDate(start.getDate() + 13);
    } else {
      start = state.periodStart ? new Date(state.periodStart) : new Date();
      end = state.periodEnd ? new Date(state.periodEnd) : new Date();
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }

  function getPeriodDays() {
    const days = [];
    const current = new Date(state.periodStart);
    const end = new Date(state.periodEnd);

    let safetyCounter = 0;
    while (current <= end && safetyCounter < 90) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
      safetyCounter++;
    }
    return days;
  }

  function shiftPeriod(delta) {
    if (state.periodMode === 'month') {
      const currentMonth = state.periodStart.getMonth();
      const targetDate = new Date(state.periodStart);
      targetDate.setMonth(currentMonth + delta);
      const range = calculatePeriodRange('month', targetDate);
      state.periodStart = range.start;
      state.periodEnd = range.end;
    } else if (state.periodMode === '7days') {
      state.periodStart.setDate(state.periodStart.getDate() + delta * 7);
      state.periodEnd.setDate(state.periodEnd.getDate() + delta * 7);
    } else if (state.periodMode === '14days') {
      state.periodStart.setDate(state.periodStart.getDate() + delta * 14);
      state.periodEnd.setDate(state.periodEnd.getDate() + delta * 14);
    } else {
      const daysCount = Math.round((state.periodEnd - state.periodStart) / (1000 * 60 * 60 * 24)) + 1;
      state.periodStart.setDate(state.periodStart.getDate() + delta * daysCount);
      state.periodEnd.setDate(state.periodEnd.getDate() + delta * daysCount);
    }

    elInputPeriodStart.value = formatDateIso(state.periodStart);
    elInputPeriodEnd.value = formatDateIso(state.periodEnd);

    const days = getPeriodDays();
    if (state.selectedDayIndex >= days.length) {
      state.selectedDayIndex = 0;
    }

    renderAll();
  }

  function formatDateIso(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  }

  // ==========================================================================
  // State Management & LocalStorage
  // ==========================================================================
  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        state.staff = parsed.staff || DEFAULT_STAFF;
        state.shifts = parsed.shifts || DEFAULT_SHIFTS;
        state.roles = parsed.roles && parsed.roles.length > 0 ? parsed.roles : [...DEFAULT_ROLES];
        state.schedules = parsed.schedules || {};
        state.periodMode = parsed.periodMode || 'month';
        state.shiftDisplayLang = parsed.shiftDisplayLang || 'zh';
        state.rules = Object.assign({ maxDailyShifts: 1, maxConsecutiveDays: 6, maxDailyHours: 12 }, parsed.rules || {});
        state.antiPairs = parsed.antiPairs || [];
        state.roleRestrictions = parsed.roleRestrictions || [];
        state.shiftFairness = parsed.shiftFairness || ['shift_morning', 'shift_evening', 'shift_middle'];
      } else {
        initDefaultDemoData();
      }
    } catch (e) {
      console.warn('Failed to load state, loading defaults:', e);
      initDefaultDemoData();
    }

    const range = calculatePeriodRange(state.periodMode, new Date());
    state.periodStart = range.start;
    state.periodEnd = range.end;

    elPeriodModeSelect.value = state.periodMode;
    elInputPeriodStart.value = formatDateIso(state.periodStart);
    elInputPeriodEnd.value = formatDateIso(state.periodEnd);
    elCustomDateContainer.style.display = state.periodMode === 'custom' ? 'flex' : 'none';

    updateShiftLangButtonUI();
    findAndSelectToday();
  }

  function findAndSelectToday() {
    const days = getPeriodDays();
    const todayIso = formatDateIso(new Date());
    const idx = days.findIndex(d => formatDateIso(d) === todayIso);
    state.selectedDayIndex = idx >= 0 ? idx : 0;
  }

  function saveState() {
    try {
      const payload = {
        staff: state.staff,
        shifts: state.shifts,
        roles: state.roles,
        schedules: state.schedules,
        periodMode: state.periodMode,
        shiftDisplayLang: state.shiftDisplayLang,
        rules: state.rules,
        antiPairs: state.antiPairs,
        roleRestrictions: state.roleRestrictions,
        shiftFairness: state.shiftFairness
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('LocalStorage save error:', e);
    }
  }

  function initDefaultDemoData() {
    state.staff = JSON.parse(JSON.stringify(DEFAULT_STAFF));
    state.shifts = JSON.parse(JSON.stringify(DEFAULT_SHIFTS));
    state.roles = [...DEFAULT_ROLES];
    state.schedules = {};
    state.periodMode = 'month';
    state.shiftDisplayLang = 'zh';
    state.rules = { maxDailyShifts: 1, maxConsecutiveDays: 6, maxDailyHours: 12 };
    state.antiPairs = [];
    state.roleRestrictions = [];
    state.shiftFairness = ['shift_morning', 'shift_evening', 'shift_middle'];

    const range = calculatePeriodRange('month', new Date());
    state.periodStart = range.start;
    state.periodEnd = range.end;

    const days = getPeriodDays();
    const shiftCycle = [
      ['shift_morning', 'shift_morning', 'shift_morning', 'shift_morning', 'shift_morning', 'shift_off', 'shift_off'],
      ['shift_off', 'shift_middle', 'shift_middle', 'shift_middle', 'shift_middle', 'shift_middle', 'shift_off'],
      ['shift_morning', 'shift_off', 'shift_morning', 'shift_morning', 'shift_evening', 'shift_evening', 'shift_off'],
      ['shift_evening', 'shift_evening', 'shift_off', 'shift_evening', 'shift_morning', 'shift_morning', 'shift_off'],
      ['shift_parttime', 'shift_parttime', 'shift_parttime', 'shift_off', 'shift_parttime', 'shift_parttime', 'shift_off'],
      ['shift_evening', 'shift_evening', 'shift_evening', 'shift_evening', 'shift_off', 'shift_evening', 'shift_off'],
      ['shift_off', 'shift_off', 'shift_off', 'shift_night', 'shift_night', 'shift_night', 'shift_night']
    ];

    state.staff.forEach((staff, staffIdx) => {
      const cycle = shiftCycle[staffIdx % shiftCycle.length];
      days.forEach((d, dayIdx) => {
        const dateStr = formatDateIso(d);
        const shiftId = cycle[dayIdx % cycle.length];
        if (shiftId) {
          state.schedules[`${staff.id}_${dateStr}`] = shiftId;
        }
      });
    });

    saveState();
  }

  // ==========================================================================
  // Calculations & Compliance Violations Inspector
  // ==========================================================================
  function getStaffHoursForPeriod(staffId, periodDays) {
    let hours = 0;
    periodDays.forEach(d => {
      const dateStr = formatDateIso(d);
      const shiftId = state.schedules[`${staffId}_${dateStr}`];
      if (shiftId) {
        const shift = state.shifts.find(s => s.id === shiftId);
        if (shift && shift.hours) {
          hours += shift.hours;
        }
      }
    });
    return hours;
  }

  /**
   * Evaluates all violations and scheduling conflicts according to customizable rules.
   * Returns array of: { staffId, staffName, date, type, title, desc }
   */
  function getAllViolations() {
    const periodDays = getPeriodDays();
    const violations = [];
    const maxConsecutive = state.rules.maxConsecutiveDays || 6;
    const maxDailyHours = state.rules.maxDailyHours || 12;
    const periodWeeks = periodDays.length / 7;

    // 1. Staff-level checks (Consecutive days, Period Overtime, Daily Hours, Role Restrictions)
    state.staff.forEach(staff => {
      // Check Period Overtime
      const totalHours = getStaffHoursForPeriod(staff.id, periodDays);
      const allowedHours = Math.round(staff.maxHours * periodWeeks);
      if (totalHours > allowedHours) {
        violations.push({
          staffId: staff.id,
          staffName: staff.name,
          date: '整期累計',
          type: 'overtime',
          title: '週期工時超量',
          desc: `${staff.name} 當期工時累計已達 ${totalHours}h（允許上限為 ${allowedHours}h，每週基準 ${staff.maxHours}h）`
        });
      }

      // Check Consecutive work days
      let consecutive = 0;
      let streakStartDate = null;
      periodDays.forEach(d => {
        const dateStr = formatDateIso(d);
        const shiftId = state.schedules[`${staff.id}_${dateStr}`];
        const shift = shiftId ? state.shifts.find(s => s.id === shiftId) : null;

        if (shift && shift.hours > 0) {
          if (consecutive === 0) streakStartDate = dateStr;
          consecutive++;
          if (consecutive > maxConsecutive) {
            violations.push({
              staffId: staff.id,
              staffName: staff.name,
              date: dateStr,
              type: 'consecutive',
              title: '連續上班超限',
              desc: `${staff.name} 截至 ${dateStr} 已連續上班 ${consecutive} 天（自訂上限：${maxConsecutive} 天）`
            });
          }

          // Check Daily hours limit
          if (shift.hours > maxDailyHours) {
            violations.push({
              staffId: staff.id,
              staffName: staff.name,
              date: dateStr,
              type: 'daily_hours',
              title: '單日工時超標',
              desc: `${staff.name} 於 ${dateStr} 排定班別「${shift.name}」計薪 ${shift.hours}h（單日上限：${maxDailyHours}h）`
            });
          }

          // Check Role Restrictions
          const restricted = state.roleRestrictions.find(r => r.role === staff.role && r.shiftId === shift.id);
          if (restricted) {
            violations.push({
              staffId: staff.id,
              staffName: staff.name,
              date: dateStr,
              type: 'role_restrict',
              title: '職位班別限制衝突',
              desc: `${staff.name} 職能為「${staff.role}」，受排班限制不可上「${shift.name}」`
            });
          }
        } else {
          consecutive = 0;
          streakStartDate = null;
        }
      });
    });

    // 2. Anti-Pair Conflicts (誰和誰不能同天上班)
    if (state.antiPairs && state.antiPairs.length > 0) {
      periodDays.forEach(d => {
        const dateStr = formatDateIso(d);
        state.antiPairs.forEach(pair => {
          const [staffIdA, staffIdB] = pair;
          const shiftAId = state.schedules[`${staffIdA}_${dateStr}`];
          const shiftBId = state.schedules[`${staffIdB}_${dateStr}`];
          const shiftA = shiftAId ? state.shifts.find(s => s.id === shiftAId) : null;
          const shiftB = shiftBId ? state.shifts.find(s => s.id === shiftBId) : null;

          if (shiftA && shiftA.hours > 0 && shiftB && shiftB.hours > 0) {
            const staffA = state.staff.find(s => s.id === staffIdA);
            const staffB = state.staff.find(s => s.id === staffIdB);
            const nameA = staffA ? staffA.name : '員工A';
            const nameB = staffB ? staffB.name : '員工B';
            violations.push({
              staffId: staffIdA,
              staffName: `${nameA} & ${nameB}`,
              date: dateStr,
              type: 'anti_pair',
              title: '搭檔互斥排班衝突',
              desc: `${nameA} 與 ${nameB} 設有同日互斥限制，但在 ${dateStr} 同時被排入出勤班次`
            });
          }
        });
      });
    }

    return violations;
  }

  function getDailyHeadcount(dateStr) {
    let count = 0;
    state.staff.forEach(s => {
      const shiftId = state.schedules[`${s.id}_${dateStr}`];
      if (shiftId) {
        const shift = state.shifts.find(sh => sh.id === shiftId);
        if (shift && shift.hours > 0) {
          count++;
        }
      }
    });
    return count;
  }

  // ==========================================================================
  // Custom Roles Management (預設店長/正職/工讀生，可自訂增減)
  // ==========================================================================
  function renderRolesManagementUI() {
    const container = document.getElementById('roles-chips-list');
    const selectStaffRole = document.getElementById('staff-role');
    const selectRestrictRole = document.getElementById('select-role-restrict-role');

    if (!container) return;
    container.innerHTML = '';

    state.roles.forEach(role => {
      const chip = document.createElement('div');
      chip.className = 'role-chip';
      chip.innerHTML = `
        <span>${escapeHtml(role)}</span>
        <button type="button" class="btn-del-chip" title="刪除此職位角色" data-role="${escapeHtml(role)}">&times;</button>
      `;

      chip.querySelector('.btn-del-chip').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteRole(role);
      });

      container.appendChild(chip);
    });

    // Sync select dropdowns
    if (selectStaffRole) {
      const currentVal = selectStaffRole.value;
      selectStaffRole.innerHTML = '';
      state.roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        selectStaffRole.appendChild(opt);
      });
      if (state.roles.includes(currentVal)) {
        selectStaffRole.value = currentVal;
      }
    }

    if (selectRestrictRole) {
      selectRestrictRole.innerHTML = '';
      state.roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        selectRestrictRole.appendChild(opt);
      });
    }
  }

  function addCustomRole(newRoleName) {
    const name = newRoleName.trim();
    if (!name) {
      showToast('請輸入有效的角色名稱', 'warning');
      return;
    }
    if (state.roles.includes(name)) {
      showToast(`角色「${name}」已存在`, 'warning');
      return;
    }
    state.roles.push(name);
    saveState();
    renderRolesManagementUI();
    showToast(`✨ 已成功新增職能角色：${name}`, 'success');
  }

  function deleteRole(roleName) {
    const inUseCount = state.staff.filter(s => s.role === roleName).length;
    let msg = `確定要刪除「${roleName}」角色嗎？`;
    if (inUseCount > 0) {
      msg = `目前有 ${inUseCount} 位同仁設定為「${roleName}」，刪除後同仁仍保留原職位名稱。確定要移除此選項嗎？`;
    }
    if (confirm(msg)) {
      state.roles = state.roles.filter(r => r !== roleName);
      // Also clean up any role restrictions
      state.roleRestrictions = state.roleRestrictions.filter(rr => rr.role !== roleName);
      saveState();
      renderRolesManagementUI();
      renderAutoRulesModalUI();
      showToast(`已移除角色：${roleName}`, 'info');
    }
  }

  // ==========================================================================
  // Shift Display Language Toggle (中英切換)
  // ==========================================================================
  function toggleShiftDisplayLang() {
    state.shiftDisplayLang = state.shiftDisplayLang === 'zh' ? 'en' : 'zh';
    saveState();
    updateShiftLangButtonUI();
    renderAll();
    const label = state.shiftDisplayLang === 'zh' ? '繁體中文' : 'English (英文代碼/單字)';
    showToast(`🔤 班別顯示模式切換為：${label}`, 'info');
  }

  function updateShiftLangButtonUI() {
    if (!elLabelShiftLang) return;
    if (state.shiftDisplayLang === 'en') {
      elLabelShiftLang.textContent = 'EN 英文顯示';
      elBtnToggleShiftLang.classList.add('btn-primary');
      elBtnToggleShiftLang.classList.remove('btn-secondary');
    } else {
      elLabelShiftLang.textContent = '中文顯示';
      elBtnToggleShiftLang.classList.remove('btn-primary');
      elBtnToggleShiftLang.classList.add('btn-secondary');
    }
  }

  function getShiftDisplayTitle(shift) {
    if (!shift) return '';
    if (state.shiftDisplayLang === 'en') {
      return shift.enName ? `${shift.enName} (${shift.enCode || shift.code})` : `${shift.name} (${shift.code})`;
    }
    return `${shift.name} (${shift.code})`;
  }

  function getShiftDisplayShort(shift) {
    if (!shift) return '';
    if (state.shiftDisplayLang === 'en') {
      return shift.enCode || shift.code || shift.name;
    }
    return shift.code || shift.name;
  }

  // ==========================================================================
  // Master Rendering Router
  // ==========================================================================
  function renderAll() {
    renderPeriodBadge();
    renderActiveView();
    renderAnalytics();
    renderLegend();
    renderStaffModalList();
    renderShiftsModalList();
    renderRolesManagementUI();
  }

  function renderPeriodBadge() {
    const days = getPeriodDays();
    if (days.length === 0) return;
    const startStr = `${days[0].getFullYear()}/${days[0].getMonth() + 1}/${days[0].getDate()}`;
    const lastDay = days[days.length - 1];
    const endStr = `${lastDay.getFullYear()}/${lastDay.getMonth() + 1}/${lastDay.getDate()}`;
    elPeriodDisplayBadge.textContent = `${startStr} ~ ${endStr} (共 ${days.length} 天)`;
  }

  function renderActiveView() {
    elContainerDay.style.display = state.currentView === 'day' ? 'flex' : 'none';
    elContainerStaff.style.display = state.currentView === 'staff' ? 'flex' : 'none';
    elContainerTable.style.display = state.currentView === 'week' ? 'flex' : 'none';

    document.getElementById('view-toggle-day').classList.toggle('active', state.currentView === 'day');
    document.getElementById('view-toggle-staff').classList.toggle('active', state.currentView === 'staff');
    document.getElementById('view-toggle-week').classList.toggle('active', state.currentView === 'week');

    if (state.currentView === 'day') {
      renderDateCarousel();
      renderMobileStaffCards();
    } else if (state.currentView === 'staff') {
      renderStaffWeeklyCards();
    } else if (state.currentView === 'week') {
      renderTable();
    }
  }

  // ==========================================================================
  // VIEW 1: Mobile Day View (日期輪播 + 同仁大卡片)
  // ==========================================================================
  function renderDateCarousel() {
    const days = getPeriodDays();
    elDateCarousel.innerHTML = '';

    days.forEach((d, idx) => {
      const dateIso = formatDateIso(d);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isSelected = idx === state.selectedDayIndex;
      const dayName = state.shiftDisplayLang === 'en' ? DAY_NAMES_EN[d.getDay()] : DAY_NAMES_ZH[d.getDay()];
      const dayDate = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
      const count = getDailyHeadcount(dateIso);

      const chip = document.createElement('div');
      chip.className = `day-chip ${isSelected ? 'active' : ''} ${isWeekend ? 'is-weekend' : ''}`;
      chip.innerHTML = `
        <div class="day-chip-name">${dayName}</div>
        <div class="day-chip-date">${dayDate}</div>
        <span class="day-chip-badge ${count >= 3 ? 'is-sufficient' : 'is-shortage'}">
          ${count}人
        </span>
      `;

      chip.addEventListener('click', () => {
        state.selectedDayIndex = idx;
        renderDateCarousel();
        renderMobileStaffCards();
      });

      elDateCarousel.appendChild(chip);
    });

    const activeChip = elDateCarousel.querySelector('.day-chip.active');
    if (activeChip) {
      activeChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  function renderMobileStaffCards() {
    const days = getPeriodDays();
    if (days.length === 0) return;

    if (state.selectedDayIndex >= days.length) state.selectedDayIndex = 0;
    const selectedDate = days[state.selectedDayIndex];
    const dateIso = formatDateIso(selectedDate);
    const dayName = state.shiftDisplayLang === 'en' ? DAY_NAMES_EN[selectedDate.getDay()] : DAY_NAMES_ZH[selectedDate.getDay()];
    const count = getDailyHeadcount(dateIso);

    elDaySummaryTitle.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      <span>${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 (${dayName})</span>
    `;

    const isSufficient = count >= 3;
    elDaySummaryHeadcount.innerHTML = `
      <span>執勤 ${count} 人</span>
      <span style="margin-left:4px;color:${isSufficient ? 'var(--accent-success)' : 'var(--accent-danger)'};">
        ${isSufficient ? '✅ 充足' : '⚠️ 缺額'}
      </span>
    `;

    elMobileStaffCards.innerHTML = '';
    if (state.staff.length === 0) {
      elMobileStaffCards.innerHTML = `
        <div style="text-align:center;padding:2.5rem;color:var(--text-muted);">
          尚未建立員工名單，請點擊上方「人員管理」新增！
        </div>
      `;
      return;
    }

    const allViolations = getAllViolations();

    state.staff.forEach(staff => {
      const card = document.createElement('div');
      card.className = 'mobile-staff-card';

      const key = `${staff.id}_${dateIso}`;
      const shiftId = state.schedules[key];
      const shift = shiftId ? state.shifts.find(s => s.id === shiftId) : null;

      const periodHours = getStaffHoursForPeriod(staff.id, days);
      const staffViolations = allViolations.filter(v => v.staffId === staff.id || (v.staffName && v.staffName.includes(staff.name)));
      const hasViolation = staffViolations.length > 0;

      const topRow = document.createElement('div');
      topRow.className = 'mobile-card-top-row';
      topRow.innerHTML = `
        <div class="mobile-card-profile">
          <div class="mobile-card-avatar" style="background:${staff.color || '#6366f1'};">
            ${staff.name.slice(0, 1)}
          </div>
          <div class="mobile-card-name-group">
            <span class="mobile-card-name">
              ${escapeHtml(staff.name)}
              <span class="staff-role-badge">${escapeHtml(staff.role)}</span>
            </span>
            <span class="mobile-card-meta">本期累計 ${periodHours} 小時</span>
          </div>
        </div>
        <div>
          ${hasViolation ? `<span class="mobile-alert-tag" title="${staffViolations.map(v => v.desc).join('\n')}">⚠️ 警示 (${staffViolations.length})</span>` : ''}
        </div>
      `;
      card.appendChild(topRow);

      const shiftBtn = document.createElement('button');
      shiftBtn.type = 'button';
      shiftBtn.className = `mobile-shift-action-btn ${shift ? 'has-shift' : 'is-empty'}`;

      if (shift) {
        shiftBtn.style.backgroundColor = shift.color;
        const codeText = getShiftDisplayShort(shift);
        const nameText = state.shiftDisplayLang === 'en' ? (shift.enName || shift.name) : shift.name;
        shiftBtn.innerHTML = `
          <div class="mobile-shift-btn-left">
            <span class="mobile-shift-badge-code">${codeText}</span>
            <span class="mobile-shift-btn-name">${nameText}</span>
          </div>
          <div class="mobile-shift-btn-right">
            <span>${shift.start === '-' ? (state.shiftDisplayLang === 'en' ? 'Off' : '休息') : shift.start + '-' + shift.end}</span>
            <span>(${shift.hours}h)</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        `;
      } else {
        shiftBtn.innerHTML = `
          <div class="mobile-shift-btn-left">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span style="font-weight:600;">未排班・點擊指派</span>
          </div>
          <div class="mobile-shift-btn-right">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        `;
      }

      shiftBtn.addEventListener('click', () => {
        openBottomSheet(staff, dateIso, dayName);
      });

      card.appendChild(shiftBtn);
      elMobileStaffCards.appendChild(card);
    });
  }

  // ==========================================================================
  // VIEW 2: Staff Period Cards Mode
  // ==========================================================================
  function renderStaffWeeklyCards() {
    const days = getPeriodDays();
    elStaffWeeklyList.innerHTML = '';

    if (state.staff.length === 0) {
      elStaffWeeklyList.innerHTML = `
        <div style="text-align:center;padding:2.5rem;color:var(--text-muted);">
          尚未建立員工名單
        </div>
      `;
      return;
    }

    state.staff.forEach(staff => {
      const card = document.createElement('div');
      card.className = 'staff-weekly-card';

      const periodHours = getStaffHoursForPeriod(staff.id, days);

      const header = document.createElement('div');
      header.className = 'staff-weekly-card-header';
      header.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.65rem;">
          <div class="staff-avatar" style="background:${staff.color};width:32px;height:32px;font-size:0.8rem;">
            ${staff.name.slice(0, 1)}
          </div>
          <div>
            <span style="font-weight:700;font-size:0.95rem;color:var(--text-primary);">${escapeHtml(staff.name)}</span>
            <span class="staff-role-badge">${escapeHtml(staff.role)}</span>
          </div>
        </div>
        <div style="font-size:0.85rem;font-weight:700;color:var(--text-primary);">
          本期總計 ${periodHours} 小時
        </div>
      `;
      card.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'staff-weekly-days-grid';

      days.forEach(d => {
        const dateIso = formatDateIso(d);
        const dayName = state.shiftDisplayLang === 'en' ? DAY_NAMES_EN[d.getDay()] : DAY_NAMES_ZH[d.getDay()];
        const key = `${staff.id}_${dateIso}`;
        const shiftId = state.schedules[key];
        const shift = shiftId ? state.shifts.find(s => s.id === shiftId) : null;

        const pill = document.createElement('div');
        pill.className = 'staff-day-pill';
        if (shift) {
          pill.style.backgroundColor = shift.color;
          pill.style.borderColor = 'transparent';
          const codeText = getShiftDisplayShort(shift);
          pill.innerHTML = `
            <span class="staff-day-pill-name" style="color:rgba(255,255,255,0.85);">${dayName.replace('週', '')}</span>
            <span class="staff-day-pill-code" style="color:#ffffff;">${codeText}</span>
          `;
        } else {
          pill.innerHTML = `
            <span class="staff-day-pill-name">${dayName.replace('週', '')}</span>
            <span class="staff-day-pill-code" style="color:var(--text-muted);">-</span>
          `;
        }

        pill.addEventListener('click', () => {
          openBottomSheet(staff, dateIso, dayName);
        });

        grid.appendChild(pill);
      });

      card.appendChild(grid);
      elStaffWeeklyList.appendChild(card);
    });
  }

  // ==========================================================================
  // VIEW 3: Compact Schedule Table Mode (防滑動覆蓋姓名、支援中英班別與顏色)
  // ==========================================================================
  function renderTable() {
    const periodDays = getPeriodDays();
    const todayIso = formatDateIso(new Date());

    // 1. Table Header (th.col-staff is sticky left:0 with z-index:40)
    elTableHeader.innerHTML = `<th class="col-staff">姓名</th>`;
    periodDays.forEach(d => {
      const dateIso = formatDateIso(d);
      const isToday = dateIso === todayIso;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const dayNameShort = state.shiftDisplayLang === 'en' ? DAY_NAMES_EN[d.getDay()] : DAY_NAMES_SHORT_ZH[d.getDay()];
      const dayFormatted = `${d.getDate()}`;

      const th = document.createElement('th');
      th.className = `day-header-cell ${isToday ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''}`;
      th.innerHTML = `
        <div class="day-name">${dayNameShort}</div>
        <div class="day-date">${dayFormatted}</div>
      `;
      elTableHeader.appendChild(th);
    });

    const thTotal = document.createElement('th');
    thTotal.className = 'col-total';
    thTotal.textContent = '工時';
    elTableHeader.appendChild(thTotal);

    // 2. Table Body (Staff Rows)
    elTableBody.innerHTML = '';
    const allViolations = getAllViolations();

    state.staff.forEach(staff => {
      const tr = document.createElement('tr');

      const tdStaff = document.createElement('td');
      tdStaff.className = 'staff-row-cell';
      tdStaff.innerHTML = `
        <div class="staff-profile-card">
          <span class="staff-name" title="${escapeHtml(staff.name)} (${escapeHtml(staff.role)})">${escapeHtml(staff.name)}</span>
        </div>
      `;
      tr.appendChild(tdStaff);

      const staffViolations = allViolations.filter(v => v.staffId === staff.id);
      const hasViolation = staffViolations.length > 0;

      periodDays.forEach(d => {
        const dateIso = formatDateIso(d);
        const dayName = state.shiftDisplayLang === 'en' ? DAY_NAMES_EN[d.getDay()] : DAY_NAMES_ZH[d.getDay()];
        const cellKey = `${staff.id}_${dateIso}`;
        const shiftId = state.schedules[cellKey];
        const shift = shiftId ? state.shifts.find(s => s.id === shiftId) : null;

        const td = document.createElement('td');
        const slot = document.createElement('div');
        slot.className = 'shift-slot';

        if (shift) {
          const shortCode = getShiftDisplayShort(shift);
          const fullTitle = getShiftDisplayTitle(shift);
          slot.innerHTML = `
            <div class="shift-pill" style="background:${shift.color};" title="${escapeHtml(fullTitle)} ${shift.start}~${shift.end}">
              <div class="shift-pill-title">
                <span>${shortCode}</span>
              </div>
            </div>
          `;
        } else {
          slot.classList.add('empty-slot');
          slot.innerHTML = `
            <svg class="empty-add-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          `;
        }

        slot.addEventListener('click', (e) => {
          e.stopPropagation();
          if (window.innerWidth <= 768) {
            openBottomSheet(staff, dateIso, dayName);
          } else {
            openShiftPicker(staff.id, dateIso, slot);
          }
        });

        td.appendChild(slot);
        tr.appendChild(td);
      });

      const tdTotal = document.createElement('td');
      tdTotal.className = 'total-cell';
      const hours = getStaffHoursForPeriod(staff.id, periodDays);

      tdTotal.innerHTML = `
        <div class="total-hours-num" ${hasViolation ? 'style="color:var(--accent-danger);"' : ''}>
          ${hours}h
        </div>
      `;
      tr.appendChild(tdTotal);
      elTableBody.appendChild(tr);
    });

    // 3. Table Footer (Daily headcount totals, with sticky staff column)
    elTableFooter.innerHTML = `<th class="col-staff">出勤</th>`;
    periodDays.forEach(d => {
      const dateIso = formatDateIso(d);
      const count = getDailyHeadcount(dateIso);
      const th = document.createElement('th');
      const isShortage = count < 3;
      th.innerHTML = `
        <span class="headcount-badge ${isShortage ? 'is-shortage' : 'is-sufficient'}">
          ${count}
        </span>
      `;
      elTableFooter.appendChild(th);
    });

    const thFooterTotal = document.createElement('th');
    thFooterTotal.className = 'col-total';
    thFooterTotal.textContent = '-';
    elTableFooter.appendChild(thFooterTotal);
  }

  function renderLegend() {
    elLegend.innerHTML = '<span class="legend-title">班別對照表：</span>';
    state.shifts.forEach(shift => {
      const chip = document.createElement('div');
      chip.className = 'shift-legend-chip';
      chip.style.backgroundColor = `${shift.color}20`;
      chip.style.color = shift.color;
      chip.style.border = `1px solid ${shift.color}40`;

      const titleText = state.shiftDisplayLang === 'en'
        ? `${shift.enName || shift.name} (${shift.enCode || shift.code})`
        : `${shift.name} (${shift.code}${shift.enCode ? ' / ' + shift.enCode : ''})`;

      chip.innerHTML = `
        <span class="shift-legend-color-dot" style="background:${shift.color};"></span>
        <span>${titleText}</span>
      `;
      elLegend.appendChild(chip);
    });
  }

  function renderAnalytics() {
    const periodDays = getPeriodDays();

    let totalHours = 0;
    let totalShifts = 0;
    let totalCost = 0;

    state.staff.forEach(staff => {
      const hours = getStaffHoursForPeriod(staff.id, periodDays);
      totalHours += hours;
      totalCost += hours * (staff.wage || 0);

      periodDays.forEach(d => {
        const dateIso = formatDateIso(d);
        const shiftId = state.schedules[`${staff.id}_${dateIso}`];
        if (shiftId) {
          const shift = state.shifts.find(s => s.id === shiftId);
          if (shift && shift.hours > 0) {
            totalShifts++;
          }
        }
      });
    });

    const violations = getAllViolations();
    const alertCount = violations.length;

    const avgHours = state.staff.length > 0 ? (totalHours / state.staff.length).toFixed(1) : 0;
    elStatHours.innerHTML = `${totalHours} <span style="font-size:0.85rem;font-weight:500;">小時</span>`;
    elStatAvgHours.textContent = `人均工時：${avgHours} 小時 / 期`;

    elStatShifts.innerHTML = `${totalShifts} <span style="font-size:0.85rem;font-weight:500;">班次</span>`;
    const coverageRate = Math.min(Math.round((totalShifts / (periodDays.length * 4)) * 100), 100);
    elStatCoverage.textContent = `在崗覆蓋率：${coverageRate}%`;

    elStatCost.textContent = `NT$ ${totalCost.toLocaleString()}`;

    if (alertCount > 0) {
      elStatAlertCount.innerHTML = `<span style="color:var(--accent-danger);">${alertCount}</span> <span style="font-size:0.85rem;font-weight:500;">項警示</span>`;
      elStatAlertDesc.textContent = violations[0].desc || '點擊檢視異常明細與修改法規規則';
    } else {
      elStatAlertCount.innerHTML = `<span style="color:var(--accent-success);">0</span> <span style="font-size:0.85rem;font-weight:500;">項異常</span>`;
      elStatAlertDesc.textContent = '工時合規・點擊可自訂修改排班法規規則';
    }
  }

  // ==========================================================================
  // Violations & Custom Rules Modal
  // ==========================================================================
  function openRulesModal(defaultTab = 'violations') {
    elRulesModal.classList.add('open');
    switchRulesTab(defaultTab);
    renderViolationsList();
    populateRulesForm();
  }

  function switchRulesTab(tab) {
    const btnViolations = document.getElementById('tab-btn-violations');
    const btnSettings = document.getElementById('tab-btn-rules-settings');
    const paneViolations = document.getElementById('tab-content-violations');
    const paneSettings = document.getElementById('tab-content-rules-settings');

    if (tab === 'violations') {
      btnViolations.classList.add('active');
      btnSettings.classList.remove('active');
      paneViolations.style.display = 'block';
      paneSettings.style.display = 'none';
      renderViolationsList();
    } else {
      btnViolations.classList.remove('active');
      btnSettings.classList.add('active');
      paneViolations.style.display = 'none';
      paneSettings.style.display = 'block';
      populateRulesForm();
    }
  }

  function renderViolationsList() {
    const container = document.getElementById('violations-list-container');
    if (!container) return;
    container.innerHTML = '';

    const violations = getAllViolations();

    if (violations.length === 0) {
      container.innerHTML = `
        <div class="violation-empty-state">
          <svg class="violation-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <div style="font-weight:700;font-size:1.05rem;color:var(--text-primary);margin-top:0.4rem;">
            目前排班完全合規！
          </div>
          <div style="font-size:0.825rem;">
            無連續出勤過長、無超時工時、無搭檔互斥與職位班別衝突。
          </div>
        </div>
      `;
      return;
    }

    violations.forEach(v => {
      const item = document.createElement('div');
      item.className = 'violation-item';
      item.innerHTML = `
        <div class="violation-left">
          <div class="violation-header-row">
            <span class="violation-staff-badge">${escapeHtml(v.staffName)}</span>
            <span class="violation-date">📅 ${escapeHtml(v.date)}</span>
            <span class="violation-tag">🚨 ${escapeHtml(v.title)}</span>
          </div>
          <div class="violation-desc">${escapeHtml(v.desc)}</div>
        </div>
      `;
      container.appendChild(item);
    });
  }

  function populateRulesForm() {
    document.getElementById('rule-max-shifts-day').value = state.rules.maxDailyShifts || 1;
    document.getElementById('rule-max-consecutive-days').value = state.rules.maxConsecutiveDays || 6;
    document.getElementById('rule-max-daily-hours').value = state.rules.maxDailyHours || 12;
  }

  // ==========================================================================
  // Auto-Schedule Advanced Rules Modal (互斥、職位限制、平均公平分配開關)
  // ==========================================================================
  function openAutoRulesModal() {
    elAutoRulesModal.classList.add('open');
    renderAutoRulesModalUI();
  }

  function renderAutoRulesModalUI() {
    // 1. Anti-Pairs dropdowns and list
    const selA = document.getElementById('select-antipair-a');
    const selB = document.getElementById('select-antipair-b');
    const listAnti = document.getElementById('antipair-list-container');

    selA.innerHTML = '';
    selB.innerHTML = '';
    state.staff.forEach(s => {
      const optA = document.createElement('option');
      optA.value = s.id;
      optA.textContent = `${s.name} (${s.role})`;
      selA.appendChild(optA);

      const optB = document.createElement('option');
      optB.value = s.id;
      optB.textContent = `${s.name} (${s.role})`;
      selB.appendChild(optB);
    });

    listAnti.innerHTML = '';
    if (state.antiPairs.length === 0) {
      listAnti.innerHTML = '<span style="font-size:0.75rem;color:var(--text-muted);">尚未設定互斥人員（所有人皆可同天排班）</span>';
    } else {
      state.antiPairs.forEach((pair, idx) => {
        const staffA = state.staff.find(s => s.id === pair[0]);
        const staffB = state.staff.find(s => s.id === pair[1]);
        const nameA = staffA ? staffA.name : '已刪除員工';
        const nameB = staffB ? staffB.name : '已刪除員工';

        const tag = document.createElement('div');
        tag.className = 'rule-tag-item';
        tag.innerHTML = `
          <span>🚫 <b>${escapeHtml(nameA)}</b> 與 <b>${escapeHtml(nameB)}</b> 不能同天</span>
          <button type="button" class="btn-del-rule" title="移除此互斥規則">&times;</button>
        `;
        tag.querySelector('.btn-del-rule').addEventListener('click', () => {
          state.antiPairs.splice(idx, 1);
          saveState();
          renderAutoRulesModalUI();
          showToast('已移除互斥規則', 'info');
        });
        listAnti.appendChild(tag);
      });
    }

    // 2. Role Shift Restrictions dropdowns and list
    const selRole = document.getElementById('select-role-restrict-role');
    const selShift = document.getElementById('select-role-restrict-shift');
    const listRoleRestrict = document.getElementById('role-restrict-list-container');

    selRole.innerHTML = '';
    state.roles.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      selRole.appendChild(opt);
    });

    selShift.innerHTML = '';
    const workShifts = state.shifts.filter(s => s.id !== 'shift_off');
    workShifts.forEach(sh => {
      const opt = document.createElement('option');
      opt.value = sh.id;
      opt.textContent = `${sh.name} (${sh.code})`;
      selShift.appendChild(opt);
    });

    listRoleRestrict.innerHTML = '';
    if (state.roleRestrictions.length === 0) {
      listRoleRestrict.innerHTML = '<span style="font-size:0.75rem;color:var(--text-muted);">尚未設定職能限制（所有職位皆可排任意班別）</span>';
    } else {
      state.roleRestrictions.forEach((item, idx) => {
        const shift = state.shifts.find(s => s.id === item.shiftId);
        const shiftName = shift ? shift.name : '已刪除班別';

        const tag = document.createElement('div');
        tag.className = 'rule-tag-item';
        tag.innerHTML = `
          <span>🔒 職位 <b>${escapeHtml(item.role)}</b> 不能上 <b>${escapeHtml(shiftName)}</b></span>
          <button type="button" class="btn-del-rule" title="移除此限制">&times;</button>
        `;
        tag.querySelector('.btn-del-rule').addEventListener('click', () => {
          state.roleRestrictions.splice(idx, 1);
          saveState();
          renderAutoRulesModalUI();
          showToast('已移除職位排班限制', 'info');
        });
        listRoleRestrict.appendChild(tag);
      });
    }

    // 3. Shift Fairness Toggles Checkbox Grid
    const fairnessContainer = document.getElementById('shift-fairness-toggles-container');
    fairnessContainer.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'checkbox-grid';

    workShifts.forEach(shift => {
      const label = document.createElement('label');
      label.className = 'checkbox-label';
      const isChecked = state.shiftFairness.includes(shift.id);

      label.innerHTML = `
        <input type="checkbox" data-shift-id="${shift.id}" ${isChecked ? 'checked' : ''}>
        <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${shift.color};"></span>
        <span>${escapeHtml(shift.name)} (${shift.code})</span>
      `;

      label.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) {
          if (!state.shiftFairness.includes(shift.id)) state.shiftFairness.push(shift.id);
        } else {
          state.shiftFairness = state.shiftFairness.filter(id => id !== shift.id);
        }
        saveState();
      });

      grid.appendChild(label);
    });

    fairnessContainer.appendChild(grid);
  }

  // ==========================================================================
  // Smart Auto-Scheduler (With Advanced Constraints & Fairness)
  // ==========================================================================
  function runAutoScheduler() {
    if (state.staff.length === 0) {
      showToast('請先新增員工後再進行自動排班！', 'warning');
      return;
    }

    const periodDays = getPeriodDays();
    const workShifts = state.shifts.filter(s => s.id !== 'shift_off' && s.hours > 0);
    if (workShifts.length === 0) {
      showToast('請先建立可出勤之班別範本！', 'warning');
      return;
    }

    const maxConsecutive = state.rules.maxConsecutiveDays || 6;
    const periodWeeks = periodDays.length / 7;

    const staffHoursTracker = {};
    const staffConsecutiveWork = {};
    const staffShiftCounts = {}; // { [staffId]: { [shiftId]: count } } for fairness

    state.staff.forEach(s => {
      staffHoursTracker[s.id] = 0;
      staffConsecutiveWork[s.id] = 0;
      staffShiftCounts[s.id] = {};
      workShifts.forEach(sh => {
        staffShiftCounts[s.id][sh.id] = 0;
      });
    });

    periodDays.forEach(d => {
      const dateStr = formatDateIso(d);
      const dayOfWeek = String(d.getDay());
      const dailyWorkingStaffIds = new Set();

      workShifts.forEach(shift => {
        const need = shift.targetStaff || 1;
        const isFairnessShift = state.shiftFairness.includes(shift.id);

        for (let i = 0; i < need; i++) {
          const candidateStaff = state.staff.filter(staff => {
            // Already scheduled today
            if (dailyWorkingStaffIds.has(staff.id)) return false;

            // Off day preference
            if (staff.offPref === dayOfWeek) return false;

            // Maximum consecutive work days limit
            if (staffConsecutiveWork[staff.id] >= maxConsecutive) return false;

            // Period total hours limit
            const allowed = Math.round(staff.maxHours * periodWeeks);
            if (staffHoursTracker[staff.id] + shift.hours > allowed + 4) return false;

            // Role restriction check
            const hasRestriction = state.roleRestrictions.some(r => r.role === staff.role && r.shiftId === shift.id);
            if (hasRestriction) return false;

            // Anti-pair check
            const violatesAntiPair = state.antiPairs.some(pair => {
              const otherId = pair[0] === staff.id ? pair[1] : (pair[1] === staff.id ? pair[0] : null);
              return otherId && dailyWorkingStaffIds.has(otherId);
            });
            if (violatesAntiPair) return false;

            return true;
          });

          if (candidateStaff.length > 0) {
            candidateStaff.sort((a, b) => {
              if (isFairnessShift) {
                const countA = staffShiftCounts[a.id][shift.id] || 0;
                const countB = staffShiftCounts[b.id][shift.id] || 0;
                if (countA !== countB) return countA - countB;
              }
              const allowedA = Math.round(a.maxHours * periodWeeks);
              const allowedB = Math.round(b.maxHours * periodWeeks);
              const remA = allowedA - staffHoursTracker[a.id];
              const remB = allowedB - staffHoursTracker[b.id];
              return remB - remA;
            });

            const chosen = candidateStaff[0];
            state.schedules[`${chosen.id}_${dateStr}`] = shift.id;
            staffHoursTracker[chosen.id] += shift.hours;
            staffConsecutiveWork[chosen.id] += 1;
            staffShiftCounts[chosen.id][shift.id] = (staffShiftCounts[chosen.id][shift.id] || 0) + 1;
            dailyWorkingStaffIds.add(chosen.id);
          }
        }
      });

      // Staff not scheduled today get assigned off
      state.staff.forEach(s => {
        const key = `${s.id}_${dateStr}`;
        if (!state.schedules[key] || !dailyWorkingStaffIds.has(s.id)) {
          state.schedules[key] = 'shift_off';
          staffConsecutiveWork[s.id] = 0;
        }
      });
    });

    saveState();
    renderAll();
    showToast(`✨ 智慧排班完成！已依據法規、互斥與公平原則排定 ${periodDays.length} 天`, 'success');
  }

  // ==========================================================================
  // Staff Modal Management
  // ==========================================================================
  function renderStaffModalList() {
    const listEl = document.getElementById('staff-entity-list');
    const countBadge = document.getElementById('staff-count-badge');
    if (!listEl) return;

    countBadge.textContent = state.staff.length;
    listEl.innerHTML = '';

    if (state.staff.length === 0) {
      listEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;">無任何同仁資料</div>';
      return;
    }

    state.staff.forEach(staff => {
      const item = document.createElement('div');
      item.className = 'entity-item';
      const offText = staff.offPref === 'none' ? '無特定' : DAY_NAMES_ZH[parseInt(staff.offPref, 10)];

      item.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <div class="staff-avatar" style="background:${staff.color};width:32px;height:32px;font-size:0.8rem;">
            ${staff.name.slice(0, 1)}
          </div>
          <div>
            <div style="font-weight:700;font-size:0.9rem;color:var(--text-primary);">
              ${escapeHtml(staff.name)}
              <span class="staff-role-badge">${escapeHtml(staff.role)}</span>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);">
              時薪 NT$${staff.wage} ・ 週基準 ${staff.maxHours}h ・ 偏好休 ${offText}
            </div>
          </div>
        </div>
        <div>
          <button class="btn btn-icon-only btn-delete-staff" data-id="${staff.id}" title="移除員工" style="color:var(--accent-danger);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      item.querySelector('.btn-delete-staff').addEventListener('click', () => {
        if (confirm(`確定要移除「${staff.name}」嗎？這將一併清除該同仁的排班紀錄。`)) {
          state.staff = state.staff.filter(s => s.id !== staff.id);
          state.antiPairs = state.antiPairs.filter(pair => pair[0] !== staff.id && pair[1] !== staff.id);
          Object.keys(state.schedules).forEach(k => {
            if (k.startsWith(`${staff.id}_`)) delete state.schedules[k];
          });
          saveState();
          renderAll();
          showToast(`已移除員工：${staff.name}`, 'warning');
        }
      });

      listEl.appendChild(item);
    });
  }

  // ==========================================================================
  // Shift Modal Management (With English Names and Colors)
  // ==========================================================================
  function renderShiftsModalList() {
    const listEl = document.getElementById('shifts-entity-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    state.shifts.forEach(shift => {
      const item = document.createElement('div');
      item.className = 'entity-item';

      const enText = shift.enName ? ` (${shift.enName} / ${shift.enCode || shift.code})` : '';

      item.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <div style="width:16px;height:16px;border-radius:4px;background:${shift.color};box-shadow:0 0 4px ${shift.color}80;"></div>
          <div>
            <div style="font-weight:700;font-size:0.9rem;color:var(--text-primary);">
              ${escapeHtml(shift.name)} [${shift.code}]<span style="font-size:0.8rem;color:var(--text-muted);font-weight:normal;">${escapeHtml(enText)}</span>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);">
              ${shift.start} ~ ${shift.end} ・ 計薪 ${shift.hours}h ・ 目標 ${shift.targetStaff} 人
            </div>
          </div>
        </div>
        <div>
          ${shift.id === 'shift_off' ? '<span style="font-size:0.75rem;color:var(--text-muted);">系統預設</span>' : `
            <button class="btn btn-icon-only btn-delete-shift" data-id="${shift.id}" title="移除班別" style="color:var(--accent-danger);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          `}
        </div>
      `;

      const delBtn = item.querySelector('.btn-delete-shift');
      if (delBtn) {
        delBtn.addEventListener('click', () => {
          if (confirm(`確定要刪除班別「${shift.name}」嗎？`)) {
            state.shifts = state.shifts.filter(s => s.id !== shift.id);
            state.shiftFairness = state.shiftFairness.filter(id => id !== shift.id);
            state.roleRestrictions = state.roleRestrictions.filter(rr => rr.shiftId !== shift.id);
            saveState();
            renderAll();
            showToast(`已刪除班別：${shift.name}`, 'warning');
          }
        });
      }

      listEl.appendChild(item);
    });
  }

  // ==========================================================================
  // Custom Two-Tier EXCEL Exporter (B2~P2: 1~15, B3~P3: 星期, A4~A?: 員工姓名)
  // 空一行後再從 B?~P? 輸出 16~月底號
  // ==========================================================================
  function exportCustomExcel() {
    const year = state.periodStart.getFullYear();
    const month = state.periodStart.getMonth(); // 0-indexed
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    if (state.staff.length === 0) {
      showToast('名冊內無員工資料，無法匯出排班表！', 'warning');
      return;
    }

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>${year}年${month + 1}月排班表</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: "Microsoft JhengHei", "Noto Sans TC", Arial, sans-serif; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 0.5pt solid #888888; text-align: center; vertical-align: middle; padding: 6px 4px; font-size: 11pt; }
    .title-row { background-color: #312e81; color: #ffffff; font-weight: bold; font-size: 14pt; height: 36px; }
    .header-date { background-color: #4338ca; color: #ffffff; font-weight: bold; }
    .header-week { background-color: #e0e7ff; color: #1e1b4b; font-weight: bold; }
    .staff-name-col { background-color: #f8fafc; font-weight: bold; text-align: left; padding-left: 12px; }
    .weekend { color: #dc2626; font-weight: bold; }
    .shift-cell { font-size: 10.5pt; font-weight: 600; }
    .empty-separator { border: none; height: 26px; background-color: #ffffff; }
  </style>
</head>
<body>
<table>`;

    // ========================================================================
    // Section 1: Days 1 to 15 (B2~P2 are 1~15, B3~P3 are Weekdays, A4~A? are Staff)
    // ========================================================================
    // Row 1: Title
    html += `<tr><th colspan="16" class="title-row">${year} 年 ${month + 1} 月份 員工排班總表（上半月：1 ~ 15 號）</th></tr>`;

    // Row 2: Date Row (A2 = "員工 / 日期", B2~P2 = 1號 ~ 15號)
    html += `<tr><th class="header-date">員工 \\ 日期</th>`;
    for (let day = 1; day <= 15; day++) {
      html += `<th class="header-date">${day}號</th>`;
    }
    html += `</tr>`;

    // Row 3: Weekday Row (A3 = "星期", B3~P3 = 星期日~六)
    html += `<tr><th class="header-week">星期</th>`;
    for (let day = 1; day <= 15; day++) {
      const d = new Date(year, month, day);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const weekName = DAY_NAMES_ZH[d.getDay()];
      html += `<th class="header-week ${isWeekend ? 'weekend' : ''}">${weekName}</th>`;
    }
    html += `</tr>`;

    // Rows 4 ~ (3 + staffCount): Staff Shift Rows
    state.staff.forEach(staff => {
      html += `<tr><td class="staff-name-col">${escapeHtml(staff.name)} (${escapeHtml(staff.role)})</td>`;
      for (let day = 1; day <= 15; day++) {
        const d = new Date(year, month, day);
        const dateIso = formatDateIso(d);
        const shiftId = state.schedules[`${staff.id}_${dateIso}`];
        const shift = shiftId ? state.shifts.find(s => s.id === shiftId) : null;

        if (shift) {
          const shiftText = state.shiftDisplayLang === 'en'
            ? (shift.enCode || shift.code || shift.name)
            : `${shift.name} [${shift.code}]`;
          const isOff = shift.id === 'shift_off' || shift.hours === 0;
          const bgStyle = isOff ? 'background-color:#f1f5f9;color:#64748b;' : `background-color:${shift.color}25;color:${shift.color};font-weight:bold;`;
          html += `<td class="shift-cell" style="${bgStyle}">${shiftText}</td>`;
        } else {
          html += `<td class="shift-cell" style="color:#94a3b8;">-</td>`;
        }
      }
      html += `</tr>`;
    });

    // ========================================================================
    // Blank Row Separator
    // ========================================================================
    html += `<tr><td colspan="16" class="empty-separator"></td></tr>`;

    // ========================================================================
    // Section 2: Days 16 to End of Month (16 ~ 28/29/30/31)
    // ========================================================================
    // Title Row
    html += `<tr><th colspan="16" class="title-row">${year} 年 ${month + 1} 月份 員工排班總表（下半月：16 ~ ${daysInMonth} 號）</th></tr>`;

    // Date Row (B?~P? = 16號 ~ daysInMonth號)
    html += `<tr><th class="header-date">員工 \\ 日期</th>`;
    for (let day = 16; day <= 30; day++) {
      if (day <= daysInMonth) {
        html += `<th class="header-date">${day}號</th>`;
      } else {
        html += `<th class="header-date" style="background-color:#64748b;">-</th>`;
      }
    }
    // Column 16: If month has 31 days, put day 31 in Column P (15th column) or extra
    if (daysInMonth === 31) {
      html += `<th class="header-date">31號</th>`;
    }
    html += `</tr>`;

    // Weekday Row
    html += `<tr><th class="header-week">星期</th>`;
    for (let day = 16; day <= 30; day++) {
      if (day <= daysInMonth) {
        const d = new Date(year, month, day);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const weekName = DAY_NAMES_ZH[d.getDay()];
        html += `<th class="header-week ${isWeekend ? 'weekend' : ''}">${weekName}</th>`;
      } else {
        html += `<th class="header-week" style="color:#94a3b8;">-</th>`;
      }
    }
    if (daysInMonth === 31) {
      const d = new Date(year, month, 31);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      html += `<th class="header-week ${isWeekend ? 'weekend' : ''}">${DAY_NAMES_ZH[d.getDay()]}</th>`;
    }
    html += `</tr>`;

    // Staff Shift Rows for Section 2
    state.staff.forEach(staff => {
      html += `<tr><td class="staff-name-col">${escapeHtml(staff.name)} (${escapeHtml(staff.role)})</td>`;
      for (let day = 16; day <= 30; day++) {
        if (day <= daysInMonth) {
          const d = new Date(year, month, day);
          const dateIso = formatDateIso(d);
          const shiftId = state.schedules[`${staff.id}_${dateIso}`];
          const shift = shiftId ? state.shifts.find(s => s.id === shiftId) : null;

          if (shift) {
            const shiftText = state.shiftDisplayLang === 'en'
              ? (shift.enCode || shift.code || shift.name)
              : `${shift.name} [${shift.code}]`;
            const isOff = shift.id === 'shift_off' || shift.hours === 0;
            const bgStyle = isOff ? 'background-color:#f1f5f9;color:#64748b;' : `background-color:${shift.color}25;color:${shift.color};font-weight:bold;`;
            html += `<td class="shift-cell" style="${bgStyle}">${shiftText}</td>`;
          } else {
            html += `<td class="shift-cell" style="color:#94a3b8;">-</td>`;
          }
        } else {
          html += `<td class="shift-cell" style="background-color:#f8fafc;color:#cbd5e1;">-</td>`;
        }
      }
      if (daysInMonth === 31) {
        const d = new Date(year, month, 31);
        const dateIso = formatDateIso(d);
        const shiftId = state.schedules[`${staff.id}_${dateIso}`];
        const shift = shiftId ? state.shifts.find(s => s.id === shiftId) : null;
        if (shift) {
          const shiftText = state.shiftDisplayLang === 'en'
            ? (shift.enCode || shift.code || shift.name)
            : `${shift.name} [${shift.code}]`;
          const isOff = shift.id === 'shift_off' || shift.hours === 0;
          const bgStyle = isOff ? 'background-color:#f1f5f9;color:#64748b;' : `background-color:${shift.color}25;color:${shift.color};font-weight:bold;`;
          html += `<td class="shift-cell" style="${bgStyle}">${shiftText}</td>`;
        } else {
          html += `<td class="shift-cell" style="color:#94a3b8;">-</td>`;
        }
      }
      html += `</tr>`;
    });

    html += `</table></body></html>`;

    // Create Blob with Excel MIME and UTF-8 BOM
    const blob = new Blob(['\uFEFF', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `排班總表_${year}年${month + 1}月份.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`📊 已成功匯出雙段式 EXCEL 檔案 (${year}年${month + 1}月)！`, 'success');
  }

  // ==========================================================================
  // Toast & Notifications
  // ==========================================================================
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;

    elToastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================================
  // Bottom Sheet & Popovers
  // ==========================================================================
  function openBottomSheet(staff, dateStr, dayName) {
    state.activeTarget = { staffId: staff.id, dateStr };

    elBottomSheetTitle.textContent = `指派班別：${staff.name}`;
    elBottomSheetSubtitle.textContent = `日期：${dateStr} (${dayName}) ・ 職稱：${staff.role}`;

    elDrawerShiftsList.innerHTML = '';
    const workShifts = state.shifts.filter(s => s.id !== 'shift_off');

    workShifts.forEach(shift => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'drawer-shift-item';
      item.style.backgroundColor = shift.color;

      const codeText = getShiftDisplayShort(shift);
      const nameText = state.shiftDisplayLang === 'en' ? (shift.enName || shift.name) : shift.name;

      item.innerHTML = `
        <div class="drawer-shift-title">
          <span style="padding:0.1rem 0.45rem;background:rgba(0,0,0,0.25);border-radius:4px;font-size:0.85rem;">${codeText}</span>
          <span>${nameText}</span>
        </div>
        <div class="drawer-shift-time">
          ${shift.start}-${shift.end} (${shift.hours}h)
        </div>
      `;

      item.addEventListener('click', () => {
        assignShift(staff.id, dateStr, shift.id);
        closeBottomSheet();
      });

      elDrawerShiftsList.appendChild(item);
    });

    elBottomSheetBackdrop.classList.add('open');
  }

  function closeBottomSheet() {
    elBottomSheetBackdrop.classList.remove('open');
    state.activeTarget = null;
  }

  function openShiftPicker(staffId, dateStr, anchorEl) {
    elShiftPicker.innerHTML = '';

    state.shifts.forEach(shift => {
      const item = document.createElement('div');
      item.className = 'shift-picker-item';

      const shortCode = getShiftDisplayShort(shift);
      const titleText = state.shiftDisplayLang === 'en' ? (shift.enName || shift.name) : shift.name;

      item.innerHTML = `
        <span style="display:flex;align-items:center;gap:0.4rem;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${shift.color};"></span>
          <span>${escapeHtml(titleText)} [${shortCode}]</span>
        </span>
        <span style="font-size:0.75rem;opacity:0.7;">${shift.hours > 0 ? shift.hours + 'h' : '休'}</span>
      `;
      item.addEventListener('click', () => {
        assignShift(staffId, dateStr, shift.id);
        closeShiftPicker();
      });
      elShiftPicker.appendChild(item);
    });

    const removeItem = document.createElement('div');
    removeItem.className = 'shift-picker-item remove-item';
    removeItem.innerHTML = `<span>❌ 清除此格班別</span>`;
    removeItem.addEventListener('click', () => {
      assignShift(staffId, dateStr, null);
      closeShiftPicker();
    });
    elShiftPicker.appendChild(removeItem);

    const rect = anchorEl.getBoundingClientRect();
    elShiftPicker.style.display = 'flex';
    elShiftPicker.style.top = `${window.scrollY + rect.bottom + 4}px`;
    elShiftPicker.style.left = `${window.scrollX + rect.left}px`;
  }

  function closeShiftPicker() {
    elShiftPicker.style.display = 'none';
  }

  function assignShift(staffId, dateStr, shiftId) {
    const key = `${staffId}_${dateStr}`;
    if (shiftId === null) {
      delete state.schedules[key];
      showToast('已清除排班', 'success');
    } else {
      state.schedules[key] = shiftId;
      const shift = state.shifts.find(s => s.id === shiftId);
      showToast(`已排定：${shift ? shift.name : ''}`, 'success');
    }
    saveState();
    renderAll();
  }

  // ==========================================================================
  // Event Listeners & Binding
  // ==========================================================================
  function setupEventListeners() {
    // 1. Language Toggle
    elBtnToggleShiftLang.addEventListener('click', toggleShiftDisplayLang);

    // 2. Period Mode Change
    elPeriodModeSelect.addEventListener('change', (e) => {
      state.periodMode = e.target.value;
      saveState();

      if (state.periodMode === 'custom') {
        elCustomDateContainer.style.display = 'flex';
      } else {
        elCustomDateContainer.style.display = 'none';
        const range = calculatePeriodRange(state.periodMode, new Date());
        state.periodStart = range.start;
        state.periodEnd = range.end;
        elInputPeriodStart.value = formatDateIso(state.periodStart);
        elInputPeriodEnd.value = formatDateIso(state.periodEnd);
        findAndSelectToday();
        renderAll();
      }
    });

    // Custom Date Apply
    elBtnApplyCustomDates.addEventListener('click', () => {
      const sVal = elInputPeriodStart.value;
      const eVal = elInputPeriodEnd.value;
      if (!sVal || !eVal) {
        showToast('請選擇開始與結束日期', 'warning');
        return;
      }
      const sDate = new Date(sVal);
      const eDate = new Date(eVal);
      if (sDate > eDate) {
        showToast('開始日期不得晚於結束日期', 'warning');
        return;
      }
      state.periodStart = sDate;
      state.periodEnd = eDate;
      findAndSelectToday();
      renderAll();
      showToast('已套用自訂排班週期！', 'success');
    });

    // Prev / Next Period
    document.getElementById('btn-prev-period').addEventListener('click', () => shiftPeriod(-1));
    document.getElementById('btn-next-period').addEventListener('click', () => shiftPeriod(1));
    document.getElementById('btn-current-period').addEventListener('click', () => {
      const range = calculatePeriodRange(state.periodMode, new Date());
      state.periodStart = range.start;
      state.periodEnd = range.end;
      elInputPeriodStart.value = formatDateIso(state.periodStart);
      elInputPeriodEnd.value = formatDateIso(state.periodEnd);
      findAndSelectToday();
      renderAll();
    });

    // View toggling
    document.getElementById('view-toggle-day').addEventListener('click', () => {
      state.currentView = 'day';
      renderActiveView();
      showToast('📱 已切換為手機單日排班卡片', 'info');
    });

    document.getElementById('view-toggle-staff').addEventListener('click', () => {
      state.currentView = 'staff';
      renderActiveView();
      showToast('👤 已切換為人員週期卡模式', 'info');
    });

    document.getElementById('view-toggle-week').addEventListener('click', () => {
      state.currentView = 'week';
      renderActiveView();
      showToast('🖥️ 已切換為完整總表格（微縮緊湊排版）', 'info');
    });

    // Clear Period
    document.getElementById('btn-clear-week').addEventListener('click', () => {
      if (confirm('確定要清空當前週期內的所有排班嗎？（人員與班別設定將會保留）')) {
        const periodDays = getPeriodDays();
        state.staff.forEach(s => {
          periodDays.forEach(d => {
            const dateIso = formatDateIso(d);
            delete state.schedules[`${s.id}_${dateIso}`];
          });
        });
        saveState();
        renderAll();
        showToast('已清空當前週期所有排班紀錄', 'warning');
      }
    });

    // Reset Demo Data
    document.getElementById('btn-reset-demo').addEventListener('click', () => {
      if (confirm('確定要重設為系統預設的示範資料嗎？這將覆蓋現有排班。')) {
        initDefaultDemoData();
        renderAll();
        showToast('已還原為示範範本！', 'success');
      }
    });

    // Auto-Schedule buttons
    document.getElementById('btn-auto-schedule').addEventListener('click', runAutoScheduler);
    document.getElementById('m-btn-auto-schedule').addEventListener('click', runAutoScheduler);

    // Auto-Schedule Rules Modal buttons
    document.getElementById('btn-open-auto-rules').addEventListener('click', openAutoRulesModal);
    document.getElementById('btn-run-auto-schedule-from-modal').addEventListener('click', () => {
      elAutoRulesModal.classList.remove('open');
      runAutoScheduler();
    });

    // Add Anti-Pair rule
    document.getElementById('btn-add-antipair').addEventListener('click', () => {
      const idA = document.getElementById('select-antipair-a').value;
      const idB = document.getElementById('select-antipair-b').value;
      if (!idA || !idB || idA === idB) {
        showToast('請選擇兩位不同的員工設定互斥！', 'warning');
        return;
      }
      const exists = state.antiPairs.some(p => (p[0] === idA && p[1] === idB) || (p[0] === idB && p[1] === idA));
      if (exists) {
        showToast('此互斥組合已存在！', 'warning');
        return;
      }
      state.antiPairs.push([idA, idB]);
      saveState();
      renderAutoRulesModalUI();
      showToast('已新增搭檔互斥規則！', 'success');
    });

    // Add Role Restriction
    document.getElementById('btn-add-role-restrict').addEventListener('click', () => {
      const role = document.getElementById('select-role-restrict-role').value;
      const shiftId = document.getElementById('select-role-restrict-shift').value;
      if (!role || !shiftId) return;

      const exists = state.roleRestrictions.some(r => r.role === role && r.shiftId === shiftId);
      if (exists) {
        showToast('此職位班別限制已存在！', 'warning');
        return;
      }
      state.roleRestrictions.push({ role, shiftId });
      saveState();
      renderAutoRulesModalUI();
      showToast(`已新增限制：${role} 不可上此班別`, 'success');
    });

    // Alert Card Click -> Opens Violations / Rules Inspector
    elCardAlert.addEventListener('click', () => openRulesModal('violations'));
    document.getElementById('m-btn-rules').addEventListener('click', () => openRulesModal('violations'));

    // Rules Modal Tabs
    document.getElementById('tab-btn-violations').addEventListener('click', () => switchRulesTab('violations'));
    document.getElementById('tab-btn-rules-settings').addEventListener('click', () => switchRulesTab('settings'));

    // Save Rules Settings Form
    document.getElementById('form-rules-settings').addEventListener('submit', (e) => {
      e.preventDefault();
      const maxShifts = parseInt(document.getElementById('rule-max-shifts-day').value, 10) || 1;
      const maxConsecutive = parseInt(document.getElementById('rule-max-consecutive-days').value, 10) || 6;
      const maxDailyHours = parseFloat(document.getElementById('rule-max-daily-hours').value) || 12;

      state.rules = {
        maxDailyShifts: maxShifts,
        maxConsecutiveDays: maxConsecutive,
        maxDailyHours: maxDailyHours
      };
      saveState();
      renderAll();
      switchRulesTab('violations');
      showToast('✅ 法規規則設定已成功儲存！', 'success');
    });

    // Excel Export buttons
    document.getElementById('btn-export-excel').addEventListener('click', exportCustomExcel);
    document.getElementById('m-btn-export').addEventListener('click', exportCustomExcel);

    // Print
    document.getElementById('btn-print').addEventListener('click', () => {
      window.print();
    });

    // Staff Modal
    const openStaffModal = () => {
      elStaffModal.classList.add('open');
      renderStaffModalList();
      renderRolesManagementUI();
    };
    document.getElementById('btn-open-staff').addEventListener('click', openStaffModal);
    document.getElementById('m-btn-staff').addEventListener('click', openStaffModal);

    // Add Custom Role Button
    document.getElementById('btn-add-role').addEventListener('click', () => {
      const input = document.getElementById('input-new-role');
      if (input) {
        addCustomRole(input.value);
        input.value = '';
      }
    });

    // Shifts Modal
    const openShiftsModal = () => {
      elShiftsModal.classList.add('open');
      renderShiftsModalList();
    };
    document.getElementById('btn-open-shifts').addEventListener('click', openShiftsModal);
    document.getElementById('m-btn-shifts').addEventListener('click', openShiftsModal);

    // Modal Close buttons
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.close;
        const target = document.getElementById(modalId);
        if (target) target.classList.remove('open');
      });
    });

    [elStaffModal, elShiftsModal, elRulesModal, elAutoRulesModal].forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) modal.classList.remove('open');
        });
      }
    });

    // Bottom Sheet Close
    elBtnCloseBottomSheet.addEventListener('click', closeBottomSheet);
    elBottomSheetBackdrop.addEventListener('click', (e) => {
      if (e.target === elBottomSheetBackdrop) closeBottomSheet();
    });

    elBtnSheetSetOff.addEventListener('click', () => {
      if (state.activeTarget) {
        assignShift(state.activeTarget.staffId, state.activeTarget.dateStr, 'shift_off');
        closeBottomSheet();
      }
    });

    elBtnSheetClear.addEventListener('click', () => {
      if (state.activeTarget) {
        assignShift(state.activeTarget.staffId, state.activeTarget.dateStr, null);
        closeBottomSheet();
      }
    });

    // Add Staff Form
    document.getElementById('form-add-staff').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('staff-name').value.trim();
      const role = document.getElementById('staff-role').value;
      const wage = parseFloat(document.getElementById('staff-wage').value) || 200;
      const maxHours = parseFloat(document.getElementById('staff-max-hours').value) || 40;
      const color = document.getElementById('staff-color').value;
      const offPref = document.getElementById('staff-off-pref').value;

      if (!name) return;

      const newStaff = { id: `staff_${Date.now()}`, name, role, wage, maxHours, color, offPref };
      state.staff.push(newStaff);
      saveState();
      renderAll();
      showToast(`已成功新增同仁：${name}`, 'success');
      document.getElementById('staff-name').value = '';
    });

    // Add Shift Form (Supporting Chinese and English names/codes and colors)
    document.getElementById('form-add-shift').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('shift-name').value.trim();
      const code = document.getElementById('shift-code').value.trim();
      const enName = (document.getElementById('shift-en-name') ? document.getElementById('shift-en-name').value.trim() : '') || name;
      const enCode = (document.getElementById('shift-en-code') ? document.getElementById('shift-en-code').value.trim() : '') || code;
      const start = document.getElementById('shift-start').value;
      const end = document.getElementById('shift-end').value;
      const hours = parseFloat(document.getElementById('shift-hours').value) || 8;
      const color = document.getElementById('shift-color').value;
      const targetStaff = parseInt(document.getElementById('shift-target-staff').value, 10) || 1;

      if (!name || !code) return;

      const newShift = { id: `shift_${Date.now()}`, name, code, enName, enCode, start, end, hours, color, targetStaff };
      state.shifts.push(newShift);
      state.shiftFairness.push(newShift.id);
      saveState();
      renderAll();
      showToast(`已成功新增班別：${name} (${enName})`, 'success');
      document.getElementById('shift-name').value = '';
      document.getElementById('shift-code').value = '';
      if (document.getElementById('shift-en-name')) document.getElementById('shift-en-name').value = '';
      if (document.getElementById('shift-en-code')) document.getElementById('shift-en-code').value = '';
    });

    // Desktop Popover Outside Click
    document.addEventListener('click', (e) => {
      if (elShiftPicker.style.display !== 'none' && !elShiftPicker.contains(e.target)) {
        closeShiftPicker();
      }
    });

    // Theme Toggle
    const elThemeToggle = document.getElementById('btn-theme-toggle');
    const elThemeIcon = document.getElementById('theme-icon');

    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(THEME_KEY, theme);
      if (theme === 'light') {
        elThemeIcon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
      } else {
        elThemeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
      }
    }

    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(savedTheme);

    elThemeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'light' ? 'dark' : 'light');
    });
  }

  // ==========================================================================
  // App Bootstrapper
  // ==========================================================================
  function init() {
    loadState();
    setupEventListeners();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
