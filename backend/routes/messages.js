const router = require('express').Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { cleanString, parsePositiveInt } = require('../utils/validators');

// GET /api/messages/conversations — list all unique conversation partners
router.get('/conversations', requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.user;
  const result = await pool.query(
    `SELECT DISTINCT ON (other_id)
       other_id,
       other_name,
       content AS last_message,
       created_at,
       unread_count
     FROM (
       SELECT
         CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS other_id,
         u.first_name || ' ' || u.last_name AS other_name,
         m.content,
         m.created_at,
         (SELECT COUNT(*) FROM messages m2
          WHERE m2.sender_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
            AND m2.receiver_id = $1
            AND m2.read = false) AS unread_count
       FROM messages m
       JOIN users u ON u.id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
       WHERE m.sender_id = $1 OR m.receiver_id = $1
       ORDER BY m.created_at DESC
     ) sub
     ORDER BY other_id, created_at DESC`,
    [id]
  );
  return res.json(result.rows);
}));

// GET /api/messages/:userId — get conversation between current user and :userId
router.get('/:userId', requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.user;
  const otherId = parsePositiveInt(req.params.userId);
  if (!otherId) return res.status(400).json({ error: 'Invalid user id' });

  const page = Math.max(1, parsePositiveInt(req.query.page) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const result = await pool.query(
    `SELECT m.id, m.sender_id, m.receiver_id, m.content, m.read, m.created_at,
            u.first_name || ' ' || u.last_name AS sender_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE (m.sender_id = $1 AND m.receiver_id = $2)
        OR (m.sender_id = $2 AND m.receiver_id = $1)
     ORDER BY m.created_at ASC
     LIMIT $3 OFFSET $4`,
    [id, otherId, limit, offset]
  );
  return res.json(result.rows);
}));

// POST /api/messages/:userId — send message to :userId
router.post('/:userId', requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.user;
  const otherId = parsePositiveInt(req.params.userId);
  if (!otherId) return res.status(400).json({ error: 'Invalid user id' });
  if (otherId === id) return res.status(400).json({ error: 'Cannot message yourself' });

  const content = cleanString(req.body?.content, { max: 2000 });
  if (!content) return res.status(400).json({ error: 'content is required (1-2000 chars)' });

  // Verify recipient exists
  const recipient = await pool.query('SELECT id FROM users WHERE id=$1', [otherId]);
  if (!recipient.rows.length) return res.status(404).json({ error: 'Recipient not found' });

  const result = await pool.query(
    `INSERT INTO messages(sender_id, receiver_id, content)
     VALUES($1, $2, $3) RETURNING *`,
    [id, otherId, content]
  );
  return res.status(201).json(result.rows[0]);
}));

// PATCH /api/messages/:userId/read — mark messages from :userId as read
router.patch('/:userId/read', requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.user;
  const otherId = parsePositiveInt(req.params.userId);
  if (!otherId) return res.status(400).json({ error: 'Invalid user id' });

  await pool.query(
    'UPDATE messages SET read=true WHERE sender_id=$1 AND receiver_id=$2 AND read=false',
    [otherId, id]
  );
  return res.json({ ok: true });
}));

module.exports = router;
