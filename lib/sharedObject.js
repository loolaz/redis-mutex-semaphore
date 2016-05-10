'use strict';

var EventEmitter = require('events').EventEmitter,
	Promise = require('bluebird');

module.exports = SharedObject;

function SharedObject(object, prefix, client, subscriber) {
	this.subscriber = subscriber;
	this.key = prefix + object;
	this.client = client;
	this.observingList = [];
	this.waitingList = {};
	this.request = {};
	this.priority = 0;
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
				that._publish(that.key, {
					message : 'reset',
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
					message : 'reset',
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
		sortedKeys = Object.keys(that.waitingList).sort(),
		scheduling = function(priority, waitingObj){
			if(priority === 0){
				that.makeWaitingFunc(priority)(waitingObj.timeout, waitingObj.cb, waitingObj._cb);
			}
			else{
				setTimeout(function(){
					that.makeWaitingFunc(priority)(waitingObj.timeout, waitingObj.cb, waitingObj._cb);					
				}, priority);				
			}
		};
	sortedKeys.some(function(key){
		while(that.waitingList[key].length > 0){
			var waitingObj = that.waitingList[key].pop();
			clearTimeout(waitingObj.timer);
			scheduling(parseInt(key), waitingObj);
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

SharedObject.prototype.onBroadcast = function(channel, message){
	var that = this;
	if(channel == (that.prefixResponse + that.key) && that.request.hasOwnProperty(message.token)){
		that.request[message.token].response.observing += message.observing;
		that.request[message.token].response.waiting += message.waiting;
	}
	else if(channel == (that.prefixRequest + that.key) && !that.request.hasOwnProperty(message.token)){
		var totalWaitingCount = 0;
		for(var key in that.waitingList){
			totalWaitingCount += that.waitingList[key].length;
		}
		that._publish(that.prefixResponse + that.key, {
			message : 'getstatus_response',
			token : message.token,
			observing : that.observingList.length,
			waiting : totalWaitingCount
		});
	}
};

SharedObject.prototype.onMessage = function(channel, message){
	var that = this,
		jsonMessage = JSON.parse(message);
	if(channel == that.key){
		that.onRel(channel, jsonMessage);
	}
	else if(that.broadcastPattern.test(channel)) {
		that.onBroadcast(channel, jsonMessage);
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
						var err = new Error('observing timeout');
						err.code = 'ETIMEDOUT';
						if(_cb)
							_cb(err); 
						else
							cb(err, false);
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
				var totalWaitingCount = 0;
				for(var key in that.waitingList){
					totalWaitingCount += that.waitingList[key].length;
				}
				that.request[token].response.observing += that.observingList.length;
				that.request[token].response.waiting += totalWaitingCount;
				that.request[token].response.observingLocal = that.observingList.length;
				that.request[token].response.waitingLocal = totalWaitingCount;					
				that.request[token].response.value = isNaN(that.request[token].response.value) ? that.request[token].response.value : parseInt(that.request[token].response.value);
				if(_cb){
					cb(that.request[token].response);
				}
				else{
					cb(null, that.request[token].response);
				}
				delete that.request[token];
			}, timeout || 1500);
			that._publish(that.prefixRequest + that.key, {
				message : 'qetstatus_request',
				token : token
			});

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

SharedObject.prototype.makeWaitingFunc = function(priori){
	var that = this;

	return function(timeout, cb, _cb){
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
					if(!that.waitingList.hasOwnProperty(priori)){
						that.waitingList[priori] = [];			
					}
					that.waitingList[priori].unshift({
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
							var err = new Error('waiting timeout');
							err.code = 'ETIMEDOUT';
							if(_cb){
								_cb(err);
							}
							else{
								cb(err, null); 
							}
						}, timeout * 3000)
					});
				}
			}).catch(function(err){
				if(err === -1){
					that.makeWaitingFunc(priori)(timeout, cb, _cb);
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
				that.makeWaitingFunc(priori)(timeout, resolve, reject);
			});
		}
	};
};

SharedObject.prototype.setDefaultPriority = function(priority){
	this.priority = priority;
};

SharedObject.prototype.waitingFor = function(timeout, cb, _cb){
	return this.makeWaitingFunc(this.priority)(timeout, cb, _cb);
};

SharedObject.prototype.waitingForWithPriority = function(priori, timeout, cb, _cb){
	return this.makeWaitingFunc(priori)(timeout, cb, _cb);
};

SharedObject.prototype._publish = function(channel, message){
	if(this.client.connected)
		this.client.publish(channel, JSON.stringify(message));	
};
