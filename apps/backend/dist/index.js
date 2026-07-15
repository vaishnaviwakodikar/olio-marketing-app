"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const auth_1 = __importDefault(require("./routes/auth"));
const contacts_1 = __importDefault(require("./routes/contacts"));
const audiences_1 = __importDefault(require("./routes/audiences"));
const campaigns_1 = __importDefault(require("./routes/campaigns"));
const webhooks_1 = __importDefault(require("./routes/webhooks"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true, // required so the browser sends the auth cookie
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use("/api/auth", auth_1.default);
app.use("/api/contacts", contacts_1.default);
app.use("/api/audiences", audiences_1.default);
app.use("/api/campaigns", campaigns_1.default);
app.use("/api/webhooks", webhooks_1.default); // no requireAuth - providers call this directly
app.get("/health", (_req, res) => res.json({ ok: true }));
const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
//# sourceMappingURL=index.js.map