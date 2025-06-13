const {
  addExpense,
  getExpensesByUser,
} = require("../controllers/expense.controller");

const router = require("express").Router();

router.post("/", addExpense);

router.get("/:id", getExpensesByUser);

module.exports = router;

// localhot:3000/expenses
