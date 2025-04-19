const { omniflixStudio } = require('../config').database;

let URL = `mongodb://${omniflixStudio.address}:${omniflixStudio.port}/${omniflixStudio.name}`;
if (omniflixStudio.username.length && omniflixStudio.password.length) {
    URL = `mongodb://${omniflixStudio.username}:${omniflixStudio.password}@${omniflixStudio.address}:${omniflixStudio.port}/${omniflixStudio.name}`;
}

module.exports = URL;
