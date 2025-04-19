const async = require('async');
const programDBO = require('../dbos/program.dbo');
const programError = require('../errors/program.error');
const logger = require('../../logger');

const validateAndUpdateProgram = (program, _startAt, _endAt, session, cb) => {
    async.waterfall([
        (next) => {
            if (program['start_at'] < program['end_at'] &&
                (program['start_at'] >= _startAt && program['start_at'] <= _endAt) &&
                (program['end_at'] >= _startAt)) {
                next(null);
            } else {
                next({
                    status: 400,
                    error: programError.invalidTimePeriod,
                    message: 'Invalid time period.',
                });
            }
        }, (next) => {
            programDBO.findOne({
                live_stream: program['live_stream'],
                slot: program.slot,
                $or: [{
                    $and: [{
                        start_at: {
                            $lte: program['start_at'],
                        },
                    }, {
                        end_at: {
                            $gt: program['start_at'],
                        },
                    }],
                }, {
                    $and: [{
                        start_at: {
                            $lt: program['end_at'],
                        },
                    }, {
                        end_at: {
                            $gte: program['end_at'],
                        },
                    }],
                }, {
                    $and: [{
                        start_at: {
                            $gt: program['start_at'],
                        },
                    }, {
                        end_at: {
                            $lt: program['end_at'],
                        },
                    }],
                }],
            }, {
                _id: 1,
            }, {
                session,
            }, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.findProgramFailed,
                        message: 'Error occurred while finding the program.',
                    });
                } else if (result) {
                    next({
                        status: 400,
                        error: programError.duplicateTimeSlot,
                        message: 'Duplicate time slot.',
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            programDBO.insertMany([program], {
                session,
            }, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.saveProgramFailed,
                        message: 'Error occurred while saving the program.',
                    });
                } else {
                    next(null);
                }
            });
        }], cb);
};

const validateAndUpdatePrograms = (docs, _startAt, _endAt, session, cb) => {
    async.eachSeries(docs, (doc, next) => {
        validateAndUpdateProgram(doc, _startAt, _endAt, session, next);
    }, cb);
};

const deleteProgramsOfMediaSpace = (mediaSpace, cb) => {
    async.waterfall([
        (next) => {
            programDBO.deleteMany({
                media_space: mediaSpace._id,
            }, {}, (error) => {
                if (error) {
                    next({
                        error: programError.deleteProgramsFailed,
                        message: 'Error occurred while deleting the programs.',
                    });
                } else {
                    next(null);
                }
            });
        },
    ], cb);
};

module.exports = {
    validateAndUpdatePrograms,
    deleteProgramsOfMediaSpace,
};
