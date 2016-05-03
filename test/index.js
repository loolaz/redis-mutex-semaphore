'use strict';

var async = require('async');


describe('redis shared object test', function(){
	var RedisSharedObject = require('../lib'),
		redisSharedObject1,
		redisSharedObject2,
		redisSemaphore1,
		redisSemaphore2,
		redisMutex1,
		redisMutex2,
		muid,
		testSemaphoreKey = 'testObjectSem',
		testMutexKey1 = 'testObjectMutex1',
		testMutexKey2 = 'testObjectMutex2',
		options = {
			host: '127.0.0.1',
			port: 6379,
			db: 1
		};

	it('initialize', function(done){
		redisSharedObject1 = new RedisSharedObject(options);
		redisSharedObject1.initialize(function(){
			redisSharedObject1.client.del('sema:'+testSemaphoreKey);
			redisSharedObject1.client.del('mutex:'+testMutexKey1);	
			redisSharedObject1.client.del('mutex:'+testMutexKey2);	
			redisSemaphore1 = redisSharedObject1.getSemaphore(testSemaphoreKey, 0, 3, true); 

			redisSharedObject2 = new RedisSharedObject(options);
			redisSharedObject2.initialize(function(){
				redisSharedObject2.client.del('sema:'+testSemaphoreKey);
				redisSharedObject2.client.del('mutex:'+testMutexKey1);	
				redisSharedObject2.client.del('mutex:'+testMutexKey2);	
				redisSemaphore2 = redisSharedObject2.getSemaphore(testSemaphoreKey, 0, 3, true); 
				setTimeout( function(){ 
					done(); 
				}, 3000);
			});
		});
	});

	it('get three semaphore sequentially', function(done){
		redisSemaphore1.get(function(err, sem){
			if(err)
				console.log(err);
			else
				console.log('first semaphore : ' + sem);

			redisSemaphore1.get(function(err, sem){
				if(err)
					console.log(err);
				else
					console.log('second semaphore : ' + sem);

				redisSemaphore2.get(function(err, sem){
					if(err)
						console.log(err);
					else
						console.log('third semaphore : ' + sem);	

					async.parallel([
						function(callback){
							redisSemaphore1.getStatus(function(err, result){
								expect(result.count).toEqual(3);
								callback(null, true);
							});
						},
						function(callback){
							redisSemaphore2.getStatus(function(err, result){
								expect(result.count).toEqual(3);
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
		async.parallel([
			function(callback){
				redisSemaphore1.rel(function(err, result){
					if(err)
						console.log(err);
					else
						console.log('release result : ' + result);
					callback(err, result);
				});					
			},
			function(callback){
				redisSemaphore1.rel(function(err, result){
					if(err)
						console.log(err);
					else
						console.log('release result : ' + result);
					callback(err, result);
				});					
			},
			function(callback){
				redisSemaphore2.rel(function(err, result){
					if(err)
						console.log(err);
					else
						console.log('release result : ' + result);
					callback(err, result);
				});					
			},				
			function(callback){
				redisSemaphore1.waitingFor(5, function(err, result){
					if(err)
						console.log(err);
					else
						console.log('tried and finally got one(1) : ' + result);
				});	
				callback(null, true);				
			},
			function(callback){
				redisSemaphore1.waitingFor(6, function(err, result){
					if(err)
						console.log(err);
					else
						console.log('tried and finally got one(2) : ' + result);
				});	
				callback(null, true);				
			},
			function(callback){
				redisSemaphore1.waitingFor(6, function(err, result){
					if(err)
						console.log(err);
					else
						console.log('tried and finally got one(3) : ' + result);
				});
				callback(null, true);					
			},
			function(callback){
				redisSemaphore2.waitingFor(6, function(err, result){
					if(err)
						console.log(err);
					else
						console.log('tried and finally got one(4) : ' + result);
				});		
				callback(null, true);			
			},
			function(callback){
				redisSemaphore2.waitingFor(6, function(err, result){
					if(err)
						console.log(err);
					else
						console.log('tried and finally got one(5) : ' + result);					
				});			
				callback(null, true);		
			},
			function(callback){
				redisSemaphore2.waitingFor(6, function(err, result){
					if(err)
						console.log(err);
					else
						console.log('tried and finally got one(6) : ' + result);					
				});		
				callback(null, true);			
			},
			function(callback){
				redisSemaphore2.observing(6, function(err, result){
					console.log('just waited, and woke up');
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
								firstCount += result.count;
								firstWaiting += result.waiting;
								firstObserving += result.observing;
								callback(null, true);
							});
						},
						function(callback){
							redisSemaphore2.getStatus(function(err, result){
								secondCount += result.count;
								secondWaiting += result.waiting;
								secondObserving += result.observing;
								callback(null, true);
							});
						}
						],
						function(err, result){
							expect(firstCount).toEqual(3);
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
		async.parallel([
			function(callback){
				redisSemaphore1.rel(function(err, sem){
					if(err)
						console.log(err);
					else
						console.log('relSem : ' + sem);
					callback(err, sem);
				});					
			},
			function(callback){
				redisSemaphore2.rel(function(err, sem){
					if(err)
						console.log(err);
					else
						console.log('relSem : ' + sem);
					callback(err, sem);
				});					
			},
			function(callback){
				redisSemaphore1.rel(function(err, sem){
					if(err)
						console.log(err);
					else
						console.log('relSem : ' + sem);
					callback(err, sem);
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
								firstCount += result.count;
								firstWaiting += result.waiting;
								firstObserving += result.observing;
								callback(null, true);
							});
						},
						function(callback){
							redisSemaphore2.getStatus(function(err, result){
								secondCount += result.count;
								secondWaiting += result.waiting;
								secondObserving += result.observing;
								callback(null, true);
							});
						}
						],
						function(err, result){
							expect(firstCount).toEqual(secondCount);
							expect(firstCount).toEqual(3);
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
		redisMutex1 = redisSharedObject1.getMutex(testMutexKey1, 10);
		redisMutex2 = redisSharedObject2.getMutex(testMutexKey1, 10);
		async.parallel([
			function(callback){
				redisMutex1.get(function(err, result){
					if(err)
						console.log(err);
					else{
						console.log('got mutex(1) : ' + result);
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
						console.log('got mutex(2) : ' + result);
						muid = result;
					}
					callback(err, result);
				});					
			},
			function(callback){
				redisMutex1.observing(8, function(err, released){
					if(err)
						console.log('err while observing : ' + err);
					else{
						console.log('sucessfully observed releasing : ' + released);
					}
					
				});
				callback(null, true);					
			},
			function(callback){
				redisMutex2.waitingFor(1, function(err, result){
					if(err)
						console.log('err while waiting(3) : ' + err);
					else{
						console.log('got mutex(3) : ' + result);
						muid = result;
					}
					expect(err.message).toEqual('timedout');
				});
				callback(null, true);					
			},
			function(callback){
				redisMutex1.waitingFor(8, function(err, result){
					if(err)
						console.log('err while waiting(4) : ' + err);
					else{
						console.log('got mutex(4) : ' + result);
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
		async.parallel([
			function(callback){
				redisMutex1.rel('wrong_id', function(err, result){
					if(err)
						console.log('err while releasing : ' + err);
					else
						console.log('released : ' + result);


					redisMutex1.rel(muid, function(err, result){
						if(err)
							console.log('err while releasing : ' + err);
						else
							console.log('released : ' + result);
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
		redisMutex1 = redisSharedObject1.getMutex(testMutexKey2, 3);
		redisMutex1.on('expired', function(expired_id){
			expect(muid).toEqual(expired_id);
		});
		async.parallel([
			function(callback){
				redisMutex1.get(function(err, result){
					if(err)
						console.log(err);
					else{
						console.log('mutex : ' + result);
						muid = result;
					}
					callback(err, result);
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
							expect(actualmuid).toEqual(null);
							expect(firstWaiting+secondWaiting).toEqual(0);
							expect(firstObserving+secondObserving).toEqual(0);
							
							redisSharedObject1.end();
							redisSharedObject2.end();
							done();
						}
					);
				}, 7000);
			}
		);

	}, 20000);

});