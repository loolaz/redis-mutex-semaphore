
[![Build Status](https://travis-ci.org/loolaz/redis-mutex-semaphore.svg?branch=master)](https://travis-ci.org/loolaz/redis-mutex-semaphore)

# redis-mutex-semaphore
This is a mutex and semaphore library which is very simply implemented by using some basic redis commands such as multi/exec(semaphore) and setnx(mutex). So it may not be appropriate for applications having complicated concurrency requirements.

```sh
npm install redis-mutex-semaphore
```

## Constructing Instances

**Semaphore.createSemaphoreClient(key, count, [function callback(err, result){}])**

**or Semaphore.createSemaphoreClient(key, count).then(function(result){})**
- result : semaphoreClient object for success / null for fail

**Mutex.createMutexClient(key, ttl, [function callback(err, result){}])**

**or Mutex.createMutexClient(key, ttl).then(function(result){})**

- result : mutexClient object for success / null for fail

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

**Semaphore.get(key, function callback(err, result){})**
 - result : 1 for success / 0 for fail to accquire
 
**Semaphore.rel(function callback(err, result){})**
 - result : the number of remained semaphore for success

```js
semaphore.get(function(err, result){

  semaphore.rel(function(err, result){

  });
});
```

**Mutex.get(key, function callback(err, result){})**
 - result : mutexid(uuid v4) for success / null for failed to lock
 
**Mutex.rel(function callback(err, result){})**
 - result : true for sucess / false for fail to delete key

```js
mutex.get(function(err, mutexID){

  mutex.rel(mutexID, function(err, result){

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
Semaphore/Mutex.waitingFor(10 /* timeout : second */, function(err, result){

});

Semaphore/Mutex.observing(10 /* timeout : second */, function(err, result){

});

```

### 2. Using Promise

If callback is omitted, you can use it with promise.

#### get & release method 

**Semaphore.get(key).then(function(result){})**
 - result : 1 for success / 0 for fail to accquire
 
**Semaphore.rel().then(function(result){})**
 - result : the number of remained semaphore for success
 
```js
semaphore.get().then(function(result){

  if(result)  
    return semaphore.rel();
}).then(function(result){

}).catch(function(e){

});
```

**Mutex.get(key).then(function(mutex_id){})**
 - result : mutexid(uuid v4) for success / null for failed to lock
 
**Mutex.rel(mutex_id).then(function(result){})**
 - result : true for sucess / false for fail to delete key
 
```js
mutex.get().then(function(mutexID){

  return Promise.resolve(mutexID);
}).then(function(mutexID){

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
Semaphore/Mutex.waitingFor(10 /* timeout : second */).then(function(result){

}).catch(function(e){
  // e could be timed out error or others
});

Semaphore/Mutex.observing(10 /* timeout : second */).then(function(result){

}).catch(function(e){
  // e could be timed out error or others;
});
```

## Others

**Checking expiry of mutex**

```js
Mutex.on('expired', function(expired_id){});
```

**Checking status of queue**

```js
Semaphore/Mutex.getStaus(function callback(err, result){}) // callback
Semaphore/Mutex.getStaus().then(function(result){}) // promise
```

result object contains value, the number of waiting, the number of observing
- for mutex, value is mutex_id
- for semaphore, value is current semaphore count

**Reset semaphore/mutex**

```js
Semaphore.reset(count, function callback(err, result){}) // callback
Semaphore.reset(count).then(function(result){}) // promise

Mutex.reset(function callback(err, result){}) // callback
Mutex.reset().then(function(result){}) // promise
```
