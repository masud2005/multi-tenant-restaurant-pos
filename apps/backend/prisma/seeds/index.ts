import 'dotenv/config';
import { PrismaClient } from '../generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedAdmin } from './admin.seed';
import { seedTenants } from './tenant.seed';
import { seedBangladeshiPOS } from './bangladeshi.seed';

const connectionString =
    process.env.DATABASE_URL || process.env['DATABASE_URL'];
if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Seeding database...');

    await seedAdmin(prisma);
    await seedTenants(prisma);
    await seedBangladeshiPOS(prisma);

    console.log('Database seeding completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });