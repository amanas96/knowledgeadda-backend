import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true, // e.g., "Monthly Test Series"
    },
    price: {
      type: Number,
      required: true, // Price in your currency (e..g, 499)
    },
    durationInDays: {
      type: Number,
      required: true, // e.g., 30 for monthly, 180 for 6-month
    },
    // This is the ID from your payment provider (Stripe, Razorpay)
    // It helps link your DB plan to the payment gateway plan.
    paymentGatewayPlanId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const SubscriptionPlan = mongoose.model(
  "SubscriptionPlan",
  subscriptionPlanSchema
);

export default SubscriptionPlan;
