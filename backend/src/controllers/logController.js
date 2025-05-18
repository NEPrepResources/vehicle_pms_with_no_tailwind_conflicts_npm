const pool = require('../config/db');

const getLogs = async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10, search = '' } = req.query;
  const offset = (page - 1) * limit;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const sanitizedSearch = search.trim().replace(/\s+/g, ' ');
    const searchQuery = `%${sanitizedSearch}%`;

    const query = `
      SELECT * FROM logs
      WHERE action ILIKE $1 OR user_id::text ILIKE $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const countQuery = `
      SELECT COUNT(*) FROM logs
      WHERE action ILIKE $1 OR user_id::text ILIKE $1
    `;
    const params = [searchQuery, limit, offset];

    const countResult = await pool.query(countQuery, [searchQuery]);
    const totalItems = parseInt(countResult.rows[0].count);

    const result = await pool.query(query, params);

    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      'Logs list viewed',
    ]);

    res.json({
      data: result.rows,
      meta: {
        totalItems,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / limit),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

module.exports = { getLogs };