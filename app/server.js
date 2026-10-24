'use strict';
const express = require('express');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const prom = require('prom-client');
const path = require('path');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const pool = new Pool({ max: 10, connectionTimeoutMillis: 5000 });
const registry = new prom.Registry();
prom.collectDefaultMetrics({ register: registry, prefix: 'tour_' });
const httpRequests = new prom.Counter({
  name: 'http_requests_total',
  help: 'Number of requests handled by Node.js',
  labelNames: ['method', 'route', 'status'], registers: [registry]
});
const bookingsMade = new prom.Counter({
  name: 'tour_bookings_created_total', help: 'Bookings created', registers: [registry]
});
app.use((req, res, next) => {
  res.on('finish', () => {
    const route = req.route && req.route.path ? req.route.path : 'other';
    httpRequests.inc({ method: req.method, route, status: String(res.statusCode) });
  });
  next();
});
app.use(express.json({ limit: '40kb' }));
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'viettravel' }));
app.get('/metrics', async (req, res, next) => {
  try { res.set('Content-Type', registry.contentType); res.end(await registry.metrics()); }
  catch (e) { next(e); }
});

const bookingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false });
const listTourSql = `
  SELECT t.id,t.title,t.destination,t.duration_days,t.price,t.capacity,t.description,t.image_url,
  COALESCE(json_agg(json_build_object('day',i.day_number,'details',i.details)
    ORDER BY i.day_number) FILTER (WHERE i.id IS NOT NULL),'[]'::json) AS itinerary
  FROM tours t LEFT JOIN itineraries i ON i.tour_id=t.id`;
app.get('/api/tours', async (req, res, next) => {
  try { const data = await pool.query(`${listTourSql} GROUP BY t.id ORDER BY t.id`); res.json(data.rows); }
  catch (e) { next(e); }
});
app.get('/api/tours/:id', async (req, res, next) => {
  try {
    const data = await pool.query(`${listTourSql} WHERE t.id=$1 GROUP BY t.id`, [req.params.id]);
    if (!data.rowCount) return res.status(404).json({ error: 'Không tìm thấy tour' });
    res.json(data.rows[0]);
  } catch (e) { next(e); }
});
function text(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function goodDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value &&
    value >= new Date().toISOString().slice(0, 10);
}
app.post('/api/bookings', bookingLimiter, async (req, res, next) => {
  const body = req.body || {};
  const tourId = Number(body.tour_id), guests = Number(body.guests);
  const fullName = text(body.full_name, 120), email = text(body.email, 200).toLowerCase();
  const phone = text(body.phone, 24), departure = body.departure_date;
  if (!Number.isInteger(tourId) || tourId < 1 || !Number.isInteger(guests) || guests < 1 || guests > 20 ||
      fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^[+\d().\s-]{9,24}$/.test(phone) || !goodDate(departure)) {
    return res.status(400).json({ error: 'Thông tin đặt tour không hợp lệ. Kiểm tra ngày, email, điện thoại và số khách.' });
  }
  const client = await pool.connect().catch(next);
  if (!client) return;
  try {
    await client.query('BEGIN');
    const selected = await client.query('SELECT id,capacity FROM tours WHERE id=$1 FOR UPDATE', [tourId]);
    if (!selected.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Tour không tồn tại.' }); }
    const used = await client.query(
      "SELECT COALESCE(SUM(guests),0)::int AS occupied FROM bookings WHERE tour_id=$1 AND departure_date=$2 AND status <> 'cancelled'",
      [tourId, departure]);
    if (used.rows[0].occupied + guests > selected.rows[0].capacity) {
      await client.query('ROLLBACK'); return res.status(409).json({ error: 'Lịch khởi hành này không còn đủ chỗ.' });
    }
    const customer = await client.query(
      'INSERT INTO customers(full_name,email,phone) VALUES ($1,$2,$3) ON CONFLICT(email) DO UPDATE SET full_name=EXCLUDED.full_name,phone=EXCLUDED.phone RETURNING id',
      [fullName, email, phone]);
    const created = await client.query(
      'INSERT INTO bookings(tour_id,customer_id,departure_date,guests) VALUES($1,$2,$3,$4) RETURNING id,status',
      [tourId, customer.rows[0].id, departure, guests]);
    await client.query('COMMIT');
    bookingsMade.inc();
    console.log(`BOOKING_CREATED id=${created.rows[0].id} tour=${tourId} guests=${guests}`);
    res.status(201).json({ message: 'Đặt tour thành công!', booking_id: created.rows[0].id, status: created.rows[0].status });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); next(e); }
  finally { client.release(); }
});

