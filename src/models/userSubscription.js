import mongoose from "mongoose";

const userSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    // We can store the payment ID for records
    paymentGatewayPaymentId: {
      type: String,
      required: true,
    },
    // 'active', 'expired', 'cancelled'
    status: {
      type: String,
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

const UserSubscription = mongoose.model(
  "UserSubscription",
  userSubscriptionSchema
);
export default UserSubscription;
