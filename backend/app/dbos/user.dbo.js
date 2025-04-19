const User = require('../models/user.model');

const populatePaths = [{
    path: 'media_space',
    select: {
        __v: 0,
    },
}];

const save = (_doc, populate, cb) => {
    const doc = new User(_doc);
    doc.save((error) => {
        if (error) {
            cb(error);
        } else if (populate) {
            User.populate(doc, populatePaths, cb);
        } else {
            cb(null, doc);
        }
    });
};

const findOne = (conditions, projections, options, populate, cb) => {
    let doc = User.findOne(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const find = (conditions, projections, options, populate, cb) => {
    let doc = User.find(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndUpdate = (conditions, update, options, populate, cb) => {
    let doc = User.findOneAndUpdate(conditions, update, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndDelete = (conditions, options, populate, cb) => {
    let doc = User.findOneAndDelete(conditions, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const deleteMany = (conditions, options, cb) => {
    User.deleteMany(conditions, options, cb);
};

module.exports = {
    save,
    findOne,
    find,
    findOneAndUpdate,
    findOneAndDelete,
    deleteMany,
};
