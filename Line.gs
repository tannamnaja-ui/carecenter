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
