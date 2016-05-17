'use strict';

var async = require('async'),
Promise = require('bluebird'),
redis= require('redis'),
	redisSharedObject1,
	redisSharedObject2,
	muid,
	testSemaphoreKey = 'promiseTestObjectSem',
	testMutexKey1 = 'promiseTestObjectMutex1',
	testMutexKey2 = 'promiseTestObjectMutex2';

describe('complicated scenario test(promise)', function(){
	var RedisSharedObject = require('../lib');

	it('0. Complicated scenario - promise version - test initialized', function(done){
		redisSharedObject1 = RedisSharedObject();
		redisSharedObject2 = RedisSharedObject();

		redisSharedObject1.createSemaphoreClient(testSemaphoreKey, 3).then(function(client){
		});
		redisSharedObject1.createMutexClient(testMutexKey1, 10);

		redisSharedObject2.createSemaphoreClient(testSemaphoreKey, 3);
		redisSharedObject2.createMutexClient(testMutexKey1, 10);
		setTimeout( function(){ 
			done(); 
		}, 1500);
	});

	it('1. Three clients should accquire semaphores in sequence', function(done){
		var redisSemaphore1 = redisSharedObject1.getSemaphoreClient(testSemaphoreKey);
		redisSemaphore1.get()
		.then(function(result){
		}).then(function(){ 
			return redisSemaphore1.get();
		}).then(function(result){
		}).then(function(){
			return redisSemaphore1.get();
		}).then(function(result){
			redisSemaphore1.getStatus(function(err, result){
				expect(result.value).toEqual(0);
				console.log('... accquired three semaphore');
				done();
			});

		}).catch(function(err){
			console.log('... error :' + err);
			done();
		});
	}, 6000);

	it('2. Other three clients should accquire semaphores, and the other three still will wait', function(done){
		var redisSemaphore1 = redisSharedObject1.getSemaphoreClient(testSemaphoreKey),
			redisSemaphore2 = redisSharedObject2.getSemaphoreClient(testSemaphoreKey);		
		async.parallel([
			function(callback){
				redisSemaphore1.rel().then(function(result){
					console.log('... released semaphore, current count : ' + result);
					callback(null, result);
				}).catch(function(err){
					console.log(err);
					callback(err, null);
				});					
			},
			function(callback){
				redisSemaphore1.rel().then(function(result){
					console.log('... released semaphore, current count : ' + result);
					callback(null, result);
				}).catch(function(err){
					console.log(err);
					callback(err, null);
				});						
			},
			function(callback){
				redisSemaphore2.rel().then(function(result){
					console.log('... released semaphore, current count : ' + result);
					callback(null, result);
				}).catch(function(err){
					console.log(err);
					callback(err, null);
				});					
			},			
			function(callback){
				redisSemaphore1.waitingFor(14).then(function(result){
					console.log('... accquired semaphore(1)');
				}).catch(function(err){
					console.log(err);
				});	
				callback(null, true);				
			}
			,
			function(callback){
				redisSemaphore1.waitingFor(14).then(function(result){
					console.log('... accquired semaphore(2)');
				}).catch(function(err){
					console.log(err);
				});	
				callback(null, true);				
			},
			function(callback){
				redisSemaphore1.waitingFor(14).then(function(result){
					console.log('... accquired semaphore(3)');
				}).catch(function(err){
					console.log(err);
				});	
				callback(null, true);					
			},
			function(callback){
				redisSemaphore2.waitingFor(14).then(function(result){
					console.log('... accquired semaphore(4)');
				}).catch(function(err){
					console.log(err);
				});		
				callback(null, true);			
			},
			function(callback){
				redisSemaphore2.waitingFor(14).then(function(result){
					console.log('... accquired semaphore(5)');
				}).catch(function(err){
					console.log(err);
				});		
				callback(null, true);		
			},
			function(callback){
				redisSemaphore2.waitingFor(14).then(function(result){
					console.log('... accquired semaphore(6)');
				}).catch(function(err){
					console.log(err);
				});		
				callback(null, true);			
			},
			function(callback){
				redisSemaphore2.observing(14).then(function(result){
					console.log('... finished observing');
					callback(null, result);
				}).catch(function(err){
					console.log(err);
				});					
			}
			],function(err, result){
				setTimeout( function(){ 
					redisSemaphore1.getStatus().then(function(result){
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
				redisSemaphore1.rel(function(err, sem){
					if(err)
						console.log(err);
					else
						console.log('... released semaphore, current count : ' + sem);
					callback(err, sem);
				});					
			},
			function(callback){
				redisSemaphore2.rel(function(err, sem){
					if(err)
						console.log(err);
					else
						console.log('... released semaphore, current count : ' + sem);
					callback(err, sem);
				});					
			},
			function(callback){
				redisSemaphore1.rel(function(err, sem){
					if(err)
						console.log(err);
					else
						console.log('... released semaphore, current count : ' + sem);
					callback(err, sem);
				});					
			}
			],function(err, result){
				setTimeout(function(){
					redisSemaphore2.getStatus().then(function(result){
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
				redisMutex1.get().then(function(result){
					console.log('... got mutex(1) : ' + result);
					if(result)
						muid = result;
					callback(null, result);
				}).catch(function(err){
					console.log(err);
					callback(err, null);
				});					
			},
			function(callback){
				redisMutex2.get().then(function(result){
					console.log('... got mutex(2) : ' + result);
					if(result)
						muid = result;
					callback(null, result);
				}).catch(function(err){
					console.log(err);
					callback(err, null);
				});					
			}
		],function(err, result){
			setTimeout(function(){
				done();
			}, 500);
		});
	});


	it('4. One will wait for mutext to be unlocked, and one will be timed out while waiting', function(done){
		var redisMutex1 = redisSharedObject1.getMutexClient(testMutexKey1),
			redisMutex2 = redisSharedObject2.getMutexClient(testMutexKey1);
		async.parallel([
			function(callback){
				redisMutex1.observing(8).then(function(released){
					console.log('... finished observing');
				}).catch(function(err){
					console.log('... err while observing : ' + err);
				});
				callback(null, true);
			},
			function(callback){
				redisMutex2.waitingFor(1).then(function(result){
					console.log('... got mutex(3) : ' + result);
					if(result)
						muid = result;
				}).catch(function(err){
					
					console.log('... err while waiting(3) : ' + err);
					expect(err.code).toEqual('ETIMEDOUT');
				});
				callback(null, true);					
			},
			function(callback){
				redisMutex1.waitingFor(8).then(function(result){
					console.log('... got mutex(4) : ' + result);
					if(result)
						muid = result;
				}).catch(function(err){
					console.log('... err while waiting(4) : ' + err);
				});
				callback(null, true);					
			},
			function(callback){
				redisMutex2.observing(1).catch(function(err){
					if(err)
						console.log('... err while observing : ' + err);
					expect(err.code).toEqual('ETIMEDOUT');
				});
				callback(null, true);			
			}
			],function(err, result){
				setTimeout(function(){
					redisMutex1.getStatus().then(function(result){
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
				}, 1500);

			}
		);

	}, 20000);

	it('5. First unlocking try should fail due to incorrect mutex id, but second try should succeed. In result, one can get a lock finally', function(done){
		var redisMutex1 = redisSharedObject1.getMutexClient(testMutexKey1),
			redisMutex2 = redisSharedObject2.getMutexClient(testMutexKey1);		
		async.parallel([
			function(callback){
				redisMutex1.rel('wrong_id').catch(function(err){
					expect(err).not.toBe(null);
					console.log('... err while releasing : ' + err);
					return redisMutex1.rel(muid);
				}).then(function(result){
					expect(result).toEqual(true);
					if(result)
						console.log('... unlocked mutex');
					callback(null, result);
				});					
			}
			],function(err, result){
				setTimeout(function(){
					redisMutex1.getStatus().then(function(result){
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

	it('6. Mutex should be expired, and a waiting client should get another', function(done){
		var isLocalInstanceReceivedMutexExpiredEvent = false;
		var toBeExpiredSoonPromise = redisSharedObject1.createMutexClient('promiseTestToBeExpired', 1);
		var watingClientPromise = redisSharedObject2.createMutexClient('promiseTestToBeExpired', 1, function(err, waitingClient){
			
			toBeExpiredSoonPromise.then(function(mutexClient){
				mutexClient.on('expired', function(result){
					isLocalInstanceReceivedMutexExpiredEvent = true;
				});

				setTimeout(function(){
					redisSharedObject1.end();
					redisSharedObject2.end();
					done();
				}, 2000);

				return mutexClient.get().then(function(result){
					console.log('... got mutex(5) : ' + result);
					muid = result;
				}).then(function(){
					return waitingClient.waitingFor(10).then(function(result){
						expect(result).not.toBe(null);
						expect(isLocalInstanceReceivedMutexExpiredEvent).toEqual(true);
						if(result)
							console.log('... previous lock has been expired, and got new one : ' + result);
					});				
				}).catch(function(err){
					console.log('... err while waiting(5) : ' + err);
				});

			});
		});
		
	}, 20000);

});
