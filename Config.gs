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
