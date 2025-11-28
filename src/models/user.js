import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const passwordRegex = new RegExp(
  "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{6,12})"
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: {
      type: String,
      required: true,
      minlength: [6, "Password must be at least 6 Character long"],
      validate: {
        validator: function (v) {
          return passwordRegex.test(v);
        },
        message: (props) =>
          `${props.value} does not meet password requirements (min 6, special char, etc.)`,
      },
    },

    isAdmin: {
      type: Boolean,
      required: true,
      default: false,
    },
    date: { type: Date, default: Date.now },
  },
  { timestamp: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
