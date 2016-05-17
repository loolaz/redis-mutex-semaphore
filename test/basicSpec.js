'use strict';

var async = require('async'),
	Promise = require('bluebird'),
	redis= require('redis'),
	testSemaphoreKey = 'basicTestObjectSem',
	testMutexKey = 'basicTestObjectMutex',
	factoryList = [];

describe('basic scenario test', function(){
	var RedisSharedObject = require('../lib'),
		initCount = 0,
		eventCountSemaphoreAcquired = 0,
		eventCountSemaphoreReleased = 0,
		eventCountMutexLocked = 0, 
		eventCountMutexUnlocked = 0,
		flag1 = false, flag2 = false;
	it('0. Object factories initialized', function(done){
		for(var i = 0; i < 10; i++){
			var factory = RedisSharedObject();
			factory.createSemaphoreClient(testSemaphoreKey, 3).then(function(result){
				if(!flag1){
					flag1 = true;
					result.on('semaphore_acquired', function(count){
						++eventCountSemaphoreAcquired;
					});
					result.on('semaphore_released', function(count){
						++eventCountSemaphoreReleased;
					});
				}

				++initCount;
				if(initCount === 20){
					setTimeout(function(){
						done();
					}, 1500);
				}
			}).catch(function(err){
				console.log(err);
			});
			factory.createMutexClient(testMutexKey, 10).then(function(result){
				if(!flag2){
					flag2 = true;
					result.on('mutex_locked', function(muid){
						++eventCountMutexLocked;
					});
					result.on('mutex_unlocked', function(){
						++eventCountMutexUnlocked;
					});
				}
				++initCount;
				if(initCount === 20){
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

	it('1. Testing semaphore with callback', function(done){
		var j = 0;
		for(var i =0 ; i < 10 ; i++){
			(function(){
				var redisSemaphoreClient = factoryList[i].getSemaphoreClient(testSemaphoreKey);

				redisSemaphoreClient.waitingFor(100, function(err, result){
					if(result){
						j++;
						console.log('... accquire : (' + j + ')');
						if(j === 10){
							setTimeout(function(){
								expect(eventCountSemaphoreAcquired).toEqual(10);
								expect(eventCountSemaphoreReleased).toEqual(10);
								done();
							}, 1000);
						}
						setTimeout(function(){
							redisSemaphoreClient.rel(function(err, result){
								if(err)
									console.log('... err : ' + err);
							});
						}, 100); 					
					}
					else if(err){
						console.log(err);
						done();
					}

				});
			})(i);
		}
		//done();
	}, 120000);

	it('2. Testing semaphore with promise', function(done){
		var j = 0;
		eventCountSemaphoreAcquired = 0; 
		eventCountSemaphoreReleased = 0;
		for(var i =0 ; i < 10 ; i++){
			(function(){
				var redisSemaphoreClient = factoryList[i].getSemaphoreClient(testSemaphoreKey);
				redisSemaphoreClient.waitingFor(100).then(function(result){
					if(result){
						j++;
						console.log('... accquire : (' + j + ')');
						if(j === 10){
							setTimeout(function(){
								expect(eventCountSemaphoreAcquired).toEqual(10);
								expect(eventCountSemaphoreReleased).toEqual(10);
								done();
							}, 1000);
						}					
					}
				}).delay(100).then(function(){
					return redisSemaphoreClient.rel();
				}).catch(function(err){
					console.log('... err : ' + err);
				});
			})(i);
		}
	}, 120000);

	it('3. Testing mutex with callback', function(done){
		var j = 0;
		for(var i =0 ; i < 10 ; i++){
			(function(){
				var redisMutexClient = factoryList[i].getMutexClient(testMutexKey);
				redisMutexClient.waitingFor(100, function(err, id){
					if(id){
						j++;
						console.log('... lock(' + j + ') : ' + id);
						if(j === 10){
							setTimeout(function(){
								expect(eventCountMutexLocked).toEqual(10);
								expect(eventCountMutexUnlocked).toEqual(10);
								done();
							}, 1000);						
						}
						setTimeout(function(){
							redisMutexClient.rel(id, function(err, result){
								if(err)
									console.log('... err : ' + err);
							});
						}, 100); 					
					}
					else if(err){
						console.log(err);
						done();
					}

				});
			})(i);
		}
	}, 120000);

	it('4. Testing mutex with promise', function(done){
		var j = 0;
		eventCountMutexLocked = 0;
		eventCountMutexUnlocked = 0;
		for(var i =0 ; i < 10 ; i++){
			(function(){
				var redisMutexClient = factoryList[i].getMutexClient(testMutexKey);
				redisMutexClient.waitingFor(100).then(function(id){
					if(id){
						j++;
						console.log('... lock : (' + j + ') : ' + id);
						if(j === 10){
							setTimeout(function(){
								expect(eventCountMutexLocked).toEqual(10);
								expect(eventCountMutexUnlocked).toEqual(10);
								done();
							}, 1000);	
						}					
						return Promise.resolve(id);
					}
				}).delay(100).then(function(id){
					return redisMutexClient.rel(id).then();
				}).catch(function(err){
					console.log('... err : ' + err);
				});
			})(i);

		}
	}, 120000);

	it('5. observing with promise', function(done){
		var redisMutexClient = factoryList[0].getMutexClient(testMutexKey);
		redisMutexClient.observing(100).then(function(result){
			expect(result).toEqual(true);
			done();
		})
	}, 120000);

	it('6. observing with callback', function(done){
		var redisMutexClient = factoryList[0].getMutexClient(testMutexKey);
		redisMutexClient.observing(100, function(err, result){
			expect(result).toEqual(true);
			done();
		})
	}, 120000);

	it('7. Object factories have been finalized', function(done){
		setTimeout(function(){
			for(var i = 0; i < 10; i++){
				factoryList[i].end();
			}
		}, 1000);
		setTimeout(function(){
			done();
		}, 2000);
	}, 14000);

});