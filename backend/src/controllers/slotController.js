const pool = require('../config/db');

const bulkCreateSlots = async (req, res) => {
  const userId = req.user.id;
  const { slots } = req.body; 
  try {
    const values = slots.map(
      (slot, index) =>
        `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`
    );
    const query = `
      INSERT INTO parking_slots (slot_number, size, vehicle_type, location)
      VALUES ${values.join(', ')}
      RETURNING *
    `;
    const flatValues = slots.flatMap((slot) => [
      slot.slot_number,
      slot.size,
      slot.vehicle_type,
      slot.location,
    ]);
    const result = await pool.query(query, flatValues);

    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      `Bulk created ${slots.length} slots`,
    ]);
    res.status(201).json(result.rows);
  } catch (error) {
    res.status(400).json({ error: 'Slot number already exists or server error' });
  }
};

const getSlots = async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const offset = (page - 1) * limit;
  const isAdmin = req.user.role === 'admin';
  try {
    const searchQuery = `%${search}%`;
    let query = 'SELECT * FROM parking_slots WHERE slot_number ILIKE $1 OR vehicle_type ILIKE $1';
    let countQuery =
      'SELECT COUNT(*) FROM parking_slots WHERE slot_number ILIKE $1 OR vehicle_type ILIKE $1';
    const params = [searchQuery];

    if (!isAdmin) {
      query += ' AND status = $2';
      countQuery += ' AND status = $2';
      params.push('available');
    }

    query += ' ORDER BY id LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const totalItems = parseInt(countResult.rows[0].count);

    const result = await pool.query(query, params);

    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      req.user.id,
      'Slots list viewed',
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
    res.status(500).json({ error: 'Server error' });
  }
};

const updateSlot = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { slot_number, size, vehicle_type, location } = req.body;
  try {
    const result = await pool.query(
      'UPDATE parking_slots SET slot_number = $1, size = $2, vehicle_type = $3, location = $4 WHERE id = $5 RETURNING *',
      [slot_number, size, vehicle_type, location, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }
    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      `Slot ${slot_number} updated`,
    ]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: 'Slot number already exists or server error' });
  }
};

const deleteSlot = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM parking_slots WHERE id = $1 RETURNING slot_number',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }
    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      `Slot ${result.rows[0].slot_number} deleted`,
    ]);
    res.json({ message: 'Slot deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { bulkCreateSlots, getSlots, updateSlot, deleteSlot };