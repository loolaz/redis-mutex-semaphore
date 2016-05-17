'use strict';

var async = require('async'),
	redis= require('redis'),
	redisSharedObject1,
	redisSharedObject2,
	muid,
	testSemaphoreKey = 'callbackTestObjectSem',
	testMutexKey1 = 'callbackTestObjectMutex1',
	testMutexKey2 = 'callbackTestObjectMutex2';

describe('complicated scenario test(callback)', function(){
	var RedisSharedObject = require('../lib'),
		isAnotherClientReceivedMutexExpiredEvent = false;
	it('0. Complicated scenario - callback version - test initialized', function(done){
		var options = {
				host : '127.0.0.1',
				port : 6379,
				db : 1
			},		
			client1 = redis.createClient(options.port, options.host, options),
			client2 = redis.createClient(options.port, options.host, options);
		redisSharedObject1 = RedisSharedObject(client1);
		redisSharedObject2 = RedisSharedObject(client2);

		redisSharedObject1.createSemaphoreClient(testSemaphoreKey, 3, function(err, result){
			if(err)
				console.log(err);
		});
		redisSharedObject1.createMutexClient(testMutexKey1, 10);

		redisSharedObject2.createSemaphoreClient(testSemaphoreKey, 3, function(err, result){
			if(err)
				console.log(err);			
		});
		redisSharedObject2.createMutexClient(testMutexKey1, 10);
		setTimeout( function(){ 
			done(); 
		}, 1500);
	});

	it('1. Three clients should accquire semaphores in sequence', function(done){
		var redisSemaphore1 = redisSharedObject1.getSemaphoreClient(testSemaphoreKey),
			redisSemaphore2 = redisSharedObject2.getSemaphoreClient(testSemaphoreKey);
		redisSemaphore1.get(function(err, sem){
			if(err)
				console.log(err);
			redisSemaphore1.get(function(err, sem){
				if(err)
					console.log(err);

				redisSemaphore2.get(function(err, sem){
					if(err)
						console.log(err);

					redisSemaphore1.check(function(err, result){
						expect(result).toEqual(false);
						redisSemaphore2.observing(6, function(err, result){
							console.log('... finished observing(1)');
						});						
						redisSemaphore1.getStatus(function(err, result){							
							expect(result.value).toEqual(0);
							done();
						});
					});
				});
			});
		});	
	}, 6000);

	it('2. Other three clients should accquire semaphores, and the other three still will wait', function(done){
		var redisSemaphore1 = redisSharedObject1.getSemaphoreClient(testSemaphoreKey),
			redisSemaphore2 = redisSharedObject2.getSemaphoreClient(testSemaphoreKey);		
		async.parallel([
			function(callback){
				redisSemaphore1.rel(function(err, result){
					if(err)
						console.log(err);
					else
						console.log('... released semaphore, current count : ' + result);
					callback(err, result);
				});					
			},
			function(callback){
				redisSemaphore1.rel(function(err, result){
					if(err)
						console.log(err);
					else
						console.log('... released semaphore, current count : ' + result);
					callback(err, result);
				});					
			},
			function(callback){
				redisSemaphore2.rel(function(err, result){
					if(err)
						console.log(err);
					else
						console.log('... released semaphore, current count : ' + result);
					callback(err, result);
				});					
			},				
			function(callback){
				redisSemaphore1.waitingFor(5, function(err, result){
					if(err)
						console.log(err);
					else
						console.log('... accquired semaphore(1)');
				});	
				callback(null, true);				
			},
			function(callback){
				redisSemaphore1.waitingFor(6, function(err, result){
					if(err)
						console.log(err);
					else
						console.log('... accquired semaphore(2)');
				});	
				callback(null, true);				
			},
			function(callback){
				redisSemaphore1.waitingFor(6, function(err, result){
					if(err)
						console.log(err);
					else
						console.log('... accquired semaphore(3)');
				});
				callback(null, true);					
			},
			function(callback){
				redisSemaphore2.waitingFor(6, function(err, result){
					if(err)
						console.log(err);
					else
						console.log('... accquired semaphore(4)');
				});		
				callback(null, true);			
			},
			function(callback){
				redisSemaphore2.waitingFor(6, function(err, result){
					if(err)
						console.log(err);
					else
						console.log('... accquired semaphore(5)');					
				});			
				callback(null, true);		
			},
			function(callback){
				redisSemaphore2.waitingFor(6, function(err, result){
					if(err)
						console.log(err);
					else
						console.log('... accquired semaphore(6)');					
				});		
				callback(null, true);			
			},
			function(callback){
				redisSemaphore2.observing(6, function(err, result){
					console.log('... finished observing(2)');
					callback(err, result);
				});					
			}
			],function(err, result){
				setTimeout( function(){ 
					redisSemaphore2.getStatus(function(err, result){
						var totalWaitingCount1 = 0,
							totalWaitingCount2 = 0;
						for(var key in redisSemaphore1.waitingList){
							totalWaitingCount1 += redisSemaphore1.waitingList[key].length;
						}
						for(var key in redisSemaphore2.waitingList){
							totalWaitingCount2 += redisSemaphore2.waitingList[key].length;
						}
						expect(result.value).toEqual(0);
						expect(totalWaitingCount1+totalWaitingCount2).toEqual(3);
						expect(redisSemaphore1.observingList.length+redisSemaphore2.observingList.length).toEqual(0);
						done();
					});
				}, 2000);
			}
		);

	}, 20000);

	it('3. Rest of clients should accquire semaphores', function(done){
		var redisSemaphore1 = redisSharedObject1.getSemaphoreClient(testSemaphoreKey),
			redisSemaphore2 = redisSharedObject2.getSemaphoreClient(testSemaphoreKey);		
		async.parallel([
			function(callback){
				redisSemaphore1.rel(function(err, result){
					if(err)
						console.log(err);
					else
						console.log('... released semaphore, current count : ' + result);
					callback(err, result);
				});					
			},
			function(callback){
				redisSemaphore2.rel(function(err, result){
					if(err)
						console.log(err);
					else
						console.log('... released semaphore, current count : ' + result);
					callback(err, result);
				});					
			},
			function(callback){
				redisSemaphore1.rel(function(err, result){
					if(err)
						console.log(err);
					else
						console.log('... released semaphore, current count : ' + result);
					callback(err, result);
				});					
			}
			],function(err, result){
				setTimeout(function(){
					redisSemaphore2.getStatus(function(err, result){
						var totalWaitingCount1 = 0,
							totalWaitingCount2 = 0;
						for(var key in redisSemaphore1.waitingList){
							totalWaitingCount1 += redisSemaphore1.waitingList[key].length;
						}
						for(var key in redisSemaphore2.waitingList){
							totalWaitingCount2 += redisSemaphore2.waitingList[key].length;
						}
						expect(result.value).toEqual(0);
						expect(totalWaitingCount1+totalWaitingCount2).toEqual(0);
						expect(redisSemaphore1.observingList.length+redisSemaphore2.observingList.length).toEqual(0);
						done();
					});
				}, 2000);
			}
		);

	}, 20000);

	it('- Mutex setup : One should get mutex, one should fail to lock', function(done){
		var redisMutex1 = redisSharedObject1.getMutexClient(testMutexKey1),
			redisMutex2 = redisSharedObject2.getMutexClient(testMutexKey1);
		async.parallel([
			function(callback){
				redisMutex1.get(function(err, result){
					if(err)
						console.log(err);
					else{
						console.log('... got mutex(1) : ' + result);
						if(result)
							muid = result;
					}
					callback(err, result);
				});					
			},
			function(callback){
				redisMutex2.get(function(err, result){
					if(err)
						console.log(err);
					else{
						console.log('... got mutex(2) : ' + result);
						if(result)
							muid = result;
					}
					callback(err, result);
				});					
			}
		], function(err, result){
			done();
		});
	});

	it('4. One will wait for mutext to be unlocked, and one will be timed out while waiting', function(done){
		var redisMutex1 = redisSharedObject1.getMutexClient(testMutexKey1),
			redisMutex2 = redisSharedObject2.getMutexClient(testMutexKey1);
		async.parallel([
			function(callback){
				redisMutex1.observing(8, function(err, released){
					if(err)
						console.log('... err while observing : ' + err);
					else{
						console.log('... finished observing');
					}
					
				});
				callback(null, true);
			},
			function(callback){
				redisMutex2.waitingFor(1, function(err, result){
					if(err)
						console.log('... err while waiting(3) : ' + err);
					else{
						console.log('... got mutex(3) : ' + result);
						if(result)
							muid = result;
					}
					expect(err.code).toEqual('ETIMEDOUT');
				});
				callback(null, true);					
			},
			function(callback){
				redisMutex2.observing(1, function(err, result){
					if(err)
						console.log('... err while observing : ' + err);
					else
						console.log('... finished observing' + result);
					expect(err.code).toEqual('ETIMEDOUT');
				});
				callback(null, true);				
			},
			function(callback){
				redisMutex1.waitingFor(8, function(err, result){
					if(err)
						console.log('... err while waiting(4) : ' + err);
					else{
						console.log('... got mutex(4) : ' + result);
						if(result)
							muid = result;
					}
					
				});
				callback(null, true);					
			}
			],function(err, result){

				setTimeout(function(){
					redisMutex1.getStatus(function(err, result){
						var totalWaitingCount1 = 0,
							totalWaitingCount2 = 0;
						for(var key in redisMutex1.waitingList){
							totalWaitingCount1 += redisMutex1.waitingList[key].length;
						}
						for(var key in redisMutex2.waitingList){
							totalWaitingCount2 += redisMutex2.waitingList[key].length;
						}
						expect(result.value).toEqual(muid);
						expect(totalWaitingCount1+totalWaitingCount2).toEqual(1);
						expect(redisMutex1.observingList.length+redisMutex2.observingList.length).toEqual(1);
						done();
					});
				}, 2000);

			}
		);

	}, 20000);

	it('5. First unlocking try should fail due to incorrect mutex id, but second try should succeed. In result, one can get a lock finally', function(done){
		var redisMutex1 = redisSharedObject1.getMutexClient(testMutexKey1),
			redisMutex2 = redisSharedObject2.getMutexClient(testMutexKey1);		
		async.parallel([
			function(callback){
				redisMutex1.rel('wrong_id', function(err, result){
					expect(err).not.toBe(null);
					if(err)
						console.log('... err while releasing : ' + err);
					redisMutex1.rel(muid, function(err, result){
						expect(result).toEqual(true);
						if(err)
							console.log('... err while releasing : ' + err);
						else if(result)
							console.log('... unlocked mutex');
						callback(err, result);
					});
				});						
			}
			],function(err, result){
				setTimeout(function(){
					redisMutex1.getStatus(function(err, result){
						var totalWaitingCount1 = 0,
							totalWaitingCount2 = 0;
						for(var key in redisMutex1.waitingList){
							totalWaitingCount1 += redisMutex1.waitingList[key].length;
						}
						for(var key in redisMutex2.waitingList){
							totalWaitingCount2 += redisMutex2.waitingList[key].length;
						}
						expect(result.value).not.toBe(null);
						expect(totalWaitingCount1+totalWaitingCount2).toEqual(0);
						expect(redisMutex1.observingList.length+redisMutex2.observingList.length).toEqual(0);
						done();
					});
				}, 2000);				
			}
		);

	}, 20000);

	it(' - another mutext client setup', function(done){
		RedisSharedObject().createMutexClient('callbackTestToBeExpired', 10).then(function(anotherClient){
			anotherClient.on('mutex_expired', function(result){
				isAnotherClientReceivedMutexExpiredEvent = true;
			});
			done();
		});

	});

	it('6. Mutex should be expired, and a waiting client should get another', function(done){
		var isLocalInstanceReceivedMutexExpiredEvent = false;
		redisSharedObject2.createMutexClient('callbackTestToBeExpired', 1, function(err, waitingClient){
			redisSharedObject1.createMutexClient('callbackTestToBeExpired', 1, function(err, toBeExpiredSoon){
				toBeExpiredSoon.on('expired', function(result){
					isLocalInstanceReceivedMutexExpiredEvent = true;
				});	
				toBeExpiredSoon.get(function(err, result){
					if(err)
						console.log('... err while waiting(5) : ' + err);
					else{
						console.log('... got mutex(5) : ' + result);
						muid = result;
						expect(result).not.toBe(null);
						waitingClient.waitingFor(10, function(err, result){
							expect(result).not.toBe(null);
							if(result)
								console.log('... previous lock has been expired, and got new one : ' + result);
							waitingClient.reset(function(err, result){
								expect(result).toEqual(true);
							});
						});
					}
					setTimeout(function(){
						expect(isAnotherClientReceivedMutexExpiredEvent).toEqual(true);
						expect(isLocalInstanceReceivedMutexExpiredEvent).toEqual(true);
						done();
					}, 2000);
				});

			});
		});
	}, 20000);

	it('7. Mutex timeout should be extended to 2 sec.', function(done){
		var isLocalInstanceReceivedMutexExpiredEvent = false;
		redisSharedObject1.createMutexClient('callbackTestToBeExpired', 1, function(err, toBeExpiredSoon){
			toBeExpiredSoon.on('expired', function(result){
				isLocalInstanceReceivedMutexExpiredEvent = true;
			});	
			toBeExpiredSoon.get(function(err, newid){
				if(err)
					console.log('... err while waiting(5) : ' + err);
				else{
					expect(toBeExpiredSoon.luaScripts.extend.sha).toEqual(undefined);
					toBeExpiredSoon.extend(newid, 1, function(err, result){
						expect(result).toEqual(true);
						expect(isLocalInstanceReceivedMutexExpiredEvent).toEqual(false);
					});
				}
				setTimeout(function(){
					expect(isLocalInstanceReceivedMutexExpiredEvent).toEqual(false);
					setTimeout(function(){
						expect(isLocalInstanceReceivedMutexExpiredEvent).toEqual(true);
						toBeExpiredSoon.get(function(err, newidAgain){
							expect(toBeExpiredSoon.luaScripts.extend.sha).not.toBe(null);
							toBeExpiredSoon.extend(newidAgain, 1, function(err, result){
								expect(result).toEqual(true);
								redisSharedObject1.end();
								redisSharedObject2.end();
								done();
							});
						});	
					}, 1500);
				}, 1500);
			});

		});
	}, 20000);

});

