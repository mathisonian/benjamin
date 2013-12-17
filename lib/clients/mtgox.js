'use strict';

var _ = require('lodash');
var MtGoxClient = require('mtgox-apiv2');

module.exports = function(options) {
    options = options || {};
    var defaults = {

    };

    options = _.defaults(options, defaults);


    var MarketClient = {

        /*
         * Amount in BTC, price optional
         */
        buy: function(amount, price, cb) {
            cb = cb || function() {};
            this.add('bid', amount, price, cb);
        },

        /*
         * Amount in BTC, price optional
         */
        sell: function(amount, price, cb) {
            cb = cb || function() {};
            this.add('ask', amount, price, cb);
        },

        /*
         * Amount in BTC. This will fail if you
         * are trying to send something that
         * doesn't fit the conditions 
         * here: https://en.bitcoin.it/wiki/Transaction_fees#Sending,
         *
         * since we default the fee to 0 for convenience. If you
         * really need the fee call the sendBitcoin method
         * directly
         *
         */
        send: function(address, amount) {
            this.sendBitcoin(address, amount, 0);
        }
    };

  return _.extend(new MtGoxClient(options.api_key, options.api_secret), MarketClient);
};
