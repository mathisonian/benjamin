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

## trading strategies


## License
Copyright (c) 2013 Matthew Conlen. Licensed under the MIT license.
