const {rateLimit } = require('express-rate-limit')

// Rate Limit
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, 
  standardHeaders: true,
  legacyHeaders: false,
});


module.exports = { chatLimiter };