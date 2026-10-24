import type {
  Category,
  DiningTable,
  Ingredient,
  MenuItem,
  ModifierGroup,
  Notification,
  Order,
  OrderLine,
  StockMovement,
} from "@/types/domain";
import { computeTotals } from "@/lib/pricing";
import { BRANCHES, TENANTS } from "./platform";
import { buildBackoffice, type BackofficeData } from "./seed-backoffice";
import { buildPeople, type PeopleData } from "./seed-people";
import { buildStage4, type Stage4Data } from "./seed-stage4";

export interface TenantDb extends BackofficeData, PeopleData, Stage4Data {
  version: number;
  categories: Category[];
  modifierGroups: ModifierGroup[];
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  movements: StockMovement[];
  tables: DiningTable[];
  orders: Order[];
  notifications: Notification[];
  orderSeq: number;
}

export const DB_VERSION = 7;

interface ItemSpec {
  cat: string;
  name: string;
  desc: string;
  price: number;
  variants?: [string, number][];
  mods?: string[];
  recipe: [string, number][];
  tags?: string[];
}

interface TenantSpec {
  categories: string[];
  modifiers: { key: string; name: string; min: number; max: number; options: [string, number][] }[];
  ingredients: [string, string, string, number, number, number][]; // key,name,unit,stock,reorder,cost
  items: ItemSpec[];
  areas: string[];
}

