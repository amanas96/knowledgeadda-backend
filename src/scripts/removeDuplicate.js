// scripts/removeAdminSubscriptions.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

await mongoose.connect(process.env.MONGO_URI);

const db = mongoose.connection.db;

// find all admin users
const admins = await db.collection("users").find({ isAdmin: true }).toArray();

console.log(`Found ${admins.length} admin(s)`);

let removed = 0;

for (const admin of admins) {
  const result = await db
    .collection("usersubscriptions")
    .deleteMany({ user: admin._id });

  if (result.deletedCount > 0) {
    console.log(
      `✅ Removed ${result.deletedCount} subscription(s) for admin: ${admin.email}`,
    );
    removed += result.deletedCount;
  } else {
    console.log(`⏭ No subscriptions found for admin: ${admin.email}`);
  }

  // also set isSubscribed to false for admin
  await db
    .collection("users")
    .updateOne({ _id: admin._id }, { $set: { isSubscribed: false } });
}

console.log(`Migration complete — ${removed} admin subscription(s) removed`);
await mongoose.disconnect();
