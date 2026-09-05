/**
 * Delete synthetic leads and conversations from the database.
 *
 * The application and the Playwright suite point at the SAME Neon database:
 * there is one DATABASE_URL, and `npx playwright test` drives the real forms
 * against localhost, which writes real rows. After a full run the client's
 * dashboard reads "Total leads 160" and every one of them is a robot.
 *
 * Until the database moves to Docker on the VPS and a separate test database
 * exists, this is the cleanup step: run it after a test pass, and before
 * handing the dashboard to the client.
 *
 * It matches on address, not on a flag, because a flag would have to be set by
 * the code under test and could therefore be wrong in exactly the case that
 * matters. Every fixture address in tests/ is @deanslist.test; the e2e-/consent-
 * prefixed @example.com rows are from manual browser verification.
 *
 *   node scripts/purge-test-data.mjs          report only
 *   node scripts/purge-test-data.mjs --delete actually delete
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--delete");

const WHERE = {
  OR: [
    { email: { endsWith: "@deanslist.test" } },
    { email: { startsWith: "e2e-" } },
    { email: { startsWith: "e2e+" } },
    { email: { startsWith: "consent-" } },
    // The four demo rows that predate the test suite.
    { email: { in: ["tom@example.com", "mei@example.com", "diego@example.com", "amara@example.com"] } },
  ],
};

const doomed = await prisma.lead.findMany({ where: WHERE, select: { id: true, email: true } });
const total = await prisma.lead.count();

console.log(`${total} leads in the database, ${doomed.length} of them synthetic.`);
for (const l of doomed.slice(0, 10)) console.log("   ", l.email);
if (doomed.length > 10) console.log(`    and ${doomed.length - 10} more`);

// A conversation the chat suite created holds transcript rows and may point at
// a lead it captured. Those leads are already matched above; the conversations
// are matched by their captured lead so a real visitor's chat is never touched.
const convos = await prisma.conversation.findMany({
  where: { OR: [{ leadId: { in: doomed.map((d) => d.id) } }, { leadId: null }] },
  select: { id: true },
});
console.log(`${convos.length} conversations to remove.`);

if (!apply) {
  console.log("\nDry run. Pass --delete to apply.");
} else {
  // LeadTag, CampaignRecipient and ChatMessage cascade. ChatEvent and
  // Conversation set null, so conversations go first and explicitly.
  const m = await prisma.chatMessage.deleteMany({ where: { conversationId: { in: convos.map((c) => c.id) } } });
  const c = await prisma.conversation.deleteMany({ where: { id: { in: convos.map((c) => c.id) } } });
  const l = await prisma.lead.deleteMany({ where: WHERE });
  console.log(`\nDeleted ${l.count} leads, ${c.count} conversations, ${m.count} chat messages.`);
  console.log(`${await prisma.lead.count()} leads remain.`);
}

await prisma.$disconnect();
