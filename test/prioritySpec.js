'use strict';

var async = require('async'),
	Promise = require('bluebird'),
	redis= require('redis'),
	testSemaphoreKey = 'priorityTestObjectSem',
	testMutexKey = 'priorityTestObjectMutex',
	factoryList = [];

describe('priority based scheduling test', function(){
	var RedisSharedObject = require('../lib');
	var initCount = 0;
	var priList = [RedisSharedObject.priority.HIGH, RedisSharedObject.priority.NORMAL, RedisSharedObject.priority.LOW];
	var accquiredList = {
		'0' : {
			count : 0,
			name : 'HIGH'
		},
		'10' : {
			count : 0,
			name : 'NORMAL',
		},
		'40' : {
			count : 0,
			name : 'LOW'
		}
	};
	it('0. Object factories initialized', function(done){
		for(var i = 0; i < 10; i++){
			var factory = RedisSharedObject();
			factory.createSemaphoreClient(testSemaphoreKey, 2).then(function(result){
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

	it('1. Initial statu check', function(done){
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
			
		}, 2000);
	}, 120000);

	it('2. Two clients should accquire semaphores randomly and others should wait', function(done){
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
			redisSemaphoreClient.getStatus(1000).then(function(result){
				expect(result.value).toEqual(0);
				expect(result.waiting).toEqual(8);
				expect(result.observing).toEqual(0);
				console.log('... count : ' + result.value);
				console.log('... waiting : ' + result.waiting);
				console.log('... observing : ' + result.observing);
				done();
			});
		}, 1500);
	}, 120000);

	it('3. Two clients with high priority should accquire semaphores first', function(done){
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
			redisSemaphoreClient.getStatus(1000).then(function(result){
				expect(result.value).toEqual(0);
				expect(result.waiting).toEqual(6);
				expect(result.observing).toEqual(0);
				expect(accquiredList[RedisSharedObject.priority.HIGH].count).toBeGreaterThan(1);
				console.log('... count : ' + result.value);
				console.log('... waiting : ' + result.waiting);
				console.log('... observing : ' + result.observing);
				done();
			});
		}, 1500);
	}, 120000);

	it('4. Two client with next priority should accquire semaphore and others should wait', function(done){
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
			redisSemaphoreClient.getStatus(1000).then(function(result){
				expect(result.value).toEqual(0);
				expect(result.waiting).toEqual(4);
				expect(result.observing).toEqual(0);
				expect(accquiredList[RedisSharedObject.priority.HIGH].count).toBeGreaterThan(1);
				console.log('... count : ' + result.value);
				console.log('... waiting : ' + result.waiting);
				console.log('... observing : ' + result.observing);
				done();
			});
		}, 1500);
	}, 120000);

	it('5. Two client with next priority should accquire semaphore and others should wait', function(done){
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
			redisSemaphoreClient.getStatus(1000).then(function(result){
				expect(result.value).toEqual(0);
				expect(result.waiting).toEqual(2);
				expect(result.observing).toEqual(0);
				expect(accquiredList[RedisSharedObject.priority.NORMAL].count).toBeGreaterThan(1);
				console.log('... count : ' + result.value);
				console.log('... waiting : ' + result.waiting);
				console.log('... observing : ' + result.observing);
				done();
			});
		}, 1500);
	}, 120000);

	it('6. Two client with next priority should accquire semaphore and others should wait', function(done){
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
			redisSemaphoreClient.getStatus(1000).then(function(result){
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
		}, 1500);
	}, 120000);

	it('7. Items in the waiting queue in local instance should be popped up in sequence of priority', function(done){
		factoryList[0].createSemaphoreClient(testSemaphoreKey, 2).then(function(redisSemaphoreClient){
			for(var i =0 ; i < 10 ; i++){
				(function(i){
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
		}, 1500);
	}, 120000);

	it('8. Object factories have been finalized', function(done){
		setTimeout(function(){
			for(var i = 0; i < 10; i++){
				factoryList[i].end();
			}
		}, 1500);
		setTimeout(function(){
			done();
		}, 2000);
	}, 14000);

});