const glob = require('glob');
const lodash = require('lodash');

const getFiles = (globPatterns, removeRoot) => {
    const urlRegex = new RegExp('^(?:[a-z]+:)?//', 'i');
    let output = [];

    if (lodash.isArray(globPatterns)) {
        globPatterns.forEach((globPattern) => {
            output = lodash.union(output, getFiles(globPattern, removeRoot));
        });
    } else {
        if (lodash.isString(globPatterns)) {
            if (urlRegex.test(globPatterns)) {
                output.push(globPatterns);
            } else {
                let files = glob.sync(globPatterns, {
                    sync: true,
                });

                if (removeRoot) {
                    files = files.map((file) => {
                        return file.replace(removeRoot, '');
                    });
                }
                output = lodash.union(output, files);
            }
        }
    }

    return output;
};

module.exports = {
    getFiles,
};
