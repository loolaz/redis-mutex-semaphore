'use strict';

var Promise = require('bluebird'),
	redis = require('redis'),
	EventEmitter = require('events').EventEmitter;

module.exports = RedisConnector;

Promise.promisifyAll(redis.RedisClient.prototype);

function RedisConnector(options, callback) {
	this.options = options;
	this.callback = callback;
	this.waiting = false;
	this.count = 0;
	this._initialize(options);
};

RedisConnector.prototype.__proto__ = EventEmitter.prototype;

var _ = RedisConnector.prototype;

_._connect = function(options, onConnect){
	var that = this;
	if(that.client && that.client.connected)
		return;
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
		that.count = 0;
		that.waiting = false;
		that.client.select(options.db);
		if(that.onConnect)
			that.onConnect();
		if(that.callback)
			that.callback(null, that.client);
	});

	that.client.on('error', function(err){	
		console.log(err);
		if(that.client.connected)
			return;
		if(that.callback)
			that.callback(err,null);
		if(!that.waiting){
			that.count++;
			that.waiting = true;		
			(function(count){
				setTimeout(function() 
				{
					if(!that.client.connected){
						console.log('Reconnecting Redis : ' + count);
						that.emit('retry');
					}
				}, 1000 * (count * count));
			})(that.count);
		}
	});
};

_._initialize = function(options, onConnect) {
	var that = this;
	that.on('retry', function(){
		that.waiting = false;
		that.client.retry_delay = 150;
    });

    that._connect(options, onConnect);
};