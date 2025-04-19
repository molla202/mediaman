const AdCampaign = require('../models/ad_compaign.model');

const populatePaths = [{
    path: 'asset',
    select: {
        video: 1,
        file: 1,
    },
}, {
    path: 'slot',
    select: {
        name: 1,
    },
}, {
    path: 'live_stream',
    select: {
        name: 1,
    },
}, {
    path: 'added_by',
    select: {
        bc_account_address: 1,
    },
}];

const save = (_doc, populate, cb) => {
    const doc = new AdCampaign(_doc);
    doc.save((error) => {
        if (error) {
            cb(error);
        } else if (populate) {
            AdCampaign.populate(doc, populatePaths, cb);
        } else {
            cb(null, doc);
        }
    });
};

const findOne = (conditions, projections, options, populate, cb) => {
    let doc = AdCampaign.findOne(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const find = (conditions, projections, options, populate, cb) => {
    let doc = AdCampaign.find(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndUpdate = (conditions, update, options, populate, cb) => {
    let doc = AdCampaign.findOneAndUpdate(conditions, update, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndDelete = (conditions, options, populate, cb) => {
    let doc = AdCampaign.findOneAndDelete(conditions, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const aggregate = (pipeline, cb) => {
    AdCampaign.aggregate(pipeline).exec(cb);
};

const deleteMany = (conditions, options, cb) => {
    AdCampaign.deleteMany(conditions, options, cb);
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
