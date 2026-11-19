// In-app booking confirmations for the signed-in user.
const router = require('express').Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, message, is_read, created_at FROM notifications WHERE user_id = ? AND channel = 'in_app' ORDER BY id DESC LIMIT 50",
      [req.user.id]);
    res.json({ unread: rows.filter((r) => !r.is_read).length, items: rows });
  } catch (e) { next(e); }
});

router.patch('/read-all', async (req, res, next) => {
  try {
    await pool.query("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND channel = 'in_app'", [req.user.id]);
    res.json({ message: 'ok' });
  } catch (e) { next(e); }
});

module.exports = router;
