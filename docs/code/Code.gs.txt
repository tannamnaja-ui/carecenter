/**
 * ศูนย์ดวงใจกตัญญู — ไฟล์รวมสำหรับวางใน Apps Script (Code.gs)
 * รวม Config.gs, Db.gs, Services.gs, Line.gs, Setup.gs, WebApp.gs และหน้าเว็บ HTML ทั้งหมด
 * วางไฟล์นี้ไฟล์เดียวในโปรเจกต์ (ลบไฟล์ .gs อื่นทิ้ง) — ไม่ต้องสร้างไฟล์ HTML แยก
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
  // เปลี่ยนทุกครั้งที่แก้โค้ด — ใช้ตรวจว่าเว็บแอปที่ Deploy อยู่เป็นโค้ดล่าสุดหรือไม่
  VERSION: '2026-10-17.6',
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
  SERVICES: 'บริการของศูนย์ทั้งหมด',
  JOBS: 'Job_Orders',
  PAYMENTS: 'Payments',
  LEAVES: 'Leave_Requests',
  DASHBOARD: 'Dashboard_Summary',
  ABOUT: 'เกี่ยวกับศูนย์',
};

/**
 * ข้อความตั้งต้นของแผ่น "เกี่ยวกับศูนย์" (แสดงในเมนู หนังสือรับประกันและความเป็นมา)
 * setupSheets ใส่ให้ครั้งแรกเท่านั้น หลังจากนั้นศูนย์แก้ข้อความในชีตได้เลย
 */
const ABOUT_DEFAULTS = [
  ['guarantee', 'หนังสือรับประกันบริการ',
    'ศูนย์ดวงใจกตัญญู ขอรับประกันกับผู้ใช้บริการทุกท่านว่า\n' +
    '1. ผู้ดูแลทุกคนผ่านการตรวจประวัติอาชญากรรม และมีบุคคลรับรองความประพฤติในพื้นที่\n' +
    '2. ค่าบริการเป็นเงินบาทคงที่ตามตารางบริการ ไม่มีค่าใช้จ่ายแอบแฝง\n' +
    '3. ส่งผู้ดูแลที่มีทักษะตรงกับงานเท่านั้น งานรับ-ส่งโรงพยาบาลใช้ผู้ดูแลที่มีรถส่วนตัว\n' +
    '4. หากผู้ดูแลลาหรือมีเหตุจำเป็น ศูนย์จัดผู้ดูแลแทนให้ เพื่อไม่ให้การดูแลสะดุด\n' +
    '5. ผู้ดูแลได้รับรายละเอียดงาน ข้อควรระวัง และเบอร์ติดต่อญาติล่วงหน้าก่อนเริ่มงาน 24 ชั่วโมง\n' +
    '6. ศูนย์บันทึกหลักฐานการชำระเงินทุกรายการ ตรวจสอบย้อนหลังได้'],
  ['history', 'ความเป็นมาของศูนย์',
    'ศูนย์ดวงใจกตัญญูเกิดจากความตั้งใจที่จะช่วยครอบครัวในชุมชนดูแลผู้ป่วยและผู้สูงอายุ ' +
    'ด้วยใจ ซื่อสัตย์ ปลอดภัย และวางใจได้ดั่งญาติสนิท\n\n' +
    '(แก้ไขข้อความนี้ได้ที่แผ่นงาน "เกี่ยวกับศูนย์" ใน Google Sheet เช่น ปีที่ก่อตั้ง ผู้ก่อตั้ง พื้นที่ให้บริการ และช่องทางติดต่อ)'],
];

/** ชื่อแผ่นงานเดิมที่ยังรองรับ — setupSheets จะเปลี่ยนชื่อเป็นชื่อใหม่ให้ (ข้อมูลและสูตรอ้างอิงตามไปด้วย) */
const SHEET_ALIASES = {
  [SHEET.SERVICES]: ['Service_Catalog', 'บริการของศุนย์ทั้งหมด'],
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
      ['service_code', 'รหัสบริการ (จากแผ่น บริการของศูนย์ทั้งหมด)'],
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
  [SHEET.ABOUT]: {
    title: 'ข้อมูลเกี่ยวกับศูนย์ (แสดงบนหน้าเว็บจองบริการ)',
    idField: 'section_key',
    idPrefix: 'S-',
    fields: [
      ['section_key', 'รหัสหัวข้อ (guarantee = หนังสือรับประกัน, history = ความเป็นมา) เพิ่มแถวใหม่ได้'],
      ['title', 'หัวข้อที่แสดงบนหน้าเว็บ'],
      ['content', 'เนื้อหา (ขึ้นบรรทัดใหม่ในเซลล์ด้วย Ctrl+Enter)'],
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
  const sh = findSheet_(ss(), name);
  if (!sh) throw new Error('ไม่พบแผ่นงาน "' + name + '" กรุณารันเมนู "ติดตั้ง/ตรวจสอบโครงสร้างแผ่นงาน" ก่อน');
  return sh;
}

/**
 * หาแผ่นงาน: 1) ชื่อปัจจุบัน 2) ชื่อเดิมใน SHEET_ALIASES
 * 3) แผ่นใดก็ได้ที่แถว 3 มีชื่อฟิลด์ตรงกับโครงสร้าง (กรณีมีคนเปลี่ยนชื่อแท็บเอง)
 */
function findSheet_(book, name) {
  const sh = book.getSheetByName(name);
  if (sh) return sh;
  const old = (SHEET_ALIASES[name] || []).map(n => book.getSheetByName(n)).filter(Boolean)[0];
  if (old) return old;
  const schema = SCHEMA[name];
  if (!schema) return null;
  const fields = schema.fields.filter(f => !(f[2] && f[2].extra)).map(f => f[0]);
  return book.getSheets().find(s => {
    if (s.getLastColumn() === 0 || s.getLastRow() < CONFIG.HEADER_ROW) return false;
    const headers = s.getRange(CONFIG.HEADER_ROW, 1, 1, s.getLastColumn()).getValues()[0].map(h => String(h).trim());
    return headers.indexOf(schema.idField) >= 0 && fields.filter(f => headers.indexOf(f) >= 0).length >= Math.min(4, fields.length);
  }) || null;
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
    // ข้อมูลเปลี่ยน → ล้างข้อมูลหน้าเว็บจองบริการที่ cache ไว้ (วันว่าง/งานที่ให้บริการอยู่)
    try { CacheService.getScriptCache().remove('public_site'); } catch (e) { /* ไม่เป็นไร */ }
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
 * บริการ / ราคา (Auto-fill จากแผ่น "บริการของศูนย์ทั้งหมด" เท่านั้น)
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

    // ราคาดึงจากแผ่น "บริการของศูนย์ทั้งหมด" เสมอ ไม่รับตัวเลขจากหน้าฟอร์ม
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

/**
 * ข้อมูลหน้าเว็บจองบริการทั้งหมดในครั้งเดียว:
 * หนังสือรับประกัน/ความเป็นมา, บริการ, ประวัติผู้รับจ้างแต่ละบริการ, จำนวนคนว่างรายวัน, งานที่กำลังให้บริการ
 * เป็นหน้าสาธารณะ จึงไม่ส่งเลขบัตร เบอร์โทร นามสกุลเต็ม หรือชื่อผู้ป่วยออกไป
 */
function getPublicSite() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('public_site');
  if (hit) return JSON.parse(hit);

  const ctx = loadCtx_();
  const services = ctx.services.filter(s => toNum_(s.client_price) > 0);
  const now = new Date();
  const doneCount = {};
  ctx.jobs.forEach(j => {
    if (j.job_status === STATUS.JOB.DONE) doneCount[j.worker_id] = (doneCount[j.worker_id] || 0) + 1;
  });

  const shown = ctx.workers.filter(w => w.status !== STATUS.WORKER.RESIGNED &&
    (!CONFIG.REQUIRE_POLICE_CHECK || w.police_check_status === STATUS.POLICE.PASSED));
  const workers = shown.map(w => {
    const since = toDate_(w.contract_signed_date);
    return {
      key: w.worker_id,
      name: publicName_(w),
      area: w.village_moo || '',
      skills: splitTags_(w.skill_tags),
      has_car: toBool_(w.has_car),
      police_ok: w.police_check_status === STATUS.POLICE.PASSED,
      ready: w.status === STATUS.WORKER.READY,
      status: w.status || '',
      done_jobs: doneCount[w.worker_id] || 0,
      since: since ? Utilities.formatDate(since, CONFIG.TZ, 'yyyy-MM-dd') : '',
    };
  });

  // จำนวนผู้รับจ้างที่ว่างทั้งวัน ล่วงหน้า 14 วัน แยกตามบริการ
  const days = [];
  for (let i = 0; i < 14; i++) days.push(startOfDay_(new Date(now.getTime() + i * 86400000)));
  const availability = services.map(svc => ({
    service_code: svc.service_code,
    counts: days.map(d => ctx.workers.filter(w =>
      evaluateWorker_(w, svc, d, endOfDay_(d), ctx, null).length === 0).length),
  }));

  const ongoing = ctx.jobs
    .filter(j => j.job_status !== STATUS.JOB.CANCELLED && j.job_status !== STATUS.JOB.DONE)
    .filter(j => { const e = toDate_(j.end_datetime); return e && e >= now; })
    .sort((a, b) => toDate_(a.start_datetime) - toDate_(b.start_datetime))
    .slice(0, 50)
    .map(j => {
      const svc = byId_(ctx.services, 'service_code', j.service_code);
      const w = j.worker_id ? byId_(ctx.workers, 'worker_id', j.worker_id) : null;
      const s = toDate_(j.start_datetime);
      return {
        service_name: svc ? svc.service_name : j.service_code,
        start: Utilities.formatDate(s, CONFIG.TZ, "yyyy-MM-dd'T'HH:mm"),
        end: Utilities.formatDate(toDate_(j.end_datetime), CONFIG.TZ, "yyyy-MM-dd'T'HH:mm"),
        worker: w ? publicName_(w) : '',
        state: j.job_status === STATUS.JOB.ACTIVE || s <= now ? 'active' : (w ? 'scheduled' : 'waiting'),
      };
    });

  let about = [];
  try {
    about = readTable_(SHEET.ABOUT).map(r => ({ key: r.section_key, title: r.title, content: String(r.content || '') }));
  } catch (e) { /* ยังไม่ได้สร้างแผ่น "เกี่ยวกับศูนย์" */ }
  if (!about.length) about = ABOUT_DEFAULTS.map(r => ({ key: r[0], title: r[1], content: r[2] }));

  const out = {
    centerName: CONFIG.CENTER_NAME,
    slogan: CONFIG.SLOGAN,
    conditions: OPTIONS.patient_condition,
    about: about,
    services: services.map(s => ({
      service_code: s.service_code,
      service_name: s.service_name,
      unit_type: s.unit_type,
      client_price: toNum_(s.client_price),
      requires_car: serviceRequiresCar_(s),
      worker_keys: shown.filter(w => workerHasSkill_(w, s) && (!serviceRequiresCar_(s) || toBool_(w.has_car))).map(w => w.worker_id),
    })),
    workers: workers,
    days: days.map(d => Utilities.formatDate(d, CONFIG.TZ, 'yyyy-MM-dd')),
    availability: availability,
    ongoing: ongoing,
    updated: Utilities.formatDate(now, CONFIG.TZ, "yyyy-MM-dd'T'HH:mm"),
  };
  try { cache.put('public_site', JSON.stringify(out), 120); } catch (e) { /* ข้อมูลใหญ่เกิน cache ก็ไม่เป็นไร */ }
  return out;
}

/** ชื่อที่แสดงต่อสาธารณะ: ชื่อจริง + อักษรแรกของนามสกุล (+ ชื่อเล่น) */
function publicName_(w) {
  const parts = String(w.full_name || '').trim().split(/\s+/);
  const name = parts[0] + (parts[1] ? ' ' + parts[1].charAt(0) + '.' : '');
  return (w.nickname ? 'คุณ' + w.nickname + ' · ' : '') + name;
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
    let sh = findSheet_(book, name);
    if (sh && sh.getName() !== name) {
      // เปลี่ยนชื่อแผ่นเดิม (ข้อมูลอยู่ครบ และสูตรที่อ้างถึงจะเปลี่ยนชื่อตามอัตโนมัติ)
      report.push('✏️ เปลี่ยนชื่อแผ่นงาน "' + sh.getName() + '" เป็น "' + name + '"');
      sh.setName(name);
    }
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

  resetCaches_();
  if (seedAboutSheet_()) report.push('📝 ใส่ข้อความตั้งต้นในแผ่น "' + SHEET.ABOUT + '" แล้ว (แก้ไขได้ในชีต)');

  applyConditionalFormats_(book);
  if (!book.getSheetByName(SHEET.DASHBOARD)) {
    buildDashboardSheet_(book);
    report.push('➕ สร้างแผ่นงาน ' + SHEET.DASHBOARD);
  }
  resetCaches_();

  const missingProps = ['ADMIN_PIN', 'LINE_CHANNEL_ACCESS_TOKEN', 'LINE_CENTER_TARGET_ID'].filter(k => !prop_(k));
  if (missingProps.length) report.push('⚠️ ยังไม่ได้ตั้ง Script Properties: ' + missingProps.join(', '));

  notify_('ตรวจสอบโครงสร้างเรียบร้อย\n\n' + (report.length ? report.join('\n') : 'โครงสร้างครบถ้วนแล้ว ✅'));
}

/** ใส่หนังสือรับประกัน/ความเป็นมาตั้งต้น เฉพาะตอนที่แผ่น "เกี่ยวกับศูนย์" ยังว่าง */
function seedAboutSheet_() {
  if (readTable_(SHEET.ABOUT).length) return false;
  ABOUT_DEFAULTS.forEach(r => insertRow_(SHEET.ABOUT, { section_key: r[0], title: r[1], content: r[2] }));
  const sh = getSheet_(SHEET.ABOUT);
  sh.setColumnWidth(3, 640);
  sh.getRange(CONFIG.DATA_START_ROW, 3, ABOUT_DEFAULTS.length, 1).setWrap(true).setVerticalAlignment('top');
  return true;
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
  notify_('✅ เปิดการแจ้งเตือนอัตโนมัติแล้ว\nระบบจะตรวจทุกชั่วโมง และส่ง LINE เตือนคนทำงานก่อนเริ่มงาน 24 ชม.');
}

function testLine() {
  const ok = notifyCenter_('✅ ทดสอบการแจ้งเตือนจาก ' + CONFIG.CENTER_NAME + '\n' + CONFIG.SLOGAN);
  notify_(ok
    ? 'ส่ง LINE สำเร็จ ✅'
    : 'ส่งไม่สำเร็จ ❌\nตรวจสอบ Script Properties: LINE_CHANNEL_ACCESS_TOKEN และ LINE_CENTER_TARGET_ID\n(ดูรายละเอียดใน Executions log)');
}

function showWebAppLinks() {
  const url = ScriptApp.getService().getUrl();
  if (!url) {
    notify_('ยังไม่ได้ Deploy เว็บแอป\nไปที่ Extensions > Apps Script > Deploy > New deployment > Web app');
    return;
  }
  const link = (label, href) => '<p><b>' + label + '</b><br><a href="' + href + '" target="_blank">' + href + '</a></p>';
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;font-size:13px">' +
    link('หน้าผู้จัดการศูนย์', url) +
    link('ฟอร์มลูกค้าจองบริการ', url + '?page=จองบริการ') +
    link('ฟอร์มผู้รับจ้างยื่นลา', url + '?page=ยื่นใบลา') +
    '</div>').setWidth(520).setHeight(260);
  SpreadsheetApp.getUi().showModalDialog(html, 'ลิงก์ระบบ ' + CONFIG.CENTER_NAME);
}

/** แสดงผลเป็นกล่องข้อความในชีต ถ้ารันจาก Apps Script editor ที่ไม่ได้ผูกกับชีต จะแสดงใน Execution log แทน */
function notify_(msg) {
  console.log(msg);
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    // ไม่มีหน้าต่างชีตให้แสดง — ข้อความอยู่ใน Execution log แล้ว
  }
  return msg;
}

