/**
 * ศูนย์ดวงใจกตัญญู — ไฟล์รวมสำหรับวางใน Apps Script (Code.gs)
 * สร้างจาก Config.gs, Db.gs, Services.gs, Line.gs, Setup.gs, WebApp.gs
 */

/* ======================= Config.gs ======================= */

/**
 * ศูนย์ดวงใจกตัญญู — การตั้งค่าหลักของระบบ
 * "ดูแลด้วยใจ ซื่อสัตย์ ปลอดภัย วางใจดั่งญาติสนิท"
 *
 * ค่าลับ (Token / PIN) ให้ตั้งใน Project Settings > Script Properties ไม่ใช่ในไฟล์นี้:
 *   ADMIN_PIN                  รหัสเข้าหน้าผู้จัดการศูนย์
 *   LINE_CHANNEL_ACCESS_TOKEN  Channel access token ของ LINE Official Account (Messaging API)
 *   LINE_CENTER_TARGET_ID      userId หรือ groupId ที่จะรับแจ้งเตือนของศูนย์
 *   SLIP_FOLDER_ID             (ไม่บังคับ) โฟลเดอร์ Google Drive สำหรับเก็บสลิป
 */

const CONFIG = {
  SPREADSHEET_ID: '10zdLwG_G4M7x7Bmd071pUFWoqBK1Nv_h3fp7Qir2HtY',
  TZ: 'Asia/Bangkok',
  TITLE_ROW: 1,
  DESC_ROW: 2,
  HEADER_ROW: 3,
  DATA_START_ROW: 4,

  CENTER_NAME: 'ศูนย์ดวงใจกตัญญู',
  SLOGAN: 'ดูแลด้วยใจ ซื่อสัตย์ ปลอดภัย วางใจดั่งญาติสนิท',

  MIN_LEAVE_NOTICE_DAYS: 7,
  // ส่งเฉพาะคนที่ผ่านการตรวจประวัติอาชญากรรมแล้วเท่านั้น
  REQUIRE_POLICE_CHECK: true,
  REMINDER_HOURS_BEFORE: 24,
};

const SHEET = {
  WORKERS: 'Workers',
  CLIENTS: 'Clients',
  SERVICES: 'Service_Catalog',
  JOBS: 'Job_Orders',
  PAYMENTS: 'Payments',
  LEAVES: 'Leave_Requests',
  DASHBOARD: 'Dashboard_Summary',
};

const STATUS = {
  WORKER: { READY: 'พร้อมรับงาน', BUSY: 'ติดเคส', ON_LEAVE: 'ลาพัก', RESIGNED: 'พ้นสภาพ' },
  POLICE: { PASSED: 'ผ่าน', PENDING: 'รอดำเนินการ', FAILED: 'ไม่ผ่าน' },
  PAYMENT: { PENDING: 'รอชำระ', PAID: 'ชำระแล้ว' },
  JOB: { PENDING: 'รอยืนยัน', ACTIVE: 'กำลังปฏิบัติงาน', DONE: 'เสร็จสิ้น', CANCELLED: 'ยกเลิก' },
  TRANS: { IN: 'รับจากลูกค้า', OUT: 'จ่ายให้คนทำงาน' },
  PAYOUT: { OK: 'เรียบร้อย', WAITING: 'รอโอน', TRANSFERRED: 'โอนแล้ว' },
  LEAVE: { APPROVED: 'อนุมัติแล้ว', PENDING: 'รอตรวจสอบ', REJECTED: 'ไม่อนุมัติ' },
  RULE: { OK: 'ผ่านเกณฑ์แจ้งล่วงหน้า 1 สัปดาห์', LATE: 'เตือน: แจ้งกะทันหันผิดสัญญา' },
};

const LATE_LEAVE_TAG = 'แจ้งลากะทันหัน ผิดเงื่อนไขสัญญา';

const OPTIONS = {
  skill_tags: ['เฝ้าไข้', 'ส่ง รพ.', 'ดูแลผู้ป่วย', 'ทำความสะอาด'],
  patient_condition: ['ช่วยตัวเองได้', 'นั่งรถเข็น', 'ติดเตียง'],
  unit_type: ['กะ', 'ครั้ง', 'วัน', 'เดือน'],
  police_check_status: Object.values(STATUS.POLICE),
  worker_status: Object.values(STATUS.WORKER),
  payment_status: Object.values(STATUS.PAYMENT),
  job_status: Object.values(STATUS.JOB),
  trans_type: Object.values(STATUS.TRANS),
  payout_status: Object.values(STATUS.PAYOUT),
  leave_status: Object.values(STATUS.LEAVE),
};

/**
 * โครงสร้างแผ่นงาน: [ชื่อฟิลด์ (แถว 3), คำอธิบายภาษาไทย (แถว 2)]
 * ฟิลด์ที่ติด extra: true เป็นคอลัมน์เสริมที่ระบบเพิ่มต่อท้ายให้ (ไม่กระทบสูตรเดิม)
 */
const SCHEMA = {
  [SHEET.WORKERS]: {
    title: 'ทะเบียนบุคลากร / ผู้รับจ้าง',
    idField: 'worker_id',
    idPrefix: 'WK-',
    fields: [
      ['worker_id', 'รหัสผู้รับจ้าง (เช่น WK-001)'],
      ['id_card_no', 'เลขบัตรประชาชน 13 หลัก'],
      ['full_name', 'ชื่อ-นามสกุล'],
      ['nickname', 'ชื่อเล่น'],
      ['phone_number', 'เบอร์โทรศัพท์ติดต่อ'],
      ['village_moo', 'ที่อยู่ / หมู่บ้าน / ตำบล'],
      ['skill_tags', 'ทักษะงานที่ทำได้'],
      ['has_car', 'มียานพาหนะส่วนตัว'],
      ['police_check_status', 'สถานะตรวจประวัติอาชญากรรม'],
      ['status', 'สถานะความพร้อมรับงาน'],
      ['contract_signed_date', 'วันที่เริ่มเซ็นสัญญา'],
      ['notes', 'หมายเหตุ / บุคคลรับรองในพื้นที่'],
      ['line_user_id', 'LINE User ID (ระบบเติมให้เมื่อลงทะเบียนผ่าน LINE)', { extra: true }],
    ],
  },
  [SHEET.CLIENTS]: {
    title: 'ทะเบียนผู้ว่าจ้างและผู้ป่วย',
    idField: 'client_id',
    idPrefix: 'CL-',
    fields: [
      ['client_id', 'รหัสผู้ว่าจ้าง (เช่น CL-001)'],
      ['client_name', 'ชื่อผู้ว่าจ้าง (คนจ่ายเงิน/ลูกหลาน)'],
      ['client_phone', 'เบอร์โทรศัพท์ผู้ว่าจ้าง'],
      ['patient_name', 'ชื่อผู้รับการดูแล (คนไข้/คนชรา)'],
      ['patient_condition', 'สภาพร่างกาย/การช่วยเหลือ'],
      ['medical_precautions', 'โรคประจำตัว / ข้อควรระวังทางการแพทย์'],
      ['address_location', 'ที่อยู่หน้างาน / จุดสังเกตในชุมชน'],
      ['created_date', 'วันที่เริ่มติดต่อขอรับบริการ'],
    ],
  },
  [SHEET.SERVICES]: {
    title: 'ตารางบริการและราคาเงินบาทตายตัว',
    idField: 'service_code',
    idPrefix: 'SRV-',
    idPad: 2,
    fields: [
      ['service_code', 'รหัสบริการ (เช่น SRV-01)'],
      ['service_name', 'ชื่อประเภทบริการและลักษณะงาน'],
      ['unit_type', 'หน่วยคิดบริการ'],
      ['client_price', 'ราคาเรียกเก็บจากลูกค้า (บาท)'],
      ['center_fee', 'ศูนย์หักค่าบริหารจัดการ (บาท)'],
      ['worker_wage', 'ผู้รับจ้างได้รับสุทธิ (บาท)'],
      ['required_skill', 'ทักษะที่ต้องมี (ตรงกับ skill_tags, คั่นด้วย ,)', { extra: true }],
      ['requires_car', 'ต้องใช้รถผู้รับจ้าง (TRUE/FALSE)', { extra: true }],
    ],
  },
  [SHEET.JOBS]: {
    title: 'บันทึกใบงานและการนัดหมาย',
    idField: 'job_id',
    idPrefix: 'JOB-',
    fields: [
      ['job_id', 'รหัสใบงาน (เช่น JOB-001)'],
      ['client_id', 'รหัสผู้ว่าจ้าง (จาก Clients)'],
      ['service_code', 'รหัสบริการ (จาก Service_Catalog)'],
      ['worker_id', 'รหัสผู้รับจ้างที่ไปทำ (จาก Workers)'],
      ['start_datetime', 'วันและเวลาเริ่มงาน'],
      ['end_datetime', 'วันและเวลาเสร็จงาน'],
      ['hospital_location', 'สถานที่ / โรงพยาบาล'],
      ['total_client_amount', 'ราคาเรียกเก็บลูกค้า (บาท)'],
      ['total_center_fee', 'ศูนย์หักค่าบริหาร (บาท)'],
      ['total_worker_wage', 'ค่าจ้างคนทำงานสุทธิ (บาท)'],
      ['payment_status', 'สถานะการเก็บเงินจากลูกค้า'],
      ['job_status', 'สถานะการปฏิบัติงาน'],
    ],
  },
  [SHEET.PAYMENTS]: {
    title: 'บันทึกการเงินและสลิป',
    idField: 'trans_id',
    idPrefix: 'TX-',
    fields: [
      ['trans_id', 'รหัสรายการโอน (เช่น TX-001)'],
      ['job_id', 'รหัสใบงานที่อ้างอิง'],
      ['trans_type', 'ประเภทรายการ'],
      ['amount', 'จำนวนเงิน (บาท)'],
      ['trans_datetime', 'วันและเวลาที่โอนเงิน'],
      ['slip_image_url', 'ลิงก์รูปสลิปหลักฐานการโอน'],
      ['payout_status', 'สถานะรายการ'],
    ],
  },
  [SHEET.LEAVES]: {
    title: 'ระบบตรวจสอบการลาล่วงหน้า 1 สัปดาห์',
    idField: 'leave_id',
    idPrefix: 'LV-',
    fields: [
      ['leave_id', 'รหัสใบลา (เช่น LV-001)'],
      ['worker_id', 'รหัสผู้รับจ้างที่ขอลา'],
      ['request_date', 'วันที่ยื่นเรื่องขอลา'],
      ['leave_start_date', 'วันที่เริ่มหยุดงาน'],
      ['leave_end_date', 'วันสุดท้ายที่หยุดงาน'],
      ['leave_reason', 'เหตุผลการลาหยุด'],
      ['notice_days', 'แจ้งล่วงหน้า (วัน)'],
      ['rule_check', 'ตรวจสอบกฎ 1 สัปดาห์ (7 วัน)'],
      ['substitute_worker_id', 'รหัสคนทำงานที่ส่งไปแทน'],
      ['status', 'สถานะการอนุมัติ'],
    ],
  },
};

