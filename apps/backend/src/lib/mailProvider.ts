const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

interface SendEmailResult {
  providerMessageId: string;
}

/**
 * Sends one email via Mailgun's HTTP API and returns the message id Mailgun
 * assigns it. That id is what shows up in webhook payloads later
 * (delivered/opened events), so we store it on the CampaignRecipient row
 * to match incoming events back to the right person.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailParams): Promise<SendEmailResult> {
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

  const res = await fetch(
    `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mailgun send failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { id: string; message: string };
  // Mailgun wraps the id in angle brackets, e.g. "<2026...@sandbox...>" -
  // strip them since webhook payloads report it without brackets.
  const providerMessageId = data.id.replace(/^<|>$/g, "");
  return { providerMessageId };
}