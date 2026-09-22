const router = require("express").Router();
const db = require("../db");
const { requireAuth } = require("../auth");

router.use(requireAuth);

router.get("/me", async (req, res, next) => {
  try {
    const user = await db.query(
      "SELECT id,name,email,role,created_at FROM users WHERE id=$1",
      [req.user.sub]
    );
    const wallet = await db.query(
      "SELECT available_balance,total_invested,total_profit FROM wallets WHERE user_id=$1",
      [req.user.sub]
    );
    const transactions = await db.query(
      "SELECT id,type,amount,status,description,created_at FROM transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10",
      [req.user.sub]
    );

    res.json({
      user: user.rows[0],
      wallet: wallet.rows[0] || null,
      transactions: transactions.rows
    });
  } catch (err) {
    next(err);
  }
});

router.get("/investments", async (req, res, next) => {
  try {
    const result = await db.query(
      "SELECT id,plan_name,principal,profit,status,started_at,ends_at FROM investments WHERE user_id=$1 ORDER BY started_at DESC",
      [req.user.sub]
    );
    res.json({ investments: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post("/deposits", async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Enter a valid deposit amount." });
    }

    const result = await db.query(
      "INSERT INTO deposits (user_id,amount,status) VALUES ($1,$2,'pending') RETURNING id,amount,status,created_at",
      [req.user.sub, amount]
    );
    res.status(201).json({ deposit: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.post("/withdrawals", async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    const mobileMoneyNumber = String(req.body.mobileMoneyNumber || "").trim();

    if (!Number.isFinite(amount) || amount <= 0 || !mobileMoneyNumber) {
      return res.status(400).json({ error: "Valid amount and Mobile Money number are required." });
    }

    const result = await db.query(
      "INSERT INTO withdrawals (user_id,amount,mobile_money_number,status) VALUES ($1,$2,$3,'pending') RETURNING id,amount,mobile_money_number,status,created_at",
      [req.user.sub, amount, mobileMoneyNumber]
    );
    res.status(201).json({ withdrawal: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
