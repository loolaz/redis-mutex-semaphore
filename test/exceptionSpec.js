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

	it('exceptional case', function(done){
		console.log('1. connection error testing');

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
				done();		
			}
		});

	//done();
	}, 120000);

	it('exceptional case', function(done){
		console.log('2. reset while using mutex');
		var redisMutexClient = factory.getMutexClient(testMutexKey);
		redisMutexClient.get(function(err, result){
			redisMutexClient.reset();
			done();
		});

	//done();
	}, 120000);

	it('exceptional case', function(done){
		console.log('3. end while using mutex');
		var redisMutexClient = factory.getMutexClient(testMutexKey);
		redisMutexClient.get(function(err, result){
			factory.end();
			done();
		});

	//done();
	}, 120000);

});