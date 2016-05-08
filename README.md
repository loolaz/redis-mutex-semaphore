
[![Build Status](https://travis-ci.org/loolaz/redis-mutex-semaphore.svg?branch=master)](https://travis-ci.org/loolaz/redis-mutex-semaphore)

# redis-mutex-semaphore
This is a mutex and semaphore library which is very simply implemented by using some basic redis commands such as multi/exec(semaphore) and setnx(mutex). So it may not be appropriate for applications having complicated concurrency requirements.

```sh
npm install redis-mutex-semaphore
```

**Note:** The minimum Redis version is 2.2.0+.

## Constructing Instances

**Semaphore.createSemaphoreClient(key, count, [function callback(err, result){}])**

**or Semaphore.createSemaphoreClient(key, count).then(function(result){})**
- result : semaphoreClient object for success / null for fail

**Mutex.createMutexClient(key, ttl, [function callback(err, result){}])**

**or Mutex.createMutexClient(key, ttl).then(function(result){})**

- result : mutexClient object for success / null for fail

Whenever createXXXClient method is called, the redis key that you have passed through is also reset. So please be careful that you do not lose any context of these objects by mistakenly calling this method with the same key again in other places(other codes in the same process/other processes/other machines) while using the mutex/semaphore with the key.

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

#### 1.1. get & release method

**Semaphore.get(function callback(err, result){})**
 - result : true for success / false for fail to accquire
 
**Semaphore.rel(function callback(err, result){})**
 - result : the number of remained semaphore for success

```js
semaphore.get(function(err, result){
  if(result){
    // doing something with semaphore
    semaphore.rel(function(err, result){
  
    });
  }
});
```

**Mutex.get(function callback(err, result){})**
 - result : mutexid(uuid v4) for success / null for failed to lock
 
**Mutex.rel(function callback(err, result){})**
 - result : true for sucess / false for fail to delete key

```js
mutex.get(function(err, mutexID){
  if(mutexID){
    //doing something with lock
    mutex.rel(mutexID, function(err, result){
  
    });
  }
});
```

#### 1.2. wait/observe method

Both waitingFor and observe methods wait for a shared object to be released.
The difference between them is that waitingFor keeps trying to get a shared object until timedout, but observing just returns when the observed object is released.

**Semaphore/Mutex.waitingFor(timeout, function callback(err, result){})**
 - result(semaphore) : true for success / false for fail to accquire
 - result(mutex) : mutex id for success / null for fail to lock
 - err(semaphore/mutex) : timedout error or other errors returned
 
**Semaphore/Mutex.observing(timeout, function callback(err, result){})**
 - result(semaphore/mutex) : true for success / false for timedout or errors 
 - err(semaphore/mutex) : timedout error or other errors returned
 
```js
Semaphore/Mutex.waitingFor(10 /* timeout : second */, function(err, result){
  if(result)
    // doing something with semaphore/lock
});

Semaphore/Mutex.observing(10 /* timeout : second */, function(err, result){
  if(result)
    // doing something or try to accquire/lock
});

```

### 2. Using Promise

If callback is omitted, you can use it with promise.

#### 2.1. get & release method 

**Semaphore.get().then(function(result){})**
 - result : true for success / false for fail to accquire
 
**Semaphore.rel().then(function(result){})**
 - result : the number of remained semaphore for success
 
```js
semaphore.get().then(function(result){
  if(result){ 
    // doing something with semaphore
    return Promise.resolve(result);
  }
  else
    // doing others or return Promise.reject()
}).then(function(result){
  if(result)
    return semaphore.rel();
}).catch(function(e){

});
```

**Mutex.get().then(function(mutex_id){})**
 - result : mutexid(uuid v4) for success / null for failed to lock
 
**Mutex.rel(mutex_id).then(function(result){})**
 - result : true for sucess / false for fail to delete key
 
```js
mutex.get().then(function(mutexID){
  if(mutexID){
    // doing something with lock
    return Promise.resolve(mutexID);
  }
  else
    // doing others or return Promise.reject()
}).then(function(mutexID){
  return mutex.rel(mutexID);
}).catch(function(e){

});
```

#### 2.2. wait/observe method

**Semaphore/Mutex.waitingFor(timeout).then(function(result){}).catch(function(err){})**
 - result(semaphore) : true for success / false for timedout or errors 
 - result(mutex) : mutex id for success / null for timedout or errors 
 - err(semaphore/mutex) : timedout error or other errors returned

**Semaphore/Mutex.observing(timeout).then(function(result){}).catch(function(err){})**
 - result(semaphore/mutex) : true for success / false for timedout or errors 
 - err(semaphore/mutex) : timedout error or other errors returned

```js
Semaphore/Mutex.waitingFor(10 /* timeout : second */).then(function(result){
  if(result)
    // doing something with semaphore/lock
}).catch(function(e){
  // e could be timed out error or others
});

Semaphore/Mutex.observing(10 /* timeout : second */).then(function(result){
  if(result)
    // doing something or try to accquire/lock
}).catch(function(e){
  // e could be timed out error or others;
});
```

### 3. Others

**Checking expiry of mutex**

```js
Mutex.on('expired', function(expired_id){});
```

**Checking status of queue**

This method returns value of mutex lock or semaphore's count and the sum of waiting/observing clients in real time. 
[timeout] argument is optional, and unit is millisecond.
The default value is 1500.

```js
Semaphore/Mutex.getStaus([timeout, ] function callback(err, result){}) // callback
Semaphore/Mutex.getStaus([timeout]).then(function(result){}) // promise

/* 
sample return value
{ 
  observing: 4, // the sum of observing clients
  waiting: 3, // the sum of waiting clients
  value: 0, // mutex id(string) or semaphore count(integer)
  observingLocal: 1, // the number of observing clients in current local instance
  waitingLocal: 0 // the number of waiting clients in current local instance
}
*/

```

result object contains value, the number of waiting, the number of observing
- for mutex, value is mutex_id
- for semaphore, value is current semaphore count

**Reset semaphore/mutex**

```js
Semaphore/Mutex.reset(function callback(err, result){}) // callback
Semaphore/Mutex.reset().then(function(result){}) // promise

Semaphore/Mutex.resetWithPublish(function callback(err, result){}) // callback
Semaphore/Mutex.resetWithPublish().then(function(result){}) // promise
```
