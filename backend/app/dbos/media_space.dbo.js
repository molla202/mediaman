const MediaSpace = require('../models/media_space.model');

const populatePaths = [{
    path: 'admin',
    select: {
        is_admin: 1,
        username: 1,
        root_path: 1,
        bc_account_address: 1,
        profile_image: 1,
    },
}];

const save = (_doc, populate, cb) => {
    const doc = new MediaSpace(_doc);
    doc.save((error) => {
        if (error) {
            cb(error);
        } else if (populate) {
            MediaSpace.populate(doc, populatePaths, cb);
        } else {
            cb(null, doc);
        }
    });
};

const findOne = (conditions, projections, options, populate, cb) => {
    let doc = MediaSpace.findOne(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const find = (conditions, projections, options, populate, cb) => {
    let doc = MediaSpace.find(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndUpdate = (conditions, update, options, populate, cb) => {
    let doc = MediaSpace.findOneAndUpdate(conditions, update, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndDelete = (conditions, options, populate, cb) => {
    let doc = MediaSpace.findOneAndDelete(conditions, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const aggregate = (pipeline, cb) => {
    MediaSpace.aggregate(pipeline).exec(cb);
};

const count = (conditions, cb) => {
    MediaSpace.countDocuments(conditions).exec(cb);
};

module.exports = {
    save,
    findOne,
    find,
    findOneAndUpdate,
    findOneAndDelete,
    aggregate,
    count,
};
