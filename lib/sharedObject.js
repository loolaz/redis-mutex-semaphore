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
	this.subscriber.subscribe(this.key);
	this.subscriber.on('message', this.onRel.bind(this));
};

SharedObject.prototype.__proto__ = EventEmitter.prototype;

SharedObject.prototype.reset = function(){
	var that = this;
	that.client.del(that.key);
	while(that.waitingList.length > 0){
		var waitingObj = that.waitingList.pop();
		clearTimeout(waitingObj.timer);
	}
	
	while(that.observingList.length > 0){
		var waitingObj = that.observingList.pop();
		clearTimeout(waitingObj.timer);
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
	if(channel != that.key)
		return;

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

SharedObject.prototype.observing = function(timeout, cb, _cb, checkFn){
	var that = this;

	if(cb && typeof cb === "function"){
		var p = that.check();
		p.then(function(remained){
			if(checkFn(remained)){
				that.observingList.push({
					cb : cb,
					_cb : _cb,
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

SharedObject.prototype.getStatus = function(cb){
	var that = this,
		p = that.client.getAsync(that.key);

	if(cb && typeof cb === "function"){
		p.then(function(reply){
			cb(null, {
				observing : that.observingList.length,
				waiting : that.waitingList.length,
				value : reply		
			});
		}).catch(function(err){
			cb(err, null);
		});
	}
	else{
		return p.then(function(reply){
			return Promise.resolve({
				observing : that.observingList.length,
				waiting : that.waitingList.length,
				value : reply
			});
		})
	}
};

SharedObject.prototype.waitingFor = function(timeout, cb, _cb, delegate){
	var that = this;
	
	if(cb && typeof cb === "function"){
		var p = that.get(); 
		p.then(function(sem){
			if(!delegate(sem)){
//				console.log('queued in waitingList');
				that.waitingList.unshift({
					cb : cb,
					_cb : _cb,
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
					}, timeout * 1000)
				});				
			}
		}).catch(function(err){
			if(_cb){
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