function prop_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

/* ======================= Db.gs ======================= */

/**
 * ชั้นอ่าน/เขียน Google Sheets
 * - อ่านหัวคอลัมน์จากแถว 3 (ชื่อฟิลด์) ข้อมูลเริ่มแถว 4
 * - ไม่เขียนทับเซลล์ที่มีสูตร และไม่แตะคอลัมน์ที่ใช้ ARRAYFORMULA
 */

let ss_ = null;
const headerCache_ = {};
const arrayFormulaColsCache_ = {};

function ss() {
  if (!ss_) ss_ = CONFIG.SPREADSHEET_ID ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID) : SpreadsheetApp.getActive();
  return ss_;
}

function getSheet_(name) {
  const sh = ss().getSheetByName(name);
  if (!sh) throw new Error('ไม่พบแผ่นงาน "' + name + '" กรุณารันเมนู "ติดตั้ง/ตรวจสอบโครงสร้างแผ่นงาน" ก่อน');
  return sh;
}

function getHeaders_(sh) {
  const name = sh.getName();
  if (headerCache_[name]) return headerCache_[name];
  const lastCol = sh.getLastColumn();
  const headers = lastCol === 0 ? [] :
    sh.getRange(CONFIG.HEADER_ROW, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  headerCache_[name] = headers;
  return headers;
}

function resetCaches_() {
  Object.keys(headerCache_).forEach(k => delete headerCache_[k]);
  Object.keys(arrayFormulaColsCache_).forEach(k => delete arrayFormulaColsCache_[k]);
}

function getArrayFormulaCols_(sh) {
  const name = sh.getName();
  if (arrayFormulaColsCache_[name]) return arrayFormulaColsCache_[name];
  const lastCol = sh.getLastColumn();
  const cols = {};
  if (lastCol > 0) {
    const formulas = sh.getRange(CONFIG.HEADER_ROW, 1, CONFIG.DATA_START_ROW - CONFIG.HEADER_ROW + 1, lastCol).getFormulas();
    formulas.forEach(row => row.forEach((f, c) => { if (/ARRAYFORMULA/i.test(f)) cols[c] = true; }));
  }
  arrayFormulaColsCache_[name] = cols;
  return cols;
}

/** อ่านทั้งตารางเป็น array ของ object (ข้ามแถวที่ไม่มีรหัส) */
function readTable_(name) {
  const sh = getSheet_(name);
  const headers = getHeaders_(sh);
  const lastRow = sh.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW || !headers.length) return [];
  const values = sh.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.DATA_START_ROW + 1, headers.length).getValues();
  const keyIdx = headers.indexOf(SCHEMA[name].idField);
  const rows = [];
  values.forEach((r, i) => {
    if (keyIdx >= 0 && String(r[keyIdx]).trim() === '') return;
    const obj = { _row: CONFIG.DATA_START_ROW + i };
    headers.forEach((h, c) => { if (h) obj[h] = typeof r[c] === 'string' ? r[c].trim() : r[c]; });
    rows.push(obj);
  });
  return rows;
}

function findById_(name, id) {
  const key = SCHEMA[name].idField;
  const target = String(id || '').trim().toUpperCase();
  if (!target) return null;
  return readTable_(name).find(r => String(r[key]).trim().toUpperCase() === target) || null;
}

