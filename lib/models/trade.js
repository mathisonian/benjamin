'use strict';

module.exports = function(sequelize, DataTypes) {
    return sequelize.define('Trade', {
        'timestamp': {type: DataTypes.BIGINT, required: true },
        'price': { type: DataTypes.DECIMAL, required: true },
        'amount': { type: DataTypes.DECIMAL, required: true },
        'market': { type: DataTypes.STRING, required: true }
    }, {
        timestamps: false,
        classMethods: {
            getLatestTradeTime: function() {
                var Trade = this;
                return Trade.max('timestamp');
            }
        }
    });
};
