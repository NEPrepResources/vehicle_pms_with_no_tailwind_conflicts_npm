const bcrypt = require('bcrypt');

async function generatePassword() {
  const password = 'adminYezu123';
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log('Hashed Password:', hashedPassword);
}

generatePassword();

// INSERT INTO users (name, email, password, role)
// VALUES (
//   'Admin User',
//   'admin@park.com',
//   '$2b$10$wKpnPGCaNT.PV0ytMenvOOnKMh60DYh31nDv3EyECvWb3WbR.7fTW',
//   'admin'
// );
// update users where id=1 set is_verified=t;