import crypto from "crypto";

/* ============================================================
   Verify Razorpay payment signature.
   HMAC-SHA256 of "orderId|paymentId" signed with webhook secret.
============================================================ */
export const verifyRazorpaySignature = ({
  orderId,
  paymentId,
  signature,
  secret,
}) => {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return expected === signature;
};

/* ============================================================
   Verify Razorpay webhook signature.
   HMAC-SHA256 of the raw request body signed with webhook secret.
============================================================ */
export const verifyWebhookSignature = ({ rawBody, signature, secret }) => {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return expected === signature;
};

/* ============================================================
   Calculate subscription end date from a plan.
============================================================ */
export const calcEndDate = (startDate, durationInDays) => {
  const end = new Date(startDate);
  end.setDate(end.getDate() + durationInDays);
  return end;
};

/* ============================================================
   Format an active-subscription conflict message.
============================================================ */
export const activeSubMessage = (endDate) =>
  `You already have an active subscription. It expires on ${new Date(endDate).toLocaleDateString()}`;