function nextId_(name, rows) {
  const schema = SCHEMA[name];
  const pad = schema.idPad || 3;
  let max = 0;
  (rows || readTable_(name)).forEach(r => {
    const m = String(r[schema.idField]).match(/(\d+)\s*$/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return schema.idPrefix + String(max + 1).padStart(pad, '0');
}

function insertRow_(name, obj) {
  const sh = getSheet_(name);
  const headers = getHeaders_(sh);
  const keyCol = headers.indexOf(SCHEMA[name].idField) + 1;
  if (keyCol < 1) throw new Error('แผ่นงาน ' + name + ' ไม่มีคอลัมน์ ' + SCHEMA[name].idField + ' ในแถวที่ ' + CONFIG.HEADER_ROW);
  const row = findFirstEmptyRow_(sh, keyCol);
  writeRow_(sh, headers, row, obj);
  return row;
}

function updateRow_(name, id, patch) {
  const existing = findById_(name, id);
  if (!existing) throw new Error('ไม่พบรหัส ' + id + ' ใน ' + name);
  const sh = getSheet_(name);
  writeRow_(sh, getHeaders_(sh), existing._row, patch);
  return Object.assign({}, existing, patch);
}

function findFirstEmptyRow_(sh, keyCol) {
  const lastRow = Math.max(sh.getLastRow(), CONFIG.DATA_START_ROW);
  const vals = sh.getRange(CONFIG.DATA_START_ROW, keyCol, lastRow - CONFIG.DATA_START_ROW + 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === '') return CONFIG.DATA_START_ROW + i;
  }
  return lastRow + 1;
}

/** เขียนทั้งแถวครั้งเดียว โดยคงสูตรเดิมไว้ */
function writeRow_(sh, headers, row, obj) {
  const range = sh.getRange(row, 1, 1, headers.length);
  const values = range.getValues()[0];
  const formulas = range.getFormulas()[0];
  const arrayCols = getArrayFormulaCols_(sh);
  const out = headers.map((h, c) => {
    if (formulas[c]) return formulas[c];
    if (arrayCols[c]) return values[c];
    if (h && Object.prototype.hasOwnProperty.call(obj, h) && h !== '_row') return obj[h];
    return values[c];
  });
  // เซลล์ใต้ ARRAYFORMULA ต้องว่างไว้ ไม่งั้นสูตรจะ #REF!
  const hasArray = Object.keys(arrayCols).length > 0;
  if (!hasArray) {
    range.setValues([out]);
  } else {
    headers.forEach((h, c) => {
      if (arrayCols[c] || formulas[c]) return;
      if (h && Object.prototype.hasOwnProperty.call(obj, h)) sh.getRange(row, c + 1).setValue(obj[h]);
    });
  }
}

/* ---------- แปลงค่า ---------- */

function toBool_(v) {
  if (v === true) return true;
  const s = String(v || '').trim().toLowerCase();
  return ['true', 'yes', 'y', '1', 'มี', 'มีรถ', '✓', '✔'].indexOf(s) >= 0;
}

function toNum_(v) {
  if (typeof v === 'number') return v;
  const n = Number(String(v || '').replace(/[,฿\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

function digits_(v) {
  return String(v || '').replace(/\D/g, '');
}

function isDate_(v) {
  return Object.prototype.toString.call(v) === "[object Date]";
}

/** รับ Date / "yyyy-MM-ddTHH:mm" / "yyyy-MM-dd" / "d/M/yyyy HH:mm" (รองรับปี พ.ศ.) */
function toDate_(v) {
  if (isDate_(v)) return isNaN(v.getTime()) ? null : v;
  const s = String(v || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/);
  if (m) return makeDate_(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})[:.](\d{2}))?/);
  if (m) return makeDate_(+m[3], +m[2], +m[1], +(m[4] || 0), +(m[5] || 0));
  return null;
}

function makeDate_(y, mo, d, h, mi) {
  if (y > 2400) y -= 543;
  const str = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0') + ' ' +
    String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
  return Utilities.parseDate(str, CONFIG.TZ, 'yyyy-MM-dd HH:mm');
}

/** เลขวันแบบนับตามเวลาไทย ใช้คำนวณส่วนต่างวัน */
function dayNumber_(d) {
  const s = Utilities.formatDate(d, CONFIG.TZ, 'yyyy-MM-dd').split('-');
  return Math.round(Date.UTC(+s[0], +s[1] - 1, +s[2]) / 86400000);
}

function startOfDay_(d) {
  return makeDate_(+Utilities.formatDate(d, CONFIG.TZ, 'yyyy'), +Utilities.formatDate(d, CONFIG.TZ, 'M'),
    +Utilities.formatDate(d, CONFIG.TZ, 'd'), 0, 0);
}

function endOfDay_(d) {
  return new Date(startOfDay_(d).getTime() + 86400000 - 1);
}

/** วันที่แบบไทยสำหรับข้อความ LINE เช่น 20/10/2569 08:00 */
function fmtThai_(d, withTime) {
  d = toDate_(d);
  if (!d) return '-';
  const y = Number(Utilities.formatDate(d, CONFIG.TZ, 'yyyy')) + 543;
  return Utilities.formatDate(d, CONFIG.TZ, 'dd/MM/') + y + (withTime === false ? '' : Utilities.formatDate(d, CONFIG.TZ, ' HH:mm') + ' น.');
}

/** แปลงแถวให้ส่งกลับ google.script.run ได้ (Date ส่งข้ามไม่ได้) */
function serialize_(obj) {
  const out = {};
  Object.keys(obj).forEach(k => {
    const v = obj[k];
    out[k] = isDate_(v) ? Utilities.formatDate(v, CONFIG.TZ, "yyyy-MM-dd'T'HH:mm") : v;
  });
  return out;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('ระบบกำลังบันทึกข้อมูลอื่นอยู่ กรุณาลองใหม่อีกครั้ง');
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

/* ======================= Services.gs ======================= */

/**
 * ตรรกะธุรกิจของศูนย์ดวงใจกตัญญู
 * ฟังก์ชันที่ไม่มี _ ท้ายชื่อ = เรียกจากหน้าเว็บผ่าน google.script.run ได้
 */

/* =========================================================
 * สิทธิ์ผู้จัดการ
 * ========================================================= */

function checkPin_(pin) {
  const expected = prop_('ADMIN_PIN');
  if (!expected) throw new Error('ยังไม่ได้ตั้งค่า ADMIN_PIN ใน Script Properties');
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('pin_fails') || 0);
  if (fails >= 10) throw new Error('ใส่รหัสผิดหลายครั้งเกินไป กรุณารอ 10 นาทีแล้วลองใหม่');
  if (String(pin || '') !== expected) {
    cache.put('pin_fails', String(fails + 1), 600);
    throw new Error('รหัสผู้จัดการไม่ถูกต้อง');
  }
}

function loadCtx_() {
  return {
    workers: readTable_(SHEET.WORKERS),
    clients: readTable_(SHEET.CLIENTS),
    services: readTable_(SHEET.SERVICES),
    jobs: readTable_(SHEET.JOBS),
    leaves: readTable_(SHEET.LEAVES),
  };
}

function byId_(rows, field, id) {
  const target = String(id || '').trim().toUpperCase();
  if (!target) return null;
  return rows.find(r => String(r[field]).trim().toUpperCase() === target) || null;
}

/* =========================================================
 * ข้อมูลหน้าผู้จัดการ
 * ========================================================= */

function getAppData(pin) {
  checkPin_(pin);
  const ctx = loadCtx_();
  const payments = readTable_(SHEET.PAYMENTS);
  const paidByJob = {};
  payments.forEach(p => {
    if (p.trans_type === STATUS.TRANS.IN) paidByJob[p.job_id] = (paidByJob[p.job_id] || 0) + toNum_(p.amount);
  });
  return {
    config: {
      centerName: CONFIG.CENTER_NAME,
      slogan: CONFIG.SLOGAN,
      minLeaveDays: CONFIG.MIN_LEAVE_NOTICE_DAYS,
      requirePoliceCheck: CONFIG.REQUIRE_POLICE_CHECK,
      lateLeaveTag: LATE_LEAVE_TAG,
      appUrl: ScriptApp.getService().getUrl() || '',
      lineReady: !!(prop_('LINE_CHANNEL_ACCESS_TOKEN') && prop_('LINE_CENTER_TARGET_ID')),
    },
    options: OPTIONS,
    status: STATUS,
    workers: ctx.workers.map(serialize_),
    clients: ctx.clients.map(serialize_),
    services: ctx.services.map(s => serialize_(Object.assign({}, s, serviceAmounts_(s), {
      _requires_car: serviceRequiresCar_(s),
    }))),
    jobs: ctx.jobs.map(j => serialize_(Object.assign({}, j, { _paid: paidByJob[j.job_id] || 0 }))),
    payments: payments.map(serialize_),
    leaves: ctx.leaves.map(l => serialize_(Object.assign({}, l, { _late: isLateLeave_(l) }))),
    dashboard: computeDashboard_(ctx, payments),
  };
}

function computeDashboard_(ctx, payments) {
  const now = Date.now();
  const live = ctx.jobs.filter(j => j.job_status !== STATUS.JOB.CANCELLED);
  const sum = f => live.reduce((t, j) => t + toNum_(j[f]), 0);
  const count = st => ctx.jobs.filter(j => j.job_status === st).length;
  const pendingPayouts = payments.filter(p => p.trans_type === STATUS.TRANS.OUT && p.payout_status === STATUS.PAYOUT.WAITING);
  return {
    totalClient: sum('total_client_amount'),
    totalCenter: sum('total_center_fee'),
    totalWorker: sum('total_worker_wage'),
    jobsTotal: ctx.jobs.length,
    jobsDone: count(STATUS.JOB.DONE),
    jobsActive: count(STATUS.JOB.ACTIVE),
    jobsPending: count(STATUS.JOB.PENDING),
    jobsCancelled: count(STATUS.JOB.CANCELLED),
    unpaidJobIds: live.filter(j => j.payment_status !== STATUS.PAYMENT.PAID).map(j => j.job_id),
    unassignedJobIds: live.filter(j => !j.worker_id && j.job_status !== STATUS.JOB.DONE).map(j => j.job_id),
    upcomingJobIds: live.filter(j => {
      const s = toDate_(j.start_datetime);
      return s && s.getTime() > now && s.getTime() - now <= 48 * 3600000 && j.job_status !== STATUS.JOB.DONE;
    }).map(j => j.job_id),
    readyWorkers: ctx.workers.filter(w => w.status === STATUS.WORKER.READY).length,
    pendingLeaveIds: ctx.leaves.filter(l => l.status === STATUS.LEAVE.PENDING).map(l => l.leave_id),
    pendingPayoutCount: pendingPayouts.length,
    pendingPayoutSum: pendingPayouts.reduce((t, p) => t + toNum_(p.amount), 0),
  };
}

/* =========================================================
 * บริการ / ราคา (Auto-fill จาก Service_Catalog เท่านั้น)
 * ========================================================= */

function serviceAmounts_(svc) {
  const price = toNum_(svc.client_price);
  const fee = toNum_(svc.center_fee);
  return { total_client_amount: price, total_center_fee: fee, total_worker_wage: price - fee };
}

function serviceRequiresCar_(svc) {
  if (svc.requires_car !== undefined && String(svc.requires_car).trim() !== '') return toBool_(svc.requires_car);
  return /รถ\s*(ของ)?\s*ผู้รับจ้าง/.test(String(svc.service_name || ''));
}

function normTag_(s) {
  return String(s || '').toLowerCase().replace(/[\s.]/g, '');
}

function splitTags_(v) {
  return String(v || '').split(/[,،;/|\n]+/).map(s => s.trim()).filter(Boolean);
}

/**
 * ใช้ required_skill ถ้ากำหนดไว้ ไม่งั้นเทียบว่า skill_tags ของคนทำงานปรากฏในชื่อบริการหรือไม่
 * เช่น "ส่ง รพ." ตรงกับ "รับ-ส่ง รพ. ด้วยรถผู้รับจ้าง"
 */
function workerHasSkill_(worker, svc) {
  const tags = splitTags_(worker.skill_tags).map(normTag_);
  if (!tags.length) return false;
  const required = splitTags_(svc.required_skill).map(normTag_);
  if (required.length) return required.some(r => tags.indexOf(r) >= 0);
  const name = normTag_(svc.service_name);
  return tags.some(t => t && name.indexOf(t) >= 0);
}

function saveService(pin, p) {
  checkPin_(pin);
  return withLock_(() => {
    const rows = readTable_(SHEET.SERVICES);
    const price = toNum_(p.client_price);
    const fee = toNum_(p.center_fee);
    if (!String(p.service_name || '').trim()) throw new Error('กรุณาระบุชื่อบริการ');
    if (price <= 0) throw new Error('ราคาลูกค้าต้องมากกว่า 0 บาท');
    if (fee < 0 || fee > price) throw new Error('ค่าบริหารศูนย์ต้องอยู่ระหว่าง 0 ถึงราคาลูกค้า');
    const rec = {
      service_name: String(p.service_name).trim(),
      unit_type: p.unit_type || '',
      client_price: price,
      center_fee: fee,
      worker_wage: price - fee,
      required_skill: Array.isArray(p.required_skill) ? p.required_skill.join(', ') : (p.required_skill || ''),
      requires_car: !!p.requires_car,
    };
    if (p.service_code) {
      updateRow_(SHEET.SERVICES, p.service_code, rec);
      rec.service_code = p.service_code;
    } else {
      rec.service_code = nextId_(SHEET.SERVICES, rows);
      insertRow_(SHEET.SERVICES, rec);
    }
    return serialize_(rec);
  });
}

/* =========================================================
 * ผู้รับจ้าง
 * ========================================================= */

function isValidThaiId_(id) {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

function normPhone_(v) {
  let d = digits_(v);
  if (d.length === 9 && d[0] !== '0') d = '0' + d; // เลข 0 นำหน้าหายเมื่อชีตเก็บเป็นตัวเลข
  return d;
}

function asText_(v) {
  const s = String(v || '').trim();
  return s ? "'" + s : '';
}

function saveWorker(pin, p) {
  checkPin_(pin);
  return withLock_(() => {
    const rows = readTable_(SHEET.WORKERS);
    const idCard = digits_(p.id_card_no);
    if (!String(p.full_name || '').trim()) throw new Error('กรุณาระบุชื่อ-นามสกุล');
    if (idCard && !isValidThaiId_(idCard)) throw new Error('เลขบัตรประชาชนไม่ถูกต้อง (ตรวจสอบ 13 หลัก)');
    if (idCard && rows.some(r => digits_(r.id_card_no) === idCard && r.worker_id !== p.worker_id)) {
      throw new Error('เลขบัตรประชาชนนี้มีในระบบแล้ว');
    }
    const phone = normPhone_(p.phone_number);
    if (phone && !/^0\d{8,9}$/.test(phone)) throw new Error('เบอร์โทรศัพท์ไม่ถูกต้อง');
    const rec = {
      id_card_no: asText_(idCard),
      full_name: String(p.full_name).trim(),
      nickname: p.nickname || '',
      phone_number: asText_(phone),
      village_moo: p.village_moo || '',
      skill_tags: Array.isArray(p.skill_tags) ? p.skill_tags.join(', ') : (p.skill_tags || ''),
      has_car: !!p.has_car,
      police_check_status: p.police_check_status || STATUS.POLICE.PENDING,
      status: p.status || STATUS.WORKER.READY,
      contract_signed_date: toDate_(p.contract_signed_date) || '',
      notes: p.notes || '',
    };
    if (p.worker_id) {
      updateRow_(SHEET.WORKERS, p.worker_id, rec);
      rec.worker_id = p.worker_id;
    } else {
      rec.worker_id = nextId_(SHEET.WORKERS, rows);
      insertRow_(SHEET.WORKERS, rec);
    }
    return serialize_(rec);
  });
}

/* =========================================================
 * ลูกค้า / ผู้ป่วย
 * ========================================================= */

function saveClient(pin, p) {
  checkPin_(pin);
  return withLock_(() => saveClient_(p));
}

function saveClient_(p, rows) {
  if (!String(p.client_name || '').trim()) throw new Error('กรุณาระบุชื่อผู้ว่าจ้าง');
  if (!String(p.patient_name || '').trim()) throw new Error('กรุณาระบุชื่อผู้รับการดูแล');
  const phone = normPhone_(p.client_phone);
  if (!/^0\d{8,9}$/.test(phone)) throw new Error('เบอร์โทรศัพท์ผู้ว่าจ้างไม่ถูกต้อง');
  const rec = {
    client_name: String(p.client_name).trim(),
    client_phone: asText_(phone),
    patient_name: String(p.patient_name).trim(),
    patient_condition: p.patient_condition || '',
    medical_precautions: p.medical_precautions || '',
    address_location: p.address_location || '',
  };
  if (p.client_id) {
    updateRow_(SHEET.CLIENTS, p.client_id, rec);
    rec.client_id = p.client_id;
  } else {
    rec.client_id = nextId_(SHEET.CLIENTS, rows || readTable_(SHEET.CLIENTS));
    rec.created_date = startOfDay_(new Date());
    insertRow_(SHEET.CLIENTS, rec);
  }
  return serialize_(rec);
}

/* =========================================================
 * จับคู่งาน (Matching & Scheduling)
 * ========================================================= */

/**
 * คืนรายการเหตุผลที่ "ส่งคนนี้ไม่ได้" — ว่าง = ส่งได้
 * code: STATUS | SKILL | CAR | POLICE | CONFLICT
 */
function evaluateWorker_(w, svc, start, end, ctx, excludeJobId) {
  const reasons = [];
  const status = String(w.status || '').trim();
  if (status !== STATUS.WORKER.READY) reasons.push({ code: 'STATUS', text: 'สถานะ "' + (status || 'ไม่ระบุ') + '"' });
  if (svc && !workerHasSkill_(w, svc)) reasons.push({ code: 'SKILL', text: 'ทักษะไม่ตรงกับงาน' });
  if (svc && serviceRequiresCar_(svc) && !toBool_(w.has_car)) reasons.push({ code: 'CAR', text: 'ไม่มีรถส่วนตัว (งานนี้ใช้รถผู้รับจ้าง)' });
  if (CONFIG.REQUIRE_POLICE_CHECK && String(w.police_check_status || '').trim() !== STATUS.POLICE.PASSED) {
    reasons.push({ code: 'POLICE', text: 'ตรวจประวัติอาชญากรรม: ' + (w.police_check_status || 'ยังไม่ตรวจ') });
  }
  if (start && end) {
    findConflicts_(w.worker_id, start, end, ctx, excludeJobId).forEach(t => reasons.push({ code: 'CONFLICT', text: t }));
  }
  return reasons;
}

/** ป้องกัน Double Booking: ช่วงเวลาทับกันเมื่อ start < endเดิม และ end > startเดิม */
function findConflicts_(workerId, start, end, ctx, excludeJobId) {
  const id = String(workerId || '').trim().toUpperCase();
  const out = [];
  ctx.jobs.forEach(j => {
    if (String(j.worker_id || '').trim().toUpperCase() !== id) return;
    if (excludeJobId && j.job_id === excludeJobId) return;
    if (j.job_status === STATUS.JOB.CANCELLED) return;
    const s = toDate_(j.start_datetime);
    const e = toDate_(j.end_datetime);
    if (!s || !e) return;
    if (start < e && end > s) out.push('เวลาชนกับใบงาน ' + j.job_id + ' (' + fmtThai_(s) + ' – ' + fmtThai_(e) + ')');
  });
  ctx.leaves.forEach(l => {
    if (String(l.worker_id || '').trim().toUpperCase() !== id) return;
    if (l.status === STATUS.LEAVE.REJECTED) return;
    const s = toDate_(l.leave_start_date);
    const e = toDate_(l.leave_end_date);
    if (!s || !e) return;
    if (start <= endOfDay_(e) && end >= startOfDay_(s)) {
      out.push('ลาหยุด ' + l.leave_id + ' (' + fmtThai_(s, false) + ' – ' + fmtThai_(e, false) + ', ' + l.status + ')');
    }
  });
  return out;
}

function workerLabel_(w) {
  return w.worker_id + ' · ' + w.full_name + (w.nickname ? ' (' + w.nickname + ')' : '');
}

/** ใช้ในฟอร์มใบงาน: คืนเฉพาะคนที่ส่งได้ + รายชื่อที่ถูกคัดออกพร้อมเหตุผล */
function getEligibleWorkers(pin, serviceCode, startStr, endStr, excludeJobId, currentWorkerId) {
  checkPin_(pin);
  const ctx = loadCtx_();
  const svc = byId_(ctx.services, 'service_code', serviceCode);
  if (!svc) throw new Error('กรุณาเลือกประเภทบริการก่อน');
  const start = toDate_(startStr);
  const end = toDate_(endStr);
  if (start && end && end <= start) throw new Error('เวลาเสร็จงานต้องหลังเวลาเริ่มงาน');
  const eligible = [];
  const excluded = [];
  ctx.workers.forEach(w => {
    if (w.status === STATUS.WORKER.RESIGNED) return;
    let reasons = evaluateWorker_(w, svc, start, end, ctx, excludeJobId);
    if (currentWorkerId && w.worker_id === currentWorkerId) reasons = reasons.filter(r => r.code !== 'STATUS');
    const item = {
      worker_id: w.worker_id,
      label: workerLabel_(w),
      village_moo: w.village_moo || '',
      has_car: toBool_(w.has_car),
      skill_tags: w.skill_tags || '',
    };
    if (reasons.length) excluded.push(Object.assign(item, { reasons: reasons.map(r => r.text) }));
    else eligible.push(item);
  });
  return { requiresCar: serviceRequiresCar_(svc), eligible: eligible, excluded: excluded };
}

/* =========================================================
 * ใบงาน
 * ========================================================= */

function saveJob(pin, p) {
  checkPin_(pin);
  const result = withLock_(() => {
    const ctx = loadCtx_();
    const existing = p.job_id ? byId_(ctx.jobs, 'job_id', p.job_id) : null;
    if (p.job_id && !existing) throw new Error('ไม่พบใบงาน ' + p.job_id);

    const client = byId_(ctx.clients, 'client_id', p.client_id);
    if (!client) throw new Error('กรุณาเลือกผู้ว่าจ้าง');
    const svc = byId_(ctx.services, 'service_code', p.service_code);
    if (!svc) throw new Error('กรุณาเลือกประเภทบริการ');
    const start = toDate_(p.start_datetime);
    const end = toDate_(p.end_datetime);
    if (!start || !end) throw new Error('กรุณาระบุวันเวลาเริ่มและเสร็จงาน');
    if (end <= start) throw new Error('เวลาเสร็จงานต้องหลังเวลาเริ่มงาน');

    const workerId = String(p.worker_id || '').trim();
    let worker = null;
    if (workerId) {
      worker = byId_(ctx.workers, 'worker_id', workerId);
      if (!worker) throw new Error('ไม่พบผู้รับจ้าง ' + workerId);
      let reasons = evaluateWorker_(worker, svc, start, end, ctx, existing && existing.job_id);
      // คนเดิมของใบงานนี้อาจมีสถานะ "ติดเคส" เพราะงานนี้เอง
      if (existing && existing.worker_id === worker.worker_id) reasons = reasons.filter(r => r.code !== 'STATUS');
      if (reasons.length) {
        throw new Error('มอบหมาย ' + workerLabel_(worker) + ' ไม่ได้: ' + reasons.map(r => r.text).join(' / '));
      }
    }

    const paymentStatus = p.payment_status || (existing && existing.payment_status) || STATUS.PAYMENT.PENDING;
    const jobStatus = p.job_status || (existing && existing.job_status) || STATUS.JOB.PENDING;
    if ((jobStatus === STATUS.JOB.ACTIVE || jobStatus === STATUS.JOB.DONE) && !workerId) {
      throw new Error('ต้องมอบหมายผู้รับจ้างก่อนเปลี่ยนสถานะเป็น "' + jobStatus + '"');
    }
    if ((jobStatus === STATUS.JOB.ACTIVE || jobStatus === STATUS.JOB.DONE) && paymentStatus !== STATUS.PAYMENT.PAID) {
      throw new Error('⛔ ห้ามปล่อยคนลงพื้นที่: ใบงานนี้ยัง "รอชำระ" กรุณาบันทึกรับเงินจากลูกค้าก่อน');
    }

    // ราคาดึงจาก Service_Catalog เสมอ ไม่รับตัวเลขจากหน้าฟอร์ม
    // ใบงานเดิมที่ไม่ได้เปลี่ยนบริการ คงราคาตอนเปิดใบงานไว้ (กันราคาเปลี่ยนย้อนหลัง)
    const keepOldPrice = existing && existing.service_code === svc.service_code && toNum_(existing.total_client_amount) > 0;
    const amounts = keepOldPrice ? {
      total_client_amount: toNum_(existing.total_client_amount),
      total_center_fee: toNum_(existing.total_center_fee),
      total_worker_wage: toNum_(existing.total_client_amount) - toNum_(existing.total_center_fee),
    } : serviceAmounts_(svc);

    const rec = Object.assign({
      client_id: client.client_id,
      service_code: svc.service_code,
      worker_id: workerId,
      start_datetime: start,
      end_datetime: end,
      hospital_location: p.hospital_location || '',
      payment_status: paymentStatus,
      job_status: jobStatus,
    }, amounts);

    if (existing) {
      updateRow_(SHEET.JOBS, existing.job_id, rec);
      rec.job_id = existing.job_id;
    } else {
      rec.job_id = nextId_(SHEET.JOBS, ctx.jobs);
      insertRow_(SHEET.JOBS, rec);
    }

    let payoutId = null;
    if (jobStatus === STATUS.JOB.DONE && (!existing || existing.job_status !== STATUS.JOB.DONE)) {
      payoutId = ensurePayout_(rec);
    }

    const warnings = [];
    if (paymentStatus !== STATUS.PAYMENT.PAID && jobStatus !== STATUS.JOB.CANCELLED) {
      warnings.push('⚠️ ใบงานนี้ยัง "รอชำระ" — ห้ามปล่อยคนลงพื้นที่จนกว่าลูกค้าจะชำระเงิน');
    }
    if (payoutId) warnings.push('สร้างรายการจ่ายค่าจ้าง ' + payoutId + ' (รอโอน) ให้อัตโนมัติแล้ว');

    return {
      job: rec, client: client, svc: svc, worker: worker, isNew: !existing,
      workerChanged: !!workerId && (!existing || existing.worker_id !== workerId),
      warnings: warnings,
    };
  });

  if (result.isNew) safeNotify_(() => notifyCenter_(msgNewJob_(result.job, result.client, result.svc, 'ผู้จัดการศูนย์บันทึก')));
  if (result.workerChanged) safeNotify_(() => notifyWorkerAssigned_(result.worker, result.job, result.client, result.svc));
  return { job: serialize_(result.job), warnings: result.warnings };
}

function ensurePayout_(job) {
  const payments = readTable_(SHEET.PAYMENTS);
  if (payments.some(x => x.job_id === job.job_id && x.trans_type === STATUS.TRANS.OUT)) return null;
  const rec = {
    trans_id: nextId_(SHEET.PAYMENTS, payments),
    job_id: job.job_id,
    trans_type: STATUS.TRANS.OUT,
    amount: toNum_(job.total_worker_wage),
    trans_datetime: '',
    slip_image_url: '',
    payout_status: STATUS.PAYOUT.WAITING,
  };
  insertRow_(SHEET.PAYMENTS, rec);
  return rec.trans_id;
}

/* =========================================================
 * การเงิน / สลิป
 * ========================================================= */

function savePayment(pin, p) {
  checkPin_(pin);
  return withLock_(() => {
    const jobs = readTable_(SHEET.JOBS);
    const job = byId_(jobs, 'job_id', p.job_id);
    if (!job) throw new Error('กรุณาเลือกใบงานที่อ้างอิง');
    const type = p.trans_type;
    if (OPTIONS.trans_type.indexOf(type) < 0) throw new Error('กรุณาเลือกประเภทรายการ');
    const amount = toNum_(p.amount);
    if (amount <= 0) throw new Error('จำนวนเงินต้องมากกว่า 0 บาท');

    const payments = readTable_(SHEET.PAYMENTS);
    const existing = p.trans_id ? byId_(payments, 'trans_id', p.trans_id) : null;
    if (p.trans_id && !existing) throw new Error('ไม่พบรายการ ' + p.trans_id);
    const transId = existing ? existing.trans_id : nextId_(SHEET.PAYMENTS, payments);

    const slipUrl = p.slip && p.slip.data ? saveSlip_(p.slip, transId + '_' + job.job_id) : (existing ? existing.slip_image_url : '');
    const rec = {
      job_id: job.job_id,
      trans_type: type,
      amount: amount,
      trans_datetime: toDate_(p.trans_datetime) || new Date(),
      slip_image_url: slipUrl,
      payout_status: p.payout_status || (type === STATUS.TRANS.IN ? STATUS.PAYOUT.OK : STATUS.PAYOUT.WAITING),
    };
    if (existing) updateRow_(SHEET.PAYMENTS, transId, rec);
    else insertRow_(SHEET.PAYMENTS, Object.assign({ trans_id: transId }, rec));
    rec.trans_id = transId;

    const messages = [];
    if (type === STATUS.TRANS.IN) {
      const paid = readTable_(SHEET.PAYMENTS)
        .filter(x => x.job_id === job.job_id && x.trans_type === STATUS.TRANS.IN)
        .reduce((t, x) => t + toNum_(x.amount), 0);
      const total = toNum_(job.total_client_amount);
      if (paid >= total && job.payment_status !== STATUS.PAYMENT.PAID) {
        updateRow_(SHEET.JOBS, job.job_id, { payment_status: STATUS.PAYMENT.PAID });
        messages.push('ใบงาน ' + job.job_id + ' ชำระครบแล้ว → เปลี่ยนสถานะเป็น "ชำระแล้ว"');
      } else if (paid < total) {
        messages.push('ใบงาน ' + job.job_id + ' ยังค้างชำระ ' + (total - paid).toLocaleString() + ' บาท');
      }
    }
    return { payment: serialize_(rec), messages: messages };
  });
}

function saveSlip_(slip, label) {
  if (!/^(image\/|application\/pdf)/.test(slip.mime || '')) throw new Error('สลิปต้องเป็นไฟล์รูปภาพหรือ PDF');
  if (slip.data.length > 8 * 1024 * 1024) throw new Error('ไฟล์สลิปใหญ่เกิน 6MB');
  const blob = Utilities.newBlob(Utilities.base64Decode(slip.data), slip.mime, label + '_' + (slip.name || 'slip'));
  return getSlipFolder_().createFile(blob).getUrl();
}

function getSlipFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SLIP_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* โฟลเดอร์ถูกลบ สร้างใหม่ */ }
  }
  const folder = DriveApp.createFolder(CONFIG.CENTER_NAME + ' - สลิปการโอน');
  props.setProperty('SLIP_FOLDER_ID', folder.getId());
  return folder;
}

/* =========================================================
 * การลา (กฎแจ้งล่วงหน้า 7 วัน)
 * ========================================================= */

function isLateLeave_(l) {
  if (l.notice_days !== '' && l.notice_days !== undefined && !isNaN(Number(l.notice_days))) {
    return Number(l.notice_days) < CONFIG.MIN_LEAVE_NOTICE_DAYS;
  }
  return /เตือน|กะทันหัน/.test(String(l.rule_check || ''));
}

function createLeave_(p, source) {
  const ctx = loadCtx_();
  const worker = byId_(ctx.workers, 'worker_id', p.worker_id);
  if (!worker) throw new Error('ไม่พบรหัสผู้รับจ้าง ' + (p.worker_id || ''));
  const start = toDate_(p.leave_start_date);
  const end = toDate_(p.leave_end_date) || start;
  if (!start) throw new Error('กรุณาระบุวันที่เริ่มหยุดงาน');
  if (end < start) throw new Error('วันสุดท้ายที่หยุดต้องไม่ก่อนวันเริ่มหยุด');
  if (!String(p.leave_reason || '').trim()) throw new Error('กรุณาระบุเหตุผลการลา');
  const requestDate = startOfDay_(toDate_(p.request_date) || new Date());
  const notice = dayNumber_(start) - dayNumber_(requestDate);
  const late = notice < CONFIG.MIN_LEAVE_NOTICE_DAYS;
  const rec = {
    leave_id: nextId_(SHEET.LEAVES, ctx.leaves),
    worker_id: worker.worker_id,
    request_date: requestDate,
    leave_start_date: startOfDay_(start),
    leave_end_date: startOfDay_(end),
    leave_reason: String(p.leave_reason).trim(),
    notice_days: notice,
    rule_check: late ? STATUS.RULE.LATE : STATUS.RULE.OK,
    substitute_worker_id: '',
    status: STATUS.LEAVE.PENDING,
  };
  insertRow_(SHEET.LEAVES, rec);
  const affected = affectedJobs_(worker.worker_id, rec.leave_start_date, rec.leave_end_date, ctx.jobs);
  return { rec: rec, worker: worker, late: late, affected: affected, source: source };
}

function affectedJobs_(workerId, startDate, endDate, jobs) {
  const from = startOfDay_(toDate_(startDate));
  const to = endOfDay_(toDate_(endDate));
  return jobs.filter(j => {
    if (j.worker_id !== workerId) return false;
    if (j.job_status === STATUS.JOB.CANCELLED || j.job_status === STATUS.JOB.DONE) return false;
    const s = toDate_(j.start_datetime);
    const e = toDate_(j.end_datetime);
    return s && e && s <= to && e >= from;
  });
}

function leaveResponse_(r) {
  safeNotify_(() => notifyCenter_(msgLeave_(r)));
  return {
    leave_id: r.rec.leave_id,
    notice_days: r.rec.notice_days,
    rule_check: r.rec.rule_check,
    late: r.late,
    tag: r.late ? LATE_LEAVE_TAG : '',
    affected: r.affected.map(j => j.job_id),
  };
}

function saveLeave(pin, p) {
  checkPin_(pin);
  return leaveResponse_(withLock_(() => createLeave_(p, 'ผู้จัดการศูนย์บันทึกแทน')));
}

function getLeaveDetail(pin, leaveId) {
  checkPin_(pin);
  const ctx = loadCtx_();
  const leave = byId_(ctx.leaves, 'leave_id', leaveId);
  if (!leave) throw new Error('ไม่พบใบลา ' + leaveId);
  const affected = affectedJobs_(leave.worker_id, leave.leave_start_date, leave.leave_end_date, ctx.jobs);
  const candidates = ctx.workers
    .filter(w => w.worker_id !== leave.worker_id && w.status !== STATUS.WORKER.RESIGNED)
    .map(w => {
      let reasons = [];
      if (affected.length) {
        affected.forEach(j => {
          const svc = byId_(ctx.services, 'service_code', j.service_code);
          evaluateWorker_(w, svc, toDate_(j.start_datetime), toDate_(j.end_datetime), ctx, null)
            .forEach(r => reasons.push(j.job_id + ': ' + r.text));
        });
      } else {
        const from = startOfDay_(toDate_(leave.leave_start_date));
        const to = endOfDay_(toDate_(leave.leave_end_date));
        reasons = evaluateWorker_(w, null, from, to, ctx, null).map(r => r.text);
      }
      return { worker_id: w.worker_id, label: workerLabel_(w), ok: reasons.length === 0, reasons: reasons };
    });
  return {
    leave: serialize_(Object.assign({}, leave, { _late: isLateLeave_(leave) })),
    affected: affected.map(serialize_),
    candidates: candidates,
  };
}

/** decision: 'approve' | 'reject' — ถ้าอนุมัติพร้อมคนแทน ระบบย้ายใบงานที่กระทบให้คนแทนอัตโนมัติ */
function decideLeave(pin, leaveId, decision, substituteId, reassign) {
  checkPin_(pin);
  const out = withLock_(() => {
    const ctx = loadCtx_();
    const leave = byId_(ctx.leaves, 'leave_id', leaveId);
    if (!leave) throw new Error('ไม่พบใบลา ' + leaveId);
    const approve = decision === 'approve';
    const sub = substituteId ? byId_(ctx.workers, 'worker_id', substituteId) : null;
    if (substituteId && !sub) throw new Error('ไม่พบผู้รับจ้าง ' + substituteId);

    const moved = [];
    if (approve && sub && reassign) {
      const affected = affectedJobs_(leave.worker_id, leave.leave_start_date, leave.leave_end_date, ctx.jobs);
      affected.forEach(j => {
        const svc = byId_(ctx.services, 'service_code', j.service_code);
        const reasons = evaluateWorker_(sub, svc, toDate_(j.start_datetime), toDate_(j.end_datetime), ctx, null);
        if (reasons.length) {
          throw new Error('ส่ง ' + workerLabel_(sub) + ' แทนใบงาน ' + j.job_id + ' ไม่ได้: ' + reasons.map(r => r.text).join(' / '));
        }
        // อัปเดตใน ctx ด้วย เพื่อให้ใบงานถัดไปเช็คชนกับงานที่เพิ่งย้ายมา
        j.worker_id = sub.worker_id;
        moved.push(j);
      });
      moved.forEach(j => updateRow_(SHEET.JOBS, j.job_id, { worker_id: sub.worker_id }));
    }

    updateRow_(SHEET.LEAVES, leave.leave_id, {
      status: approve ? STATUS.LEAVE.APPROVED : STATUS.LEAVE.REJECTED,
      substitute_worker_id: sub ? sub.worker_id : (leave.substitute_worker_id || ''),
    });
    return { leave: leave, approve: approve, sub: sub, moved: moved, ctx: ctx };
  });

  const worker = byId_(out.ctx.workers, 'worker_id', out.leave.worker_id);
  if (worker && worker.line_user_id) {
    safeNotify_(() => linePush_(worker.line_user_id,
      (out.approve ? '✅ ใบลา ' : '❌ ใบลา ') + out.leave.leave_id + (out.approve ? ' ได้รับอนุมัติแล้ว' : ' ไม่ได้รับอนุมัติ') +
      '\nช่วงวันที่ ' + fmtThai_(out.leave.leave_start_date, false) + ' – ' + fmtThai_(out.leave.leave_end_date, false)));
  }
  out.moved.forEach(j => {
    safeNotify_(() => notifyWorkerAssigned_(out.sub, j,
      byId_(out.ctx.clients, 'client_id', j.client_id), byId_(out.ctx.services, 'service_code', j.service_code)));
  });
  return { status: out.approve ? STATUS.LEAVE.APPROVED : STATUS.LEAVE.REJECTED, moved: out.moved.map(j => j.job_id) };
}

/* =========================================================
 * หน้าสาธารณะ (ลูกค้าจองงาน / ผู้รับจ้างยื่นลา) — ไม่ต้องใช้ PIN
 * ========================================================= */

function getPublicInfo() {
  return {
    centerName: CONFIG.CENTER_NAME,
    slogan: CONFIG.SLOGAN,
    minLeaveDays: CONFIG.MIN_LEAVE_NOTICE_DAYS,
    lateLeaveTag: LATE_LEAVE_TAG,
    conditions: OPTIONS.patient_condition,
    services: readTable_(SHEET.SERVICES)
      .filter(s => toNum_(s.client_price) > 0)
      .map(s => ({ service_code: s.service_code, service_name: s.service_name, unit_type: s.unit_type, client_price: toNum_(s.client_price) })),
  };
}

function throttle_(key, max, seconds) {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get(key) || 0);
  if (n >= max) throw new Error('มีการส่งข้อมูลถี่เกินไป กรุณาลองใหม่ภายหลัง หรือโทรติดต่อศูนย์');
  cache.put(key, String(n + 1), seconds);
}

function submitBooking(p) {
  throttle_('booking_rate', 30, 600);
  const result = withLock_(() => {
    const services = readTable_(SHEET.SERVICES);
    const svc = byId_(services, 'service_code', p.service_code);
    if (!svc) throw new Error('กรุณาเลือกประเภทบริการ');
    const start = toDate_(p.start_datetime);
    const end = toDate_(p.end_datetime);
    if (!start || !end) throw new Error('กรุณาระบุวันเวลาที่ต้องการใช้บริการ');
    if (end <= start) throw new Error('เวลาสิ้นสุดต้องหลังเวลาเริ่ม');
    if (start.getTime() < Date.now() - 3600000) throw new Error('วันเวลาเริ่มงานต้องไม่ย้อนหลัง');

    // ลูกค้าเดิม = เบอร์โทรและชื่อผู้ป่วยตรงกัน
    const clients = readTable_(SHEET.CLIENTS);
    const phone = normPhone_(p.client_phone);
    let client = clients.find(c => normPhone_(c.client_phone) === phone &&
      normTag_(c.patient_name) === normTag_(p.patient_name));
    if (!client) client = saveClient_(Object.assign({}, p, { client_id: '' }), clients);

    const jobs = readTable_(SHEET.JOBS);
    const job = Object.assign({
      job_id: nextId_(SHEET.JOBS, jobs),
      client_id: client.client_id,
      service_code: svc.service_code,
      worker_id: '',
      start_datetime: start,
      end_datetime: end,
      hospital_location: p.hospital_location || p.address_location || '',
      payment_status: STATUS.PAYMENT.PENDING,
      job_status: STATUS.JOB.PENDING,
    }, serviceAmounts_(svc));
    insertRow_(SHEET.JOBS, job);
    return { job: job, client: client, svc: svc };
  });
  safeNotify_(() => notifyCenter_(msgNewJob_(result.job, result.client, result.svc, 'ลูกค้าจองผ่านฟอร์มออนไลน์')));
  return {
    job_id: result.job.job_id,
    service_name: result.svc.service_name,
    amount: result.job.total_client_amount,
  };
}

