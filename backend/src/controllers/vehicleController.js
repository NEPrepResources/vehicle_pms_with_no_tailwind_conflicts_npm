const pool = require('../config/db');

const createVehicle = async (req, res) => {
  const userId = req.user.id;
  const { plate_number, vehicle_type, size, other_attributes } = req.body;
  try {
    // Sanitize and validate inputs
    const sanitizedPlateNumber = plate_number?.trim().toUpperCase();
    const sanitizedVehicleType = vehicle_type?.trim().toLowerCase();
    const sanitizedSize = size?.trim().toLowerCase();
    const sanitizedOtherAttributes = other_attributes && typeof other_attributes === 'object' ? other_attributes : {};

    const validVehicleTypes = ['car', 'taxi', 'truck', 'any'];
    const validSizes = ['small', 'medium', 'large'];

    if (!sanitizedPlateNumber || !sanitizedVehicleType || !sanitizedSize) {
      return res.status(400).json({ error: 'Plate number, vehicle type, and size are required' });
    }
    if (!validVehicleTypes.includes(sanitizedVehicleType)) {
      return res.status(400).json({ error: `Invalid vehicle type: ${sanitizedVehicleType}. Must be one of ${validVehicleTypes.join(', ')}` });
    }
    if (!validSizes.includes(sanitizedSize)) {
      return res.status(400).json({ error: `Invalid size: ${sanitizedSize}. Must be one of ${validSizes.join(', ')}` });
    }
    if (sanitizedPlateNumber.length > 20) {
      return res.status(400).json({ error: 'Plate number must be 20 characters or less' });
    }

    const result = await pool.query(
      'INSERT INTO vehicles (user_id, plate_number, vehicle_type, size, other_attributes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, sanitizedPlateNumber, sanitizedVehicleType, sanitizedSize, sanitizedOtherAttributes]
    );
    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      `Vehicle ${sanitizedPlateNumber} created`,
    ]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(400).json({ error: 'Plate number already exists or server error' });
  }
};

const getVehicles = async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  const { page = 1, limit = 10, search = '' } = req.query;
  const offset = (page - 1) * limit;
  try {
    // Sanitize search input
    const sanitizedSearch = search.trim().replace(/\s+/g, ' ');
    const searchQuery = `%${sanitizedSearch}%`;
    let query, countQuery, params;

    if (isAdmin) {
      countQuery = `
        SELECT COUNT(*) 
        FROM vehicles 
        WHERE plate_number ILIKE $1 OR vehicle_type ILIKE $1 OR CAST(id AS TEXT) ILIKE $1
      `;
      query = `
        SELECT v.*, 
               (SELECT request_status 
                FROM slot_requests 
                WHERE vehicle_id = v.id AND request_status = 'approved' 
                LIMIT 1) AS approval_status
        FROM vehicles v
        WHERE plate_number ILIKE $1 OR vehicle_type ILIKE $1 OR CAST(id AS TEXT) ILIKE $1
        ORDER BY id
        LIMIT $2 OFFSET $3
      `;
      params = [searchQuery, limit, offset];
    } else {
      countQuery = `
        SELECT COUNT(*) 
        FROM vehicles 
        WHERE user_id = $1 AND (plate_number ILIKE $2 OR vehicle_type ILIKE $2)
      `;
      query = `
        SELECT * 
        FROM vehicles 
        WHERE user_id = $1 AND (plate_number ILIKE $2 OR vehicle_type ILIKE $2)
        ORDER BY id
        LIMIT $3 OFFSET $4
      `;
      params = [userId, searchQuery, limit, offset];
    }

    const countResult = await pool.query(countQuery, isAdmin ? [searchQuery] : [userId, searchQuery]);
    const totalItems = parseInt(countResult.rows[0].count);

    const result = await pool.query(query, params);

    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      'Vehicles list viewed',
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
    console.error('Get vehicles error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getVehicleById = async (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user.role === 'admin';
  const userId = req.user.id;
  try {
    let query = `
      SELECT v.*, 
             (SELECT request_status 
              FROM slot_requests 
              WHERE vehicle_id = v.id AND request_status = 'approved' 
              LIMIT 1) AS approval_status
      FROM vehicles v
      WHERE v.id = $1
    `;
    const params = [id];

    if (!isAdmin) {
      query += ' AND v.user_id = $2';
      params.push(userId);
    }

    const result = await pool.query(query, params);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      `Vehicle ID ${id} viewed`,
    ]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get vehicle by ID error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateVehicle = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { plate_number, vehicle_type, size, other_attributes } = req.body;
  try {
    // Sanitize and validate inputs
    const sanitizedPlateNumber = plate_number?.trim().toUpperCase();
    const sanitizedVehicleType = vehicle_type?.trim().toLowerCase();
    const sanitizedSize = size?.trim().toLowerCase();
    const sanitizedOtherAttributes = other_attributes && typeof other_attributes === 'object' ? other_attributes : {};

    const validVehicleTypes = ['car', 'taxi', 'truck', 'any'];
    const validSizes = ['small', 'medium', 'large'];

    if (!sanitizedPlateNumber || !sanitizedVehicleType || !sanitizedSize) {
      return res.status(400).json({ error: 'Plate number, vehicle type, and size are required' });
    }
    if (!validVehicleTypes.includes(sanitizedVehicleType)) {
      return res.status(400).json({ error: `Invalid vehicle type: ${sanitizedVehicleType}. Must be one of ${validVehicleTypes.join(', ')}` });
    }
    if (!validSizes.includes(sanitizedSize)) {
      return res.status(400).json({ error: `Invalid size: ${sanitizedSize}. Must be one of ${validSizes.join(', ')}` });
    }
    if (sanitizedPlateNumber.length > 20) {
      return res.status(400).json({ error: 'Plate number must be 20 characters or less' });
    }

    const result = await pool.query(
      'UPDATE vehicles SET plate_number = $1, vehicle_type = $2, size = $3, other_attributes = $4 WHERE id = $5 AND user_id = $6 RETURNING *',
      [sanitizedPlateNumber, sanitizedVehicleType, sanitizedSize, sanitizedOtherAttributes, id, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      `Vehicle ${sanitizedPlateNumber} updated`,
    ]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(400).json({ error: 'Plate number already exists or server error' });
  }
};

const deleteVehicle = async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  const { id } = req.params;
  try {
    let query = 'DELETE FROM vehicles WHERE id = $1';
    const params = [id];

    if (!isAdmin) {
      query += ' AND user_id = $2';
      params.push(userId);
    }

    const result = await pool.query(query + ' RETURNING plate_number', params);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      `Vehicle ${result.rows[0].plate_number} deleted`,
    ]);
    res.json({ message: 'Vehicle deleted' });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { createVehicle, getVehicles, getVehicleById, updateVehicle, deleteVehicle };