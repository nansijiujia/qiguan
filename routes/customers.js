const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { query, getOne, execute } = require('../db-unified');
router.use(verifyToken);

router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  let where = '1=1', params = [];
  if (req.query.keyword) {
    where += ' AND (nickname LIKE ? OR real_name LIKE ? OR phone LIKE ?)';
    const k = '%'+req.query.keyword+'%'; params.push(k,k,k);
  }
  if (req.query.status) { where += ' AND status = ?'; params.push(req.query.status); }

  const list = await query(
    "SELECT id, openid, nickname, avatar_url, real_name, phone, gender, province, city, district, detail_address, full_address, status, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i') as created_at FROM customers WHERE " + where + " ORDER BY id DESC LIMIT ? OFFSET ?",
    [...params, limit, (page-1)*limit]
  );
  const c = await query("SELECT COUNT(*) as total FROM customers WHERE " + where, params);
  res.json({ success: true, data: { list, pagination: { total: c[0].total, page, limit } } });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const r = await getOne('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  res.json(r ? { success: true, data: r } : { success: false, error: { code: 'NOT_FOUND' } });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const f = ['real_name','phone','province','city','district','detail_address','gender','status'];
  const u = [], p = [];
  f.forEach(x => { if (req.body[x] !== undefined) { u.push(x+' = ?'); p.push(req.body[x]); }});
  if (u.length) {
    u.push("full_address = CONCAT(IFNULL(province,''), IFNULL(city,''), IFNULL(district,''), IFNULL(detail_address,''))");
    p.push(req.params.id);
    await execute('UPDATE customers SET '+u.join(', ')+' WHERE id = ?', p);
  }
  res.json({ success: true });
}));

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  await execute('DELETE FROM customers WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

module.exports = router;