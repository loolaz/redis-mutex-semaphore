'use strict';

var async = require('async'),
	Promise = require('bluebird'),
	redis= require('redis'),
	testSemaphoreKey = 'testObjectSem',
	testMutexKey = 'testObjectMutex',
	factory;

describe('basic scenario test', function(){
	var RedisSharedObject = require('../lib');
	it('initialize', function(done){
		factory = RedisSharedObject();
		factory.createMutexClient(testMutexKey, 10).then(function(result){
			console.log('0. Object factory initialized');
			setTimeout(function(){
				done();
			}, 1500);
		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 1', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createSemaphoreClient(testSemaphoreKey, 10).then(function(redisSemaphoreClient){
			console.log('1. semaphore get method error testing with changing transaction setting');
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

	it('exceptional case 2', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createSemaphoreClient(testSemaphoreKey, 10).then(function(redisSemaphoreClient){
			console.log('2. getStatus(callback) method should return error');
			anotherfactory.client.quit();
			redisSemaphoreClient.getStatus(function(err, result){
				expect(err).not.toBe(null);
				done();
			});			

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 3', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createSemaphoreClient(testSemaphoreKey, 10).then(function(redisSemaphoreClient){
			console.log('3. getStatus(promise) method should return error');
			anotherfactory.client.quit();
			redisSemaphoreClient.getStatus().catch(function(err){
				expect(err).not.toBe(null);
				done();
			});			

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 4', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createSemaphoreClient(testSemaphoreKey, 10).then(function(redisSemaphoreClient){
			console.log('4. waitingFor method(promise) should return error');
			anotherfactory.client.quit();
			redisSemaphoreClient.waitingFor(10).catch(function(err){
				expect(err).not.toBe(null);
				done();
			});			

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 5', function(done){
		var anotherfactory = RedisSharedObject();
		anotherfactory.createSemaphoreClient(testSemaphoreKey, 10).then(function(redisSemaphoreClient){
			console.log('5. waitingFor method(callback) should return error');
			anotherfactory.client.quit();
			redisSemaphoreClient.waitingFor(10, function(err, result){
				expect(err).not.toBe(null);
				done();
			});	

		}).catch(function(err){
			console.log(err);
		});
	});

	it('exceptional case 6', function(done){
		console.log('6. connection error testing');

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

	it('exceptional case 7', function(done){
		console.log('7. reset while using mutex');
		var redisMutexClient = factory.getMutexClient(testMutexKey);
		redisMutexClient.get(function(err, result){
			redisMutexClient.reset();
			done();
		});

	//done();
	}, 120000);

	it('exceptional case 8', function(done){
		console.log('8. end while using mutex');
		var redisMutexClient = factory.getMutexClient(testMutexKey);
		redisMutexClient.get(function(err, result){
			factory.end();
			done();
		});

	//done();
	}, 120000);

});