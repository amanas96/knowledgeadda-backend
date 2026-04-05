import jwt from "jsonwebtoken";

/**
 * Generates a short-lived Access Token.
 * @param {string} id - The user's ID.
 */
export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRATION,
    }
  );
};

/**
 * Generates a long-lived Refresh Token.
 * @param {string} id - The user's ID.
 */
export const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRATION,
  });
};

/**
 * Generates a single-use Reset Password Token.
 * @param {string} id - The user's ID.
 */
export const generateResetToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_RESET_SECRET, {
    expiresIn: process.env.JWT_RESET_EXPIRATION,
  });
};
