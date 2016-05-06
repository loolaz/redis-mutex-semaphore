'use strict';

var async = require('async'),
	Promise = require('bluebird'),
	redis= require('redis'),
	testSemaphoreKey = 'testObjectSem',
	testMutexKey = 'testObjectMutex',
	factoryList = [],
	options = {
		host: '127.0.0.1',
		port: 6379,
		db: 1
	};

describe('redis shared object test', function(){
	var RedisSharedObject = require('../lib');
	var initCount = 0;
	it('initialize', function(done){

		for(var i = 0; i < 50; i++){
			var factory = RedisSharedObject(options);
			factory.createSemaphoreClient(testSemaphoreKey, 3).then(function(result){
				++initCount;
				if(initCount === 100)
					done();
			});
			factory.createMutexClient(testMutexKey, 10).then(function(result){
				++initCount;
				if(initCount === 100)
					done();
			});
			factoryList.push(factory);
		}
	});

	it('semaphore callback', function(done){
		var j = 0;
		var s = Date.now();
		for(var i =0 ; i < 50 ; i++){
			var redisSemaphoreClient = factoryList[i].getSemaphoreClient(testSemaphoreKey);
			redisSemaphoreClient.waitingFor(100, function(err, result){
				if(result){
					j++;
					console.log(' accquire : (' + j + ')');
					if(j === 50){
						console.log('time : ' + (Date.now() - s));
						done();
					}
					setTimeout(function(){
						redisSemaphoreClient.rel(function(err, result){
							if(err)
								console.log(err);
							else
								console.log('release : ' + result);
						});
					}, 500); 					
				}
				else if(err){
					console.log(err);
					done();
				}

			});
		}
		//done();
	}, 120000);

	it('semaphore promise', function(done){
		var j = 0;
		var s = Date.now();
		for(var i =0 ; i < 50 ; i++){
			var redisSemaphoreClient = factoryList[i].getSemaphoreClient(testSemaphoreKey);
			redisSemaphoreClient.waitingFor(100).then(function(result){
				if(result){
					j++;
					console.log(' accquire : (' + j + ')');
					if(j === 50){
						console.log('time : ' + (Date.now() - s));
						done();
					}					
				}
			}).delay(500).then(function(){
				return redisSemaphoreClient.rel().then(function(result){
					console.log('release : ' + result);
				});
			}).catch(function(err){
				console.log('err : ' + err);
			});

		}
	}, 120000);

	it('mutex callback', function(done){
		var j = 0;
		var s = Date.now();
		for(var i =0 ; i < 50 ; i++){
			var redisMutexClient = factoryList[i].getMutexClient(testMutexKey);
			redisMutexClient.waitingFor(100, function(err, id){
				if(id){
					j++;
					console.log(' lock(' + j + ') : ' + id);
					if(j === 50){
						console.log('time : ' + (Date.now() - s));
						done();
					}
					setTimeout(function(){
						redisMutexClient.rel(id, function(err, result){
							if(err)
								console.log('err : ' + err);
							else
								console.log('unlock : ' + result);
						});
					}, 500); 					
				}
				else if(err){
					console.log(err);
					done();
				}

			});
 
		}
	}, 120000);

	it('mutex promise', function(done){
		var j = 0;
		var s = Date.now();
		for(var i =0 ; i < 50 ; i++){
			var redisMutexClient = factoryList[i].getMutexClient(testMutexKey);
			redisMutexClient.waitingFor(100).then(function(id){
				if(id){
					j++;
					console.log(' lock : (' + j + ') : ' + id);
					if(j === 50){
						console.log('time : ' + (Date.now() - s));
						done();
					}					
					return Promise.resolve(id);
				}
			}).delay(500).then(function(id){
				return redisMutexClient.rel(id).then(function(result){
					console.log('unlock : ' + result);
				});
			}).catch(function(err){
				console.log('err : ' + err);
			});

		}
	}, 120000);

	it('finalize', function(done){
		setTimeout(function(){
			for(var i = 0; i < 50; i++){
				factoryList[i].end();
			}
			done();
		}, 3000);
	}, 10000);

});