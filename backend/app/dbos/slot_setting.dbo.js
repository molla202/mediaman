const SlotSetting = require('../models/slot_setting.model');

const populatePaths = [{
    path: 'live_stream',
    select: {
        name: 1,
        youtube_id: 1,
    },
}, {
    path: 'slot',
    select: {
        name: 1,
        start_at: 1,
        end_at: 1,
    },
}, {
    path: 'ad_config.default_ad_campaigns',
}, {
    path: 'content_config.categories',
}];

const save = (_doc, populate, cb) => {
    const doc = new SlotSetting(_doc);
    doc.save((error) => {
        if (error) {
            cb(error);
        } else if (populate) {
            SlotSetting.populate(doc, populatePaths, cb);
        } else {
            cb(null, doc);
        }
    });
};

const findOne = (conditions, projections, options, populate, cb) => {
    let doc = SlotSetting.findOne(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const find = (conditions, projections, options, populate, cb) => {
    let doc = SlotSetting.find(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndUpdate = (conditions, update, options, populate, cb) => {
    let doc = SlotSetting.findOneAndUpdate(conditions, update, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndDelete = (conditions, options, populate, cb) => {
    let doc = SlotSetting.findOneAndDelete(conditions, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const aggregate = (pipeline, cb) => {
    SlotSetting.aggregate(pipeline).exec(cb);
};

const deleteMany = (conditions, options, cb) => {
    SlotSetting.deleteMany(conditions, options, cb);
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
