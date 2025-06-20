const User = require("../models/user.schema");
const bcrypt = require("bcrypt");
const jsonwebtoken = require("jsonwebtoken");
const {
  sendConfirmationEmail,
  sendValidationAccount,
  sendInvalidEmailToken,
  sendForgotPasswordEmail,
  validateNewPassword,
} = require("../email/email");
const TempUser = require("../models/tempuser.schema");

const SECRET_KEY = process.env.SECRET_KEY;

const createTokenEmail = (email) => {
  return jsonwebtoken.sign({ email }, process.env.SECRET_KEY, {
    expiresIn: "60s",
  });
};

const signup = async (req, res) => {
  console.log(req.body);
  try {
    const { username, email, password } = req.body;
    const user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "Déjà inscrit" });
    }
    const token = createTokenEmail(email);
    await sendConfirmationEmail(email, token);
    const tempUser = new TempUser({
      username,
      email,
      password: await bcrypt.hash(password, 10),
      token,
    });
    await tempUser.save();
    res.status(201).json({
      messageOk:
        "Veulliez confirmer votre en inscription en consultant votre boite mail",
    });
  } catch (error) {
    console.log(error);
  }
};

const verifyMail = async (req, res) => {
  console.log("dans verify");

  const { token } = req.params;
  try {
    const decoded = jsonwebtoken.verify(token, process.env.SECRET_KEY);
    const tempUser = await TempUser.findOne({ email: decoded.email, token });
    if (!tempUser) {
      return res.redirect(`${process.env.CLIENT_URL}/register?message=error`);
    }
    const newUser = new User({
      username: tempUser.username,
      email: tempUser.email,
      password: tempUser.password,
    });
    await newUser.save();
    await TempUser.deleteOne({ email: tempUser.email });
    await sendValidationAccount(tempUser.email);
    res.redirect(`${process.env.CLIENT_URL}/login?message=success`);
  } catch (error) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError"
    ) {
      const tempUser = await TempUser.findOne({ token });
      if (tempUser) {
        await tempUser.deleteOne({ token });
        await sendInvalidEmailToken(tempUser.email);
      }
      return res.redirect(`${process.env.CLIENT_URL}/register?message=error`);
    }
    console.log(error);
  }
};

const signin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Email et/ou mot de passe incorrect" });
    }
    if (await bcrypt.compare(password, user.password)) {
      const { password: _, ...userWithoutPassword } = user.toObject();
      const token = jsonwebtoken.sign({}, SECRET_KEY, {
        subject: user._id.toString(),
        expiresIn: "7d",
        algorithm: "HS256",
      });
      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.status(200).json(userWithoutPassword);
    } else {
      res.status(400).json({ message: "Email et/ou mot de passe incorrect" });
    }
  } catch (error) {
    console.log(error);
  }
};

// méthodes pour mettre à jour les utilisateurs

const updateUser = async (req, res) => {
  console.log(req.body);
  try {
    const { _id, username, email } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      _id,
      {
        username,
        email,
      },
      {
        new: true,
        runValidators: true,
      }
    );
    res.status(200).json(updatedUser);
  } catch (error) {
    console.log(error);
  }
};

const updateAvatar = async (req, res) => {
  console.log(req.body);
  try {
    const { _id, avatar } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      _id,
      {
        avatar,
      },
      {
        new: true,
        runValidators: true,
      }
    );
    res.status(200).json(updatedUser);
  } catch (error) {
    console.log(error);
  }
};

const currentUser = async (req, res) => {
  const { token } = req.cookies;
  console.log(token);
  if (token) {
    try {
      const decodedToken = jsonwebtoken.verify(token, SECRET_KEY);

      const currentUser = await User.findById(decodedToken.sub);
      if (currentUser) {
        res.status(200).json(currentUser);
      } else {
        res.json(null);
      }
    } catch (error) {
      res.json(null);
    }
  } else {
    res.json(null);
  }
};

const logoutUser = async (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,
  });
  res.status(200).json({ message: "Déconnexion réussie" });
};

const forgotMyPassword = async (req, res) => {
  console.log(req.body); // {email: "john@test.fr"}
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user) {
      const token = createTokenEmail(email);
      await sendForgotPasswordEmail(email, token);
      await User.updateOne(
        { email },
        {
          resetToken: token,
        }
      );
    }
    res.json({ message: "Si un compte est associé, vous recevrez un mail" });
  } catch (error) {
    console.log(error);
  }
};

const resetPassword = async (req, res) => {
  console.log(req.body); // afficher mot de passe et token

  const { password, token } = req.body;
  try {
    // 1- Vérifier le token
    let decodedToken = jsonwebtoken.verify(token, process.env.SECRET_KEY);
    // 3- Trouvez l'utilisateur qui a ce token
    const user = await User.findOne({ resetToken: token });
    // 4- hashé le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);
    // 5- Modifier mot de passe en BDD et passer resetToken à null
    user.password = hashedPassword;
    user.resetToken = null;
    await user.save();
    // 6- Envoyer mail "mot de passe modifié"
    await validateNewPassword(user.email);
    // 7- Feedback réussite
    res.status(200).json({ messageOk: "Mot de passe mis à jour avec succès" });
  } catch (error) {
    // 2- Gestion de l'erreur
    res.status(400).json({ message: "Jeton d'authentification invalide" });
  }
};

module.exports = {
  signup,
  signin,
  updateUser,
  updateAvatar,
  currentUser,
  logoutUser,
  verifyMail,
  forgotMyPassword,
  resetPassword,
};
