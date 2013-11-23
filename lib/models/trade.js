'use strict';

module.exports = function(sequelize, DataTypes) {
    return sequelize.define('Trade', {
        'timestamp': {type: DataTypes.STRING, required: true },
        'price': { type: DataTypes.DECIMAL, required: true },
        'amount': { type: DataTypes.DECIMAL, required: true }
    }, {
        timestamps: false
    });
};
