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
	var priList = [RedisSharedObject.priority.HIGH, RedisSharedObject.priority.NORMAL, RedisSharedObject.priority.LOW];
	var accquiredList = {
		'0' : {
			count : 0,
			name : 'HIGH'
		},
		'30' : {
			count : 0,
			name : 'NORMAL',
		},
		'60' : {
			count : 0,
			name : 'LOW'
		}
	};
	it('initialize', function(done){
		for(var i = 0; i < 10; i++){
			var factory = RedisSharedObject();
			factory.createSemaphoreClient(testSemaphoreKey, 2).then(function(result){
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
		console.log('1. Initial statu check');
		setTimeout(function(){
			factoryList[0].getSemaphoreClient(testSemaphoreKey).getStatus().then(function(result){
				expect(result.value).toEqual(2);
				expect(result.waiting).toEqual(0);
				expect(result.observing).toEqual(0);
				console.log('... count : ' + result.value);
				console.log('... waiting : ' + result.waiting);
				console.log('... observing : ' + result.observing);		
				done();
			});
			
		}, 3000);
	}, 120000);

	it('accquire semaphore', function(done){
		
		console.log('2. Two clients should accquire semaphores randomly and others should wait');
		for(var i =0 ; i < 10 ; i++){
			(function(i){
				var redisSemaphoreClient = factoryList[i].getSemaphoreClient(testSemaphoreKey);
				redisSemaphoreClient.waitingForWithPriority(priList[i%3], 100, function(err, result){
					if(result){
						accquiredList[priList[i%3]].count++;
						console.log('... accquire : ' + accquiredList[priList[i%3]].name);
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
				expect(result.waiting).toEqual(8);
				expect(result.observing).toEqual(0);
				console.log('... count : ' + result.value);
				console.log('... waiting : ' + result.waiting);
				console.log('... observing : ' + result.observing);
				done();
			});
		}, 3000);
	}, 120000);

	it('release semaphore', function(done){
		console.log('3. Two clients with high priority should accquire semaphores first');
		for(var i =0 ; i < 2 ; i++){
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
				expect(result.waiting).toEqual(6);
				expect(result.observing).toEqual(0);
				expect(accquiredList[RedisSharedObject.priority.HIGH].count).toBeGreaterThan(1);
				console.log('... count : ' + result.value);
				console.log('... waiting : ' + result.waiting);
				console.log('... observing : ' + result.observing);
				done();
			});
		}, 3000);
	}, 120000);

	it('waiting for semaphore', function(done){
		console.log('4. Two client with next priority should accquire semaphore and others should wait');
		for(var i =0 ; i < 2 ; i++){
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
				expect(result.waiting).toEqual(4);
				expect(result.observing).toEqual(0);
				expect(accquiredList[RedisSharedObject.priority.HIGH].count).toBeGreaterThan(1);
				console.log('... count : ' + result.value);
				console.log('... waiting : ' + result.waiting);
				console.log('... observing : ' + result.observing);
				done();
			});
		}, 3000);
	}, 120000);

	it('waiting for semaphore', function(done){
		console.log('5. Two client with next priority should accquire semaphore and others should wait');
		for(var i =0 ; i < 2 ; i++){
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
				expect(result.waiting).toEqual(2);
				expect(result.observing).toEqual(0);
				expect(accquiredList[RedisSharedObject.priority.NORMAL].count).toBeGreaterThan(1);
				console.log('... count : ' + result.value);
				console.log('... waiting : ' + result.waiting);
				console.log('... observing : ' + result.observing);
				done();
			});
		}, 3000);
	}, 120000);

	it('waiting for semaphore', function(done){
		console.log('6. Two client with next priority should accquire semaphore and others should wait');
		for(var i =0 ; i < 2 ; i++){
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
				expect(result.waiting).toEqual(0);
				expect(result.observing).toEqual(0);
				expect(accquiredList[RedisSharedObject.priority.HIGH].count).toEqual(4);
				expect(accquiredList[RedisSharedObject.priority.NORMAL].count).toEqual(3);
				expect(accquiredList[RedisSharedObject.priority.LOW].count).toEqual(3);
				console.log('... count : ' + result.value);
				console.log('... waiting : ' + result.waiting);
				console.log('... observing : ' + result.observing);
				done();
			});
		}, 3000);
	}, 120000);

	it('scheduling test', function(done){
		console.log('7. Items in the waiting queue in local instance should be popped up in sequence of priority');
		factoryList[0].createSemaphoreClient(testSemaphoreKey).then(function(redisSemaphoreClient){
			for(var i =0 ; i < 10 ; i++){
				(function(i){
					redisSemaphoreClient.setNewConnectionPerTransaction(true);		// should be true if clients with same redis connection want to accquire the same semaphore key	
					redisSemaphoreClient.waitingForWithPriority(priList[i%3], 100, function(err, result){
						if(err)
							console.log(err);
					});
				})(i);					
			}	
		});

		setTimeout(function(){			
			var redisSemaphoreClient = factoryList[0].getSemaphoreClient(testSemaphoreKey);		
			redisSemaphoreClient.onRel('', { count : 4});
			expect(redisSemaphoreClient.waitingList[RedisSharedObject.priority.HIGH].length).toEqual(0);
			redisSemaphoreClient.onRel('', { count : 4});
			expect(redisSemaphoreClient.waitingList[RedisSharedObject.priority.NORMAL].length).toEqual(0);

			done();
		}, 3000);
	}, 120000);

	it('finalize', function(done){
		setTimeout(function(){
			for(var i = 0; i < 10; i++){
				factoryList[i].end();
			}
		}, 3000);
		setTimeout(function(){
			console.log('8. Object factories have been finalized');
			done();
		}, 3000);
	}, 14000);

});