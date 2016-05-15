module.exports = {
	extend: {
		content: 'local muid = ARGV[1]	if redis.call("GET",KEYS[1]) == muid then	return redis.call("PEXPIRE",KEYS[1], ARGV[2])	else	return nil	end'
	}
};