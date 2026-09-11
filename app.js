/**
 * ShiftMaster Pro - Core Application Logic
 * Comprehensive Web Scheduling & Workforce Management System
 * 
 * Features:
 * - Flexible Scheduling Periods (Month, 7-day, 14-day, Custom)
 * - Simplified Shifts (Chinese Name, Chinese Code, English Code, Colors, Leave Flags)
 * - Overtime Hours Logging & Breakdown per Staff Member
 * - Individual Staff Hours & Detailed Modal
 * - Salary Breakdown & Customizable Overtime Pay Multiplier
 * - Monthly Leave Quota Tracking & One-Click Batch Allocation
 * - Headcount Adequacy Verification (Weekday, Weekend, and Custom Dates)
 * - Auto-Scheduling with Anti-Pairs, Role Restrictions & Fairness Balancing
 * - Two-Tier Tailored Excel Export with Full Title/Cell-Merge Customization
 */

(function () {
  'use strict';

  // --- Storage & State Keys ---
  const STORAGE_KEY = 'shiftmaster_pro_v2';
  const THEME_KEY = 'shiftmaster_theme';

  // --- Default Roles ---
  const DEFAULT_ROLES = ['店長', '正職', '工讀生'];

  // --- Default Shifts Configuration (簡化：留中文名稱、中文代碼、英文代碼、假別標記、字體顏色與透明色塊) ---
  const DEFAULT_SHIFTS = [
    { id: 'shift_morning', name: '早班', code: '早', enCode: 'M', start: '08:00', end: '16:30', hours: 8, color: '#10b981', textColor: '#ffffff', bgTransparent: false, targetStaff: 2, isLeave: false },
    { id: 'shift_middle', name: '中班', code: '中', enCode: 'C', start: '12:00', end: '20:30', hours: 8, color: '#f59e0b', textColor: '#ffffff', bgTransparent: false, targetStaff: 1, isLeave: false },
    { id: 'shift_evening', name: '晚班', code: '晚', enCode: 'E', start: '16:00', end: '00:30', hours: 8, color: '#8b5cf6', textColor: '#ffffff', bgTransparent: false, targetStaff: 2, isLeave: false },
    { id: 'shift_night', name: '大夜班', code: '夜', enCode: 'N', start: '00:00', end: '08:30', hours: 8, color: '#3b82f6', textColor: '#ffffff', bgTransparent: false, targetStaff: 1, isLeave: false },
    { id: 'shift_parttime', name: '支援短班', code: '短', enCode: 'P', start: '18:00', end: '22:00', hours: 4, color: '#06b6d4', textColor: '#ffffff', bgTransparent: false, targetStaff: 1, isLeave: false },
    { id: 'shift_off', name: '例休', code: '休', enCode: 'O', start: '-', end: '-', hours: 0, color: '#64748b', textColor: '#ffffff', bgTransparent: false, targetStaff: 0, isLeave: true },
    { id: 'shift_personal', name: '事假', code: '事', enCode: 'L', start: '-', end: '-', hours: 0, color: '#f97316', textColor: '#ffffff', bgTransparent: false, targetStaff: 0, isLeave: true },
    { id: 'shift_sick', name: '病假', code: '病', enCode: 'S', start: '-', end: '-', hours: 0, color: '#ef4444', textColor: '#ffffff', bgTransparent: false, targetStaff: 0, isLeave: true }
  ];

  // --- Default Staff Roster ---
  const DEFAULT_STAFF = [
    { id: 'staff_1', name: '林雅婷', role: '店長', wage: 280, maxHours: 40, color: '#6366f1', offPref: '0', leaveQuota: 8 },
    { id: 'staff_2', name: '張志豪', role: '正職', wage: 230, maxHours: 40, color: '#10b981', offPref: '1', leaveQuota: 8 },
    { id: 'staff_3', name: '陳美玲', role: '正職', wage: 210, maxHours: 40, color: '#ec4899', offPref: '2', leaveQuota: 8 },
    { id: 'staff_4', name: '王大明', role: '正職', wage: 200, maxHours: 40, color: '#f59e0b', offPref: '3', leaveQuota: 8 },
    { id: 'staff_5', name: '許家豪', role: '工讀生', wage: 195, maxHours: 28, color: '#06b6d4', offPref: '4', leaveQuota: 8 },
    { id: 'staff_6', name: '柯怡君', role: '工讀生', wage: 195, maxHours: 24, color: '#a855f7', offPref: '5', leaveQuota: 8 },
    { id: 'staff_7', name: '黃冠宇', role: '工讀生', wage: 190, maxHours: 20, color: '#14b8a6', offPref: 'none', leaveQuota: 8 }
  ];

  const DAY_NAMES_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  const DAY_NAMES_FULL_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const DAY_NAMES_SHORT_ZH = ['日', '一', '二', '三', '四', '五', '六'];
  const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // --- App State ---
  let state = {
    staff: [],
    shifts: [],
    roles: [...DEFAULT_ROLES],
    // Keyed by `${staffId}_${dateStr}` => { shiftId: string, otHours: number } or string (compatible)
    schedules: {},
    // Flexible Period State
    periodMode: 'month', // '7days' | '14days' | 'month' | 'custom'
    periodStart: new Date(),
    periodEnd: new Date(),
    selectedDayIndex: 0,
    currentView: window.innerWidth <= 768 ? 'day' : 'day',
    // Shift Display Language: 'zh' or 'en'
    shiftDisplayLang: 'zh',
    // Overtime Pay Multiplier (Default 1.34)
    otMultiplier: 1.34,
    // Regulatory Rules Config
    rules: {
      maxDailyShifts: 1,
      maxConsecutiveDays: 6,
      maxDailyHours: 12,
      headcount: {
        weekdayMin: 3,
        weekendMin: 2,
        customDates: [] // Array of { date: 'YYYY-MM-DD', min: number }
      }
    },
    // Auto-Schedule Advanced Rules
    antiPairs: [], // Array of [staffIdA, staffIdB]
    roleRestrictions: [], // Array of { role: string, shiftId: string }
    shiftFairness: ['shift_morning', 'shift_evening', 'shift_middle'], // Shift IDs that must be balanced
    activeTarget: null
  };

  // --- DOM Elements References (Cached safely) ---
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

  // Table Elements
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
  const elCardHours = document.getElementById('card-hours');
  const elCardLeaves = document.getElementById('card-leaves');
  const elCardCost = document.getElementById('card-cost');
  const elCardAlert = document.getElementById('card-alert');

  // Bottom Sheet Elements
  const elBottomSheetBackdrop = document.getElementById('bottom-sheet-backdrop');
  const elBottomSheetTitle = document.getElementById('bottom-sheet-title');
  const elBottomSheetSubtitle = document.getElementById('bottom-sheet-subtitle');
  const elDrawerShiftsList = document.getElementById('drawer-shifts-list');
  const elBtnSheetSetOff = document.getElementById('btn-sheet-set-off');
  const elBtnSheetClear = document.getElementById('btn-sheet-clear');
  const elBtnCloseBottomSheet = document.getElementById('btn-close-bottom-sheet');
  const elInputOvertimeHours = document.getElementById('input-overtime-hours');

  // Desktop Popover & Modals
  const elShiftPicker = document.getElementById('shift-picker-popover');
  const elToastContainer = document.getElementById('toast-container');
  const elStaffModal = document.getElementById('modal-staff');
  const elShiftsModal = document.getElementById('modal-shifts');
  const elRulesModal = document.getElementById('modal-rules');
  const elAutoRulesModal = document.getElementById('modal-auto-rules');
  const elHoursModal = document.getElementById('modal-hours-detail');
  const elCostModal = document.getElementById('modal-cost-detail');
  const elLeavesModal = document.getElementById('modal-leaves');
  const elExcelModal = document.getElementById('modal-excel-options');

  // Table-view Language Display Toggle
  const elBtnToggleShiftLangTable = document.getElementById('btn-toggle-shift-lang-table');
  const elLabelShiftLangTable = document.getElementById('label-shift-lang-table');

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

    if (elInputPeriodStart) elInputPeriodStart.value = formatDateIso(state.periodStart);
    if (elInputPeriodEnd) elInputPeriodEnd.value = formatDateIso(state.periodEnd);

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
  // Safe Schedule Record Accessor (Compatible with string or object)
  // ==========================================================================
  function getScheduleEntry(staffId, dateStr) {
    const raw = state.schedules[`${staffId}_${dateStr}`];
    if (!raw) return null;
    if (typeof raw === 'string') {
      return { shiftId: raw, otHours: 0 };
    }
    return {
      shiftId: raw.shiftId,
      otHours: Math.max(0, parseFloat(raw.otHours) || 0)
    };
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
        state.otMultiplier = typeof parsed.otMultiplier === 'number' ? parsed.otMultiplier : 1.34;
        state.rules = Object.assign({
          maxDailyShifts: 1,
          maxConsecutiveDays: 6,
          maxDailyHours: 12,
          headcount: { weekdayMin: 3, weekendMin: 2, customDates: [] }
        }, parsed.rules || {});
        state.antiPairs = parsed.antiPairs || [];
        state.roleRestrictions = parsed.roleRestrictions || [];
        state.shiftFairness = parsed.shiftFairness || ['shift_morning', 'shift_evening', 'shift_middle'];

        // Normalize staff with default leaveQuota
        state.staff.forEach(s => {
          if (typeof s.leaveQuota !== 'number') s.leaveQuota = 8;
        });

        // Normalize shifts: ensure isLeave flag, textColor, bgTransparent, and 1-char codes
        state.shifts.forEach(s => {
          if (typeof s.isLeave !== 'boolean') {
            s.isLeave = s.id === 'shift_off' || s.hours === 0;
          }
          if (!s.textColor) s.textColor = '#ffffff';
          if (typeof s.bgTransparent !== 'boolean') s.bgTransparent = false;
          if (s.code) s.code = s.code.slice(0, 1);
          if (s.enCode) s.enCode = s.enCode.slice(0, 1).toUpperCase();
        });
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

    if (elPeriodModeSelect) elPeriodModeSelect.value = state.periodMode;
    if (elInputPeriodStart) elInputPeriodStart.value = formatDateIso(state.periodStart);
    if (elInputPeriodEnd) elInputPeriodEnd.value = formatDateIso(state.periodEnd);
    if (elCustomDateContainer) elCustomDateContainer.style.display = state.periodMode === 'custom' ? 'flex' : 'none';

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
        otMultiplier: state.otMultiplier,
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
    state.otMultiplier = 1.34;
    state.rules = {
      maxDailyShifts: 1,
      maxConsecutiveDays: 6,
      maxDailyHours: 12,
      headcount: { weekdayMin: 3, weekendMin: 2, customDates: [] }
    };
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
          state.schedules[`${staff.id}_${dateStr}`] = { shiftId, otHours: 0 };
        }
      });
    });

    saveState();
  }

  // ==========================================================================
  // Calculations & Compliance Violations Inspector
  // ==========================================================================
  function getStaffHoursBreakdown(staffId, periodDays) {
    let normalHours = 0;
    let otHours = 0;

    periodDays.forEach(d => {
      const dateStr = formatDateIso(d);
      const entry = getScheduleEntry(staffId, dateStr);
      if (entry && entry.shiftId) {
        const shift = state.shifts.find(s => s.id === entry.shiftId);
        if (shift && shift.hours) {
          normalHours += shift.hours;
        }
        if (entry.otHours > 0) {
          otHours += entry.otHours;
        }
      }
    });

    return {
      normalHours,
      otHours,
      totalHours: normalHours + otHours
    };
  }

  /**
   * Evaluates all violations and scheduling conflicts according to customizable rules.
   * Includes headcount adequacy verification for Weekdays, Weekends, and Custom dates.
   */
  function getAllViolations() {
    const periodDays = getPeriodDays();
    const violations = [];
    const maxConsecutive = state.rules.maxConsecutiveDays || 6;
    const maxDailyHours = state.rules.maxDailyHours || 12;
    const periodWeeks = Math.max(1, periodDays.length / 7);

    // 1. Staff-level checks (Consecutive days, Period Overtime, Daily Hours, Role Restrictions)
    state.staff.forEach(staff => {
      const breakdown = getStaffHoursBreakdown(staff.id, periodDays);
      const allowedHours = Math.round(staff.maxHours * periodWeeks);

      if (breakdown.totalHours > allowedHours) {
        violations.push({
          staffId: staff.id,
          staffName: staff.name,
          date: '整期累計',
          type: 'overtime',
          title: '週期工時超量',
          desc: `${staff.name} 當期工時達 ${breakdown.totalHours}h (含加班 ${breakdown.otHours}h)，超過標準上限 ${allowedHours}h`
        });
      }

      // Check Consecutive work days
      let consecutive = 0;
      let streakStartDate = null;
      periodDays.forEach(d => {
        const dateStr = formatDateIso(d);
        const entry = getScheduleEntry(staff.id, dateStr);
        const shift = entry ? state.shifts.find(s => s.id === entry.shiftId) : null;
        const isWorking = shift && !shift.isLeave && shift.hours > 0;

        if (isWorking) {
          if (consecutive === 0) streakStartDate = dateStr;
          consecutive++;
          if (consecutive > maxConsecutive) {
            violations.push({
              staffId: staff.id,
              staffName: staff.name,
              date: dateStr,
              type: 'consecutive',
              title: '連續出勤過長',
              desc: `${staff.name} 從 ${streakStartDate} 起已連續出勤 ${consecutive} 天，超過法定上限 ${maxConsecutive} 天`
            });
          }
        } else {
          consecutive = 0;
          streakStartDate = null;
        }

        // Check Daily Hours (Shift hours + overtime)
        if (entry && shift) {
          const dailyTotal = (shift.hours || 0) + (entry.otHours || 0);
          if (dailyTotal > maxDailyHours) {
            violations.push({
              staffId: staff.id,
              staffName: staff.name,
              date: dateStr,
              type: 'daily-hours',
              title: '單日工時超限',
              desc: `${staff.name} 於 ${dateStr} 排定班別 (${shift.hours}h) 加班 (${entry.otHours}h)，單日總計 ${dailyTotal}h 超過單日上限 ${maxDailyHours}h`
            });
          }
        }

        // Check Role Restrictions
        if (entry && shift) {
          const isRestricted = state.roleRestrictions.some(r => r.role === staff.role && r.shiftId === shift.id);
          if (isRestricted) {
            violations.push({
              staffId: staff.id,
              staffName: staff.name,
              date: dateStr,
              type: 'role-restrict',
              title: '職位限制衝突',
              desc: `${staff.name} 職位為「${staff.role}」，依排班約束不可排定「${shift.name}」`
            });
          }
        }
      });
    });

    // 2. Day-level checks (Anti-pair conflicts, Headcount adequacy for weekday/weekend/custom)
    const headcountRules = state.rules.headcount || { weekdayMin: 3, weekendMin: 2, customDates: [] };

    periodDays.forEach(d => {
      const dateStr = formatDateIso(d);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      // Determine required minimum headcount
      let requiredMin = isWeekend ? (headcountRules.weekendMin || 2) : (headcountRules.weekdayMin || 3);
      if (headcountRules.customDates) {
        const customMatch = headcountRules.customDates.find(c => c.date === dateStr);
        if (customMatch && typeof customMatch.min === 'number') {
          requiredMin = customMatch.min;
        }
      }

      // Count working staff on this day
      let activeWorkingCount = 0;
      const workingStaffIds = [];

      state.staff.forEach(staff => {
        const entry = getScheduleEntry(staff.id, dateStr);
        if (entry && entry.shiftId) {
          const shift = state.shifts.find(s => s.id === entry.shiftId);
          if (shift && !shift.isLeave && shift.hours > 0) {
            activeWorkingCount++;
            workingStaffIds.push(staff.id);
          }
        }
      });

      // Check Headcount Adequacy
      if (activeWorkingCount < requiredMin) {
        violations.push({
          staffId: 'system',
          staffName: '當日執勤人力',
          date: dateStr,
          type: 'headcount-shortage',
          title: '執勤人力不足',
          desc: `${dateStr} (${DAY_NAMES_ZH[d.getDay()]}) 實際執勤 ${activeWorkingCount} 人，低於規定最低人力 ${requiredMin} 人`
        });
      }

      // Check Anti-Pair Conflicts
      state.antiPairs.forEach(pair => {
        if (workingStaffIds.includes(pair[0]) && workingStaffIds.includes(pair[1])) {
          const staffA = state.staff.find(s => s.id === pair[0]);
          const staffB = state.staff.find(s => s.id === pair[1]);
          violations.push({
            staffId: `${pair[0]}_${pair[1]}`,
            staffName: `${staffA ? staffA.name : 'A'} & ${staffB ? staffB.name : 'B'}`,
            date: dateStr,
            type: 'anti-pair',
            title: '搭檔互斥衝突',
            desc: `${staffA ? staffA.name : '同仁A'} 與 ${staffB ? staffB.name : '同仁B'} 被設定為互斥搭檔，但於 ${dateStr} 同時出勤！`
          });
        }
      });
    });

    return violations;
  }

  // ==========================================================================
  // Display & UI Language Switching
  // ==========================================================================
  function toggleShiftDisplayLang() {
    state.shiftDisplayLang = state.shiftDisplayLang === 'zh' ? 'en' : 'zh';
    saveState();
    updateShiftLangButtonUI();
    renderAll();
    const label = state.shiftDisplayLang === 'zh' ? '繁體中文' : 'English (英文代碼)';
    showToast(`🔤 班別顯示模式已切換為：${label}`, 'info');
  }

  function updateShiftLangButtonUI() {
    if (elLabelShiftLangTable) {
      elLabelShiftLangTable.textContent = state.shiftDisplayLang === 'en' ? 'EN 英文代碼' : '中文顯示';
    }
    if (elBtnToggleShiftLangTable) {
      if (state.shiftDisplayLang === 'en') {
        elBtnToggleShiftLangTable.classList.add('btn-primary');
        elBtnToggleShiftLangTable.classList.remove('btn-secondary');
      } else {
        elBtnToggleShiftLangTable.classList.remove('btn-primary');
        elBtnToggleShiftLangTable.classList.add('btn-secondary');
      }
    }
  }

  function getShiftDisplayShort(shift) {
    if (!shift) return '-';
    if (state.shiftDisplayLang === 'en') {
      const code = shift.enCode || shift.code || shift.name || '';
      return code.slice(0, 1).toUpperCase();
    }
    const code = shift.code || shift.name || '';
    return code.slice(0, 1);
  }

  function getShiftDisplayTitle(shift) {
    if (!shift) return '';
    if (state.shiftDisplayLang === 'en') {
      return `${shift.name} [${shift.enCode || shift.code}]`;
    }
    return `${shift.name} [${shift.code}]`;
  }

  // ==========================================================================
  // VIEW 1: Mobile-Friendly Day Carousel & Cards Mode
  // ==========================================================================
  function renderMobileDayView() {
    const periodDays = getPeriodDays();
    if (periodDays.length === 0) return;

    if (state.selectedDayIndex < 0 || state.selectedDayIndex >= periodDays.length) {
      state.selectedDayIndex = 0;
    }

    const currentDay = periodDays[state.selectedDayIndex];
    const currentDayIso = formatDateIso(currentDay);
    const dayOfWeek = currentDay.getDay();

    // 1. Render Carousel Tabs (指尖大小一格，顯示月/日(星期)與上班人數)
    if (elDateCarousel) {
      elDateCarousel.innerHTML = '';
      const headcountRules = state.rules.headcount || { weekdayMin: 3, weekendMin: 2, customDates: [] };

      periodDays.forEach((d, idx) => {
        const item = document.createElement('div');
        const isSelected = idx === state.selectedDayIndex;
        const dIso = formatDateIso(d);
        const dow = d.getDay();
        const isWk = dow === 0 || dow === 6;

        let dayTarget = isWk ? headcountRules.weekendMin : headcountRules.weekdayMin;
        if (headcountRules.customDates) {
          const match = headcountRules.customDates.find(c => c.date === dIso);
          if (match && typeof match.min === 'number') dayTarget = match.min;
        }

        let dayOnDuty = 0;
        state.staff.forEach(s => {
          const entry = getScheduleEntry(s.id, dIso);
          if (entry && entry.shiftId) {
            const shift = state.shifts.find(sh => sh.id === entry.shiftId);
            if (shift && !shift.isLeave && shift.hours > 0) dayOnDuty++;
          }
        });

        item.className = `day-chip date-carousel-item ${isSelected ? 'active' : ''} ${isWk ? 'is-weekend' : ''}`;
        item.innerHTML = `
          <div class="day-chip-name">${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES_SHORT_ZH[dow]})</div>
          <div class="day-chip-badge ${dayOnDuty >= dayTarget ? 'is-sufficient' : 'is-shortage'}">${dayOnDuty}人上班</div>
        `;
        item.addEventListener('click', () => {
          state.selectedDayIndex = idx;
          renderMobileDayView();
        });
        elDateCarousel.appendChild(item);
      });

      const activeItem = elDateCarousel.children[state.selectedDayIndex];
      if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }

    // 2. Headcount requirement & adequacy
    const headcountRules = state.rules.headcount || { weekdayMin: 3, weekendMin: 2, customDates: [] };
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    let targetHeadcount = isWeekend ? headcountRules.weekendMin : headcountRules.weekdayMin;
    if (headcountRules.customDates) {
      const match = headcountRules.customDates.find(c => c.date === currentDayIso);
      if (match && typeof match.min === 'number') targetHeadcount = match.min;
    }

    let onDutyCount = 0;
    let offCount = 0;

    state.staff.forEach(s => {
      const entry = getScheduleEntry(s.id, currentDayIso);
      if (entry && entry.shiftId) {
        const shift = state.shifts.find(sh => sh.id === entry.shiftId);
        if (shift && !shift.isLeave && shift.hours > 0) {
          onDutyCount++;
        } else {
          offCount++;
        }
      } else {
        offCount++;
      }
    });

    if (elDaySummaryTitle) {
      const fullDayStr = `${currentDay.getFullYear()}年${currentDay.getMonth() + 1}月${currentDay.getDate()}日 (${DAY_NAMES_ZH[dayOfWeek]})`;
      elDaySummaryTitle.textContent = fullDayStr;
    }

    if (elDaySummaryHeadcount) {
      const isAdequate = onDutyCount >= targetHeadcount;
      elDaySummaryHeadcount.innerHTML = `
        上班人數 <b>${onDutyCount}</b> / 標準 <b>${targetHeadcount}</b> 人
        <span class="headcount-status-badge ${isAdequate ? 'status-ok' : 'status-shortage'}">
          ${isAdequate ? '人力充足' : '人數不足'}
        </span>
      `;
    }

    // 3. Render Staff Cards for selected day
    if (elMobileStaffCards) {
      elMobileStaffCards.innerHTML = '';
      state.staff.forEach(staff => {
        const entry = getScheduleEntry(staff.id, currentDayIso);
        const shift = entry && entry.shiftId ? state.shifts.find(s => s.id === entry.shiftId) : null;
        const card = document.createElement('div');
        card.className = 'mobile-staff-card';

        let badgeHtml = '';
        if (shift) {
          const shiftText = getShiftDisplayTitle(shift);
          const otBadge = entry.otHours > 0 ? `<span class="ot-badge">+${entry.otHours}h加班</span>` : '';
          const bgStyle = shift.bgTransparent ? 'background:transparent;border:1px dashed var(--border-color);' : `background:${shift.color};`;
          badgeHtml = `
            <div class="mobile-shift-badge" style="${bgStyle}color:${shift.textColor || '#ffffff'};">
              <span>${escapeHtml(shiftText)} ${shift.hours > 0 ? `(${shift.hours}h)` : ''}</span>
              ${otBadge}
            </div>
          `;
        } else {
          badgeHtml = `
            <div class="mobile-shift-badge" style="background:var(--bg-subtle);color:var(--text-muted);border:1px dashed var(--border-color);">
              <span>未排班（點擊指派）</span>
            </div>
          `;
        }

        card.innerHTML = `
          <div class="mobile-staff-card-header">
            <div class="mobile-staff-info">
              <div class="staff-avatar" style="background:${staff.color};">
                ${staff.name.slice(0, 1)}
              </div>
              <div>
                <span class="staff-name">${escapeHtml(staff.name)}</span>
                <span class="staff-role-badge">${escapeHtml(staff.role)}</span>
              </div>
            </div>
            ${badgeHtml}
          </div>
        `;

        card.addEventListener('click', () => {
          openBottomSheet(staff, currentDayIso, DAY_NAMES_ZH[dayOfWeek]);
        });

        elMobileStaffCards.appendChild(card);
      });
    }
  }

  // ==========================================================================
  // VIEW 2: Staff-Centric Weekly Cards Mode
  // ==========================================================================
  function renderStaffView() {
    if (!elStaffWeeklyList) return;
    elStaffWeeklyList.innerHTML = '';

    const days = getPeriodDays();

    state.staff.forEach(staff => {
      const breakdown = getStaffHoursBreakdown(staff.id, days);
      const card = document.createElement('div');
      card.className = 'staff-weekly-card';

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
        <div style="font-size:0.825rem;font-weight:700;color:var(--text-primary);">
          工時 ${breakdown.normalHours}h ${breakdown.otHours > 0 ? `<span style="color:#f59e0b;">(+${breakdown.otHours}h加班)</span>` : ''} ＝ 計 <b>${breakdown.totalHours}h</b>
        </div>
      `;
      card.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'staff-weekly-days-grid';

      days.forEach(d => {
        const dateIso = formatDateIso(d);
        const dayTitle = `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES_SHORT_ZH[d.getDay()]})`;
        const dayName = state.shiftDisplayLang === 'en' ? DAY_NAMES_EN[d.getDay()] : DAY_NAMES_ZH[d.getDay()];
        const entry = getScheduleEntry(staff.id, dateIso);
        const shift = entry && entry.shiftId ? state.shifts.find(s => s.id === entry.shiftId) : null;

        const pill = document.createElement('div');
        pill.className = 'staff-day-pill';
        if (shift) {
          if (shift.bgTransparent) {
            pill.classList.add('is-transparent');
            pill.style.backgroundColor = 'transparent';
          } else {
            pill.style.backgroundColor = shift.color;
            pill.style.borderColor = 'transparent';
          }
          const codeText = getShiftDisplayShort(shift);
          const otText = entry.otHours > 0 ? `<span class="ot-badge">+${entry.otHours}h</span>` : '';
          pill.innerHTML = `
            <span class="staff-day-pill-name" style="font-size:0.62rem;white-space:nowrap;">${dayTitle}</span>
            <span class="staff-day-pill-code" style="color:${shift.textColor || '#ffffff'};font-weight:800;">${codeText} ${otText}</span>
          `;
        } else {
          pill.innerHTML = `
            <span class="staff-day-pill-name" style="font-size:0.62rem;white-space:nowrap;">${dayTitle}</span>
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
  // VIEW 3: Compact Schedule Table Mode
  // ==========================================================================
  function renderTable() {
    if (!elTableHeader || !elTableBody || !elTableFooter) return;
    const periodDays = getPeriodDays();
    const todayIso = formatDateIso(new Date());

    // 1. Table Header
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

      periodDays.forEach(d => {
        const dateIso = formatDateIso(d);
        const dayName = state.shiftDisplayLang === 'en' ? DAY_NAMES_EN[d.getDay()] : DAY_NAMES_ZH[d.getDay()];
        const entry = getScheduleEntry(staff.id, dateIso);
        const shift = entry && entry.shiftId ? state.shifts.find(s => s.id === entry.shiftId) : null;

        const td = document.createElement('td');
        const slot = document.createElement('div');
        slot.className = 'shift-slot';

        if (shift) {
          const shortCode = getShiftDisplayShort(shift);
          const fullTitle = getShiftDisplayTitle(shift);
          const otBadge = entry.otHours > 0 ? `<span class="ot-badge">+${entry.otHours}</span>` : '';
          slot.innerHTML = `
            <div class="shift-pill" style="background:${shift.color};" title="${escapeHtml(fullTitle)} ${shift.start}~${shift.end}${entry.otHours > 0 ? ` (加班${entry.otHours}h)` : ''}">
              <div class="shift-pill-title">
                <span>${shortCode}</span>
                ${otBadge}
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

      const breakdown = getStaffHoursBreakdown(staff.id, periodDays);
      const tdTotal = document.createElement('td');
      tdTotal.className = 'col-total';
      tdTotal.innerHTML = `
        <div class="total-hours-display">
          <span class="hours-num">${breakdown.totalHours}h</span>
          ${breakdown.otHours > 0 ? `<span style="font-size:0.65rem;color:#f59e0b;">(+${breakdown.otHours})</span>` : ''}
        </div>
      `;
      tr.appendChild(tdTotal);

      elTableBody.appendChild(tr);
    });

    // 3. Table Footer (Daily Active Staff Headcount)
    elTableFooter.innerHTML = `<th class="col-staff">出勤</th>`;
    const headcountRules = state.rules.headcount || { weekdayMin: 3, weekendMin: 2, customDates: [] };

    periodDays.forEach(d => {
      const dateIso = formatDateIso(d);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      let requiredMin = isWeekend ? headcountRules.weekendMin : headcountRules.weekdayMin;
      if (headcountRules.customDates) {
        const customMatch = headcountRules.customDates.find(c => c.date === dateIso);
        if (customMatch && typeof customMatch.min === 'number') requiredMin = customMatch.min;
      }

      let count = 0;
      state.staff.forEach(s => {
        const entry = getScheduleEntry(s.id, dateIso);
        if (entry && entry.shiftId) {
          const shift = state.shifts.find(sh => sh.id === entry.shiftId);
          if (shift && !shift.isLeave && shift.hours > 0) {
            count++;
          }
        }
      });

      const th = document.createElement('th');
      const isShort = count < requiredMin;
      th.className = isShort ? 'shortage' : 'adequate';
      th.title = `標準: ${requiredMin}人 / 實際: ${count}人`;
      th.textContent = `${count}`;
      elTableFooter.appendChild(th);
    });

    const thFooterTotal = document.createElement('th');
    thFooterTotal.className = 'col-total';
    thFooterTotal.textContent = '-';
    elTableFooter.appendChild(thFooterTotal);

    // 4. Render Legend Chips
    renderShiftLegend();
  }

  function renderShiftLegend() {
    if (!elLegend) return;
    elLegend.innerHTML = '<span class="legend-title">班別對照表：</span>';

    state.shifts.forEach(shift => {
      const chip = document.createElement('div');
      chip.className = 'legend-chip';
      const shortCode = getShiftDisplayShort(shift);
      const displayTitle = getShiftDisplayTitle(shift);

      chip.innerHTML = `
        <span class="legend-color-dot" style="background:${shift.color};"></span>
        <span class="legend-name">${escapeHtml(displayTitle)}</span>
        <span class="legend-hours">${shift.hours > 0 ? `${shift.hours}h` : '休'}</span>
      `;
      elLegend.appendChild(chip);
    });
  }

  // ==========================================================================
  // Render KPI Dashboard
  // ==========================================================================
  function renderKPIDashboard() {
    const periodDays = getPeriodDays();
    let totalNormalHours = 0;
    let totalOtHours = 0;
    let totalShiftsAssigned = 0;
    let totalCost = 0;
    let totalLeaveDays = 0;

    state.staff.forEach(staff => {
      const breakdown = getStaffHoursBreakdown(staff.id, periodDays);
      totalNormalHours += breakdown.normalHours;
      totalOtHours += breakdown.otHours;

      const normalCost = breakdown.normalHours * staff.wage;
      const otCost = breakdown.otHours * staff.wage * state.otMultiplier;
      totalCost += (normalCost + otCost);

      // Count leaves and assigned work shifts
      periodDays.forEach(d => {
        const dateIso = formatDateIso(d);
        const entry = getScheduleEntry(staff.id, dateIso);
        if (entry && entry.shiftId) {
          const shift = state.shifts.find(s => s.id === entry.shiftId);
          if (shift) {
            if (shift.isLeave || shift.hours === 0) {
              totalLeaveDays++;
            } else {
              totalShiftsAssigned++;
            }
          }
        }
      });
    });

    const grandTotalHours = totalNormalHours + totalOtHours;
    const avgHours = state.staff.length > 0 ? (grandTotalHours / state.staff.length).toFixed(1) : 0;

    if (elStatHours) {
      elStatHours.innerHTML = `${grandTotalHours} <span style="font-size:0.85rem;font-weight:500;">小時</span>`;
    }
    if (elStatAvgHours) {
      elStatAvgHours.textContent = `人均: ${avgHours}h (含加班 ${totalOtHours}h)`;
    }

    if (elStatShifts) {
      elStatShifts.innerHTML = `${totalLeaveDays} <span style="font-size:0.85rem;font-weight:500;">天</span>`;
    }
    if (elStatCoverage) {
      elStatCoverage.textContent = `排班出勤人次：${totalShiftsAssigned} 班次`;
    }

    if (elStatCost) {
      elStatCost.textContent = `NT$ ${Math.round(totalCost).toLocaleString()}`;
    }

    // Violations and alert count
    const violations = getAllViolations();
    if (elStatAlertCount) {
      elStatAlertCount.innerHTML = `${violations.length} <span style="font-size:0.85rem;font-weight:500;">項異常</span>`;
      elStatAlertCount.style.color = violations.length === 0 ? 'var(--accent-success)' : 'var(--accent-danger)';
    }
    if (elStatAlertDesc) {
      elStatAlertDesc.textContent = violations.length === 0 ? '全數符合勞基法規與排班規則' : '存在工時超標、互斥或人力不足';
    }

    if (elPeriodDisplayBadge) {
      const s = state.periodStart;
      const e = state.periodEnd;
      elPeriodDisplayBadge.textContent = `${s.getFullYear()}/${s.getMonth() + 1}/${s.getDate()} ~ ${e.getFullYear()}/${e.getMonth() + 1}/${e.getDate()}`;
    }
  }

  // ==========================================================================
  // Global View Dispatcher
  // ==========================================================================
  function renderActiveView() {
    // Hide all containers first
    if (elContainerDay) elContainerDay.style.display = 'none';
    if (elContainerStaff) elContainerStaff.style.display = 'none';
    if (elContainerTable) elContainerTable.style.display = 'none';

    // Update active tab button styles
    ['day', 'staff', 'week'].forEach(view => {
      const btn = document.getElementById(`view-toggle-${view}`);
      if (btn) {
        if (state.currentView === view) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });

    if (state.currentView === 'day') {
      if (elContainerDay) elContainerDay.style.display = 'block';
      renderMobileDayView();
    } else if (state.currentView === 'staff') {
      if (elContainerStaff) elContainerStaff.style.display = 'block';
      renderStaffView();
    } else {
      if (elContainerTable) elContainerTable.style.display = 'block';
      renderTable();
    }
  }

  function renderAll() {
    renderKPIDashboard();
    renderActiveView();
  }

  // ==========================================================================
  // Shift Assignment Logic
  // ==========================================================================
  function assignShift(staffId, dateStr, shiftId, otHours = 0) {
    const key = `${staffId}_${dateStr}`;
    if (shiftId === null) {
      delete state.schedules[key];
      showToast('已清除排班', 'success');
    } else {
      state.schedules[key] = {
        shiftId: shiftId,
        otHours: Math.max(0, parseFloat(otHours) || 0)
      };
      const shift = state.shifts.find(s => s.id === shiftId);
      const otMsg = otHours > 0 ? ` (加班 ${otHours}h)` : '';
      showToast(`已排定：${shift ? shift.name : ''}${otMsg}`, 'success');
    }
    saveState();
    renderAll();
  }

  // ==========================================================================
  // Bottom Sheet (Mobile Shift Assignment & Overtime Hours)
  // ==========================================================================
  function openBottomSheet(staff, dateStr, dayName) {
    state.activeTarget = { staffId: staff.id, dateStr };

    if (elBottomSheetTitle) elBottomSheetTitle.textContent = `指派班別：${staff.name}`;
    if (elBottomSheetSubtitle) elBottomSheetSubtitle.textContent = `日期：${dateStr} (${dayName}) ・ 職稱：${staff.role}`;

    const currentEntry = getScheduleEntry(staff.id, dateStr);
    if (elInputOvertimeHours) {
      elInputOvertimeHours.value = currentEntry ? (currentEntry.otHours || 0) : 0;
    }

    if (elDrawerShiftsList) {
      elDrawerShiftsList.innerHTML = '';
      const workShifts = state.shifts.filter(s => s.id !== 'shift_off');

      workShifts.forEach(shift => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'drawer-shift-item';
        item.style.backgroundColor = shift.color;

        const codeText = getShiftDisplayShort(shift);
        const nameText = shift.name;

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
          const enteredOt = elInputOvertimeHours ? (parseFloat(elInputOvertimeHours.value) || 0) : 0;
          assignShift(staff.id, dateStr, shift.id, enteredOt);
          closeBottomSheet();
        });

        elDrawerShiftsList.appendChild(item);
      });
    }

    if (elBottomSheetBackdrop) elBottomSheetBackdrop.classList.add('open');
  }

  function closeBottomSheet() {
    if (elBottomSheetBackdrop) elBottomSheetBackdrop.classList.remove('open');
    state.activeTarget = null;
  }

  // ==========================================================================
  // Desktop Popover (Shift Picker with Overtime Input)
  // ==========================================================================
  function openShiftPicker(staffId, dateStr, anchorEl) {
    if (!elShiftPicker) return;
    elShiftPicker.innerHTML = '';

    const currentEntry = getScheduleEntry(staffId, dateStr);
    const initialOt = currentEntry ? currentEntry.otHours : 0;

    // 1. Overtime input row in popover
    const otRow = document.createElement('div');
    otRow.className = 'popover-ot-row';
    otRow.innerHTML = `
      <span>⏰ 當日加班：</span>
      <div style="display:flex;align-items:center;gap:3px;">
        <input type="number" id="popover-input-ot" class="popover-ot-input" value="${initialOt}" min="0" max="12" step="0.5">
        <span>h</span>
      </div>
    `;
    elShiftPicker.appendChild(otRow);

    // 2. Shift Options List
    state.shifts.forEach(shift => {
      const item = document.createElement('div');
      item.className = 'shift-picker-item';

      const shortCode = getShiftDisplayShort(shift);
      const titleText = getShiftDisplayTitle(shift);

      item.innerHTML = `
        <span style="display:flex;align-items:center;gap:0.4rem;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${shift.color};"></span>
          <span>${escapeHtml(titleText)}</span>
        </span>
        <span style="font-size:0.75rem;opacity:0.7;">${shift.hours > 0 ? `${shift.hours}h` : '休'}</span>
      `;

      item.addEventListener('click', () => {
        const inputOt = document.getElementById('popover-input-ot');
        const otVal = inputOt ? (parseFloat(inputOt.value) || 0) : 0;
        assignShift(staffId, dateStr, shift.id, otVal);
        closeShiftPicker();
      });

      elShiftPicker.appendChild(item);
    });

    // 3. Clear button
    const removeItem = document.createElement('div');
    removeItem.className = 'shift-picker-item remove-item';
    removeItem.innerHTML = `<span>❌ 清除此格排班</span>`;
    removeItem.addEventListener('click', () => {
      assignShift(staffId, dateStr, null, 0);
      closeShiftPicker();
    });
    elShiftPicker.appendChild(removeItem);

    const rect = anchorEl.getBoundingClientRect();
    elShiftPicker.style.display = 'flex';
    elShiftPicker.style.top = `${window.scrollY + rect.bottom + 4}px`;
    elShiftPicker.style.left = `${window.scrollX + rect.left}px`;
  }

  function closeShiftPicker() {
    if (elShiftPicker) elShiftPicker.style.display = 'none';
  }

  // ==========================================================================
  // Staff Hours Breakdown Modal (個別員工工時明細)
  // ==========================================================================
  function openHoursModal() {
    if (!elHoursModal) return;
    elHoursModal.classList.add('open');

    const content = document.getElementById('hours-detail-content');
    if (!content) return;

    const periodDays = getPeriodDays();
    const periodWeeks = Math.max(1, periodDays.length / 7);

    let html = `
      <div style="overflow-x:auto;">
        <table class="detail-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>職稱</th>
              <th>每週基準</th>
              <th>當期允許上限</th>
              <th>一般工時</th>
              <th>加班工時</th>
              <th>當期總工時</th>
              <th>狀態</th>
            </tr>
          </thead>
          <tbody>
    `;

    state.staff.forEach(staff => {
      const breakdown = getStaffHoursBreakdown(staff.id, periodDays);
      const allowed = Math.round(staff.maxHours * periodWeeks);
      const isOver = breakdown.totalHours > allowed;

      html += `
        <tr>
          <td><b>${escapeHtml(staff.name)}</b></td>
          <td><span class="staff-role-badge">${escapeHtml(staff.role)}</span></td>
          <td>${staff.maxHours}h/週</td>
          <td>${allowed}h</td>
          <td>${breakdown.normalHours}h</td>
          <td style="color:#f59e0b;font-weight:700;">+${breakdown.otHours}h</td>
          <td style="font-weight:800;font-size:0.95rem;">${breakdown.totalHours}h</td>
          <td>
            <span class="headcount-status-badge ${isOver ? 'status-shortage' : 'status-ok'}">
              ${isOver ? '工時超標' : '正常合規'}
            </span>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    content.innerHTML = html;
  }

  // ==========================================================================
  // Staff Cost & Overtime Multiplier Modal (預估薪資支出細項)
  // ==========================================================================
  function openCostModal() {
    if (!elCostModal) return;
    elCostModal.classList.add('open');
    renderCostModalUI();
  }

  function renderCostModalUI() {
    const content = document.getElementById('cost-detail-content');
    if (!content) return;

    const periodDays = getPeriodDays();
    let sumNormalCost = 0;
    let sumOtCost = 0;
    let sumTotalCost = 0;

    let html = `
      <div class="card-embedded" style="margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;">
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
          <span style="font-weight:700;font-size:0.875rem;">⚙️ 加班費計算倍率：</span>
          <input type="number" id="input-modal-ot-rate" class="form-control" value="${state.otMultiplier}" min="1" max="4" step="0.01" style="width:90px;font-weight:700;">
          <span style="font-size:0.75rem;color:var(--text-muted);">倍 (例：1.34 = 時薪 × 1.34)</span>
        </div>
        <button id="btn-apply-modal-ot-rate" class="btn btn-primary" style="font-size:0.8rem;padding:0.4rem 0.8rem;">更新計算</button>
      </div>

      <div style="overflow-x:auto;">
        <table class="detail-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>職稱</th>
              <th>時薪</th>
              <th>一般工時</th>
              <th>一般薪資</th>
              <th>加班工時</th>
              <th>加班薪資 (${state.otMultiplier}倍)</th>
              <th>預估總薪資</th>
            </tr>
          </thead>
          <tbody>
    `;

    state.staff.forEach(staff => {
      const breakdown = getStaffHoursBreakdown(staff.id, periodDays);
      const normalPay = Math.round(breakdown.normalHours * staff.wage);
      const otPay = Math.round(breakdown.otHours * staff.wage * state.otMultiplier);
      const totalPay = normalPay + otPay;

      sumNormalCost += normalPay;
      sumOtCost += otPay;
      sumTotalCost += totalPay;

      html += `
        <tr>
          <td><b>${escapeHtml(staff.name)}</b></td>
          <td><span class="staff-role-badge">${escapeHtml(staff.role)}</span></td>
          <td>NT$ ${staff.wage}</td>
          <td>${breakdown.normalHours}h</td>
          <td>NT$ ${normalPay.toLocaleString()}</td>
          <td style="color:#f59e0b;font-weight:700;">${breakdown.otHours}h</td>
          <td style="color:#f59e0b;">NT$ ${otPay.toLocaleString()}</td>
          <td style="font-weight:800;color:var(--accent-primary);font-size:0.95rem;">NT$ ${totalPay.toLocaleString()}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
          <tfoot>
            <tr style="background:var(--bg-subtle);font-weight:800;">
              <td colspan="4" style="text-align:right;">全體合計：</td>
              <td>NT$ ${sumNormalCost.toLocaleString()}</td>
              <td>-</td>
              <td style="color:#f59e0b;">NT$ ${sumOtCost.toLocaleString()}</td>
              <td style="color:var(--accent-primary);font-size:1.05rem;">NT$ ${sumTotalCost.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    content.innerHTML = html;

    const btnApply = document.getElementById('btn-apply-modal-ot-rate');
    if (btnApply) {
      btnApply.addEventListener('click', () => {
        const inp = document.getElementById('input-modal-ot-rate');
        if (inp) {
          const val = parseFloat(inp.value);
          if (val > 0) {
            state.otMultiplier = val;
            saveState();
            renderCostModalUI();
            renderKPIDashboard();
            showToast(`已套用加班倍率：${val} 倍！`, 'success');
          }
        }
      });
    }
  }

  // ==========================================================================
  // Leave Management Modal (休假管理與應休天數)
  // ==========================================================================
  function openLeavesModal() {
    if (!elLeavesModal) return;
    elLeavesModal.classList.add('open');
    renderLeavesModalUI();
  }

  function renderLeavesModalUI() {
    const content = document.getElementById('leave-detail-content');
    if (!content) return;

    const periodDays = getPeriodDays();

    let html = `
      <div style="overflow-x:auto;">
        <table class="detail-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>職稱</th>
              <th>本月應休 (天)</th>
              <th>已排休 (天)</th>
              <th>假別細項</th>
              <th>剩餘 / 欠休</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
    `;

    state.staff.forEach(staff => {
      const quota = typeof staff.leaveQuota === 'number' ? staff.leaveQuota : 8;
      let actualLeaves = 0;
      const leaveBreakdown = {}; // shiftName -> count

      periodDays.forEach(d => {
        const dateIso = formatDateIso(d);
        const entry = getScheduleEntry(staff.id, dateIso);
        if (entry && entry.shiftId) {
          const shift = state.shifts.find(s => s.id === entry.shiftId);
          if (shift && (shift.isLeave || shift.hours === 0)) {
            actualLeaves++;
            leaveBreakdown[shift.name] = (leaveBreakdown[shift.name] || 0) + 1;
          }
        }
      });

      const diff = quota - actualLeaves;
      const breakdownText = Object.entries(leaveBreakdown).map(([k, v]) => `${k} ${v}天`).join('、') || '無休假排定';

      html += `
        <tr>
          <td><b>${escapeHtml(staff.name)}</b></td>
          <td><span class="staff-role-badge">${escapeHtml(staff.role)}</span></td>
          <td>
            <input type="number" class="leave-quota-input" data-staff-id="${staff.id}" value="${quota}" min="0" max="31">
          </td>
          <td><span class="leave-actual-badge">${actualLeaves} 天</span></td>
          <td style="font-size:0.75rem;color:var(--text-secondary);">${escapeHtml(breakdownText)}</td>
          <td>
            <span class="headcount-status-badge ${diff === 0 ? 'status-ok' : (diff > 0 ? 'status-shortage' : 'status-ok')}">
              ${diff === 0 ? '已足額' : (diff > 0 ? `尚欠 ${diff} 天` : `超出 ${Math.abs(diff)} 天`)}
            </span>
          </td>
          <td>
            <button class="btn btn-secondary btn-save-single-quota" data-staff-id="${staff.id}" style="padding:0.25rem 0.55rem;font-size:0.75rem;">
              儲存
            </button>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    content.innerHTML = html;

    // Bind individual save buttons
    content.querySelectorAll('.btn-save-single-quota').forEach(btn => {
      btn.addEventListener('click', () => {
        const staffId = btn.dataset.staffId;
        const input = content.querySelector(`.leave-quota-input[data-staff-id="${staffId}"]`);
        if (input) {
          const staff = state.staff.find(s => s.id === staffId);
          if (staff) {
            staff.leaveQuota = parseInt(input.value, 10) || 0;
            saveState();
            renderLeavesModalUI();
            showToast(`已更新 ${staff.name} 應休天數為 ${staff.leaveQuota} 天`, 'success');
          }
        }
      });
    });
  }

  // ==========================================================================
  // Headcount Adequacy Tab Management (法規與人力規則)
  // ==========================================================================
  function openRulesModal(defaultTab = 'violations') {
    if (!elRulesModal) return;
    elRulesModal.classList.add('open');
    switchRulesTab(defaultTab);
  }

  function switchRulesTab(tab) {
    const btnViolations = document.getElementById('tab-btn-violations');
    const btnSettings = document.getElementById('tab-btn-rules-settings');
    const btnHeadcount = document.getElementById('tab-btn-headcount-rules');

    const paneViolations = document.getElementById('tab-content-violations');
    const paneSettings = document.getElementById('tab-content-rules-settings');
    const paneHeadcount = document.getElementById('tab-content-headcount-rules');

    [btnViolations, btnSettings, btnHeadcount].forEach(b => { if (b) b.classList.remove('active'); });
    [paneViolations, paneSettings, paneHeadcount].forEach(p => { if (p) p.style.display = 'none'; });

    if (tab === 'violations') {
      if (btnViolations) btnViolations.classList.add('active');
      if (paneViolations) paneViolations.style.display = 'block';
      renderViolationsList();
    } else if (tab === 'headcount') {
      if (btnHeadcount) btnHeadcount.classList.add('active');
      if (paneHeadcount) paneHeadcount.style.display = 'block';
      renderHeadcountRulesUI();
    } else {
      if (btnSettings) btnSettings.classList.add('active');
      if (paneSettings) paneSettings.style.display = 'block';
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
          <div style="font-size:0.825rem;color:var(--text-secondary);">
            無連續工作超限、無工時超標、無搭檔互斥、且平日/假日人力完全達標。
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
    const elMaxShifts = document.getElementById('rule-max-shifts-day');
    const elMaxConsecutive = document.getElementById('rule-max-consecutive-days');
    const elMaxDaily = document.getElementById('rule-max-daily-hours');

    if (elMaxShifts) elMaxShifts.value = state.rules.maxDailyShifts || 1;
    if (elMaxConsecutive) elMaxConsecutive.value = state.rules.maxConsecutiveDays || 6;
    if (elMaxDaily) elMaxDaily.value = state.rules.maxDailyHours || 12;
  }

  function renderHeadcountRulesUI() {
    state.rules.headcount = state.rules.headcount || { weekdayMin: 3, weekendMin: 2, customDates: [] };
    const elWeekday = document.getElementById('rule-weekday-headcount');
    const elHoliday = document.getElementById('rule-holiday-headcount');
    const listCustom = document.getElementById('custom-headcount-list');

    if (elWeekday) elWeekday.value = state.rules.headcount.weekdayMin || 3;
    if (elHoliday) elHoliday.value = state.rules.headcount.weekendMin || 2;

    if (listCustom) {
      listCustom.innerHTML = '';
      if (!state.rules.headcount.customDates || state.rules.headcount.customDates.length === 0) {
        listCustom.innerHTML = '<span style="font-size:0.75rem;color:var(--text-muted);">尚未設定自訂特殊日期（使用平日/假日預設值）</span>';
      } else {
        state.rules.headcount.customDates.forEach((item, idx) => {
          const row = document.createElement('div');
          row.className = 'headcount-rule-tag';
          row.innerHTML = `
            <span>📅 <b>${escapeHtml(item.date)}</b> ： 最低 <b>${item.min}</b> 人</span>
            <button type="button" class="btn-del-rule" title="移除此自訂日期">&times;</button>
          `;
          row.querySelector('.btn-del-rule').addEventListener('click', () => {
            state.rules.headcount.customDates.splice(idx, 1);
            saveState();
            renderHeadcountRulesUI();
            renderAll();
            showToast('已移除自訂日期人力要求', 'info');
          });
          listCustom.appendChild(row);
        });
      }
    }
  }

  // ==========================================================================
  // Auto-Schedule Advanced Rules Modal
  // ==========================================================================
  function openAutoRulesModal() {
    if (!elAutoRulesModal) return;
    elAutoRulesModal.classList.add('open');
    renderAutoRulesModalUI();
  }

  function renderAutoRulesModalUI() {
    const selA = document.getElementById('select-antipair-a');
    const selB = document.getElementById('select-antipair-b');
    const listAnti = document.getElementById('antipair-list-container');

    if (selA && selB) {
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
    }

    if (listAnti) {
      listAnti.innerHTML = '';
      if (state.antiPairs.length === 0) {
        listAnti.innerHTML = '<span style="font-size:0.75rem;color:var(--text-muted);">尚未設定互斥人員（所有人皆可同天排班）</span>';
      } else {
        state.antiPairs.forEach((pair, idx) => {
          const staffA = state.staff.find(s => s.id === pair[0]);
          const staffB = state.staff.find(s => s.id === pair[1]);
          const nameA = staffA ? staffA.name : '已刪除同仁';
          const nameB = staffB ? staffB.name : '已刪除同仁';

          const tag = document.createElement('div');
          tag.className = 'rule-tag-item';
          tag.innerHTML = `
            <span>🚫 <b>${escapeHtml(nameA)}</b> 與 <b>${escapeHtml(nameB)}</b> 不能同天出勤</span>
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
    }

    const selRole = document.getElementById('select-role-restrict-role');
    const selShift = document.getElementById('select-role-restrict-shift');
    const listRoleRestrict = document.getElementById('role-restrict-list-container');

    if (selRole && selShift) {
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
    }

    if (listRoleRestrict) {
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
    }

    const fairnessContainer = document.getElementById('shift-fairness-toggles-container');
    if (fairnessContainer) {
      fairnessContainer.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'checkbox-grid';
      const workShifts = state.shifts.filter(s => s.id !== 'shift_off');

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
  }

  // ==========================================================================
  // Auto-Scheduling Solver (依據互斥、偏好、公平性平均指派)
  // ==========================================================================
  function runAutoScheduler() {
    if (state.staff.length === 0) {
      showToast('目前名冊中無員工，請先新增人員！', 'warning');
      return;
    }

    const periodDays = getPeriodDays();
    const workShifts = state.shifts.filter(s => !s.isLeave && s.hours > 0);

    if (workShifts.length === 0) {
      showToast('無可排定的工作班別，請先設定班別！', 'warning');
      return;
    }

    // Initialize shift counts per staff for fairness
    const shiftCountMap = {};
    state.staff.forEach(s => {
      shiftCountMap[s.id] = {};
      workShifts.forEach(sh => { shiftCountMap[s.id][sh.id] = 0; });
    });

    // Clear existing period schedules
    state.staff.forEach(s => {
      periodDays.forEach(d => {
        const dateIso = formatDateIso(d);
        delete state.schedules[`${s.id}_${dateIso}`];
      });
    });

    periodDays.forEach(d => {
      const dateIso = formatDateIso(d);
      const dayOfWeek = d.getDay();
      const workingToday = new Set();

      // 1. Assign day-offs according to preferences
      state.staff.forEach(staff => {
        if (staff.offPref !== 'none' && parseInt(staff.offPref, 10) === dayOfWeek) {
          state.schedules[`${staff.id}_${dateIso}`] = { shiftId: 'shift_off', otHours: 0 };
        }
      });

      // 2. For each work shift, assign staff
      workShifts.forEach(shift => {
        const needed = shift.targetStaff || 1;
        let assigned = 0;

        // Candidate filtering
        const candidates = state.staff.filter(staff => {
          const key = `${staff.id}_${dateIso}`;
          if (state.schedules[key]) return false; // Already assigned or off
          if (workingToday.has(staff.id)) return false;

          // Check role restrictions
          const restricted = state.roleRestrictions.some(r => r.role === staff.role && r.shiftId === shift.id);
          if (restricted) return false;

          // Check anti-pair conflict
          const conflict = state.antiPairs.some(pair => {
            if (pair[0] === staff.id && workingToday.has(pair[1])) return true;
            if (pair[1] === staff.id && workingToday.has(pair[0])) return true;
            return false;
          });
          if (conflict) return false;

          return true;
        });

        // Sort by fairness
        candidates.sort((a, b) => {
          const countA = shiftCountMap[a.id][shift.id] || 0;
          const countB = shiftCountMap[b.id][shift.id] || 0;
          return countA - countB;
        });

        for (let i = 0; i < needed && i < candidates.length; i++) {
          const chosen = candidates[i];
          state.schedules[`${chosen.id}_${dateIso}`] = { shiftId: shift.id, otHours: 0 };
          workingToday.add(chosen.id);
          shiftCountMap[chosen.id][shift.id] = (shiftCountMap[chosen.id][shift.id] || 0) + 1;
          assigned++;
        }
      });

      // 3. For any remaining unassigned staff on this day, assign off if needed
      state.staff.forEach(staff => {
        const key = `${staff.id}_${dateIso}`;
        if (!state.schedules[key]) {
          state.schedules[key] = { shiftId: 'shift_off', otHours: 0 };
        }
      });
    });

    saveState();
    renderAll();
    showToast('✨ 智慧自動排班已完成！已遵循搭檔互斥、職位限制與平均分配。', 'success');
  }

  // ==========================================================================
  // Staff Modal Management
  // ==========================================================================
  function renderStaffModalList() {
    const listEl = document.getElementById('staff-entity-list');
    const badgeEl = document.getElementById('staff-count-badge');
    if (badgeEl) badgeEl.textContent = state.staff.length;
    if (!listEl) return;

    listEl.innerHTML = '';
    state.staff.forEach(staff => {
      const item = document.createElement('div');
      item.className = 'entity-item';

      const offMap = { 'none': '無偏好', '0': '週日', '1': '週一', '2': '週二', '3': '週三', '4': '週四', '5': '週五', '6': '週六' };
      const offText = offMap[staff.offPref] || '無偏好';

      item.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <div class="staff-avatar" style="background:${staff.color};width:34px;height:34px;font-size:0.85rem;">
            ${staff.name.slice(0, 1)}
          </div>
          <div>
            <div style="font-weight:700;font-size:0.9rem;color:var(--text-primary);">
              ${escapeHtml(staff.name)}
              <span class="staff-role-badge">${escapeHtml(staff.role)}</span>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);">
              時薪 NT$${staff.wage} ・ 週基準 ${staff.maxHours}h ・ 應休 ${staff.leaveQuota || 8}天 ・ 偏好休 ${offText}
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
          renderStaffModalList();
          showToast(`已移除員工：${staff.name}`, 'warning');
        }
      });

      listEl.appendChild(item);
    });
  }

  function renderRolesManagementUI() {
    const listEl = document.getElementById('roles-chips-list');
    const selectEl = document.getElementById('staff-role');

    if (selectEl) {
      selectEl.innerHTML = '';
      state.roles.forEach(role => {
        const opt = document.createElement('option');
        opt.value = role;
        opt.textContent = role;
        selectEl.appendChild(opt);
      });
    }

    if (listEl) {
      listEl.innerHTML = '';
      state.roles.forEach(role => {
        const chip = document.createElement('div');
        chip.className = 'role-chip';
        chip.innerHTML = `
          <span>${escapeHtml(role)}</span>
          ${DEFAULT_ROLES.includes(role) ? '' : `<button type="button" class="btn-del-role" data-role="${escapeHtml(role)}">&times;</button>`}
        `;

        const delBtn = chip.querySelector('.btn-del-role');
        if (delBtn) {
          delBtn.addEventListener('click', () => {
            state.roles = state.roles.filter(r => r !== role);
            saveState();
            renderRolesManagementUI();
            showToast(`已刪除職能角色：${role}`, 'info');
          });
        }

        listEl.appendChild(chip);
      });
    }
  }

  function addCustomRole(newRoleName) {
    const trimmed = (newRoleName || '').trim();
    if (!trimmed) return;
    if (state.roles.includes(trimmed)) {
      showToast('此角色名稱已存在！', 'warning');
      return;
    }
    state.roles.push(trimmed);
    saveState();
    renderRolesManagementUI();
    showToast(`已成功新增角色：${trimmed}`, 'success');
  }

  // ==========================================================================
  // Shifts Modal Management (Simplified: Name, Code, EnCode, Color, Leave Flag)
  // ==========================================================================
  function renderShiftsModalList() {
    const listEl = document.getElementById('shifts-entity-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    state.shifts.forEach(shift => {
      const item = document.createElement('div');
      item.className = 'entity-item';

      const leaveTag = shift.isLeave ? '<span style="font-size:0.7rem;background:rgba(245,158,11,0.2);color:#f59e0b;padding:1px 5px;border-radius:4px;margin-left:4px;">假別</span>' : '';

      item.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <div style="width:16px;height:16px;border-radius:4px;background:${shift.color};box-shadow:0 0 4px ${shift.color}80;"></div>
          <div>
            <div style="font-weight:700;font-size:0.9rem;color:var(--text-primary);">
              ${escapeHtml(shift.name)} [${shift.code}] / EN: [${shift.enCode || shift.code}] ${leaveTag}
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
            renderShiftsModalList();
            showToast(`已刪除班別：${shift.name}`, 'warning');
          }
        });
      }

      listEl.appendChild(item);
    });
  }

  // ==========================================================================
  // Fully Tailored Two-Tier EXCEL Exporter
  // Supports:
  // - English / Chinese Shift code options
  // - Color toggle
  // - A1~P1 & A12~P12 customizable headers (no merge if empty)
  // - Custom A2, A3, A13, A14 labels
  // - Date format (0901, 9/1, 1)
  // - Weekday format (週一, 星期一, 一)
  // - Staff format (name only, name + role)
  // ==========================================================================
  function doExportCustomExcel() {
    const year = state.periodStart.getFullYear();
    const month = state.periodStart.getMonth(); // 0-indexed
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    if (state.staff.length === 0) {
      showToast('名冊內無員工資料，無法匯出排班表！', 'warning');
      return;
    }

    // Read export settings from Modal
    const langOpt = document.getElementById('excel-lang') ? document.getElementById('excel-lang').value : 'zh';
    const showColor = document.getElementById('excel-show-color') ? document.getElementById('excel-show-color').checked : true;
    const staffFormat = document.getElementById('excel-staff-format') ? document.getElementById('excel-staff-format').value : 'name-only';
    const dateFormat = document.getElementById('excel-date-format') ? document.getElementById('excel-date-format').value : 'num';
    const weekFormat = document.getElementById('excel-week-format') ? document.getElementById('excel-week-format').value : 'full';

    const titleTopInput = document.getElementById('excel-title-top') ? document.getElementById('excel-title-top').value.trim() : '';
    const titleBottomInput = document.getElementById('excel-title-bottom') ? document.getElementById('excel-title-bottom').value.trim() : '';

    const headerA2 = document.getElementById('excel-header-a2') ? document.getElementById('excel-header-a2').value : '員工 \\ 日期';
    const headerA3 = document.getElementById('excel-header-a3') ? document.getElementById('excel-header-a3').value : '星期';
    const headerA13 = document.getElementById('excel-header-a13') ? document.getElementById('excel-header-a13').value : '員工 \\ 日期';
    const headerA14 = document.getElementById('excel-header-a14') ? document.getElementById('excel-header-a14').value : '星期';

    // Helper: format date label
    function getDayLabel(d) {
      const dayNum = d.getDate();
      const m = d.getMonth() + 1;
      if (dateFormat === 'mmdd') {
        const mm = String(m).padStart(2, '0');
        const dd = String(dayNum).padStart(2, '0');
        return `${mm}${dd}`;
      } else if (dateFormat === 'slash') {
        return `${m}/${dayNum}`;
      }
      return `${dayNum}號`;
    }

    // Helper: format weekday label
    function getWeekLabel(d) {
      const idx = d.getDay();
      if (weekFormat === 'short') return DAY_NAMES_ZH[idx]; // 週一
      if (weekFormat === 'char') return DAY_NAMES_SHORT_ZH[idx]; // 一
      return DAY_NAMES_FULL_ZH[idx]; // 星期一
    }

    // Helper: format staff label
    function getStaffLabel(staff) {
      if (staffFormat === 'name-role') {
        return `${staff.name} (${staff.role})`;
      }
      return staff.name;
    }

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>${year}年${month + 1}月排班總表</x:Name>
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
    th, td { border: 0.5pt solid #999999; text-align: center; vertical-align: middle; padding: 6px 4px; font-size: 11pt; }
    .title-row { background-color: #312e81; color: #ffffff; font-weight: bold; font-size: 13pt; height: 36px; }
    .header-date { background-color: #4338ca; color: #ffffff; font-weight: bold; }
    .header-week { background-color: #e0e7ff; color: #1e1b4b; font-weight: bold; }
    .staff-name-col { background-color: #f8fafc; font-weight: bold; text-align: left; padding-left: 10px; }
    .weekend { color: #dc2626; font-weight: bold; }
    .shift-cell { font-size: 10pt; font-weight: 600; }
    .empty-row-cell { border: 0.5pt solid #cccccc; height: 24px; background-color: #ffffff; }
    .empty-separator { border: none; height: 26px; background-color: #ffffff; }
  </style>
</head>
<body>
<table>`;

    // ========================================================================
    // Section 1: Days 1 to 15 (上半月)
    // ========================================================================
    // Row 1: Top Title (If blank, do not merge cells!)
    if (titleTopInput) {
      html += `<tr><th colspan="16" class="title-row">${escapeHtml(titleTopInput)}</th></tr>`;
    } else {
      // 16 separate empty cells without merge
      html += `<tr>`;
      for (let c = 0; c < 16; c++) html += `<td class="empty-row-cell"></td>`;
      html += `</tr>`;
    }

    // Row 2: Date Row (A2 = custom, B2~P2 = 1~15)
    html += `<tr><th class="header-date">${escapeHtml(headerA2)}</th>`;
    for (let day = 1; day <= 15; day++) {
      const d = new Date(year, month, day);
      html += `<th class="header-date">${getDayLabel(d)}</th>`;
    }
    html += `</tr>`;

    // Row 3: Weekday Row (A3 = custom, B3~P3 = Weekdays)
    html += `<tr><th class="header-week">${escapeHtml(headerA3)}</th>`;
    for (let day = 1; day <= 15; day++) {
      const d = new Date(year, month, day);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      html += `<th class="header-week ${isWeekend ? 'weekend' : ''}">${getWeekLabel(d)}</th>`;
    }
    html += `</tr>`;

    // Rows: Staff Shifts (上半月)
    state.staff.forEach(staff => {
      html += `<tr><td class="staff-name-col">${escapeHtml(getStaffLabel(staff))}</td>`;
      for (let day = 1; day <= 15; day++) {
        const d = new Date(year, month, day);
        const dateIso = formatDateIso(d);
        const entry = getScheduleEntry(staff.id, dateIso);
        const shift = entry && entry.shiftId ? state.shifts.find(s => s.id === entry.shiftId) : null;

        if (shift) {
          const shiftText = langOpt === 'en'
            ? (shift.enCode || shift.code || shift.name)
            : `${shift.name} [${shift.code}]`;
          const otText = entry.otHours > 0 ? ` (+${entry.otHours}h)` : '';

          let bgStyle = '';
          if (showColor) {
            const isOff = shift.isLeave || shift.hours === 0;
            bgStyle = isOff
              ? 'background-color:#f1f5f9;color:#64748b;'
              : `background-color:${shift.color}25;color:${shift.color};font-weight:bold;`;
          }
          html += `<td class="shift-cell" style="${bgStyle}">${escapeHtml(shiftText + otText)}</td>`;
        } else {
          html += `<td class="shift-cell" style="color:#94a3b8;">-</td>`;
        }
      }
      html += `</tr>`;
    });

    // Separator Row
    html += `<tr><td colspan="16" class="empty-separator"></td></tr>`;

    // ========================================================================
    // Section 2: Days 16 to End of Month (下半月)
    // ========================================================================
    if (titleBottomInput) {
      html += `<tr><th colspan="16" class="title-row">${escapeHtml(titleBottomInput)}</th></tr>`;
    } else {
      // 16 separate empty cells without merge
      html += `<tr>`;
      for (let c = 0; c < 16; c++) html += `<td class="empty-row-cell"></td>`;
      html += `</tr>`;
    }

    // Date Row (A13 = custom, B13~P13 = 16~30/31)
    html += `<tr><th class="header-date">${escapeHtml(headerA13)}</th>`;
    for (let day = 16; day <= 30; day++) {
      if (day <= daysInMonth) {
        const d = new Date(year, month, day);
        html += `<th class="header-date">${getDayLabel(d)}</th>`;
      } else {
        html += `<th class="header-date" style="background-color:#64748b;">-</th>`;
      }
    }
    if (daysInMonth === 31) {
      const d = new Date(year, month, 31);
      html += `<th class="header-date">${getDayLabel(d)}</th>`;
    } else {
      html += `<th class="header-date" style="background-color:#64748b;">-</th>`;
    }
    html += `</tr>`;

    // Weekday Row (A14 = custom, B14~P14 = Weekdays)
    html += `<tr><th class="header-week">${escapeHtml(headerA14)}</th>`;
    for (let day = 16; day <= 30; day++) {
      if (day <= daysInMonth) {
        const d = new Date(year, month, day);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        html += `<th class="header-week ${isWeekend ? 'weekend' : ''}">${getWeekLabel(d)}</th>`;
      } else {
        html += `<th class="header-week" style="color:#94a3b8;">-</th>`;
      }
    }
    if (daysInMonth === 31) {
      const d = new Date(year, month, 31);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      html += `<th class="header-week ${isWeekend ? 'weekend' : ''}">${getWeekLabel(d)}</th>`;
    } else {
      html += `<th class="header-week" style="color:#94a3b8;">-</th>`;
    }
    html += `</tr>`;

    // Staff Shift Rows (下半月)
    state.staff.forEach(staff => {
      html += `<tr><td class="staff-name-col">${escapeHtml(getStaffLabel(staff))}</td>`;
      for (let day = 16; day <= 30; day++) {
        if (day <= daysInMonth) {
          const d = new Date(year, month, day);
          const dateIso = formatDateIso(d);
          const entry = getScheduleEntry(staff.id, dateIso);
          const shift = entry && entry.shiftId ? state.shifts.find(s => s.id === entry.shiftId) : null;

          if (shift) {
            const shiftText = langOpt === 'en'
              ? (shift.enCode || shift.code || shift.name)
              : `${shift.name} [${shift.code}]`;
            const otText = entry.otHours > 0 ? ` (+${entry.otHours}h)` : '';

            let bgStyle = '';
            if (showColor) {
              const isOff = shift.isLeave || shift.hours === 0;
              bgStyle = isOff
                ? 'background-color:#f1f5f9;color:#64748b;'
                : `background-color:${shift.color}25;color:${shift.color};font-weight:bold;`;
            }
            html += `<td class="shift-cell" style="${bgStyle}">${escapeHtml(shiftText + otText)}</td>`;
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
        const entry = getScheduleEntry(staff.id, dateIso);
        const shift = entry && entry.shiftId ? state.shifts.find(s => s.id === entry.shiftId) : null;

        if (shift) {
          const shiftText = langOpt === 'en'
            ? (shift.enCode || shift.code || shift.name)
            : `${shift.name} [${shift.code}]`;
          const otText = entry.otHours > 0 ? ` (+${entry.otHours}h)` : '';

          let bgStyle = '';
          if (showColor) {
            const isOff = shift.isLeave || shift.hours === 0;
            bgStyle = isOff
              ? 'background-color:#f1f5f9;color:#64748b;'
              : `background-color:${shift.color}25;color:${shift.color};font-weight:bold;`;
          }
          html += `<td class="shift-cell" style="${bgStyle}">${escapeHtml(shiftText + otText)}</td>`;
        } else {
          html += `<td class="shift-cell" style="color:#94a3b8;">-</td>`;
        }
      } else {
        html += `<td class="shift-cell" style="background-color:#f8fafc;color:#cbd5e1;">-</td>`;
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

    if (elExcelModal) elExcelModal.classList.remove('open');
    showToast(`📊 已成功匯出自訂雙段式 EXCEL 檔案 (${year}年${month + 1}月)！`, 'success');
  }

  // ==========================================================================
  // Toast & Notifications
  // ==========================================================================
  function showToast(message, type = 'success') {
    if (!elToastContainer) return;
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
  // Event Listeners & Binding (Safe null-checked)
  // ==========================================================================
  function setupEventListeners() {
    // 1. Table View Language Display Toggle
    if (elBtnToggleShiftLangTable) {
      elBtnToggleShiftLangTable.addEventListener('click', toggleShiftDisplayLang);
    }

    // 2. Period Mode Change
    if (elPeriodModeSelect) {
      elPeriodModeSelect.addEventListener('change', (e) => {
        state.periodMode = e.target.value;
        saveState();

        if (state.periodMode === 'custom') {
          if (elCustomDateContainer) elCustomDateContainer.style.display = 'flex';
        } else {
          if (elCustomDateContainer) elCustomDateContainer.style.display = 'none';
          const range = calculatePeriodRange(state.periodMode, new Date());
          state.periodStart = range.start;
          state.periodEnd = range.end;
          if (elInputPeriodStart) elInputPeriodStart.value = formatDateIso(state.periodStart);
          if (elInputPeriodEnd) elInputPeriodEnd.value = formatDateIso(state.periodEnd);
          findAndSelectToday();
          renderAll();
        }
      });
    }

    // Custom Date Apply
    if (elBtnApplyCustomDates) {
      elBtnApplyCustomDates.addEventListener('click', () => {
        const sVal = elInputPeriodStart ? elInputPeriodStart.value : '';
        const eVal = elInputPeriodEnd ? elInputPeriodEnd.value : '';
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
    }

    // Prev / Next / Current Period
    const btnPrev = document.getElementById('btn-prev-period');
    const btnNext = document.getElementById('btn-next-period');
    const btnCurrent = document.getElementById('btn-current-period');

    if (btnPrev) btnPrev.addEventListener('click', () => shiftPeriod(-1));
    if (btnNext) btnNext.addEventListener('click', () => shiftPeriod(1));
    if (btnCurrent) {
      btnCurrent.addEventListener('click', () => {
        const range = calculatePeriodRange(state.periodMode, new Date());
        state.periodStart = range.start;
        state.periodEnd = range.end;
        if (elInputPeriodStart) elInputPeriodStart.value = formatDateIso(state.periodStart);
        if (elInputPeriodEnd) elInputPeriodEnd.value = formatDateIso(state.periodEnd);
        findAndSelectToday();
        renderAll();
      });
    }

    // View toggling
    const btnViewDay = document.getElementById('view-toggle-day');
    const btnViewStaff = document.getElementById('view-toggle-staff');
    const btnViewWeek = document.getElementById('view-toggle-week');

    if (btnViewDay) {
      btnViewDay.addEventListener('click', () => {
        state.currentView = 'day';
        renderActiveView();
        showToast('📱 已切換為手機單日排班卡片', 'info');
      });
    }
    if (btnViewStaff) {
      btnViewStaff.addEventListener('click', () => {
        state.currentView = 'staff';
        renderActiveView();
        showToast('👤 已切換為人員週期卡模式', 'info');
      });
    }
    if (btnViewWeek) {
      btnViewWeek.addEventListener('click', () => {
        state.currentView = 'week';
        renderActiveView();
        showToast('🖥️ 已切換為完整總表格（微縮緊湊排版）', 'info');
      });
    }

    // Clear Period
    const btnClearWeek = document.getElementById('btn-clear-week');
    if (btnClearWeek) {
      btnClearWeek.addEventListener('click', () => {
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
    }

    // Reset Demo Data
    const btnResetDemo = document.getElementById('btn-reset-demo');
    if (btnResetDemo) {
      btnResetDemo.addEventListener('click', () => {
        if (confirm('確定要重設為系統預設的示範資料嗎？這將覆蓋現有排班。')) {
          initDefaultDemoData();
          renderAll();
          showToast('已還原為示範範本！', 'success');
        }
      });
    }

    // Auto-Schedule buttons
    const btnAutoSched = document.getElementById('btn-auto-schedule');
    const mBtnAutoSched = document.getElementById('m-btn-auto-schedule');
    if (btnAutoSched) btnAutoSched.addEventListener('click', runAutoScheduler);
    if (mBtnAutoSched) mBtnAutoSched.addEventListener('click', runAutoScheduler);

    // Auto-Schedule Rules Modal buttons
    const btnOpenAutoRules = document.getElementById('btn-open-auto-rules');
    if (btnOpenAutoRules) btnOpenAutoRules.addEventListener('click', openAutoRulesModal);

    const btnRunFromModal = document.getElementById('btn-run-auto-schedule-from-modal');
    if (btnRunFromModal) {
      btnRunFromModal.addEventListener('click', () => {
        if (elAutoRulesModal) elAutoRulesModal.classList.remove('open');
        runAutoScheduler();
      });
    }

    // Add Anti-Pair rule
    const btnAddAntiPair = document.getElementById('btn-add-antipair');
    if (btnAddAntiPair) {
      btnAddAntiPair.addEventListener('click', () => {
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
    }

    // Add Role Restriction
    const btnAddRoleRestrict = document.getElementById('btn-add-role-restrict');
    if (btnAddRoleRestrict) {
      btnAddRoleRestrict.addEventListener('click', () => {
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
    }

    // KPI Card Click Handlers
    if (elCardHours) elCardHours.addEventListener('click', openHoursModal);
    if (elCardLeaves) elCardLeaves.addEventListener('click', openLeavesModal);
    if (elCardCost) elCardCost.addEventListener('click', openCostModal);
    if (elCardAlert) elCardAlert.addEventListener('click', () => openRulesModal('violations'));

    const mBtnRules = document.getElementById('m-btn-rules');
    if (mBtnRules) mBtnRules.addEventListener('click', () => openRulesModal('violations'));

    // Rules Modal Tabs
    const tabViolations = document.getElementById('tab-btn-violations');
    const tabSettings = document.getElementById('tab-btn-rules-settings');
    const tabHeadcount = document.getElementById('tab-btn-headcount-rules');

    if (tabViolations) tabViolations.addEventListener('click', () => switchRulesTab('violations'));
    if (tabSettings) tabSettings.addEventListener('click', () => switchRulesTab('settings'));
    if (tabHeadcount) tabHeadcount.addEventListener('click', () => switchRulesTab('headcount'));

    // Save Rules Settings Form
    const formRulesSettings = document.getElementById('form-rules-settings');
    if (formRulesSettings) {
      formRulesSettings.addEventListener('submit', (e) => {
        e.preventDefault();
        const maxShifts = parseInt(document.getElementById('rule-max-shifts-day').value, 10) || 1;
        const maxConsecutive = parseInt(document.getElementById('rule-max-consecutive-days').value, 10) || 6;
        const maxDailyHours = parseFloat(document.getElementById('rule-max-daily-hours').value) || 12;

        state.rules.maxDailyShifts = maxShifts;
        state.rules.maxConsecutiveDays = maxConsecutive;
        state.rules.maxDailyHours = maxDailyHours;

        saveState();
        renderAll();
        switchRulesTab('violations');
        showToast('✅ 法規規則設定已成功儲存！', 'success');
      });
    }

    // Headcount Rules Save & Add Custom Date
    const btnSaveHeadcount = document.getElementById('btn-save-headcount-rules');
    if (btnSaveHeadcount) {
      btnSaveHeadcount.addEventListener('click', () => {
        const wk = parseInt(document.getElementById('rule-weekday-headcount').value, 10) || 3;
        const hol = parseInt(document.getElementById('rule-holiday-headcount').value, 10) || 2;
        state.rules.headcount = state.rules.headcount || { weekdayMin: 3, weekendMin: 2, customDates: [] };
        state.rules.headcount.weekdayMin = wk;
        state.rules.headcount.weekendMin = hol;

        saveState();
        renderAll();
        showToast('✅ 執勤人力規則已儲存！', 'success');
      });
    }

    const btnAddCustomHeadcount = document.getElementById('btn-add-custom-headcount');
    if (btnAddCustomHeadcount) {
      btnAddCustomHeadcount.addEventListener('click', () => {
        const dateVal = document.getElementById('input-custom-headcount-date').value;
        const numVal = parseInt(document.getElementById('input-custom-headcount-num').value, 10) || 1;
        if (!dateVal) {
          showToast('請先選擇日期！', 'warning');
          return;
        }
        state.rules.headcount = state.rules.headcount || { weekdayMin: 3, weekendMin: 2, customDates: [] };
        state.rules.headcount.customDates = state.rules.headcount.customDates.filter(c => c.date !== dateVal);
        state.rules.headcount.customDates.push({ date: dateVal, min: numVal });
        saveState();
        renderHeadcountRulesUI();
        renderAll();
        showToast(`已新增 ${dateVal} 最低人力要求：${numVal} 人`, 'success');
      });
    }

    // One-Click Apply Leave Quota
    const btnApplyLeaveQuota = document.getElementById('btn-apply-leave-quota');
    if (btnApplyLeaveQuota) {
      btnApplyLeaveQuota.addEventListener('click', () => {
        const val = parseInt(document.getElementById('input-monthly-leave-quota').value, 10);
        if (isNaN(val) || val < 0) {
          showToast('請輸入有效的應休天數', 'warning');
          return;
        }
        state.staff.forEach(s => { s.leaveQuota = val; });
        saveState();
        renderLeavesModalUI();
        renderKPIDashboard();
        showToast(`已一鍵將全員本月應休天數設定為 ${val} 天！`, 'success');
      });
    }

    // Excel Export buttons (Opens options modal)
    const openExcelModal = () => {
      if (elExcelModal) {
        // Pre-fill default titles
        const year = state.periodStart.getFullYear();
        const month = state.periodStart.getMonth() + 1;
        const titleTop = document.getElementById('excel-title-top');
        const titleBottom = document.getElementById('excel-title-bottom');
        if (titleTop && !titleTop.value) {
          titleTop.value = `${year}年${month}月份員工排班總表（上半月：1 ~ 15 號）`;
        }
        if (titleBottom && !titleBottom.value) {
          titleBottom.value = `${year}年${month}月份員工排班總表（下半月）`;
        }
        elExcelModal.classList.add('open');
      }
    };

    const btnExportExcel = document.getElementById('btn-export-excel');
    const mBtnExport = document.getElementById('m-btn-export');
    if (btnExportExcel) btnExportExcel.addEventListener('click', openExcelModal);
    if (mBtnExport) mBtnExport.addEventListener('click', openExcelModal);

    const btnDoExportExcel = document.getElementById('btn-do-export-excel');
    if (btnDoExportExcel) btnDoExportExcel.addEventListener('click', doExportCustomExcel);

    // Print buttons (Desktop & Mobile)
    const btnPrint = document.getElementById('btn-print');
    const mBtnPrint = document.getElementById('m-btn-print');
    if (btnPrint) btnPrint.addEventListener('click', () => window.print());
    if (mBtnPrint) mBtnPrint.addEventListener('click', () => window.print());

    // Staff Modal
    const openStaffModal = () => {
      if (elStaffModal) {
        elStaffModal.classList.add('open');
        renderStaffModalList();
        renderRolesManagementUI();
      }
    };
    const btnOpenStaff = document.getElementById('btn-open-staff');
    const mBtnStaff = document.getElementById('m-btn-staff');
    if (btnOpenStaff) btnOpenStaff.addEventListener('click', openStaffModal);
    if (mBtnStaff) mBtnStaff.addEventListener('click', openStaffModal);

    // Add Custom Role Button
    const btnAddRole = document.getElementById('btn-add-role');
    if (btnAddRole) {
      btnAddRole.addEventListener('click', () => {
        const input = document.getElementById('input-new-role');
        if (input) {
          addCustomRole(input.value);
          input.value = '';
        }
      });
    }

    // Shifts Modal
    const openShiftsModal = () => {
      if (elShiftsModal) {
        elShiftsModal.classList.add('open');
        renderShiftsModalList();
      }
    };
    const btnOpenShifts = document.getElementById('btn-open-shifts');
    const mBtnShifts = document.getElementById('m-btn-shifts');
    if (btnOpenShifts) btnOpenShifts.addEventListener('click', openShiftsModal);
    if (mBtnShifts) mBtnShifts.addEventListener('click', openShiftsModal);

    // Modal Close buttons
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.close;
        const target = document.getElementById(modalId);
        if (target) target.classList.remove('open');
      });
    });

    [elStaffModal, elShiftsModal, elRulesModal, elAutoRulesModal, elHoursModal, elCostModal, elLeavesModal, elExcelModal].forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) modal.classList.remove('open');
        });
      }
    });

    // Bottom Sheet Close & Action buttons
    if (elBtnCloseBottomSheet) elBtnCloseBottomSheet.addEventListener('click', closeBottomSheet);
    if (elBottomSheetBackdrop) {
      elBottomSheetBackdrop.addEventListener('click', (e) => {
        if (e.target === elBottomSheetBackdrop) closeBottomSheet();
      });
    }

    if (elBtnSheetSetOff) {
      elBtnSheetSetOff.addEventListener('click', () => {
        if (state.activeTarget) {
          assignShift(state.activeTarget.staffId, state.activeTarget.dateStr, 'shift_off', 0);
          closeBottomSheet();
        }
      });
    }

    if (elBtnSheetClear) {
      elBtnSheetClear.addEventListener('click', () => {
        if (state.activeTarget) {
          assignShift(state.activeTarget.staffId, state.activeTarget.dateStr, null, 0);
          closeBottomSheet();
        }
      });
    }

    // Add Staff Form Submit
    const formAddStaff = document.getElementById('form-add-staff');
    if (formAddStaff) {
      formAddStaff.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('staff-name').value.trim();
        const role = document.getElementById('staff-role').value;
        const wage = parseFloat(document.getElementById('staff-wage').value) || 200;
        const maxHours = parseFloat(document.getElementById('staff-max-hours').value) || 40;
        const color = document.getElementById('staff-color').value;
        const offPref = document.getElementById('staff-off-pref').value;

        if (!name) return;

        const newStaff = { id: `staff_${Date.now()}`, name, role, wage, maxHours, color, offPref, leaveQuota: 8 };
        state.staff.push(newStaff);
        saveState();
        renderAll();
        renderStaffModalList();
        showToast(`已成功新增同仁：${name}`, 'success');
        document.getElementById('staff-name').value = '';
      });
    }

    // Add Shift Form Submit (簡化：留中文名稱、中文代碼、英文代碼、假別標記)
    const formAddShift = document.getElementById('form-add-shift');
    if (formAddShift) {
      formAddShift.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('shift-name').value.trim();
        const code = document.getElementById('shift-code').value.trim();
        const enCode = document.getElementById('shift-en-code').value.trim() || code;
        const start = document.getElementById('shift-start').value;
        const end = document.getElementById('shift-end').value;
        const hours = parseFloat(document.getElementById('shift-hours').value) || 0;
        const color = document.getElementById('shift-color').value;
        const targetStaff = parseInt(document.getElementById('shift-target-staff').value, 10) || 1;
        const isLeave = document.getElementById('shift-is-leave') ? document.getElementById('shift-is-leave').checked : (hours === 0);

        if (!name || !code) return;

        const newShift = { id: `shift_${Date.now()}`, name, code, enCode, start, end, hours, color, targetStaff, isLeave };
        state.shifts.push(newShift);
        if (!isLeave && hours > 0) state.shiftFairness.push(newShift.id);
        saveState();
        renderAll();
        renderShiftsModalList();
        showToast(`已成功新增班別：${name} [${code}]`, 'success');
        document.getElementById('shift-name').value = '';
        document.getElementById('shift-code').value = '';
        document.getElementById('shift-en-code').value = '';
      });
    }

    // Desktop Popover Outside Click
    document.addEventListener('click', (e) => {
      if (elShiftPicker && elShiftPicker.style.display !== 'none' && !elShiftPicker.contains(e.target)) {
        closeShiftPicker();
      }
    });

    // Theme Toggle (Desktop & Mobile)
    const elThemeToggle = document.getElementById('btn-theme-toggle');
    const elThemeIcon = document.getElementById('theme-icon');
    const mBtnTheme = document.getElementById('m-btn-theme');
    const mThemeIcon = document.getElementById('m-theme-icon');

    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(THEME_KEY, theme);
      const iconSvg = theme === 'light'
        ? '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>'
        : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';

      if (elThemeIcon) elThemeIcon.innerHTML = iconSvg;
      if (mThemeIcon) mThemeIcon.innerHTML = iconSvg;
    }

    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(savedTheme);

    const toggleThemeAction = () => {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'light' ? 'dark' : 'light');
    };

    if (elThemeToggle) elThemeToggle.addEventListener('click', toggleThemeAction);
    if (mBtnTheme) mBtnTheme.addEventListener('click', toggleThemeAction);
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
