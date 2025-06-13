const {
  signup,
  signin,
  updateUser,
  updateAvatar,
  currentUser,
  logoutUser,
  verifyMail,
  forgotMyPassword,
  resetPassword,
} = require("../controllers/user.controller");

const router = require("express").Router();

// POST

router.post("/", signup);
router.post("/login", signin);
router.post("/forgotPassword", forgotMyPassword);
router.post("/resetPassword", resetPassword);

// UPDATE

router.put("/", updateUser);
router.put("/avatar", updateAvatar);

// GET

router.get("/currentUser", currentUser);
router.get("/verifyMail/:token", verifyMail);

// DELETE

router.delete("/deleteToken", logoutUser);

module.exports = router;

// localhost:3000/user
