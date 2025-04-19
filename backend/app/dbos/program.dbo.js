const Program = require('../models/program.model');

const populatePaths = [{
    path: 'asset._',
    select: {
        custom_id: 1,
        name: 1,
        category: 1,
        genre: 1,
        file: 1,
        video: 1,
        tags: 1,
        thumbnail: 1,
    },
    populate: [{
        path: 'category',
        select: {
            name: 1,
        },
    }, {
        path: 'genre',
        select: {
            name: 1,
        },
    }],
}, {
    path: 'slot',
    select: {
        name: 1,
        start_at: 1,
        end_at: 1,
    },
}, {
    path: 'added_by',
    select: {
        bc_account_address: 1,
        profile_image: 1,
    },
}];

const save = (_doc, populate, cb) => {
    const doc = new Program(_doc);
    doc.save((error) => {
        if (error) {
            cb(error);
        } else if (populate) {
            Program.populate(doc, populatePaths, cb);
        } else {
            cb(null, doc);
        }
    });
};

const findOne = (conditions, projections, options, populate, cb) => {
    let doc = Program.findOne(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const find = (conditions, projections, options, populate, cb) => {
    let doc = Program.find(conditions, projections, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndUpdate = (conditions, update, options, populate, cb) => {
    let doc = Program.findOneAndUpdate(conditions, update, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const findOneAndDelete = (conditions, options, populate, cb) => {
    let doc = Program.findOneAndDelete(conditions, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const insertMany = (_doc, options, populate, cb) => {
    Program.insertMany(_doc, options, (error, result) => {
        if (error) {
            cb(error);
        } else {
            if (populate) {
                Program.populate(result, populatePaths, cb);
            } else {
                cb(null, result);
            }
        }
    });
};

const updateMany = (conditions, update, options, populate, cb) => {
    let doc = Program.updateMany(conditions, update, options).lean();
    if (populate) {
        doc = doc.populate(populatePaths);
    }

    doc.exec({}, cb);
};

const deleteMany = (conditions, options, cb) => {
    Program.deleteMany(conditions, options, cb);
};

const aggregate = (pipeline, cb) => {
    Program.aggregate(pipeline).exec(cb);
};

module.exports = {
    save,
    findOne,
    find,
    findOneAndUpdate,
    findOneAndDelete,
    updateMany,
    deleteMany,
    aggregate,
    insertMany,
};
