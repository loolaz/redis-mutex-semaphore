'use strict';

var EventEmitter = require('events'),
	util = require('util'),
	uuid = require('uuid'),
	Promise = require('bluebird');

if (typeof EventEmitter !== 'function') {
    EventEmitter = EventEmitter.EventEmitter;
}

function SharedObject(object, prefix, client, subscriber) {
	this.subscriber = subscriber;
	this.key = prefix + object;
	this.client = client;
	this.observingList = [];
	this.waitingList = {};
	this.request = {};
	this.prefixBroadcast = "broadcast:";
	this.broadcastPattern = new RegExp(this.prefixBroadcast);
	this.prefixRequest = this.prefixBroadcast + "request:";
	this.prefixResponse = this.prefixBroadcast + "response:";
	this.prefixInfo = this.prefixBroadcast + "info:";
	this.subscriber.subscribe(this.prefixRequest + this.key);
	this.subscriber.subscribe(this.prefixResponse + this.key);
	this.subscriber.subscribe(this.prefixInfo + this.key);
	this.subscriber.subscribe(this.key);
	this.subscriber.on('message', this.onMessage.bind(this));
	EventEmitter.call(this);
}

module.exports = SharedObject;

util.inherits(SharedObject, EventEmitter);

SharedObject.prototype.resetWithPublish = function(cb){
	var that = this;
	if(cb && typeof cb === "function"){
		that.reset(function(err, result){
			if(result){
				that._publish(that.key, {
					name : 'reset',
					count : -1
				});
			}
			cb(err, result);
		});
	}
	else{
		return that.reset().then(function(result){
			if(result){
				that._publish(that.key, {
					name : 'reset',
					count : -1
				});
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
	var that = this,
		count = 0,
		sortedKeys = Object.keys(that.waitingList).sort(function(a, b){
			return parseInt(a, 10) > parseInt(b, 10);
		}),
		scheduling = function(priority, waitingObj){
			if(priority === 0){
				that.makeWaitingFunc(priority)(waitingObj.timeout, waitingObj.cb, waitingObj._cb, true);
			}
			else{
				setTimeout(function(){
					that.makeWaitingFunc(priority)(waitingObj.timeout, waitingObj.cb, waitingObj._cb, true);					
				}, priority);				
			}
		};

	sortedKeys.some(function(key){
		while(that.waitingList[key].length > 0){
			var waitingObj = that.waitingList[key].pop();
			clearTimeout(waitingObj.timer);
			scheduling(parseInt(key, 10), waitingObj);
			count++;
			if(count >= message.count && message.count !== -1){
				return true;
			}
		}
	});
	
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

SharedObject.prototype._caculateWaitingCount = function(){
	var totalWaitingCount = 0;
	for(var key in this.waitingList){
		if({}.hasOwnProperty.call(this.waitingList, key))
			totalWaitingCount += this.waitingList[key].length;
	}
	return totalWaitingCount;
};

SharedObject.prototype.onBroadcast = function(channel, message){
	var that = this;
	if(channel === (that.prefixResponse + that.key) && {}.hasOwnProperty.call(that.request, message.token)){
		that.request[message.token].response.observing += message.observing;
		that.request[message.token].response.waiting += message.waiting;
	}
	else if(channel === (that.prefixRequest + that.key) && !{}.hasOwnProperty.call(that.request, message.token)){
		that._publish(that.prefixResponse + that.key, {
			name : 'getstatus_response',
			token : message.token,
			observing : that.observingList.length,
			waiting : that._caculateWaitingCount()
		});
	}
};

SharedObject.prototype.onMessage = function(channel, message){
	var that = this,
		jsonMessage = JSON.parse(message);
	if(channel === that.key){
		that.onRel(channel, jsonMessage);
		that.emit(jsonMessage.name, jsonMessage.count);
	}
	else if(that.broadcastPattern.test(channel)) {
		that.onBroadcast(channel, jsonMessage);
		if(channel === (that.prefixInfo + that.key)){
			that.emit(jsonMessage.name, jsonMessage.value);
		}
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
						var timedOutError = new Error('observing timeout');
						timedOutError.code = 'ETIMEDOUT';
						if(_cb)
							_cb(timedOutError); 
						else
							cb(timedOutError, false);
					}, timeout * 1000)
				});				
			}
			else{
				if(_cb){
					return cb(true);
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

SharedObject.prototype.getStatus = function(timeout, cb, _cb){ /* mil sec. */
	var that = this;
	if(typeof timeout === "function"){
		_cb = cb;
		cb = timeout;
		timeout = undefined;
	}

	if(cb && typeof cb === "function"){
		var token = uuid.v4();
		that.client.getAsync(that.key).then(function(reply){
			that.request[token] = {};
			that.request[token].response = {
				observing : 0,
				waiting : 0,
				value : 0
			};
			that.request[token].response.value = reply;
			that.request[token].timer = setTimeout(function() {
				var totalWaitingCount = that._caculateWaitingCount();
				that.request[token].response.observing += that.observingList.length;
				that.request[token].response.waiting += totalWaitingCount;
				that.request[token].response.observingLocal = that.observingList.length;
				that.request[token].response.waitingLocal = totalWaitingCount;					
				that.request[token].response.value = isNaN(that.request[token].response.value) ? that.request[token].response.value : parseInt(that.request[token].response.value, 10);
				var responseClone = JSON.parse(JSON.stringify(that.request[token].response));
				delete that.request[token];
				if(_cb){
					return cb(responseClone);
				}
				else{
					return cb(null, responseClone);
				}
			}, timeout || 1500);
			that._publish(that.prefixRequest + that.key, {
				name : 'qetstatus_request',
				token : token
			});

		}).catch(function(err){
			delete that.request[token];
			if(_cb){
				return _cb(err);
			}
			else{
				return cb(err, false);
			}
		});
	}
	else{
		return new Promise(function(resolve, reject){
			that.getStatus(timeout, resolve, reject);
		});
	}
};

SharedObject.prototype.makeWaitingFunc = function(priori){
	var that = this;

	return function(timeout, cb, _cb, pushback){		
		if(cb && typeof cb === "function"){
			var p = that.get(); 
			p.then(function(result){
				if(result){
					if(_cb){
						return cb(result);
					}
					else{
						return cb(null, result);
					}
				}
				else{
					if(!{}.hasOwnProperty.call(that.waitingList, priori)){
						that.waitingList[priori] = [];			
					}
					var waitingObj = {
						cb : cb,
						_cb : _cb,
						timeout : timeout,
						timer : setTimeout(function() { 
							for (var i = that.waitingList[priori].length-1 ; i >= 0 ; i--) {
								if (that.waitingList[priori][i].cb === cb) {
									that.waitingList[priori].splice(i, 1);
									break;
								}
							}
							var timedOutError = new Error('waiting timeout');
							timedOutError.code = 'ETIMEDOUT';
							if(_cb){
								_cb(timedOutError);
							}
							else{
								cb(timedOutError, null); 
							}
						}, timeout * 1000)
					};
					if(pushback)
						that.waitingList[priori].push(waitingObj);
					else
						that.waitingList[priori].unshift(waitingObj);
				}
			}).catch(function(err){
				if(err === -1){
					that.makeWaitingFunc(priori)(timeout, cb, _cb);
				}
				else if(_cb){
					return _cb(err);
				}
				else{
					return cb(err, null);
				}
			});
		}
		else{
			return new Promise(function(resolve, reject){
				that.makeWaitingFunc(priori)(timeout, resolve, reject);
			});
		}
	};
};

SharedObject.prototype.setDefaultPriority = function(priority){
	this.defautPriority = priority;
};

SharedObject.prototype.waitingFor = function(timeout, cb, _cb){
	return this.makeWaitingFunc(this.defautPriority)(timeout, cb, _cb);
};

SharedObject.prototype.waitingForWithPriority = function(priori, timeout, cb, _cb){
	return this.makeWaitingFunc(priori)(timeout, cb, _cb);
};

SharedObject.prototype._publish = function(channel, message){
	if(this.client.connected)
		this.client.publish(channel, JSON.stringify(message));	
};
