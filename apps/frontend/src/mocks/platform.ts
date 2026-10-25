import type { Activation, Branch, Tenant, User } from "@/types/domain";

export const DEMO_PASSWORD = "demo1234";

export const TENANTS: Tenant[] = [
  {
    id: "t_saffron",
    slug: "saffron-ember",
    name: "Saffron & Ember",
    tagline: "Charcoal grill & curry house",
    initials: "SE",
    accent: "oklch(0.62 0.17 42)",
    currency: "BDT",
    locale: "en-BD",
    taxRate: 0.075,
    serviceChargeRate: 0.05,
    receiptFooter: "Thank you for dining with Saffron & Ember!",
  },
  {
    id: "t_harbor",
    slug: "harbor-noodle",
    name: "Harbor Noodle Co.",
    tagline: "Hand-pulled noodles & bao",
    initials: "HN",
    accent: "oklch(0.55 0.11 205)",
    currency: "BDT",
    locale: "en-BD",
    taxRate: 0.0875,
    serviceChargeRate: 0,
    receiptFooter: "Slurp responsibly. See you soon!",
  },
  {
    id: "t_lumen",
    slug: "cafe-lumen",
    name: "Café Lumen",
    tagline: "Specialty coffee & bakery",
    initials: "CL",
    accent: "oklch(0.52 0.12 150)",
    currency: "EUR",
    locale: "de-DE",
    taxRate: 0.19,
    serviceChargeRate: 0,
    receiptFooter: "Danke! Have a bright day.",
  },
];

export const BRANCHES: Branch[] = [
  { id: "b_se_gulshan", tenantId: "t_saffron", name: "Gulshan", address: "Road 11, Gulshan-2, Dhaka", phone: "+880 1711-000111" },
  { id: "b_se_dhanmondi", tenantId: "t_saffron", name: "Dhanmondi", address: "Road 27, Dhanmondi, Dhaka", phone: "+880 1711-000222" },
  { id: "4f284a78-ca30-485a-8386-b0be7ba64196", tenantId: "t_saffron", name: "Mohakhali", address: "Bir Uttam AK Khandakar Rd, Mohakhali, Dhaka", phone: "+880 1711-000333" },
  { id: "b_hn_pier", tenantId: "t_harbor", name: "Pier 39", address: "Pier 39, San Francisco, CA", phone: "+1 415-555-0139" },
  { id: "b_hn_mission", tenantId: "t_harbor", name: "Mission", address: "Valencia St, San Francisco, CA", phone: "+1 415-555-0172" },
  { id: "b_cl_mitte", tenantId: "t_lumen", name: "Mitte", address: "Torstraße 88, Berlin", phone: "+49 30 555 0101" },
];

export const USERS: User[] = [
  {
    id: "u_owner",
    name: "Nadia Rahman",
    email: "owner@demo.pos",
    initials: "NR",
    memberships: [
      { tenantId: "t_saffron", role: "owner", branchIds: "all" },
      { tenantId: "t_harbor", role: "owner", branchIds: "all" },
      { tenantId: "t_lumen", role: "owner", branchIds: "all" },
    ],
  },
  {
    id: "u_manager",
    name: "Imran Chowdhury",
    email: "manager@demo.pos",
    initials: "IC",
    memberships: [{ tenantId: "t_saffron", role: "manager", branchIds: "all" }],
  },
  {
    id: "u_cashier",
    name: "Lena Park",
    email: "cashier@demo.pos",
    initials: "LP",
    memberships: [
      { tenantId: "t_saffron", role: "cashier", branchIds: ["b_se_gulshan"] },
      { tenantId: "t_harbor", role: "cashier", branchIds: ["b_hn_pier"] },
    ],
  },
  {
    id: "u_kitchen",
    name: "Rafi Ahmed",
    email: "kitchen@demo.pos",
    initials: "RA",
    memberships: [{ tenantId: "t_saffron", role: "kitchen", branchIds: ["b_se_gulshan"] }],
  },
  {
    id: "u_waiter",
    name: "Marco Silva",
    email: "waiter@demo.pos",
    initials: "MS",
    memberships: [{ tenantId: "t_harbor", role: "waiter", branchIds: ["b_hn_pier"] }],
  },
];

/** Mock responses from the external subscription application. */
export const ACTIVATIONS: Record<string, Omit<Activation, "checkedAt">> = {
  t_saffron: { tenantId: "t_saffron", status: "active", validUntil: "2027-06-30", message: "Access active." },
  t_harbor: {
    tenantId: "t_harbor",
    status: "grace",
    validUntil: "2026-10-23",
    message: "Access is in a grace period. The account owner should resolve it in the subscription portal.",
  },
  t_lumen: {
    tenantId: "t_lumen",
    status: "inactive",
    validUntil: null,
    message: "Access to this restaurant is not active. Contact the account owner.",
  },
};
