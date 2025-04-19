const { ObjectId } = require('mongoose').Types;

const stringToObjectId = (s) => {
    return ObjectId(s);
};

const stringToObjectIds = (s) => {
    return s.split(',').map(v => stringToObjectId(v));
};

module.exports = {
    stringToObjectId,
    stringToObjectIds,
};