function submitLeave(p) {
  throttle_('leave_rate', 30, 600);
  const workers = readTable_(SHEET.WORKERS);
  const w = byId_(workers, 'worker_id', p.worker_id);
  const last4 = digits_(p.phone_last4);
  if (!w || last4.length !== 4 || normPhone_(w.phone_number).slice(-4) !== last4) {
    throw new Error('รหัสผู้รับจ้างหรือเบอร์โทร 4 ตัวท้ายไม่ถูกต้อง');
  }
  return leaveResponse_(withLock_(() => createLeave_({
    worker_id: w.worker_id,
    leave_start_date: p.leave_start_date,
    leave_end_date: p.leave_end_date,
    leave_reason: p.leave_reason,
  }, 'ผู้รับจ้างยื่นผ่านฟอร์มออนไลน์')));
}

/* ======================= Line.gs ======================= */

/**
 * แจ้งเตือนผ่าน LINE Messaging API
 * (LINE Notify ปิดบริการตั้งแต่ 31 มี.ค. 2025 จึงใช้ LINE Official Account + Messaging API แทน)
 */

function linePush_(to, text) {
  const token = prop_('LINE_CHANNEL_ACCESS_TOKEN');
  if (!token || !to) {
    console.log('ข้าม LINE (ยังไม่ตั้งค่า token/ผู้รับ): ' + text);
    return false;
  }
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ to: to, messages: [{ type: 'text', text: String(text).slice(0, 4900) }] }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    console.error('LINE push ล้มเหลว ' + res.getResponseCode() + ': ' + res.getContentText());
    return false;
  }
  return true;
}

