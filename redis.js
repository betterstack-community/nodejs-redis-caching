import process from "node:process";
import redis from "redis";

const redisClient = redis.createClient({
	url: process.env.REDIS_URI,
});

redisClient.on("error", (err) => {
	console.error("Redis error:", err);
});

async function initializeRedisClient() {
	if (redisClient.isOpen) {
		return redisClient;
	}

	await redisClient.connect();
	await redisClient.ping();
	console.log("Connected to Redis");

	return redisClient;
}

export { initializeRedisClient };
