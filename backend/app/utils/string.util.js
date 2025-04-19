const crypto = require('crypto');

const randomString = (length) => {
    const possible = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    let str = '';
    for (let i = 0; i < length; ++i) {
        str += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return str;
};

const generateOTP = (length) => {
    return Math.floor(Math.pow(10, length - 1) + Math.random() * (9 * Math.pow(10, length - 1))).toString();
};

const getSHA512OfObject = (data) => {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
};

module.exports = {
    randomString,
    generateOTP,
    getSHA512OfObject,
};
