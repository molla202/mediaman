const SlotTemplate = require('../models/slot_template.model');

const populatePaths = [{
    path: 'categories',
    select: {
        name: 1,
    },
}, {
    path: 'genres',
    select: {
        name: 1,
    },
}, {
    path: 'added_by',
    select: {
        bc_account_address: 1,
        profile_image: 1,
    },
}];

const save = (_doc, populate, cb) => {
    const doc = new SlotTemplate(_doc);
    doc.save((error) => {
        if (error) {
            cb(error);
        } else if (populate) {
            SlotTemplate.populate(doc, populatePaths, cb);
        } else {
            cb(null, doc);
        }
    });
};

const findOne = (conditions, projections, options, populate, cb) => {
    let doc = SlotTemplate.findOne(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const find = (conditions, projections, options, populate, cb) => {
    let doc = SlotTemplate.find(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndUpdate = (conditions, update, options, populate, cb) => {
    let doc = SlotTemplate.findOneAndUpdate(conditions, update, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndDelete = (conditions, options, populate, cb) => {
    let doc = SlotTemplate.findOneAndDelete(conditions, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const aggregate = (pipeline, cb) => {
    SlotTemplate.aggregate(pipeline).exec(cb);
};

const deleteMany = (conditions, options, cb) => {
    SlotTemplate.deleteMany(conditions, options, cb);
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
