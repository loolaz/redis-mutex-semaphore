'use strict';

var async = require('async'),
	redisSharedObject1,
	redisSharedObject2,
	muid,
	testSemaphoreKey = 'testObjectSem',
	testMutexKey1 = 'testObjectMutex1',
	testMutexKey2 = 'testObjectMutex2',
	options = {
		host: '127.0.0.1',
		port: 6379,
		db: 1
	};

describe('complicated scenario test(callback)', function(){
	var RedisSharedObject = require('../lib');
	it('initialize', function(done){
		redisSharedObject1 = RedisSharedObject(options);
		redisSharedObject2 = RedisSharedObject(options);

		redisSharedObject1.createSemaphoreClient(testSemaphoreKey, 3);
		redisSharedObject1.createMutexClient(testMutexKey1, 10);

		redisSharedObject2.createSemaphoreClient(testSemaphoreKey, 3);
		redisSharedObject2.createMutexClient(testMutexKey1, 10);
		setTimeout( function(){ 
			console.log('0. Complicated scenario - callback version - test initialized');
			done(); 
		}, 3000);
	});

	it('get three semaphore in sequence', function(done){
		console.log('1. Three clinets should accquire semaphores in sequence');
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

					redisSemaphore2.observing(6, function(err, result){
						console.log('... finished observing(1)');
					});						
					async.parallel([
						function(callback){
							redisSemaphore1.getStatus(function(err, result){
								expect(result.value).toEqual(0);
								callback(null, true);
							});
						},
						function(callback){
							redisSemaphore2.getStatus(function(err, result){
								expect(result.value).toEqual(0);
								console.log('... accquired three semaphore');
								callback(null, true);
							});
						}
						],
						function(err, result){
							
							done();
						}
					);

				});
			});
		});	
	}, 6000);

	it('release three semaphore, but six will compete to get them..', function(done){
		console.log('2. Other three clinet should accquire semaphores, and the other three still will wait')
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
					var firstCount = 0,
						firstWaiting = 0,
						firstObserving = 0,
						secondCount = 0,
						secondWaiting = 0,
						secondObserving = 0;
					async.parallel([
						function(callback){
							redisSemaphore1.getStatus(function(err, result){
								firstCount += result.value;
								firstWaiting += result.waiting;
								firstObserving += result.observing;
								callback(null, true);
							});
						},
						function(callback){
							redisSemaphore2.getStatus(function(err, result){
								secondCount += result.value;
								secondWaiting += result.waiting;
								secondObserving += result.observing;
								callback(null, true);
							});
						}
						],
						function(err, result){
							expect(firstCount).toEqual(0);
							expect(firstCount).toEqual(secondCount);
							expect(firstWaiting+secondWaiting).toEqual(3);
							expect(firstObserving+secondObserving).toEqual(0);
							done();
						}
					);
				}, 3000);
			}
		);

	}, 20000);

	it('release three semaphores', function(done){
		console.log('3. Rest of clinets should accquire semaphores');		
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
				setTimeout( function(){ 
					var firstCount = 0,
						firstWaiting = 0,
						firstObserving = 0,
						secondCount = 0,
						secondWaiting = 0,
						secondObserving = 0;
					async.parallel([
						function(callback){
							redisSemaphore1.getStatus(function(err, result){
								firstCount += result.value;
								firstWaiting += result.waiting;
								firstObserving += result.observing;
								callback(null, true);
							});
						},
						function(callback){
							redisSemaphore2.getStatus(function(err, result){
								secondCount += result.value;
								secondWaiting += result.waiting;
								secondObserving += result.observing;
								callback(null, true);
							});
						}
						],
						function(err, result){
							expect(firstCount).toEqual(secondCount);
							expect(firstCount).toEqual(0);
							expect(firstWaiting+secondWaiting).toEqual(0);
							expect(firstObserving+secondObserving).toEqual(0);
							done();
						}
					);
				}, 3000);
			}
		);

	}, 20000);

	it('get mutex and another waits for being released', function(done){
		console.log('4. One should get mutex, one should fail to lock, one will wait for mutext to be unlocked, and one will be timed out while waiting');
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
			},
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
					expect(err.message).toEqual('timedout');
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
				setTimeout( function(){ 
					var actualmuid,
						firstWaiting = 0,
						firstObserving = 0,
						secondWaiting = 0,
						secondObserving = 0;
					async.parallel([
						function(callback){
							redisMutex1.getStatus(function(err, result){
								actualmuid = result.value;
								firstWaiting += result.waiting;
								firstObserving += result.observing;
								callback(null, true);
							});
						},
						function(callback){
							redisMutex2.getStatus(function(err, result){
								secondWaiting += result.waiting;
								secondObserving += result.observing;
								callback(null, true);
							});
						}
						],
						function(err, result){
							expect(actualmuid).toEqual(muid);
							expect(firstWaiting+secondWaiting).toEqual(1);
							expect(firstObserving+secondObserving).toEqual(1);
							done();
						}
					);
				}, 1500);

			}
		);

	}, 20000);

	it('release mutex', function(done){
		console.log('5. First unlocking try should fail due to incorrect mutex id, but second try should succeed. In result, one can get a lock finally');
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
				setTimeout( function(){ 
					var actualmuid,
						firstWaiting = 0,
						firstObserving = 0,
						secondWaiting = 0,
						secondObserving = 0;
					async.parallel([
						function(callback){
							redisMutex1.getStatus(function(err, result){
								actualmuid = result.value;
								firstWaiting += result.waiting;
								firstObserving += result.observing;
								callback(null, true);
							});
						},
						function(callback){
							redisMutex2.getStatus(function(err, result){
								secondWaiting += result.waiting;
								secondObserving += result.observing;
								callback(null, true);
							});
						}
						],
						function(err, result){
							expect(actualmuid).not.toBe(null);
							expect(firstWaiting+secondWaiting).toEqual(0);
							expect(firstObserving+secondObserving).toEqual(0);
							done();
						}
					);
				}, 2000);					
			}
		);

	}, 20000);


	it('this mutex will be expired', function(done){
		console.log('6. Mutex should be expired.');
		redisSharedObject1.createMutexClient('toBeExpired', 3, function(err, toBeExpiredSoon){
			toBeExpiredSoon.on('expired', function(expired_id){
				console.log('... ' + expired_id + ' has been expired');
				expect(muid).toEqual(expired_id);
			});	

			toBeExpiredSoon.get(function(err, result){
				if(err)
					console.log('... err while waiting(5) : ' + err);
				else{
					console.log('... got mutex(5) : ' + result);
					muid = result;
				}
				setTimeout(function(){
					redisSharedObject1.end();
					redisSharedObject2.end();
					done();
				}, 5000);
			});

		});
	}, 20000); 

});