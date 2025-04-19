const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../config').jwt;

const generateJWT = (payload, expiresIn) => {
    return jwt.sign(payload, config.secret, {
        algorithm: 'HS256',
        expiresIn,
    });
};

const generateAccessToken = (payload) => {
    return generateJWT(payload, 4 * 60 * 60);
};

const generateRefreshToken = (payload) => {
    return generateJWT(payload, 30 * 24 * 60 * 60);
};

const verifyJWT = (token, cb) => {
    jwt.verify(token, config.secret, (error, decoded) => {
        if (error) {
            cb(error);
        } else {
            cb(null, decoded);
        }
    });
};

const generateSecurePathHash = (expires, deviceId, secret) => {
    if (!expires || !deviceId || !secret) {
        throw new Error('Must provide all token components');
    }

    const input = expires + ' ' + deviceId + ' ' + secret;
    const binaryHash = crypto.createHash('md5').update(input).digest();
    const base64Value = Buffer.from(binaryHash).toString('base64');
    return base64Value.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    generateSecurePathHash,
    verifyJWT,
};
