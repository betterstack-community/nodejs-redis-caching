import sqlite3 from "sqlite3";

function connectToDB(filepath) {
	const db = new sqlite3.Database(filepath, (err) => {
		if (err) {
			throw err;
		}
	});

	console.log("Connected to Sqlite");

	return db;
}

function fetchUser(db, userId) {
	return new Promise((resolve, reject) => {
		db.get("SELECT * FROM user_profiles WHERE id = ?", [userId], (err, row) => {
			if (err) {
				reject(err);
			} else {
				resolve(row || null);
			}
		});
	});
}

function updateUserBio(db, userId, bio) {
	return new Promise((resolve, reject) => {
		db.get(
			"UPDATE user_profiles SET bio = ? WHERE id = ?",
			[bio, userId],
			(err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			},
		);
	});
}

export { connectToDB, fetchUser, updateUserBio };
