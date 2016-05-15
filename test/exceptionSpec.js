'use strict';

var async = require('async'),
	Promise = require('bluebird'),
	redis= require('redis'),
	testSemaphoreKey = 'exceptionTestObjectSem',
	testMutexKey = 'exceptionTestObjectMutex',
	factory;

describe('exceptional scenario test', function(){
	var RedisSharedObject = require('../lib');
	it('0. Object factory has been initialized', function(done){
		factory = RedisSharedObject();
		factory.createMutexClient(testMutexKey, 10).then(function(result){
			setTimeout(function(){
				done();
			}, 1500);
		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 1 - semaphore get method error testing with changing transaction setting', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createSemaphoreClient(testSemaphoreKey, 10).then(function(redisSemaphoreClient){
			anotherfactory.client.quit();
			redisSemaphoreClient.setNewConnectionPerTransaction(true);
			redisSemaphoreClient.get(function(err, result){
				expect(err).toEqual(null);
				redisSemaphoreClient.setNewConnectionPerTransaction(false);
				redisSemaphoreClient.get(function(err, result){
					expect(err).not.toBe(null);
					setTimeout(function(){
						done();
					}, 1500);
				});

			});			

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 2 - getStatus(callback) method should return error', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createSemaphoreClient(testSemaphoreKey, 10).then(function(redisSemaphoreClient){
			anotherfactory.client.quit();
			redisSemaphoreClient.getStatus(function(err, result){
				expect(err).not.toBe(null);
				done();
			});			

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 3 - getStatus(promise) method should return error', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createSemaphoreClient(testSemaphoreKey, 10).then(function(redisSemaphoreClient){
			anotherfactory.client.quit();
			redisSemaphoreClient.getStatus().catch(function(err){
				expect(err).not.toBe(null);
				done();
			});			

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 4 - waitingFor method(promise) should return error', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createSemaphoreClient(testSemaphoreKey, 10).then(function(redisSemaphoreClient){
			anotherfactory.client.quit();
			redisSemaphoreClient.waitingFor(10).catch(function(err){
				expect(err).not.toBe(null);
				done();
			});			

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 5 - waitingFor method(callback) should return error', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createSemaphoreClient(testSemaphoreKey, 10).then(function(redisSemaphoreClient){
			anotherfactory.client.quit();
			redisSemaphoreClient.waitingFor(10, function(err, result){
				expect(err).not.toBe(null);
				done();
			});	

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 6 - reset method(promise) should return error', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createSemaphoreClient(testSemaphoreKey, 10).then(function(redisSemaphoreClient){
			anotherfactory.client.quit();
			redisSemaphoreClient.reset(function(err, result){
				expect(err).not.toBe(null);
				done();
			});	

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 7 - rel method(promise) should return error', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createSemaphoreClient(testSemaphoreKey, 10).then(function(redisSemaphoreClient){
			anotherfactory.client.quit();
			redisSemaphoreClient.rel(function(err, result){
				expect(err).not.toBe(null);
				done();
			});	

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 8 - observing method(callback) should return error', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createSemaphoreClient(testSemaphoreKey, 10).then(function(redisSemaphoreClient){
			anotherfactory.client.quit();
			redisSemaphoreClient.observing(10, function(err, result){
				expect(err).not.toBe(null);
				done();
			});	

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 9 - observing method(promise) should return error', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createSemaphoreClient(testSemaphoreKey, 10).then(function(redisSemaphoreClient){
			anotherfactory.client.quit();
			redisSemaphoreClient.observing(10).catch(function(err){
				expect(err).not.toBe(null);
				done();
			});	

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 10 - connection error testing', function(done){
		RedisSharedObject({
			host : '127.0.0.1',
			port : 6379,
			db : 1,
			pass : 'abc'
		}, function(err, client){
			if(client){
				var err = new Error('Testing error handling');
				err.code = 'ETEST';
				client.emit('error', err);
			}
			else if(err){
				expect(err.code).toEqual('ETEST');
				setTimeout(function(){
					done();
				}, 1000);		
			}
		});

	//done();
	}, 120000);

	it('exceptional case 11 - reset while using mutex', function(done){
		var redisMutexClient = factory.getMutexClient(testMutexKey);
		redisMutexClient.get(function(err, result){
			redisMutexClient.reset(function(err, result){
				expect(result).toEqual(true);
			});
			done();
		});

	//done();
	}, 120000);

	it('exceptional case 12 - semaphore key has been accidently deleted', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createSemaphoreClient(testSemaphoreKey, 10).then(function(redisSemaphoreClient){
			redisSemaphoreClient.setNewConnectionPerTransaction(true);
			redisSemaphoreClient.client.del("sema:exceptionTestObjectSem", function(err, result){	
				redisSemaphoreClient.get(function(err, result){
					expect(err.code).toEqual('ENOTFOUNDKEY');
					done();
				});
			});		

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 13 - mutex get method(callback) should return error', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createMutexClient(testMutexKey, 10).then(function(redisMutexClient){
			anotherfactory.client.quit();
			redisMutexClient.get(function(err, result){
				expect(err.code).not.toBe(null);
				done();
			});	

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 14 - mutex get method(promise) should return error', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createMutexClient(testMutexKey, 10).then(function(redisMutexClient){
			anotherfactory.client.quit();
			redisMutexClient.get().catch(function(err){
				expect(err.code).not.toBe(null);
				done();
			});	

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 15 - mutex rel method(callback) should return error', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createMutexClient(testMutexKey, 10).then(function(redisMutexClient){
			redisMutexClient.get(function(err, mutexid){
				anotherfactory.client.quit();
				redisMutexClient.rel(mutexid, function(err, result){
					expect(err.code).not.toBe(null);
					done();
				});	
			});
		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 16 - mutex reset method(callback) should return error', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createMutexClient(testMutexKey, 10).then(function(redisMutexClient){
			anotherfactory.client.quit();
			redisMutexClient.reset(function(err, result){
				expect(err.code).not.toBe(null);
				done();
			});	

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 17 - try to unlock after mutex key was deleted', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createMutexClient(testMutexKey).then(function(redisMutexClient){
			redisMutexClient.client.del("mutex:exceptionTestObjectMutex", function(err, result){	
				redisMutexClient.rel(function(err, result){
					expect(result).toEqual(false);
					done();
				});
			});		

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 18 - mutex extend method should return error', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createMutexClient(testMutexKey, 10).then(function(redisMutexClient){
			redisMutexClient.get(function(err, mutex){
				anotherfactory.client.quit();
				redisMutexClient.extend(mutex, 10, function(err, result){
					expect(err).not.toBe(null);
					done();
				});	
			});
				
		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 19 - mutex extend method should return false', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createMutexClient(testMutexKey, 10).then(function(redisMutexClient){
			redisMutexClient.get(function(err, mutex){
				redisMutexClient._debug_resetMutexTimer();
				redisMutexClient.extend(mutex, 10).then(function(result){
					expect(result).toEqual(false);
					redisMutexClient.get(function(err, mutexAgain){
						expect(mutexAgain).not.toBe(null);
						done();
					});
				});	
			});
				
		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 20 - mutex extend method should return error', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createMutexClient(testMutexKey, 10).then(function(redisMutexClient){
			redisMutexClient.get(function(err, mutex){
				redisMutexClient._debug_resetMutexTimer();
				anotherfactory.client.quit();
				redisMutexClient.extend(mutex, 10).catch(function(err){
					expect(err).not.toBe(null);
					done();
				});	
			});
				
		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 21 - mutex extend method should return false', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createMutexClient(testMutexKey, 10).then(function(redisMutexClient){
			redisMutexClient.get(function(err, mutex){
				redisMutexClient._debug_resetMutexTimer();
				redisMutexClient.key = "null";
				redisMutexClient.extend(mutex, 10).then(function(result){
					expect(result).toEqual(false);
					done();
				});	
			});
				
		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 22 - mutex extend method should return error', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createMutexClient(testMutexKey, 10).then(function(redisMutexClient){
			redisMutexClient.get(function(err, mutex){
				redisMutexClient._debug_resetMutexTimer();
				anotherfactory.client.quit();
				redisMutexClient.extend(mutex, 10).catch(function(err){
					expect(err).not.toBe(null);
					done();
				});	
			});
				
		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 23 - mutex extend method should return false', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createMutexClient(testMutexKey, 10).then(function(redisMutexClient){
			redisMutexClient.get(function(err, mutex){
				redisMutexClient._debug_resetMutexTimer();
				redisMutexClient.extend("wrongid", 10).then(function(result){
					expect(result).toEqual(false);
					done();
				});	
			});
				
		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 24 - end while using mutex', function(done){
		var redisMutexClient = factory.getMutexClient(testMutexKey);
		redisMutexClient.get(function(err, result){
			factory.end();
			done();
		});
	});

});