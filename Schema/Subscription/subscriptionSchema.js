const subscriptionSchema = new Schema({
    days: { type: Number, required: true },
    amount: { type: Number, required: true },
    subTotal: { type: Number, required: true },
    hst: { type: Number, required: true },
    hstAmount: { type: Number, required: true },
    total: { type: Number, required: true },
    purchasedOn: { type: Date, default: Date.now },
    invoiceNo: { type: String, required: true },
    paymentStatus: { type: String, enum: ["Paid", "Pending", "Failed"], default: "Paid" },
    paymentMethod: { type: String },
    referenceId: { type: String },
    remarks: { type: String },
  
    // Cashfree-specific fields (unchanged, kept for any existing/legacy records)
    cashfreeOrderToken: { type: String },
    cashfreePaymentSessionId: { type: String },
    cashfreeOrderId: { type: String },
    cashfreeStatus: { type: String },
    cashfreePayload: { type: Schema.Types.Mixed },
  
    // NEW — Stripe-specific fields (only filled if paymentMethod is "stripe")
    stripeCheckoutSessionId: { type: String },
    stripePaymentIntentId: { type: String },
    stripeCustomerId: { type: String },
    stripeStatus: { type: String }, // last seen Stripe status: "open" | "complete" | "expired" | "paid" etc.
    stripePayload: { type: Schema.Types.Mixed },
  }, { _id: false, timestamps: false });