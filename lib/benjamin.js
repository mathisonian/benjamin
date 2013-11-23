#!/usr/bin/env node

'use strict';

/*
 * benjamin
 * https://github.com/mathisonian/benjamin
 *
 * Copyright (c) 2013 Matthew Conlen
 * Licensed under the MIT license.
 */


var _ = require('lodash');
var fs = require('fs');
var http = require('http');
var path = require('path');
var ProgressBar = require('progress');
var Tail = require('tail').Tail;
var carrier = require('carrier');
var path = require('path');


function Benjamin(options) {
    if (!(this instanceof Benjamin)) {
        return new Benjamin(options);
    }

    var defaults = {
        market: 'mtgox',
        currency: 'USD',
        database: {
            username: '',
            password: '',
            options: {
                dialect: 'sqlite',
                storage: path.dirname(process.mainModule.filename) + '/benjamin.db',
                logging: false
            }
        }
    };

    this.options = _.defaults(options, defaults);

    this.strategies = [];
    this.client = require(__dirname + '/clients/' + this.options.market);
    this.models = require(__dirname + '/models/')(this.options.database);
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
Benjamin.prototype.fetch = function(options, cb) {
    cb = cb || function() {};
    options = options || {};

    options = _.defaults(options, {extended: false});

    if(options.extended) {
        return this._fetchHistoryFile(options, cb);
    }

    this._fetchFile('http://api.bitcoincharts.com/v1/trades.csv?symbol=' + this.options.market + this.options.currency, options, cb);
};


/*
 * Keeps the price history in sync and periodically
 * prints trade prices to the console
 */
Benjamin.prototype.watch = function(options) {

    var self = this;
    this.fetch(function() {
        var tail = new Tail(self.options.historyFile);

        tail.on('line', function(data) {
            console.log(data);
        });

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


Benjamin.prototype.stop = function() {

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

Benjamin.prototype._fetchHistoryFile = function(options, cb) {
    cb = cb || function() {};

    if(fs.existsSync(this.options.historyFile)) {
        fs.unlinkSync(this.options.historyFile);
    }

    console.log();
    console.log('Fetching entire ' + this.options.market + ' ' + this.options.currency +  ' BTC price history...');
    console.log('This may take a while');
    console.log();
    console.log('If you are having with performance, try passing {raw: true} into benjamin.fetch');
    console.log();
    var url = 'http://api.bitcoincharts.com/v1/csv/' + this.options.market + this.options.currency + '.csv';
    this._fetchFile(url, options, cb);
};


Benjamin.prototype._fetchFile = function(url, options, cb) {
    cb = cb || function() {};
    var self = this;

    // var chainer = new require('sequelize').Utils.QueryChainer;

    console.log('Downloading from URL: ' + url);
    var req = http.get(url);

    req.on( 'response', function ( res ) {
        var len = parseInt(res.headers['content-length'], 10);
        var bar = {tick: function(){}};

        if(!isNaN(len)) {
            var bar = new ProgressBar('downloading [:bar] :percent :etas', {
                  complete: '=',
                  incomplete: ' ',
                  width: 60,
                  total: len
            });
        }

        carrier.carry(res, function(line) {
            self._parseLine(line, options);
        });

        res.on('data', function(chunk){
            bar.tick(chunk.length);
        });
        
        res.on('end', function(){
            console.log('\n:)))))');
            cb();
        });
    });
};


Benjamin.prototype._parseLine = function(line, options) {
    var arr = line.split(',');
    options = _.defaults(options || {}, {raw: false});

    if(options.raw) {
        var sequelize = this.models.sequelize;
        sequelize.query('INSERT INTO "Trades" ("timestamp", "price", "amount") VALUES (' + arr.join(',') + ');');
        return;
    }
    this.models.Trade.create({
        'timestamp': arr[0],
        'price': arr[1],
        'amount': arr[2]
    });
};