function lineReply_(replyToken, text) {
  const token = prop_('LINE_CHANNEL_ACCESS_TOKEN');
  if (!token || !replyToken) return;
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true,
  });
}

function notifyCenter_(text) {
  return linePush_(prop_('LINE_CENTER_TARGET_ID'), text);
}

/** การแจ้งเตือนล้มเหลวต้องไม่ทำให้การบันทึกข้อมูลล้มตาม */
function safeNotify_(fn) {
  try {
    return fn();
  } catch (e) {
    console.error('แจ้งเตือนไม่สำเร็จ: ' + e);
    return false;
  }
}

function baht_(n) {
  return toNum_(n).toLocaleString('en-US') + ' บาท';
}

/* ---------- ข้อความ ---------- */

function msgNewJob_(job, client, svc, source) {
  return [
    '🆕 มีงานจองใหม่ — ' + CONFIG.CENTER_NAME,
    '(' + source + ')',
    'ใบงาน: ' + job.job_id,
    'บริการ: ' + svc.service_name,
    'เริ่ม: ' + fmtThai_(job.start_datetime),
    'ถึง: ' + fmtThai_(job.end_datetime),
    'ผู้ว่าจ้าง: ' + client.client_name + ' โทร ' + normPhone_(client.client_phone),
    'ผู้รับการดูแล: ' + client.patient_name + (client.patient_condition ? ' (' + client.patient_condition + ')' : ''),
    'สถานที่: ' + (job.hospital_location || client.address_location || '-'),
    'ยอดเรียกเก็บ: ' + baht_(job.total_client_amount),
    'สถานะชำระ: ' + job.payment_status,
    job.worker_id ? 'ผู้รับจ้าง: ' + job.worker_id : '👉 ยังไม่ได้จัดคนทำงาน',
  ].join('\n');
}

function msgLeave_(r) {
  const w = r.worker;
  const lines = [
    (r.late ? '🔴 ' + LATE_LEAVE_TAG : '📝 มีคำขอลาใหม่'),
    'ใบลา: ' + r.rec.leave_id + ' (' + r.source + ')',
    'ผู้รับจ้าง: ' + workerLabel_(w),
    'หยุด: ' + fmtThai_(r.rec.leave_start_date, false) + ' – ' + fmtThai_(r.rec.leave_end_date, false),
    'แจ้งล่วงหน้า: ' + r.rec.notice_days + ' วัน → ' + r.rec.rule_check,
    'เหตุผล: ' + r.rec.leave_reason,
  ];
  if (r.affected.length) {
    lines.push('⚠️ กระทบใบงาน ' + r.affected.length + ' ใบ: ' + r.affected.map(j => j.job_id).join(', '));
    lines.push('👉 กรุณาจัดคนแทนในระบบ');
  }
  return lines.join('\n');
}

function msgJobDetail_(job, client, svc) {
  return [
    'บริการ: ' + (svc ? svc.service_name : job.service_code),
    'เริ่ม: ' + fmtThai_(job.start_datetime),
    'ถึง: ' + fmtThai_(job.end_datetime),
    'สถานที่: ' + (job.hospital_location || '-'),
    'ที่อยู่/จุดสังเกต: ' + (client && client.address_location || '-'),
    'ผู้รับการดูแล: ' + (client ? client.patient_name : '-') + (client && client.patient_condition ? ' (' + client.patient_condition + ')' : ''),
    'ข้อควรระวัง: ' + (client && client.medical_precautions || '-'),
    'ติดต่อญาติ: ' + (client ? client.client_name + ' โทร ' + normPhone_(client.client_phone) : '-'),
    'ค่าจ้างสุทธิ: ' + baht_(job.total_worker_wage),
  ].join('\n');
}

