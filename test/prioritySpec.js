'use strict';

var async = require('async'),
	Promise = require('bluebird'),
	redis= require('redis'),
	testSemaphoreKey = 'testObjectSem',
	testMutexKey = 'testObjectMutex',
	factoryList = [];

describe('getStatus test', function(){
	var RedisSharedObject = require('../lib');
	var initCount = 0;
	it('initialize', function(done){
		for(var i = 0; i < 10; i++){
			var factory = RedisSharedObject();
			factory.createSemaphoreClient(testSemaphoreKey, 3).then(function(result){
				++initCount;
				if(initCount === 10){
					console.log('0. Object factories initialized');
					done();
				}
			}).catch(function(err){
				console.log(err);
			});
			factoryList.push(factory);
		}
	});

	it('check initial status', function(done){
		console.log('1. there should be no wating / observing client and semaphore count should be 3');
		setTimeout(function(){
			factoryList[0].getSemaphoreClient(testSemaphoreKey).getStatus().then(function(result){
				expect(result.value).toEqual(3);
				expect(result.waiting).toEqual(0);
				expect(result.observing).toEqual(0);
				console.log('... count : ' + result.value);
				console.log('... waiting : ' + result.waiting);
				console.log('... observing : ' + result.observing);		
				done();
			});
			
		}, 3000);
	}, 120000);

	it('waiting for semaphore', function(done){
		var priList = [RedisSharedObject.priority.HIGH, RedisSharedObject.priority.NORMAL, RedisSharedObject.priority.LOW];
		console.log('2. Three client should accquire semaphore and other three should wait');
		for(var i =0 ; i < 10 ; i++){
			(function(i){
				var redisSemaphoreClient = factoryList[i].getSemaphoreClient(testSemaphoreKey);
				redisSemaphoreClient.waitingForWithPriority(priList[i%3], 100, function(err, result){
					if(result){
						console.log('... accquire : ' + priList[i%3]);				
					}
					else if(err)
						console.log(err);

				});
			})(i);
		}	
		setTimeout(function(){
			var redisSemaphoreClient = factoryList[0].getSemaphoreClient(testSemaphoreKey);
			redisSemaphoreClient.getStatus(1500).then(function(result){
				expect(result.value).toEqual(0);
				expect(result.waiting).toEqual(3);
				expect(result.observing).toEqual(0);
				console.log('... count : ' + result.value);
				console.log('... waiting : ' + result.waiting);
				console.log('... observing : ' + result.observing);
				done();
			});
		}, 3000);
	}, 120000);

	it('waiting for semaphore', function(done){
		console.log('3. Three client should accquire semaphore and other three should wait');
		for(var i =0 ; i < 3 ; i++){
			var redisSemaphoreClient = factoryList[i].getSemaphoreClient(testSemaphoreKey);
			redisSemaphoreClient.rel(function(err, result){
				if(result){
					console.log('... release : ' + result);				
				}
				else if(err)
					console.log(err);

			});
		}	
		setTimeout(function(){
			redisSemaphoreClient.getStatus(1500).then(function(result){
				expect(result.value).toEqual(0);
				expect(result.waiting).toEqual(3);
				expect(result.observing).toEqual(0);
				console.log('... count : ' + result.value);
				console.log('... waiting : ' + result.waiting);
				console.log('... observing : ' + result.observing);
				done();
			});
		}, 6000);
	}, 120000);

	it('waiting for semaphore', function(done){
		console.log('3. Three client should accquire semaphore and other three should wait');
		for(var i =0 ; i < 3 ; i++){
			var redisSemaphoreClient = factoryList[i].getSemaphoreClient(testSemaphoreKey);
			redisSemaphoreClient.rel(function(err, result){
				if(result){
					console.log('... release : ' + result);				
				}
				else if(err)
					console.log(err);

			});
		}	
		setTimeout(function(){
			redisSemaphoreClient.getStatus(1500).then(function(result){
				expect(result.value).toEqual(0);
				expect(result.waiting).toEqual(3);
				expect(result.observing).toEqual(0);
				console.log('... count : ' + result.value);
				console.log('... waiting : ' + result.waiting);
				console.log('... observing : ' + result.observing);
				done();
			});
		}, 6000);
	}, 120000);

	it('finalize', function(done){
		setTimeout(function(){
			for(var i = 0; i < 10; i++){
				factoryList[i].end();
			}
		}, 6000);
		setTimeout(function(){
			console.log('6. Object factories have been finalized');
			done();
		}, 6000);
	}, 14000);

});