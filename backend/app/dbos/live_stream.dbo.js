const LiveStream = require('../models/live_stream.model');

const populatePaths = [{
    path: 'created_by',
    model: 'user',
    select: {
        username: 1,
        is_admin: 1,
    },
}, {
    path: 'media_space',
    model: 'media_space',
    select: {
        username: 1,
        id: 1,
        broadcast_enabled: 1,
    },
}];

const save = (_doc, populate, cb) => {
    const doc = new LiveStream(_doc);
    doc.save((error) => {
        if (error) {
            cb(error);
        } else if (populate) {
            LiveStream.populate(doc, populatePaths, cb);
        } else {
            cb(null, doc);
        }
    });
};

const findOne = (conditions, projections, options, populate, cb) => {
    let doc = LiveStream.findOne(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const find = (conditions, projections, options, populate, cb) => {
    let doc = LiveStream.find(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndUpdate = (conditions, update, options, populate, cb) => {
    let doc = LiveStream.findOneAndUpdate(conditions, update, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndDelete = (conditions, options, populate, cb) => {
    let doc = LiveStream.findOneAndDelete(conditions, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const updateMany = (conditions, update, options, populate, cb) => {
    let doc = LiveStream.updateMany(conditions, update, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const deleteMany = (conditions, options, populate, cb) => {
    let doc = LiveStream.deleteMany(conditions, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const count = (options, cb) => {
    LiveStream.countDocuments(options, cb);
};

const aggregate = (pipeline, cb) => {
    LiveStream.aggregate(pipeline).exec(cb);
};

module.exports = {
    save,
    findOne,
    find,
    findOneAndUpdate,
    findOneAndDelete,
    updateMany,
    count,
    aggregate,
    deleteMany,
};
