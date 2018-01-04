# CHANGELOG

## 0.3.6

* getXXXClient method creates an object when there is no available object

## 0.3.4

* Fixed the bug that constructor's callback was not returned

## 0.3.3

* Minor bug fix

## 0.3.2

* Changed configuration value for(delay time) waitingForWithPriority
* Modified README instruction

## 0.3.1

* Fixed potential buts in some test cases
* Modified incorrect README instruction
* Modified ci configuration

## 0.3.0

* Removed setNewConnectionPerTransaction method(You don't need to call this method any more in any case)
* Changed minimum Redis version(2.2.0 => 2.6.0)
* Fixed potential bugs in some test cases
* Code Refactoring

## 0.2.12

* Added Mutex extend method(Redis 2.6.0+)
* Added changelog


## 0.2.10

* Changed default timeout value for getStatus method to 300ms
* Changed waiting priority setting
* Fixed minor bugs
