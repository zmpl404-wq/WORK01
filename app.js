/**
 * ShiftMaster Pro - Core Application Logic (Flex Period & Compact Mobile Table)
 * Modern, Dependency-free Web Scheduling System
 */

(function () {
  'use strict';

  // --- Storage & State Keys ---
  const STORAGE_KEY = 'shiftmaster_pro_v1';
  const THEME_KEY = 'shiftmaster_theme';

  // --- Default Shifts Configuration ---
  const DEFAULT_SHIFTS = [
    { id: 'shift_morning', name: '早班', code: '早', start: '08:00', end: '16:30', hours: 8, color: '#10b981', targetStaff: 2 },
    { id: 'shift_middle', name: '中班', code: '中', start: '12:00', end: '20:30', hours: 8, color: '#f59e0b', targetStaff: 1 },
    { id: 'shift_evening', name: '晚班', code: '晚', start: '16:00', end: '00:30', hours: 8, color: '#8b5cf6', targetStaff: 2 },
    { id: 'shift_night', name: '大夜班', code: '夜', start: '00:00', end: '08:30', hours: 8, color: '#3b82f6', targetStaff: 1 },
    { id: 'shift_parttime', name: '支援短班', code: '短', start: '18:00', end: '22:00', hours: 4, color: '#06b6d4', targetStaff: 1 },
    { id: 'shift_off', name: '例休 / 休假', code: '休', start: '-', end: '-', hours: 0, color: '#64748b', targetStaff: 0 }
  ];

  // --- Default Staff Roster ---
  const DEFAULT_STAFF = [
    { id: 'staff_1', name: '林雅婷', role: '店長', wage: 280, maxHours: 40, color: '#6366f1', offPref: '0' },
    { id: 'staff_2', name: '張志豪', role: '正職副店', wage: 230, maxHours: 40, color: '#10b981', offPref: '1' },
    { id: 'staff_3', name: '陳美玲', role: '正職同仁', wage: 210, maxHours: 40, color: '#ec4899', offPref: '2' },
    { id: 'staff_4', name: '王大明', role: '正職同仁', wage: 200, maxHours: 40, color: '#f59e0b', offPref: '3' },
    { id: 'staff_5', name: '許家豪', role: '兼職夥伴', wage: 195, maxHours: 28, color: '#06b6d4', offPref: '4' },
    { id: 'staff_6', name: '柯怡君', role: '兼職夥伴', wage: 195, maxHours: 24, color: '#a855f7', offPref: '5' },
    { id: 'staff_7', name: '黃冠宇', role: '計時工讀', wage: 190, maxHours: 20, color: '#14b8a6', offPref: 'none' }
  ];

  const DAY_NAMES_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  const DAY_NAMES_SHORT_ZH = ['日', '一', '二', '三', '四', '五', '六'];

  // --- App State ---
  let state = {
    staff: [],
    shifts: [],
    // Keyed by `${staffId}_${dateStr}` => shiftId
    schedules: {},
    // Flexible Period State
    periodMode: 'month', // '7days' | '14days' | 'month' | 'custom'
    periodStart: new Date(),
    periodEnd: new Date(),
    selectedDayIndex: 0,
    currentView: window.innerWidth <= 768 ? 'day' : 'day',
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

  // ==========================================================================
  // Flexible Period Helper Functions
  // ==========================================================================
  function calculatePeriodRange(mode, anchorDate) {
    const base = new Date(anchorDate);
    let start, end;

    if (mode === 'month') {
      start = new Date(base.getFullYear(), base.getMonth(), 1);
      end = new Date(base.getFullYear(), base.getMonth() + 1, 0); // Last day of month
    } else if (mode === '7days') {
      const day = base.getDay();
      const diff = base.getDate() - day + (day === 0 ? -6 : 1); // Monday
      start = new Date(base.setDate(diff));
      end = new Date(start);
      end.setDate(start.getDate() + 6); // Sunday
    } else if (mode === '14days') {
      const day = base.getDay();
      const diff = base.getDate() - day + (day === 0 ? -6 : 1); // Monday
      start = new Date(base.setDate(diff));
      end = new Date(start);
      end.setDate(start.getDate() + 13); // 14 days
    } else {
      // Keep existing custom dates
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

    // Limit maximum range to 90 days to prevent browser hanging on invalid input
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
      // Custom shift by duration
      const daysCount = Math.round((state.periodEnd - state.periodStart) / (1000 * 60 * 60 * 24)) + 1;
      state.periodStart.setDate(state.periodStart.getDate() + delta * daysCount);
      state.periodEnd.setDate(state.periodEnd.getDate() + delta * daysCount);
    }

    // Sync input values
    elInputPeriodStart.value = formatDateIso(state.periodStart);
    elInputPeriodEnd.value = formatDateIso(state.periodEnd);

    // Keep selectedDayIndex valid
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
        state.schedules = parsed.schedules || {};
        state.periodMode = parsed.periodMode || 'month';
      } else {
        initDefaultDemoData();
      }
    } catch (e) {
      console.warn('Failed to load state, loading defaults:', e);
      initDefaultDemoData();
    }

    // Initialize period dates
    const range = calculatePeriodRange(state.periodMode, new Date());
    state.periodStart = range.start;
    state.periodEnd = range.end;

    elPeriodModeSelect.value = state.periodMode;
    elInputPeriodStart.value = formatDateIso(state.periodStart);
    elInputPeriodEnd.value = formatDateIso(state.periodEnd);
    elCustomDateContainer.style.display = state.periodMode === 'custom' ? 'flex' : 'none';

    // Default select today if in range, otherwise first day
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
        schedules: state.schedules,
        periodMode: state.periodMode
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('LocalStorage save error:', e);
    }
  }

  function initDefaultDemoData() {
    state.staff = JSON.parse(JSON.stringify(DEFAULT_STAFF));
    state.shifts = JSON.parse(JSON.stringify(DEFAULT_SHIFTS));
    state.schedules = {};
    state.periodMode = 'month';

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
  // Calculations & Compliance
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

  function checkStaffViolations(staffId, periodDays) {
    const violations = [];
    const staff = state.staff.find(s => s.id === staffId);
    if (!staff) return violations;

    const totalHours = getStaffHoursForPeriod(staffId, periodDays);
    // Pro-rate maxHours based on period length (staff.maxHours is weekly / 7 days)
    const periodWeeks = periodDays.length / 7;
    const periodAllowedHours = Math.round(staff.maxHours * periodWeeks);

    if (totalHours > periodAllowedHours) {
      violations.push({
        type: 'overtime',
        message: `超過此週期工時基準：已排 ${totalHours}h（基準 ${periodAllowedHours}h）`
      });
    }

    // Check consecutive work days (>= 7 continuous days)
    let consecutiveCount = 0;
    let maxConsecutive = 0;
    periodDays.forEach(d => {
      const dateStr = formatDateIso(d);
      const shiftId = state.schedules[`${staffId}_${dateStr}`];
      const shift = shiftId ? state.shifts.find(s => s.id === shiftId) : null;
      if (shift && shift.hours > 0) {
        consecutiveCount++;
        if (consecutiveCount > maxConsecutive) maxConsecutive = consecutiveCount;
      } else {
        consecutiveCount = 0;
      }
    });

    if (maxConsecutive >= 7) {
      violations.push({
        type: 'consecutive',
        message: `連續出勤達 ${maxConsecutive} 天無休，有違反勞基法規定之虞`
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
  // Master Rendering Router
  // ==========================================================================
  function renderAll() {
    renderPeriodBadge();
    renderActiveView();
    renderAnalytics();
    renderLegend();
    renderStaffModalList();
    renderShiftsModalList();
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
    const todayIso = formatDateIso(new Date());
    elDateCarousel.innerHTML = '';

    days.forEach((d, idx) => {
      const dateIso = formatDateIso(d);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isSelected = idx === state.selectedDayIndex;
      const dayName = DAY_NAMES_ZH[d.getDay()];
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

    // Auto-scroll active chip into view smoothly
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
    const dayName = DAY_NAMES_ZH[selectedDate.getDay()];
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
          尚未建立員工名單，請點擊下方「人員」新增！
        </div>
      `;
      return;
    }

    state.staff.forEach(staff => {
      const card = document.createElement('div');
      card.className = 'mobile-staff-card';

      const key = `${staff.id}_${dateIso}`;
      const shiftId = state.schedules[key];
      const shift = shiftId ? state.shifts.find(s => s.id === shiftId) : null;

      const periodHours = getStaffHoursForPeriod(staff.id, days);
      const violations = checkStaffViolations(staff.id, days);
      const hasViolation = violations.length > 0;

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
          ${hasViolation ? `<span class="mobile-alert-tag" title="${violations.map(v => v.message).join('\n')}">⚠️ 警示</span>` : ''}
        </div>
      `;
      card.appendChild(topRow);

      const shiftBtn = document.createElement('button');
      shiftBtn.className = `mobile-shift-action-btn ${shift ? 'has-shift' : 'is-empty'}`;

      if (shift) {
        shiftBtn.style.backgroundColor = shift.color;
        shiftBtn.innerHTML = `
          <div class="mobile-shift-btn-left">
            <span class="mobile-shift-badge-code">${shift.code}</span>
            <span class="mobile-shift-btn-name">${shift.name}</span>
          </div>
          <div class="mobile-shift-btn-right">
            <span>${shift.start === '-' ? '休息' : shift.start + '-' + shift.end}</span>
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
        const dayName = DAY_NAMES_ZH[d.getDay()];
        const key = `${staff.id}_${dateIso}`;
        const shiftId = state.schedules[key];
        const shift = shiftId ? state.shifts.find(s => s.id === shiftId) : null;

        const pill = document.createElement('div');
        pill.className = 'staff-day-pill';
        if (shift) {
          pill.style.backgroundColor = shift.color;
          pill.style.borderColor = 'transparent';
          pill.innerHTML = `
            <span class="staff-day-pill-name" style="color:rgba(255,255,255,0.8);">${dayName.replace('週', '')}</span>
            <span class="staff-day-pill-code" style="color:#ffffff;">${shift.code}</span>
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
  // VIEW 3: Compact Schedule Table Mode (手機極致微縮排版)
  // ==========================================================================
  function renderTable() {
    const periodDays = getPeriodDays();
    const todayIso = formatDateIso(new Date());

    // 1. Table Header
    elTableHeader.innerHTML = `<th class="col-staff">姓名</th>`;
    periodDays.forEach(d => {
      const dateIso = formatDateIso(d);
      const isToday = dateIso === todayIso;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const dayNameShort = DAY_NAMES_SHORT_ZH[d.getDay()];
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

      const violations = checkStaffViolations(staff.id, periodDays);
      const hasViolation = violations.length > 0;

      periodDays.forEach(d => {
        const dateIso = formatDateIso(d);
        const dayName = DAY_NAMES_ZH[d.getDay()];
        const cellKey = `${staff.id}_${dateIso}`;
        const shiftId = state.schedules[cellKey];
        const shift = shiftId ? state.shifts.find(s => s.id === shiftId) : null;

        const td = document.createElement('td');
        const slot = document.createElement('div');
        slot.className = 'shift-slot';

        if (shift) {
          slot.innerHTML = `
            <div class="shift-pill" style="background:${shift.color};" title="${shift.name} ${shift.start}~${shift.end}">
              <div class="shift-pill-title">
                <span>${shift.code}</span>
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

        // On mobile: tap opens Bottom Sheet! On desktop: popover
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

    // 3. Table Footer (Daily headcount totals)
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

      chip.innerHTML = `
        <span class="shift-legend-color-dot" style="background:${shift.color};"></span>
        <span>${shift.name} (${shift.code})</span>
      `;
      elLegend.appendChild(chip);
    });
  }

  function renderAnalytics() {
    const periodDays = getPeriodDays();

    let totalHours = 0;
    let totalShifts = 0;
    let totalCost = 0;
    let alertCount = 0;
    const alertDetails = [];

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

      const violations = checkStaffViolations(staff.id, periodDays);
      if (violations.length > 0) {
        alertCount += violations.length;
        violations.forEach(v => alertDetails.push(`${staff.name}: ${v.message}`));
      }
    });

    const avgHours = state.staff.length > 0 ? (totalHours / state.staff.length).toFixed(1) : 0;
    elStatHours.innerHTML = `${totalHours} <span style="font-size:0.85rem;font-weight:500;">小時</span>`;
    elStatAvgHours.textContent = `人均工時：${avgHours} 小時 / 期`;

    elStatShifts.innerHTML = `${totalShifts} <span style="font-size:0.85rem;font-weight:500;">班次</span>`;
    const coverageRate = Math.min(Math.round((totalShifts / (periodDays.length * 4)) * 100), 100);
    elStatCoverage.textContent = `在崗覆蓋率：${coverageRate}%`;

    elStatCost.textContent = `NT$ ${totalCost.toLocaleString()}`;

    if (alertCount > 0) {
      elStatAlertCount.innerHTML = `<span style="color:var(--accent-danger);">${alertCount}</span> <span style="font-size:0.85rem;font-weight:500;">項異常</span>`;
      elStatAlertDesc.textContent = alertDetails[0] || '工時超時或連續出勤警告';
    } else {
      elStatAlertCount.innerHTML = `<span style="color:var(--accent-success);">0</span> <span style="font-size:0.85rem;font-weight:500;">項異常</span>`;
      elStatAlertDesc.textContent = '工時合規・無排班衝突';
    }
  }

  // ==========================================================================
  // Mobile Bottom Sheet
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
      item.innerHTML = `
        <div class="drawer-shift-title">
          <span style="padding:0.1rem 0.45rem;background:rgba(0,0,0,0.25);border-radius:4px;font-size:0.85rem;">${shift.code}</span>
          <span>${shift.name}</span>
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
      item.innerHTML = `
        <span style="display:flex;align-items:center;gap:0.4rem;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${shift.color};"></span>
          <span>${shift.name}</span>
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
  // Smart Auto-Scheduler (Supports Arbitrary Period Length)
  // ==========================================================================
  function runAutoScheduler() {
    if (state.staff.length === 0) {
      showToast('請先新增員工後再進行自動排班！', 'warning');
      return;
    }

    const periodDays = getPeriodDays();
    const staffHoursTracker = {};
    const staffConsecutiveWork = {};
    state.staff.forEach(s => {
      staffHoursTracker[s.id] = 0;
      staffConsecutiveWork[s.id] = 0;
    });

    const workShifts = state.shifts.filter(s => s.id !== 'shift_off' && s.hours > 0);
    if (workShifts.length === 0) {
      showToast('請先建立可出勤之班別範本！', 'warning');
      return;
    }

    const periodWeeks = periodDays.length / 7;

    periodDays.forEach(d => {
      const dateStr = formatDateIso(d);
      const dayOfWeek = String(d.getDay());

      const availableStaff = state.staff.filter(s => {
        if (s.offPref === dayOfWeek) return false;
        const allowed = Math.round(s.maxHours * periodWeeks);
        if (staffHoursTracker[s.id] >= allowed) return false;
        if (staffConsecutiveWork[s.id] >= 6) return false;
        return true;
      });

      availableStaff.sort((a, b) => {
        const allowedA = Math.round(a.maxHours * periodWeeks);
        const allowedB = Math.round(b.maxHours * periodWeeks);
        const remA = allowedA - staffHoursTracker[a.id];
        const remB = allowedB - staffHoursTracker[b.id];
        return remB - remA;
      });

      let staffPointer = 0;
      workShifts.forEach(shift => {
        const need = shift.targetStaff || 1;
        for (let i = 0; i < need; i++) {
          if (staffPointer < availableStaff.length) {
            const chosenStaff = availableStaff[staffPointer];
            const allowed = Math.round(chosenStaff.maxHours * periodWeeks);
            if (staffHoursTracker[chosenStaff.id] + shift.hours <= allowed + 4) {
              state.schedules[`${chosenStaff.id}_${dateStr}`] = shift.id;
              staffHoursTracker[chosenStaff.id] += shift.hours;
              staffConsecutiveWork[chosenStaff.id] += 1;
              staffPointer++;
            }
          }
        }
      });

      state.staff.forEach(s => {
        const key = `${s.id}_${dateStr}`;
        if (!state.schedules[key]) {
          state.schedules[key] = 'shift_off';
          staffConsecutiveWork[s.id] = 0;
        }
      });
    });

    saveState();
    renderAll();
    showToast(`✨ 智慧排班完成！已依據 ${periodDays.length} 天週期均衡分配`, 'success');
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
  // Shift Modal Management
  // ==========================================================================
  function renderShiftsModalList() {
    const listEl = document.getElementById('shifts-entity-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    state.shifts.forEach(shift => {
      const item = document.createElement('div');
      item.className = 'entity-item';

      item.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <div style="width:14px;height:14px;border-radius:4px;background:${shift.color};"></div>
          <div>
            <div style="font-weight:700;font-size:0.9rem;color:var(--text-primary);">
              ${escapeHtml(shift.name)} (${shift.code})
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
  // CSV Export Engine
  // ==========================================================================
  function exportScheduleToCSV() {
    const periodDays = getPeriodDays();
    let csv = '\uFEFF';

    const headers = ['員工姓名', '職稱', '時薪', '每週工時基準'];
    periodDays.forEach(d => {
      headers.push(`${DAY_NAMES_ZH[d.getDay()]} (${d.getMonth() + 1}/${d.getDate()})`);
    });
    headers.push('當期總工時', '預估薪資支出');
    csv += headers.map(h => `"${h}"`).join(',') + '\r\n';

    state.staff.forEach(staff => {
      const hours = getStaffHoursForPeriod(staff.id, periodDays);
      const cost = hours * (staff.wage || 0);

      const row = [
        staff.name,
        staff.role,
        `NT$ ${staff.wage}`,
        `${staff.maxHours} 小時`
      ];

      periodDays.forEach(d => {
        const dateIso = formatDateIso(d);
        const shiftId = state.schedules[`${staff.id}_${dateIso}`];
        if (shiftId) {
          const shift = state.shifts.find(s => s.id === shiftId);
          row.push(shift ? `${shift.name} (${shift.hours}h)` : '-');
        } else {
          row.push('未排班');
        }
      });

      row.push(`${hours} 小時`, `NT$ ${cost}`);
      csv += row.map(r => `"${r}"`).join(',') + '\r\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const startStr = formatDateIso(periodDays[0]);
    a.href = url;
    a.download = `ShiftMaster_班表_${startStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('已成功匯出班表為 Excel/CSV 檔案！', 'success');
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
  // Event Listeners & Binding
  // ==========================================================================
  function setupEventListeners() {
    // Period Mode Change
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

    // Custom Date Apply Button
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
    document.getElementById('btn-prev-period').addEventListener('click', () => {
      shiftPeriod(-1);
    });

    document.getElementById('btn-next-period').addEventListener('click', () => {
      shiftPeriod(1);
    });

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

    // Smart Auto-Schedule
    document.getElementById('btn-auto-schedule').addEventListener('click', runAutoScheduler);
    document.getElementById('m-btn-auto-schedule').addEventListener('click', runAutoScheduler);

    // CSV Export
    document.getElementById('btn-export-csv').addEventListener('click', exportScheduleToCSV);
    document.getElementById('m-btn-export').addEventListener('click', exportScheduleToCSV);

    // Print
    document.getElementById('btn-print').addEventListener('click', () => {
      window.print();
    });

    // Staff Modal
    const openStaffModal = () => {
      elStaffModal.classList.add('open');
      renderStaffModalList();
    };
    document.getElementById('btn-open-staff').addEventListener('click', openStaffModal);
    document.getElementById('m-btn-staff').addEventListener('click', openStaffModal);

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

    [elStaffModal, elShiftsModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });
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

    // Add Shift Form
    document.getElementById('form-add-shift').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('shift-name').value.trim();
      const code = document.getElementById('shift-code').value.trim();
      const start = document.getElementById('shift-start').value;
      const end = document.getElementById('shift-end').value;
      const hours = parseFloat(document.getElementById('shift-hours').value) || 8;
      const color = document.getElementById('shift-color').value;
      const targetStaff = parseInt(document.getElementById('shift-target-staff').value, 10) || 1;

      if (!name || !code) return;

      const newShift = { id: `shift_${Date.now()}`, name, code, start, end, hours, color, targetStaff };
      state.shifts.push(newShift);
      saveState();
      renderAll();
      showToast(`已成功新增班別：${name}`, 'success');
      document.getElementById('shift-name').value = '';
      document.getElementById('shift-code').value = '';
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
