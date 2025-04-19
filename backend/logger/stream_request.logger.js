const path = require('path');
const { createLogger, format, transports } = require('winston');

const objectifyError = format(info => {
    if (info.message instanceof Error) {
        info = Object.assign({
            message: info.message.message,
            stack: info.message.stack,
        }, info.message);
    }

    if (info instanceof Error) {
        info = Object.assign({
            message: info.message,
            stack: info.stack,
        }, info);
    }

    if (!info.stack) {
        info.stack = '';
    }

    return info;
});

const printf = (info) => {
    return `${info.timestamp} [${info.level}]: ${info.message} - ${info.stack}`;
};

const logger = createLogger({
    exitOnError: false,
    level: 'info',
    format: format.combine(
        objectifyError(),
        format.label({
            label: path.basename(process.mainModule ? process.mainModule.filename : ''),
        }),
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.printf(printf),
    ),
    silent: process.env.NODE_ENV === 'test',
    transports: [
        new transports.Console({
            format: format.combine(
                objectifyError(),
                format.colorize(),
                format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss',
                }),
                format.printf(printf),
            ),
        }),
        new transports.File({
            filename: 'vod_stream_requests.log',
            dirname: 'logs',
            maxsize: 1000000,
            maxFiles: 10,
            handleExceptions: true,
        }),
    ],
});

module.exports = logger;
