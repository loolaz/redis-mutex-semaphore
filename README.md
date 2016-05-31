
[![Build Status](https://travis-ci.org/loolaz/redis-mutex-semaphore.svg?branch=master)](https://travis-ci.org/loolaz/redis-mutex-semaphore)
[![Test Coverage](https://codeclimate.com/github/loolaz/redis-mutex-semaphore/badges/coverage.svg)](https://codeclimate.com/github/loolaz/redis-mutex-semaphore/coverage)
[![Code Climate](https://codeclimate.com/github/loolaz/redis-mutex-semaphore/badges/gpa.svg)](https://codeclimate.com/github/loolaz/redis-mutex-semaphore)
[![npm version](https://badge.fury.io/js/redis-mutex-semaphore.svg)](http://badge.fury.io/js/redis-mutex-semaphore)

# redis-mutex-semaphore
This is a mutex and semaphore library which is simply implemented by using basic redis commands.

```sh
npm install redis-mutex-semaphore
```

**Note:** The minimum Redis version is 2.6.0+.

## Constructing Instances

**createSemaphoreClient(key, count, [function callback(err, result){}])**
**createSemaphoreClient(key, count).then(function(result){})**
- result : semaphoreClient object for success / null for fail

**createMutexClient(key, ttl, [function callback(err, result){}])**
**createMutexClient(key, ttl).then(function(result){})**

- result : mutexClient object for success / null for fail

Whenever createXXXClient method is called, the redis key that you have passed through is also reset. So please be careful that you do not lose any context of these objects by mistakenly calling this method with the same key again in other places(other codes in the same process/other processes/other machines) while using the mutex/semaphore with the key.

```js
var redisSharedObject = require('redis-mutex-semaphore');
var factory = redisSharedObject({
  		host: '127.0.0.1',
  		port: 6379,
  		db: 1
  	});
  	
  	// or you can reuse existing redis connection
  
var factory = redisSharedObject(redisClient);	

factory.createSemaphoreClient('Key', 3 /* initial semaphore count */, function(err, semaphoreClient){}); // returns promise if callback is omitted
factory.createMutexClient('Key', 10 /* ttl : second */, function(err, mutexClient){});  // returns promise if callback is omitted

var semaphoreClient = factory.getSemaphoreClient('Key'),
    mutexClient = factory.getMutexClient('Key');

factory.end(); 
```

## Method Usage

### 1. Using CallBack

Same as creating xxxClient methods, you can call methods with callbacks.

#### 1.1. get & release method

**semaphoreClient.get(function callback(err, result){})**
 - result : true for success / false for fail to accquire
 - if key doesn't exist, ENOTFOUNDKEY error code is returned
 
**semaphoreClient.rel(function callback(err, result){})**
 - result : the number of remained semaphore for success

```js
semaphoreClient.get(function(err, result){
  if(result){
    // doing something with semaphore
    semaphoreClient.rel(function(err, result){
  
    });
  }
});
```

**mutexClient.get(function callback(err, result){})**
 - result : mutexid(uuid v4) for success / null for failed to lock
 
**mutexClient.rel(mutexID, function callback(err, result){})**
 - result : true for sucess / false for fail to delete key
 - if incorrect mutex id is passed, ENOACCESS error code is returned

```js
mutexClient.get(function(err, mutexID){
  if(mutexID){
    //doing something with lock
    mutexClient.rel(mutexID, function(err, result){
  
    });
  }
});
```

#### 1.2. wait/observe method

Both waitingFor/waitingForWithPriority and observe methods are blocked for a shared object to be released.
The difference between them is that waitingFor is blocked until getting a lock or timedout. However observing is blocked, and just returns when the observed object is released. 

The order of dispatching waiting clients is determined by considering their waiting priorities. In the case of the redis client having multiple requests sharing the same connection, FIFO(first in, first out) policy is also applied to the waiting queue. Other observing clients and event listeners are not affected by this scheduling policy.

**semaphoreClient/mutexClient.waitingFor(timeout, function callback(err, result){})**
 - result(semaphore) : true for success / false for fail to accquire
 - result(mutex) : mutex id for success / null for fail to lock
 - err(semaphore/mutex) : ETIMEDOUT error or other errors returned

**semaphoreClient/mutexClient.waitingForWithPriority(priority, timeout, function(err, result){})**
 - same as waitingFor except priority
 - client waits for semaphore/mutex with its own priority and will be scheduled according to it.
 - err(semaphore/mutex) : ETIMEDOUT error or other errors returned

priority argument takes follows:
 - redisSharedObject.priority.HIGH : immediate execution(default)
 - redisSharedObject.priority.NORMAL : random delay between 15~20ms
 - redisSharedObject.priority.LOW : random delay between 40~45ms

You can change default priority with **semaphoreClient/mutexClient.setDefaultPriority(priority)** method.
 
**semaphoreClient/mutexClient.observing(timeout, function callback(err, result){})**
 - result(semaphore/mutex) : true for success / false when ETIMEDOUT or other errors 
 - err(semaphore/mutex) : ETIMEDOUT error or other errors returned
 
```js
var redisSharedObject = require('redis-mutex-semaphore');

...

semaphoreClient/mutexClient.waitingFor(10 /* timeout : second */, function(err, result){
  if(result)
    // doing something with semaphore/lock
});

semaphoreClient/mutexClient.waitingForWithPriority(redisSharedObject.priority.NORMAL, 10 /* timeout : second */, function(err, result){
  if(result)
    // doing something with semaphore/lock
});

semaphoreClient/mutexClient.observing(10 /* timeout : second */, function(err, result){
  if(result)
    // doing something or try to accquire/lock
});

```

### 2. Using Promise

If callback is omitted, you can use it with promise.

#### 2.1. get & release method 

**semaphoreClient.get().then(function(result){})**
 - same as callback version
 
**semaphoreClient.rel().then(function(result){})**
 - same as callback version
 
```js
semaphoreClient.get().then(function(result){
  if(result){ 
    // doing something with semaphore
    return Promise.resolve(result);
  }
  else
    // doing others or return Promise.reject()
}).then(function(result){
  if(result)
    return semaphoreClient.rel();
}).catch(function(e){

});
```

**mutexClient.get().then(function(mutexID){})**
 - same as callback version
 
**mutexClient.rel(mutexID).then(function(result){})**
 - same as callback version
 
```js
mutexClient.get().then(function(mutexID){
  if(mutexID){
    // doing something with lock
    return Promise.resolve(mutexID);
  }
  else
    // doing others or return Promise.reject()
}).then(function(mutexID){
  return mutexClient.rel(mutexID);
}).catch(function(e){

});
```

#### 2.2. wait/observe method

**semaphoreClient/mutexClient.waitingFor(timeout).then(function(result){}).catch(function(err){})**
 - same as callback version

**semaphoreClient/mutexClient.waitingForWithPriority(priority, timeout).then(function(result){}).catch(function(err){})**
 - same as callback version

priority argument takes follows:
 - same as callback version

You can change default priority with **semaphoreClient/mutexClient.setDefaultPriority(priority)** method.

**semaphoreClient/mutexClient.observing(timeout).then(function(result){}).catch(function(err){})**
 - same as callback version

```js
var redisSharedObject = require('redis-mutex-semaphore');

...

semaphoreClient/mutexClient.waitingFor(10 /* timeout : second */).then(function(result){
  if(result)
    // doing something with semaphore/lock
}).catch(function(e){
  // e could be timed out error or others
});

semaphoreClient/mutexClient.waitingForWithPriority(redisSharedObject.priority.NORMAL, 10 /* timeout : second */).then(function(result){
  if(result)
    // doing something with semaphore/lock
}).catch(function(e){
  // e could be timed out error or others
});

semaphoreClient/mutexClient.observing(10 /* timeout : second */).then(function(result){
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
semaphoreClient/mutexClient.getStaus([timeout, ] function callback(err, result){}) // callback
semaphoreClient/mutexClient.getStaus([timeout]).then(function(result){}) // promise

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
semaphoreClient/mutexClient.reset(function callback(err, result){}) // callback
semaphoreClient/mutexClient.reset().then(function(result){}) // promise

semaphoreClient/mutexClient.resetWithPublish(function callback(err, result){}) // callback
semaphoreClient/mutexClient.resetWithPublish().then(function(result){}) // promise
```

**Extend mutex timeout**

```js
mutexClient.extend(mutexID, more, function callback(err, result){}) // callback
mutexClient.extend(mutexID, more).then(function(result){}) // promise
```
 - result : true for success, otherwise false.


```js
factory.createMutexClient('key', 10); // timeout is set to 10 sec.

...

mutexClient.get(function(err, mutexID){  // mutex's is valid for 10 sec.
  if(mutexID){
    // doing something with mutex for N sec.
    mutexClient.extend(mutexID, 2, function(err, result){ // at this point, mutex is valid for 10 - N sec.
      if(result){ // succeeded to extend  
        // now mutex is valid for (10 - N + 2) sec.
        // doing something more...
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
semaphoreClient/mutexClient.on(event_name, function(arg){
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

