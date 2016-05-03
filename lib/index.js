'use strict';

var EventEmitter = require('events').EventEmitter,
	RedisConnector = require('./redisConnector'),
	uuid = require('uuid');

module.exports = RedisSharedObject;

function RedisSharedObject(arg) {
	if(arg.options)
		this.client = arg;
	else
		this.options = arg;
};

var _ = RedisSharedObject.prototype;

_.initialize = function(cb){
	var that = this;
	that.prefixSemaphore = 'sema:';
	that.prefixMutex = 'mutex:';
	that.sharedObjects = {};
	if(that.client === undefined){
		var redisHelper = new RedisConnector(that.options, function(err, redisClient1){
			that.client = redisClient1;
			that._internal_connection_used = true;
			redisHelper = new RedisConnector(that.options, function(err, redisClient2){
				that.subscriber = redisClient2;
				cb(null, true);
			});
		});		
	}
	else{
		var redisHelper = new RedisConnector(that.client.options, function(err, redisClient){
			that.subscriber = redisClient;
			cb(null, true);
		});
	}
};

_.end = function(){
	this.subscriber.quit();
	if(this._internal_connection_used)
		this.client.quit();
}

_.getSemaphore = function(object, initialCount, maxCount, sharedConnection){
	if(initialCount >= maxCount)
		throw new Error('initialCount must be less than maxCount');
	if(this.sharedObjects.hasOwnProperty(this.prefixSemaphore+object))
		return this.sharedObjects[this.prefixSemaphore+object];
	else{
		this.sharedObjects[this.prefixSemaphore+object] = new Semaphore(object, this.prefixSemaphore, initialCount, maxCount, sharedConnection, this.client, this.subscriber);
		return this.sharedObjects[this.prefixSemaphore+object];
	}
};

_.getMutex = function(object, timeout){
	if(this.sharedObjects.hasOwnProperty(this.prefixMutex+object))
		return this.sharedObjects[this.prefixMutex+object];
	else{
		this.sharedObjects[this.prefixMutex+object] = new Mutex(object, this.prefixMutex, this.client, this.subscriber, timeout);
		return this.sharedObjects[this.prefixMutex+object];
	}
};

function Semaphore(object, prefix, initialCount, maxCount, sharedConnection, client, subscriber) {
	this.subscriber = subscriber;
	this.sharedConnection = sharedConnection;
	this.prefix = prefix;
	this.initialCount = initialCount;
	this.maxCount = maxCount;
	this.client = client;
	this.object = object;
	this.observingList = [];
	this.waitingList = [];
	this.channel = 'relSem';
	this.subscriber.subscribe(this.channel);
	this.subscriber.on('message', this.onRel.bind(this));
};

Semaphore.prototype._get = function(client, cb){
	var that = this;
	client.watch(that.prefix+that.object);
	client.get(that.prefix+that.object, function(err, reply) {
		if(err) {
			client.unwatch();
			cb(err, 0);
		} else if(reply < that.maxCount || reply === null) {		
			var multi = client.multi();					
			if(reply === null)
				multi.set(that.prefix+that.object,that.initialCount + 1);
			else
				multi.incr(that.prefix+that.object);
			multi.exec(function(err, result){	
				if(err){
					cb(err, 0);					
				}
				else if(!result){
					cb(null, -1);
				}
				else{			
					cb(null, 1);
				}
			});
		} else {
			client.unwatch();			
			cb(null, 0);
		}
	});
};

Semaphore.prototype.get = function(cb){ // timeout : sec.
	var that = this;
	if(that.sharedConnection){
		var redisHelper = new RedisConnector(that.client.options, function(err, redisClient){
			if(err){
				cb(err, false);
			}
			else
				that._get(redisClient, function(err, result){
					redisClient.quit();
					cb(err, result);
				});
		});
	}
	else
		that._get(that.client, cb);
};

Semaphore.prototype.check = function(cb){
	var that = this;	
	that.client.get(that.prefix+that.object, function(err, reply) {
		if(err) 
			cb(err, null);
		else 
			cb(null, reply > 0);
	});
};

Semaphore.prototype.onRel = function(channel, message){
	var that = this;
	if(channel != that.channel || message != that.object)
		return;

	while(that.waitingList.length > 0){
		var waitingObj = that.waitingList.pop();
		clearTimeout(waitingObj.timer);
		that.waitingFor(waitingObj.timeout, waitingObj.cb);
	}
	
	while(that.observingList.length > 0){
		var waitingObj = that.observingList.pop();
		clearTimeout(waitingObj.timer);
		waitingObj.cb(null, true);
	}
	
};

Semaphore.prototype.rel = function(cb){
	var that = this;	
	
	that.client.decr(that.prefix+that.object, function(err, result){	
		if(result >= 0)
			that.client.publish('relSem', that.object);
		else if(result < 0){
			that.client.set(that.prefix+that.object, 0);
			err = new Error('semaphore count can not be negative value : ' + result);
			if(!cb)
				throw err;
		}

		if(cb)
			cb(err, result);
	});

};

