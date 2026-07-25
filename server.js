// import "dotenv/config";
// import express from "express";
// import cors from "cors";
// import bodyParser from "body-parser";
// import router from "./routes.js";
// import { connectUsingMongoose } from "./config/mongoose.config.js";
// import { User } from "./Schema/user.schema.js";

// const app = express();


// const allowedOrigins = [
//   "http://localhost:5173", // Vite
//   "http://localhost:5174", // Vite
//   "http://localhost:3000", // optional
//   "https://auto-daddy-admin.onrender.com",
//   "https://www.auto-daddy-admin.onrender.com",
//   "https://admin.autodaddy.ca",
//   "https://www.admin.autodaddy.ca",
//   "https://auto-daddy-panel.onrender.com",
//   "https://www.auto-daddy-panel.onrender.com",
//   "https://autodaddy-shop.vercel.app",
//   "https://www.autodaddy-shop.vercel.app",
//   "https://autodaddy-admin.vercel.app",
//   "https://www.autodaddy-admin.vercel.app",
//   process.env.FRONTEND_URL
// ];

// app.use(
//   cors({
//     origin: function (origin, callback) {
//       // allow requests with no origin (Postman, curl)
//       if (!origin) return callback(null, true);

//       if (allowedOrigins.includes(origin)) {
//         callback(null, true);
//       } else {
//         callback(new Error("Not allowed by CORS"));
//       }
//     },
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );


// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// const port = process.env.PORT || 8778;

// app.use("/Uploads", express.static("Uploads"));

// app.get("/", (req, res) => {
//   res.send("Welcome to Auto Daddy App Server");
// });

// app.use("/api", router);

// app.listen(port, () => {
//   console.log(`Server running at http://localhost:${port}/`);
//   connectUsingMongoose();

// });

import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import rateLimit from "express-rate-limit";
import router from "./routes.js";
import publicRouter from "./Routers/public.routes.js";
import { connectUsingMongoose } from "./config/mongoose.config.js";
import { User } from "./Schema/user.schema.js";

const app = express();

// ─────────────────────────────────────────────────────────────
// STRICT CORS — admin panel / staff / authenticated API
// Only these known origins may call /api/* (excluding /api/public)
// ─────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173", // Vite
  "http://localhost:5174", // Vite
  "http://localhost:3000", // optional
  "https://auto-daddy-admin.onrender.com",
  "https://www.auto-daddy-admin.onrender.com",
  "https://admin.autodaddy.ca",
  "https://www.admin.autodaddy.ca",
  "https://auto-daddy-panel.onrender.com",
  "https://www.auto-daddy-panel.onrender.com",
  "https://autodaddy-shop.vercel.app",
  "https://www.autodaddy-shop.vercel.app",
  "https://autodaddy-admin.vercel.app",
  "https://www.autodaddy-admin.vercel.app",
  "https://wash-n-gloss.onrender.com",
  process.env.FRONTEND_URL,
];

const strictCors = cors({
  origin: function (origin, callback) {
    // allow requests with no origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// ─────────────────────────────────────────────────────────────
// OPEN CORS — public storefront data (read-only, no cookies)
// Any of your client brand domains can call /api/public/*
// Security is enforced by domain-scoped DB lookups inside the
// route handlers, not by CORS — nothing sensitive is ever
// returned from these endpoints.
// ─────────────────────────────────────────────────────────────
const publicCors = cors({
  origin: true,
  credentials: false,
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-site-key"],
});

// Basic abuse protection since /api/public is open to any origin
const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests / minute / IP is plenty for a storefront
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const port = process.env.PORT || 8778;

app.use("/Uploads", express.static("Uploads"));

app.get("/", (req, res) => {
  res.send("Welcome to Auto Daddy App Server");
});

// Public storefront endpoints — open CORS, rate limited, read-only
app.use("/api/public", publicCors, publicLimiter, publicRouter);

// Admin / authenticated endpoints — strict CORS allowlist
app.use("/api", strictCors, router);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
  connectUsingMongoose();
});
