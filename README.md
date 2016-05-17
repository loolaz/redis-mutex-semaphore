
[![Build Status](https://travis-ci.org/loolaz/redis-mutex-semaphore.svg?branch=master)](https://travis-ci.org/loolaz/redis-mutex-semaphore)
[![Test Coverage](https://codeclimate.com/github/loolaz/redis-mutex-semaphore/badges/coverage.svg)](https://codeclimate.com/github/loolaz/redis-mutex-semaphore/coverage)
[![Code Climate](https://codeclimate.com/github/loolaz/redis-mutex-semaphore/badges/gpa.svg)](https://codeclimate.com/github/loolaz/redis-mutex-semaphore)
[![downloads](https://img.shields.io/npm/dm/redis-mutex-semaphore.svg?style=flat-square)](http://npm-stat.com/charts.html?package=redis-mutex-semaphore&from=2016-05-04)

# redis-mutex-semaphore
This is a mutex and semaphore library which is very simply implemented by using some basic redis commands such as multi/exec(semaphore) and setnx(mutex).

```sh
npm install redis-mutex-semaphore
```

**Note:** The minimum Redis version is 2.6.0+.

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
  	
  	// or you can reuse existing redis connection(the redis connection to be reused must have a selected db)
  
var factory = require('redis-mutex-semaphore')(redisClient);	

factory.createSemaphoreClient('Key', 3 /* initial semaphore count */); // returns promise if callback is omitted
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
 - if key doesn't exist, ENOTFOUNDKEY error code is returned
 
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
 
**Mutex.rel(mutexID, function callback(err, result){})**
 - result : true for sucess / false for fail to delete key
 - if incorrect mutex id is passed, ENOACCESS error code is returned

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

Both waitingFor/waitingForWithPriority and observe methods are blocked for a shared object to be released.
The difference between them is that waitingFor is blocked until getting a lock or timedout. However observing is blocked, and just returns when the observed object is released. 

The order of dispatching waiting clients is determined by considering their waiting priorities. In the case of the redis client having multiple requests sharing the same connection, FIFO(first in, first out) policy is also applied to the waiting queue. Other observing clients and event listeners are not affected by this scheduling policy.

**Semaphore/Mutex.waitingFor(timeout, function callback(err, result){})**
 - result(semaphore) : true for success / false for fail to accquire
 - result(mutex) : mutex id for success / null for fail to lock
 - err(semaphore/mutex) : ETIMEDOUT error or other errors returned

**Semaphore/Mutex.waitingForWithPriority(priority, timeout, function(err, result){})**
 - same as waitingFor except priority
 - client waits for semaphore/mutex with its own priority and will be scheduled according to it.
 - err(semaphore/mutex) : ETIMEDOUT error or other errors returned

priority argument takes follows:
 - require('redis-mutex-semaphore').priority.HIGH : immediate execution(default)
 - require('redis-mutex-semaphore').priority.NORMAL : random delay between 10~30ms
 - require('redis-mutex-semaphore').priority.LOW : random delay between 40~60ms

You can change default priority with **Semaphore/Mutex.setDefaultPriority(priority)** method.
 
**Semaphore/Mutex.observing(timeout, function callback(err, result){})**
 - result(semaphore/mutex) : true for success / false when ETIMEDOUT or other errors 
 - err(semaphore/mutex) : ETIMEDOUT error or other errors returned
 
```js
var factory = require('redis-mutex-semaphore')();

...

Semaphore/Mutex.waitingFor(10 /* timeout : second */, function(err, result){
  if(result)
    // doing something with semaphore/lock
});

Semaphore/Mutex.waitingForWithPriority(factory.priority.NORMAL, 10 /* timeout : second */, function(err, result){
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
 - same as callback version
 
**Semaphore.rel().then(function(result){})**
 - same as callback version
 
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

**Mutex.get().then(function(mutexID){})**
 - same as callback version
 
**Mutex.rel(mutexID).then(function(result){})**
 - same as callback version
 
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
 - same as callback version

**Semaphore/Mutex.waitingForWithPriority(priority, timeout).then(function(result){}).catch(function(err){})**
 - same as callback version

priority argument takes follows:
 - same as callback version

You can change default priority with **Semaphore/Mutex.setDefaultPriority(priority)** method.

**Semaphore/Mutex.observing(timeout).then(function(result){}).catch(function(err){})**
 - same as callback version

```js
var factory = require('redis-mutex-semaphore')();

...

Semaphore/Mutex.waitingFor(10 /* timeout : second */).then(function(result){
  if(result)
    // doing something with semaphore/lock
}).catch(function(e){
  // e could be timed out error or others
});

Semaphore/Mutex.waitingForWithPriority(factory.priority.NORMAL, 10 /* timeout : second */).then(function(result){
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

**Checking status of queue**

This method returns value of mutex lock or semaphore's count and the sum of waiting/observing clients with a short delay.
[timeout] argument is optional, and unit is millisecond.

**Note:** It just broadcasts request for status checking to every subscribing clients and waits for their responses until timeout is reached. So if clients are spread out across other processes or network, the timeout value should be big enough to get all of the responses. The default value is 300 - this value is adjusted empirically by testing on the environment that the redis server is not far away from the service using this module geographically.

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

Result object contains value, the number of waiting, the number of observing
- for mutex, value is mutex's id
- for semaphore, value is current semaphore count

**Reset semaphore/mutex**

```js
Semaphore/Mutex.reset(function callback(err, result){}) // callback
Semaphore/Mutex.reset().then(function(result){}) // promise

Semaphore/Mutex.resetWithPublish(function callback(err, result){}) // callback
Semaphore/Mutex.resetWithPublish().then(function(result){}) // promise
```

**Extend mutex timeout**

```js
Mutex.extend(mutexID, more, function callback(err, result){}) // callback
Mutex.extend(mutexID, more).then(function(result){}) // promise
```
 - result : true for success, otherwise false.


```js
factory.createMutexClient('key', 10); // timeout is set to 10 sec.

Mutex.get(function(err, mutexID){  // mutex's is valid for 10 sec.
  if(mutexID){
    // doing something with mutex for N sec.
    Mutex.extend(mutexID, 2, function(err, result){ // at this point, mutex is valid for 10 - N sec.
      if(result){ // succeeded to extend 
        // doing something more... 
        // now mutex will is valid for (10 - N + 2) sec.
      }
      else{ // faild to extend
        // mutex is already expired or failed to extend for other reasons
      }
    });
  }
  else {
    // failed to get mutex
  }
});
```

## Events

You can register listeners to the following events.

```js
Semaphore/Mutex.on(event_name, function(arg){
  // doing something
});
```

| Name                | Description   | 
|---------------------|---------------|
| semaphore_acquired  | fired with the number of remained semaphore when semaphore is acquired. | 
| semaphore_released  | fired with the number of remained semaphore when semaphore is released.   | 
| mutex_locked        | fired with mutex id when mutex is locked. | 
| mutex_unlocked      | fired when getting a lock. it always returns 1.   | 
| mutex_expired       | fired when releasing a lock. it always returns 1. this event is sent to every clients.      |
| expired             | fired when mutex is expired. it always returns 1. this event is only sent to the client which has the lock.    |

## Run Tests

```
git clone git@github.com:loolaz/redis-mutex-semaphore.git
npm install
npm test
```

## Changes
see the [CHANGELOG](https://github.com/loolaz/redis-mutex-semaphore/blob/master/CHANGELOG.md)

