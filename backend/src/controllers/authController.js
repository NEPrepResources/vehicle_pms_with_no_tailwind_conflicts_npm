const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendOtpEmail } = require('../utils/email');

const register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rowCount > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const adminResult = await pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['admin']);
    if (adminResult.rows[0].count > 0) {
      console.log('Admin already exists, only user role allowed');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); 
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    const result = await pool.query(
      'INSERT INTO users (name, email, password, role, is_verified) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, email, hashedPassword, 'user', false]
    );

    const user = result.rows[0];

    await pool.query(
      'INSERT INTO otps (user_id, otp_code, expires_at) VALUES ($1, $2, $3)',
      [user.id, otpCode, expiresAt]
    );

    try {
      await sendOtpEmail(email, otpCode);
      console.log('OTP email sent to:', email);
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      return res.status(500).json({ error: 'Failed to send OTP email' });
    }

    res.status(201).json({ message: 'User registered, OTP sent to email', userId: user.id });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

const verifyOtp = async (req, res) => {
  const { userId, otpCode } = req.body;

  if (!userId || !otpCode) {
    return res.status(400).json({ error: 'User ID and OTP code are required' });
  }

  try {
    const otpResult = await pool.query(
      'SELECT * FROM otps WHERE user_id = $1 AND otp_code = $2 AND expires_at > NOW() AND is_verified = FALSE',
      [userId, otpCode]
    );

    if (otpResult.rowCount === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    await pool.query('UPDATE otps SET is_verified = TRUE WHERE user_id = $1 AND otp_code = $2', [
      userId,
      otpCode,
    ]);

    await pool.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [userId]);

    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      'User verified OTP',
    ]);

    res.json({ message: 'OTP verified, user registration completed' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

const resendOtp = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1 AND is_verified = FALSE', [
      userId,
    ]);

    if (userResult.rowCount === 0) {
      return res.status(400).json({ error: 'User not found or already verified' });
    }

    const user = userResult.rows[0];
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await pool.query('DELETE FROM otps WHERE user_id = $1', [userId]);

    await pool.query(
      'INSERT INTO otps (user_id, otp_code, expires_at) VALUES ($1, $2, $3)',
      [userId, otpCode, expiresAt]
    );

    try {
      await sendOtpEmail(user.email, otpCode);
      console.log('Resent OTP email to:', user.email);
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      return res.status(500).json({ error: 'Failed to resend OTP email' });
    }

    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      userId,
      'OTP resent',
    ]);

    res.json({ message: 'OTP resent to email' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_verified) {
      return res.status(403).json({ error: 'Account not verified. Please verify OTP.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    await pool.query('INSERT INTO logs (user_id, action) VALUES ($1, $2)', [
      user.id,
      'User logged in',
    ]);

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

module.exports = { register, login, verifyOtp, resendOtp };