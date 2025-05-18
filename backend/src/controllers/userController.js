const bcrypt = require('bcrypt');
const pool = require('../config/db');

const getProfile = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [
      userId,
    ]);
    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      'User profile viewed',
    ]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { name, email, password } = req.body;
  try {
    // Sanitize inputs
    const sanitizedName = name?.trim();
    const sanitizedEmail = email?.trim().toLowerCase();
    const sanitizedPassword = password?.trim();

    // Validate inputs
    if (sanitizedName && sanitizedName.length > 100) {
      return res.status(400).json({ error: 'Name must be 100 characters or less' });
    }
    if (sanitizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (sanitizedPassword && sanitizedPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (sanitizedName) {
      updates.push(`name = $${paramIndex++}`);
      values.push(sanitizedName);
    }
    if (sanitizedEmail) {
      updates.push(`email = $${paramIndex++}`);
      values.push(sanitizedEmail);
    }
    if (sanitizedPassword) {
      const hashedPassword = await bcrypt.hash(sanitizedPassword, 10);
      updates.push(`password = $${paramIndex++}`);
      values.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(userId);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, email, role`;
    const result = await pool.query(query, values);

    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      'Profile updated',
    ]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(400).json({ error: 'Email already exists or server error' });
  }
};

const getUsers = async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const offset = (page - 1) * limit;
  try {
    // Sanitize search input
    const sanitizedSearch = search.trim().replace(/\s+/g, ' ');
    const searchQuery = `%${sanitizedSearch}%`;

    const countQuery = `
      SELECT COUNT(*) 
      FROM users 
      WHERE name ILIKE $1 OR email ILIKE $1
    `;
    const query = `
      SELECT id, name, email, is_verified, role 
      FROM users 
      WHERE name ILIKE $1 OR email ILIKE $1
      ORDER BY id
      LIMIT $2 OFFSET $3
    `;

    const countResult = await pool.query(countQuery, [searchQuery]);
    const totalItems = parseInt(countResult.rows[0].count);

    const result = await pool.query(query, [searchQuery, limit, offset]);

    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      req.user.id,
      'Users list viewed',
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
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteUser = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 AND id != $2 RETURNING id',
      [id, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found or cannot delete self' });
    }
    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      `User ${id} deleted`,
    ]);
    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getProfile, updateProfile, getUsers, deleteUser };