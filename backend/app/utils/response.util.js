const processJSONResponse = (res, error, result) => {
    if (error && typeof (error.error) !== 'undefined') {
        if (error.error.code === 11000) {
            error.status = 409;
            error.message = error.error.errmsg;
        } else {
            error.status = 500;
        }
        error.error_info = error.error;
        delete (error.error);
    }

    const response = Object.assign({
        success: !error,
    }, error || result);

    const status = response.status;
    delete (response.status);

    res.status(status).send(response);
};

module.exports = processJSONResponse;
