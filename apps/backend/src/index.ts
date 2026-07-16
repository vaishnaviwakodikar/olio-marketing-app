import "dotenv/config";
// Side-effect import: patches Express so a rejected promise inside any
// async route handler is automatically passed to next(err) instead of
// becoming an unhandled rejection that crashes the whole process. This is
// what was happening on the Neon cold-start timeout - a single DB blip
// took the entire server down instead of just failing that one request.
import "express-async-errors";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth";
import contactsRouter from "./routes/contacts";
import audiencesRouter from "./routes/audiences";
import campaignsRouter from "./routes/campaigns";
import webhooksRouter from "./routes/webhooks";

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
app.use("/api/campaigns", campaignsRouter);
app.use("/api/webhooks", webhooksRouter); // no requireAuth - providers call this directly

app.get("/health", (_req, res) => res.json({ ok: true }));

// Final error handler - catches anything passed via next(err), including
// the auto-forwarded async errors above. Must be registered last, and
// must keep all four parameters (err, req, res, next) even though `next`
// is unused, since Express uses the handler's arity to identify it as an
// error handler.
app.use(
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled request error:", err.message);
    if (res.headersSent) return;
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
);

// Extra safety net: log genuinely unexpected errors that slip past even
// the above (e.g. thrown outside a request, or in the worker's own
// startup code) without letting them silently take the process down.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));