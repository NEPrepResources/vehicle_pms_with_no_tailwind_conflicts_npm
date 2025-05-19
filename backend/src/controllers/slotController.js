const pool = require('../config/db');

const bulkCreateSlots = async (req, res) => {
  const userId = req.user.id;
  const { slots } = req.body;
  try {
    if (!Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ error: 'Slots array is required and cannot be empty' });
    }

    const sanitizedSlots = slots.map(slot => ({
      slot_number: slot.slot_number?.trim(),
      size: slot.size?.trim().toLowerCase(),
      vehicle_type: slot.vehicle_type?.trim().toLowerCase(),
      location: slot.location?.trim()
    }));

    // Validate required fields and allowed values
    const validSizes = ['small', 'medium', 'large'];
    const validVehicleTypes = ['car', 'taxi', 'truck', 'any'];
    for (const slot of sanitizedSlots) {
      if (!slot.slot_number || !slot.size || !slot.vehicle_type || !slot.location) {
        return res.status(400).json({ error: 'All slot fields are required' });
      }
      if (!validSizes.includes(slot.size)) {
        return res.status(400).json({ error: `Invalid size: ${slot.size}. Must be one of ${validSizes.join(', ')}` });
      }
      if (!validVehicleTypes.includes(slot.vehicle_type)) {
        return res.status(400).json({ error: `Invalid vehicle type: ${slot.vehicle_type}. Must be one of ${validVehicleTypes.join(', ')}` });
      }
    }

    const values = sanitizedSlots.map(
      (slot, index) =>
        `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`
    );
    const query = `
      INSERT INTO parking_slots (slot_number, size, vehicle_type, location)
      VALUES ${values.join(', ')}
      RETURNING *
    `;
    const flatValues = sanitizedSlots.flatMap((slot) => [
      slot.slot_number,
      slot.size,
      slot.vehicle_type,
      slot.location,
    ]);
    const result = await pool.query(query, flatValues);

    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      `Bulk created ${sanitizedSlots.length} slots`,
    ]);
    res.status(201).json(result.rows);
  } catch (error) {
    console.error('Bulk create slots error:', error);
    res.status(400).json({ error: 'Slot number already exists or server error' });
  }
};

const getSlots = async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const offset = (page - 1) * limit;
  const isAdmin = req.user.role === 'admin';
  try {
    const sanitizedSearch = search.trim().replace(/\s+/g, ' ');
    const searchQuery = `%${sanitizedSearch}%`;
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
    console.error('Get slots error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateSlot = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { slot_number, size, vehicle_type, location } = req.body;
  try {
    // Sanitize and validate inputs
    const sanitizedSlotNumber = slot_number?.trim();
    const sanitizedSize = size?.trim().toLowerCase();
    const sanitizedVehicleType = vehicle_type?.trim().toLowerCase();
    const sanitizedLocation = location?.trim();

    const validSizes = ['small', 'medium', 'large'];
    const validVehicleTypes = ['car', 'taxi', 'truck', 'any'];

    if (!sanitizedSlotNumber || !sanitizedSize || !sanitizedVehicleType || !sanitizedLocation) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!validSizes.includes(sanitizedSize)) {
      return res.status(400).json({ error: `Invalid size: ${sanitizedSize}. Must be one of ${validSizes.join(', ')}` });
    }
    if (!validVehicleTypes.includes(sanitizedVehicleType)) {
      return res.status(400).json({ error: `Invalid vehicle type: ${sanitizedVehicleType}. Must be one of ${validVehicleTypes.join(', ')}` });
    }

    const result = await pool.query(
      'UPDATE parking_slots SET slot_number = $1, size = $2, vehicle_type = $3, location = $4 WHERE id = $5 RETURNING *',
      [sanitizedSlotNumber, sanitizedSize, sanitizedVehicleType, sanitizedLocation, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }
    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      `Slot ${sanitizedSlotNumber} updated`,
    ]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update slot error:', error);
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
    console.error('Delete slot error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { bulkCreateSlots, getSlots, updateSlot, deleteSlot };