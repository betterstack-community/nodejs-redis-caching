import express from "express";
import "dotenv/config";
import process from "node:process";

const app = express();
const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
	res.send("Hello, World!");
});

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
