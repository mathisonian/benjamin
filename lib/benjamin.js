/*
 * benjamin
 * https://github.com/mathisonian/benjamin
 *
 * Copyright (c) 2013 Matthew Conlen
 * Licensed under the MIT license.
 */

'use strict';

var _ = require('lodash');
var fs = require('fs');
var http = require('http');


function Benjamin(options) {
    if (!(this instanceof Benjamin)) {
        return new Benjamin(options);
    }

    var defaults = {
        market: 'mtgox',
        currency: 'USD',
        historyFile: __dirname + '/../history'
    };

    this.options = _.defaults(options, defaults);

    this.strategies = [];

    this.client = require(__dirname + '/clients/' + this.options.market);

}

Benjamin.VERSION = require('../package.json').version;
module.exports = Benjamin;


/*
 * Fetch bitcoin price history
 *
 * For now use this logic: 
 * if the history file exists, simply append to it
 * otherwise, fetch the whole thing from bitcoincharts
 *
 */
Benjamin.prototype.fetch = function(cb) {
    cb = cb || function() {};

    if(!fs.existsSync(this.options.historyFile)) {
        return this._fetchHistoryFile(cb);
    }

    this._fetchFile('http://api.bitcoincharts.com/v1/trades.csv?symbol=' + this.options.market + this.options.currency, cb);
};


/*
 * Keeps the price history in sync and periodically
 * prints trade prices to the console
 */
Benjamin.prototype.watch = function() {
    this.fetch(function() {
    });
};


/*
 * Add a trading strategy
 */
Benjamin.prototype.use = function(strategy) {

    // ensure that the strategy has the necessary functions:
    var requiredMethods = ['initialize', 'tick', 'shouldExit'];

    var implementsMethods = _.every(requiredMethods, function(methodName) {
        return _.isFunction(strategy[methodName]);
    });


    if(!implementsMethods) {
        throw new Error('Strategy does not implement required methods');
    }
    this.strategies.push(strategy);
};


/*
 * Start bitcoin trading
 *
 * BE CAREFUL THIS WILL ACTUALLY
 * TRADE YOUR BTC
 *
 */
Benjamin.prototype.start = function(options) {
    // start trading
};


/*
 * Simulate bitcoin trading
 *
 * Acts the same as start() but
 * can take a starting point in history,
 * and will never actually make a trade
 *
 */
Benjamin.prototype.simulate = function(options) {

};

Benjamin.prototype.buy = function(amount) {
    return this.client.buy(amount);
};

Benjamin.prototype.sell = function(amount) {
    return this.client.sell(-1 * amount);
};




/*
 * Private methods
 */


Benjamin.prototype._fetchHistoryFile = function(cb) {
    cb = cb || function() {};

    if(!fs.existsSync(this.options.historyFile)) {
        fs.unlinkSync(this.options.historyFile);
    }
    var url = 'http://api.bitcoincharts.com/v1/csv/' + this.options.market + this.options.currency + '.csv';
    this._fetchFile(url, cb);
};


Benjamin.prototype._fetchFile = function(url, cb) {
    cb = cb || function() {};

    var file = fs.createWriteStream(this.options.historyFile);

    http.get(url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
            cb();
        });
    });
};
