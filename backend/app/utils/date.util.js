const stringToDate = (date) => {
    return new Date(date);
};

const msStringToDate = (date) => {
    date = Number(date);
    return new Date(date);
};

module.exports = {
    stringToDate,
    msStringToDate,
};
