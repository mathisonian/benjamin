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
var carrier = require('carrier');
var path = require('path');
var async = require('async');


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
        },
        safe: false
    };

    this.options = _.defaults(options, defaults);

    this.strategies = [];
    this.client = require(__dirname + '/clients/' + this.options.market)(this.options.client);
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

    var defaults = {
        interval: 15 * 60 * 1000 // 15 minutes
    };

    options = _.defaults(options || {}, defaults);


    // TODO: 
    //
    // * check for at least one strategy to be defined
    // * warn if an api client isn't properly configured
    // * do some confirmation here that this will spend
    //   your bitcoins

    _.each(this.strategies, function(strategy) {
        strategy.initialize();
    });

    var self = this;
    setTimeout(function() {
        self._tradeLoop(options);
    }, 1000);


};


Benjamin.prototype._tradeLoop = function(options) {

    // steps needed each iterations
    //
    // 1. update the database since the last trades
    // 2. call each strategy to get suggestion
    // 3. execute the buy / sells
    // 4. call self at correct interval

    var Trade = this.models.Trade;
    var self = this;
    console.log();

    // todo clean this whole mess up.
    //      would be cool to use promises
    //      for everything.
    Trade
        .getLatestTradeTime()
        .success(function(timestamp) {
            self.updateDatabase(timestamp+1, null, function() {
                
                // function generators are fun?
                var mapped_strategies = _.map(self.strategies, function(strategy) {
                    return function(T, currentSuggestion, callback) {
                        strategy.tick(T, currentSuggestion, function(err, newSuggestion) {
                            if(err) {
                                return callback(err);
                            }
                            console.log('Strategy ' + strategy.name + ' suggested ' + newSuggestion);
                            callback(null, T, currentSuggestion + newSuggestion);
                        });
                    };
                });


                // TODO - I know there is a more 'functional'
                //        way to do this
                var first = function(callback) {
                    return callback(null, Trade, 0);
                };
                var last = function(T, currentSuggestion, callback) {
                    callback(null, currentSuggestion);
                };
                mapped_strategies = [first].concat(mapped_strategies);
                mapped_strategies.push(last);

                async.waterfall(mapped_strategies, function(err, results) {

                    if(err) {
                        console.log(err);
                        return;
                    }
                    console.log('Total Suggestion: ' + results);

                    self._transact(results);

                    var shouldExit = false;
                    _.each(self.strategies, function(strategy) {
                        shouldExit = shouldExit || strategy.shouldExit();
                    });

                    if(shouldExit) {
                        return;
                    }
                    setTimeout(function() {
                        self._tradeLoop(options);
                    }, options.interval);
                });
            });
        });
};


// Benjamin.prototype._simulationLoop = function(currentTimestamp) {

// };


Benjamin.prototype.updateDatabase = function(from, to, callback) {
    // only use FROM timestamp in the api call, but
    // repeat until we are within some acceptable threshold of 'to'


    // PLAN:
    // execute fetch file and wait for callback
    // on callback do 'get latest trade' and see how it compares
    // to the 'TO' parameter
    // if its acceptable or the to param doesnt exits, 
    //  callback.
    // else 
    //  call updateDatabase again with from function equal to
    //  latestTrade.timestamp+1


    console.log('Benjamin is updating the database');

    this._fetchFile('http://api.bitcoincharts.com/v1/trades.csv?symbol=' + this.options.market + this.options.currency + '&start=' + from, null, function(err) {
        if(err) {
            return callback(err);
        }

        if(to == null) {
            console.log('Database updated successfully');
            return callback(null);
        }

        // check if the 


    });


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
// Benjamin.prototype.simulate = function(options) {

// };

Benjamin.prototype.buy = function(amount) {
    console.log('Buying ' + amount + 'BTC');
    if(this.options.safe) {
        return;
    }
    return this.client.buy(amount);
};

Benjamin.prototype.sell = function(amount) {
    console.log('Selling ' + amount + 'BTC');
    if(this.options.safe) {
        return;
    }
    return this.client.sell(amount);
};

Benjamin.prototype._transact = function(amount) {
    if(amount > 0) {
        return this.buy(amount);
    } else if (amount < 0) {
        return this.sell(-1 * amount);
    }
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
            bar = new ProgressBar('downloading [:bar] :percent :etas', {
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
        console.log('parsing raw');
        var sequelize = this.models.sequelize;
        sequelize.query('INSERT INTO "Trades" ("timestamp", "price", "amount") VALUES (' + arr.join(',') + ');');
        return;
    }

    this.models.Trade.create({
        'timestamp': arr[0],
        'price': arr[1],
        'amount': arr[2],
        'market': this.options.market
    }).error(function(err){
        console.log(err);
    });
};
