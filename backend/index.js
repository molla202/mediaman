const config = require('./config').server;
const app = require('./app');
const logger = require('./logger');

app((error, instance) => {
    if (error) {
        logger.error(error);
        console.log(error);
    } else {
        instance.listen(config.port);
        logger.info(`Server is running on port: ${config.port}`);
    }
});