const SPECS: Record<string, TenantSpec> = {
  t_saffron: {
    categories: [
      "বিরিয়ানি ও পোলাও (Biryani & Polao)",
      "কারি ও রেজালা (Curries & Gravy)",
      "কাবাব ও রোস্ট (Grills & Roasts)",
      "পানীয় ও বোরহানি (Beverages & Borhani)",
      "মিষ্টি ও ডেজার্ট (Desserts & Sweets)",
    ],
    modifiers: [
      {
        key: "spice",
        name: "মশলার মাত্রা (Spice Level)",
        min: 1,
        max: 1,
        options: [
          ["রেগুলার শাহী ফ্লেভার", 0],
          ["ঝাল মেজবানি স্পাইস", 0],
        ],
      },
      {
        key: "extras",
        name: "কাচ্চি অ্যাড-অনস (Add-ons)",
        min: 0,
        max: 3,
        options: [
          ["সেদ্ধ ডিম (Extra Boiled Egg)", 25],
          ["স্পেশাল আলু (Extra Shahi Potato)", 30],
          ["আলু বোখরা চাটনি (Aloo Bokhara Chutney)", 40],
        ],
      },
      {
        key: "ice",
        name: "বরফের পরিমাণ (Ice Level)",
        min: 0,
        max: 1,
        options: [
          ["বরফ ছাড়া (No Ice)", 0],
          ["হালকা বরফ (Light Ice)", 0],
        ],
      },
    ],
    ingredients: [
      ["rice", "চিনিগুঁড়া সুগন্ধি চাল (Chinigura Rice)", "kg", 85, 25, 130],
      ["mutton", "তাজা দেশি খাসির মাংস (Fresh Desi Mutton)", "kg", 35, 10, 980],
      ["beef", "তাজা গরুর সিনার মাংস (Prime Beef Shank)", "kg", 40, 12, 780],
      ["oil", "ঘানি ভাঙা সরিষার তেল (Pure Mustard Oil)", "l", 28, 8, 290],
      ["ghee", "খাঁটি গাওয়া ঘি (Pure Desi Ghee)", "kg", 14, 4, 1200],
      ["curd", "মিষ্টি-টক দই ও ফ্রেশ দুধ (Fresh Yogurt & Milk)", "l", 45, 15, 95],
    ],
    items: [
      {
        cat: "বিরিয়ানি ও পোলাও (Biryani & Polao)",
        name: "ঢাকা শাহী কাচ্চি বিরিয়ানি (Shahi Kacchi Biryani)",
        desc: "খাসির নরম মাংস, সুগন্ধি চিনিগুঁড়া চাল, জাফরান ও শাহী আলুর নিখুঁত দমে রান্না কাচ্চি।",
        price: 480,
        variants: [["হাফ প্লেট", 0], ["ফুল প্লেট", 220]],
        mods: ["spice", "extras"],
        recipe: [["rice", 0.25], ["mutton", 0.3], ["ghee", 0.03]],
        tags: ["bestseller", "kacchi"],
      },
      {
        cat: "কারি ও রেজালা (Curries & Gravy)",
        name: "চট্টগ্রাম মেজবানি গরুর কালা ভুনা (Beef Kala Bhuna)",
        desc: "চট্টগ্রামের ঐতিহ্যবাহী খাঁটি সরিষার তেলে গাঢ় মসলায় ধীমে আঁচে কষানো গরুর কালা ভুনা।",
        price: 420,
        mods: ["spice"],
        recipe: [["beef", 0.35], ["oil", 0.04]],
        tags: ["traditional", "spicy"],
      },
      {
        cat: "কাবাব ও রোস্ট (Grills & Roasts)",
        name: "পুরান ঢাকা শাহী চিকেন রোস্ট (Old Dhaka Chicken Roast)",
        desc: "বিয়েবাড়ির স্পেশাল বাদাম বাটা, মাওয়া ও খাঁটি ঘিয়ে ভাজা সোনালী শাহী চিকেন রোস্ট।",
        price: 220,
        recipe: [["ghee", 0.03], ["oil", 0.02]],
        tags: ["wedding-special"],
      },
      {
        cat: "পানীয় ও বোরহানি (Beverages & Borhani)",
        name: "স্পেশাল মশলাদার বোরহানি (Special Spiced Borhani)",
        desc: "ঘন টক দই, পুদিনা পাতা, বিট লবণ, কাঁচা মরিচ ও শাহী জিরার খাঁটি রিফ্রেশিং বোরহানি।",
        price: 80,
        variants: [["গ্লাস (Glass 250ml)", 0], ["বড় বোতল (Bottle 1L)", 200]],
        mods: ["ice"],
        recipe: [["curd", 0.25]],
        tags: ["refreshing"],
      },
      {
        cat: "মিষ্টি ও ডেজার্ট (Desserts & Sweets)",
        name: "নবাবী শাহী টুকরা ও রাবড়ি (Nawabi Shahi Tukra)",
        desc: "ঘিয়ে মচমচে ভাজা জাফরানি টোস্ট, ঘন ক্ষীরসা, এলাচ ও পেস্তা-বাদামের রাজকীয় মিষ্টি।",
        price: 150,
        recipe: [["ghee", 0.03], ["curd", 0.2]],
        tags: ["sweet", "royal"],
      },
    ],
    areas: ["Main hall", "Lakeview Window", "VIP Cabin", "Family Hall", "Terrace Garden"],
  },
  t_harbor: {
    categories: ["Noodles", "Bao & Small plates", "Drinks"],
    modifiers: [
      { key: "broth", name: "Broth", min: 1, max: 1, options: [["Tonkotsu", 0], ["Spicy miso", 1], ["Shoyu", 0]] },
      { key: "toppings", name: "Add toppings", min: 0, max: 4, options: [["Soft egg", 2], ["Chashu", 4], ["Bok choy", 1.5], ["Chili oil", 0.5]] },
      { key: "sweet", name: "Sweetness", min: 0, max: 1, options: [["Less sweet", 0], ["No sugar", 0]] },
    ],
    ingredients: [
      ["noodles", "Fresh noodles", "kg", 30, 10, 3.2],
      ["pork", "Pork belly", "kg", 14, 6, 9.5],
      ["broth", "Broth base", "l", 60, 20, 2.1],
      ["egg", "Eggs", "pc", 120, 40, 0.3],
      ["bao", "Bao buns", "pc", 80, 30, 0.45],
      ["tofu", "Tofu", "kg", 8, 3, 4],
      ["tea", "Milk tea base", "l", 10, 4, 3],
    ],
    items: [
      { cat: "Noodles", name: "Harbor Ramen", desc: "House noodles, chashu, egg", price: 16, variants: [["Regular", 0], ["Large", 3]], mods: ["broth", "toppings"], recipe: [["noodles", 0.18], ["pork", 0.08], ["broth", 0.5], ["egg", 1]], tags: ["bestseller"] },
      { cat: "Noodles", name: "Dan Dan Noodles", desc: "Sesame, chili, pork mince", price: 14, mods: ["toppings"], recipe: [["noodles", 0.16], ["pork", 0.06]] },
      { cat: "Noodles", name: "Tofu Udon", desc: "Kombu dashi, crispy tofu", price: 15, mods: ["toppings"], recipe: [["noodles", 0.2], ["tofu", 0.12], ["broth", 0.4]], tags: ["veg"] },
      { cat: "Bao & Small plates", name: "Pork Belly Bao", desc: "Hoisin, pickles, peanuts", price: 6.5, variants: [["1 pc", 0], ["3 pcs", 11]], recipe: [["bao", 1], ["pork", 0.06]], tags: ["bestseller"] },
      { cat: "Bao & Small plates", name: "Crispy Tofu Bao", desc: "Gochujang mayo", price: 6, recipe: [["bao", 1], ["tofu", 0.06]], tags: ["veg"] },
      { cat: "Bao & Small plates", name: "Pork Gyoza", desc: "Pan-fried, 6 pcs", price: 9, recipe: [["pork", 0.08]] },
      { cat: "Drinks", name: "Brown Sugar Milk Tea", desc: "Boba, fresh milk", price: 6.5, mods: ["sweet"], recipe: [["tea", 0.3]] },
      { cat: "Drinks", name: "Yuzu Soda", desc: "Sparkling citrus", price: 5, recipe: [] },
    ],
    areas: ["Counter", "Dining room"],
  },
  t_lumen: {
    categories: ["Coffee", "Bakery"],
    modifiers: [
      { key: "milk", name: "Milk", min: 1, max: 1, options: [["Whole", 0], ["Oat", 0.5], ["Almond", 0.5]] },
      { key: "shot", name: "Extras", min: 0, max: 2, options: [["Extra shot", 0.8], ["Vanilla syrup", 0.5]] },
    ],
    ingredients: [
      ["beans", "Espresso beans", "kg", 9, 3, 24],
      ["milk", "Milk", "l", 30, 10, 1.1],
      ["butter", "Butter", "kg", 6, 2, 8],
      ["flour", "Flour", "kg", 25, 8, 0.9],
    ],
    items: [
      { cat: "Coffee", name: "Flat White", desc: "Double ristretto", price: 3.9, mods: ["milk", "shot"], recipe: [["beans", 0.018], ["milk", 0.15]] },
      { cat: "Coffee", name: "Cortado", desc: "Equal parts", price: 3.4, mods: ["milk"], recipe: [["beans", 0.018], ["milk", 0.06]] },
      { cat: "Bakery", name: "Butter Croissant", desc: "Laminated daily", price: 2.9, recipe: [["butter", 0.03], ["flour", 0.05]] },
      { cat: "Bakery", name: "Cardamom Bun", desc: "Swedish style", price: 3.5, recipe: [["butter", 0.02], ["flour", 0.06]] },
    ],
    areas: ["Café"],
  },
};

