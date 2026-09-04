import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@deanslist.live";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Site Owner",
      role: "OWNER",
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  await prisma.show.upsert({
    where: { slug: "drop-that-mike" },
    update: {},
    create: {
      slug: "drop-that-mike",
      title: "Drop That Mike",
      tagline: "Live every week. The audience controls the pot.",
      description:
        "Contestants perform live while the prize pool drains in real time. The audience decides who freezes the pot and who gets passed.",
      prizeAmount: 1000,
      status: "OPEN",
    },
  });

  console.log(`Seeded. Admin login: ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
