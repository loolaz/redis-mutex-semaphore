'use strict';

var async = require('async'),
	Promise = require('bluebird'),
	redis= require('redis'),
	testSemaphoreKey = 'testObjectSem',
	testMutexKey = 'testObjectMutex',
	factoryList = [];

describe('basic scenario test', function(){
	var RedisSharedObject = require('../lib');
	var initCount = 0;
	it('initialize', function(done){
		for(var i = 0; i < 10; i++){
			var factory = RedisSharedObject();
			factory.createSemaphoreClient(testSemaphoreKey, 3).then(function(result){
				++initCount;
				if(initCount === 20){
					console.log('0. Object factories initialized');
					setTimeout(function(){
						done();
					}, 1500);
				}
			}).catch(function(err){
				console.log(err);
			});
			factory.createMutexClient(testMutexKey, 10).then(function(result){
				++initCount;
				if(initCount === 20){
					console.log('0. Object factories initialized');
					setTimeout(function(){
						done();
					}, 1500);
				}
			}).catch(function(err){
				console.log(err);
			});
			factoryList.push(factory);
		}
	});

	it('exceptional case', function(done){
		console.log('1. semaphore key has been accidently deleted');
		var redisSemaphoreClient = factoryList[0].getSemaphoreClient(testSemaphoreKey);
		redisSemaphoreClient.client.del("sema:testObjectSem", function(err, result){	
			redisSemaphoreClient.get(function(err, result){
				expect(err.code).toEqual('ENOTFOUNDKEY');
				redisSemaphoreClient.client.set("sema:testObjectSem", 3, function(err, result){
					done();
				});
			});
		});

	//done();
	}, 120000);

	it('semaphore exceeds maxcount - callback', function(done){
		console.log('2. semaphore exceeds semaphore\'s max count and return EMAXCOUNT error');
		var redisSemaphoreClient = factoryList[0].getSemaphoreClient(testSemaphoreKey);
		redisSemaphoreClient.rel(function(err, result){
			expect(err.code).toEqual('EMAXCOUNT');
			done();
		});
	//done();
	}, 120000);

	it('semaphore exceeds maxcount - promise', function(done){
		console.log('3. semaphore exceeds semaphore\'s max count and return EMAXCOUNT error');
		var redisSemaphoreClient = factoryList[0].getSemaphoreClient(testSemaphoreKey);
		redisSemaphoreClient.rel().catch(function(err){
			expect(err.code).toEqual('EMAXCOUNT');
			done();
		});
	//done();
	}, 120000);

	it('semaphore callback', function(done){
		var j = 0;
		var s = Date.now();
		for(var i =0 ; i < 10 ; i++){
			var redisSemaphoreClient = factoryList[i].getSemaphoreClient(testSemaphoreKey);
			redisSemaphoreClient.waitingFor(100, function(err, result){
				if(result){
					j++;
					console.log('... accquire : (' + j + ')');
					if(j === 10){
						console.log('4. Testing semaphore with callback has been done by ' + (Date.now() - s));
						done();
					}
					setTimeout(function(){
						redisSemaphoreClient.rel(function(err, result){
							if(err)
								console.log('... err : ' + err);
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
		for(var i =0 ; i < 10 ; i++){
			var redisSemaphoreClient = factoryList[i].getSemaphoreClient(testSemaphoreKey);
			redisSemaphoreClient.waitingFor(100).then(function(result){
				if(result){
					j++;
					console.log('... accquire : (' + j + ')');
					if(j === 10){
						console.log('5. Testing semaphore with promise has been done by ' + (Date.now() - s));
						done();
					}					
				}
			}).delay(500).then(function(){
				return redisSemaphoreClient.rel();
			}).catch(function(err){
				console.log('... err : ' + err);
			});

		}
	}, 120000);

	it('mutex callback', function(done){
		var j = 0;
		var s = Date.now();
		for(var i =0 ; i < 10 ; i++){
			var redisMutexClient = factoryList[i].getMutexClient(testMutexKey);
			redisMutexClient.waitingFor(100, function(err, id){
				if(id){
					j++;
					console.log('... lock(' + j + ') : ' + id);
					if(j === 10){
						console.log('6. Testing mutex with callback has been done by ' + (Date.now() - s));
						done();
					}
					setTimeout(function(){
						redisMutexClient.rel(id, function(err, result){
							if(err)
								console.log('... err : ' + err);
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
		for(var i =0 ; i < 10 ; i++){
			var redisMutexClient = factoryList[i].getMutexClient(testMutexKey);
			redisMutexClient.waitingFor(100).then(function(id){
				if(id){
					j++;
					console.log('... lock : (' + j + ') : ' + id);
					if(j === 10){
						console.log('7. Testing mutex with promise has been done by ' + (Date.now() - s));
						done();
					}					
					return Promise.resolve(id);
				}
			}).delay(500).then(function(id){
				return redisMutexClient.rel(id).then();
			}).catch(function(err){
				console.log('... err : ' + err);
			});

		}
	}, 120000);

	it('finalize', function(done){
		setTimeout(function(){
			for(var i = 0; i < 10; i++){
				factoryList[i].end();
			}
		}, 6000);
		setTimeout(function(){
			console.log('8. Object factories have been finalized');
			done();
		}, 6000);
	}, 14000);

});