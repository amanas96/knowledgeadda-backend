// import mongoose from "mongoose";

// const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(process.env.MONGO_URI);
//     console.log(`MongoDB Connected: ${conn.connection.host}`);
//   } catch (error) {
//     console.log(`Error: ${error.message}`);
//   }
// };

// export default connectDB;

import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // Check for MongoDB URI in environment variables
    const uri = process.env.MONGO_URI;

    if (!uri) {
      throw new Error("MongoDB Connection Failed.");
    }

    const conn = await mongoose.connect(uri);
    console.log(` MongoDB Connected: ${conn.connection.host}`);
    // console.log(` Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
