import { PrismaClient } from '../generated/client';

export async function seedTenants(prisma: PrismaClient) {
  const tenants = [
    {
      id: 't_saffron',
      slug: 'saffron-ember',
      name: 'Saffron & Ember',
      tagline: 'Charcoal grill & curry house',
      initials: 'SE',
      accent: 'oklch(0.62 0.17 42)',
      currency: 'BDT',
      locale: 'en-BD',
      taxRate: 0.075,
      serviceChargeRate: 0.05,
      receiptFooter: 'Thank you for dining with Saffron & Ember!',
      branches: [
        {
          id: 'b_se_gulshan',
          name: 'Gulshan',
          address: 'Road 11, Gulshan-2, Dhaka',
          phone: '+880 1711-000111',
        },
        {
          id: 'b_se_dhanmondi',
          name: 'Dhanmondi',
          address: 'Road 27, Dhanmondi, Dhaka',
          phone: '+880 1711-000222',
        },
      ],
    },
    {
      id: 't_harbor',
      slug: 'harbor-noodle',
      name: 'Harbor Noodle Co.',
      tagline: 'Hand-pulled noodles & bao',
      initials: 'HN',
      accent: 'oklch(0.55 0.11 205)',
      currency: 'BDT',
      locale: 'en-BD',
      taxRate: 0.0875,
      serviceChargeRate: 0,
      receiptFooter: 'Slurp responsibly. See you soon!',
      branches: [
        {
          id: 'b_hn_pier',
          name: 'Pier 39',
          address: 'Pier 39, San Francisco, CA',
          phone: '+1 415-555-0139',
        },
        {
          id: 'b_hn_mission',
          name: 'Mission',
          address: 'Valencia St, San Francisco, CA',
          phone: '+1 415-555-0172',
        },
      ],
    },
    {
      id: 't_lumen',
      slug: 'cafe-lumen',
      name: 'Café Lumen',
      tagline: 'Specialty coffee & bakery',
      initials: 'CL',
      accent: 'oklch(0.52 0.12 150)',
      currency: 'EUR',
      locale: 'de-DE',
      taxRate: 0.19,
      serviceChargeRate: 0,
      receiptFooter: 'Danke! Have a bright day.',
      branches: [
        {
          id: 'b_cl_mitte',
          name: 'Mitte',
          address: 'Torstraße 88, Berlin',
          phone: '+49 30 555 0101',
        },
      ],
    },
  ];

  for (const t of tenants) {
    const { branches, ...tenantData } = t;
    const tenant = await prisma.tenant.upsert({
      where: { slug: t.slug },
      update: {
        name: tenantData.name,
        tagline: tenantData.tagline,
        initials: tenantData.initials,
        accent: tenantData.accent,
        currency: tenantData.currency,
        locale: tenantData.locale,
        taxRate: tenantData.taxRate,
        serviceChargeRate: tenantData.serviceChargeRate,
        receiptFooter: tenantData.receiptFooter,
      },
      create: tenantData,
    });

    console.log(`Tenant seeded: ${tenant.name} (${tenant.slug})`);

    for (const b of branches) {
      await prisma.branch.upsert({
        where: {
          tenantId_name: {
            tenantId: tenant.id,
            name: b.name,
          },
        },
        update: {
          address: b.address,
          phone: b.phone,
        },
        create: {
          id: b.id,
          tenantId: tenant.id,
          name: b.name,
          address: b.address,
          phone: b.phone,
          isActive: true,
        },
      });
      console.log(`  Branch seeded: ${b.name}`);
    }
  }
}
