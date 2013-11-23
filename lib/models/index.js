'use strict';
module.exports = function(config) {
    var models = {};
    var Sequelize = require('sequelize');
    var sequelize = new Sequelize(config.database, config.username, config.password, config.options);
    var fs = require('fs');
    models.sequelize = sequelize;

    // Bootstrap models
    fs.readdirSync(__dirname).forEach(function (file) {
        if (~file.indexOf('.js') && file.indexOf('index.js') < 0) {
            var model = sequelize.import(file);
            models[model.name] = model;
        }
    });


    sequelize.sync();
    return models;
};
