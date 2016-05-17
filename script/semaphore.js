module.exports = {
	get: {
		content: 'local val = redis.call("GET",KEYS[1]) \
					if val == false then \
						return nil \
					elseif tonumber(val) > 0 then \
						return redis.call("DECR",KEYS[1]) \
					else \
						return -1 \
					end'
	}
};