function adminOnly(req, res, next) {
  const raw = req.get('authorization') || '';
  const token = raw.startsWith('Basic ') ? raw.slice(6) : '';
  let supplied;
  try { supplied = Buffer.from(token, 'base64'); } catch { supplied = Buffer.alloc(0); }
  const expected = Buffer.from(`${process.env.ADMIN_USER}:${process.env.ADMIN_PASSWORD}`);
  if (!token || supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    res.set('WWW-Authenticate', 'Basic realm="VietTravel admin"');
    return res.status(401).json({ error: 'Tài khoản quản trị không hợp lệ.' });
  }
  next();
}
app.use('/api/admin', adminOnly);
app.get('/api/admin/bookings', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT b.id,b.guests,b.departure_date,b.status,b.created_at,
      t.title AS tour_title,c.full_name,c.email,c.phone FROM bookings b
      JOIN tours t ON t.id=b.tour_id JOIN customers c ON c.id=b.customer_id ORDER BY b.id DESC LIMIT 200`);
    res.json(result.rows);
  } catch (e) { next(e); }
});
app.patch('/api/admin/bookings/:id', async (req, res, next) => {
  const status = req.body && req.body.status;
  if (!['pending', 'confirmed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
  try {
    const result = await pool.query('UPDATE bookings SET status=$1 WHERE id=$2 RETURNING id,status', [status, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Không tìm thấy booking.' });
    res.json(result.rows[0]);
  } catch (e) { next(e); }
});
async function saveTour(req, res, next, isUpdate) {
  const b = req.body || {};
  const title = text(b.title), destination = text(b.destination, 120), description = text(b.description, 3000), image = text(b.image_url, 1000);
  const days = Number(b.duration_days), price = Number(b.price), capacity = Number(b.capacity);
  const itinerary = b.itinerary;
  if (!title || !destination || description.length < 10 || !Number.isInteger(days) || days < 1 || days > 30 ||
      !Number.isInteger(price) || price < 0 || !Number.isInteger(capacity) || capacity < 1 || capacity > 1000 ||
      !Array.isArray(itinerary) || itinerary.length !== days || itinerary.some(v => typeof v !== 'string' || !v.trim() || v.length > 1000) ||
      (image && !/^https:\/\//.test(image))) return res.status(400).json({ error: 'Dữ liệu tour không hợp lệ (lịch trình phải đủ số ngày).' });
  const client = await pool.connect().catch(next);
  if (!client) return;
  try {
    await client.query('BEGIN');
    let id;
    if (isUpdate) {
      const update = await client.query(`UPDATE tours SET title=$1,destination=$2,description=$3,duration_days=$4,
        price=$5,capacity=$6,image_url=$7 WHERE id=$8 RETURNING id`,
        [title,destination,description,days,price,capacity,image,req.params.id]);
      if (!update.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({error:'Không tìm thấy tour.'}); }
      id = update.rows[0].id;
      await client.query('DELETE FROM itineraries WHERE tour_id=$1', [id]);
    } else {
      const insert = await client.query(`INSERT INTO tours(title,destination,description,duration_days,price,capacity,image_url)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [title,destination,description,days,price,capacity,image]);
      id = insert.rows[0].id;
    }
    for (let i = 0; i < itinerary.length; i++) {
      await client.query('INSERT INTO itineraries(tour_id,day_number,details) VALUES($1,$2,$3)', [id,i+1,itinerary[i].trim()]);
    }
    await client.query('COMMIT');
    res.status(isUpdate ? 200 : 201).json({ id, title });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); next(e); }
  finally { client.release(); }
}
app.post('/api/admin/tours', (req,res,next) => saveTour(req,res,next,false));
app.put('/api/admin/tours/:id', (req,res,next) => saveTour(req,res,next,true));
app.delete('/api/admin/tours/:id', async (req,res,next) => {
  try {
    const result = await pool.query('DELETE FROM tours WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({error:'Không tìm thấy tour.'});
    res.json({deleted:result.rows[0].id});
  } catch(e) {
    if(e.code === '23503') return res.status(409).json({error:'Tour đã có booking nên không thể xóa. Hãy chỉnh sửa thông tin tour.'});
    next(e);
  }
});
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));
app.use((err, req, res, next) => {
  console.error(`ERROR ${req.method} ${req.path}`, err.message);
  res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại.' });
});
const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`VietTravel listening on :${port}`));
