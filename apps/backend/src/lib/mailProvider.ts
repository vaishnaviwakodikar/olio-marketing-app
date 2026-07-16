const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  attachment?: {
    filename: string;
    mimeType: string;
    data: Buffer;
  };
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
  attachment,
}: SendEmailParams): Promise<SendEmailResult> {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    throw new Error("MAILGUN_API_KEY or MAILGUN_DOMAIN is not set");
  }

  const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");

  // Mailgun accepts attachments as multipart/form-data - urlencoded can't
  // carry binary file parts, so we build a FormData body only when there's
  // actually a PDF to attach, and keep the simpler urlencoded path for
  // plain sends.
  let res: Response;

  if (attachment) {
    const form = new FormData();
    form.set("from", `Mail App <mailgun@${MAILGUN_DOMAIN}>`);
    form.set("to", to);
    form.set("subject", subject);
    form.set("html", html);
    form.set("o:tracking", "yes");
    form.set("o:tracking-opens", "yes");
    form.set(
      "attachment",
      new Blob([attachment.data], { type: attachment.mimeType }),
      attachment.filename
    );

    res = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: form,
    });
  } else {
    const body = new URLSearchParams();
    body.set("from", `Mail App <mailgun@${MAILGUN_DOMAIN}>`);
    body.set("to", to);
    body.set("subject", subject);
    body.set("html", html);
    body.set("o:tracking", "yes");
    body.set("o:tracking-opens", "yes");

    res = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  }

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