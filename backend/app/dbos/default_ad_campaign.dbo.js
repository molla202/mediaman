const DefaultAdCampaign = require('../models/default_ad_campaign.model');

const populatePaths = [{
    path: 'asset',
    select: {
        video: 1,
        file: 1,
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
    const doc = new DefaultAdCampaign(_doc);
    doc.save((error) => {
        if (error) {
            cb(error);
        } else if (populate) {
            DefaultAdCampaign.populate(doc, populatePaths, cb);
        } else {
            cb(null, doc);
        }
    });
};

const findOne = (conditions, projections, options, populate, cb) => {
    let doc = DefaultAdCampaign.findOne(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const find = (conditions, projections, options, populate, cb) => {
    let doc = DefaultAdCampaign.find(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndUpdate = (conditions, update, options, populate, cb) => {
    let doc = DefaultAdCampaign.findOneAndUpdate(conditions, update, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndDelete = (conditions, options, populate, cb) => {
    let doc = DefaultAdCampaign.findOneAndDelete(conditions, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const aggregate = (pipeline, cb) => {
    DefaultAdCampaign.aggregate(pipeline).exec(cb);
};

const deleteMany = (conditions, options, cb) => {
    DefaultAdCampaign.deleteMany(conditions, options, cb);
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
