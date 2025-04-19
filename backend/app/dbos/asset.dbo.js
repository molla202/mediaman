const Asset = require('../models/asset.model');

const populatePaths = [{
    path: 'language',
    select: {
        name: 1,
    },
}, {
    path: 'category',
    select: {
        name: 1,
    },
}, {
    path: 'genre',
    select: {
        name: 1,
    },
}, {
    path: 'file.runner',
    select: {
        public_address: 1,
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
    const doc = new Asset(_doc);
    doc.save((error) => {
        if (error) {
            cb(error);
        } else if (populate) {
            Asset.populate(doc, populatePaths, cb);
        } else {
            cb(null, doc);
        }
    });
};

const findOne = (conditions, projections, options, populate, cb) => {
    let doc = Asset.findOne(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const find = (conditions, projections, options, populate, cb) => {
    let doc = Asset.find(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }
    doc.exec({}, cb);
};

const findOneAndUpdate = (conditions, update, options, populate, cb) => {
    let doc = Asset.findOneAndUpdate(conditions, update, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndDelete = (conditions, options, populate, cb) => {
    let doc = Asset.findOneAndDelete(conditions, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const aggregate = (pipeline, cb) => {
    Asset.aggregate(pipeline).exec(cb);
};

const insertMany = (docs, cb) => {
    Asset.insertMany(docs, cb);
};

const count = (options, cb) => {
    Asset.countDocuments(options, cb);
};

const deleteMany = (conditions, options, cb) => {
    Asset.deleteMany(conditions, options, cb);
};

module.exports = {
    save,
    findOne,
    find,
    findOneAndUpdate,
    findOneAndDelete,
    aggregate,
    insertMany,
    count,
    deleteMany,
};
