import express from "express";
import "dotenv/config";
import process from "node:process";
import bodyParser from "body-parser";
import hash from "object-hash";
import { connectToDB, fetchUser, updateUserBio } from "./db.js";
import { initializeRedisClient } from "./redis.js";

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;
const CACHE_PREFIX = "express-demo";

let db;
let redisClient;

try {
	db = connectToDB(process.env.SQLITE_FILE);
	redisClient = await initializeRedisClient();
} catch (err) {
	console.error(err);
	process.exit();
}

app.get("/", (req, res) => {
	res.send("Hello, World!");
});

async function getExchangeRates() {
	const response = await fetch(
		"https://api.coingecko.com/api/v3/exchange_rates",
		{
			headers: {
				Accept: "application/json",
			},
		},
	);
	return await response.json();
}

function redisCachingMiddleware(
	opts = {
		EX: 300,
	},
) {
	return async (req, res, next) => {
		try {
			// Construct the cache key based on the request
			const cacheKey = `${CACHE_PREFIX}:${generateCacheKeyFromReq(req)}`;
			console.log("Cache key is", cacheKey);

			// Check if data exists in Redis cache
			const cachedData = await redisClient.get(cacheKey);
			if (cachedData) {
				console.log(`Cache hit for ${req.originalUrl}`);
				// If data exists, parse and send the cached response
				const parsedData = JSON.parse(cachedData);
				return res.json(parsedData);
			}

			console.log(`Cache miss for ${req.originalUrl}`);
			// If data not in cache, proceed to the next middleware/route handler
			res.handlerSend = res.send; // Store original res.send
			res.send = async (body) => {
				res.send = res.handlerSend;

				// Cache the response data before sending it on 2xx codes only
				if (res.statusCode.toString().startsWith("2")) {
					await redisClient.set(cacheKey, body, opts);
				}

				return res.send(body);
			};

			next();
		} catch (error) {
			console.error("Error in redisCachingMiddleware:", error);
			next(error); // Pass the error to the error handling middleware
		}
	};
}

function generateCacheKeyFromReq(req) {
	const data = {
		query: req.query,
		body: req.body,
		headers: req.headers,
	};

	return `${req.path}:${hash(data)}`;
}

app.get(
	"/btc-exchange-rate/",
	redisCachingMiddleware({
		EX: 600,
	}),
	async (req, res) => {
		try {
			// Fetch exchange data from the external API
			const data = await getExchangeRates();

			// Respond with API data
			res.status(200).json(data);
		} catch (error) {
			console.error("Error fetching exchange rate:", error.message);
			res.status(500).json({ error: "Unable to fetch data" });
		}
	},
);

function getUserCacheKey(id) {
	return `${CACHE_PREFIX}:user:${id}`;
}

async function getUserProfile(id) {
	const cachedProfile = await redisClient.get(getUserCacheKey(id));
	if (cachedProfile) {
		console.log("Cache hit for user:", id);
		return [JSON.parse(cachedProfile), true];
	}

	console.log("Cache miss for user:", id);

	const userProfile = await fetchUser(db, id);
	return [userProfile, false];
}

app.get("/users/:id", async (req, res) => {
	const { id } = req.params;

	try {
		const [userProfile, cacheHit] = await getUserProfile(id);
		if (!userProfile) {
			return res.status(404).json({ message: "User not found" });
		}

		if (!cacheHit) {
			await redisClient.set(getUserCacheKey(id), JSON.stringify(userProfile), {
				EX: 300,
			});
		}

		res.json(userProfile);
	} catch (error) {
		console.error("Error fetching user:", error.message);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.put("/users/:id/bio", async (req, res) => {
	const { id } = req.params;
	const { bio } = req.body;

	try {
		const [userProfile] = await getUserProfile(id);

		userProfile.bio = bio.trim();

		await updateUserBio(db, id, userProfile.bio);

		// Update the cache (write-through)
		await redisClient.set(getUserCacheKey(id), JSON.stringify(userProfile), {
			EX: 300,
		});

		res.json({ message: "User profile updated", user: userProfile });
	} catch (error) {
		console.error("Error updating user:", error.message);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