Semaphore.prototype.observing = function(timeout, cb){
	var that = this;
	that.check(function(err, remained){
		if(!remained){
			that.observingList.push({
				cb : cb,
				timer : setTimeout(function() {
					for (var i = that.observingList.length-1 ; i >= 0 ; i--) {
						if (that.observingList[i].cb === cb) {
							that.observingList.splice(i, 1);
							break;
						}
					}
					cb(new Error('timedout'), false); 
				}, timeout * 1000)
			});
		}
		else
			cb(null, true);
	});
};

Semaphore.prototype.getStatus = function(cb){
	var that = this;
	
	that.client.get(that.prefix+that.object, function(err, reply) {
		cb(err, {
			observing : that.observingList.length,
			waiting : that.waitingList.length,
			count : Number(reply)
		});
	});
};

Semaphore.prototype.waitingFor = function(timeout, cb){
	var that = this;

	that.get(function(err, sem){
		if(err)
			cb(err, 0);
		else if(sem > 0)
			cb(null, sem);
		else if(sem === -1)
			that.waitingFor(timeout, cb);
		else {
			console.log('queued in waitingList');
			that.waitingList.unshift({
				cb : cb,
				timer : setTimeout(function() { 
					for (var i = that.waitingList.length-1 ; i >= 0 ; i--) {
						if (that.waitingList[i].cb === cb) {
							that.waitingList.splice(i, 1);
							break;
						}
					}
					cb(new Error('timedout'), null); 
				}, timeout * 1000)
			});
		}
	});
};


function Mutex(object, prefix, client, subscriber, timeout){
	this.subscriber = subscriber;
	this.prefix = prefix;
	this.timeout = timeout || 60;
	this.client = client;
	this.object = object;
	this.waitingList = [];
	this.observingList = [];
	this.channel = 'relMutex';
	this.subscriber.subscribe(this.channel);
	this.subscriber.on('message', this.onRel.bind(this));
};

Mutex.prototype.__proto__ = EventEmitter.prototype;


Mutex.prototype.get = function(cb){
	var that = this,
		muid = uuid.v1();
	that.client.setnx(that.prefix + that.object, muid, function(err, result){
		if(err){
			cb(err, null);
		}
		else if(result == 1){
			that.client.expire(that.prefix+that.object, that.timeout, function(){
				that.timer = setTimeout(function(){
					var _muid = muid;
					that.emit('expired', _muid);
				}, that.timeout * 1000);				
				cb(null, muid);
			});
		}
		else
			cb(null, null);
	});
};

Mutex.prototype.rel = function(muid, cb){
	var that = this;
	
	that.client.get(that.prefix+that.object, function(err, reply){
		if(muid != reply && cb)
			cb(new Error('Access denied'), false);
		else if(muid == reply){
			that.client.del(that.prefix + that.object, function(err, result){
				if(!err){
					clearTimeout(that.timer);
					that.client.publish('relMutex', that.object);
				}
				if(cb)
					cb(err, result > 0);
			});
		}
	});
};

Mutex.prototype.onRel = function(channel, message){
	var that = this;

	if(channel != that.channel || message != that.object)
		return;

	while(that.waitingList.length > 0){
		var waitingObj = that.waitingList.pop();
		clearTimeout(waitingObj.timer);
		that.waitingFor(waitingObj.timeout, waitingObj.cb);
	}
	
	while(that.observingList.length > 0){
		var waitingObj = that.observingList.pop();
		clearTimeout(waitingObj.timer);
		waitingObj.cb(null, true);
	}
	
};

Mutex.prototype.check = function(cb){
	var that = this;	
	that.client.get(that.prefix+that.object, function(err, reply) {
		if(err) 
			cb(err, null);
		else 
			cb(null, reply != null);
	});
};

Mutex.prototype.observing = function(timeout, cb){
	var that = this;
	that.check(function(err, isLocked){
		if(isLocked){
			that.observingList.push({
				cb : cb,
				timer : setTimeout(function() {
					for (var i = that.observingList.length-1 ; i >= 0 ; i--) {
						if (that.observingList[i].cb === cb) {
							that.observingList.splice(i, 1);
							break;
						}
					}
					cb(new Error('timedout'), false); 
				}, timeout * 1000)
			});
		}
		else
			cb(null, true);
	});
};

Mutex.prototype.waitingFor = function(timeout, cb){
	var that = this;
	that.get(function(err, result){
		if(result)
			cb(null, result);
		else{
			that.waitingList.unshift({
				cb : cb,
				timer : setTimeout(function() { 
					for (var i = that.waitingList.length-1 ; i >= 0 ; i--) {
						if (that.waitingList[i].cb === cb) {
							that.waitingList.splice(i, 1);
							break;
						}
					}
					cb(new Error('timedout'), null); 
				}, timeout * 1000)
			});
		}
	});
};

Mutex.prototype.getStatus = function(cb){
	var that = this;
	
	that.client.get(that.prefix+that.object, function(err, reply) {
		cb(err, {
			observing : that.observingList.length,
			waiting : that.waitingList.length,
			value : reply
		});
	});
};
