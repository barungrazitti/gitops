// Enhanced user authentication module
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class AuthService {
  constructor() {
    this.saltRounds = 10;
  }

  async hashPassword(password) {
    return await bcrypt.hash(password, this.saltRounds);
  }

  async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '24h' });
  }

  verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }
}

module.exports = AuthService;
