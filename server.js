import express from "express";
import "dotenv/config";
import process from "node:process";
import bodyParser from "body-parser";
import { connectToDB, fetchUser, updateUserBio } from "./db.js";

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;

let db;

try {
	db = connectToDB(process.env.SQLITE_FILE);
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

app.get(
	"/btc-exchange-rate/",
	async (req, res) => {
		try {
			const data = await getExchangeRates();

			res.status(200).json(data);
		} catch (error) {
			console.error("Error fetching exchange rate:", error.message);
			res.status(500).json({ error: "Unable to fetch data" });
		}
	},
);

app.get("/users/:id", async (req, res) => {
	const { id } = req.params;

	try {
		const userProfile = await fetchUser(db, id);
		if (!userProfile) {
			return res.status(404).json({ message: "User not found" });
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
		const userProfile = await fetchUser(db, id);

		userProfile.bio = bio.trim();

		await updateUserBio(db, id, userProfile.bio);

		res.json({ message: "User profile updated", user: userProfile });
	} catch (error) {
		console.error("Error updating user:", error.message);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
