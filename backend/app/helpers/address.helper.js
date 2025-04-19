
const isValidDenomAddress = (addresses) => {
    try {
        const isDenom = (address) => address.slice(0, 9) === 'onftdenom';
        const allDenom = addresses.every(isDenom);
        return allDenom;
    } catch (e) {
        console.log(e);
        return false;
    }
};

const isValidFlixAddress = (addresses) => {
    try {
        const isFlix = (address) => address.slice(0, 8) === 'omniflix';
        const allFlix = addresses.every(isFlix);
        return allFlix;
    } catch (e) {
        console.log(e);
        return false;
    }
};

module.exports = {
    isValidDenomAddress,
    isValidFlixAddress,
};
