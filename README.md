# redis-mutex-semaphore
This is simple mutex and semaphore library using redis.

```sh
npm install redis-mutex-semaphore
```

## Constructing Instances

**For semaphore, you can enable sharedConnection to be true if you want to use semaphore in one redis connection for some reason. This option allows to use a temporary redis connection whenever trying to acquiring a semaphore.**

```js
var factory = require('redis-mutex-semaphore')({
  		host: '127.0.0.1',
  		port: 6379,
  		db: 1
  	});
  	
  	// or
  
var factory = require('redis-mutex-semaphore')(redisClient);	

var semaphore= factory.createSemaphore('Key', 0 /* initialCount */, 3 /* maxCount */, false /* sharedConnection */);
var mutex = factory.createMutex('Key', 10 /* ttl : second */); 
```

## Usage

### 1. Using CallBack

Once you've constructed an instance of Mutex or Semaphore, you can use it with callbacks.

#### get & release method

Semaphore

```js
semaphore.get(function(err, result){
  // if succeeds, result is 1, otherwise 0
  semaphore.rel(function(err, result){
    // result is remained count
  });
});
```

Mutex

```js
mutex.get(function(err, mutexID){
  // if succeeds, mutexID is returned, otherwise null
  mutex.rel(mutexID, function(err, result){
    // result is remained semaphore count
  });
});
```

#### Common

Both waitingFor and observe methods wait for a shared object being released.
The difference between them is that waitingFor keeps trying getting a shared object until timeout, but observe just returns when the object observed by observe method is released.

```js
instance.waitingFor(10 /* timeout : second */, function(err, result){
  // for mutex, return value will be either mutexID or timedout err
  // for semaphore, return value will be 1 or timedout err
});

instance.observe(10 /* timeout : second */, function(err, result){
  // for mutex, return value will be either true or timedout err
  // for semaphore, return value will be true or timedout err
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

Semaphore

```js
semaphore.get().then(function(result){
  // if succeeds, result is 1
  // doing something
  if(result)  
    return semaphore.rel();
}).then(function(result){
  // doing something
}).catch(function(e){

});
```

Mutex

```js
mutex.get().then(function(mutexID){
  // if succeeds, mutexID is returned
  return Promise.resolve(mutexID);
}).then(function(mutexID){
  return mutex.rel(mutexID);
}).catch(function(e){

});
```

#### Common

Both waitingFor and observe methods wait for a shared object being released.
The difference between them is that waitingFor keeps trying getting a shared object until timeout, but observe just returns when the object observed by observe method is released.

```js
instance.waitingFor(10 /* timeout : second */).then(function(result){
  // for mutex, return value will be either mutexID
  // for semaphore, return value will be 1
}).catch(function(e){
  // e could be timed out error or others
});

instance.observe(10 /* timeout : second */).then(function(result){
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
