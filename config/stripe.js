import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("[stripe] STRIPE_SECRET_KEY is not set — Stripe API calls will fail.");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20", // pin explicitly so a Stripe account-level API upgrade doesn't silently change response shapes under you
});

export default stripe;