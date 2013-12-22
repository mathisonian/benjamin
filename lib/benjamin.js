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


    var currentUnixTimestamp = Math.round(+new Date()/1000);
    var TWO_MONTHS_IN_SECONDS = 5259490;
    var from = currentUnixTimestamp - TWO_MONTHS_IN_SECONDS;

    setTimeout(function() {
        self.updateDatabase(from, null, function(err) {
            if(err) {
                console.log(err);
                return;
            }
            self._tradeLoop(options);
        });
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
                async.waterfall(self._getWaterfallStrategies(), function(err, results) {

                    if(err) {
                        console.log(err);
                        return;
                    }
                    console.log('Total Suggestion: ' + results);

                    self._transact(results);

                    if(self._shouldExit()) {
                        return;
                    }
                    setTimeout(function() {
                        self._tradeLoop(options);
                    }, options.interval);
                });
            });
        });
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
    this.options.safe = true;

    if(!options.start) {
        // just run the normal trade
        // loop with safety on
        // if there is no custom time
        return this.start(options);
    }

    options.start = parseInt(options.start);
    if(options.end) {
        options.end = parseInt(options.end);
    }
    
    // populate the database initially,
    // then start hte simulate loop

    // from ~ about 2 month before
    // start time 
    // magic number from google
    
    _.each(this.strategies, function(strategy) {
        strategy.initialize();
    });

    var TWO_MONTHS_IN_SECONDS = 5259490;
    var from = options.start - TWO_MONTHS_IN_SECONDS;

    var self = this;
    this.clipping = false;


    setTimeout(function() {
        self.updateDatabase(from, null, function(err) {
            if(err) {
                console.log(err);
                return;
            }
            self._simulationLoop(options.start, options);
        });
    }, 1000);
};


Benjamin.prototype._simulationLoop = function(currentTimestamp, options) {
    // steps needed each iterations
    //
    // 1. update the database since the last trades
    // 2. call each strategy to get suggestion
    // 3. execute the buy / sells
    // 4. call self at correct interval

    var Trade = this.models.Trade;
    var self = this;
    console.log();

    if(options.end && currentTimestamp >= options.end) {
        return;
    }

    // Protection so we don't go crazy if the simulation 
    // catches up with present-day
    var currentUnixTimestamp = Math.round(+new Date()/1000);
    if(currentTimestamp > currentUnixTimestamp) {
        currentTimestamp = currentUnixTimestamp;
        this.clipping = true;
    }

    // todo clean this whole mess up.
    //      would be cool to use promises
    //      for everything.
    Trade
        .getLatestTradeTime()
        .success(function(timestamp) {
            self.updateDatabase(timestamp+1, currentTimestamp, function() {
                async.waterfall(self._getWaterfallStrategies(), function(err, results) {

                    if(err) {
                        console.log(err);
                        return;
                    }
                    console.log('Total Suggestion: ' + results);

                    self._transact(results);

                    if(self._shouldExit()) {
                        return;
                    }
                    if(self.clipping) {
                        setTimeout(function() {
                            self._simulationLoop(currentTimestamp + options.interval, options);
                        }, options.interval);
                    } else {
                        self._simulationLoop(currentTimestamp + options.interval, options);
                    }
                });
            });
        });
};


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


    // we have to special case updating for a certain time range
    // because the bitcoinCharts API only lets us select up to
    // 20000 results at a time and doesn't indicate if there 
    // are more or not... i.e. no paging
    var url = 'http://api.bitcoincharts.com/v1/trades.csv?symbol=' + this.options.market + this.options.currency + '&start=' + from;

    if(to !== null) {
        console.log('Benjamin is updating the database from: ' + from + ' to: ' + to);

        var startingCount;
        var Trade = this.models.Trade;
        var self = this;
        
        Trade.count().success(function(c) {
            startingCount = c;
            self._fetchFile(url, {from: from, to: to}, function(err) {
                if(err) {
                    return callback(err);
                }
                // check if the 
                Trade.count().success(function(newCount) {
                    if(newCount === startingCount && newCount > 0) {
                        console.log('Database updated successfully');
                        callback(null);
                    } else {
                        Trade
                            .getLatestTradeTime()
                            .success(function(timestamp) {
                                if(!timestamp) {
                                    return callback('Problem getting trades. Check to see that bitcoin charts API is actually returning data.');
                                }
                                self.updateDatabase(timestamp+1, to, callback);
                            }).error(function(err) {
                                callback(err);
                            });
                    }
                }).error(function(err) {
                    callback(err);
                });
            });

        });
    }

    else {
        console.log('Benjamin is updating the database from: ' + from);
        this._fetchFile(url, {from: from}, function(err) {
            if(err) {
                return callback(err);
            }
            console.log('Database updated successfully');
            return callback(null);
        });
    }
};



// Eventually we may want a more sophisticated stop strategy
// Benjamin.prototype.stop = function() {
// };



/*
 * Interface with the bitcoin market client
 */

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

Benjamin.prototype._shouldExit = function() {
    var shouldExit = false;
    _.each(this.strategies, function(strategy) {
        shouldExit = shouldExit || strategy.shouldExit();
    });
    return shouldExit;
 };



Benjamin.prototype._getWaterfallStrategies = function() {
    // function generators are fun?
    var Trade = this.models.Trade;
    var mapped_strategies = _.map(this.strategies, function(strategy) {
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
    return mapped_strategies;
 };



Benjamin.prototype._fetchFile = function(url, options, cb) {
    cb = cb || function() {};
    this.outstandingTrades = 0;
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
            cb();
        });
    });
};


Benjamin.prototype._parseLine = function(line, options) {
    // console.log('_parseLine');
    var arr = line.split(',');
    options = _.defaults(options || {}, {raw: false});

    if(options.from && parseInt(arr[0]) < parseInt(options.from)) {
        return;
    } else if (options.to && parseInt(arr[0]) > parseInt(options.to)) {
        return;
    }

    if(options.raw) {
        var sequelize = this.models.sequelize;
        sequelize.query('INSERT INTO "Trades" ("timestamp", "price", "amount") VALUES (' + arr.join(',') + ');');
        return;
    }
    this.models.Trade.create({
        'timestamp': arr[0],
        'price': arr[1],
        'amount': arr[2],
        'market': this.options.market
    }).error(function(){
        // console.log(err);
    });
};