/* ======================= WebApp.gs ======================= */

/**
 * เว็บแอป
 *   /exec                  หน้าผู้จัดการศูนย์ (ต้องใส่ ADMIN_PIN)
 *   /exec?page=จองบริการ   ฟอร์มลูกค้าจองบริการ  (ลิงก์เดิม ?page=book ยังใช้ได้)
 *   /exec?page=ยื่นใบลา    ฟอร์มผู้รับจ้างยื่นลา   (ลิงก์เดิม ?page=leave ยังใช้ได้)
 */
const PAGE_NAMES = { book: 'จองบริการ', leave: 'ยื่นใบลา' };

function pageKey_(raw) {
  const p = String(raw || '').trim();
  if (PAGE_NAMES[p]) return p;
  return Object.keys(PAGE_NAMES).find(k => PAGE_NAMES[k] === p) || '';
}

function doGet(e) {
  const page = pageKey_(e && e.parameter && e.parameter.page);
  const isPublic = page === 'book' || page === 'leave';
  const tpl = HtmlService.createTemplate(htmlSource_(isPublic ? 'Public' : 'Index'));
  tpl.mode = page;
  tpl.centerName = CONFIG.CENTER_NAME;
  tpl.slogan = CONFIG.SLOGAN;
  tpl.version = CONFIG.VERSION;
  return tpl.evaluate()
    .setTitle(CONFIG.CENTER_NAME + (page === 'book' ? ' · จองบริการ' : page === 'leave' ? ' · ยื่นใบลา' : ' · ผู้จัดการ'))
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include_(name) {
  return htmlSource_(name);
}

/**
 * ไฟล์รวม apps-script/Code.gs ฝัง HTML ไว้ใน HTML_FILES_ (วางไฟล์เดียวก็ใช้ได้)
 * ถ้าไม่มี จะอ่านจากไฟล์ HTML ในโปรเจกต์ตามปกติ
 */
function htmlSource_(name) {
  if (typeof HTML_FILES_ !== 'undefined' && HTML_FILES_[name]) return HTML_FILES_[name];
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ======================= หน้าเว็บ (HTML) ======================= */

const HTML_FILES_ = {
  "Index": "<!DOCTYPE html>\n<html lang=\"th\">\n<head>\n  <base target=\"_top\">\n  <meta charset=\"utf-8\">\n  <?!= include_('Styles'); ?>\n  <style>\n    .login { min-height: 100vh; display: grid; place-items: center; padding: 16px; }\n    .login .card { width: 100%; max-width: 380px; }\n    .login .brand { flex-direction: column; justify-content: center; text-align: center; gap: 8px; margin-bottom: 18px; }\n    .login .brand-slogan { white-space: normal; }\n    .login .brand-logo { width: 76px; height: 76px; }\n\n    .topbar {\n      position: sticky; top: 0; z-index: 10; background: var(--surface);\n      border-bottom: 1px solid var(--line);\n    }\n    .topbar-inner { max-width: 1280px; margin: 0 auto; padding: 10px 16px; display: flex; align-items: center; gap: 12px; }\n    .tabs { max-width: 1280px; margin: 0 auto; padding: 0 16px; display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; }\n    .tabs button {\n      font: inherit; font-weight: 600; font-size: 14px; color: var(--muted);\n      background: none; border: none; border-bottom: 3px solid transparent;\n      padding: 8px 12px 10px; cursor: pointer; white-space: nowrap;\n    }\n    .tabs button.active { color: var(--brand); border-bottom-color: var(--brand); }\n    .tabs .count { display: inline-block; min-width: 20px; padding: 0 6px; margin-left: 4px; border-radius: 999px; background: var(--danger); color: #fff; font-size: 12px; text-align: center; }\n    main { max-width: 1280px; margin: 0 auto; padding: 18px 16px 60px; }\n\n    .page-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }\n    .page-head h2 { font-size: 20px; }\n    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }\n    .toolbar input, .toolbar select { width: auto; min-width: 160px; padding: 6px 10px; font-size: 14px; }\n\n    .tiles { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); margin-bottom: 18px; }\n    .tile { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); padding: 14px 16px; border-top: 3px solid var(--brand); }\n    .tile .k { font-size: 13px; color: var(--muted); }\n    .tile .v { font-size: 26px; font-weight: 700; margin-top: 2px; font-variant-numeric: tabular-nums; }\n    .tile .s { font-size: 12.5px; color: var(--muted); }\n    .tile.alert-tile { border-top-color: var(--danger); background: var(--danger-bg); }\n    .tile.alert-tile .v { color: var(--danger); }\n    .tile.heart { border-top-color: var(--heart); }\n    .two-col { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); }\n    @media (max-width: 480px) { .two-col { grid-template-columns: 1fr; } }\n    .card h3 { font-size: 16px; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }\n    .list-item { padding: 9px 0; border-top: 1px solid var(--line); display: flex; gap: 10px; align-items: center; }\n    .list-item:first-of-type { border-top: none; }\n    .list-item .grow { flex: 1; min-width: 0; }\n    .empty { color: var(--muted); font-size: 14px; padding: 6px 0; }\n\n    .table-wrap { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); overflow-x: auto; }\n    table { width: 100%; border-collapse: collapse; font-size: 14px; }\n    th { text-align: left; font-size: 12.5px; color: var(--muted); font-weight: 600; padding: 10px 12px; background: #fafbfb; border-bottom: 1px solid var(--line); white-space: nowrap; }\n    td { padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }\n    tr:last-child td { border-bottom: none; }\n    tr.row-danger td:first-child { box-shadow: inset 4px 0 0 var(--danger); }\n    td .sub { font-size: 12.5px; color: var(--muted); }\n    td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }\n    td.actions { white-space: nowrap; text-align: right; }\n\n    dialog { border: none; border-radius: 14px; padding: 0; width: min(720px, calc(100vw - 24px)); max-height: calc(100vh - 32px); box-shadow: 0 20px 60px rgba(0,0,0,.25); }\n    dialog::backdrop { background: rgba(16, 30, 27, .45); }\n    .modal-head { padding: 16px 20px; border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 10px; position: sticky; top: 0; background: #fff; z-index: 1; }\n    .modal-head h3 { font-size: 17px; flex: 1; }\n    .modal-body { padding: 16px 20px 20px; }\n    .modal-actions { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line); }\n    .price-box { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }\n    .price-box > div { background: var(--brand-soft); border-radius: 10px; padding: 8px 10px; }\n    .price-box .k { font-size: 12px; color: var(--brand-strong); }\n    .price-box .v { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }\n    @media (max-width: 480px) { .price-box { grid-template-columns: 1fr; } }\n    .client-info { font-size: 13px; background: #fafbfb; border: 1px dashed var(--line); border-radius: 10px; padding: 8px 12px; }\n    details.excluded { font-size: 13px; margin-top: 6px; }\n    details.excluded summary { cursor: pointer; color: var(--muted); }\n    details.excluded li { margin: 3px 0; }\n    .skill-box { display: flex; flex-wrap: wrap; gap: 6px 14px; }\n    .link-row { display: flex; gap: 8px; align-items: center; }\n    .link-row input { font-size: 13px; }\n  </style>\n</head>\n<body>\n  <!-- ===== Login ===== -->\n  <div id=\"login\" class=\"login\">\n    <form class=\"card\" id=\"loginForm\">\n      <div class=\"brand\">\n        <img class=\"brand-logo\" src=\"https://tannamnaja-ui.github.io/carecenter/logo.jpg\" alt=\"โลโก้ศูนย์ดวงใจกตัญญู\">\n        <div>\n          <div class=\"brand-name\"><?= centerName ?></div>\n          <div class=\"brand-version\">เวอร์ชัน <?= version ?></div>\n          <div class=\"brand-slogan\"><?= slogan ?></div>\n        </div>\n      </div>\n      <div class=\"stack\">\n        <label class=\"field\">รหัสผู้จัดการศูนย์\n          <input type=\"password\" id=\"pinInput\" autocomplete=\"current-password\" required autofocus>\n        </label>\n        <div id=\"loginError\" class=\"alert alert-danger\" hidden></div>\n        <button class=\"btn btn-primary\" style=\"width:100%\" id=\"loginBtn\">เข้าสู่ระบบ</button>\n      </div>\n    </form>\n  </div>\n\n  <!-- ===== App ===== -->\n  <div id=\"app\" hidden>\n    <header class=\"topbar\">\n      <div class=\"topbar-inner\">\n        <div class=\"brand\">\n          <img class=\"brand-logo\" src=\"https://tannamnaja-ui.github.io/carecenter/logo.jpg\" alt=\"โลโก้ศูนย์ดวงใจกตัญญู\">\n          <div style=\"min-width:0\">\n            <div class=\"brand-name\"><?= centerName ?></div>\n            <div class=\"brand-version\">เวอร์ชัน <?= version ?></div>\n            <div class=\"brand-slogan\"><?= slogan ?></div>\n          </div>\n        </div>\n        <span class=\"spacer\"></span>\n        <span id=\"loading\" class=\"spinner\" hidden></span>\n        <button class=\"btn btn-sm\" id=\"refreshBtn\" title=\"โหลดข้อมูลใหม่\">↻ รีเฟรช</button>\n        <button class=\"btn btn-sm btn-ghost\" id=\"logoutBtn\">ออกจากระบบ</button>\n      </div>\n      <nav class=\"tabs\" id=\"tabs\"></nav>\n    </header>\n    <main id=\"main\"></main>\n  </div>\n\n  <dialog id=\"modal\">\n    <div class=\"modal-head\"><h3 id=\"modalTitle\"></h3><button class=\"btn btn-sm btn-ghost\" data-close>✕</button></div>\n    <div class=\"modal-body\" id=\"modalBody\"></div>\n  </dialog>\n  <div id=\"toast\" hidden></div>\n\n<script>\n/* ============================================================\n * State & helpers\n * ============================================================ */\nconst S = { pin: '', d: null, tab: 'dashboard', jobFilter: 'open', jobSearch: '', payFilter: '', leaveFilter: '' };\ntry { S.pin = sessionStorage.getItem('dk_pin') || ''; } catch (e) {}\n\nconst $ = (sel, el = document) => el.querySelector(sel);\nconst $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));\nconst esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' }[c]));\nconst num = v => Number(String(v ?? '').replace(/[^\\d.-]/g, '')) || 0;\nconst baht = v => num(v).toLocaleString('th-TH') + ' ฿';\n\nfunction api(fn, ...args) {\n  return new Promise((resolve, reject) => {\n    google.script.run.withSuccessHandler(resolve).withFailureHandler(e => reject(e)) [fn](...args);\n  });\n}\nfunction errMsg(e) { return (e && e.message ? e.message : String(e)).replace(/^Error:\\s*/, ''); }\n\nlet toastTimer;\nfunction toast(msg, isError) {\n  const t = $('#toast');\n  t.textContent = msg;\n  t.className = isError ? 'error' : '';\n  t.hidden = false;\n  clearTimeout(toastTimer);\n  toastTimer = setTimeout(() => { t.hidden = true; }, isError ? 7000 : 4000);\n}\n\n/** \"2026-10-20T08:00\" → \"20/10/2569 08:00\" (ไม่ผ่าน Date เพื่อเลี่ยงปัญหา timezone) */\nfunction fmt(s, withTime = true) {\n  const m = String(s || '').match(/^(\\d{4})-(\\d{2})-(\\d{2})(?:T(\\d{2}):(\\d{2}))?/);\n  if (!m) return s ? esc(s) : '-';\n  return `${m[3]}/${m[2]}/${+m[1] + 543}` + (withTime && m[4] ? ` ${m[4]}:${m[5]}` : '');\n}\nfunction nowLocal() {\n  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());\n  return d.toISOString().slice(0, 16);\n}\nconst today = () => nowLocal().slice(0, 10);\nconst dayDiff = (a, b) => {\n  const p = s => { const m = s.split('-'); return Date.UTC(+m[0], +m[1] - 1, +m[2]); };\n  return Math.round((p(b) - p(a)) / 864e5);\n};\n\nconst W = id => S.d.workers.find(w => w.worker_id === id);\nconst C = id => S.d.clients.find(c => c.client_id === id);\nconst SV = code => S.d.services.find(s => s.service_code === code);\nconst JOB = id => S.d.jobs.find(j => j.job_id === id);\nconst wName = w => w ? `${w.full_name}${w.nickname ? ' (' + w.nickname + ')' : ''}` : '';\nconst phone = v => { let d = String(v || '').replace(/\\D/g, ''); if (d.length === 9 && d[0] !== '0') d = '0' + d; return d; };\n\nconst BADGE = {\n  payment: { 'รอชำระ': 'b-danger', 'ชำระแล้ว': 'b-ok' },\n  job: { 'รอยืนยัน': 'b-warn', 'กำลังปฏิบัติงาน': 'b-info', 'เสร็จสิ้น': 'b-ok', 'ยกเลิก': '' },\n  worker: { 'พร้อมรับงาน': 'b-ok', 'ติดเคส': 'b-info', 'ลาพัก': 'b-warn', 'พ้นสภาพ': '' },\n  police: { 'ผ่าน': 'b-ok', 'รอดำเนินการ': 'b-warn', 'ไม่ผ่าน': 'b-danger' },\n  payout: { 'เรียบร้อย': 'b-ok', 'รอโอน': 'b-warn', 'โอนแล้ว': 'b-ok' },\n  leave: { 'อนุมัติแล้ว': 'b-ok', 'รอตรวจสอบ': 'b-warn', 'ไม่อนุมัติ': 'b-danger' },\n  trans: { 'รับจากลูกค้า': 'b-ok', 'จ่ายให้คนทำงาน': 'b-info' },\n};\nconst badge = (type, v) => `<span class=\"badge ${(BADGE[type] || {})[v] || ''}\">${esc(v || '-')}</span>`;\nconst options = (list, selected, placeholder) =>\n  (placeholder !== undefined ? `<option value=\"\">${esc(placeholder)}</option>` : '') +\n  list.map(o => {\n    const [val, label] = Array.isArray(o) ? o : [o, o];\n    return `<option value=\"${esc(val)}\" ${String(val) === String(selected ?? '') ? 'selected' : ''}>${esc(label)}</option>`;\n  }).join('');\nconst formData = form => {\n  const o = {};\n  new FormData(form).forEach((v, k) => { if (k in o) o[k] = [].concat(o[k], v); else o[k] = v; });\n  return o;\n};\nconst isUnpaid = j => j.payment_status !== S.d.status.PAYMENT.PAID && j.job_status !== S.d.status.JOB.CANCELLED;\nconst noRelease = j => isUnpaid(j) && j.worker_id && j.job_status !== S.d.status.JOB.DONE;\n\n/* ============================================================\n * Login / load\n * ============================================================ */\n$('#loginForm').addEventListener('submit', async e => {\n  e.preventDefault();\n  S.pin = $('#pinInput').value.trim();\n  $('#loginBtn').disabled = true;\n  $('#loginError').hidden = true;\n  try {\n    await load();\n    try { sessionStorage.setItem('dk_pin', S.pin); } catch (e) {}\n    $('#login').hidden = true;\n    $('#app').hidden = false;\n  } catch (err) {\n    $('#loginError').textContent = errMsg(err);\n    $('#loginError').hidden = false;\n  } finally {\n    $('#loginBtn').disabled = false;\n  }\n});\n$('#logoutBtn').onclick = () => {\n  try { sessionStorage.removeItem('dk_pin'); } catch (e) {}\n  location.reload();\n};\n$('#refreshBtn').onclick = () => load().then(() => toast('โหลดข้อมูลล่าสุดแล้ว')).catch(e => toast(errMsg(e), true));\n\nasync function load() {\n  $('#loading').hidden = false;\n  try {\n    S.d = await api('getAppData', S.pin);\n    render();\n  } finally {\n    $('#loading').hidden = true;\n  }\n}\n\nif (S.pin) {\n  load().then(() => { $('#login').hidden = true; $('#app').hidden = false; })\n    .catch(() => { S.pin = ''; });\n}\n\n/* ============================================================\n * Tabs\n * ============================================================ */\nconst TABS = [\n  ['dashboard', 'ภาพรวม'], ['jobs', 'ใบงาน'], ['workers', 'ผู้รับจ้าง'], ['clients', 'ลูกค้า / ผู้ป่วย'],\n  ['services', 'บริการและราคา'], ['payments', 'การเงิน'], ['leaves', 'การลา'], ['links', 'ลิงก์ & LINE'],\n];\nfunction render() {\n  const d = S.d.dashboard;\n  const counts = { jobs: d.unpaidJobIds.length, leaves: d.pendingLeaveIds.length, payments: d.pendingPayoutCount };\n  $('#tabs').innerHTML = TABS.map(([k, label]) =>\n    `<button data-tab=\"${k}\" class=\"${S.tab === k ? 'active' : ''}\">${label}${counts[k] ? `<span class=\"count\">${counts[k]}</span>` : ''}</button>`).join('');\n  $$('#tabs button').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; render(); });\n  const fn = { dashboard: renderDashboard, jobs: renderJobs, workers: renderWorkers, clients: renderClients,\n    services: renderServices, payments: renderPayments, leaves: renderLeaves, links: renderLinks }[S.tab];\n  $('#main').innerHTML = fn();\n  bindActions();\n}\n\n/** ปุ่มทั้งหมดใช้ data-act=\"ชื่อ\" data-id=\"...\" */\nconst ACTIONS = {\n  newJob: () => openJobForm(), editJob: id => openJobForm(id),\n  newWorker: () => openWorkerForm(), editWorker: id => openWorkerForm(id),\n  newClient: () => openClientForm(), editClient: id => openClientForm(id),\n  newService: () => openServiceForm(), editService: id => openServiceForm(id),\n  newPayment: id => openPaymentForm(null, id), editPayment: id => openPaymentForm(id),\n  payout: id => openPaymentForm(id),\n  newLeave: () => openLeaveForm(), reviewLeave: id => openLeaveReview(id),\n  goto: tab => { S.tab = tab; render(); },\n  copy: id => { const el = document.getElementById(id); el.select(); document.execCommand('copy'); toast('คัดลอกลิงก์แล้ว'); },\n};\nfunction bindActions(root = document) {\n  $$('[data-act]', root).forEach(el => el.onclick = e => { e.preventDefault(); ACTIONS[el.dataset.act](el.dataset.id); });\n  $$('[data-bind]', root).forEach(el => {\n    el.oninput = () => { S[el.dataset.bind] = el.value; const pos = el.selectionStart; render(); const n = $(`[data-bind=\"${el.dataset.bind}\"]`); n.focus(); if (n.setSelectionRange && pos != null) n.setSelectionRange(pos, pos); };\n  });\n}\n\n/* ============================================================\n * Dashboard\n * ============================================================ */\nfunction renderDashboard() {\n  const d = S.d.dashboard;\n  const tile = (k, v, s, cls = '') => `<div class=\"tile ${cls}\"><div class=\"k\">${k}</div><div class=\"v\">${v}</div>${s ? `<div class=\"s\">${s}</div>` : ''}</div>`;\n  const jobLine = j => {\n    const c = C(j.client_id) || {};\n    return `<div class=\"list-item\">\n      <div class=\"grow\"><b>${esc(j.job_id)}</b> · ${esc(c.patient_name || j.client_id)}\n        <div class=\"small muted\">${fmt(j.start_datetime)} · ${esc((SV(j.service_code) || {}).service_name || j.service_code)}</div></div>\n      ${noRelease(j) ? '<span class=\"tag-red\">ห้ามปล่อยคน</span>' : ''}\n      <span class=\"small\">${baht(j.total_client_amount)}</span>\n      <button class=\"btn btn-sm\" data-act=\"editJob\" data-id=\"${esc(j.job_id)}\">เปิด</button></div>`;\n  };\n  const list = (ids, fn, empty) => ids.length ? ids.map(fn).join('') : `<div class=\"empty\">${empty}</div>`;\n  const unpaid = d.unpaidJobIds.map(JOB).filter(Boolean);\n  return `\n  <div class=\"page-head\"><h2>ภาพรวมศูนย์</h2></div>\n  <div class=\"tiles\">\n    ${tile('ยอดรายรับรวมจากลูกค้า', baht(d.totalClient), 'ไม่รวมใบงานที่ยกเลิก')}\n    ${tile('รายได้สุทธิของศูนย์', baht(d.totalCenter), 'กำไรสะสมจากค่าบริหาร', 'heart')}\n    ${tile('ค่าจ้างคนทำงานทั้งหมด', baht(d.totalWorker), d.pendingPayoutCount ? `รอโอน ${d.pendingPayoutCount} รายการ · ${baht(d.pendingPayoutSum)}` : 'ไม่มีค้างโอน')}\n    ${tile('งานทั้งหมด', d.jobsTotal, `สำเร็จ ${d.jobsDone} · กำลังทำ ${d.jobsActive} · รอยืนยัน ${d.jobsPending}`)}\n    ${tile('⚠️ ใบงานรอลูกค้าชำระ', d.unpaidJobIds.length, 'ห้ามปล่อยคนลงพื้นที่', d.unpaidJobIds.length ? 'alert-tile' : '')}\n    ${tile('คนทำงานพร้อมลงงานทันที', d.readyWorkers, `จากทั้งหมด ${S.d.workers.length} คน`)}\n  </div>\n  <div class=\"two-col\">\n    <div class=\"card\"><h3>⛔ รอลูกค้าชำระเงิน <span class=\"badge b-danger\">${unpaid.length}</span></h3>\n      ${list(unpaid, jobLine, 'ไม่มีใบงานค้างชำระ 🎉')}</div>\n    <div class=\"card\"><h3>👤 ยังไม่ได้จัดคนทำงาน <span class=\"badge b-warn\">${d.unassignedJobIds.length}</span></h3>\n      ${list(d.unassignedJobIds.map(JOB).filter(Boolean), jobLine, 'ทุกใบงานมีคนรับผิดชอบแล้ว')}</div>\n    <div class=\"card\"><h3>📝 ใบลารอพิจารณา <span class=\"badge b-warn\">${d.pendingLeaveIds.length}</span></h3>\n      ${list(d.pendingLeaveIds.map(id => S.d.leaves.find(l => l.leave_id === id)).filter(Boolean), l => `\n        <div class=\"list-item\"><div class=\"grow\"><b>${esc(l.leave_id)}</b> · ${esc(wName(W(l.worker_id)) || l.worker_id)}\n          <div class=\"small muted\">หยุด ${fmt(l.leave_start_date, false)} – ${fmt(l.leave_end_date, false)} · แจ้งล่วงหน้า ${esc(l.notice_days)} วัน</div></div>\n          ${l._late ? `<span class=\"tag-red\">${esc(S.d.config.lateLeaveTag)}</span>` : ''}\n          <button class=\"btn btn-sm\" data-act=\"reviewLeave\" data-id=\"${esc(l.leave_id)}\">พิจารณา</button></div>`, 'ไม่มีใบลาค้าง')}</div>\n    <div class=\"card\"><h3>⏰ งานที่จะเริ่มใน 48 ชม.</h3>\n      ${list(d.upcomingJobIds.map(JOB).filter(Boolean), jobLine, 'ไม่มีงานใน 48 ชม.ข้างหน้า')}</div>\n  </div>`;\n}\n\n/* ============================================================\n * Jobs\n * ============================================================ */\nfunction renderJobs() {\n  const st = S.d.status.JOB;\n  const q = S.jobSearch.trim().toLowerCase();\n  const rows = S.d.jobs.filter(j => {\n    if (S.jobFilter === 'open' && (j.job_status === st.DONE || j.job_status === st.CANCELLED)) return false;\n    if (S.jobFilter === 'unpaid' && !isUnpaid(j)) return false;\n    if (S.jobFilter === 'unassigned' && j.worker_id) return false;\n    if (S.jobFilter && !['open', 'unpaid', 'unassigned'].includes(S.jobFilter) && j.job_status !== S.jobFilter) return false;\n    if (!q) return true;\n    const c = C(j.client_id) || {}, w = W(j.worker_id) || {};\n    return [j.job_id, c.client_name, c.patient_name, w.full_name, w.nickname, j.hospital_location].join(' ').toLowerCase().includes(q);\n  }).sort((a, b) => String(b.start_datetime).localeCompare(String(a.start_datetime)));\n\n  return `\n  <div class=\"page-head\"><h2>ใบงานและการนัดหมาย</h2><span class=\"spacer\"></span>\n    <div class=\"toolbar\">\n      <input type=\"search\" placeholder=\"ค้นหา รหัส / ชื่อ / สถานที่\" value=\"${esc(S.jobSearch)}\" data-bind=\"jobSearch\">\n      <select data-bind=\"jobFilter\">${options([['open', 'งานที่ยังไม่ปิด'], ['', 'ทั้งหมด'], ['unpaid', '⚠️ รอชำระ'], ['unassigned', 'ยังไม่จัดคน'],\n        ...S.d.options.job_status.map(s => [s, s])], S.jobFilter)}</select>\n      <button class=\"btn btn-primary\" data-act=\"newJob\">+ สร้างใบงาน</button>\n    </div></div>\n  <div class=\"table-wrap\"><table>\n    <thead><tr><th>ใบงาน</th><th>วันเวลา</th><th>ผู้ป่วย / ผู้ว่าจ้าง</th><th>บริการ</th><th>ผู้รับจ้าง</th><th style=\"text-align:right\">ยอดเงิน</th><th>ชำระ</th><th>สถานะงาน</th><th></th></tr></thead>\n    <tbody>${rows.map(j => {\n      const c = C(j.client_id) || {}, w = W(j.worker_id), s = SV(j.service_code) || {};\n      return `<tr class=\"${noRelease(j) ? 'row-danger' : ''}\">\n        <td><b>${esc(j.job_id)}</b>${noRelease(j) ? '<div><span class=\"tag-red\">ห้ามปล่อยคน</span></div>' : ''}</td>\n        <td>${fmt(j.start_datetime)}<div class=\"sub\">ถึง ${fmt(j.end_datetime)}</div></td>\n        <td>${esc(c.patient_name || '-')}<div class=\"sub\">${esc(c.client_name || j.client_id)} · ${esc(phone(c.client_phone))}</div></td>\n        <td>${esc(s.service_name || j.service_code)}<div class=\"sub\">${esc(j.hospital_location || '')}</div></td>\n        <td>${w ? esc(wName(w)) + `<div class=\"sub\">${esc(w.worker_id)}</div>` : '<span class=\"badge b-warn\">ยังไม่จัดคน</span>'}</td>\n        <td class=\"num\">${baht(j.total_client_amount)}<div class=\"sub\">ศูนย์ ${baht(j.total_center_fee)} · คนงาน ${baht(j.total_worker_wage)}</div></td>\n        <td>${badge('payment', j.payment_status)}${isUnpaid(j) && j._paid ? `<div class=\"sub\">รับแล้ว ${baht(j._paid)}</div>` : ''}</td>\n        <td>${badge('job', j.job_status)}</td>\n        <td class=\"actions\">${isUnpaid(j) ? `<button class=\"btn btn-sm\" data-act=\"newPayment\" data-id=\"${esc(j.job_id)}\">รับเงิน</button> ` : ''}<button class=\"btn btn-sm\" data-act=\"editJob\" data-id=\"${esc(j.job_id)}\">แก้ไข</button></td>\n      </tr>`;\n    }).join('') || '<tr><td colspan=\"9\" class=\"empty\">ไม่พบใบงาน</td></tr>'}</tbody></table></div>`;\n}\n\nfunction openModal(title, html) {\n  $('#modalTitle').textContent = title;\n  $('#modalBody').innerHTML = html;\n  const dlg = $('#modal');\n  if (!dlg.open) dlg.showModal();\n  $$('[data-close]', dlg).forEach(b => b.onclick = () => dlg.close());\n  bindActions($('#modalBody'));\n}\nconst closeModal = () => $('#modal').close();\n\nasync function submitWith(form, fn) {\n  const btn = $('button[type=submit]', form);\n  btn.disabled = true;\n  const old = btn.textContent;\n  btn.innerHTML = '<span class=\"spinner\"></span> กำลังบันทึก';\n  try {\n    await fn();\n  } catch (e) {\n    toast(errMsg(e), true);\n  } finally {\n    btn.disabled = false;\n    btn.textContent = old;\n  }\n}\n\nfunction openJobForm(id) {\n  const j = id ? JOB(id) : null;\n  const ST = S.d.status;\n  const clientOpts = S.d.clients.map(c => [c.client_id, `${c.client_id} · ${c.patient_name} (ญาติ: ${c.client_name})`]);\n  const svcOpts = S.d.services.map(s => [s.service_code, `${s.service_code} · ${s.service_name} — ${baht(s.client_price)}/${s.unit_type || 'ครั้ง'}`]);\n  openModal(j ? `แก้ไขใบงาน ${j.job_id}` : 'สร้างใบงานใหม่', `\n  <form id=\"jobForm\">\n    <div class=\"grid\">\n      <label class=\"field full\">ผู้ว่าจ้าง / ผู้รับการดูแล\n        <select name=\"client_id\" required>${options(clientOpts, j?.client_id, '— เลือกลูกค้า —')}</select>\n        <span class=\"hint\">ยังไม่มีในรายชื่อ? เพิ่มที่แท็บ \"ลูกค้า / ผู้ป่วย\" ก่อน</span></label>\n      <div class=\"full client-info\" id=\"clientInfo\" hidden></div>\n      <label class=\"field full\">ประเภทบริการ\n        <select name=\"service_code\" required>${options(svcOpts, j?.service_code, '— เลือกบริการ —')}</select></label>\n      <div class=\"full\">\n        <div class=\"price-box\" id=\"priceBox\"></div>\n        <div class=\"small muted\" style=\"margin-top:4px\">🔒 ยอดเงินดึงจากตารางบริการอัตโนมัติ แก้ไขด้วยมือไม่ได้</div>\n      </div>\n      <label class=\"field\">วันเวลาเริ่มงาน <input type=\"datetime-local\" name=\"start_datetime\" required value=\"${esc(j?.start_datetime || '')}\"></label>\n      <label class=\"field\">วันเวลาเสร็จงาน <input type=\"datetime-local\" name=\"end_datetime\" required value=\"${esc(j?.end_datetime || '')}\"></label>\n      <label class=\"field full\">สถานที่ / โรงพยาบาล (ตึก ห้องตรวจ หรือบ้านลูกค้า)\n        <input name=\"hospital_location\" value=\"${esc(j?.hospital_location || '')}\"></label>\n      <div class=\"full\">\n        <label class=\"field\">ผู้รับจ้างที่ส่งไปปฏิบัติงาน\n          <select name=\"worker_id\" id=\"workerSelect\"><option value=\"\">— เลือกบริการและวันเวลาก่อน —</option></select></label>\n        <div class=\"small muted\" id=\"matchInfo\" style=\"margin-top:4px\"></div>\n        <details class=\"excluded\" id=\"excluded\" hidden></details>\n      </div>\n      <label class=\"field\">สถานะการเก็บเงิน <select name=\"payment_status\">${options(S.d.options.payment_status, j?.payment_status || ST.PAYMENT.PENDING)}</select></label>\n      <label class=\"field\">สถานะการปฏิบัติงาน <select name=\"job_status\">${options(S.d.options.job_status, j?.job_status || ST.JOB.PENDING)}</select></label>\n      <div class=\"full\" id=\"payWarn\"></div>\n    </div>\n    <div class=\"row modal-actions\">\n      ${j && isUnpaid(j) ? `<button type=\"button\" class=\"btn\" data-act=\"newPayment\" data-id=\"${esc(j.job_id)}\">บันทึกรับเงิน</button>` : ''}\n      <span class=\"spacer\"></span>\n      <button type=\"button\" class=\"btn\" data-close>ปิด</button>\n      <button type=\"submit\" class=\"btn btn-primary\">บันทึกใบงาน</button>\n    </div>\n  </form>`);\n\n  const f = $('#jobForm');\n  let reqNo = 0;\n\n  const showClient = () => {\n    const c = C(f.client_id.value);\n    const box = $('#clientInfo');\n    box.hidden = !c;\n    if (!c) return;\n    box.innerHTML = `<b>${esc(c.patient_name)}</b> · ${esc(c.patient_condition || '-')}\n      ${c.medical_precautions ? `<div>⚕️ ข้อควรระวัง: ${esc(c.medical_precautions)}</div>` : ''}\n      <div>📍 ${esc(c.address_location || '-')}</div><div>📞 ญาติ: ${esc(c.client_name)} ${esc(phone(c.client_phone))}</div>`;\n    f.hospital_location.placeholder = c.address_location || '';\n  };\n  const showPrice = () => {\n    const s = SV(f.service_code.value);\n    const same = j && s && j.service_code === s.service_code;\n    const v = s ? (same\n      ? [j.total_client_amount, j.total_center_fee, j.total_worker_wage]\n      : [s.total_client_amount, s.total_center_fee, s.total_worker_wage]) : [0, 0, 0];\n    $('#priceBox').innerHTML = [['ราคาเรียกเก็บลูกค้า', v[0]], ['ศูนย์หักค่าบริหาร', v[1]], ['คนทำงานได้รับสุทธิ', v[2]]]\n      .map(([k, n]) => `<div><div class=\"k\">${k}</div><div class=\"v\">${s ? baht(n) : '–'}</div></div>`).join('');\n  };\n  const showPayWarn = () => {\n    const unpaid = f.payment_status.value !== ST.PAYMENT.PAID;\n    const releasing = [ST.JOB.ACTIVE, ST.JOB.DONE].includes(f.job_status.value);\n    const btn = $('button[type=submit]', f);\n    btn.disabled = unpaid && releasing;\n    $('#payWarn').innerHTML = !unpaid ? '' : releasing\n      ? `<div class=\"alert alert-danger\">⛔ ห้ามปล่อยคนลงพื้นที่! ใบงานนี้ยัง \"รอชำระ\" — ต้องบันทึกรับเงินจากลูกค้าก่อนเปลี่ยนสถานะเป็น \"${esc(f.job_status.value)}\"</div>`\n      : `<div class=\"alert alert-warn\">⚠️ ลูกค้ายังไม่ชำระเงิน — บันทึกใบงานได้ แต่ห้ามปล่อยคนลงพื้นที่จนกว่าจะชำระ</div>`;\n  };\n  const loadWorkers = async () => {\n    const sel = $('#workerSelect');\n    const keep = sel.value || j?.worker_id || '';\n    if (!f.service_code.value) {\n      $('#matchInfo').textContent = 'เลือกประเภทบริการเพื่อกรองผู้รับจ้าง';\n      return;\n    }\n    const my = ++reqNo;\n    $('#matchInfo').innerHTML = '<span class=\"spinner\"></span> กำลังคัดกรองผู้รับจ้าง…';\n    try {\n      const r = await api('getEligibleWorkers', S.pin, f.service_code.value, f.start_datetime.value, f.end_datetime.value, j?.job_id || '', j?.worker_id || '');\n      if (my !== reqNo) return;\n      const opts = r.eligible.map(w => [w.worker_id, `${w.label} · ${w.village_moo || '-'}${w.has_car ? ' · 🚗' : ''}`]);\n      const keptBad = keep && !r.eligible.some(w => w.worker_id === keep) ? r.excluded.find(w => w.worker_id === keep) : null;\n      if (keptBad) opts.unshift([keep, `⚠️ ${keptBad.label} — ${keptBad.reasons.join(', ')}`]);\n      sel.innerHTML = options(opts, keep, r.eligible.length ? '— ยังไม่มอบหมาย —' : '— ไม่มีผู้รับจ้างที่ตรงเงื่อนไข —');\n      const rules = ['ทักษะตรงงาน', 'สถานะ \"พร้อมรับงาน\"'];\n      if (S.d.config.requirePoliceCheck) rules.push('ตรวจประวัติผ่าน');\n      if (r.requiresCar) rules.push('🚗 มีรถส่วนตัว');\n      if (f.start_datetime.value && f.end_datetime.value) rules.push('ไม่ชนเวลางานอื่น/วันลา');\n      $('#matchInfo').innerHTML = `พบผู้รับจ้างที่ส่งได้ <b>${r.eligible.length}</b> คน — กรองตาม: ${rules.join(' · ')}` +\n        (!f.start_datetime.value || !f.end_datetime.value ? ' <span class=\"badge b-warn\">ใส่วันเวลาเพื่อเช็คงานชนกัน</span>' : '');\n      const ex = $('#excluded');\n      ex.hidden = !r.excluded.length;\n      ex.innerHTML = `<summary>ดูผู้ที่ถูกคัดออก (${r.excluded.length} คน)</summary><ul>` +\n        r.excluded.map(w => `<li><b>${esc(w.label)}</b> — ${esc(w.reasons.join(' / '))}</li>`).join('') + '</ul>';\n    } catch (e) {\n      if (my === reqNo) $('#matchInfo').innerHTML = `<span style=\"color:var(--danger)\">${esc(errMsg(e))}</span>`;\n    }\n  };\n\n  f.client_id.onchange = showClient;\n  f.service_code.onchange = () => { showPrice(); loadWorkers(); };\n  f.start_datetime.onchange = () => {\n    if (f.start_datetime.value && !f.end_datetime.value) f.end_datetime.value = f.start_datetime.value;\n    loadWorkers();\n  };\n  f.end_datetime.onchange = loadWorkers;\n  f.payment_status.onchange = f.job_status.onchange = showPayWarn;\n  showClient(); showPrice(); showPayWarn();\n  if (j) loadWorkers();\n\n  f.onsubmit = e => {\n    e.preventDefault();\n    const data = formData(f);\n    if (j) data.job_id = j.job_id;\n    submitWith(f, async () => {\n      const r = await api('saveJob', S.pin, data);\n      closeModal();\n      toast(`บันทึกใบงาน ${r.job.job_id} แล้ว` + (r.warnings.length ? '\\n' + r.warnings.join('\\n') : ''));\n      await load();\n    });\n  };\n}\n\n/* ============================================================\n * Workers\n * ============================================================ */\nfunction allSkills() {\n  const set = new Set(S.d.options.skill_tags);\n  const split = v => String(v || '').split(/[,;|\\n]+/).map(s => s.trim()).filter(Boolean);\n  S.d.workers.forEach(w => split(w.skill_tags).forEach(t => set.add(t)));\n  S.d.services.forEach(s => split(s.required_skill).forEach(t => set.add(t)));\n  return [...set];\n}\nconst hasCar = v => v === true || ['true', 'มี', 'yes', '1'].includes(String(v).trim().toLowerCase());\n\nfunction renderWorkers() {\n  return `\n  <div class=\"page-head\"><h2>ทะเบียนบุคลากร / ผู้รับจ้าง</h2><span class=\"spacer\"></span>\n    <button class=\"btn btn-primary\" data-act=\"newWorker\">+ เพิ่มผู้รับจ้าง</button></div>\n  <div class=\"table-wrap\"><table>\n    <thead><tr><th>รหัส</th><th>ชื่อ</th><th>ติดต่อ / พื้นที่</th><th>ทักษะ</th><th>รถ</th><th>ตรวจประวัติ</th><th>สถานะ</th><th>LINE</th><th></th></tr></thead>\n    <tbody>${S.d.workers.map(w => `<tr>\n      <td><b>${esc(w.worker_id)}</b></td>\n      <td>${esc(w.full_name)}<div class=\"sub\">${esc(w.nickname || '')}</div></td>\n      <td>${esc(phone(w.phone_number))}<div class=\"sub\">${esc(w.village_moo || '')}</div></td>\n      <td>${String(w.skill_tags || '').split(/[,;]+/).filter(s => s.trim()).map(s => `<span class=\"badge b-brand\">${esc(s.trim())}</span>`).join(' ')}</td>\n      <td>${hasCar(w.has_car) ? '🚗 มี' : '<span class=\"muted\">–</span>'}</td>\n      <td>${badge('police', w.police_check_status)}</td>\n      <td>${badge('worker', w.status)}</td>\n      <td>${w.line_user_id ? '<span class=\"badge b-ok\">ผูกแล้ว</span>' : '<span class=\"muted small\">ยังไม่ผูก</span>'}</td>\n      <td class=\"actions\"><button class=\"btn btn-sm\" data-act=\"editWorker\" data-id=\"${esc(w.worker_id)}\">แก้ไข</button></td>\n    </tr>`).join('') || '<tr><td colspan=\"9\" class=\"empty\">ยังไม่มีผู้รับจ้าง</td></tr>'}</tbody></table></div>`;\n}\n\nfunction openWorkerForm(id) {\n  const w = id ? W(id) : null;\n  const mine = String(w?.skill_tags || '').split(/[,;|]+/).map(s => s.trim()).filter(Boolean);\n  openModal(w ? `แก้ไขผู้รับจ้าง ${w.worker_id}` : 'เพิ่มผู้รับจ้างใหม่', `\n  <form id=\"workerForm\"><div class=\"grid\">\n    <label class=\"field\">ชื่อ-นามสกุล (ตามบัตรประชาชน) <input name=\"full_name\" required value=\"${esc(w?.full_name || '')}\"></label>\n    <label class=\"field\">ชื่อเล่น <input name=\"nickname\" value=\"${esc(w?.nickname || '')}\"></label>\n    <label class=\"field\">เลขบัตรประชาชน 13 หลัก <input name=\"id_card_no\" inputmode=\"numeric\" maxlength=\"17\" value=\"${esc(String(w?.id_card_no || ''))}\"></label>\n    <label class=\"field\">เบอร์โทรศัพท์ <input name=\"phone_number\" inputmode=\"tel\" required value=\"${esc(phone(w?.phone_number))}\"></label>\n    <label class=\"field full\">ที่อยู่ / หมู่บ้าน / ตำบล <input name=\"village_moo\" value=\"${esc(w?.village_moo || '')}\"></label>\n    <div class=\"field full\">ทักษะงานที่ทำได้\n      <div class=\"skill-box\">${allSkills().map(s => `<label class=\"check\"><input type=\"checkbox\" name=\"skill_tags\" value=\"${esc(s)}\" ${mine.includes(s) ? 'checked' : ''}> ${esc(s)}</label>`).join('')}</div>\n      <input name=\"skill_extra\" placeholder=\"ทักษะอื่น (คั่นด้วย ,)\"></div>\n    <label class=\"check full\"><input type=\"checkbox\" name=\"has_car\" ${hasCar(w?.has_car) ? 'checked' : ''}> มียานพาหนะส่วนตัว (รถยนต์/กระบะ) รับ-ส่ง รพ. ได้</label>\n    <label class=\"field\">สถานะตรวจประวัติอาชญากรรม <select name=\"police_check_status\">${options(S.d.options.police_check_status, w?.police_check_status || 'รอดำเนินการ')}</select></label>\n    <label class=\"field\">สถานะความพร้อมรับงาน <select name=\"status\">${options(S.d.options.worker_status, w?.status || 'พร้อมรับงาน')}</select></label>\n    <label class=\"field\">วันที่เซ็นสัญญา <input type=\"date\" name=\"contract_signed_date\" value=\"${esc(String(w?.contract_signed_date || '').slice(0, 10))}\"></label>\n    <label class=\"field\">LINE <input readonly value=\"${w?.line_user_id ? 'ผูกบัญชีแล้ว' : 'ยังไม่ผูก — ให้พิมพ์ในแชต LINE ของศูนย์: ลงทะเบียน ' + esc(w?.worker_id || 'WK-xxx') + ' เบอร์4ตัวท้าย'}\"></label>\n    <label class=\"field full\">หมายเหตุ / บุคคลรับรองในพื้นที่ <textarea name=\"notes\">${esc(w?.notes || '')}</textarea></label>\n  </div>\n  <div class=\"row modal-actions\"><span class=\"spacer\"></span>\n    <button type=\"button\" class=\"btn\" data-close>ปิด</button><button type=\"submit\" class=\"btn btn-primary\">บันทึก</button></div></form>`);\n  const f = $('#workerForm');\n  f.onsubmit = e => {\n    e.preventDefault();\n    const d = formData(f);\n    const skills = [].concat(d.skill_tags || [], String(d.skill_extra || '').split(',').map(s => s.trim()).filter(Boolean));\n    d.skill_tags = [...new Set(skills)];\n    d.has_car = f.has_car.checked;\n    delete d.skill_extra;\n    if (w) d.worker_id = w.worker_id;\n    submitWith(f, async () => {\n      const r = await api('saveWorker', S.pin, d);\n      closeModal(); toast(`บันทึก ${r.worker_id} แล้ว`); await load();\n    });\n  };\n}\n\n/* ============================================================\n * Clients\n * ============================================================ */\nfunction renderClients() {\n  return `\n  <div class=\"page-head\"><h2>ทะเบียนผู้ว่าจ้างและผู้ป่วย</h2><span class=\"spacer\"></span>\n    <button class=\"btn btn-primary\" data-act=\"newClient\">+ เพิ่มลูกค้า</button></div>\n  <div class=\"table-wrap\"><table>\n    <thead><tr><th>รหัส</th><th>ผู้ว่าจ้าง</th><th>ผู้รับการดูแล</th><th>สภาพร่างกาย</th><th>ข้อควรระวัง</th><th>ที่อยู่หน้างาน</th><th>วันที่เปิดประวัติ</th><th></th></tr></thead>\n    <tbody>${S.d.clients.map(c => `<tr>\n      <td><b>${esc(c.client_id)}</b></td>\n      <td>${esc(c.client_name)}<div class=\"sub\">${esc(phone(c.client_phone))}</div></td>\n      <td>${esc(c.patient_name)}</td>\n      <td>${c.patient_condition ? `<span class=\"badge ${c.patient_condition === 'ติดเตียง' ? 'b-warn' : 'b-brand'}\">${esc(c.patient_condition)}</span>` : '-'}</td>\n      <td class=\"small\">${esc(c.medical_precautions || '-')}</td>\n      <td class=\"small\">${esc(c.address_location || '-')}</td>\n      <td>${fmt(c.created_date, false)}</td>\n      <td class=\"actions\"><button class=\"btn btn-sm\" data-act=\"editClient\" data-id=\"${esc(c.client_id)}\">แก้ไข</button></td>\n    </tr>`).join('') || '<tr><td colspan=\"8\" class=\"empty\">ยังไม่มีลูกค้า</td></tr>'}</tbody></table></div>`;\n}\n\nfunction openClientForm(id) {\n  const c = id ? C(id) : null;\n  openModal(c ? `แก้ไขลูกค้า ${c.client_id}` : 'เพิ่มลูกค้าใหม่', `\n  <form id=\"clientForm\"><div class=\"grid\">\n    <label class=\"field\">ชื่อผู้ว่าจ้าง (คนจ่ายเงิน/ลูกหลาน) <input name=\"client_name\" required value=\"${esc(c?.client_name || '')}\"></label>\n    <label class=\"field\">เบอร์โทรศัพท์ผู้ว่าจ้าง <input name=\"client_phone\" inputmode=\"tel\" required value=\"${esc(phone(c?.client_phone))}\"></label>\n    <label class=\"field\">ชื่อผู้รับการดูแล (คนไข้/คนชรา) <input name=\"patient_name\" required value=\"${esc(c?.patient_name || '')}\"></label>\n    <label class=\"field\">สภาพร่างกาย <select name=\"patient_condition\">${options(S.d.options.patient_condition, c?.patient_condition, '— เลือก —')}</select></label>\n    <label class=\"field full\">โรคประจำตัว / ข้อควรระวังทางการแพทย์ <textarea name=\"medical_precautions\" placeholder=\"เช่น เบาหวาน, ให้อาหารสายยาง, แพ้ยา\">${esc(c?.medical_precautions || '')}</textarea></label>\n    <label class=\"field full\">ที่อยู่หน้างาน / จุดสังเกตในชุมชน <textarea name=\"address_location\">${esc(c?.address_location || '')}</textarea></label>\n  </div>\n  <div class=\"row modal-actions\"><span class=\"spacer\"></span>\n    <button type=\"button\" class=\"btn\" data-close>ปิด</button><button type=\"submit\" class=\"btn btn-primary\">บันทึก</button></div></form>`);\n  const f = $('#clientForm');\n  f.onsubmit = e => {\n    e.preventDefault();\n    const d = formData(f);\n    if (c) d.client_id = c.client_id;\n    submitWith(f, async () => {\n      const r = await api('saveClient', S.pin, d);\n      closeModal(); toast(`บันทึก ${r.client_id} แล้ว`); await load();\n    });\n  };\n}\n\n/* ============================================================\n * Services\n * ============================================================ */\nfunction renderServices() {\n  return `\n  <div class=\"page-head\"><h2>ตารางบริการและราคา (เงินบาทตายตัว)</h2><span class=\"spacer\"></span>\n    <button class=\"btn btn-primary\" data-act=\"newService\">+ เพิ่มบริการ</button></div>\n  <div class=\"alert alert-info\" style=\"margin-bottom:12px\">ราคาในตารางนี้ถูกดึงไปใส่ใบงานอัตโนมัติทันทีที่เลือกบริการ — ผู้ใช้ไม่ต้องพิมพ์ตัวเลขเองในใบงาน</div>\n  <div class=\"table-wrap\"><table>\n    <thead><tr><th>รหัส</th><th>บริการ</th><th>หน่วย</th><th style=\"text-align:right\">ราคาลูกค้า</th><th style=\"text-align:right\">ศูนย์หัก</th><th style=\"text-align:right\">คนทำงานได้</th><th>เงื่อนไขคัดคน</th><th></th></tr></thead>\n    <tbody>${S.d.services.map(s => `<tr>\n      <td><b>${esc(s.service_code)}</b></td>\n      <td>${esc(s.service_name)}</td>\n      <td>${esc(s.unit_type || '-')}</td>\n      <td class=\"num\">${baht(s.client_price)}</td>\n      <td class=\"num\">${baht(s.center_fee)}</td>\n      <td class=\"num\"><b>${baht(s.total_worker_wage)}</b></td>\n      <td class=\"small\">${s.required_skill ? 'ทักษะ: ' + esc(s.required_skill) : '<span class=\"muted\">เทียบทักษะจากชื่อบริการ</span>'}${s._requires_car ? ' · <span class=\"badge b-info\">🚗 ต้องมีรถ</span>' : ''}</td>\n      <td class=\"actions\"><button class=\"btn btn-sm\" data-act=\"editService\" data-id=\"${esc(s.service_code)}\">แก้ไข</button></td>\n    </tr>`).join('') || '<tr><td colspan=\"8\" class=\"empty\">ยังไม่มีบริการ</td></tr>'}</tbody></table></div>`;\n}\n\nfunction openServiceForm(code) {\n  const s = code ? SV(code) : null;\n  const req = String(s?.required_skill || '').split(/[,;|]+/).map(x => x.trim()).filter(Boolean);\n  openModal(s ? `แก้ไขบริการ ${s.service_code}` : 'เพิ่มบริการใหม่', `\n  <form id=\"svcForm\"><div class=\"grid\">\n    <label class=\"field full\">ชื่อประเภทบริการและลักษณะงาน <input name=\"service_name\" required value=\"${esc(s?.service_name || '')}\" placeholder=\"เช่น รับ-ส่ง รพ. ด้วยรถผู้รับจ้าง\"></label>\n    <label class=\"field\">หน่วยคิดบริการ <select name=\"unit_type\">${options(S.d.options.unit_type, s?.unit_type || 'ครั้ง')}</select></label>\n    <span></span>\n    <label class=\"field\">ราคาเรียกเก็บจากลูกค้า (บาท) <input type=\"number\" min=\"1\" step=\"1\" name=\"client_price\" required value=\"${esc(s ? num(s.client_price) : '')}\"></label>\n    <label class=\"field\">ศูนย์หักค่าบริหารจัดการ (บาท) <input type=\"number\" min=\"0\" step=\"1\" name=\"center_fee\" required value=\"${esc(s ? num(s.center_fee) : '')}\"></label>\n    <label class=\"field\">ผู้รับจ้างได้รับสุทธิ (บาท) <input readonly id=\"wagePreview\"><span class=\"hint\">= ราคาลูกค้า − ค่าบริหารศูนย์</span></label>\n    <span></span>\n    <div class=\"field full\">ทักษะที่ต้องมี (เว้นว่าง = เทียบจากชื่อบริการ)\n      <div class=\"skill-box\">${allSkills().map(t => `<label class=\"check\"><input type=\"checkbox\" name=\"required_skill\" value=\"${esc(t)}\" ${req.includes(t) ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</div></div>\n    <label class=\"check full\"><input type=\"checkbox\" name=\"requires_car\" ${s?._requires_car ? 'checked' : ''}> ต้องใช้รถของผู้รับจ้าง (คัดเฉพาะคนที่มีรถ)</label>\n  </div>\n  <div class=\"row modal-actions\"><span class=\"spacer\"></span>\n    <button type=\"button\" class=\"btn\" data-close>ปิด</button><button type=\"submit\" class=\"btn btn-primary\">บันทึก</button></div></form>`);\n  const f = $('#svcForm');\n  const wage = () => { $('#wagePreview').value = baht(num(f.client_price.value) - num(f.center_fee.value)); };\n  f.client_price.oninput = f.center_fee.oninput = wage; wage();\n  f.onsubmit = e => {\n    e.preventDefault();\n    const d = formData(f);\n    d.required_skill = [].concat(d.required_skill || []);\n    d.requires_car = f.requires_car.checked;\n    if (s) d.service_code = s.service_code;\n    submitWith(f, async () => {\n      const r = await api('saveService', S.pin, d);\n      closeModal(); toast(`บันทึก ${r.service_code} แล้ว`); await load();\n    });\n  };\n}\n\n/* ============================================================\n * Payments\n * ============================================================ */\nfunction renderPayments() {\n  const rows = S.d.payments.filter(p =>\n    !S.payFilter || p.trans_type === S.payFilter || p.payout_status === S.payFilter\n  ).sort((a, b) => String(b.trans_id).localeCompare(String(a.trans_id), undefined, { numeric: true }));\n  return `\n  <div class=\"page-head\"><h2>บันทึกการเงินและสลิป</h2><span class=\"spacer\"></span>\n    <div class=\"toolbar\">\n      <select data-bind=\"payFilter\">${options([['', 'ทุกรายการ'], ...S.d.options.trans_type.map(t => [t, t]), ['รอโอน', '⏳ รอโอนให้คนทำงาน']], S.payFilter)}</select>\n      <button class=\"btn btn-primary\" data-act=\"newPayment\">+ บันทึกรายการเงิน</button></div></div>\n  <div class=\"table-wrap\"><table>\n    <thead><tr><th>รหัส</th><th>ใบงาน</th><th>ประเภท</th><th style=\"text-align:right\">จำนวนเงิน</th><th>วันเวลาโอน</th><th>สลิป</th><th>สถานะ</th><th></th></tr></thead>\n    <tbody>${rows.map(p => {\n      const j = JOB(p.job_id) || {}, c = C(j.client_id) || {}, w = W(j.worker_id);\n      return `<tr>\n        <td><b>${esc(p.trans_id)}</b></td>\n        <td>${esc(p.job_id)}<div class=\"sub\">${esc(p.trans_type === 'จ่ายให้คนทำงาน' ? wName(w) : c.patient_name || '')}</div></td>\n        <td>${badge('trans', p.trans_type)}</td>\n        <td class=\"num\">${baht(p.amount)}</td>\n        <td>${fmt(p.trans_datetime)}</td>\n        <td>${p.slip_image_url ? `<a href=\"${esc(p.slip_image_url)}\" target=\"_blank\" rel=\"noopener\">ดูสลิป</a>` : '<span class=\"muted\">–</span>'}</td>\n        <td>${badge('payout', p.payout_status)}</td>\n        <td class=\"actions\">${p.payout_status === 'รอโอน' ? `<button class=\"btn btn-sm btn-primary\" data-act=\"payout\" data-id=\"${esc(p.trans_id)}\">โอนแล้ว</button> ` : ''}<button class=\"btn btn-sm\" data-act=\"editPayment\" data-id=\"${esc(p.trans_id)}\">แก้ไข</button></td>\n      </tr>`;\n    }).join('') || '<tr><td colspan=\"8\" class=\"empty\">ยังไม่มีรายการ</td></tr>'}</tbody></table></div>`;\n}\n\nfunction openPaymentForm(transId, jobId) {\n  const p = transId ? S.d.payments.find(x => x.trans_id === transId) : null;\n  const ST = S.d.status;\n  const isPayout = p && p.payout_status === ST.PAYOUT.WAITING;\n  const jobs = S.d.jobs.filter(j => j.job_status !== ST.JOB.CANCELLED || j.job_id === p?.job_id);\n  const jobOpts = jobs.map(j => {\n    const c = C(j.client_id) || {};\n    return [j.job_id, `${j.job_id} · ${c.patient_name || ''} · ${baht(j.total_client_amount)} (${j.payment_status})`];\n  });\n  openModal(p ? `แก้ไขรายการ ${p.trans_id}` : 'บันทึกรายการเงิน', `\n  <form id=\"payForm\"><div class=\"grid\">\n    <label class=\"field full\">ใบงานที่อ้างอิง <select name=\"job_id\" required>${options(jobOpts, p?.job_id || jobId, '— เลือกใบงาน —')}</select></label>\n    <label class=\"field\">ประเภทรายการ <select name=\"trans_type\">${options(S.d.options.trans_type, p?.trans_type || ST.TRANS.IN)}</select></label>\n    <label class=\"field\">จำนวนเงินที่โอนจริง (บาท) <input type=\"number\" name=\"amount\" min=\"1\" step=\"0.01\" required value=\"${esc(p ? num(p.amount) : '')}\"></label>\n    <div class=\"full small\" id=\"payHint\"></div>\n    <label class=\"field\">วันและเวลาที่โอน (ตามสลิป) <input type=\"datetime-local\" name=\"trans_datetime\" value=\"${esc(p?.trans_datetime || nowLocal())}\"></label>\n    <label class=\"field\">สถานะรายการ <select name=\"payout_status\">${options(S.d.options.payout_status, isPayout ? ST.PAYOUT.TRANSFERRED : (p?.payout_status || ST.PAYOUT.OK))}</select></label>\n    <label class=\"field full\">รูปสลิปหลักฐานการโอน ${p?.slip_image_url ? `(มีแล้ว: <a href=\"${esc(p.slip_image_url)}\" target=\"_blank\">ดูสลิปเดิม</a>)` : ''}\n      <input type=\"file\" name=\"slip\" accept=\"image/*,application/pdf\"><span class=\"hint\">ไฟล์จะถูกเก็บใน Google Drive ของศูนย์</span></label>\n  </div>\n  <div class=\"row modal-actions\"><span class=\"spacer\"></span>\n    <button type=\"button\" class=\"btn\" data-close>ปิด</button><button type=\"submit\" class=\"btn btn-primary\">บันทึก</button></div></form>`);\n  const f = $('#payForm');\n  let autoAmount = !p;\n  const hint = () => {\n    const j = JOB(f.job_id.value);\n    if (!j) { $('#payHint').innerHTML = ''; return; }\n    const isIn = f.trans_type.value === ST.TRANS.IN;\n    const due = isIn ? Math.max(num(j.total_client_amount) - num(j._paid), 0) : num(j.total_worker_wage);\n    if (autoAmount) f.amount.value = due || '';\n    $('#payHint').innerHTML = isIn\n      ? `<div class=\"alert ${due ? 'alert-warn' : 'alert-ok'}\">ยอดเรียกเก็บ ${baht(j.total_client_amount)} · รับแล้ว ${baht(j._paid)} · <b>ค้างชำระ ${baht(due)}</b> — เมื่อรับครบ ระบบจะเปลี่ยนใบงานเป็น \"ชำระแล้ว\" อัตโนมัติ</div>`\n      : `<div class=\"alert alert-info\">ค่าจ้างสุทธิของใบงานนี้ ${baht(j.total_worker_wage)} (${esc(wName(W(j.worker_id)) || 'ยังไม่จัดคน')})</div>`;\n    if (!p) f.payout_status.value = isIn ? ST.PAYOUT.OK : ST.PAYOUT.WAITING;\n  };\n  f.job_id.onchange = f.trans_type.onchange = hint;\n  f.amount.oninput = () => { autoAmount = false; };\n  hint();\n  f.onsubmit = e => {\n    e.preventDefault();\n    const d = formData(f);\n    delete d.slip;\n    if (p) d.trans_id = p.trans_id;\n    submitWith(f, async () => {\n      const file = f.slip.files[0];\n      if (file) {\n        if (file.size > 6 * 1024 * 1024) throw new Error('ไฟล์สลิปใหญ่เกิน 6MB');\n        const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });\n        d.slip = { name: file.name, mime: file.type, data: String(dataUrl).split(',')[1] };\n      }\n      const r = await api('savePayment', S.pin, d);\n      closeModal();\n      toast(`บันทึก ${r.payment.trans_id} แล้ว` + (r.messages.length ? '\\n' + r.messages.join('\\n') : ''));\n      await load();\n    });\n  };\n}\n\n/* ============================================================\n * Leaves\n * ============================================================ */\nfunction renderLeaves() {\n  const rows = S.d.leaves.filter(l => !S.leaveFilter || l.status === S.leaveFilter || (S.leaveFilter === 'late' && l._late))\n    .sort((a, b) => String(b.leave_id).localeCompare(String(a.leave_id), undefined, { numeric: true }));\n  return `\n  <div class=\"page-head\"><h2>ใบลา (ต้องแจ้งล่วงหน้า ${S.d.config.minLeaveDays} วัน)</h2><span class=\"spacer\"></span>\n    <div class=\"toolbar\">\n      <select data-bind=\"leaveFilter\">${options([['', 'ทุกใบลา'], ...S.d.options.leave_status.map(s => [s, s]), ['late', '🔴 แจ้งกะทันหัน']], S.leaveFilter)}</select>\n      <button class=\"btn btn-primary\" data-act=\"newLeave\">+ บันทึกใบลาแทนผู้รับจ้าง</button></div></div>\n  <div class=\"table-wrap\"><table>\n    <thead><tr><th>รหัส</th><th>ผู้รับจ้าง</th><th>ยื่นเมื่อ</th><th>ช่วงวันหยุด</th><th style=\"text-align:right\">แจ้งล่วงหน้า</th><th>ตรวจกฎ 7 วัน</th><th>เหตุผล</th><th>คนแทน</th><th>สถานะ</th><th></th></tr></thead>\n    <tbody>${rows.map(l => `<tr class=\"${l._late ? 'row-danger' : ''}\">\n      <td><b>${esc(l.leave_id)}</b></td>\n      <td>${esc(wName(W(l.worker_id)) || '')}<div class=\"sub\">${esc(l.worker_id)}</div></td>\n      <td>${fmt(l.request_date, false)}</td>\n      <td>${fmt(l.leave_start_date, false)}<div class=\"sub\">ถึง ${fmt(l.leave_end_date, false)}</div></td>\n      <td class=\"num\">${esc(l.notice_days)} วัน</td>\n      <td>${l._late ? `<span class=\"tag-red\">${esc(S.d.config.lateLeaveTag)}</span>` : '<span class=\"badge b-ok\">ผ่านเกณฑ์ 1 สัปดาห์</span>'}</td>\n      <td class=\"small\">${esc(l.leave_reason || '')}</td>\n      <td>${l.substitute_worker_id ? esc(wName(W(l.substitute_worker_id)) || l.substitute_worker_id) : '<span class=\"muted\">–</span>'}</td>\n      <td>${badge('leave', l.status)}</td>\n      <td class=\"actions\"><button class=\"btn btn-sm ${l.status === 'รอตรวจสอบ' ? 'btn-primary' : ''}\" data-act=\"reviewLeave\" data-id=\"${esc(l.leave_id)}\">${l.status === 'รอตรวจสอบ' ? 'พิจารณา' : 'ดู'}</button></td>\n    </tr>`).join('') || '<tr><td colspan=\"10\" class=\"empty\">ยังไม่มีใบลา</td></tr>'}</tbody></table></div>`;\n}\n\nfunction leavePreview(f) {\n  const req = f.request_date ? f.request_date.value : today();\n  const s = f.leave_start_date.value;\n  const box = $('#leavePreview');\n  if (!s || !req) { box.innerHTML = ''; return; }\n  const n = dayDiff(req, s);\n  box.innerHTML = n < S.d.config.minLeaveDays\n    ? `<div class=\"alert alert-danger\">🔴 ${esc(S.d.config.lateLeaveTag)} — แจ้งล่วงหน้าเพียง ${n} วัน (ต้อง ${S.d.config.minLeaveDays} วันขึ้นไป)</div>`\n    : `<div class=\"alert alert-ok\">✅ ผ่านเกณฑ์แจ้งล่วงหน้า 1 สัปดาห์ (${n} วัน)</div>`;\n}\n\nfunction openLeaveForm() {\n  const wOpts = S.d.workers.filter(w => w.status !== 'พ้นสภาพ').map(w => [w.worker_id, `${w.worker_id} · ${wName(w)}`]);\n  openModal('บันทึกใบลาแทนผู้รับจ้าง', `\n  <form id=\"leaveForm\"><div class=\"grid\">\n    <label class=\"field full\">ผู้รับจ้างที่ขอลา <select name=\"worker_id\" required>${options(wOpts, '', '— เลือก —')}</select></label>\n    <label class=\"field\">วันที่ยื่นเรื่องขอลา <input type=\"date\" name=\"request_date\" required value=\"${today()}\"></label>\n    <span></span>\n    <label class=\"field\">วันที่เริ่มหยุดงาน <input type=\"date\" name=\"leave_start_date\" required></label>\n    <label class=\"field\">วันสุดท้ายที่หยุดงาน <input type=\"date\" name=\"leave_end_date\" required></label>\n    <div class=\"full\" id=\"leavePreview\"></div>\n    <label class=\"field full\">เหตุผลการลาหยุด <textarea name=\"leave_reason\" required></textarea></label>\n  </div>\n  <div class=\"row modal-actions\"><span class=\"spacer\"></span>\n    <button type=\"button\" class=\"btn\" data-close>ปิด</button><button type=\"submit\" class=\"btn btn-primary\">บันทึกใบลา</button></div></form>`);\n  const f = $('#leaveForm');\n  f.request_date.onchange = f.leave_start_date.onchange = () => {\n    if (!f.leave_end_date.value) f.leave_end_date.value = f.leave_start_date.value;\n    leavePreview(f);\n  };\n  f.onsubmit = e => {\n    e.preventDefault();\n    submitWith(f, async () => {\n      const r = await api('saveLeave', S.pin, formData(f));\n      closeModal();\n      toast(`บันทึกใบลา ${r.leave_id} แล้ว` + (r.late ? `\\n🔴 ${r.tag}` : '') + (r.affected.length ? `\\nกระทบใบงาน: ${r.affected.join(', ')}` : ''), r.late);\n      await load();\n    });\n  };\n}\n\nasync function openLeaveReview(id) {\n  openModal(`พิจารณาใบลา ${id}`, '<div class=\"row\"><span class=\"spinner\"></span> กำลังตรวจสอบใบงานที่กระทบและคนที่ส่งแทนได้…</div>');\n  let r;\n  try { r = await api('getLeaveDetail', S.pin, id); } catch (e) { closeModal(); toast(errMsg(e), true); return; }\n  const l = r.leave, w = W(l.worker_id);\n  const okCount = r.candidates.filter(c => c.ok).length;\n  const candOpts = r.candidates.sort((a, b) => b.ok - a.ok).map(c =>\n    `<option value=\"${esc(c.worker_id)}\" ${c.ok ? '' : 'disabled'} ${c.worker_id === l.substitute_worker_id ? 'selected' : ''}>${esc(c.label)}${c.ok ? ' ✅' : ' — ' + esc(c.reasons[0])}</option>`).join('');\n  openModal(`พิจารณาใบลา ${l.leave_id}`, `\n  <div class=\"stack\">\n    <div><b>${esc(wName(w) || l.worker_id)}</b> (${esc(l.worker_id)}) ${badge('leave', l.status)}\n      <div class=\"small muted\">หยุด ${fmt(l.leave_start_date, false)} – ${fmt(l.leave_end_date, false)} · ยื่นเมื่อ ${fmt(l.request_date, false)} · แจ้งล่วงหน้า ${esc(l.notice_days)} วัน</div>\n      <div class=\"small\">เหตุผล: ${esc(l.leave_reason)}</div></div>\n    ${l._late ? `<div class=\"alert alert-danger\">🔴 ${esc(S.d.config.lateLeaveTag)}</div>` : '<div class=\"alert alert-ok\">✅ ผ่านเกณฑ์แจ้งล่วงหน้า 1 สัปดาห์</div>'}\n    <div><b>ใบงานที่กระทบ (${r.affected.length})</b>\n      ${r.affected.length ? r.affected.map(j => `<div class=\"list-item\"><div class=\"grow\">${esc(j.job_id)} · ${esc((C(j.client_id) || {}).patient_name || '')}\n        <div class=\"small muted\">${fmt(j.start_datetime)} – ${fmt(j.end_datetime)} · ${esc((SV(j.service_code) || {}).service_name || '')}</div></div>${badge('payment', j.payment_status)}</div>`).join('')\n        : '<div class=\"empty\">ไม่มีใบงานในช่วงวันลา</div>'}</div>\n    <form id=\"decideForm\" class=\"stack\">\n      <label class=\"field\">ผู้รับจ้างที่ส่งไปแทน (ส่งได้ ${okCount} คน — ตรวจทักษะ/รถ/สถานะ/เวลาชนแล้ว)\n        <select name=\"substitute\">${'<option value=\"\">— ไม่ระบุคนแทน —</option>' + candOpts}</select></label>\n      ${r.affected.length ? '<label class=\"check\"><input type=\"checkbox\" name=\"reassign\" checked> ย้ายใบงานที่กระทบทั้งหมดไปให้คนแทนอัตโนมัติ (และแจ้งเตือนทาง LINE)</label>' : ''}\n      <div class=\"row modal-actions\">\n        <button type=\"button\" class=\"btn btn-danger\" id=\"rejectBtn\">ไม่อนุมัติ</button>\n        <span class=\"spacer\"></span>\n        <button type=\"button\" class=\"btn\" data-close>ปิด</button>\n        <button type=\"submit\" class=\"btn btn-primary\">อนุมัติ</button></div>\n    </form>\n  </div>`);\n  const f = $('#decideForm');\n  const decide = decision => submitWith(f, async () => {\n    const res = await api('decideLeave', S.pin, l.leave_id, decision, f.substitute.value, !!(f.reassign && f.reassign.checked));\n    closeModal();\n    toast(`ใบลา ${l.leave_id}: ${res.status}` + (res.moved.length ? `\\nย้ายใบงาน ${res.moved.join(', ')} ให้คนแทนแล้ว` : ''));\n    await load();\n  });\n  f.onsubmit = e => { e.preventDefault(); decide('approve'); };\n  $('#rejectBtn').onclick = () => decide('reject');\n}\n\n/* ============================================================\n * Links\n * ============================================================ */\nfunction renderLinks() {\n  const url = S.d.config.appUrl;\n  const linkRow = (id, label, href, note) => `\n    <div class=\"stack\"><div><b>${label}</b><div class=\"small muted\">${note}</div></div>\n    <div class=\"link-row\"><input id=\"${id}\" readonly value=\"${esc(href)}\"><button class=\"btn btn-sm\" data-act=\"copy\" data-id=\"${id}\">คัดลอก</button>\n    <a class=\"btn btn-sm\" href=\"${esc(href)}\" target=\"_blank\">เปิด</a></div></div>`;\n  return `\n  <div class=\"page-head\"><h2>ลิงก์ระบบและการแจ้งเตือน LINE</h2></div>\n  <div class=\"two-col\">\n    <div class=\"card stack\"><h3>🔗 ลิงก์สำหรับแชร์</h3>\n      ${url ? linkRow('lnkBook', 'ฟอร์มลูกค้าจองบริการ', url + '?page=จองบริการ', 'ส่งให้ลูกค้า/ญาติ — จองแล้วศูนย์ได้รับแจ้งเตือนทาง LINE ทันที')\n        + linkRow('lnkLeave', 'ฟอร์มผู้รับจ้างยื่นใบลา', url + '?page=ยื่นใบลา', 'ผู้รับจ้างยืนยันตัวตนด้วยรหัส + เบอร์โทร 4 ตัวท้าย')\n        + linkRow('lnkAdmin', 'หน้าผู้จัดการศูนย์ (หน้านี้)', url, 'ใช้รหัสผู้จัดการในการเข้า — ห้ามแชร์รหัส')\n        : '<div class=\"alert alert-warn\">ยังไม่ได้ Deploy เป็น Web app — ดูขั้นตอนใน README</div>'}\n    </div>\n    <div class=\"card stack\"><h3>💬 LINE แจ้งเตือน ${S.d.config.lineReady ? '<span class=\"badge b-ok\">พร้อมใช้งาน</span>' : '<span class=\"badge b-danger\">ยังไม่ตั้งค่า</span>'}</h3>\n      <div class=\"small\">ระบบส่งข้อความอัตโนมัติเมื่อ:</div>\n      <ul class=\"small\" style=\"margin:0;padding-left:20px\">\n        <li>ลูกค้าจองงานใหม่ / ผู้จัดการสร้างใบงาน → แจ้งศูนย์</li>\n        <li>ผู้รับจ้างยื่นใบลา → แจ้งศูนย์ (ติดแท็กแดงถ้าแจ้งน้อยกว่า ${S.d.config.minLeaveDays} วัน)</li>\n        <li>ก่อนเริ่มงาน 24 ชม. → แจ้งผู้รับจ้าง พร้อมที่อยู่และเบอร์ญาติ</li>\n        <li>งานพรุ่งนี้ที่ยัง \"รอชำระ\" หรือยังไม่จัดคน → เตือนศูนย์</li>\n      </ul>\n      <div class=\"small\"><b>ผู้รับจ้างผูก LINE:</b> เพิ่มเพื่อน LINE OA ของศูนย์ แล้วพิมพ์<br>\n        <code>ลงทะเบียน WK-001 1234</code> (รหัสของตน + เบอร์โทร 4 ตัวท้าย)</div>\n      <div class=\"small\"><b>หา ID กลุ่มศูนย์:</b> เชิญบอทเข้ากลุ่ม LINE ของทีมงาน แล้วพิมพ์ <code>id</code></div>\n    </div>\n  </div>`;\n}\n</script>\n</body>\n</html>\n",
  "Public": "<!DOCTYPE html>\n<html lang=\"th\">\n<head>\n  <base target=\"_top\">\n  <meta charset=\"utf-8\">\n  <?!= include_('Styles'); ?>\n  <style>\n    .hero { background: linear-gradient(135deg, #1f6273, #2e8a94); color: #fff; padding: 24px 16px 22px; }\n    body.mode-leave .hero { padding-bottom: 64px; }\n    .hero-inner { max-width: 640px; margin: 0 auto; text-align: center; }\n    .hero .brand { flex-direction: column; justify-content: center; gap: 8px; }\n    .hero .brand-version { color: #fff; background: rgba(255,255,255,.18); padding: 1px 10px; border-radius: 999px; margin-top: 4px; }\n    .hero .brand-logo { width: 68px; height: 68px; box-shadow: 0 2px 10px rgba(0,0,0,.2); }\n    .hero .brand-slogan { color: rgba(255,255,255,.85); white-space: normal; }\n    .hero h1 { font-size: 22px; margin-top: 18px; }\n    .hero p { margin: 4px 0 0; color: rgba(255,255,255,.85); font-size: 14px; }\n\n    /* ---------- เมนูด้านบน ---------- */\n    .site-nav { position: sticky; top: 0; z-index: 10; background: var(--surface); border-bottom: 1px solid var(--line); box-shadow: 0 2px 8px rgba(16,40,34,.05); }\n    .site-nav-inner { max-width: 1040px; margin: 0 auto; padding: 0 12px; display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; }\n    .site-nav-inner::-webkit-scrollbar { display: none; }\n    .site-nav button {\n      font: inherit; font-size: 14px; font-weight: 600; color: var(--muted);\n      background: none; border: none; border-bottom: 3px solid transparent;\n      padding: 12px 12px 10px; cursor: pointer; white-space: nowrap;\n    }\n    .site-nav button.active { color: var(--brand); border-bottom-color: var(--heart); }\n    /* จอมือถือเลื่อนซ้าย-ขวา · จอกว้างขึ้นบรรทัดใหม่และจัดกึ่งกลาง (ไม่ให้เมนูแรกถูกตัด) */\n    @media (min-width: 760px) { .site-nav-inner { flex-wrap: wrap; justify-content: center; overflow: visible; } }\n\n    .wrap { max-width: 1040px; margin: 18px auto 40px; padding: 0 16px; }\n    body.mode-leave .wrap { max-width: 640px; margin-top: -44px; }\n    .narrow { max-width: 640px; margin: 0 auto; }\n    .page-title { font-size: 20px; margin: 4px 0 4px; }\n    .page-sub { color: var(--muted); font-size: 14px; margin: 0 0 14px; }\n    .section-title { font-size: 15px; font-weight: 700; color: var(--brand-strong); margin: 4px 0 -2px; }\n    .price-line { font-size: 14px; background: var(--brand-soft); color: var(--brand-strong); padding: 8px 12px; border-radius: 10px; }\n    .done { text-align: center; padding: 28px 18px; }\n    .done .big { font-size: 44px; }\n    .done h2 { font-size: 20px; margin: 6px 0; }\n\n    .cards { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }\n    .svc-card { display: flex; flex-direction: column; gap: 8px; border-top: 4px solid var(--brand); }\n    .svc-card h3 { font-size: 17px; }\n    .svc-price { font-size: 22px; font-weight: 700; color: var(--brand-strong); }\n    .svc-price small { font-size: 14px; font-weight: 600; color: var(--muted); }\n    .svc-card .grow { flex: 1; }\n    .about-card { border-left: 5px solid var(--heart); }\n    .about-card h2 { font-size: 19px; margin-bottom: 8px; color: var(--brand-strong); }\n    .about-card p { margin: 0 0 8px; }\n\n    .svc-group { margin-bottom: 22px; }\n    .svc-group h3 { font-size: 17px; margin-bottom: 10px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }\n    .worker-card { display: flex; gap: 12px; align-items: flex-start; }\n    .avatar { flex: none; width: 46px; height: 46px; border-radius: 50%; background: var(--brand-soft); color: var(--brand-strong); display: grid; place-items: center; font-weight: 700; font-size: 18px; }\n    .worker-card .name { font-weight: 700; }\n    .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; align-items: flex-start; align-content: flex-start; }\n\n    .avail-wrap { overflow-x: auto; background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); }\n    table.avail { border-collapse: collapse; font-size: 14px; min-width: 100%; }\n    table.avail th, table.avail td { padding: 8px 6px; text-align: center; border-bottom: 1px solid var(--line); white-space: nowrap; }\n    table.avail th:first-child, table.avail td:first-child { text-align: left; position: sticky; left: 0; background: var(--surface); padding-left: 12px; min-width: 170px; white-space: normal; }\n    table.avail thead th { font-size: 12.5px; color: var(--muted); font-weight: 600; background: #fafbfb; }\n    table.avail thead th.weekend { color: var(--heart); }\n    .cnt { display: inline-block; min-width: 34px; padding: 3px 6px; border-radius: 8px; font-weight: 700; cursor: pointer; border: none; font: inherit; font-weight: 700; }\n    .cnt.ok { background: var(--ok-bg); color: var(--ok); }\n    .cnt.low { background: var(--warn-bg); color: var(--warn); }\n    .cnt.none { background: var(--danger-bg); color: var(--danger); cursor: default; }\n    .legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 13px; color: var(--muted); margin: 10px 0 0; }\n\n    .stats { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-bottom: 14px; }\n    .stat { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); padding: 12px 16px; border-top: 3px solid var(--brand); }\n    .stat .v { font-size: 26px; font-weight: 700; }\n    .stat .k { font-size: 13px; color: var(--muted); }\n    .ongo { display: flex; gap: 12px; align-items: center; padding: 12px 0; border-top: 1px solid var(--line); }\n    .ongo:first-child { border-top: none; }\n    .ongo .grow { flex: 1; min-width: 0; }\n    footer { text-align: center; font-size: 12.5px; color: var(--muted); padding: 0 16px 28px; }\n  </style>\n</head>\n<body class=\"mode-<?= mode ?>\">\n  <div class=\"hero\"><div class=\"hero-inner\">\n    <div class=\"brand\">\n      <img class=\"brand-logo\" src=\"https://tannamnaja-ui.github.io/carecenter/logo.jpg\" alt=\"โลโก้ศูนย์ดวงใจกตัญญู\">\n      <div>\n        <div class=\"brand-name\"><?= centerName ?></div>\n        <div class=\"brand-version\">เวอร์ชัน <?= version ?></div>\n        <div class=\"brand-slogan\"><?= slogan ?></div>\n      </div>\n    </div>\n    <? if (mode !== 'book') { ?>\n      <h1>ยื่นใบลาหยุดงาน (สำหรับผู้รับจ้าง)</h1>\n      <p>ตามสัญญา ต้องแจ้งลาล่วงหน้าอย่างน้อย 7 วัน เพื่อให้ศูนย์จัดคนแทนได้ทัน</p>\n    <? } ?>\n  </div></div>\n\n  <? if (mode === 'book') { ?>\n  <nav class=\"site-nav\"><div class=\"site-nav-inner\" id=\"nav\"></div></nav>\n  <? } ?>\n\n  <div class=\"wrap\">\n    <div id=\"panel\"><div class=\"card narrow\"><div class=\"row\"><span class=\"spinner\"></span> กำลังโหลด…</div></div></div>\n  </div>\n  <footer><?= centerName ?> · <?= slogan ?></footer>\n  <div id=\"toast\" hidden></div>\n\n<script>\nconst MODE = <?!= JSON.stringify(mode) ?>;\nconst $ = (s, el = document) => el.querySelector(s);\nconst esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' }[c]));\nconst baht = v => Number(v || 0).toLocaleString('th-TH') + ' บาท';\nconst api = (fn, ...args) => new Promise((res, rej) => google.script.run.withSuccessHandler(res).withFailureHandler(rej)[fn](...args));\nconst errMsg = e => (e && e.message ? e.message : String(e)).replace(/^Error:\\s*/, '');\nfunction nowLocal(addHours = 0) {\n  const d = new Date(Date.now() + addHours * 3600e3); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());\n  return d.toISOString().slice(0, 16);\n}\nconst today = () => nowLocal().slice(0, 10);\nconst utc = s => { const m = s.split('-'); return Date.UTC(+m[0], +m[1] - 1, +m[2]); };\nconst dayDiff = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);\nconst WEEKDAY = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];\nconst MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];\n/** \"2026-10-20T08:00\" → \"20 ต.ค. 69 08:00\" */\nfunction fmt(s, withTime = true) {\n  const m = String(s || '').match(/^(\\d{4})-(\\d{2})-(\\d{2})(?:T(\\d{2}):(\\d{2}))?/);\n  if (!m) return '-';\n  return `${+m[3]} ${MONTH[+m[2] - 1]} ${String(+m[1] + 543).slice(2)}` + (withTime && m[4] ? ` ${m[4]}:${m[5]} น.` : '');\n}\nlet toastTimer;\nfunction toast(msg) {\n  const t = $('#toast'); t.textContent = msg; t.className = 'error'; t.hidden = false;\n  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 7000);\n}\nasync function submitWith(form, fn) {\n  const btn = form.querySelector('button[type=submit]');\n  btn.disabled = true; const old = btn.textContent; btn.innerHTML = '<span class=\"spinner\"></span> กำลังส่ง…';\n  try { await fn(); } catch (e) { toast(errMsg(e)); btn.disabled = false; btn.textContent = old; }\n}\nconst data = f => Object.fromEntries(new FormData(f).entries());\nconst showError = e => { $('#panel').innerHTML = `<div class=\"card narrow\"><div class=\"alert alert-danger\">${esc(errMsg(e))}</div></div>`; };\n\nif (MODE === 'book') {\n  api('getPublicSite').then(site => { SITE = site; showTab('book'); }).catch(showError);\n} else {\n  api('getPublicInfo').then(renderLeave).catch(showError);\n}\n\n/* ============================================================\n * เมนูด้านบน (หน้าจองบริการ)\n * ============================================================ */\nlet SITE = null;\nlet TAB = 'book';\nlet PRESELECT = {};\nconst TABS = [\n  ['book', '📝 จองบริการ'],\n  ['about', 'หนังสือรับประกันและความเป็นมา'],\n  ['services', 'บริการของศูนย์มีอะไรบ้าง'],\n  ['workers', 'ประวัติผู้รับจ้างแต่ละบริการ'],\n  ['availability', 'จำนวนผู้รับจ้างว่างวันไหนบ้างแต่ละบริการ'],\n  ['ongoing', 'รายการที่ให้บริการอยู่'],\n];\n\nfunction showTab(key) {\n  TAB = key;\n  $('#nav').innerHTML = TABS.map(([k, label]) =>\n    `<button data-tab=\"${k}\" class=\"${k === TAB ? 'active' : ''}\">${label}</button>`).join('');\n  $('#nav').querySelectorAll('button').forEach(b => b.onclick = () => showTab(b.dataset.tab));\n  const active = $('#nav button.active');\n  if (active) active.scrollIntoView({ block: 'nearest', inline: 'center' });\n  ({ book: renderBookTab, about: renderAbout, services: renderServices, workers: renderWorkers,\n     availability: renderAvailability, ongoing: renderOngoing })[key]();\n  const nav = $('.site-nav');\n  if (nav && window.scrollY > nav.offsetTop) window.scrollTo({ top: nav.offsetTop });\n}\n\nfunction bookService(code, date) {\n  PRESELECT = { service: code || '', date: date || '' };\n  showTab('book');\n}\n\nconst svcName = code => (SITE.services.find(s => s.service_code === code) || {}).service_name || code;\nconst paragraphs = text => String(text || '').split(/\\n{2,}/)\n  .map(p => `<p>${esc(p).replace(/\\n/g, '<br>')}</p>`).join('');\n\n/* ---------- 1. หนังสือรับประกันและความเป็นมา ---------- */\nfunction renderAbout() {\n  $('#panel').innerHTML = `<div class=\"narrow stack\">\n    ${SITE.about.map(a => `<div class=\"card about-card\"><h2>${esc(a.title)}</h2>${paragraphs(a.content)}</div>`).join('')}\n    <button class=\"btn btn-primary\" style=\"width:100%;padding:12px\" onclick=\"showTab('book')\">จองบริการกับเรา</button>\n  </div>`;\n}\n\n/* ---------- 2. บริการของศูนย์มีอะไรบ้าง ---------- */\nfunction renderServices() {\n  const todayIdx = 0;\n  $('#panel').innerHTML = `\n    <h2 class=\"page-title\">บริการของศูนย์</h2>\n    <p class=\"page-sub\">ราคาเป็นเงินบาทคงที่ ไม่มีค่าใช้จ่ายแอบแฝง</p>\n    <div class=\"cards\">${SITE.services.map(s => {\n      const av = SITE.availability.find(a => a.service_code === s.service_code);\n      const freeToday = av ? av.counts[todayIdx] : 0;\n      return `<div class=\"card svc-card\">\n        <h3>${esc(s.service_name)}</h3>\n        <div class=\"svc-price\">${baht(s.client_price)} <small>/ ${esc(s.unit_type || 'ครั้ง')}</small></div>\n        <div class=\"chips grow\">\n          <span class=\"badge b-brand\">ผู้ดูแลที่รองรับ ${s.worker_keys.length} คน</span>\n          <span class=\"badge ${freeToday ? 'b-ok' : 'b-danger'}\">ว่างวันนี้ ${freeToday} คน</span>\n          ${s.requires_car ? '<span class=\"badge b-info\">🚗 ผู้ดูแลมีรถรับ-ส่ง</span>' : ''}\n        </div>\n        <button class=\"btn btn-primary\" onclick=\"bookService('${esc(s.service_code)}')\">จองบริการนี้</button>\n      </div>`;\n    }).join('') || '<div class=\"card\">ยังไม่มีรายการบริการ</div>'}</div>`;\n}\n\n/* ---------- 3. ประวัติผู้รับจ้างแต่ละบริการ ---------- */\nfunction renderWorkers() {\n  const byKey = {};\n  SITE.workers.forEach(w => { byKey[w.key] = w; });\n  const since = s => { const m = String(s || '').match(/^(\\d{4})-(\\d{2})/); return m ? `ร่วมงานตั้งแต่ ${MONTH[+m[2] - 1]} ${+m[1] + 543}` : ''; };\n  const statusBadge = w => w.ready ? '<span class=\"badge b-ok\">พร้อมรับงาน</span>' : `<span class=\"badge b-warn\">${esc(w.status || 'ไม่ว่าง')}</span>`;\n  $('#panel').innerHTML = `\n    <h2 class=\"page-title\">ประวัติผู้รับจ้างแต่ละบริการ</h2>\n    <p class=\"page-sub\">ผู้ดูแลทุกคนผ่านการตรวจประวัติอาชญากรรม · แสดงชื่อแบบย่อเพื่อความเป็นส่วนตัว</p>\n    ${SITE.services.map(s => {\n      const list = s.worker_keys.map(k => byKey[k]).filter(Boolean);\n      return `<div class=\"svc-group\">\n        <h3>${esc(s.service_name)} <span class=\"badge b-brand\">${list.length} คน</span></h3>\n        ${list.length ? `<div class=\"cards\">${list.map(w => `\n          <div class=\"card worker-card\">\n            <div class=\"avatar\">${esc((w.name.replace(/^คุณ/, '') || '?').charAt(0))}</div>\n            <div>\n              <div class=\"name\">${esc(w.name)}</div>\n              <div class=\"small muted\">${esc(w.area || '')}${w.area && w.since ? ' · ' : ''}${since(w.since)}</div>\n              <div class=\"chips\">\n                ${statusBadge(w)}\n                ${w.police_ok ? '<span class=\"badge b-ok\">✓ ผ่านตรวจประวัติ</span>' : ''}\n                ${w.has_car ? '<span class=\"badge b-info\">🚗 มีรถส่วนตัว</span>' : ''}\n                <span class=\"badge\">งานสำเร็จ ${w.done_jobs} ครั้ง</span>\n              </div>\n              <div class=\"chips\">${w.skills.map(t => `<span class=\"badge b-brand\">${esc(t)}</span>`).join('')}</div>\n            </div>\n          </div>`).join('')}</div>` : '<div class=\"card small muted\">ยังไม่มีผู้รับจ้างสำหรับบริการนี้</div>'}\n      </div>`;\n    }).join('')}`;\n}\n\n/* ---------- 4. จำนวนผู้รับจ้างว่างวันไหนบ้างแต่ละบริการ ---------- */\nfunction renderAvailability() {\n  const head = SITE.days.map(d => {\n    const wd = new Date(utc(d)).getUTCDay();\n    return `<th class=\"${wd === 0 || wd === 6 ? 'weekend' : ''}\">${WEEKDAY[wd]}<br>${+d.slice(8)}/${+d.slice(5, 7)}</th>`;\n  }).join('');\n  $('#panel').innerHTML = `\n    <h2 class=\"page-title\">จำนวนผู้รับจ้างที่ว่าง 14 วันข้างหน้า</h2>\n    <p class=\"page-sub\">นับผู้ดูแลที่ว่างทั้งวัน มีทักษะตรงบริการ และพร้อมรับงาน · กดตัวเลขเพื่อจองวันนั้น · ข้อมูล ณ ${fmt(SITE.updated)}</p>\n    <div class=\"avail-wrap\"><table class=\"avail\">\n      <thead><tr><th>บริการ</th>${head}</tr></thead>\n      <tbody>${SITE.availability.map(a => `<tr><td>${esc(svcName(a.service_code))}</td>${a.counts.map((n, i) => {\n        const cls = n === 0 ? 'none' : n <= 1 ? 'low' : 'ok';\n        return `<td>${n === 0 ? '<span class=\"cnt none\">เต็ม</span>'\n          : `<button class=\"cnt ${cls}\" title=\"จองวันที่ ${fmt(SITE.days[i], false)}\" onclick=\"bookService('${esc(a.service_code)}','${SITE.days[i]}')\">${n}</button>`}</td>`;\n      }).join('')}</tr>`).join('')}</tbody>\n    </table></div>\n    <div class=\"legend\"><span><span class=\"cnt ok\">2+</span> ว่างหลายคน</span><span><span class=\"cnt low\">1</span> เหลือคนเดียว</span><span><span class=\"cnt none\">เต็ม</span> ไม่มีผู้ดูแลว่าง</span></div>`;\n}\n\n/* ---------- 5. รายการที่ให้บริการอยู่ ---------- */\nfunction renderOngoing() {\n  const L = SITE.ongoing;\n  const n = st => L.filter(x => x.state === st).length;\n  const label = { active: ['b-info', 'กำลังให้บริการ'], scheduled: ['b-ok', 'นัดหมายแล้ว'], waiting: ['b-warn', 'รอจัดผู้ดูแล'] };\n  $('#panel').innerHTML = `\n    <h2 class=\"page-title\">รายการที่ให้บริการอยู่</h2>\n    <p class=\"page-sub\">งานที่กำลังดูแลและนัดหมายล่วงหน้า · ไม่แสดงข้อมูลผู้ป่วยเพื่อความเป็นส่วนตัว · ข้อมูล ณ ${fmt(SITE.updated)}</p>\n    <div class=\"stats\">\n      <div class=\"stat\"><div class=\"v\">${n('active')}</div><div class=\"k\">กำลังให้บริการ</div></div>\n      <div class=\"stat\"><div class=\"v\">${n('scheduled')}</div><div class=\"k\">นัดหมายแล้ว</div></div>\n      <div class=\"stat\"><div class=\"v\">${n('waiting')}</div><div class=\"k\">รอจัดผู้ดูแล</div></div>\n    </div>\n    <div class=\"card\">${L.length ? L.map(x => `\n      <div class=\"ongo\">\n        <div class=\"grow\"><b>${esc(x.service_name)}</b>\n          <div class=\"small muted\">${fmt(x.start)} – ${fmt(x.end)}${x.worker ? ' · ผู้ดูแล: ' + esc(x.worker) : ''}</div></div>\n        <span class=\"badge ${label[x.state][0]}\">${label[x.state][1]}</span>\n      </div>`).join('') : '<div class=\"small muted\">ขณะนี้ยังไม่มีรายการให้บริการ</div>'}</div>`;\n}\n\n/* ---------- จองบริการ ---------- */\nfunction renderBookTab() {\n  $('#panel').innerHTML = `<div class=\"card narrow\" id=\"card\"></div>`;\n  renderBooking(SITE);\n}\n\nfunction renderBooking(info) {\n  $('#card').innerHTML = `\n  <h2 class=\"page-title\">จองบริการดูแลผู้ป่วย / ผู้สูงอายุ</h2>\n  <p class=\"page-sub\">กรอกข้อมูลด้านล่าง เจ้าหน้าที่ศูนย์จะติดต่อกลับเพื่อยืนยันและแจ้งช่องทางชำระเงิน</p>\n  <form id=\"f\" class=\"stack\">\n    <div class=\"section-title\">1. บริการที่ต้องการ</div>\n    <label class=\"field\">ประเภทบริการ\n      <select name=\"service_code\" required><option value=\"\">— เลือกบริการ —</option>\n        ${info.services.map(s => `<option value=\"${esc(s.service_code)}\">${esc(s.service_name)} — ${baht(s.client_price)}/${esc(s.unit_type || 'ครั้ง')}</option>`).join('')}\n      </select></label>\n    <div class=\"price-line\" id=\"price\" hidden></div>\n    <div class=\"grid\">\n      <label class=\"field\">วันเวลาเริ่ม <input type=\"datetime-local\" name=\"start_datetime\" required min=\"${nowLocal()}\"></label>\n      <label class=\"field\">วันเวลาสิ้นสุด <input type=\"datetime-local\" name=\"end_datetime\" required min=\"${nowLocal()}\"></label>\n    </div>\n    <label class=\"field\">สถานที่ปฏิบัติงาน / โรงพยาบาล <span class=\"hint\">เช่น รพ.ชุมชน ตึกผู้ป่วยใน ห้อง 3 หรือ \"ที่บ้าน\"</span>\n      <input name=\"hospital_location\"></label>\n\n    <div class=\"section-title\">2. ข้อมูลผู้ติดต่อ (ผู้ว่าจ้าง)</div>\n    <div class=\"grid\">\n      <label class=\"field\">ชื่อ-นามสกุล <input name=\"client_name\" required autocomplete=\"name\"></label>\n      <label class=\"field\">เบอร์โทรศัพท์ <input name=\"client_phone\" inputmode=\"tel\" required autocomplete=\"tel\" placeholder=\"08xxxxxxxx\"></label>\n    </div>\n\n    <div class=\"section-title\">3. ข้อมูลผู้รับการดูแล</div>\n    <div class=\"grid\">\n      <label class=\"field\">ชื่อผู้รับการดูแล <input name=\"patient_name\" required></label>\n      <label class=\"field\">สภาพร่างกาย <select name=\"patient_condition\" required><option value=\"\">— เลือก —</option>\n        ${info.conditions.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>\n      <label class=\"field full\">โรคประจำตัว / ข้อควรระวัง <textarea name=\"medical_precautions\" placeholder=\"เช่น เบาหวาน, ให้อาหารทางสายยาง, แพ้ยา\"></textarea></label>\n      <label class=\"field full\">ที่อยู่ / จุดสังเกตในชุมชน <textarea name=\"address_location\" required placeholder=\"บ้านเลขที่ หมู่ ตำบล และจุดสังเกต เช่น ตรงข้ามวัด\"></textarea></label>\n    </div>\n    <label class=\"check\"><input type=\"checkbox\" required> ยินยอมให้ศูนย์เก็บข้อมูลเพื่อใช้ในการให้บริการดูแลเท่านั้น</label>\n    <button type=\"submit\" class=\"btn btn-primary\" style=\"width:100%;padding:12px\">ส่งคำขอจองบริการ</button>\n  </form>`;\n  const f = $('#f');\n  f.service_code.onchange = () => {\n    const s = info.services.find(x => x.service_code === f.service_code.value);\n    $('#price').hidden = !s;\n    if (s) $('#price').innerHTML = `ค่าบริการ <b>${baht(s.client_price)}</b> ต่อ${esc(s.unit_type || 'ครั้ง')} · ราคาคงที่ ไม่มีค่าใช้จ่ายแอบแฝง`;\n  };\n  f.start_datetime.onchange = () => { if (!f.end_datetime.value) f.end_datetime.value = f.start_datetime.value; f.end_datetime.min = f.start_datetime.value; };\n\n  // มาจากปุ่ม \"จองบริการนี้\" หรือกดตัวเลขในตารางวันว่าง\n  if (PRESELECT.service) { f.service_code.value = PRESELECT.service; f.service_code.onchange(); }\n  if (PRESELECT.date) {\n    const start = PRESELECT.date === today() ? nowLocal(1).slice(0, 14) + '00' : PRESELECT.date + 'T08:00';\n    f.start_datetime.value = start;\n    f.start_datetime.onchange();\n  }\n  PRESELECT = {};\n\n  f.onsubmit = e => {\n    e.preventDefault();\n    submitWith(f, async () => {\n      const r = await api('submitBooking', data(f));\n      $('#card').innerHTML = `<div class=\"done\"><div class=\"big\">💗</div><h2>ส่งคำขอจองเรียบร้อย</h2>\n        <p>เลขที่ใบงานของคุณ <b>${esc(r.job_id)}</b></p>\n        <p class=\"muted\">${esc(r.service_name)} · ${baht(r.amount)}</p>\n        <div class=\"alert alert-info\" style=\"text-align:left\">เจ้าหน้าที่จะโทรกลับเพื่อยืนยันคิวและแจ้งช่องทางชำระเงิน<br>\n        ศูนย์จะส่งผู้ดูแลลงพื้นที่หลังได้รับชำระเงินแล้วเท่านั้น เพื่อความปลอดภัยของทุกฝ่าย</div></div>`;\n    });\n  };\n}\n\n/* ============================================================\n * ยื่นใบลา (หน้า ?page=ยื่นใบลา)\n * ============================================================ */\nfunction renderLeave(info) {\n  $('#panel').innerHTML = `<div class=\"card\" id=\"card\"></div>`;\n  $('#card').innerHTML = `\n  <form id=\"f\" class=\"stack\">\n    <div class=\"grid\">\n      <label class=\"field\">รหัสผู้รับจ้าง <input name=\"worker_id\" required placeholder=\"WK-001\" autocapitalize=\"characters\"></label>\n      <label class=\"field\">เบอร์โทร 4 ตัวท้าย <input name=\"phone_last4\" required inputmode=\"numeric\" maxlength=\"4\" pattern=\"\\\\d{4}\"></label>\n      <label class=\"field\">วันที่เริ่มหยุดงาน <input type=\"date\" name=\"leave_start_date\" required min=\"${today()}\"></label>\n      <label class=\"field\">วันสุดท้ายที่หยุดงาน <input type=\"date\" name=\"leave_end_date\" required min=\"${today()}\"></label>\n    </div>\n    <div id=\"notice\"></div>\n    <label class=\"field\">เหตุผลการลาหยุด <textarea name=\"leave_reason\" required></textarea></label>\n    <button type=\"submit\" class=\"btn btn-primary\" style=\"width:100%;padding:12px\">ส่งใบลา</button>\n  </form>`;\n  const f = $('#f');\n  const check = () => {\n    const s = f.leave_start_date.value;\n    if (!s) { $('#notice').innerHTML = ''; return; }\n    const n = dayDiff(today(), s);\n    $('#notice').innerHTML = n < info.minLeaveDays\n      ? `<div class=\"alert alert-danger\">🔴 ${esc(info.lateLeaveTag)}<br><span style=\"font-weight:400\">แจ้งล่วงหน้าเพียง ${n} วัน (สัญญากำหนด ${info.minLeaveDays} วันขึ้นไป) — ยังส่งได้ แต่จะถูกบันทึกว่าผิดเงื่อนไข และต้องรอศูนย์พิจารณา</span></div>`\n      : `<div class=\"alert alert-ok\">✅ แจ้งล่วงหน้า ${n} วัน ผ่านเกณฑ์ 1 สัปดาห์</div>`;\n  };\n  f.leave_start_date.onchange = () => {\n    if (!f.leave_end_date.value || f.leave_end_date.value < f.leave_start_date.value) f.leave_end_date.value = f.leave_start_date.value;\n    f.leave_end_date.min = f.leave_start_date.value;\n    check();\n  };\n  f.onsubmit = e => {\n    e.preventDefault();\n    submitWith(f, async () => {\n      const r = await api('submitLeave', data(f));\n      $('#card').innerHTML = `<div class=\"done\"><div class=\"big\">${r.late ? '⚠️' : '✅'}</div><h2>ส่งใบลาเรียบร้อย</h2>\n        <p>เลขที่ใบลา <b>${esc(r.leave_id)}</b> · แจ้งล่วงหน้า ${esc(r.notice_days)} วัน</p>\n        ${r.late ? `<div class=\"alert alert-danger\">🔴 ${esc(r.tag)}</div>` : '<div class=\"alert alert-ok\">ผ่านเกณฑ์แจ้งล่วงหน้า 1 สัปดาห์</div>'}\n        ${r.affected.length ? `<p class=\"small muted\">ใบลานี้กระทบงาน ${r.affected.length} รายการ ศูนย์จะจัดคนแทนให้</p>` : ''}\n        <p class=\"small muted\">สถานะ: รอศูนย์ตรวจสอบ — จะแจ้งผลทาง LINE (ถ้าผูกบัญชีไว้)</p></div>`;\n    });\n  };\n}\n</script>\n</body>\n</html>\n",
  "Styles": "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link href=\"https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap\" rel=\"stylesheet\">\n<style>\n  :root {\n    --brand: #1f6273;\n    --brand-strong: #164a57;\n    --brand-soft: #e4eff2;\n    --heart: #d9952c;\n    --bg: #f5f7f6;\n    --surface: #ffffff;\n    --ink: #1d2a27;\n    --muted: #5f6f6b;\n    --line: #e1e7e5;\n    --danger: #b3261e;\n    --danger-bg: #fdecec;\n    --warn: #8a5300;\n    --warn-bg: #fff4e0;\n    --ok: #1b7f3b;\n    --ok-bg: #e7f6ec;\n    --info: #1f5fa8;\n    --info-bg: #e8f0fb;\n    --radius: 12px;\n    --shadow: 0 1px 2px rgba(16, 40, 34, .06), 0 4px 16px rgba(16, 40, 34, .06);\n  }\n  * { box-sizing: border-box; }\n  html, body { margin: 0; }\n  body {\n    font-family: 'Sarabun', system-ui, sans-serif;\n    font-size: 15px;\n    line-height: 1.55;\n    background: var(--bg);\n    color: var(--ink);\n  }\n  [hidden] { display: none !important; }\n  a { color: var(--brand); }\n  h1, h2, h3 { margin: 0; line-height: 1.3; }\n\n  /* ---------- brand ---------- */\n  .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }\n  .brand-logo {\n    flex: none; width: 48px; height: 48px; border-radius: 50%;\n    background: #fff; object-fit: cover; box-shadow: 0 0 0 1px var(--line);\n  }\n  .brand-name { font-size: 19px; font-weight: 700; }\n  .brand-version { display: inline-block; font-size: 12px; font-weight: 600; color: var(--muted); letter-spacing: .2px; }\n  .brand-slogan { font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n\n  /* ---------- controls ---------- */\n  .btn {\n    display: inline-flex; align-items: center; justify-content: center; gap: 6px;\n    font: inherit; font-weight: 600; font-size: 14px;\n    padding: 8px 14px; border-radius: 9px; border: 1px solid var(--line);\n    background: var(--surface); color: var(--ink); cursor: pointer; white-space: nowrap;\n  }\n  .btn:hover { border-color: #c5d0cd; }\n  .btn:disabled { opacity: .55; cursor: not-allowed; }\n  .btn-primary { background: var(--brand); border-color: var(--brand); color: #fff; }\n  .btn-primary:hover { background: var(--brand-strong); }\n  .btn-danger { background: var(--danger); border-color: var(--danger); color: #fff; }\n  .btn-sm { padding: 4px 10px; font-size: 13px; }\n  .btn-ghost { background: transparent; border-color: transparent; color: var(--brand); }\n\n  label.field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 600; color: var(--muted); }\n  label.field > span.hint { font-weight: 400; font-size: 12px; }\n  input, select, textarea {\n    font: inherit; font-size: 15px; color: var(--ink);\n    padding: 8px 10px; border: 1px solid var(--line); border-radius: 9px; background: #fff; width: 100%;\n  }\n  input:focus, select:focus, textarea:focus { outline: 2px solid rgba(14, 124, 107, .25); border-color: var(--brand); }\n  input[readonly] { background: #f2f5f4; color: var(--muted); }\n  textarea { min-height: 70px; resize: vertical; }\n  .check { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 500; color: var(--ink); }\n  .check input { width: auto; }\n  .grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }\n  .grid .full { grid-column: 1 / -1; }\n  @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }\n\n  /* ---------- badges / alerts ---------- */\n  .badge {\n    display: inline-block; padding: 2px 9px; border-radius: 999px;\n    font-size: 12.5px; font-weight: 600; white-space: nowrap;\n    background: #eef1f0; color: var(--muted);\n  }\n  .b-ok { background: var(--ok-bg); color: var(--ok); }\n  .b-danger { background: var(--danger-bg); color: var(--danger); }\n  .b-warn { background: var(--warn-bg); color: var(--warn); }\n  .b-info { background: var(--info-bg); color: var(--info); }\n  .b-brand { background: var(--brand-soft); color: var(--brand-strong); }\n  .tag-red {\n    display: inline-block; padding: 2px 9px; border-radius: 6px;\n    background: var(--danger); color: #fff; font-size: 12.5px; font-weight: 700; white-space: nowrap;\n  }\n  .alert { padding: 10px 14px; border-radius: 10px; font-size: 14px; border: 1px solid transparent; }\n  .alert-danger { background: var(--danger-bg); color: var(--danger); border-color: #f5c6c3; font-weight: 600; }\n  .alert-warn { background: var(--warn-bg); color: var(--warn); border-color: #f3dcb0; }\n  .alert-ok { background: var(--ok-bg); color: var(--ok); border-color: #bfe5cc; }\n  .alert-info { background: var(--info-bg); color: var(--info); border-color: #c8daf3; }\n\n  .card { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); padding: 18px; }\n  .muted { color: var(--muted); }\n  .small { font-size: 13px; }\n  .stack > * + * { margin-top: 12px; }\n  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }\n  .spacer { flex: 1; }\n\n  #toast {\n    position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%);\n    background: #1d2a27; color: #fff; padding: 10px 16px; border-radius: 10px;\n    font-size: 14px; max-width: calc(100vw - 32px); z-index: 50; box-shadow: var(--shadow);\n    white-space: pre-line;\n  }\n  #toast.error { background: var(--danger); }\n  .spinner {\n    width: 18px; height: 18px; border-radius: 50%;\n    border: 2px solid rgba(14, 124, 107, .2); border-top-color: var(--brand);\n    animation: spin .8s linear infinite; display: inline-block; vertical-align: middle;\n  }\n  @keyframes spin { to { transform: rotate(360deg); } }\n</style>\n"
};
