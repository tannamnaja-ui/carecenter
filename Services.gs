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
