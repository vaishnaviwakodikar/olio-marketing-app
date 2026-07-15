import "dotenv/config";
import { Worker, Job } from "bullmq";
import { redisConnection } from "./connection";
import { CAMPAIGN_QUEUE_NAME } from "./campaignQueue";
import { prisma } from "../lib/prisma";
import { sendEmail } from "../lib/mailProvider";

interface CampaignJobData {
  campaignId: string;
}

async function processCampaignJob(job: Job<CampaignJobData>) {
  const { campaignId } = job.data;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { recipients: { include: { contact: true } } },
  });
  if (!campaign) {
    console.warn(`Campaign ${campaignId} no longer exists, skipping`);
    return;
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "SENDING" },
  });

  const matchedRecipients = campaign.recipients.filter(
    (r: (typeof campaign.recipients)[number]) => r.status !== "UNMATCHED"
  );

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of matchedRecipients) {
    const email = recipient.contact?.email ?? recipient.rawEmail;

    // Mailgun only sends email, so a contact matched purely by phone (no
    // email on file) can't actually be sent to here.
    if (!email) {
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "FAILED" },
      });
      failedCount++;
      continue;
    }

    try {
      const { providerMessageId } = await sendEmail({
        to: email,
        subject: campaign.subject,
        html: campaign.body,
      });
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "SENT", sentAt: new Date(), providerMessageId },
      });
      sentCount++;
    } catch (err) {
      console.error(`Failed to send to ${email}:`, (err as Error).message);
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "FAILED" },
      });
      failedCount++;
    }
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "SENT" },
  });

  console.log(
    `Campaign ${campaignId}: ${sentCount} sent, ${failedCount} failed`
  );
}

const worker = new Worker<CampaignJobData>(
  CAMPAIGN_QUEUE_NAME,
  processCampaignJob,
  { connection: redisConnection, concurrency: 5 }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

// The Worker opens its own blocking-read connection under the hood; same
// reasoning as the Queue's error listener above - without this, a dropped
// connection crashes the whole worker process instead of just reconnecting.
worker.on("error", (err) => {
  console.error("Worker connection error:", err.message);
});

console.log("Campaign worker started, waiting for jobs...");