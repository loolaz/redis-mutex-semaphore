'use strict';

var Promise = require('bluebird'),
	redis = require('redis'),
	EventEmitter = require('events').EventEmitter;

module.exports = RedisConnector;

Promise.promisifyAll(redis.RedisClient.prototype);

function RedisConnector(options, callback) {
	this.options = options;
	this.callback = callback;
	this._initialize(options);
};

RedisConnector.prototype.__proto__ = EventEmitter.prototype;

var _ = RedisConnector.prototype;

_._connect = function(options){
	var that = this;
	that.client = redis.createClient(options.port, options.host, options);

	if(options.pass) {
		that.client.auth(options.pass, function(err){
			if(err && that.callback) {
				that.callback(err,null);
			}
		});
	}
	if(options.db)
		that.client.select(options.db);

	that.client.on('connect', function() {
		that.client.select(options.db);
		if(that.callback)
			that.callback(null, that.client);
	});

	that.client.on('error', function(err){	
		if(that.callback)
			that.callback(err,null);
	});
};

_._initialize = function(options) {
	var that = this;
    that._connect(options);
};