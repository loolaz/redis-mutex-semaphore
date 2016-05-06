# redis-mutex-semaphore
This is a mutex and semaphore library which is very simply implemented by using some basic redis commands such as incr/decr(semaphore) and setnx(mutex).
 - pros : you can pass existing redis connection and simply use semaphore and mutex
 - cons : of course, may not be appropriate for applications having complicated concurrency requirements..

```sh
npm install redis-mutex-semaphore
```

## Constructing Instances

**Semaphore.createSemaphoreClient(key, count, [function callback(err, result){}])**

**or Semaphore.createSemaphoreClient(key, count).then(function(result){})**
- result : semaphoreClient object for success / null or undefined for fail

**Mutex.createMutexClient(key, ttl, [function callback(err, result){}])**

**or Mutex.createMutexClient(key, ttl).then(function(result){})**

- result : mutexClient object for success / null or undefined for fail

**Whenever createXXXClient method is called, the redis key that you have passed through is also reset. So please be careful that you do not lose any context of these objects by mistakenly calling this method with the same key again in other places(other codes in the same process/other processes/other machines) while using the mutex/semaphore with the key.**

```js
var factory = require('redis-mutex-semaphore')({
  		host: '127.0.0.1',
  		port: 6379,
  		db: 1
  	});
  	
  	// or
  
var factory = require('redis-mutex-semaphore')(redisClient);	

factory.createSemaphoreClient('Key', 3 /* semaphore count */); // returns promise if callback is omitted
factory.createMutexClient('Key', 10 /* ttl : second */);  // returns promise if callback is omitted

var semaphoreClient = factory.getSemaphoreClient('Key'),
    mutexClient = factory.getMutexClient('Key');

factory.end(); 
```

## Method Usage

### 1. Using CallBack

Same as creating xxxClient methods, you can call methods with callbacks.

#### get & release method

**Semaphore.get(key, callback)**

**Semaphore.rel(callback)**

```js
semaphore.get(function(err, result){
  // if succeeds, result is 1, otherwise 0
  semaphore.rel(function(err, result){
    // result is remained count
  });
});
```

**Mutex.get(key, callback)**

**Mutex.rel(callback)**

```js
mutex.get(function(err, mutexID){
  // if succeeds, mutexID is returned, otherwise null
  mutex.rel(mutexID, function(err, result){
    // result is remained semaphore count
  });
});
```

#### wait/observe method

Both waitingFor and observe methods wait for a shared object to be released.
The difference between them is that waitingFor keeps trying to get a shared object until timedout, but observing just returns when the observed object is released.

**Semaphore/Mutex.waitingFor(timeout, function callback(err, result){})**
 - result(semaphore) : 1 for success / 0 for fail to accquire
 - result(mutex) : mutex id for success / null for fail to lock
 - err(semaphore/mutex) : timedout error or other errors returned
 
**Semaphore/Mutex.observing(timeout, function callback(err, result){})**
 - result(semaphore/mutex) : true for success / false for timedout or errors 
 - err(semaphore/mutex) : timedout error or other errors returned
 
```js
instance.waitingFor(10 /* timeout : second */, function(err, result){
  // for mutex, return value will be either mutexID or timedout err
  // for semaphore, return value will be 1 or timedout err
});

instance.observing(10 /* timeout : second */, function(err, result){
  // return value
  // success 
  // false for timedout/other errors
});

instance.getStaus(function(err, result){
  // result object contains value as string, the number of waiting, the number of observing
  // for mutex, value means mutex_id when there is mutex object named by key
  // for semaphore, value means the number of semaphore
});
```

### 2. Using Promise

If callback is omitted, you can use it with promise.

#### get & release method 

**Semaphore.get(key)**

**Semaphore.rel()**

```js
semaphore.get().then(function(result){
  // if succeeds, result is 1, otherwise 0
  // doing something
  if(result)  
    return semaphore.rel();
}).then(function(result){
  // result is remained count
}).catch(function(e){

});
```

**Mutex.get(key)**

**Mutex.rel(id)**

```js
mutex.get().then(function(mutexID){
  // if succeeds, mutexID is returned
  return Promise.resolve(mutexID);
}).then(function(mutexID){
  return mutex.rel(mutexID);
}).catch(function(e){

});
```

#### wait/observe method

**Semaphore/Mutex.waitingFor(timeout).then(function(result){}).catch(function(err){})**
 - result(semaphore) : 1 for success / 0 for fail to accquire
 - result(mutex) : mutex id for success / null for fail to lock
 - err(semaphore/mutex) : timedout error or other errors returned

**Semaphore/Mutex.observing(timeout).then(function(result){}).catch(function(err){})**
 - result(semaphore/mutex) : true for success / false for timedout or errors 
 - err(semaphore/mutex) : timedout error or other errors returned

```js
instance.waitingFor(10 /* timeout : second */).then(function(result){
  // for mutex, return value will be either mutexID
  // for semaphore, return value will be 1
}).catch(function(e){
  // e could be timed out error or others
});

instance.observing(10 /* timeout : second */).then(function(result){
  // for mutex, return value will be either true
  // for semaphore, return value will be true
}).catch(function(e){
  // e could be timed out error or others;
});

instance.getStaus().then(function(result){
  // result object contains value as string, the number of waiting, the number of observing
  // for mutex, value means mutex_id when there is mutex object named by key
  // for semaphore, value means the number of semaphore
});
```

## Others

**Checking expiry of mutex**

Mutex.on('expired', function(expired_id){});

**Reset semaphore/mutex**

Semaphore.reset(count[,callback])
Mutex.reset([callbakc])