function notifyWorkerAssigned_(worker, job, client, svc) {
  if (!worker || !worker.line_user_id) return false;
  return linePush_(worker.line_user_id,
    '📋 คุณได้รับมอบหมายงานใหม่ ' + job.job_id + '\n' + msgJobDetail_(job, client, svc) +
    '\n\n' + CONFIG.CENTER_NAME + ' — ' + CONFIG.SLOGAN);
}

/* =========================================================
 * แจ้งเตือนล่วงหน้า 24 ชม. (ทริกเกอร์รายชั่วโมง)
 * ========================================================= */

function sendUpcomingReminders() {
  const now = Date.now();
  const horizon = now + CONFIG.REMINDER_HOURS_BEFORE * 3600000;
  const ctx = loadCtx_();
  const props = PropertiesService.getScriptProperties();
  const sent = props.getProperties();

  ctx.jobs.forEach(j => {
    if (j.job_status === STATUS.JOB.CANCELLED || j.job_status === STATUS.JOB.DONE) return;
    const s = toDate_(j.start_datetime);
    if (!s || s.getTime() <= now || s.getTime() > horizon) return;
    // key รวมเวลาเริ่มและคนทำงาน: ถ้าเลื่อนวันหรือเปลี่ยนคน จะเตือนใหม่
    const key = 'RM|' + j.job_id + '|' + Utilities.formatDate(s, CONFIG.TZ, 'yyyyMMddHHmm') + '|' + (j.worker_id || '-');
    if (sent[key]) return;

    const client = byId_(ctx.clients, 'client_id', j.client_id);
    const svc = byId_(ctx.services, 'service_code', j.service_code);
    const worker = j.worker_id ? byId_(ctx.workers, 'worker_id', j.worker_id) : null;
    let ok = true;

    if (worker && worker.line_user_id) {
      ok = safeNotify_(() => linePush_(worker.line_user_id,
        '⏰ แจ้งเตือนงานพรุ่งนี้ ' + j.job_id + '\n' + msgJobDetail_(j, client, svc) +
        '\n\nกรุณาเตรียมตัวและเดินทางให้ตรงเวลา 🙏')) && ok;
    }

    const centerNotes = [];
    if (!worker) centerNotes.push('❗ ยังไม่ได้จัดคนทำงาน');
    else if (!worker.line_user_id) centerNotes.push('📞 ' + workerLabel_(worker) + ' ยังไม่ได้ลงทะเบียน LINE กรุณาโทรแจ้ง ' + normPhone_(worker.phone_number));
    if (j.payment_status !== STATUS.PAYMENT.PAID) centerNotes.push('⛔ ยัง "รอชำระ" — ห้ามปล่อยคนลงพื้นที่จนกว่าจะชำระเงิน');
    if (centerNotes.length) {
      ok = safeNotify_(() => notifyCenter_(
        '⏰ งานเริ่มภายใน 24 ชม. ' + j.job_id + '\n' + centerNotes.join('\n') + '\n' + msgJobDetail_(j, client, svc))) && ok;
    }
    if (ok) props.setProperty(key, String(now));
  });

  // ล้าง key เก่ากว่า 30 วัน
  Object.keys(sent).forEach(k => {
    if (k.indexOf('RM|') === 0 && now - Number(sent[k]) > 30 * 86400000) props.deleteProperty(k);
  });
}

