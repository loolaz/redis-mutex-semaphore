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
	this.subscriber.quit();
	if(this._internal_connection_used){
		this.client.quit();
	}
}

_.createSemaphore = function(object, initialCount, maxCount){
	if(initialCount >= maxCount)
		throw new Error('initialCount must be less than maxCount');
	if(this.sharedObjects.hasOwnProperty(this.prefixSemaphore+object)){
		this.sharedObjects[this.prefixSemaphore+object].reset();
		this.sharedObjects[this.prefixSemaphore+object].initialCount = initialCount;
		this.sharedObjects[this.prefixSemaphore+object].maxCount = maxCount;
	}
	else{
		this.sharedObjects[this.prefixSemaphore+object] = new Semaphore(object, this.prefixSemaphore, initialCount, maxCount, this.client, this.subscriber);
	}
	return this.sharedObjects[this.prefixSemaphore+object];
};

_.getSemaphore = function(object){
	return this.sharedObjects[this.prefixSemaphore+object];
};

_.createMutex = function(object, timeout){
	if(this.sharedObjects.hasOwnProperty(this.prefixMutex+object)){
		this.sharedObjects[this.prefixMutex+object].reset();
		this.sharedObjects[this.prefixMutex+object].timeout = timeout;
	}
	else{
		this.sharedObjects[this.prefixMutex+object] = new Mutex(object, this.prefixMutex, this.client, this.subscriber, timeout);
	}
	return this.sharedObjects[this.prefixMutex+object];
};

_.getMutex = function(object){
	return this.sharedObjects[this.prefixMutex+object];
};

function Semaphore(object, prefix, initialCount, maxCount, client, subscriber) {
	this.initialCount = initialCount;
	this.maxCount = maxCount;
	ShareObject.call(this, object, prefix, client, subscriber);
};

Semaphore.prototype = Object.create(ShareObject.prototype);
Semaphore.prototype.constructor = Semaphore;

Semaphore.prototype._get = function(){
	var that = this;
	
	return new Promise(function(resolve, reject){
		that.client.incr(that.key, function(err, reply) {
			if(err) {
				reject(err);
			} else if(reply > that.maxCount) {		
				that.client.decr(that.key, function(err, reply){	
					resolve(0); 
				});
			} else {		
				resolve(1);
			}
		});
	});
};

Semaphore.prototype.get = function(cb){ // timeout : sec.
	var that = this;
	
	var p = that._get();
	
	if(cb && typeof cb === "function"){
		p.then(function(result){
			cb(null, result);
		}).catch(function(err){
			cb(err, null);
		});
	}
	else{
		return p;
	}
};

Semaphore.prototype.check = function(cb){
	return ShareObject.prototype.check.call(this, cb, function(reply){
		return reply > 0;
	});
};

Semaphore.prototype.rel = function(cb){
	var that = this,
		p = that.client.decrAsync(that.key);

	if(cb && typeof cb === "function"){
		p.then(function(result){
			var err = null;
			if(result >= 0){
				that.client.publish(that.key, result);
			}
			else if(result < 0){
				err = new Error('semaphore count can not be negative value : ' + result);
				that.client.set(that.key, 0);
			}
			cb(err, result);
		}).catch(function(err){
			cb(err, null);
		});
	}
	else{
		return p.then(function(result){
			var err = null;
			if(result >= 0){
				that.client.publish(that.key, result);
				return Promise.resolve(result);
			}
			else if(result < 0){
				err = new Error('semaphore count can not be negative value : ' + result);
				that.client.set(that.key, 0);
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
		else {
			return false;
		}
	});
};


function Mutex(object, prefix, client, subscriber, timeout){
	this.timeout = timeout || 60;
	ShareObject.call(this, object, prefix, client, subscriber);
};

Mutex.prototype = Object.create(ShareObject.prototype);
Mutex.prototype.constructor = Mutex;

Mutex.prototype.reset = function(){
	ShareObject.prototype.reset.call(this);
	if(this.timer)
		clearTimeout(this.timer);
};

Mutex.prototype.get = function(cb){
	var that = this,
		muid = uuid.v4(),
		p = that.client.setnxAsync(that.key, muid);

	if(cb && typeof cb === "function"){
		p.then(function(result){
			if(result == 1){
				that.client.expire(that.key, that.timeout, function(){
					that.timer = setTimeout(function(){
						var _muid = muid;
						that.emit('expired', _muid);
					}, that.timeout * 1000);				
					cb(null, muid);					
				})
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
				return that.client.expireAsync(that.key, that.timeout).then(function(){
					that.timer = setTimeout(function(){
						var _muid = muid;
						that.emit('expired', _muid);
					}, that.timeout * 1000);
					return Promise.resolve(muid);			
				});
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
