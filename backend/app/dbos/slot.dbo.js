const Slot = require('../models/slot.model');

const populatePaths = [{
    path: 'live_stream',
    select: {
        name: 1,
        youtube_id: 1,
        slot_configuration: 1,
        media_space: 1,
        configuration: 1,
    },
}, {
    path: 'overlays.asset',
    select: {
        file: 1,
        video: 1,
    },
}, {
    path: 'media_space',
    select: {
        name: 1,
        username: 1,
        admin: 1,
        lease: 1,
    },
}];

const save = (_doc, populate, cb) => {
    const doc = new Slot(_doc);
    doc.save((error) => {
        if (error) {
            cb(error);
        } else if (populate) {
            Slot.populate(doc, populatePaths, cb);
        } else {
            cb(null, doc);
        }
    });
};

const findOne = (conditions, projections, options, populate, cb) => {
    let doc = Slot.findOne(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const find = (conditions, projections, options, populate, cb) => {
    let doc = Slot.find(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndUpdate = (conditions, update, options, populate, cb) => {
    let doc = Slot.findOneAndUpdate(conditions, update, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndDelete = (conditions, options, populate, cb) => {
    let doc = Slot.findOneAndDelete(conditions, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const aggregate = (pipeline, cb) => {
    Slot.aggregate(pipeline).exec(cb);
};

const deleteMany = (conditions, options, cb) => {
    Slot.deleteMany(conditions, options, cb);
};

module.exports = {
    save,
    findOne,
    find,
    findOneAndUpdate,
    findOneAndDelete,
    aggregate,
    deleteMany,
};
