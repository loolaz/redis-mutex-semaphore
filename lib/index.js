'use strict';

var Promise = require('bluebird'),
	ShareObject = require('./sharedObject'),
	RedisConnector = require('./redisConnector'),
	uuid = require('uuid');

module.exports = function(options) {
	return new RedisSharedObject(options);
};

function RedisSharedObject(arg) {
	if(arg.options){
		this.client = arg;
	}
	else{
		this.options = arg;
	}
	this._initialize();
};

var _ = RedisSharedObject.prototype;

_._initialize = function(){
	var that = this;
	that.prefixSemaphore = 'sema:';
	that.prefixMutex = 'mutex:';
	that.sharedObjects = {};
	if(that.client === undefined){
		that.client = (new RedisConnector(that.options)).client;
		that.subscriber = (new RedisConnector(that.options)).client;
		that._internal_connection_used = true;	
	}
	else{
		that.subscriber = (new RedisConnector(that.options)).client;
	}
};

_.end = function(){
	for(var key in this.sharedObjects){
		this.client.del(key);
	}
	this.subscriber.quit();
	if(this._internal_connection_used){
		this.client.quit();
	}
}

_.createSemaphoreClient = function(object, count, cb){
	var that = this;
	if(!that.sharedObjects.hasOwnProperty(that.prefixSemaphore+object)){
		that.sharedObjects[that.prefixSemaphore+object] = new Semaphore(object, that.prefixSemaphore, that.client, that.subscriber);
	}
	if(cb && typeof cb === "function")
		that.sharedObjects[that.prefixSemaphore+object].reset(count, function(err, result){
			if(err)
				cb(err, null);
			else
				cb(null, that.sharedObjects[that.prefixSemaphore+object]);
		});	
	else{
		return that.sharedObjects[that.prefixSemaphore+object].reset(count).then(function(result){
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

function Semaphore(object, prefix, client, subscriber) {
	ShareObject.call(this, object, prefix, client, subscriber);
};

Semaphore.prototype = Object.create(ShareObject.prototype);
Semaphore.prototype.constructor = Semaphore;

Semaphore.prototype.reset = function(count, cb){
	this.count = count;
	ShareObject.prototype.reset.call(this);
	var p = this.client.setAsync(this.key, count || 1);
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
			} else if(reply > 0 || reply === null) {		
				var multi = client.multi();					
				if(reply === null){
					multi.set(that.key, that.count - 1);
				}
				else{
					multi.decr(that.key);
				}
				multi.exec(function(err, result){
					if(err){
						reject(err);
					}
					else if(!result){
						resolve(-1);
					}
					else{
						resolve(1);					
					}
				});
			} else {
				client.unwatch();			
				resolve(0);
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
			if(result <= that.count){
				that.client.publish(that.key, result);
			}
			else if(result > that.count){
				that.client.decr(that.key);
				err = new Error('the number of semaphores exceeds initial count: ' + result);
			}
			cb(err, result);
		}).catch(function(err){
			cb(err, null);
		});
	}
	else{
		return p.then(function(result){
			var err = null;
			if(result <= that.count){
				that.client.publish(that.key, result);
				return Promise.resolve(result);
			}
			else if(result > that.count){
				that.client.decr(that.key);
				err = new Error('the number of semaphores exceeds initial count : ' + result);
				return Promise.reject(err);
			}
		});
	}
};

Semaphore.prototype.observing = function(timeout, cb, _cb){
	return ShareObject.prototype.observing.call(this, timeout, cb, _cb, function(result){
		return !result;
	});
};

Semaphore.prototype.waitingFor = function(timeout, cb, _cb){
	var that = this;
	return ShareObject.prototype.waitingFor.call(this, timeout, cb, _cb, function(result){
		if(result === 1){
			if(_cb){
				cb(result);
			}
			else{
				cb(null, result);
			}
			return true;
		}
		else if(result === -1){
			that.waitingFor(timeout, cb, _cb);
			return true;
		}
		else {
			return false;
		}
	});
};

Semaphore.prototype.getStatus = function(cb){
	var that = this,
		p = that.client.getAsync(that.key);

	if(cb && typeof cb === "function"){
		ShareObject.prototype.getStatus.call(that, function(err, result){
			if(err){
				cb(err, null);
			}
			else{
				result.value = parseInt(result.value);
				cb(null, result);
			}
		});
	}
	else{
		return ShareObject.prototype.getStatus.call(that).then(function(result){
			result.value = parseInt(result.value);
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
	if(this.timer)
		clearTimeout(this.timer);
	this.timer = null;
	ShareObject.prototype.reset.call(this);
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
				that.timer = setTimeout(function(){
						var _muid = muid;
						that.emit('expired', _muid);
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
				that.timer = setTimeout(function(){
					var _muid = muid;
					that.emit('expired', _muid);
				}, that.timeout * 1000);
				return Promise.resolve(muid);
			}
			else{
				return Promise.resolve(null);
			}
		});
	}
};

Mutex.prototype.rel = function(muid, cb){
	var that = this,
		p = that.client.getAsync(that.key);

	if(cb && typeof cb === "function"){
		p.then(function(reply){
			if(muid != reply){
				cb(new Error('Access denied'), false);
			}
			else if (muid == reply){
				that.client.del(that.key, function(err, result){
					if(!err){
						clearTimeout(that.timer);
						that.timer = null;
						that.client.publish(that.key, result);
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
				return Promise.reject(new Error('Access denied'));
			}
			else if(muid == reply){
				return that.client.delAsync(that.key);
			}
		}).then(function(result){
			clearTimeout(that.timer);
			that.timer = null;
			that.client.publish(that.key, result);
			return Promise.resolve(result > 0);
		});
	}
};

Mutex.prototype.check = function(cb){
	return ShareObject.prototype.check.call(this, cb, function(reply){
		return reply != 0;
	});
};

Mutex.prototype.observing = function(timeout, cb, _cb){
	return ShareObject.prototype.observing.call(this, timeout, cb, _cb, function(result){
		return result;
	});
};

Mutex.prototype.waitingFor = function(timeout, cb, _cb){
	return ShareObject.prototype.waitingFor.call(this, timeout, cb, _cb, function(result){
		if(result){
			if(_cb){
				cb(result);
			}
			else{
				cb(null, result);
			}
			return true;
		}
		else
			return false;
	});
};
