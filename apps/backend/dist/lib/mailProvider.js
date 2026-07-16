"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;

async function sendEmail({ to, subject, html, }) {
    if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
        throw new Error("MAILGUN_API_KEY or MAILGUN_DOMAIN is not set");
    }
    const body = new URLSearchParams();
    body.set("from", `Mail App <mailgun@${MAILGUN_DOMAIN}>`);
    body.set("to", to);
    body.set("subject", subject);
    body.set("html", html);
    body.set("o:tracking", "yes");
    body.set("o:tracking-opens", "yes");
    const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");
    const res = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Mailgun send failed (${res.status}): ${text}`);
    }
    const data = (await res.json());
    
    const providerMessageId = data.id.replace(/^<|>$/g, "");
    return { providerMessageId };
}
