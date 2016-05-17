module.exports = {
	extend: {
		content: 'local muid = ARGV[1] \
					if redis.call("GET",KEYS[1]) == muid then \
						return redis.call("PEXPIRE",KEYS[1], ARGV[2]) \
					else \
						return nil \
					end'
	},
	get: {
		content: 'if redis.call("SETNX",KEYS[1], ARGV[1]) == 1 then	\
						if redis.call("PEXPIRE",KEYS[1], ARGV[2]) == 1 then	\
							return 1 \
						else \
							redis.call("DEL", KEYS[1]) \
							return nil \
						end \
					else \
						return nil \
					end'
	},
	rel: {
		content: 'local muid = redis.call("GET",KEYS[1]) \
					if muid == false then \
						return nil \
					elseif muid == ARGV[1]	then \
						return redis.call("DEL",KEYS[1]) \
					else \
						return -1 \
					end'
	}
};