/** Deterministic PRNG so seeded history is stable across reloads. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function buildTenantSeed(tenantId: string): TenantDb {
  const tenantSpec = SPECS[tenantId];
  const tenant = TENANTS.find((targetTenant) => targetTenant.id === tenantId);
  if (!tenantSpec || !tenant) throw new Error(`Unknown tenant ${tenantId}`);
  const branches = BRANCHES.filter((branch) => branch.tenantId === tenantId);
  const tenantPrefix = tenantId.replace(/^t_/, "").slice(0, 3);

  const categories: Category[] = tenantSpec.categories.map((categoryName, categoryIndex) => ({
    id: `${tenantPrefix}_cat_${categoryIndex}`,
    tenantId,
    name: categoryName,
    sort: categoryIndex,
  }));

  const modifierGroups: ModifierGroup[] = tenantSpec.modifiers.map((modifierGroupSpec) => ({
    id: `${tenantPrefix}_mg_${modifierGroupSpec.key}`,
    tenantId,
    name: modifierGroupSpec.name,
    min: modifierGroupSpec.min,
    max: modifierGroupSpec.max,
    options: modifierGroupSpec.options.map(([optionName, optionPrice], optionIndex) => ({
      id: `${tenantPrefix}_mo_${modifierGroupSpec.key}_${optionIndex}`,
      name: optionName,
      price: optionPrice,
    })),
  }));

  const menuItems: MenuItem[] = tenantSpec.items.map((menuItemSpec, itemIndex) => ({
    id: `${tenantPrefix}_item_${itemIndex}`,
    tenantId,
    categoryId: categories[tenantSpec.categories.indexOf(menuItemSpec.cat)]!.id,
    name: menuItemSpec.name,
    description: menuItemSpec.desc,
    price: menuItemSpec.price,
    variants: (menuItemSpec.variants ?? []).map(([variantName, priceDelta], variantIndex) => ({
      id: `${tenantPrefix}_v_${itemIndex}_${variantIndex}`,
      name: variantName,
      priceDelta,
    })),
    modifierGroupIds: (menuItemSpec.mods ?? []).map((modifierGroupKey) => `${tenantPrefix}_mg_${modifierGroupKey}`),
    recipe: menuItemSpec.recipe.map(([ingredientKey, quantity]) => ({ ingredientKey, qty: quantity })),
    available: true,
    tags: menuItemSpec.tags ?? [],
  }));

  const ingredients: Ingredient[] = [];
  const tables: DiningTable[] = [];
  for (const branch of branches) {
    tenantSpec.ingredients.forEach(([ingredientKey, ingredientName, unit, currentStock, reorderLevel, unitCost]) =>
      ingredients.push({
        id: `${branch.id}_ing_${ingredientKey}`,
        tenantId,
        branchId: branch.id,
        key: ingredientKey,
        name: ingredientName,
        unit,
        stock: currentStock,
        reorderLevel,
        unitCost,
      }),
    );
    const tableCount = tenantSpec.areas.length > 1 ? 10 : 6;
    for (let tableIndex = 0; tableIndex < tableCount; tableIndex++) {
      const area = tenantSpec.areas[tableIndex < tableCount / 2 || tenantSpec.areas.length === 1 ? 0 : 1];
      const column = tableIndex % 5;
      const row = Math.floor(tableIndex / 5);
      tables.push({
        id: `${branch.id}_tbl_${tableIndex + 1}`,
        tenantId,
        branchId: branch.id,
        name: `T${tableIndex + 1}`,
        seats: [2, 4, 4, 6, 2, 4, 8, 2, 4, 4][tableIndex % 10]!,
        area: area ?? "Main",
        status: tableIndex === 3 ? "reserved" : "available",
        currentOrderId: null,
        x: column,
        y: row,
        shape: tableIndex % 10 === 6 ? "long" : tableIndex % 3 === 0 ? "round" : "square",
      });
    }
  }

  // Clean seed data: Exactly 4 orders (1 in_kitchen, 1 ready, 1 served, 1 completed)
  const orders: Order[] = [];
  const currentTimestamp = Date.now();

  for (const branch of branches) {
    // 1. IN_KITCHEN Order (Dine-in at Table 1)
    const tbl1 = tables.find((t) => t.id === `${branch.id}_tbl_1`) || tables[0];
    const lines1: OrderLine[] = [
      {
        id: "line_1001_1",
        itemId: menuItems[0]?.id || "item_1",
        name: menuItems[0]?.name || "ঢাকা শাহী কাচ্চি বিরিয়ানি",
        variantId: null,
        variantName: null,
        modifiers: [],
        qty: 2,
        unitPrice: menuItems[0]?.price || 480,
        notes: "কম ঝাল (Mild spicy)",
      },
      {
        id: "line_1001_2",
        itemId: menuItems[1]?.id || "item_2",
        name: menuItems[1]?.name || "স্পেশাল মশলাদার বোরহানি",
        variantId: null,
        variantName: null,
        modifiers: [],
        qty: 2,
        unitPrice: menuItems[1]?.price || 80,
        notes: "",
      },
    ];
    const totals1 = computeTotals({ lines: lines1, discount: null, orderType: "dine_in", taxRate: tenant.taxRate, serviceChargeRate: tenant.serviceChargeRate });
    const order1Id = `${tenantPrefix}_ord_1001`;
    const order1: Order = {
      id: order1Id,
      tenantId,
      branchId: branch.id,
      number: "#1001",
      type: "dine_in",
      tableId: tbl1?.id ?? null,
      tableName: tbl1?.name ?? "Table 1",
      customerName: "Tanvir Hossain",
      customerPhone: "+8801711223344",
      lines: lines1,
      discount: null,
      notes: "কম ঝাল (Mild spicy)",
      totals: totals1,
      status: "in_kitchen",
      kitchenStatus: "preparing",
      payments: [],
      paid: 0,
      refunds: [],
      refunded: 0,
      delivery: null,
      inventoryDeducted: true,
      createdBy: "Admin",
      createdAt: new Date(currentTimestamp - 15 * 60000).toISOString(),
      sentToKitchenAt: new Date(currentTimestamp - 15 * 60000).toISOString(),
      readyAt: null,
      completedAt: null,
    };
    if (tbl1) {
      tbl1.status = "occupied";
      tbl1.currentOrderId = order1Id;
    }
    orders.push(order1);

    // 2. READY Order (Dine-in at Table 2)
    const tbl2 = tables.find((t) => t.id === `${branch.id}_tbl_2`) || tables[1];
    const lines2: OrderLine[] = [
      {
        id: "line_1002_1",
        itemId: menuItems[2]?.id || "item_3",
        name: menuItems[2]?.name || "চট্টগ্রাম মেজবানি গরুর কালা ভুনা",
        variantId: null,
        variantName: null,
        modifiers: [],
        qty: 2,
        unitPrice: menuItems[2]?.price || 420,
        notes: "গরম গরম পরিবেশন করুন",
      },
      {
        id: "line_1002_2",
        itemId: menuItems[1]?.id || "item_2",
        name: menuItems[1]?.name || "স্পেশাল মশলাদার বোরহানি",
        variantId: null,
        variantName: null,
        modifiers: [],
        qty: 2,
        unitPrice: menuItems[1]?.price || 80,
        notes: "",
      },
    ];
    const totals2 = computeTotals({ lines: lines2, discount: null, orderType: "dine_in", taxRate: tenant.taxRate, serviceChargeRate: tenant.serviceChargeRate });
    const order2Id = `${tenantPrefix}_ord_1002`;
    const order2: Order = {
      id: order2Id,
      tenantId,
      branchId: branch.id,
      number: "#1002",
      type: "dine_in",
      tableId: tbl2?.id ?? null,
      tableName: tbl2?.name ?? "Table 2",
      customerName: "Farhana Ahmed",
      customerPhone: "+8801811223344",
      lines: lines2,
      discount: null,
      notes: "গরম গরম পরিবেশন করুন",
      totals: totals2,
      status: "ready",
      kitchenStatus: "ready",
      payments: [],
      paid: 0,
      refunds: [],
      refunded: 0,
      delivery: null,
      inventoryDeducted: true,
      createdBy: "Admin",
      createdAt: new Date(currentTimestamp - 25 * 60000).toISOString(),
      sentToKitchenAt: new Date(currentTimestamp - 25 * 60000).toISOString(),
      readyAt: new Date(currentTimestamp - 5 * 60000).toISOString(),
      completedAt: null,
    };
    if (tbl2) {
      tbl2.status = "occupied";
      tbl2.currentOrderId = order2Id;
    }
    orders.push(order2);

    // 3. SERVED Order (Dine-in at Table 3)
    const tbl3 = tables.find((t) => t.id === `${branch.id}_tbl_3`) || tables[2];
    const lines3: OrderLine[] = [
      {
        id: "line_1003_1",
        itemId: menuItems[3]?.id || "item_4",
        name: menuItems[3]?.name || "পুরান ঢাকা শাহী চিকেন রোস্ট",
        variantId: null,
        variantName: null,
        modifiers: [],
        qty: 2,
        unitPrice: menuItems[3]?.price || 220,
        notes: "",
      },
      {
        id: "line_1003_2",
        itemId: menuItems[4]?.id || "item_5",
        name: menuItems[4]?.name || "নবাবী শাহী টুকরা ও রাবড়ি",
        variantId: null,
        variantName: null,
        modifiers: [],
        qty: 2,
        unitPrice: menuItems[4]?.price || 150,
        notes: "",
      },
    ];
    const totals3 = computeTotals({ lines: lines3, discount: null, orderType: "dine_in", taxRate: tenant.taxRate, serviceChargeRate: tenant.serviceChargeRate });
    const order3Id = `${tenantPrefix}_ord_1003`;
    const order3: Order = {
      id: order3Id,
      tenantId,
      branchId: branch.id,
      number: "#1003",
      type: "dine_in",
      tableId: tbl3?.id ?? null,
      tableName: tbl3?.name ?? "Table 3",
      customerName: "Rakibul Islam",
      customerPhone: "+8801911223344",
      lines: lines3,
      discount: null,
      notes: "টেবিলে অতিরিক্ত গ্লাস প্রয়োজন",
      totals: totals3,
      status: "served",
      kitchenStatus: "bumped",
      payments: [],
      paid: 0,
      refunds: [],
      refunded: 0,
      delivery: null,
      inventoryDeducted: true,
      createdBy: "Admin",
      createdAt: new Date(currentTimestamp - 40 * 60000).toISOString(),
      sentToKitchenAt: new Date(currentTimestamp - 40 * 60000).toISOString(),
      readyAt: new Date(currentTimestamp - 20 * 60000).toISOString(),
      completedAt: null,
    };
    if (tbl3) {
      tbl3.status = "occupied";
      tbl3.currentOrderId = order3Id;
    }
    orders.push(order3);

    // 4. COMPLETED Order (Takeaway, fully paid)
    const lines4: OrderLine[] = [
      {
        id: "line_1004_1",
        itemId: menuItems[0]?.id || "item_1",
        name: menuItems[0]?.name || "ঢাকা শাহী কাচ্চি বিরিয়ানি",
        variantId: null,
        variantName: null,
        modifiers: [],
        qty: 2,
        unitPrice: menuItems[0]?.price || 480,
        notes: "",
      },
      {
        id: "line_1004_2",
        itemId: menuItems[1]?.id || "item_2",
        name: menuItems[1]?.name || "স্পেশাল মশলাদার বোরহানি",
        variantId: null,
        variantName: null,
        modifiers: [],
        qty: 2,
        unitPrice: menuItems[1]?.price || 80,
        notes: "",
      },
    ];
    const totals4 = computeTotals({ lines: lines4, discount: null, orderType: "takeaway", taxRate: tenant.taxRate, serviceChargeRate: tenant.serviceChargeRate });
    const order4Id = `${tenantPrefix}_ord_1004`;
    const order4: Order = {
      id: order4Id,
      tenantId,
      branchId: branch.id,
      number: "#1004",
      type: "takeaway",
      tableId: null,
      tableName: null,
      customerName: "Nusrat Jahan",
      customerPhone: "+8801611223344",
      lines: lines4,
      discount: null,
      notes: "পার্সেল প্যাক সম্পন্ন",
      totals: totals4,
      status: "completed",
      kitchenStatus: "bumped",
      payments: [
        {
          id: `pay_1004`,
          method: "cash",
          amount: totals4.total,
          tendered: totals4.total,
          change: 0,
          reference: "Cash Register Drawer #01",
          at: new Date(currentTimestamp - 30 * 60000).toISOString(),
        },
      ],
      paid: totals4.total,
      refunds: [],
      refunded: 0,
      delivery: null,
      inventoryDeducted: true,
      createdBy: "Admin",
      createdAt: new Date(currentTimestamp - 60 * 60000).toISOString(),
      sentToKitchenAt: new Date(currentTimestamp - 60 * 60000).toISOString(),
      readyAt: new Date(currentTimestamp - 40 * 60000).toISOString(),
      completedAt: new Date(currentTimestamp - 30 * 60000).toISOString(),
    };
    orders.push(order4);
  }

  const notifications: Notification[] = [
    {
      id: `${tenantPrefix}_n1`,
      tenantId,
      title: "Low stock",
      body: "Some ingredients are below reorder level.",
      createdAt: new Date(currentTimestamp - 3600000).toISOString(),
      read: false,
    },
    {
      id: `${tenantPrefix}_n2`,
      tenantId,
      title: "Welcome",
      body: `${tenant.name} workspace is ready (demo data).`,
      createdAt: new Date(currentTimestamp - 86400000).toISOString(),
      read: true,
    },
  ];

  const backoffice = buildBackoffice(tenantId, menuItems, ingredients, branches.map((branch) => branch.id));
  const people = buildPeople(tenantId, orders);
  const stage4 = buildStage4(tenantId);
  return {
    ...backoffice,
    ...people,
    ...stage4,
    version: DB_VERSION,
    categories,
    modifierGroups,
    menuItems,
    ingredients,
    movements: [],
    tables,
    orders,
    notifications,
    orderSeq: 1004,
  };
}
