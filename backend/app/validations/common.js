const logger = require('../../logger');

const patterns = {
    objectId: /^([0-9a-fA-F]){24}$/,
};

const validate = (schema, req, res, cb) => {
    let body = Object.assign({}, req.params, req.query);
    if (req.method === 'POST' || req.method === 'PUT') {
        body = Object.assign(body, req.body);
    }

    const { error } = schema.validate(body);
    if (error) {
        logger.error(error);
        res.status(422).send({
            success: false,
            error,
        });
    } else {
        cb();
    }
};

module.exports = {
    validate,
    patterns,
};
