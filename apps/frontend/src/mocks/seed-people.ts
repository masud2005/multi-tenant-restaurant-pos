import type {
  AttendanceRecord,
  Branch,
  CashSession,
  Customer,
  Expense,
  LoyaltySettings,
  Order,
  Promotion,
  Reservation,
  Rider,
  Shift,
  StaffMember,
} from "@/types/domain";
import { BRANCHES, USERS } from "./platform";

// Stage 3 seed: customers & loyalty, reservations, riders, cash, expenses,
// staff, shifts, attendance, branches and promotions.

export interface PeopleData {
  branches: Branch[];
  customers: Customer[];
  loyalty: LoyaltySettings;
  reservations: Reservation[];
  riders: Rider[];
  cashSessions: CashSession[];
  expenses: Expense[];
  staff: StaffMember[];
  shifts: Shift[];
  attendance: AttendanceRecord[];
  promotions: Promotion[];
}

const LOYALTY: Record<string, LoyaltySettings> = {
  t_saffron: { spendPerPoint: 100, pointValue: 1 },
  t_harbor: { spendPerPoint: 1, pointValue: 0.05 },
  t_lumen: { spendPerPoint: 1, pointValue: 0.05 },
};

const CUSTOMERS: Record<string, [string, string, string, number, number, number][]> = {
  // name, phone, email, points, visits, spent
  t_saffron: [
    ["Tanvir Hossain", "+8801711223344", "tanvir.hossain@gmail.com", 95, 12, 8500],
    ["Farhana Ahmed", "+8801811223344", "farhana.ahmed@yahoo.com", 210, 24, 16200],
    ["Rakibul Islam", "+8801911223344", "rakibul.pos@outlook.com", 14, 2, 1400],
    ["Nusrat Jahan", "+8801611223344", "nusrat.jahan@gmail.com", 480, 35, 32000],
    ["Mahmudur Rahman", "+8801511223344", "mahmud.rahman@live.com", 5, 1, 550],
  ],
  t_harbor: [
    ["Jamie Chen", "+14155550101", "jamie@mail.com", 86, 9, 86],
    ["Priya Nair", "+14155550144", "priya.n@mail.com", 412, 33, 412],
  ],
  t_lumen: [["Jonas Weber", "+4915550101", "jonas@mail.de", 54, 22, 54]],
};

const EXTRA_STAFF: Record<string, [string, StaffMember["role"], number][]> = {
  t_saffron: [["Sumaiya Islam", "waiter", 150], ["Karim Hossain", "kitchen", 180]],
  t_harbor: [["Diego Ramos", "kitchen", 22], ["Ava Thompson", "cashier", 19]],
  t_lumen: [["Mia Schulz", "cashier", 14]],
};

const RIDERS: Record<string, [string, string][]> = {
  t_saffron: [["Babul Mia", "+8801611000123"], ["Shohel Rana", "+8801611000456"]],
  t_harbor: [["Tom Becker", "+14155550190"], ["Kavita Patel", "+14155550191"]],
  t_lumen: [["Lukas Braun", "+4915550190"], ["Mia Fischer", "+4915550191"]],
};

const PROMOS: Record<string, [string, string, "percent" | "amount", number, number][]> = {
  t_saffron: [
    ["Holiday Special Feast", "HOLIDAY15", "percent", 15, 500],
    ["Winter Warmup Festival", "WINTER20", "percent", 20, 800],
    ["Puja Dhamaka Mega Offer", "PUJA100", "amount", 100, 700],
  ],
  t_harbor: [["Happy hour", "HAPPY15", "percent", 15, 20]],
  t_lumen: [["Morning combo", "MORNING1", "amount", 1, 5]],
};

const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

