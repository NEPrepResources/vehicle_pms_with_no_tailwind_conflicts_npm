const nodemailer = require('nodemailer');
require('dotenv').config({ path: '../../.env' });

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASS,
  },
  logger: true,
  debug: true,
});


const sendRejectionEmail = async (to, vehicle, slotLocation, reason) => {
  if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASS) {
    throw new Error('Nodemailer credentials not configured in .env');
  }

  console.log('Sending rejection email to:', to);
  console.log('Using credentials:', process.env.NODEMAILER_EMAIL);
  console.log('Vehicle plate:', vehicle.plate_number);
  console.log('Slot location:', slotLocation);
  console.log('Rejection reason:', reason);

  const mailOptions = {
    from: `"Vehicle Parking System" <${process.env.NODEMAILER_EMAIL}>`,
    to,
    subject: 'Parking Slot Request Rejected',
    text: `Your parking slot request for vehicle ${vehicle.plate_number} has been rejected. The slot considered was located in the: ${slotLocation} of the parking. Reason: ${reason}.`,
    html: `<p>Your parking slot request for vehicle <strong>${vehicle.plate_number}</strong> has been rejected.</p><p>The slot considered was located in the: <strong>${slotLocation}</strong> of the parking.</p><p>Reason: <strong>${reason}</strong>.</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Rejection email sent:', info.response);
    return info;
  } catch (error) {
    console.error('Error sending rejection email:', error);
    throw error;
  }
};

const sendOtpEmail = async (to, otpCode) => {
  if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASS) {
    throw new Error('Nodemailer credentials not configured in .env');
  }

  console.log('Sending OTP email to:', to);
  console.log('Using credentials:', process.env.NODEMAILER_EMAIL);
  console.log('OTP code:', otpCode);

  const mailOptions = {
    from: `"Vehicle Parking System" <${process.env.NODEMAILER_EMAIL}>`,
    to,
    subject: 'Your OTP for Account Verification',
    text: `Your OTP code for account verification is ${otpCode}. It is valid for 5 minutes.`,
    html: `<p>Your OTP code for account verification is <strong>${otpCode}</strong>.</p><p>It is valid for 5 minutes.</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('OTP email sent:', info.response);
    return info;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw error;
  }
};

const sendResetPasswordEmail = async (to, resetLink) => {
  if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASS) {
    throw new Error('Nodemailer credentials not configured in .env');
  }

  console.log('Sending password reset email to:', to);
  console.log('Using credentials:', process.env.NODEMAILER_EMAIL);
  console.log('Reset link:', resetLink);

  const mailOptions = {
    from: `"Vehicle Parking System" <${process.env.NODEMAILER_EMAIL}>`,
    to,
    subject: 'Password Reset Request',
    text: `You requested to reset your password. Click this link to reset your password: ${resetLink}\nThis link will expire in 15 minutes.`,
    html: `
      <p>You requested to reset your password.</p>
      <p>Click <a href="${resetLink}">this link</a> to reset your password.</p>
      <p>This link will expire in 15 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.response);
    return info;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

const sendPasswordChangedEmail = async (to) => {
  if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASS) {
    throw new Error('Nodemailer credentials not configured in .env');
  }

  console.log('Sending password changed notification to:', to);
  console.log('Using credentials:', process.env.NODEMAILER_EMAIL);

  const mailOptions = {
    from: `"Vehicle Parking System" <${process.env.NODEMAILER_EMAIL}>`,
    to,
    subject: 'Your Password Has Been Changed',
    text: `Your password has been successfully changed. If you didn't make this change, please contact our support team immediately.`,
    html: `
      <p>Your password has been successfully changed.</p>
      <p>If you didn't make this change, please contact our support team immediately.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password changed notification sent:', info.response);
    return info;
  } catch (error) {
    console.error('Error sending password changed notification:', error);
    throw error;
  }
};
const sendBookingConfirmationEmail = async (to, slotNumber, vehicle, slotLocation, bookingDetails) => {
  if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASS) {
    throw new Error('Nodemailer credentials not configured in .env');
  }

  console.log('Sending booking confirmation email to:', to);
  console.log('Booking details:', bookingDetails);

  const mailOptions = {
    from: `"Vehicle Parking System" <${process.env.NODEMAILER_EMAIL}>`,
    to,
    subject: 'Parking Slot Booking Confirmation',
    text: `Your parking slot has been booked successfully.\n\nDetails:\nVehicle: ${vehicle.plate_number}\nSlot: ${slotNumber}\nLocation: ${slotLocation}\nStart Time: ${bookingDetails.startTime}\nEnd Time: ${bookingDetails.endTime}\nDuration: ${bookingDetails.durationHours} hours\nAmount: ${bookingDetails.amount} RWF\n\nPlease make payment to confirm your booking.`,
    html: `
      <h2>Your parking slot has been booked successfully</h2>
      <p><strong>Vehicle:</strong> ${vehicle.plate_number}</p>
      <p><strong>Slot:</strong> ${slotNumber}</p>
      <p><strong>Location:</strong> ${slotLocation}</p>
      <p><strong>Start Time:</strong> ${bookingDetails.startTime}</p>
      <p><strong>End Time:</strong> ${bookingDetails.endTime}</p>
      <p><strong>Duration:</strong> ${bookingDetails.durationHours} hours</p>
      <p><strong>Amount:</strong> ${bookingDetails.amount} RWF</p>
      <p>Please make payment to confirm your booking.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Booking confirmation email sent:', info.response);
    return info;
  } catch (error) {
    console.error('Error sending booking confirmation email:', error);
    throw error;
  }
};

const sendPaymentConfirmationEmail = async (to, slotNumber, vehicle, bookingDetails) => {
  if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASS) {
    throw new Error('Nodemailer credentials not configured in .env');
  }

  console.log('Sending payment confirmation email to:', to);

  const mailOptions = {
    from: `"Vehicle Parking System" <${process.env.NODEMAILER_EMAIL}>`,
    to,
    subject: 'Parking Payment Confirmation',
    text: `Your payment for parking slot has been confirmed.\n\nDetails:\nVehicle: ${vehicle.plate_number}\nSlot: ${slotNumber}\nStart Time: ${bookingDetails.startTime}\nEnd Time: ${bookingDetails.endTime}\nAmount Paid: ${bookingDetails.amount} RWF\n\nThank you for using our service.`,
    html: `
      <h2>Your payment for parking slot has been confirmed</h2>
      <p><strong>Vehicle:</strong> ${vehicle.plate_number}</p>
      <p><strong>Slot:</strong> ${slotNumber}</p>
      <p><strong>Start Time:</strong> ${bookingDetails.startTime}</p>
      <p><strong>End Time:</strong> ${bookingDetails.endTime}</p>
      <p><strong>Amount Paid:</strong> ${bookingDetails.amount} RWF</p>
      <p>Thank you for using our service.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Payment confirmation email sent:', info.response);
    return info;
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
    throw error;
  }
};

module.exports = { 
  sendRejectionEmail, 
  sendOtpEmail,
  sendResetPasswordEmail,
  sendPasswordChangedEmail,
  sendBookingConfirmationEmail,
  sendPaymentConfirmationEmail
};