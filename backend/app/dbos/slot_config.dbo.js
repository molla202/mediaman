const SlotConfig = require('../models/slot_config.model');

const populatePaths = [{
    path: 'live_stream',
    select: {
        name: 1,
        youtube_id: 1,
    },
}, {
    path: 'ad_config.default_ad_campaigns',
    select: {
        asset: 1,
        type: 1,
        frequency_per_slot: 1,
    },
    populate: [{
        path: 'asset',
        select: {
            file: 1,
            video: 1,
        },
    }],
}, {
    path: 'content_config.categories',
}];

const save = (_doc, populate, cb) => {
    const doc = new SlotConfig(_doc);
    doc.save((error) => {
        if (error) {
            cb(error);
        } else if (populate) {
            SlotConfig.populate(doc, populatePaths, cb);
        } else {
            cb(null, doc);
        }
    });
};

const findOne = (conditions, projections, options, populate, cb) => {
    let doc = SlotConfig.findOne(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const find = (conditions, projections, options, populate, cb) => {
    let doc = SlotConfig.find(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndUpdate = (conditions, update, options, populate, cb) => {
    let doc = SlotConfig.findOneAndUpdate(conditions, update, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndDelete = (conditions, options, populate, cb) => {
    let doc = SlotConfig.findOneAndDelete(conditions, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const aggregate = (pipeline, cb) => {
    SlotConfig.aggregate(pipeline).exec(cb);
};

const deleteMany = (conditions, options, cb) => {
    SlotConfig.deleteMany(conditions, options, cb);
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