/* =========================================================
 * Webhook จาก LINE (ตั้ง Webhook URL = URL ของเว็บแอป)
 *  - พิมพ์ "id"                         → บอทตอบ userId / groupId (ใช้ตั้ง LINE_CENTER_TARGET_ID)
 *  - พิมพ์ "ลงทะเบียน WK-001 1234"      → ผูก LINE กับผู้รับจ้าง (1234 = เบอร์โทร 4 ตัวท้าย)
 * ========================================================= */

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    (body.events || []).forEach(handleLineEvent_);
  } catch (err) {
    console.error('webhook error: ' + err);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

function handleLineEvent_(ev) {
  if (ev.type !== 'message' || !ev.message || ev.message.type !== 'text') return;
  const text = String(ev.message.text || '').trim();
  const src = ev.source || {};

  if (/^(id|ไอดี)$/i.test(text)) {
    const lines = ['userId ของคุณ: ' + src.userId];
    if (src.groupId) lines.push('groupId ของกลุ่มนี้: ' + src.groupId);
    if (src.roomId) lines.push('roomId: ' + src.roomId);
    lineReply_(ev.replyToken, lines.join('\n'));
    return;
  }

  const m = text.match(/^ลงทะเบียน\s+(\S+)\s+(\d{4})$/);
  if (m) {
    const reply = withLock_(() => {
      const w = byId_(readTable_(SHEET.WORKERS), 'worker_id', m[1]);
      if (!w || normPhone_(w.phone_number).slice(-4) !== m[2]) return '❌ รหัสผู้รับจ้างหรือเบอร์ 4 ตัวท้ายไม่ถูกต้อง';
      updateRow_(SHEET.WORKERS, w.worker_id, { line_user_id: src.userId });
      return '✅ ลงทะเบียนสำเร็จ ' + workerLabel_(w) + '\nคุณจะได้รับแจ้งเตือนงานล่วงหน้า 24 ชม. ทาง LINE นี้';
    });
    lineReply_(ev.replyToken, reply);
  }
}

/* ======================= Setup.gs ======================= */

/**
 * เมนูใน Google Sheets + ติดตั้งโครงสร้าง / ทริกเกอร์
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💗 ศูนย์ดวงใจกตัญญู')
    .addItem('1) ติดตั้ง/ตรวจสอบโครงสร้างแผ่นงาน', 'setupSheets')
    .addItem('2) เปิดแจ้งเตือนล่วงหน้า 24 ชม. (ทริกเกอร์)', 'installTriggers')
    .addItem('3) ทดสอบส่ง LINE ถึงศูนย์', 'testLine')
    .addSeparator()
    .addItem('ลิงก์ระบบ (ผู้จัดการ / จองงาน / ยื่นลา)', 'showWebAppLinks')
    .addItem('ส่งแจ้งเตือนงานพรุ่งนี้ตอนนี้เลย', 'sendUpcomingReminders')
    .addToUi();
}

// เป็นฟังก์ชัน (ไม่ใช่ const) เพราะลำดับโหลดไฟล์ .gs ไม่แน่นอน — OPTIONS อยู่ใน Config.gs
function validationRules_() {
  return {
    [SHEET.WORKERS]: { police_check_status: OPTIONS.police_check_status, status: OPTIONS.worker_status },
    [SHEET.CLIENTS]: { patient_condition: OPTIONS.patient_condition },
    [SHEET.SERVICES]: { unit_type: OPTIONS.unit_type },
    [SHEET.JOBS]: { payment_status: OPTIONS.payment_status, job_status: OPTIONS.job_status },
    [SHEET.PAYMENTS]: { trans_type: OPTIONS.trans_type, payout_status: OPTIONS.payout_status },
    [SHEET.LEAVES]: { status: OPTIONS.leave_status },
  };
}

const TEXT_COLUMNS_ = ['id_card_no', 'phone_number', 'client_phone'];
const DATE_COLUMNS_ = ['contract_signed_date', 'created_date', 'request_date', 'leave_start_date', 'leave_end_date'];
const DATETIME_COLUMNS_ = ['start_datetime', 'end_datetime', 'trans_datetime'];
const MONEY_COLUMNS_ = ['client_price', 'center_fee', 'worker_wage', 'total_client_amount', 'total_center_fee', 'total_worker_wage', 'amount'];

function setupSheets() {
  const book = ss();
  const report = [];

  Object.keys(SCHEMA).forEach(name => {
    const schema = SCHEMA[name];
    let sh = book.getSheetByName(name);
    if (!sh) {
      sh = book.insertSheet(name);
      buildNewSheet_(sh, schema);
      report.push('➕ สร้างแผ่นงาน ' + name);
    } else {
      const added = appendMissingColumns_(sh, schema);
      if (added.length) report.push('➕ ' + name + ': เพิ่มคอลัมน์ ' + added.join(', '));
    }
    applyValidation_(sh, name);
  });

  applyConditionalFormats_(book);
  if (!book.getSheetByName(SHEET.DASHBOARD)) {
    buildDashboardSheet_(book);
    report.push('➕ สร้างแผ่นงาน ' + SHEET.DASHBOARD);
  }
  resetCaches_();

  const missingProps = ['ADMIN_PIN', 'LINE_CHANNEL_ACCESS_TOKEN', 'LINE_CENTER_TARGET_ID'].filter(k => !prop_(k));
  if (missingProps.length) report.push('⚠️ ยังไม่ได้ตั้ง Script Properties: ' + missingProps.join(', '));

  SpreadsheetApp.getUi().alert('ตรวจสอบโครงสร้างเรียบร้อย\n\n' + (report.length ? report.join('\n') : 'โครงสร้างครบถ้วนแล้ว ✅'));
}

function lastHeaderCol_(sh) {
  if (sh.getLastColumn() === 0) return 0;
  const headers = sh.getRange(CONFIG.HEADER_ROW, 1, 1, sh.getLastColumn()).getValues()[0];
  for (let c = headers.length - 1; c >= 0; c--) if (String(headers[c]).trim()) return c + 1;
  return 0;
}

function styleHeaderCells_(sh, col, count) {
  sh.getRange(CONFIG.DESC_ROW, col, 1, count).setFontColor('#5f6f6b').setFontStyle('italic').setWrap(true).setVerticalAlignment('top');
  sh.getRange(CONFIG.HEADER_ROW, col, 1, count).setFontWeight('bold').setBackground('#1f6273').setFontColor('#ffffff');
}

function formatColumn_(sh, field, col) {
  const rows = Math.max(sh.getMaxRows() - CONFIG.DATA_START_ROW + 1, 1);
  const rng = sh.getRange(CONFIG.DATA_START_ROW, col, rows, 1);
  if (TEXT_COLUMNS_.indexOf(field) >= 0) rng.setNumberFormat('@');
  else if (DATE_COLUMNS_.indexOf(field) >= 0) rng.setNumberFormat('dd/mm/yyyy');
  else if (DATETIME_COLUMNS_.indexOf(field) >= 0) rng.setNumberFormat('dd/mm/yyyy hh:mm');
  else if (MONEY_COLUMNS_.indexOf(field) >= 0) rng.setNumberFormat('#,##0');
}

function buildNewSheet_(sh, schema) {
  const fields = schema.fields;
  sh.getRange(CONFIG.TITLE_ROW, 1).setValue(CONFIG.CENTER_NAME + ' — ' + schema.title).setFontSize(14).setFontWeight('bold').setFontColor('#1f6273');
  sh.getRange(CONFIG.DESC_ROW, 1, 1, fields.length).setValues([fields.map(f => f[1])]);
  sh.getRange(CONFIG.HEADER_ROW, 1, 1, fields.length).setValues([fields.map(f => f[0])]);
  styleHeaderCells_(sh, 1, fields.length);
  sh.setFrozenRows(CONFIG.HEADER_ROW);
  fields.forEach((f, i) => {
    sh.setColumnWidth(i + 1, 150);
    formatColumn_(sh, f[0], i + 1);
  });
}

function appendMissingColumns_(sh, schema) {
  const width = sh.getLastColumn();
  const headers = width ? sh.getRange(CONFIG.HEADER_ROW, 1, 1, width).getValues()[0].map(h => String(h).trim()) : [];
  const missing = schema.fields.filter(f => headers.indexOf(f[0]) < 0);
  if (!missing.length) return [];
  const startCol = lastHeaderCol_(sh) + 1;
  if (sh.getMaxColumns() < startCol + missing.length - 1) {
    sh.insertColumnsAfter(sh.getMaxColumns(), startCol + missing.length - 1 - sh.getMaxColumns());
  }
  sh.getRange(CONFIG.DESC_ROW, startCol, 1, missing.length).setValues([missing.map(f => f[1])]);
  sh.getRange(CONFIG.HEADER_ROW, startCol, 1, missing.length).setValues([missing.map(f => f[0])]);
  styleHeaderCells_(sh, startCol, missing.length);
  missing.forEach((f, i) => formatColumn_(sh, f[0], startCol + i));
  return missing.map(f => f[0]);
}

/** ใส่ dropdown เฉพาะคอลัมน์ที่ยังไม่มี validation (ไม่ทับของเดิม) */
function applyValidation_(sh, name) {
  const rules = validationRules_()[name];
  if (!rules) return;
  const headers = sh.getRange(CONFIG.HEADER_ROW, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const rows = Math.max(sh.getMaxRows() - CONFIG.DATA_START_ROW + 1, 1);
  Object.keys(rules).forEach(field => {
    const col = headers.indexOf(field) + 1;
    if (col < 1) return;
    if (sh.getRange(CONFIG.DATA_START_ROW, col).getDataValidation()) return;
    const v = SpreadsheetApp.newDataValidation().requireValueInList(rules[field], true).setAllowInvalid(true).build();
    sh.getRange(CONFIG.DATA_START_ROW, col, rows, 1).setDataValidation(v);
  });
}

function applyConditionalFormats_(book) {
  const red = '#fdecec';
  const redInk = '#b3261e';
  addTextRule_(book, SHEET.JOBS, 'payment_status', 'equals', STATUS.PAYMENT.PENDING, red, redInk);
  addTextRule_(book, SHEET.JOBS, 'payment_status', 'equals', STATUS.PAYMENT.PAID, '#e7f6ec', '#1b7f3b');
  addTextRule_(book, SHEET.LEAVES, 'rule_check', 'contains', 'เตือน', red, redInk);
  addTextRule_(book, SHEET.WORKERS, 'police_check_status', 'equals', STATUS.POLICE.FAILED, red, redInk);
  addTextRule_(book, SHEET.PAYMENTS, 'payout_status', 'equals', STATUS.PAYOUT.WAITING, '#fff4e0', '#8a5300');
}

function addTextRule_(book, sheetName, field, kind, text, bg, ink) {
  const sh = book.getSheetByName(sheetName);
  if (!sh) return;
  const headers = sh.getRange(CONFIG.HEADER_ROW, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const col = headers.indexOf(field) + 1;
  if (col < 1) return;
  const range = sh.getRange(CONFIG.DATA_START_ROW, col, Math.max(sh.getMaxRows() - CONFIG.DATA_START_ROW + 1, 1), 1);
  // ลบกฎเดิมที่ใช้ข้อความเดียวกันบนคอลัมน์เดียวกัน กันกฎซ้ำเมื่อรันหลายรอบ
  const rules = sh.getConditionalFormatRules().filter(r => {
    const bc = r.getBooleanCondition();
    if (!bc) return true;
    const sameText = bc.getCriteriaValues().map(String).indexOf(text) >= 0;
    const sameCol = r.getRanges().some(rg => rg.getColumn() === col);
    return !(sameText && sameCol);
  });
  let b = SpreadsheetApp.newConditionalFormatRule();
  b = kind === 'contains' ? b.whenTextContains(text) : b.whenTextEqualTo(text);
  rules.push(b.setBackground(bg).setFontColor(ink).setBold(true).setRanges([range]).build());
  sh.setConditionalFormatRules(rules);
}

function colLetter_(sheetName, field) {
  const sh = ss().getSheetByName(sheetName);
  const headers = sh.getRange(CONFIG.HEADER_ROW, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  let n = headers.indexOf(field) + 1;
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function buildDashboardSheet_(book) {
  const sh = book.insertSheet(SHEET.DASHBOARD);
  const J = SHEET.JOBS, W = SHEET.WORKERS;
  const r = CONFIG.DATA_START_ROW;
  const jc = f => J + '!' + colLetter_(J, f) + r + ':' + colLetter_(J, f);
  const wc = f => W + '!' + colLetter_(W, f) + r + ':' + colLetter_(W, f);
  const live = jc('job_status') + ',"<>' + STATUS.JOB.CANCELLED + '"';
  const rows = [
    ['ยอดรายรับรวมที่เก็บจากลูกค้า (บาท)', '=SUMIF(' + live + ',' + jc('total_client_amount') + ')'],
    ['รายได้สุทธิของศูนย์ (กำไรสะสม)', '=SUMIF(' + live + ',' + jc('total_center_fee') + ')'],
    ['ยอดค่าจ้างที่จ่ายให้คนทำงานทั้งหมด (บาท)', '=SUMIF(' + live + ',' + jc('total_worker_wage') + ')'],
    ['จำนวนงานทั้งหมด', '=COUNTA(' + jc('job_id') + ')'],
    ['งานที่สำเร็จ', '=COUNTIF(' + jc('job_status') + ',"' + STATUS.JOB.DONE + '")'],
    ['งานที่กำลังทำ', '=COUNTIF(' + jc('job_status') + ',"' + STATUS.JOB.ACTIVE + '")'],
    ['⚠️ ใบงานที่รอลูกค้าชำระเงิน', '=COUNTIFS(' + jc('payment_status') + ',"' + STATUS.PAYMENT.PENDING + '",' + live + ')'],
    ['คนทำงานที่พร้อมลงงานทันที', '=COUNTIF(' + wc('status') + ',"' + STATUS.WORKER.READY + '")'],
  ];
  sh.getRange(1, 1).setValue(CONFIG.CENTER_NAME + ' — สรุปผลการดำเนินงาน').setFontSize(14).setFontWeight('bold').setFontColor('#1f6273');
  sh.getRange(2, 1).setValue(CONFIG.SLOGAN).setFontStyle('italic').setFontColor('#5f6f6b');
  sh.getRange(4, 1, rows.length, 2).setValues(rows);
  sh.getRange(4, 2, rows.length, 1).setNumberFormat('#,##0').setFontWeight('bold');
  sh.getRange(10, 1, 1, 2).setBackground('#fdecec').setFontColor('#b3261e');
  sh.setColumnWidth(1, 320);
  sh.setColumnWidth(2, 160);
}

/* ---------- ทริกเกอร์ / เครื่องมือ ---------- */

function installTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendUpcomingReminders')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendUpcomingReminders').timeBased().everyHours(1).create();
  SpreadsheetApp.getUi().alert('✅ เปิดการแจ้งเตือนอัตโนมัติแล้ว\nระบบจะตรวจทุกชั่วโมง และส่ง LINE เตือนคนทำงานก่อนเริ่มงาน 24 ชม.');
}

function testLine() {
  const ok = notifyCenter_('✅ ทดสอบการแจ้งเตือนจาก ' + CONFIG.CENTER_NAME + '\n' + CONFIG.SLOGAN);
  SpreadsheetApp.getUi().alert(ok
    ? 'ส่ง LINE สำเร็จ ✅'
    : 'ส่งไม่สำเร็จ ❌\nตรวจสอบ Script Properties: LINE_CHANNEL_ACCESS_TOKEN และ LINE_CENTER_TARGET_ID\n(ดูรายละเอียดใน Executions log)');
}

function showWebAppLinks() {
  const url = ScriptApp.getService().getUrl();
  if (!url) {
    SpreadsheetApp.getUi().alert('ยังไม่ได้ Deploy เว็บแอป\nไปที่ Extensions > Apps Script > Deploy > New deployment > Web app');
    return;
  }
  const link = (label, href) => '<p><b>' + label + '</b><br><a href="' + href + '" target="_blank">' + href + '</a></p>';
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;font-size:13px">' +
    link('หน้าผู้จัดการศูนย์', url) +
    link('ฟอร์มลูกค้าจองบริการ', url + '?page=book') +
    link('ฟอร์มผู้รับจ้างยื่นลา', url + '?page=leave') +
    '</div>').setWidth(520).setHeight(260);
  SpreadsheetApp.getUi().showModalDialog(html, 'ลิงก์ระบบ ' + CONFIG.CENTER_NAME);
}

/* ======================= WebApp.gs ======================= */

/**
 * เว็บแอป
 *   /exec              หน้าผู้จัดการศูนย์ (ต้องใส่ ADMIN_PIN)
 *   /exec?page=book    ฟอร์มลูกค้าจองบริการ
 *   /exec?page=leave   ฟอร์มผู้รับจ้างยื่นลา
 */
function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) || '';
  const isPublic = page === 'book' || page === 'leave';
  const tpl = HtmlService.createTemplateFromFile(isPublic ? 'Public' : 'Index');
  tpl.mode = page;
  tpl.centerName = CONFIG.CENTER_NAME;
  tpl.slogan = CONFIG.SLOGAN;
  return tpl.evaluate()
    .setTitle(CONFIG.CENTER_NAME + (page === 'book' ? ' · จองบริการ' : page === 'leave' ? ' · ยื่นใบลา' : ' · ผู้จัดการ'))
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include_(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}
