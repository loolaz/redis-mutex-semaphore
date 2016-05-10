'use strict';

var Promise = require('bluebird'),
	redis = require('redis'),
	ShareObject = require('./sharedObject'),
	RedisConnector = require('./redisConnector'),
	uuid = require('uuid');

exports.factory = function(connect_options, cb) {
	return new Factory(connect_options, cb);
};

var Factory = (function(){
	var mutexTimer = {},
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
						cb(err, null);
					}
					else{
						cb(null, redisClient);
					}
				}
			})).client;
			that._internal_connection_used = true;	
		}

		that.subscriber = redis.createClient(that.client.options.port, that.client.options.host);
	};

	_.end = function(){
		for(var key in mutexTimer){
			if(mutexTimer[this.key])
				clearTimeout(mutexTimer[key]);
		}
		mutexTimer  = {};
		for(var key in this.sharedObjects){
			this.client.del(key);
		}
		this.subscriber.quit();
		if(this._internal_connection_used){
			this.client.quit();
		}
	};

	_.createSemaphoreClient = function(object, count, cb){
		var that = this;
		if(!that.sharedObjects.hasOwnProperty(that.prefixSemaphore+object)){
			that.sharedObjects[that.prefixSemaphore+object] = new Semaphore(object, count, that.prefixSemaphore, that.client, that.subscriber);
			that.sharedObjects[that.prefixSemaphore+object].setDefaultPriority(exports.priority.HIGH);
		}
		if(cb && typeof cb === "function")
			that.sharedObjects[that.prefixSemaphore+object].reset(function(err, result){
				if(err)
					cb(err, null);
				else
					cb(null, that.sharedObjects[that.prefixSemaphore+object]);
			});	
		else{
			return that.sharedObjects[that.prefixSemaphore+object].reset().then(function(result){
				if(result)
					return Promise.resolve(that.sharedObjects[that.prefixSemaphore+object]);
			});
		}
	};

	_.getSemaphoreClient = function(object){
		return this.sharedObjects[this.prefixSemaphore+object];
	};

	_.createMutexClient = function(object, timeout, cb){
		var that = this;
		if(!that.sharedObjects.hasOwnProperty(that.prefixMutex+object)){
			that.sharedObjects[that.prefixMutex+object] = new Mutex(object, that.prefixMutex, that.client, that.subscriber, timeout);
			that.sharedObjects[that.prefixMutex+object].setDefaultPriority(exports.priority.HIGH);
		}
		that.sharedObjects[that.prefixMutex+object].timeout = timeout;
		if(cb && typeof cb === "function")
			that.sharedObjects[that.prefixMutex+object].reset(function(err, result){
				if(err)
					cb(err, null);
				else
					cb(null, that.sharedObjects[that.prefixMutex+object]);
			});
		else
			return that.sharedObjects[that.prefixMutex+object].reset().then(function(result){
				if(result)
					return Promise.resolve(that.sharedObjects[that.prefixMutex+object]);
			});
	};

	_.getMutexClient = function(object){
		return this.sharedObjects[this.prefixMutex+object];
	};

	function Semaphore(object, count, prefix, client, subscriber) {
		this.count = count;
		ShareObject.call(this, object, prefix, client, subscriber);
	};

	Semaphore.prototype = Object.create(ShareObject.prototype);
	Semaphore.prototype.constructor = Semaphore;

	Semaphore.prototype.reset = function(cb){  
		var p = this.client.setAsync(this.key, this.count);
		if(cb && typeof cb === "function"){
			p.then(function(result){
				if(result == "OK")
					cb(null, true);
				else
					cb(null, false);
			}).catch(function(err){
				cb(err, false);
			});
		}
		else{
			return p.then(function(result){
				return Promise.resolve(result == "OK");
			});
		}
	};

	Semaphore.prototype._get = function(client){
		var that = this;
		
		return new Promise(function(resolve, reject){
			client.watch(that.key);
			client.get(that.key, function(err, reply) {
				if(err) {
					client.unwatch();
					reject(err);
				} else if(reply > 0) {		
					var multi = client.multi();					
					multi.decr(that.key);
					multi.exec(function(err, result){
						if(err){
							reject(err);
						}
						else if(!result){
							reject(-1);
						}
						else{
							resolve(true);					
						}
					});
				}
				else if(reply === null){
					var err = new Error('key was deleted');
					err.code = 'ENOTFOUNDKEY';
					client.unwatch();
					reject(err);
				} else {
					client.unwatch();			
					resolve(false);
				}
			});
		});
	};

	Semaphore.prototype.get = function(cb){ // timeout : sec.
		var that = this,
			redisClient = undefined;
		if(!that._internal_connection_used){
			redisClient = (new RedisConnector(that.client.options)).client;
		}
		
		var p = that._get(redisClient || that.client);
		
		if(cb && typeof cb === "function"){
			p.then(function(result){
				if(redisClient){
					redisClient.quit();
				}
				cb(null, result);
			}).catch(function(err){
				if(redisClient && redisClient.connected){
					redisClient.quit();
				}
				cb(err, false);
			});
		}
		else{
			return p.then(function(result){
				if(redisClient){
					redisClient.quit();
				}
				return Promise.resolve(result);
			}).catch(function(err){
				if(redisClient && redisClient.connected)
					redisClient.quit();		
				return Promise.reject(err);
			});
		}
	};

	Semaphore.prototype.check = function(cb){
		return ShareObject.prototype.check.call(this, cb, function(reply){
			return reply > 0;
		});
	};

	Semaphore.prototype.rel = function(cb){
		var that = this,
			p = that.client.incrAsync(that.key);

		if(cb && typeof cb === "function"){
			p.then(function(result){
				var err = null;
				that._publish(that.key, {
					message : 'semaphore_released',
					count : result
				});
				cb(err, result);
			}).catch(function(err){
				cb(err, null);
			});
		}
		else{
			return p.then(function(result){
				var err = null;
				that._publish(that.key, {
					message : 'semaphore_released',
					count : result
				});
				return Promise.resolve(result);
			});
		}
	};

	function Mutex(object, prefix, client, subscriber, timeout){
		this.timeout = timeout || 60;
		ShareObject.call(this, object, prefix, client, subscriber);
	};

	Mutex.prototype = Object.create(ShareObject.prototype);
	Mutex.prototype.constructor = Mutex;

	Mutex.prototype.reset = function(cb){
		if(mutexTimer[this.key])
			clearTimeout(mutexTimer[this.key]);
		mutexTimer[this.key] = null;
		var p = this.client.delAsync(this.key);

		if(cb && typeof cb === "function"){
			p.then(function(result){
				if(result > 0)
					cb(null, true);
				else
					cb(null, false);
			}).catch(function(err){
				cb(err, false);
			});
		}
		else{
			return p.then(function(result){
				return Promise.resolve(1);
			});
		}
	};

	Mutex.prototype.get = function(cb){
		var that = this,
			muid = uuid.v4(),
			p = that.client.setnxAsync(that.key, muid);

		if(cb && typeof cb === "function"){
			p.then(function(result){
				if(result == 1){
					that.client.expire(that.key, that.timeout);
					mutexTimer[that.key] = setTimeout(function(){
						that.emit('expired', muid);
						that._publish(that.key, {
							message : 'mutex_expired',
							count : 1
						});
					}, that.timeout * 1000);
					cb(null, muid);
				}
				else{
					cb(null, null);
				}
			}).catch(function(err){
				cb(err, null);
			});
		}
		else{
			return p.then(function(result){
				if(result == 1){
					that.client.expire(that.key, that.timeout);
					mutexTimer[that.key] = setTimeout(function(){
						that.emit('expired', muid);
						that._publish(that.key, {
							message : 'mutex_expired',
							count : 1
						});
					}, that.timeout * 1000);
					return Promise.resolve(muid);
				}
				else{
					return Promise.resolve(null);
				}
			}).catch(function(err){
				return Promise.reject(err);
			});
		}
	};

	Mutex.prototype.rel = function(muid, cb){
		var that = this,
			p = that.client.getAsync(that.key);

		if(cb && typeof cb === "function"){
			p.then(function(reply){
				if(muid != reply){
					var err = new Error('Access denied');
					err.code = 'ENOACCESS';
					cb(err, false);
				}
				else if (muid == reply){
					that.client.del(that.key, function(err, result){
						if(!err){						
							clearTimeout(mutexTimer[that.key]);
							mutexTimer[that.key] = null;
							that._publish(that.key, {
								message : 'mutex_unlocked',
								count : result
							});					
						}
						cb(err, result > 0);					
					})
				}
			}).catch(function(err){
				cb(err, false);
			});
		}
		else{
			return p.then(function(reply){
				if(muid != reply){
					var err = new Error('Access denied');
					err.code = 'ENOACCESS';
					return Promise.reject(err);
				}
				else if(muid == reply){
					return that.client.delAsync(that.key);
				}
			}).then(function(result){	
				clearTimeout(mutexTimer[that.key]);
				mutexTimer[that.key] = null;
				that._publish(that.key, {
					message : 'mutex_unlocked',
					count : result
				});
				return Promise.resolve(result > 0);
			});
		}
	};

	Mutex.prototype.check = function(cb){
		return ShareObject.prototype.check.call(this, cb, function(reply){
			return !reply;
		});
	};

	exports.priority = 
	{
		HIGH : 0,
		NORMAL : 30,
		LOW : 60
	};

	return SharedObjectFactory;
})();