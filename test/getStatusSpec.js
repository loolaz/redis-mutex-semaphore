'use strict';

var async = require('async'),
	Promise = require('bluebird'),
	redis= require('redis'),
	testSemaphoreKey = 'getStatusTestObjectSem',
	testMutexKey = 'getStatusTestObjectMutex',
	factoryList = [];

describe('getStatus test', function(){
	var RedisSharedObject = require('../lib');
	var initCount = 0;
	it('0. Object factories initialized', function(done){
		for(var i = 0; i < 10; i++){
			var factory = RedisSharedObject();
			factory.createSemaphoreClient(testSemaphoreKey, 3).then(function(result){
				++initCount;
				if(initCount === 10){
					done();
				}
			}).catch(function(err){
				console.log(err);
			});
			factoryList.push(factory);
		}
	});

	it('1. there should be no wating / observing client and semaphore count should be 3', function(done){
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
			
		}, 500);
	}, 120000);

	it('2. Three client should accquire semaphore and other three should wait', function(done){
		for(var i =0 ; i < 6 ; i++){
			var redisSemaphoreClient = factoryList[i].getSemaphoreClient(testSemaphoreKey);
			redisSemaphoreClient.waitingFor(100, function(err, result){
				if(result){
					console.log('... accquire');				
				}
				else if(err)
					console.log(err);

			});
		}	
		setTimeout(function(){
			redisSemaphoreClient.getStatus(200).then(function(result){
				expect(result.value).toEqual(0);
				expect(result.waiting).toEqual(3);
				expect(result.observing).toEqual(0);
				console.log('... count : ' + result.value);
				console.log('... waiting : ' + result.waiting);
				console.log('... observing : ' + result.observing);
				done();
			});
		}, 500);

		
	}, 120000);

	it('3. Four more clients have been added and started observing', function(done){
		for(var i =6 ; i < 10 ; i++){
			var redisSemaphoreClient = factoryList[i].getSemaphoreClient(testSemaphoreKey);
			redisSemaphoreClient.observing(100, function(err, result){
				if(result){
					console.log('... finished observing');				
				}
				else if(err)
					console.log(err);
			});
		}		
		setTimeout(function(){
			redisSemaphoreClient.getStatus(function(err, result){
				expect(result.value).toEqual(0);
				expect(result.waiting).toEqual(3);
				expect(result.observing).toEqual(4);				
				console.log('... count : ' + result.value);
				console.log('... waiting : ' + result.waiting);
				console.log('... observing : ' + result.observing);			
				done();
			});
			
		}, 500);

		
	}, 120000);

	it('4. All client should be woken up by resetWithPublish call', function(done){
		factoryList[0].getSemaphoreClient(testSemaphoreKey).resetWithPublish().then(function(result){
			expect(result).toEqual(true);
		}).catch(function(err){
			console.log('... reset error : ' + err);
		});
		factoryList[0].getSemaphoreClient(testSemaphoreKey).resetWithPublish(function(err, result){
			if(result){
				expect(result).toEqual(true);
				done();
			}
			else if(err){
				console.log('... reset error : ' + err);
				done();
			}
		});
	}, 14000);

	it('5. Now, there should be no waiting client any more', function(done){
		setTimeout(function(){
			factoryList[0].getSemaphoreClient(testSemaphoreKey).getStatus(200, function(err, result){
				expect(result.value).toEqual(0);
				expect(result.waiting).toEqual(0);
				expect(result.observing).toEqual(0);
				console.log('... count : ' + result.value);
				console.log('... waiting : ' + result.waiting);
				console.log('... observing : ' + result.observing);		
				done();
			});
			
		}, 500);
	}, 120000);

	it('6. Object factories have been finalized', function(done){
		setTimeout(function(){
			for(var i = 0; i < 10; i++){
				factoryList[i].end();
			}
		}, 1000);
		setTimeout(function(){
			console.log('6. Object factories have been finalized');
			done();
		}, 2000);
	}, 14000);

});