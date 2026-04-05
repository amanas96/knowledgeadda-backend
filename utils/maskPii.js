export const MASK = "************";
const OBJECT_ID_REGEX = /\b[a-f0-9]{24}\b/gi;

const SENSITIVE_FIELDS = new Set([
  "password",
  "confirmpassword",
  "token",
  "refreshtoken",
  "accesstoken",
  "razorpaysignature",
  "razorpaypaymentid",
  "razorpayorderid",
  "key",
  "secret",
  "resettoken",
  "authorization",
]);

export const maskEmail = (email) => {
  if (typeof email !== "string" || !email.includes("@")) return MASK;
  const [user, domain] = email.split("@");
  const [, ...tld] = domain.split(".");
  return `${user[0]}***@***.${tld.join(".")}`;
};

export const maskPhone = (phone) => {
  const str = String(phone);
  return str.length > 4 ? `******${str.slice(-4)}` : MASK;
};

export const maskUrl = (url) => url.replace(OBJECT_ID_REGEX, MASK);

export const maskObject = (obj, depth = 0) => {
  if (depth > 6) return "[deeply nested]";
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((item) => maskObject(item, depth + 1));

  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => {
        const lkey = key.toLowerCase();
        if (SENSITIVE_FIELDS.has(lkey)) return [key, MASK];
        if (lkey === "email") return [key, maskEmail(value)];
        if (lkey === "phone") return [key, maskPhone(value)];
        if (typeof value === "object")
          return [key, maskObject(value, depth + 1)];
        if (typeof value === "string")
          return [key, value.replace(OBJECT_ID_REGEX, MASK)];
        return [key, value];
      }),
    );
  }

  if (typeof obj === "string") return obj.replace(OBJECT_ID_REGEX, MASK);
  return obj;
};
