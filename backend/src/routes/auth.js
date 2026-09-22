const router = require("express").Router();
const bcrypt = require("bcryptjs");
const db = require("../db");
const { signUser } = require("../auth");

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 8) {
      return res.status(400).json({ error: "Name, email and a password of at least 8 characters are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    if (existing.rowCount) return res.status(409).json({ error: "Email is already registered." });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3) RETURNING id,name,email,role",
      [name.trim(), normalizedEmail, passwordHash]
    );

    const user = result.rows[0];
    await db.query("INSERT INTO wallets (user_id) VALUES ($1)", [user.id]);

    res.status(201).json({ user, token: signUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

    const result = await db.query(
      "SELECT id,name,email,role,password_hash FROM users WHERE email = $1",
      [email.trim().toLowerCase()]
    );
    if (!result.rowCount) return res.status(401).json({ error: "Invalid email or password." });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password." });

    delete user.password_hash;
    res.json({ user, token: signUser(user) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
