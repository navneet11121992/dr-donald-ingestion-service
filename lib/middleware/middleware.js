const env =  require("../config/env");
const {ApiError} = require('../utils/apiErrors');


function requireSecret(req, res, next) {
    const WEBHOOK_SECRET = env.INGEST_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
        console.warn('[server] WARNING: INGEST_WEBHOOK_SECRET is not set — endpoint is unprotected!');
        return next();
    }

    const provided = req.get('X-Ingest-Secret');
    console.log(`[server] Provided secret: ${provided}, Expected secret: ${WEBHOOK_SECRET}`);
    if (provided !== WEBHOOK_SECRET) {
        // return res.status(401).json({ error: 'Unauthorized' });
        throw new ApiError(401,"error: Unauthorized");
    }
    next();
}

// Wraps an async route so any thrown/rejected error reaches errorHandler
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};


module.exports = {requireSecret , asyncHandler};