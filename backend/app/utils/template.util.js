const fs = require('fs');
const path = require('path');

const getNginxTemplate = () => {
    const templatesPath = path.join(__dirname, '../templates', 'nginx.template.conf');
    const template = fs.readFileSync(templatesPath, 'utf8');

    return template;
}

const getRTMPTemplate = () => {
    const templatesPath = path.join(__dirname, '../templates', 'rtmp.template.conf');
    const template = fs.readFileSync(templatesPath, 'utf8');

    return template;
}


module.exports = {
    getNginxTemplate,
    getRTMPTemplate,
}
