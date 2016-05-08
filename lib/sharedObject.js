'use strict';

var EventEmitter = require('events').EventEmitter,
	Promise = require('bluebird');

module.exports = SharedObject;

function SharedObject(object, prefix, client, subscriber) {
	this.subscriber = subscriber;
	this.key = prefix + object;
	this.client = client;
	this.observingList = [];
	this.waitingList = [];
	this.request = {};
	this.prefixBroadcast = "broadcast:";
	this.broadcastPattern = new RegExp(this.prefixBroadcast);
	this.prefixRequest = this.prefixBroadcast + "request:";
	this.prefixResponse = this.prefixBroadcast + "response:";
	this.subscriber.subscribe(this.prefixRequest + this.key);
	this.subscriber.subscribe(this.prefixResponse + this.key);
	this.subscriber.subscribe(this.key);
	this.subscriber.on('message', this.onMessage.bind(this));
};

SharedObject.prototype.__proto__ = EventEmitter.prototype;

SharedObject.prototype.resetWithPublish = function(cb){
	var that = this;
	if(cb && typeof cb === "function"){
		that.reset(function(err, result){
			if(result){
				that._publish(that.key, 'semaphore_reset');
			}
			cb(err, result);
		});
	}
	else{
		return that.reset().then(function(result){
			if(result){
				that._publish(that.key, 'semaphore_reset');
			}
			return Promise.resolve(result);
		});
	}
};

SharedObject.prototype.check = function(cb, checkFn){
	var that = this,
		p = that.client.getAsync(that.key);
	if(cb && typeof cb === "function"){
		p.then(function(reply){
			cb(null, checkFn(reply));
		}).catch(function(err){
			cb(err, null);
		});
	}
	else{
		return p.then(function(reply){
			return Promise.resolve(checkFn(reply));
		});
	}
};

SharedObject.prototype.onRel = function(channel, message){
	var that = this;
	while(that.waitingList.length > 0){
		var waitingObj = that.waitingList.pop();
		clearTimeout(waitingObj.timer);
		that.waitingFor(waitingObj.timeout, waitingObj.cb, waitingObj._cb);
	}
	
	while(that.observingList.length > 0){
		var waitingObj = that.observingList.pop();
		clearTimeout(waitingObj.timer);
		if(waitingObj._cb){
			waitingObj.cb(true);
		}
		else{
			waitingObj.cb(null, true);
		}
	}

};

SharedObject.prototype.onBroadcast = function(channel, message){
	var that = this,
		jsonMessage = JSON.parse(message);
	if(channel == (that.prefixResponse + that.key) && that.request.hasOwnProperty(jsonMessage.token)){
		var otherStatus = JSON.parse(message);
		that.request[jsonMessage.token].response.observing += otherStatus.observing;
		that.request[jsonMessage.token].response.waiting += otherStatus.waiting;
	}
	else if(channel == (that.prefixRequest + that.key) && !that.request.hasOwnProperty(jsonMessage.token)){
		that._publish(that.prefixResponse + that.key, JSON.stringify({
			token : jsonMessage.token,
			observing : that.observingList.length,
			waiting : that.waitingList.length	
		}));
	}
};

SharedObject.prototype.onMessage = function(channel, message){
	var that = this;
	if(channel == that.key){
		that.onRel(channel, message);
	}
	else if(that.broadcastPattern.test(channel)) {
		that.onBroadcast(channel, message);
	}
};

SharedObject.prototype.observing = function(timeout, cb, _cb){
	var that = this;

	if(cb && typeof cb === "function"){
		var p = that.check();
		p.then(function(lockable){
			if(!lockable){
				that.observingList.push({
					cb : cb,
					_cb : _cb,
					timeout : timeout,
					timer : setTimeout(function() {
						for (var i = that.observingList.length-1 ; i >= 0 ; i--) {
							if (that.observingList[i].cb === cb) {
								that.observingList.splice(i, 1);
								break;
							}
						}
						if(_cb)
							_cb(new Error('timedout')); 
						else
							cb(new Error('timedout'), false);
					}, timeout * 1000)
				});				
			}
			else{
				if(_cb){
					cb(true);
				}
				else{
					cb(null, true);
				}
			}
		}).catch(function(err){
			if(_cb){
				_cb(err);
			}
			else{
				cb(err, false);
			}
		});
	}
	else{
		return new Promise(function(resolve, reject){
			that.observing(timeout, resolve, reject);
		});
	}
};

SharedObject.prototype.getStatus = function(timeout /* mil sec. */, cb, _cb){
	var that = this;
	if(typeof timeout === "function"){
		_cb = cb;
		cb = timeout;
		timeout = undefined;
	}

	if(cb && typeof cb === "function"){
		that.client.getAsync(that.key).then(function(reply){
			var token = require('uuid').v4();
			that.request[token] = {};
			that.request[token].response = {
				observing : 0,
				waiting : 0,
				value : 0
			};
			that.request[token].response.value = reply;
			that.request[token].timer = setTimeout(function() {
				that.request[token].response.observing += that.observingList.length;
				that.request[token].response.waiting += that.waitingList.length;
				that.request[token].response.observingLocal = that.observingList.length;
				that.request[token].response.waitingLocal = that.waitingList.length;					
				that.request[token].response.value = isNaN(that.request[token].response.value) ? that.request[token].response.value : parseInt(that.request[token].response.value);
				if(_cb){
					cb(that.request[token].response);
				}
				else{
					cb(null, that.request[token].response);
				}
				delete that.request[token];
			}, timeout || 1500);
			that._publish(that.prefixRequest + that.key, JSON.stringify({
				token : token
			}));

		}).catch(function(err){
			if(_cb){
				_cb(err);
			}
			else{
				cb(err, false);
			}
			delete that.request[token];
		});
	}
	else{
		return new Promise(function(resolve, reject){
			that.getStatus(timeout, resolve, reject);
		});
	}
};

SharedObject.prototype.waitingFor = function(timeout, cb, _cb, delegate){
	var that = this;

	if(cb && typeof cb === "function"){
		var p = that.get(); 
		p.then(function(result){
			if(result){
				if(_cb){
					cb(result);
				}
				else{
					cb(null, result);
				}
			}
			else{
				that.waitingList.unshift({
					cb : cb,
					_cb : _cb,
					timeout : timeout,
					timer : setTimeout(function() { 
						for (var i = that.waitingList.length-1 ; i >= 0 ; i--) {
							if (that.waitingList[i].cb === cb) {
								that.waitingList.splice(i, 1);
								break;
							}
						}
						if(_cb){
							_cb(new Error('timedout'));
						}
						else{
							cb(new Error('timedout'), null); 
						}
					}, timeout * 3000)
				});				
			}
		}).catch(function(err){
			if(err === -1){
				that.waitingFor(timeout, cb, _cb);
			}
			else if(_cb){
				_cb(err);
			}
			else{
				cb(err, 0);
			}
		});
	}
	else{
		return new Promise(function(resolve, reject){
			that.waitingFor(timeout, resolve, reject);
		});
	}
};

SharedObject.prototype._publish = function(channel, message){
	if(this.client.connected)
		this.client.publish(channel, message);	
};
