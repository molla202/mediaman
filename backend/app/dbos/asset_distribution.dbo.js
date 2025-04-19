const AssetDistribution = require('../models/asset_distribution.model');

const populatePaths = [{
    path: 'user',
    select: {
        bc_account_address: 1,
    },
}, {
    path: 'asset',
    select: {
        type: 1,
        name: 1,
        custom_id: 1,
        description: 1,
    },
}];

const save = (_doc, populate, cb) => {
    const doc = new AssetDistribution(_doc);
    doc.save((error) => {
        if (error) {
            cb(error);
        } else if (populate) {
            AssetDistribution.populate(doc, populatePaths, cb);
        } else {
            cb(null, doc);
        }
    });
};

const findOne = (conditions, projections, options, populate, cb) => {
    let doc = AssetDistribution.findOne(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const find = (conditions, projections, options, populate, cb) => {
    let doc = AssetDistribution.find(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndUpdate = (conditions, update, options, populate, cb) => {
    let doc = AssetDistribution.findOneAndUpdate(conditions, update, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndDelete = (conditions, options, populate, cb) => {
    let doc = AssetDistribution.findOneAndDelete(conditions, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const aggregate = (pipeline, cb) => {
    AssetDistribution.aggregate(pipeline).exec(cb);
};

const deleteMany = (conditions, options, cb) => {
    AssetDistribution.deleteMany(conditions, options, cb);
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
