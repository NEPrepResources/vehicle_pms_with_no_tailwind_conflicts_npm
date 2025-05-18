const pool = require('../config/db');
const { sendApprovalEmail, sendRejectionEmail } = require('../utils/email');

const createRequest = async (req, res) => {
  const userId = req.user.id;
  const { vehicle_id } = req.body;
  try {
    // Sanitize vehicle_id: ensure it's a positive integer
    const sanitizedVehicleId = parseInt(vehicle_id);
    if (isNaN(sanitizedVehicleId) || sanitizedVehicleId <= 0) {
      return res.status(400).json({ error: 'Invalid vehicle ID' });
    }

    const vehicleResult = await pool.query('SELECT * FROM vehicles WHERE id = $1 AND user_id = $2', [
      sanitizedVehicleId,
      userId,
    ]);
    if (vehicleResult.rowCount === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const result = await pool.query(
      'INSERT INTO slot_requests (user_id, vehicle_id, request_status) VALUES ($1, $2, $3) RETURNING *',
      [userId, sanitizedVehicleId, 'pending']
    );
    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      `Slot request created for vehicle ${sanitizedVehicleId}`,
    ]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

const getRequests = async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10, search = '' } = req.query;
  const offset = (page - 1) * limit;
  const isAdmin = req.user.role === 'admin';
  try {
    // Sanitize search input: trim whitespace and replace multiple spaces with a single space
    const sanitizedSearch = search.trim().replace(/\s+/g, ' ');
    const searchQuery = `%${sanitizedSearch}%`;
    let query = `
      SELECT sr.*, v.plate_number, v.vehicle_type
      FROM slot_requests sr
      JOIN vehicles v ON sr.vehicle_id = v.id
      WHERE (v.plate_number ILIKE $1 OR sr.request_status ILIKE $1)
    `;
    let countQuery = `
      SELECT COUNT(*)
      FROM slot_requests sr
      JOIN vehicles v ON sr.vehicle_id = v.id
      WHERE (v.plate_number ILIKE $1 OR sr.request_status ILIKE $1)
    `;
    const params = [searchQuery];

    if (!isAdmin) {
      query += ' AND sr.user_id = $2';
      countQuery += ' AND sr.user_id = $2';
      params.push(userId);
    }

    query += ' ORDER BY sr.id LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const totalItems = parseInt(countResult.rows[0].count);

    const result = await pool.query(query, params);

    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      'Slot requests list viewed',
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
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

const updateRequest = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { vehicle_id } = req.body;
  try {
    // Sanitize vehicle_id: ensure it's a positive integer
    const sanitizedVehicleId = parseInt(vehicle_id);
    if (isNaN(sanitizedVehicleId) || sanitizedVehicleId <= 0) {
      return res.status(400).json({ error: 'Invalid vehicle ID' });
    }

    const vehicleResult = await pool.query('SELECT * FROM vehicles WHERE id = $1 AND user_id = $2', [
      sanitizedVehicleId,
      userId,
    ]);
    if (vehicleResult.rowCount === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const result = await pool.query(
      'UPDATE slot_requests SET vehicle_id = $1 WHERE id = $2 AND user_id = $3 AND request_status = $4 RETURNING *',
      [sanitizedVehicleId, id, userId, 'pending']
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Request not found or not editable' });
    }
    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      `Slot request ${id} updated`,
    ]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update request error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

const deleteRequest = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM slot_requests WHERE id = $1 AND user_id = $2 AND request_status = $3 RETURNING *',
      [id, userId, 'pending']
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Request not found or not deletable' });
    }
    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      `Slot request ${id} deleted`,
    ]);
    res.json({ message: 'Request deleted' });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

const approveRequest = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const requestResult = await pool.query(
      'SELECT sr.*, v.vehicle_type, v.size, v.plate_number, u.email ' +
      'FROM slot_requests sr ' +
      'JOIN vehicles v ON sr.vehicle_id = v.id ' +
      'JOIN users u ON sr.user_id = u.id ' +
      'WHERE sr.id = $1 AND sr.request_status = $2',
      [id, 'pending']
    );

    if (requestResult.rowCount === 0) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }

    const { vehicle_type, size, plate_number, user_id, email } = requestResult.rows[0];

    const slotResult = await pool.query(
      'SELECT * FROM parking_slots WHERE vehicle_type = $1 AND size = $2 AND status = $3 LIMIT 1',
      [vehicle_type, size, 'available']
    );

    if (slotResult.rowCount === 0) {
      return res.status(400).json({ error: 'No compatible slots available' });
    }

    const slot = slotResult.rows[0];

    await pool.query('BEGIN');

    await pool.query(
      'UPDATE slot_requests ' +
      'SET request_status = $1, slot_id = $2, slot_number = $3, approved_at = CURRENT_TIMESTAMP ' +
      'WHERE id = $4',
      ['approved', slot.id, slot.slot_number, id]
    );

    await pool.query(
      'UPDATE parking_slots SET status = $1 WHERE id = $2',
      ['unavailable', slot.id]
    );

    await pool.query('COMMIT');

    let emailStatus = 'sent';
    try {
      console.log('Attempting to send approval email to:', email);
      await sendApprovalEmail(email, slot.slot_number, { plate_number }, slot.location);
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      emailStatus = 'failed';
    }

    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      `Slot request ${id} approved, assigned slot ${slot.slot_number}, email ${emailStatus}`,
    ]);

    res.json({ message: 'Request approved', slot, emailStatus });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Approve request error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

const rejectRequest = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { reason } = req.body;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // Sanitize reason: trim whitespace and ensure it's not empty
  const sanitizedReason = reason?.trim();
  if (!sanitizedReason) {
    return res.status(400).json({ error: 'Rejection reason is required' });
  }

  try {
    const requestResult = await pool.query(
      'SELECT sr.*, v.plate_number, v.vehicle_type, v.size, u.email ' +
      'FROM slot_requests sr ' +
      'JOIN vehicles v ON sr.vehicle_id = v.id ' +
      'JOIN users u ON sr.user_id = u.id ' +
      'WHERE sr.id = $1 AND sr.request_status = $2',
      [id, 'pending']
    );

    if (requestResult.rowCount === 0) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }

    const { plate_number, vehicle_type, size, email } = requestResult.rows[0];

    const slotResult = await pool.query(
      'SELECT location FROM parking_slots WHERE vehicle_type = $1 AND size = $2 LIMIT 1',
      [vehicle_type, size]
    );

    const slotLocation = slotResult.rowCount > 0 ? slotResult.rows[0].location : 'unknown';

    const result = await pool.query(
      'UPDATE slot_requests SET request_status = $1, rejection_reason = $2 WHERE id = $3 AND request_status = $4 RETURNING *',
      ['rejected', sanitizedReason, id, 'pending']
    );

    let emailStatus = 'sent';
    try {
      console.log('Attempting to send rejection email to:', email);
      await sendRejectionEmail(email, { plate_number }, slotLocation, sanitizedReason);
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      emailStatus = 'failed';
    }

    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      `Slot request ${id} rejected with reason: ${sanitizedReason}, email ${emailStatus}`,
    ]);

    res.json({ message: 'Request rejected', request: result.rows[0], emailStatus });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

module.exports = { createRequest, getRequests, updateRequest, deleteRequest, approveRequest, rejectRequest };