'use strict';

var Promise = require('bluebird'),
	redis = require('redis'),
	util = require('util'),
	SharedObject = require('./sharedObject'),
	RedisConnector = require('./redisConnector'),
	uuid = require('uuid');

exports.factory = function(connect_options, cb){
	var	mutexTimer = {},
		SharedObjectFactory = function(connect_options, cb) {		
			if(connect_options && connect_options.options){
				this.client = connect_options;
			}
			else{
				this.options = connect_options || {
					host: '127.0.0.1',
					port: 6379,
					db: 1
				};
			}
			this._initialize(cb);
		};

	function Semaphore(object, count, prefix, client, subscriber) {
		this.luaScripts = require('../script/semaphore');
		this.count = count;
		SharedObject.call(this, object, prefix, client, subscriber);
	}

	util.inherits(Semaphore, SharedObject);

	Semaphore.prototype._reset = function(cb){  
		var that = this;
		return new Promise(function(resolve, reject){
			that.client.set(that.key, that.count, function(err, result){
				if(err){
					reject(err);
				}
				else{
					if(result === "OK"){
						resolve(true);
					}
					else{
						reject(false);
					}
				}
			});
		});
	};

	Semaphore.prototype._get = function(){
		var that = this;

		return new Promise(function(resolve, reject){		
			that._evalJustInTime('get', 1, that.key, function(err, reply){
				if(err) {
					reject(err);
				}
				else if(reply === null){
					var keyNotFoundErr = new Error('key was deleted');
					keyNotFoundErr.code = 'ENOTFOUNDKEY';
					reject(keyNotFoundErr);
				}
				else if(reply >= 0) {
					resolve(true);	
					that._publish(that.prefixInfo + that.key, {
						name : 'semaphore_acquired',
						value : reply
					});	
				}
				else {	
					resolve(false);
				}
			});
		});

	};

	Semaphore.prototype._rel = function(){
		var that = this;

		return new Promise(function(resolve, reject){
			that.client.incr(that.key, function(err, result){
				if(err)
					reject(err);
				else{
					that._publish(that.key, {
						name : 'semaphore_released',
						count : result
					});
					resolve(result);		
				}
			});
		});
	};

	Semaphore.prototype.check = function(cb){
		return SharedObject.prototype.check.call(this, cb, function(reply){
			return reply > 0;
		});
	};

	function Mutex(object, prefix, client, subscriber, timeout){
		this.luaScripts = require('../script/mutex');
		this.timeout = timeout ? Math.floor(timeout * 1000) : 60000;
		SharedObject.call(this, object, prefix, client, subscriber);
	}

	util.inherits(Mutex, SharedObject);

	Mutex.prototype._reset = function(cb){
		var that = this;
		if(mutexTimer[this.key])
			clearTimeout(mutexTimer[this.key]);
		mutexTimer[this.key] = null;
		
		return new Promise(function(resolve, reject){
			that.client.del(that.key, function(err, result){
				if(err){
					reject(err);
				}
				else{
					if(result > 0){
						resolve(true);
					}
					else{
						resolve(false);
					}
				}
			});
		});
	};

	Mutex.prototype._get = function(){
		var that = this,
			muid = uuid.v4(),
			startTime = Date.now(),
			setMutexTimer = function(){
				that.timestamp = startTime;
				mutexTimer[that.key] = setTimeout(function(){
					mutexTimer[that.key] = null;
					that.emit('expired', 1);
					that._publish(that.key, {
						name : 'mutex_expired',
						count : 1
					});
				}, that.timeout);
				that._publish(that.prefixInfo + that.key, {
					name : 'mutex_locked',
					value : muid
				});
			};
		return new Promise(function(resolve, reject){		
			that._evalJustInTime('get', 1, that.key, muid, that.timeout, function(err, reply) {
				if(err){
					reject(err);
				}
				else if(reply === 1) {
					setMutexTimer();				
					resolve(muid);
				} else {
					resolve(null);
				}
			});
		});
	};

	Mutex.prototype._rel = function(muid){
		var that = this;
		return new Promise(function(resolve, reject){		
			that._evalJustInTime('rel', 1, that.key, muid, function(err, reply){
				if(err){
					reject(err);
				}
				else if(reply === -1){
					var noAccessError = new Error('Access denied');
					noAccessError.code = 'ENOACCESS';
					reject(noAccessError);				
				}
				else if(reply === null || mutexTimer[that.key] === null){
					resolve(false);
				}
				else { // if(muid === reply)
					if(reply > 0){
						clearTimeout(mutexTimer[that.key]);
						mutexTimer[that.key] = null;
						that._publish(that.key, {
							name : 'mutex_unlocked',
							count : 1
						});
					}
					resolve(reply > 0);
				}
			});
		});
	};

	Mutex.prototype.check = function(cb){
		return SharedObject.prototype.check.call(this, cb, function(reply){
			return !reply;
		});
	};

	Mutex.prototype._extend = function(muid, timeout){
		var that = this,
			newTimeout = that.timeout - (Date.now() - that.timestamp) + (timeout * 1000);
		return new Promise(function(resolve, reject){		
			that._evalJustInTime('extend', 1, that.key, muid, newTimeout, function(err, result){
				if(err){
					reject(err);
				}
				else{
					if(mutexTimer[that.key] === null){
						if(result){
							that.client.del(that.key, function(err, result){
								if(err)
									reject(err);
								else
									resolve(false);
							});
						}
						else
							resolve(false);
					}
					else if(result){
						clearTimeout(mutexTimer[that.key]);
						mutexTimer[that.key] = setTimeout(function(){
							that.emit('expired', 1);
							that._publish(that.key, {
								name : 'mutex_expired',
								count : 1
							});
						}, newTimeout);
						resolve(true);
					}
					else{
						resolve(false);
					}
				}
			});
		});
	};

	Mutex.prototype.extend = function(muid, timeout, cb){
		return this._convertToHybridCall(this._extend(muid, timeout), cb);
	};

	Mutex.prototype._debug_resetMutexTimer = function(){ // only for testing
		mutexTimer[this.key] = null;
	};

	var _ = SharedObjectFactory.prototype;

	_._initialize = function(cb){
		var that = this;
		that.prefixSemaphore = 'sema:';
		that.prefixMutex = 'mutex:';
		that.sharedObjects = {};

		if(that.client === undefined){		
			that.client = (new RedisConnector(that.options, function(err, redisClient){
				if(cb){
					if(err){
						return cb(err, null);
					}
					else{
						return cb(null, redisClient);
					}
				}
			})).client;
			that._internal_connection_used = true;	
			that.subscriber = redis.createClient(that.options.port, that.options.host, that.options);
			if(that.options.pass) {
				that.subscriber.auth(that.options.pass);
			}
		}
		else{
			that.subscriber = redis.createClient(that.client.options.port, that.client.options.host, that.client.options);
			if(that.client.options.pass) {
				that.subscriber.auth(that.client.options.pass);
			}
			if(cb)
				cb(null, that.client);
		}
	};

	_.end = function(){
		var key;
		for(key in mutexTimer){
			if(mutexTimer[key])
				clearTimeout(mutexTimer[key]);
		}
		mutexTimer  = {};
		for(key in this.sharedObjects){
			if({}.hasOwnProperty.call(this.sharedObjects, key))
				this.client.del(key);
		}
		this.subscriber.quit();
		if(this._internal_connection_used){
			this.client.quit();
		}
	};

	_._resetObject = function(key, cb){
		var that = this;
		if(cb && typeof cb === "function")
			that.sharedObjects[key].reset(function(err, result){
				if(err)
					cb(err, null);
				else
					cb(null, that.sharedObjects[key]);
			});	
		else{
			return that.sharedObjects[key].reset().then(function(result){
				return Promise.resolve(that.sharedObjects[key]);
			});
		}
	};

	_._createSemaphore = function(object, count){
		var that = this;
		that.sharedObjects[that.prefixSemaphore+object] = new Semaphore(object, count, that.prefixSemaphore, that.client, that.subscriber);
		that.sharedObjects[that.prefixSemaphore+object].setDefaultPriority(exports.priority.HIGH);
	};

	_.createSemaphoreClient = function(object, count, cb){
		var that = this;
		if(!{}.hasOwnProperty.call(that.sharedObjects, that.prefixSemaphore+object)){
			that._createSemaphore(object, count);
		}
		return that._resetObject(that.prefixSemaphore+object, cb);
	};

	_.getSemaphoreClient = function(object, count = 3){
		var that = this;
		if(!{}.hasOwnProperty.call(that.sharedObjects, that.prefixSemaphore+object)){
			that._createSemaphore(object, count);
		}
		return that.sharedObjects[that.prefixSemaphore+object];
	};

	_._createMutex = function(object, timeout){
		var that = this;
		that.sharedObjects[that.prefixMutex+object] = new Mutex(object, that.prefixMutex, that.client, that.subscriber, timeout);
		that.sharedObjects[that.prefixMutex+object].setDefaultPriority(exports.priority.HIGH);
	}

	_.createMutexClient = function(object, timeout, cb){
		var that = this;
		if(!{}.hasOwnProperty.call(that.sharedObjects, that.prefixMutex+object)){
			that._createMutex(object, timeout);
		}
		that.sharedObjects[that.prefixMutex+object].timeout = Math.floor(timeout * 1000);
		return that._resetObject(that.prefixMutex+object, cb);
	};

	_.getMutexClient = function(object, timeout = 10){
		var that = this;
		if(!{}.hasOwnProperty.call(that.sharedObjects, that.prefixMutex+object)){
			that._createMutex(object, timeout);
			that.sharedObjects[that.prefixMutex+object].timeout = Math.floor(timeout * 1000);
		}
		return that.sharedObjects[that.prefixMutex+object];
	};

	return new SharedObjectFactory(connect_options, cb);
};

exports.priority = {
		HIGH : 0,
		NORMAL : 15,
		LOW : 40
	};
