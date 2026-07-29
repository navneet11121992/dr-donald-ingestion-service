class ApiError extends Error {
    constructor(statusCode,message, options = {}){
        super(message, options);
        if (!Number.isInteger(statusCode)) {
            throw new TypeError(
                `ApiError: statusCode should be integer, received: ${JSON.stringify(statusCode)}`,
            );
        }
        this.statusCode = statusCode;
        this.name = "ApiError";
        Error.captureStackTrace?.(this, ApiError);
    }
}

module.exports= {ApiError};