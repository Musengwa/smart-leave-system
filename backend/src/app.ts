import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import leaveRoutes from "./routes/leave";
import chatRoutes from "./routes/chat";
import adviceRoutes from "./routes/advice";

const app = express();
const PORT = process.env.PORT ?? 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/leave", leaveRoutes);
app.use("/chat", chatRoutes);
app.use("/advice", adviceRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`LeaveAI backend running on port ${PORT}`);
});

export default app;
