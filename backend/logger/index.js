const path = require('path');
const { createLogger, format, transports } = require('winston');
let topModule = module;

while (topModule.parent) {
    topModule = topModule.parent;
}

const logger = createLogger({
    transports: [
        new transports.Console({
            level: 'info',
            format: format.combine(
                format.colorize(),
                format.label({
                    label: path.basename(topModule.filename),
                }),
                format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss',
                }),
                format.printf((info) => {
                    return `${info.timestamp} [${info.level}]: ${info.label} - ${info.message}`;
                }),
            ),
            handleExceptions: true,
        }),
        new transports.File({
            level: 'info',
            format: format.combine(
                format.label({
                    label: path.basename(topModule.filename),
                }),
                format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss',
                }),
                format.printf((info) => {
                    return `${info.timestamp} [${info.level}]: ${info.label} - ${info.message}`;
                }),
            ),
            filename: 'output.log',
            dirname: 'logs',
            maxsize: 10485760,
            maxFiles: 10,
            handleExceptions: true,
        }),
    ],
});

logger.stream = {
    write: (message) => {
        logger.info(message);
    },
};

module.exports = logger;
