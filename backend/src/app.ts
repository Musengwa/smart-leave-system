import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import leaveRoutes from "./routes/leave";
import chatRoutes from "./routes/chat";

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/leave", leaveRoutes);
app.use("/chat", chatRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`LeaveAI backend running on port ${PORT}`);
});

export default app;
