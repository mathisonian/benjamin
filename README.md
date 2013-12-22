# benjamin 

bitcoin trading for the rest of us

## getting started

### installation

Install the module with: `npm install benjamin`

### dependencies

#### database

Benjamin uses the [sequelize.js](http://sequelizejs.com/) ORM as its backing db. You can use with sqlite, mysql, or postgres.

You will need to install your specific database client in addition to benjamin. (e.g. postgres needs `pg`, sqlite needs `sqlite3`)

#### API credentials

You will need the following to get started:
* api key for desired btc market (currently only mtgox is supported)
* at least one trading strategy (see below)


#### creating benjamin

```javascript
var Benjamin = require('benjamin');

var benjamin = new Benjamin({
    api_key: 'MY API KEY',
    api_secret: 'MY API SECRET'
});
```

## details

### initialization

benjamin can be initialized with the following options
```javascript
var options = {
    market: 'mtgox', // market name according ot http://api.bitcoincharts.com/v1/markets.json
    currency: 'USD',
    client: {
        api_key: 'MY API KEY',
        api_secret: 'MY API SECRET'
    },
    database: { // sequelize.js options
        dialect: 'sqlite', // sqlite, postgres, or mysql
        database: 'database-name',
        username: 'username',
        password: 'password',
        options: {} // other sequelize options: http://sequelizejs.com/docs/latest/usage#options
    }
};

var benjamin = new Benjamin(options);
```

### simulation

You can do dry-runs of trading strategies to see how this would all play out

```javascript
benjamin.use(require('experimental-trading-strategy'));

benjamin.simulate(); // benjamin prints out trades to console
```

and start from a custom time in the past

```js
var start = moment([2012, 1, 1]).format('X'); 
benjamin.simulate({
    start: start // UNIX-timestamp
});
```

or a custom interval:

```js
var start = moment([2012, 1, 1]).format('X');
var end = moment([2012, 12, 1]).format('X');
benjamin.simulate({
    start: start, // UNIX-timestamps
    end: end
});
```


### trading

running live trades is just as easy

```javascript

benjamin.use(require('benjamin-buy-low-sell-high')); // provide at least one strategy


var options = {
    // currently no options  
};

// BE CAREFUL THIS WILL MAKE TRADES
benjamin.start(options); // and we're off!

```

### analytics

Benjamin can also be used as an analytics tool. Since he automatically deals with keeping the
trades database in sync for you, you can write analytics strategies.

Just write you analysis code in the form of a strategy (as shown below), and callback with a suggested
trade amount of `0`.


### static trades

benjamin also exposes a common client interface (although only mtgox is currently supported).

this allows you to invoke trade commands directly:

**WARNING THESE COMMANDS WILL TRANSFER YOUR BTCs**

```javascript

// try to sell 10 BTC
benjamin.sell(10, function(err, json) {
    if(err) {
        // something went wrong
    }
});

```

```javascript

// try to buy 10 BTC
benjamin.buy(10, function(err, json) {
    if(err) {
        // something went wrong
    }
});
```


```javascript

// try to send 10 BTC to a certain address
benjamin.send('BITCOIN WALLET ADDRESS', 10, function(err, json) {
    if(err) {
        // something went wrong
    }
});
```


## trading strategies


strategies just need to implement three methods in order to work with benjamin.

```javascript

module.exports = (function() {
    
    Strategy = {

        initialize: function() {
            // do whatever you need to do prepare for trading
        },

        tick: function(Trades, currentSuggestion, callback) {
            // return suggested action
            // in bitcoins
            //
            // if you are using multiple strategies,
            // these functions get chained together,
            // so it is possible to have one strategy
            // influence another.
            //
            // once all strategies give their recommendation
            // benjamin carries out the cumulative recommended 
            // action
            //
            // e.g. 
            //      callback(10); // recommend to buy 10 bitcoins
            //      callback(-10); // recommend to sell 10 bitcoins
            //
            // Trades is a sequelize model object, so you can 
            // access whatever trades you want by doing something
            // like
            //
            // Trades
            //   .findAll({
            //      where: ['timestamp > ?', timestamp]
            //   }).success(function(trades) {
            //      // trades is now all of the btc trades
            //      // that occurred since timestamp
            //      // 
            //      // each trade has timestamp, price and amount
            //      // of bitcoin traded
            //   });
            //
            // benjamin automatically fetches and keeps the 
            // trades up-to-date with the most recent market data
        },

        shouldExit: function() {
            //
            // failsafe for benjamin to quit trading under certain circumstances
            //
            // e.g. 
            //      return false;
        }

    };

    return Strategy;
})();

```



## notes

### THERE IS NO WARRANTY

this is young software and it will play around with your money. i take no responsibility for anything that happens. please use common sense, review all source code and
make use of the simulation service before making real trades.

### TODO

* Currently all of the timestamps in Benjamin are UNIX-timestamps, which aren't very cool or nice to work with. The reason is that the bitcoin charts API operates using unix timestamps
and this way we don't have to do a ton of conversion. I would like to hide this from the user at some point and allow more conventional time formats as input.

## license



The MIT License (MIT)

Copyright (c) 2013 Matthew Conlen

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
