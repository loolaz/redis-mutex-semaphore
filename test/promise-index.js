'use strict';

var async = require('async'),
Promise = require('bluebird'),
redis= require('redis'),
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

describe('redis shared object test', function(){
	var RedisSharedObject = require('../lib');

	it('initialize', function(done){
		redisSharedObject1 = RedisSharedObject(options);
		redisSharedObject2 = RedisSharedObject(options);

		redisSharedObject1.client.del('sema:'+testSemaphoreKey);
		redisSharedObject1.client.del('mutex:'+testMutexKey1);	
		redisSharedObject1.client.del('mutex:'+testMutexKey2);	
		redisSharedObject1.createSemaphore(testSemaphoreKey, 0, 3);
		redisSharedObject1.createMutex(testMutexKey1, 10);

		redisSharedObject2.createSemaphore(testSemaphoreKey, 0, 3);
		redisSharedObject2.createMutex(testMutexKey1, 10);
		setTimeout( function(){ 
			done(); 
		}, 3000);
	});

	it('get three semaphore sequentially', function(done){
		
		var redisSemaphore1 = redisSharedObject1.getSemaphore(testSemaphoreKey),
			redisSemaphore2 = redisSharedObject2.getSemaphore(testSemaphoreKey);
		redisSemaphore1.get()
		.then(function(sem){
			console.log('first semaphore : ' + sem);
		}).then(function(){ 
			return redisSemaphore1.get();
		}).then(function(sem){
			console.log('second semaphore : ' + sem)
		}).then(function(){
			return redisSemaphore1.get();
		}).then(function(sem){
			console.log('third semaphore : ' + sem);
			done();
		}).catch(function(err){
			console.log('error :' + err);
			done();
		});
	}, 6000);

	it('release three semaphore, but six will compete to get them..', function(done){
		var redisSemaphore1 = redisSharedObject1.getSemaphore(testSemaphoreKey),
			redisSemaphore2 = redisSharedObject2.getSemaphore(testSemaphoreKey);		
		async.parallel([
			function(callback){
				redisSemaphore1.rel().then(function(result){
					console.log('release result(1) : ' + result);
					callback(null, result);
				}).catch(function(err){
					console.log(err);
					callback(err, null);
				});					
			},
			function(callback){
				redisSemaphore1.rel().then(function(result){
					console.log('release result(2) : ' + result);
					callback(null, result);
				}).catch(function(err){
					console.log(err);
					callback(err, null);
				});						
			},
			function(callback){
				redisSemaphore2.rel().then(function(result){
					console.log('release result(3) : ' + result);
					callback(null, result);
				}).catch(function(err){
					console.log(err);
					callback(err, null);
				});					
			},			
			function(callback){
				redisSemaphore1.waitingFor(6).then(function(result){
					console.log('tried and finally got one(1) : ' + result);
				}).catch(function(err){
					console.log(err);
				});	
				callback(null, true);				
			}
			,
			function(callback){
				redisSemaphore1.waitingFor(6).then(function(result){
					console.log('tried and finally got one(2) : ' + result);
				}).catch(function(err){
					console.log(err);
				});	
				callback(null, true);				
			},
			function(callback){
				redisSemaphore1.waitingFor(6).then(function(result){
					console.log('tried and finally got one(3) : ' + result);
				}).catch(function(err){
					console.log(err);
				});	
				callback(null, true);					
			},
			function(callback){
				redisSemaphore2.waitingFor(6).then(function(result){
					console.log('tried and finally got one(4) : ' + result);
				}).catch(function(err){
					console.log(err);
				});		
				callback(null, true);			
			},
			function(callback){
				redisSemaphore2.waitingFor(6).then(function(result){
					console.log('tried and finally got one(5) : ' + result);
				}).catch(function(err){
					console.log(err);
				});		
				callback(null, true);		
			},
			function(callback){
				redisSemaphore2.waitingFor(6).then(function(result){
					console.log('tried and finally got one(6) : ' + result);
				}).catch(function(err){
					console.log(err);
				});		
				callback(null, true);			
			},
			function(callback){
				redisSemaphore2.observing(6).then(function(result){
					console.log('just waited, and woke up');
					callback(null, result);
				}).catch(function(err){
					console.log(err);
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
							redisSemaphore1.getStatus().then(function(result){
								firstCount += Number(result.value);
								firstWaiting += result.waiting;
								firstObserving += result.observing;
								callback(null, true);
							});
						},
						function(callback){
							redisSemaphore2.getStatus().then(function(result){
								secondCount += Number(result.value);
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
		var redisSemaphore1 = redisSharedObject1.getSemaphore(testSemaphoreKey),
			redisSemaphore2 = redisSharedObject2.getSemaphore(testSemaphoreKey);		
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
								firstCount += Number(result.value);
								firstWaiting += result.waiting;
								firstObserving += result.observing;
								callback(null, true);
							});
						},
						function(callback){
							redisSemaphore2.getStatus(function(err, result){
								secondCount += Number(result.value);
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
		var redisMutex1 = redisSharedObject1.getMutex(testMutexKey1),
			redisMutex2 = redisSharedObject2.getMutex(testMutexKey1);
		async.parallel([
			function(callback){
				redisMutex1.get().then(function(result){
					console.log('got mutex(1) : ' + result);
					muid = result;
					callback(null, result);
				}).catch(function(err){
					console.log(err);
					callback(err, null);
				});					
			},
			function(callback){
				redisMutex2.get().then(function(result){
					console.log('got mutex(2) : ' + result);
					muid = result;
					callback(null, result);
				}).catch(function(err){
					console.log(err);
					callback(err, null);
				});					
			},
			function(callback){
				redisMutex1.observing(8).then(function(released){
					console.log('sucessfully observed releasing : ' + released);
				}).catch(function(err){
					console.log('err while observing : ' + err);
				});
				callback(null, true);					
			},
			function(callback){
				redisMutex2.waitingFor(1).then(function(result){
					console.log('got mutex(3) : ' + result);
					muid = result;
				}).catch(function(err){
					
					console.log('err while waiting(3) : ' + err);
					expect(err.message).toEqual('timedout');
				});
				callback(null, true);					
			},
			function(callback){
				redisMutex1.waitingFor(8).then(function(result){
					console.log('got mutex(4) : ' + result);
					muid = result;
				}).catch(function(err){
					console.log('err while waiting(4) : ' + err);
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
		var redisMutex1 = redisSharedObject1.getMutex(testMutexKey1),
			redisMutex2 = redisSharedObject2.getMutex(testMutexKey1);		
		async.parallel([
			function(callback){
				redisMutex1.rel('wrong_id').catch(function(err){
					console.log('err while releasing : ' + err);
					return redisMutex1.rel(muid);
				}).then(function(result){
					console.log('released : ' + result);
					callback(null, result);
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
		var redisMutex3 = redisSharedObject1.createMutex(testMutexKey2, 3),
			redisMutex1 = redisSharedObject1.getMutex(testMutexKey1);
		redisMutex3.on('expired', function(expired_id){
			expect(muid).toEqual(expired_id);
		});
		async.parallel([
			function(callback){
				redisMutex1.get().then(function(result){
					console.log('got mutex(5) : ' + result);
					muid = result;
					callback(null, result);
				}).catch(function(err){
					console.log('err while waiting(5) : ' + err);
					callback(err, null);
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
							redisMutex3.getStatus(function(err, result){
								actualmuid = result.value;
								firstWaiting += result.waiting;
								firstObserving += result.observing;
								callback(null, true);
							});
						},
						function(callback){
							redisMutex1.getStatus(function(err, result){
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