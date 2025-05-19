const bcrypt = require('bcrypt');

async function generatePassword() {
  const password = 'adminYezu123';
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log('Hashed Password:', hashedPassword);
}

generatePassword();

// INSERT INTO users (name, email, password, role, is_verified)
// VALUES (
//   'Admin User',
//   'admin@park.com',
//   '$2b$10$/3u/I9isNfiVxXsML/mgD./cQFClYjpBo.gHOzAuGQm.ls472JM3C',
//   'admin',
//    t
// );
// update users where id=1 set is_verified=t;