export function buildPeople(tenantId: string, orders: Order[]): PeopleData {
  const p = tenantId.slice(2, 5);
  const branches = BRANCHES.filter((b) => b.tenantId === tenantId).map((b) => ({ ...b }));
  const first = branches[0]!.id;
  const now = Date.now();

  const customers: Customer[] = (CUSTOMERS[tenantId] ?? []).map(([name, phone, email, points, visits, spent], i) => ({
    id: `${p}_cus_${i}`,
    tenantId,
    name,
    phone,
    email,
    notes: "",
    points,
    lifetimePoints: points,
    visits,
    totalSpent: spent,
    lastVisitAt: new Date(now - (i + 1) * 86400000 * 2).toISOString(),
    ledger: [{ id: `${p}_led_${i}`, points, reason: "Opening balance", reference: "", at: new Date(now - 30 * 86400000).toISOString() }],
    createdAt: new Date(now - 60 * 86400000).toISOString(),
  }));

  const staff: StaffMember[] = [];
  for (const u of USERS) {
    const m = u.memberships.find((x) => x.tenantId === tenantId);
    if (m) staff.push({ id: `${p}_stf_${u.id}`, tenantId, userId: u.id, name: u.name, email: u.email, phone: "", role: m.role, branchIds: m.branchIds, hourlyRate: 0, active: true });
  }
  (EXTRA_STAFF[tenantId] ?? []).forEach(([name, role, rate], i) =>
    staff.push({ id: `${p}_stf_x${i}`, tenantId, userId: null, name, email: "", phone: "", role, branchIds: branches.map((b) => b.id), hourlyRate: rate, active: true }),
  );

  const shifts: Shift[] = staff
    .filter((s) => s.role !== "owner")
    .flatMap((s, i) =>
      [0, 1, 2].map((d) => ({ id: `${p}_sh_${i}_${d}`, tenantId, branchId: first, staffId: s.id, staffName: s.name, date: day(d), start: i % 2 ? "15:00" : "09:00", end: i % 2 ? "23:00" : "17:00", notes: "" })),
    );

  const resSeedByTenant: Record<string, { name: string; phone: string; size: number; hoursAhead: number; status: Reservation["status"]; notes: string; tableNum: number }[]> = {
    t_saffron: [
      { name: "Ayesha Siddiqua", phone: "+8801711223344", size: 4, hoursAhead: 1.5, status: "booked", notes: "Window seat preferred", tableNum: 2 },
      { name: "Rahim Uddin", phone: "+8801819556677", size: 2, hoursAhead: -0.5, status: "seated", notes: "Anniversary dinner", tableNum: 1 },
      { name: "Farhana Kabir", phone: "+8801915889900", size: 6, hoursAhead: 3, status: "booked", notes: "Family gathering, birthday", tableNum: 4 },
      { name: "Tarek Hasan", phone: "+8801712001122", size: 3, hoursAhead: 25, status: "booked", notes: "Quiet corner table", tableNum: 3 },
    ],
    t_harbor: [
      { name: "Jamie Chen", phone: "+14155550101", size: 4, hoursAhead: 1.5, status: "booked", notes: "Window booth preferred", tableNum: 2 },
      { name: "Priya Nair", phone: "+14155550144", size: 2, hoursAhead: -0.5, status: "seated", notes: "Date night dinner", tableNum: 1 },
      { name: "Marcus Vance", phone: "+14155550188", size: 6, hoursAhead: 3, status: "booked", notes: "Team dinner celebration", tableNum: 4 },
      { name: "Elena Rostova", phone: "+14155550165", size: 3, hoursAhead: 25, status: "booked", notes: "Quiet table requested", tableNum: 3 },
    ],
    t_lumen: [
      { name: "Jonas Weber", phone: "+4915550101", size: 2, hoursAhead: 1, status: "booked", notes: "Business coffee meeting", tableNum: 1 },
      { name: "Clara Schmidt", phone: "+4915550102", size: 4, hoursAhead: -0.5, status: "seated", notes: "Afternoon cake gathering", tableNum: 2 },
      { name: "Felix Wagner", phone: "+4915550103", size: 5, hoursAhead: 4, status: "booked", notes: "Group study meetup", tableNum: 3 },
    ],
  };

  const reservations: Reservation[] = [];
  const templates = resSeedByTenant[tenantId] ?? resSeedByTenant["t_saffron"]!;
  branches.forEach((b) => {
    templates.forEach((tpl, i) => {
      reservations.push({
        id: `${p}_res_${b.id}_${i}`,
        tenantId,
        branchId: b.id,
        customerName: tpl.name,
        phone: tpl.phone,
        partySize: tpl.size,
        at: new Date(Math.ceil((now + tpl.hoursAhead * 3600000) / 1800000) * 1800000).toISOString(),
        durationMin: 90,
        tableId: `${b.id}_tbl_${tpl.tableNum}`,
        tableName: `T${tpl.tableNum}`,
        status: tpl.status,
        notes: tpl.notes,
        createdAt: new Date(now - 86400000).toISOString(),
      });
    });
  });

  const expenses: Expense[] = [
    ["utilities", "Electricity bill", 0.6],
    ["supplies", "Cleaning supplies", 0.08],
    ["maintenance", "Fridge repair", 0.25],
  ].map(([category, description, factor], i) => {
    const avg = orders.slice(0, 20).reduce((s, o) => s + o.totals.total, 0) / 20 || 10;
    return {
      id: `${p}_exp_${i}`,
      tenantId,
      branchId: first,
      category: category as Expense["category"],
      description: description as string,
      amount: Math.round(avg * 30 * (factor as number) * 100) / 100,
      paidFrom: "bank",
      date: day(-(i + 1) * 2),
      createdBy: "seed",
      createdAt: new Date(now - (i + 1) * 2 * 86400000).toISOString(),
    };
  });

  const promotions: Promotion[] = (PROMOS[tenantId] ?? []).map(([name, code, kind, value, minSpend], i) => {
    let startsAt = day(-14);
    let endsAt = day(30);
    let uses = 3 + i * 4;
    let maxUses: number | null = null;

    if (code === "HOLIDAY15") {
      startsAt = day(-5);
      endsAt = day(15);
      uses = 24;
      maxUses = 150;
    } else if (code === "WINTER20") {
      startsAt = day(10);
      endsAt = day(45);
      uses = 0;
      maxUses = 200;
    } else if (code === "PUJA100") {
      startsAt = day(-30);
      endsAt = day(-3);
      uses = 100;
      maxUses = 100;
    }

    return {
      id: `${p}_promo_${i}`,
      tenantId,
      name,
      code,
      kind,
      value,
      minSpend,
      startsAt,
      endsAt,
      active: true,
      uses,
      maxUses,
    };
  });

  const riders: Rider[] = (RIDERS[tenantId] ?? []).flatMap(([name, phone], i) =>
    branches.map((b) => ({ id: `${p}_rider_${b.id}_${i}`, tenantId, branchId: b.id, name, phone })),
  );

  return {
    branches,
    customers,
    loyalty: { ...(LOYALTY[tenantId] ?? { spendPerPoint: 1, pointValue: 0.05 }) },
    reservations,
    riders,
    cashSessions: [] as CashSession[],
    expenses,
    staff,
    shifts,
    attendance: [] as AttendanceRecord[],
    promotions,
  };
}
