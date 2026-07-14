import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth";
import contactsRouter from "./routes/contacts";
import audiencesRouter from "./routes/audiences";
// import campaignsRouter from "./routes/campaigns";
// import webhooksRouter from "./routes/webhooks";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true, // required so the browser sends the auth cookie
  })
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/audiences", audiencesRouter);
// app.use("/api/campaigns", campaignsRouter);
// app.use("/api/webhooks", webhooksRouter); // no requireAuth - providers call this directly

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));