# benjamin 

bitcoin trading robot

## getting started

Install the module with: `npm install benjamin`

You will need the following to get started:
* api key for desired btc market (currently only mtgox is supported)
* at least one trading strategy (see below)

```javascript
var Benjamin = require('benjamin');

var benjamin = new Benjamin({
    market: 'mtgox',
    currency: 'USD',
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
    currency: 'USD', // currency
    historyFile: __dirname // path to store bitcoin trade information
};

var benjamin = new Benjamin(options);
```

### analytics & simulation

```javascript
benjamin.watch(); // keeps trade history file synced locally and periodically outputs to console

// you can have it run as frequently or infrequently as you'd like
var interval = 1000; // ms
benjamin.watch(interval);
```


and you can do dry-runs of trading strategies to see how this would all play out

```javascript
benjamin.use(require('experimental-trading-strategy'));

benjamin.simulate(); // benjamin prints out trades to console
```

### trading

running live trades is just as easy

```javascript

benjamin.use(require('benjamin-buy-low-sell-high')); // benjamin needs to know at least one strategy to use 


var options = {
    // currently no options  
};
benjamin.start(options); // and we're off!

```

### client methods

benjamin also exposes a common client interface (although only mtgox is currently supported).

this allows you to invoke trade commands directly:

**WARNING THESE COMMANDS WILL TRANSFER YOUR BTCs**

```javascript

// try to sell 10 BTC
benjamin.client.sell(10, function(err, json) {
    if(err) {
        // something went wrong
    }
});

```

```javascript

// try to buy 10 BTC
benjamin.client.buy(10, function(err, json) {
    if(err) {
        // something went wrong
    }
});
```


```javascript

// try to send 10 BTC to a certain address
benjamin.client.send('BITCOIN WALLET ADDRESS', 10, function(err, json) {
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

        tick: function(history, currentSuggestion) {
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
            //      return 10; // recommend to buy 10 bitcoins
            //      return -10; // recommend to sell 10 bitcoins
            //
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




## todo




## license

### THERE IS NO WARRANTY

The MIT License (MIT)

Copyright (c) 2013 Matthew Conlen

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
