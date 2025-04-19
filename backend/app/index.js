const async = require('async');
const bodyParser = require('body-parser');
const compression = require('compression');
const cors = require('cors');
const express = require('express');
const morgan = require('morgan');
const path = require('path');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');
const database = require('../database');
const logger = require('../logger');
const runner = require('../runner');
const config = require('../config');
const utils = require('../utils/file.util');

const morganFormat = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms ":referrer" ":user-agent"';

const app = (cb) => {
    async.waterfall([
        (next) => {
            database.init((error) => {
                if (error) {
                    logger.error('Failed to initialize database connection!');
                    process.exit(1);
                } else {
                    next(null);
                }
            });
        }, (next) => {
            runner.init((error) => {
                if (error) {
                    logger.error('Failed to initialize runner!');
                    next(error);
                } else {
                    logger.info('');
                    next(null);
                }
            });
        }, (next) => {
            utils.getFiles([
                './app/models/*.model.js',
            ]).forEach((modelPath) => {
                logger.info('modelPath ' + modelPath);
                require(path.resolve(modelPath));
            });

            next(null);
        }, (next) => {
            const app = express();
            const corsOptions = {
                origin: '*',
                methods: 'GET, OPTIONS, PUT, POST, DELETE',
            };

            app.use(cors(corsOptions));
            app.use(compression());
            app.use(bodyParser.json({
                limit: '1mb',
            }));
            app.use(bodyParser.urlencoded({
                limit: '1mb',
                extended: true,
            }));
            app.use(morgan(morganFormat, {
                stream: logger.stream,
            }));

            next(null, app);
        }, (app, next) => {
            const studioOptions = {
                definition: {
                    openapi: '3.0.0',
                    info: {
                        title: 'Media Node Studio Backend',
                        version: '1.0.0',
                        description: 'API documentation for Media Node Studio Backend',
                    },
                    servers: config.swagger.servers,
                },
                apis: ['./app/routes/swagger.route.js'],
            };
            const swaggerSpec = swaggerJsDoc(studioOptions);
            app.use('/api-docs/studio', swaggerUI.serveFiles(swaggerSpec), swaggerUI.setup(swaggerSpec));

            next(null, app);
        }, (app, next) => {
            utils.getFiles([
                './app/routes/*.route.js',
            ]).forEach((routePath) => {
                logger.info('routePath ' + routePath);
                require(path.resolve(routePath))(app);
            });

            next(null, app);
        }], cb);
};

module.exports = app;
