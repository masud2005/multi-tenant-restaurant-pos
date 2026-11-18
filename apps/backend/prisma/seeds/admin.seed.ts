import { PrismaClient, UserRole, UserStatus } from '../generated/client';
import * as bcrypt from 'bcrypt';

export async function seedAdmin(prisma: PrismaClient) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const plainPassword = process.env.ADMIN_PASSWORD || 'adminpassword';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const demoPasswordHash = await bcrypt.hash('demo1234', 10);

    // 1. Seed Global Owner/Admin
    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: { password: hashedPassword, role: UserRole.OWNER, status: UserStatus.ACTIVE },
        create: {
            email: adminEmail,
            password: hashedPassword,
            role: UserRole.OWNER,
            status: UserStatus.ACTIVE,
        },
    });
    console.log(`Admin user seeded: ${admin.email}`);

    // 2. Ensure TenantRoles exist for demo tenant t_saffron
    const saffron = await prisma.tenant.findFirst({
        where: { OR: [{ id: 't_saffron' }, { slug: 'saffron-ember' }] },
    });

    const rolesData = [
        {
            role: UserRole.OWNER,
            permissions: [
                'dashboard.view', 'pos.use', 'orders.view', 'orders.manage', 'orders.void',
                'discounts.apply', 'payments.process', 'payments.view', 'refunds.process',
                'cash.manage', 'kitchen.view', 'tables.view', 'tables.manage', 'inventory.view',
                'inventory.manage', 'menu.manage', 'recipes.view', 'purchasing.manage',
                'customers.manage', 'reservations.manage', 'delivery.manage', 'expenses.manage',
                'staff.manage', 'roles.view', 'branches.manage', 'promotions.manage',
                'settings.manage', 'reports.view', 'audit.view', 'notifications.view',
            ],
        },
        {
            role: UserRole.MANAGER,
            permissions: [
                'dashboard.view', 'pos.use', 'orders.view', 'orders.manage', 'orders.void',
                'discounts.apply', 'payments.process', 'payments.view', 'refunds.process',
                'cash.manage', 'kitchen.view', 'tables.view', 'tables.manage', 'inventory.view',
                'inventory.manage', 'menu.manage', 'recipes.view', 'purchasing.manage',
                'customers.manage', 'reservations.manage', 'delivery.manage', 'expenses.manage',
                'roles.view', 'promotions.manage', 'reports.view', 'audit.view', 'notifications.view',
            ],
        },
        {
            role: UserRole.CASHIER,
            permissions: [
                'pos.use', 'orders.view', 'orders.manage', 'discounts.apply',
                'payments.process', 'payments.view', 'cash.manage', 'tables.view',
                'customers.manage', 'notifications.view',
            ],
        },
        {
            role: UserRole.KITCHEN,
            permissions: ['kitchen.view', 'orders.view', 'notifications.view'],
        },
        {
            role: UserRole.WAITER,
            permissions: [
                'pos.use', 'orders.view', 'orders.manage', 'tables.view',
                'notifications.view',
            ],
        },
    ];

    const tenantRoleMap = new Map<UserRole, string>();
    if (saffron) {
        for (const r of rolesData) {
            const tr = await prisma.tenantRole.upsert({
                where: {
                    tenantId_role: {
                        tenantId: saffron.id,
                        role: r.role,
                    },
                },
                update: { permissions: r.permissions },
                create: {
                    tenantId: saffron.id,
                    role: r.role,
                    permissions: r.permissions,
                },
            });
            tenantRoleMap.set(r.role, tr.id);
        }
    }

    // 3. Seed real database accounts for standard testing roles
    const demoAccounts = [
        {
            email: 'owner@demo.pos',
            password: demoPasswordHash,
            role: UserRole.OWNER,
            name: 'Masud Rana (Owner)',
        },
        {
            email: 'manager@demo.pos',
            password: demoPasswordHash,
            role: UserRole.MANAGER,
            name: 'Tanvir Hossain (Manager)',
        },
        {
            email: 'cashier@demo.pos',
            password: demoPasswordHash,
            role: UserRole.CASHIER,
            name: 'Karim Ahmed (Cashier)',
        },
        {
            email: 'kitchen@demo.pos',
            password: demoPasswordHash,
            role: UserRole.KITCHEN,
            name: 'Chef Faruk (Kitchen Lead)',
        },
        {
            email: 'waiter@demo.pos',
            password: demoPasswordHash,
            role: UserRole.WAITER,
            name: 'Sohel Rana (Head Waiter)',
        },
    ];

    for (const acc of demoAccounts) {
        const user = await prisma.user.upsert({
            where: { email: acc.email },
            update: { password: acc.password, role: acc.role, status: UserStatus.ACTIVE },
            create: {
                email: acc.email,
                password: acc.password,
                role: acc.role,
                status: UserStatus.ACTIVE,
            },
        });

        if (saffron && tenantRoleMap.has(acc.role)) {
            const roleId = tenantRoleMap.get(acc.role)!;
            const existingStaff = await prisma.staffMember.findFirst({
                where: {
                    tenantId: saffron.id,
                    OR: [{ userId: user.id }, { email: acc.email }],
                },
            });

            if (existingStaff) {
                await prisma.staffMember.update({
                    where: { id: existingStaff.id },
                    data: {
                        userId: user.id,
                        roleId,
                        role: acc.role,
                        name: acc.name,
                        active: true,
                        isDeleted: false,
                        branchIds: ['b_se_gulshan', 'b_se_dhanmondi'],
                    },
                });
            } else {
                await prisma.staffMember.create({
                    data: {
                        tenantId: saffron.id,
                        userId: user.id,
                        roleId,
                        role: acc.role,
                        name: acc.name,
                        email: acc.email,
                        active: true,
                        isDeleted: false,
                        branchIds: ['b_se_gulshan', 'b_se_dhanmondi'],
                    },
                });
            }
        }
        console.log(`Demo user seeded in PostgreSQL: ${user.email} (${acc.role})`);
    }
}