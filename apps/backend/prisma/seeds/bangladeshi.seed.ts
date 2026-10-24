import {
  DiscountKind,
  MovementReason,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PrismaClient,
  PurchaseOrderStatus,
  TableStatus,
} from '../generated/client';

export async function seedBangladeshiPOS(prisma: PrismaClient) {
  console.log('\n--- Seeding Authentic Bangladeshi Restaurant Data (Saffron & Ember) ---');

  // 1. Get primary tenant and branches
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'saffron-ember' },
    include: { branches: true },
  });

  if (!tenant) {
    console.warn('Tenant saffron-ember not found! Skipping Bangladeshi seed.');
    return;
  }

  const gulshanBranch = tenant.branches.find((b) => b.name === 'Gulshan') || tenant.branches[0];
  const dhanmondiBranch = tenant.branches.find((b) => b.name === 'Dhanmondi') || tenant.branches[1] || gulshanBranch;

  console.log(`Target Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`Primary Branch: ${gulshanBranch.name} (${gulshanBranch.id})`);

  // ==========================================
  // 2. Categories (5 Authentic Categories)
  // ==========================================
  const categoriesData = [
    {
      id: 'c_se_biryani',
      name: 'বিরিয়ানি ও পোলাও (Biryani & Polao)',
      sort: 1,
      description: 'ঐতিহ্যবাহী পুরান ঢাকার কাচ্চি, জাফরানি পোলাও ও বিরিয়ানি',
    },
    {
      id: 'c_se_curry',
      name: 'কারি ও রেজালা (Curries & Gravy)',
      sort: 2,
      description: 'ধীমে আঁচে রান্না করা মেজবানি মাংস, শাহী রেজালা ও কালা ভুনা',
    },
    {
      id: 'c_se_grills',
      name: 'কাবাব ও রোস্ট (Grills & Roasts)',
      sort: 3,
      description: 'বিয়েবাড়ির শাহী রোস্ট, চারকোল শিক কাবাব ও ফ্রাই',
    },
    {
      id: 'c_se_drinks',
      name: 'পানীয় ও বোরহানি (Beverages & Borhani)',
      sort: 4,
      description: 'ঐতিহ্যবাহী মশলাদার বোরহানি, জাফরানি লাবাং ও মাঠা',
    },
    {
      id: 'c_se_desserts',
      name: 'মিষ্টি ও ডেজার্ট (Desserts & Sweets)',
      sort: 5,
      description: 'খাঁটি গাওয়া ঘি ও ক্ষীরসার তৈরি নবাবী মিষ্টান্ন',
    },
  ];

  const categories: Record<string, string> = {};
  for (const c of categoriesData) {
    const cat = await prisma.category.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: c.name,
        },
      },
      update: {
        sort: c.sort,
        description: c.description,
        isActive: true,
      },
      create: {
        id: c.id,
        tenantId: tenant.id,
        name: c.name,
        sort: c.sort,
        description: c.description,
        isActive: true,
      },
    });
    categories[c.id] = cat.id;
  }
  console.log(`Seeded ${categoriesData.length} Categories.`);

  // ==========================================
  // 3. Modifier Groups & Options
  // ==========================================
  let addonGroup = await prisma.modifierGroup.findFirst({
    where: { tenantId: tenant.id, name: 'কাচ্চি অ্যাড-অনস (Add-ons)', isDeleted: false },
  });
  if (!addonGroup) {
    addonGroup = await prisma.modifierGroup.create({
      data: {
        tenantId: tenant.id,
        name: 'কাচ্চি অ্যাড-অনস (Add-ons)',
        min: 0,
        max: 3,
        isRequired: false,
        options: {
          create: [
            { name: 'সেদ্ধ ডিম (Extra Boiled Egg)', price: 25 },
            { name: 'স্পেশাল আলু (Extra Shahi Potato)', price: 30 },
            { name: 'আলু বোখরা চাটনি (Aloo Bokhara Chutney)', price: 40 },
          ],
        },
      },
    });
  }

  let spiceGroup = await prisma.modifierGroup.findFirst({
    where: { tenantId: tenant.id, name: 'মশলার মাত্রা (Spice Level)', isDeleted: false },
  });
  if (!spiceGroup) {
    spiceGroup = await prisma.modifierGroup.create({
      data: {
        tenantId: tenant.id,
        name: 'মশলার মাত্রা (Spice Level)',
        min: 1,
        max: 1,
        isRequired: true,
        options: {
          create: [
            { name: 'রেগুলার শাহী ফ্লেভার (Regular Mild)', price: 0 },
            { name: 'ঝাল মেজবানি স্পাইস (Extra Spicy)', price: 0 },
          ],
        },
      },
    });
  }

  // ==========================================
  // 4. Ingredients & Branch Stock
  // ==========================================
  const ingredientsData = [
    {
      id: 'ing_se_rice',
      name: 'চিনিগুঁড়া সুগন্ধি চাল (Chinigura Rice)',
      code: 'ING-RICE-01',
      category: 'Grains & Rice',
      storageType: 'Dry Storage',
      unit: 'kg',
      costPerUnit: 130,
      stockGulshan: 85.0,
      stockDhanmondi: 45.0,
      reorder: 25.0,
      ideal: 150.0,
    },
    {
      id: 'ing_se_mutton',
      name: 'তাজা দেশি খাসির মাংস (Fresh Desi Mutton)',
      code: 'ING-MUTT-01',
      category: 'Meat & Poultry',
      storageType: 'Cold Storage / Freezer',
      unit: 'kg',
      costPerUnit: 980,
      stockGulshan: 35.0,
      stockDhanmondi: 20.0,
      reorder: 10.0,
      ideal: 60.0,
    },
    {
      id: 'ing_se_beef',
      name: 'তাজা গরুর সিনার মাংস (Prime Beef Shank)',
      code: 'ING-BEEF-01',
      category: 'Meat & Poultry',
      storageType: 'Cold Storage / Freezer',
      unit: 'kg',
      costPerUnit: 780,
      stockGulshan: 40.0,
      stockDhanmondi: 25.0,
      reorder: 12.0,
      ideal: 70.0,
    },
    {
      id: 'ing_se_mustard_oil',
      name: 'ঘানি ভাঙা সরিষার তেল (Pure Mustard Oil)',
      code: 'ING-OIL-01',
      category: 'Oils & Condiments',
      storageType: 'Dry Storage',
      unit: 'l',
      costPerUnit: 290,
      stockGulshan: 28.0,
      stockDhanmondi: 15.0,
      reorder: 8.0,
      ideal: 50.0,
    },
    {
      id: 'ing_se_ghee',
      name: 'খাঁটি গাওয়া ঘি (Pure Desi Ghee)',
      code: 'ING-GHEE-01',
      category: 'Dairy & Fats',
      storageType: 'Dry Storage / Cool',
      unit: 'kg',
      costPerUnit: 1200,
      stockGulshan: 14.0,
      stockDhanmondi: 8.0,
      reorder: 4.0,
      ideal: 25.0,
    },
    {
      id: 'ing_se_borhani_curd',
      name: 'মিষ্টি-টক দই ও ফ্রেশ দুধ (Fresh Yogurt & Milk)',
      code: 'ING-DAIRY-01',
      category: 'Dairy & Fats',
      storageType: 'Chiller',
      unit: 'l',
      costPerUnit: 95,
      stockGulshan: 45.0,
      stockDhanmondi: 20.0,
      reorder: 15.0,
      ideal: 80.0,
    },
  ];

  const ingredientMap: Record<string, string> = {};
  for (const ing of ingredientsData) {
    const item = await prisma.ingredient.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: ing.name,
        },
      },
      update: {
        code: ing.code,
        category: ing.category,
        storageType: ing.storageType,
        unit: ing.unit,
        costPerUnit: ing.costPerUnit,
        isActive: true,
      },
      create: {
        id: ing.id,
        tenantId: tenant.id,
        name: ing.name,
        code: ing.code,
        category: ing.category,
        storageType: ing.storageType,
        unit: ing.unit,
        costPerUnit: ing.costPerUnit,
        isActive: true,
      },
    });
    ingredientMap[ing.id] = item.id;

    // Branch stock - Gulshan
    await prisma.branchStock.upsert({
      where: {
        branchId_ingredientId: {
          branchId: gulshanBranch.id,
          ingredientId: item.id,
        },
      },
      update: {
        currentStock: ing.stockGulshan,
        reorderLevel: ing.reorder,
        idealStock: ing.ideal,
        unitCost: ing.costPerUnit,
        lastRestockedAt: new Date(),
      },
      create: {
        tenantId: tenant.id,
        branchId: gulshanBranch.id,
        ingredientId: item.id,
        currentStock: ing.stockGulshan,
        reorderLevel: ing.reorder,
        idealStock: ing.ideal,
        unitCost: ing.costPerUnit,
        lastRestockedAt: new Date(),
      },
    });

    // Branch stock - Dhanmondi (if different)
    if (dhanmondiBranch.id !== gulshanBranch.id) {
      await prisma.branchStock.upsert({
        where: {
          branchId_ingredientId: {
            branchId: dhanmondiBranch.id,
            ingredientId: item.id,
          },
        },
        update: {
          currentStock: ing.stockDhanmondi,
          reorderLevel: ing.reorder,
          idealStock: ing.ideal,
          unitCost: ing.costPerUnit,
          lastRestockedAt: new Date(),
        },
        create: {
          tenantId: tenant.id,
          branchId: dhanmondiBranch.id,
          ingredientId: item.id,
          currentStock: ing.stockDhanmondi,
          reorderLevel: ing.reorder,
          idealStock: ing.ideal,
          unitCost: ing.costPerUnit,
          lastRestockedAt: new Date(),
        },
      });
    }
  }
  console.log(`Seeded ${ingredientsData.length} Ingredients and Branch Stocks.`);

  // ==========================================
  // 5. Menu Items (5 Authentic Dishes) & Recipes
  // ==========================================
  const menuItemsData = [
    {
      id: 'm_se_kacchi',
      name: 'ঢাকা শাহী কাচ্চি বিরিয়ানি (Shahi Kacchi Biryani)',
      categoryId: categories['c_se_biryani'],
      price: 480,
      description: 'খাসির নরম মাংস, সুগন্ধি চিনিগুঁড়া চাল, জাফরান ও শাহী আলুর নিখুঁত দমে রান্না কাচ্চি।',
      tags: ['biryani', 'kacchi', 'mutton', 'bestseller'],
      modifierGroupIds: [addonGroup.id, spiceGroup.id],
      variants: [
        { name: 'হাফ প্লেট (Half Plate)', priceDelta: 0 },
        { name: 'ফুল প্লেট (Full Plate)', priceDelta: 220 },
      ],
      recipes: [
        { ingredientId: ingredientMap['ing_se_rice'], qty: 0.25, unit: 'kg' },
        { ingredientId: ingredientMap['ing_se_mutton'], qty: 0.3, unit: 'kg' },
        { ingredientId: ingredientMap['ing_se_ghee'], qty: 0.03, unit: 'kg' },
      ],
    },
    {
      id: 'm_se_kala_bhuna',
      name: 'চট্টগ্রাম মেজবানি গরুর কালা ভুনা (Beef Kala Bhuna)',
      categoryId: categories['c_se_curry'],
      price: 420,
      description: 'চট্টগ্রামের ঐতিহ্যবাহী খাঁটি সরিষার তেলে গাঢ় মসলায় ধীমে আঁচে কষানো গরুর কালা ভুনা।',
      tags: ['beef', 'kala bhuna', 'chittagong', 'spicy'],
      modifierGroupIds: [spiceGroup.id],
      variants: [],
      recipes: [
        { ingredientId: ingredientMap['ing_se_beef'], qty: 0.35, unit: 'kg' },
        { ingredientId: ingredientMap['ing_se_mustard_oil'], qty: 0.04, unit: 'l' },
      ],
    },
    {
      id: 'm_se_roast',
      name: 'পুরান ঢাকা শাহী চিকেন রোস্ট (Old Dhaka Chicken Roast)',
      categoryId: categories['c_se_grills'],
      price: 220,
      description: 'বিয়েবাড়ির স্পেশাল বাদাম বাটা, মাওয়া ও খাঁটি ঘিয়ে ভাজা সোনালী শাহী চিকেন রোস্ট।',
      tags: ['chicken', 'roast', 'traditional', 'wedding-special'],
      modifierGroupIds: [],
      variants: [],
      recipes: [
        { ingredientId: ingredientMap['ing_se_ghee'], qty: 0.03, unit: 'kg' },
        { ingredientId: ingredientMap['ing_se_mustard_oil'], qty: 0.02, unit: 'l' },
      ],
    },
    {
      id: 'm_se_borhani',
      name: 'স্পেশাল মশলাদার বোরহানি (Special Spiced Borhani)',
      categoryId: categories['c_se_drinks'],
      price: 80,
      description: 'ঘন টক দই, পুদিনা পাতা, বিট লবণ, কাঁচা মরিচ ও শাহী জিরার খাঁটি রিফ্রেশিং বোরহানি।',
      tags: ['drink', 'borhani', 'refreshing', 'cold'],
      modifierGroupIds: [],
      variants: [
        { name: 'গ্লাস (Glass 250ml)', priceDelta: 0 },
        { name: 'বড় বোতল (Bottle 1 Litre)', priceDelta: 200 },
      ],
      recipes: [
        { ingredientId: ingredientMap['ing_se_borhani_curd'], qty: 0.25, unit: 'l' },
      ],
    },
    {
      id: 'm_se_shahi_tukra',
      name: 'নবাবী শাহী টুকরা ও রাবড়ি (Nawabi Shahi Tukra)',
      categoryId: categories['c_se_desserts'],
      price: 150,
      description: 'ঘিয়ে মচমচে ভাজা জাফরানি টোস্ট, ঘন ক্ষীরসা, এলাচ ও পেস্তা-বাদামের রাজকীয় মিষ্টি।',
      tags: ['dessert', 'sweet', 'shahi tukra', 'royal'],
      modifierGroupIds: [],
      variants: [],
      recipes: [
        { ingredientId: ingredientMap['ing_se_ghee'], qty: 0.03, unit: 'kg' },
        { ingredientId: ingredientMap['ing_se_borhani_curd'], qty: 0.2, unit: 'l' },
      ],
    },
  ];

  const menuItemMap: Record<string, string> = {};
  for (const m of menuItemsData) {
    let menuItem = await prisma.menuItem.findFirst({
      where: { tenantId: tenant.id, name: m.name, isDeleted: false },
    });

    if (!menuItem) {
      menuItem = await prisma.menuItem.create({
        data: {
          id: m.id,
          tenantId: tenant.id,
          categoryId: m.categoryId,
          name: m.name,
          price: m.price,
          description: m.description,
          tags: m.tags,
          modifierGroupIds: m.modifierGroupIds,
          available: true,
        },
      });
    } else {
      await prisma.menuItem.update({
        where: { id: menuItem.id },
        data: {
          price: m.price,
          description: m.description,
          tags: m.tags,
          modifierGroupIds: m.modifierGroupIds,
          available: true,
        },
      });
    }
    menuItemMap[m.id] = menuItem.id;

    // Variants
    if (m.variants.length > 0) {
      for (const v of m.variants) {
        const existingVariant = await prisma.menuItemVariant.findFirst({
          where: { menuItemId: menuItem.id, name: v.name },
        });
        if (!existingVariant) {
          await prisma.menuItemVariant.create({
            data: {
              menuItemId: menuItem.id,
              name: v.name,
              priceDelta: v.priceDelta,
            },
          });
        }
      }
    }

    // Recipe Lines
    if (m.recipes.length > 0) {
      // Remove previous recipe lines to avoid duplicates
      await prisma.recipeLine.deleteMany({
        where: { menuItemId: menuItem.id },
      });

      for (const r of m.recipes) {
        if (r.ingredientId) {
          await prisma.recipeLine.create({
            data: {
              menuItemId: menuItem.id,
              ingredientId: r.ingredientId,
              quantity: r.qty,
              unit: r.unit,
            },
          });
        }
      }
    }
  }
  console.log(`Seeded ${menuItemsData.length} Menu Items with Recipes & Variants.`);

  // ==========================================
  // 6. Suppliers (5 Authentic BD Suppliers)
  // ==========================================
  const suppliersData = [
    {
      id: 'sup_se_bengal_meat',
      name: 'Bengal Meat Bangladesh Ltd',
      contact: 'মোহাম্মদ রফিকুল ইসলাম (Head of Institutional Sales)',
      phone: '+880 1711-234567',
      email: 'sales@bengalmeatbd.com',
      address: 'House 12, Road 4, Banani, Dhaka',
      supplies: 'Fresh Halal Mutton, Prime Beef Shank, Premium Cuts',
      paymentTerms: 'Net 15',
    },
    {
      id: 'sup_se_teer_agro',
      name: 'Teer Agro & Food Industries',
      contact: 'আব্দুল হালিম (Supply Chain Manager)',
      phone: '+880 1819-345678',
      email: 'corporate.sales@citygroup.com.bd',
      address: 'City Center, Level 14, Motijheel C/A, Dhaka',
      supplies: 'Chinigura Aromatic Rice, Flour, Sugar & Dry Staples',
      paymentTerms: 'Net 30',
    },
    {
      id: 'sup_se_meghna_oils',
      name: 'Meghna Spices & Pure Mustard Oils',
      contact: 'কামাল উদ্দিন (Wholesale Distribution)',
      phone: '+880 1912-456789',
      email: 'supply@meghnagroup.biz',
      address: 'Meghna Ghat, Sonargaon, Narayanganj',
      supplies: 'Cold Pressed Ghani Mustard Oil, Spices, Whole Garam Masala',
      paymentTerms: 'Net 15',
    },
    {
      id: 'sup_se_aarong_dairy',
      name: 'Aarong Dairy & Agro Products',
      contact: 'মনিরুল হাসান (Corporate Accounts)',
      phone: '+880 1613-567890',
      email: 'dairy-sales@brac.net',
      address: 'Aarong Centre, 346 Tejgaon I/A, Dhaka',
      supplies: 'Pure Desi Ghee, Fresh Sweet & Sour Curd, Full Cream Milk',
      paymentTerms: 'Net 7',
    },
    {
      id: 'sup_se_dhaka_pack',
      name: 'Dhaka Eco Packaging & Disposables',
      contact: 'শাহিন আলম (Proprietor)',
      phone: '+880 1514-678901',
      email: 'info@dhakapackaging.com',
      address: 'Chawkbazar Commercial Area, Old Dhaka',
      supplies: 'Food Grade Biryani Boxes, Foil Containers, Paper Bags & Cutlery',
      paymentTerms: 'Cash on Delivery',
    },
  ];

  const supplierMap: Record<string, string> = {};
  for (const s of suppliersData) {
    const sup = await prisma.supplier.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: s.name,
        },
      },
      update: {
        contact: s.contact,
        phone: s.phone,
        email: s.email,
        address: s.address,
        supplies: s.supplies,
        paymentTerms: s.paymentTerms,
        active: true,
      },
      create: {
        id: s.id,
        tenantId: tenant.id,
        name: s.name,
        contact: s.contact,
        phone: s.phone,
        email: s.email,
        address: s.address,
        supplies: s.supplies,
        paymentTerms: s.paymentTerms,
        active: true,
      },
    });
    supplierMap[s.id] = sup.id;
  }
  console.log(`Seeded ${suppliersData.length} Suppliers.`);

  // ==========================================
  // 7. Purchase Orders (5 POs with Diverse Statuses)
  // ==========================================
  const poData = [
    {
      poNumber: 'PO-2026-001',
      supplierId: supplierMap['sup_se_bengal_meat'],
      status: PurchaseOrderStatus.RECEIVED,
      notes: 'সাপ্তাহিক তাজা খাসি ও গরুর মাংসের বড় অর্ডার (Full received)',
      expectedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      items: [
        { ingredientId: ingredientMap['ing_se_mutton'], qty: 30, cost: 980, rec: 30 },
        { ingredientId: ingredientMap['ing_se_beef'], qty: 25, cost: 780, rec: 25 },
      ],
    },
    {
      poNumber: 'PO-2026-002',
      supplierId: supplierMap['sup_se_teer_agro'],
      status: PurchaseOrderStatus.RECEIVED,
      notes: 'মাসিক চিনিগুঁড়া সুগন্ধি চাল ডেলিভারি (100 kg)',
      expectedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      items: [
        { ingredientId: ingredientMap['ing_se_rice'], qty: 100, cost: 130, rec: 100 },
      ],
    },
    {
      poNumber: 'PO-2026-003',
      supplierId: supplierMap['sup_se_meghna_oils'],
      status: PurchaseOrderStatus.PARTIALLY_RECEIVED,
      notes: 'সরিষার তেলের জরুরী চালান - আংশিক রিসিভ হয়েছে (Partial 25L)',
      expectedAt: new Date(Date.now() + 1 * 24 * 3600 * 1000),
      items: [
        { ingredientId: ingredientMap['ing_se_mustard_oil'], qty: 50, cost: 290, rec: 25 },
      ],
    },
    {
      poNumber: 'PO-2026-004',
      supplierId: supplierMap['sup_se_aarong_dairy'],
      status: PurchaseOrderStatus.SENT,
      notes: 'বোরহানির জন্য ফ্রেশ দই ও খাঁটি গাওয়া ঘি পাঠানো হয়েছে (Awaiting shipment)',
      expectedAt: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      items: [
        { ingredientId: ingredientMap['ing_se_ghee'], qty: 20, cost: 1200, rec: 0 },
        { ingredientId: ingredientMap['ing_se_borhani_curd'], qty: 50, cost: 95, rec: 0 },
      ],
    },
    {
      poNumber: 'PO-2026-005',
      supplierId: supplierMap['sup_se_dhaka_pack'],
      status: PurchaseOrderStatus.DRAFT,
      notes: 'টেকঅ্যাওয়ে কাচ্চি বক্সের নতুন ড্রাফট অর্ডার',
      expectedAt: new Date(Date.now() + 4 * 24 * 3600 * 1000),
      items: [
        { ingredientId: ingredientMap['ing_se_rice'], qty: 30, cost: 130, rec: 0 },
      ],
    },
  ];

  const poMap: Record<string, string> = {};
  for (const po of poData) {
    if (!po.supplierId) continue;
    let existingPo = await prisma.purchaseOrder.findUnique({
      where: {
        restaurantId_poNumber: {
          restaurantId: tenant.id,
          poNumber: po.poNumber,
        },
      },
    });

    if (!existingPo) {
      existingPo = await prisma.purchaseOrder.create({
        data: {
          restaurantId: tenant.id,
          branchId: gulshanBranch.id,
          supplierId: po.supplierId,
          poNumber: po.poNumber,
          status: po.status,
          notes: po.notes,
          expectedAt: po.expectedAt,
          createdById: 'admin-seed',
          items: {
            create: po.items.map((i) => ({
              ingredientId: i.ingredientId,
              quantity: i.qty,
              unitCost: i.cost,
              receivedQty: i.rec,
            })),
          },
        },
      });
    }
    poMap[po.poNumber] = existingPo.id;
  }
  console.log(`Seeded ${poData.length} Purchase Orders.`);

  // ==========================================
  // 8. Goods Receipts (3 Receipts)
  // ==========================================
  const grData = [
    {
      number: 'GRN-20261020-001',
      supplierId: supplierMap['sup_se_bengal_meat'],
      poId: poMap['PO-2026-001'],
      receivedBy: 'গুলশান ব্রাঞ্চ স্টোরকিপার (Store In-charge)',
      notes: 'সকল মাংসের মান ফ্রেশ ও ওজন অনুযায়ী শতভাগ সঠিক পাওয়া গেছে।',
      receivedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      lines: [
        { ingredientId: ingredientMap['ing_se_mutton'], qty: 30, cost: 980 },
        { ingredientId: ingredientMap['ing_se_beef'], qty: 25, cost: 780 },
      ],
    },
    {
      number: 'GRN-20261021-001',
      supplierId: supplierMap['sup_se_teer_agro'],
      poId: poMap['PO-2026-002'],
      receivedBy: 'হেড শেফ - রফিকুল ইসলাম',
      notes: '১০০ কেজি চিনিগুঁড়া চালের বস্তা অক্ষত অবস্থায় গুদামে রাখা হয়েছে।',
      receivedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      lines: [
        { ingredientId: ingredientMap['ing_se_rice'], qty: 100, cost: 130 },
      ],
    },
    {
      number: 'GRN-20261022-001',
      supplierId: supplierMap['sup_se_meghna_oils'],
      poId: poMap['PO-2026-003'],
      receivedBy: 'গুলশান কিচেন অ্যাসিস্ট্যান্ট',
      notes: '২৫ লিটার সরিষার তেল সরবরাহকৃত, বাকি ২৫ লিটার আগামী সপ্তাহে আসবে।',
      receivedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      lines: [
        { ingredientId: ingredientMap['ing_se_mustard_oil'], qty: 25, cost: 290 },
      ],
    },
  ];

  for (const gr of grData) {
    const existing = await prisma.goodsReceipt.findUnique({
      where: {
        branchId_number: {
          branchId: gulshanBranch.id,
          number: gr.number,
        },
      },
    });

    if (!existing) {
      await prisma.goodsReceipt.create({
        data: {
          tenantId: tenant.id,
          branchId: gulshanBranch.id,
          supplierId: gr.supplierId,
          poId: gr.poId,
          number: gr.number,
          receivedBy: gr.receivedBy,
          notes: gr.notes,
          receivedAt: gr.receivedAt,
          lines: {
            create: gr.lines.map((l) => ({
              ingredientId: l.ingredientId,
              qty: l.qty,
              unitCost: l.cost,
            })),
          },
        },
      });
    }
  }
  console.log(`Seeded ${grData.length} Goods Receipts.`);

  // ==========================================
  // 9. Supplier Returns (2 Supplier Returns)
  // ==========================================
  const srData = [
    {
      number: 'RTN-20261022-001',
      supplierId: supplierMap['sup_se_bengal_meat'],
      reason: '২ কেজি মাংসের কোয়ালিটি ড্রপ করায় ডেলিভারি ভ্যান থেকেই ফেরত দেওয়া হয়েছে।',
      credit: 1960,
      createdBy: 'গুলশান কিচেন ম্যানেজার',
      lines: [
        { ingredientId: ingredientMap['ing_se_mutton'], qty: 2, cost: 980 },
      ],
    },
    {
      number: 'RTN-20261023-001',
      supplierId: supplierMap['sup_se_meghna_oils'],
      reason: 'একটি কন্টেইনারের ক্যাপ ফাটা থাকায় ৩ লিটার তেল ফেরত দেওয়া হলো।',
      credit: 870,
      createdBy: 'স্টোর কিপার',
      lines: [
        { ingredientId: ingredientMap['ing_se_mustard_oil'], qty: 3, cost: 290 },
      ],
    },
  ];

  for (const sr of srData) {
    if (!sr.supplierId) continue;
    const existing = await prisma.supplierReturn.findUnique({
      where: {
        branchId_number: {
          branchId: gulshanBranch.id,
          number: sr.number,
        },
      },
    });

    if (!existing) {
      await prisma.supplierReturn.create({
        data: {
          tenantId: tenant.id,
          branchId: gulshanBranch.id,
          supplierId: sr.supplierId,
          number: sr.number,
          reason: sr.reason,
          credit: sr.credit,
          createdBy: sr.createdBy,
          lines: {
            create: sr.lines.map((l) => ({
              ingredientId: l.ingredientId,
              qty: l.qty,
              unitCost: l.cost,
            })),
          },
        },
      });
    }
  }
  console.log(`Seeded ${srData.length} Supplier Returns.`);

  // ==========================================
  // 10. Promotions (3 Specific Campaigns as Requested)
  // 1 Live (Holiday), 1 Scheduled (Winter), 1 Ended (Puja Dhamaka), 0 Paused
  // ==========================================
  const promotionsData = [
    {
      name: 'Holiday Special Feast (15% Off)',
      code: 'HOLIDAY15',
      kind: DiscountKind.PERCENT,
      value: 15,
      minSpend: 500,
      startsAt: new Date(Date.now() - 5 * 24 * 3600 * 1000), // 5 days ago
      endsAt: new Date(Date.now() + 15 * 24 * 3600 * 1000),  // 15 days ahead -> LIVE
      active: true,
      uses: 24,
      maxUses: 150,
    },
    {
      name: 'Winter Warmup Festival (20% Off)',
      code: 'WINTER20',
      kind: DiscountKind.PERCENT,
      value: 20,
      minSpend: 800,
      startsAt: new Date(Date.now() + 10 * 24 * 3600 * 1000), // 10 days ahead
      endsAt: new Date(Date.now() + 45 * 24 * 3600 * 1000),  // 45 days ahead -> SCHEDULED
      active: true,
      uses: 0,
      maxUses: 200,
    },
    {
      name: 'Puja Dhamaka Mega Offer (100 BDT Off)',
      code: 'PUJA100',
      kind: DiscountKind.AMOUNT,
      value: 100,
      minSpend: 700,
      startsAt: new Date(Date.now() - 30 * 24 * 3600 * 1000), // 30 days ago
      endsAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),   // 3 days ago -> ENDED
      active: true,
      uses: 100,
      maxUses: 100,
    },
  ];

  const canonicalPromoCodes = promotionsData.map((p) => p.code);

  // Clean up any other old promotions for this tenant
  await prisma.promotion.deleteMany({
    where: {
      tenantId: tenant.id,
      code: { notIn: canonicalPromoCodes },
    },
  }).catch(() => {
    return prisma.promotion.updateMany({
      where: {
        tenantId: tenant.id,
        code: { notIn: canonicalPromoCodes },
      },
      data: { isDeleted: true, active: false },
    });
  });

  for (const p of promotionsData) {
    const existing = await prisma.promotion.findFirst({
      where: {
        tenantId: tenant.id,
        code: p.code,
      },
    });

    if (!existing) {
      await prisma.promotion.create({
        data: {
          tenantId: tenant.id,
          name: p.name,
          code: p.code,
          kind: p.kind,
          value: p.value,
          minSpend: p.minSpend,
          startsAt: p.startsAt,
          endsAt: p.endsAt,
          active: p.active,
          uses: p.uses,
          maxUses: p.maxUses,
          isDeleted: false,
        },
      });
    } else {
      await prisma.promotion.update({
        where: { id: existing.id },
        data: {
          name: p.name,
          value: p.value,
          minSpend: p.minSpend,
          startsAt: p.startsAt,
          endsAt: p.endsAt,
          active: p.active,
          uses: p.uses,
          maxUses: p.maxUses,
          isDeleted: false,
        },
      });
    }
  }
  console.log(`Seeded ${promotionsData.length} Promotions (1 Live, 1 Scheduled, 1 Ended, 0 Paused).`);

  // ==========================================
  // 11. Loyalty Settings, Loyalty Tiers & Customers
  // ==========================================
  await prisma.loyaltySettings.upsert({
    where: { tenantId: tenant.id },
    update: {
      isEnabled: true,
      spendAmountPerPoint: 100,
      pointValue: 1.0,
      minPointsToRedeem: 20,
      maxPointsPerOrder: 500,
      expireAfterDays: 365,
    },
    create: {
      tenantId: tenant.id,
      isEnabled: true,
      spendAmountPerPoint: 100,
      pointValue: 1.0,
      minPointsToRedeem: 20,
      maxPointsPerOrder: 500,
      expireAfterDays: 365,
    },
  });

  const tiersData = [
    {
      name: 'Bronze',
      minSpend: 0,
      minPoints: 0,
      pointMultiplier: 1.0,
      discountPercent: 0,
      description: 'Standard membership for all new customers',
      color: '#CD7F32',
      sortOrder: 1,
    },
    {
      name: 'Silver',
      minSpend: 3000,
      minPoints: 30,
      pointMultiplier: 1.25,
      discountPercent: 5,
      description: '5% discount for regular diners',
      color: '#94A3B8',
      sortOrder: 2,
    },
    {
      name: 'Gold',
      minSpend: 10000,
      minPoints: 100,
      pointMultiplier: 1.5,
      discountPercent: 10,
      description: '10% discount & 1.5x points multiplier',
      color: '#EAB308',
      sortOrder: 3,
    },
    {
      name: 'Platinum',
      minSpend: 25000,
      minPoints: 250,
      pointMultiplier: 2.0,
      discountPercent: 15,
      description: 'VIP status with 15% discount & 2.0x points multiplier',
      color: '#8B5CF6',
      sortOrder: 4,
    },
  ];

  const tierMap: Record<string, string> = {};
  for (const t of tiersData) {
    let tier = await prisma.loyaltyTier.findFirst({
      where: {
        tenantId: tenant.id,
        name: t.name,
      },
    });
    if (!tier) {
      tier = await prisma.loyaltyTier.create({
        data: {
          tenantId: tenant.id,
          name: t.name,
          minSpend: t.minSpend,
          minPoints: t.minPoints,
          pointMultiplier: t.pointMultiplier,
          discountPercent: t.discountPercent,
          description: t.description,
          color: t.color,
          sortOrder: t.sortOrder,
          isActive: true,
          isDeleted: false,
        },
      });
    } else {
      tier = await prisma.loyaltyTier.update({
        where: { id: tier.id },
        data: {
          name: t.name,
          minSpend: t.minSpend,
          minPoints: t.minPoints,
          pointMultiplier: t.pointMultiplier,
          discountPercent: t.discountPercent,
          description: t.description,
          color: t.color,
          sortOrder: t.sortOrder,
          isActive: true,
          isDeleted: false,
        },
      });
    }
    tierMap[t.name] = tier.id;
  }

  // Clean up any legacy Bengali tiers or duplicates
  const canonicalNames = ['Bronze', 'Silver', 'Gold', 'Platinum'];
  const allTiers = await prisma.loyaltyTier.findMany({
    where: { tenantId: tenant.id },
  });
  for (const t of allTiers) {
    if (!canonicalNames.includes(t.name) || (tierMap[t.name] && tierMap[t.name] !== t.id)) {
      const fallbackTierId = tierMap['Bronze'];
      await prisma.customer.updateMany({
        where: { tierId: t.id },
        data: { tierId: fallbackTierId },
      });
      await prisma.loyaltyTier.delete({ where: { id: t.id } }).catch(() => {
        return prisma.loyaltyTier.update({
          where: { id: t.id },
          data: { isDeleted: true, isActive: false },
        });
      });
    }
  }
  console.log(`Seeded ${tiersData.length} Loyalty Tiers.`);

  // Customers (5 BD Customers)
  const customersData = [
    {
      name: 'Tanvir Hossain',
      phone: '+8801711223344',
      email: 'tanvir.hossain@gmail.com',
      address: 'House 42, Road 11, Gulshan-2, Dhaka',
      totalSpent: 8500,
      loyaltyPoints: 95,
      tierId: tierMap['Silver'],
      notes: 'Regular diner. Visits with family on weekends.',
    },
    {
      name: 'Farhana Ahmed',
      phone: '+8801811223344',
      email: 'farhana.ahmed@yahoo.com',
      address: 'Road 8/A, Dhanmondi R/A, Dhaka',
      totalSpent: 16200,
      loyaltyPoints: 210,
      tierId: tierMap['Gold'],
      notes: 'Loves beef kala bhuna and borhani.',
    },
    {
      name: 'Rakibul Islam',
      phone: '+8801911223344',
      email: 'rakibul.pos@outlook.com',
      address: 'Lane 4, Mirpur DOHS, Dhaka',
      totalSpent: 1400,
      loyaltyPoints: 14,
      tierId: tierMap['Bronze'],
      notes: 'New registered customer.',
    },
    {
      name: 'Nusrat Jahan',
      phone: '+8801611223344',
      email: 'nusrat.jahan@gmail.com',
      address: 'Park Road, Baridhara Diplomatic Zone, Dhaka',
      totalSpent: 32000,
      loyaltyPoints: 480,
      tierId: tierMap['Platinum'],
      notes: 'VIP customer. Regularly books VIP cabin for corporate lunches.',
    },
    {
      name: 'Mahmudur Rahman',
      phone: '+8801511223344',
      email: 'mahmud.rahman@live.com',
      address: 'Sector 4, Uttara, Dhaka',
      totalSpent: 550,
      loyaltyPoints: 5,
      tierId: tierMap['Bronze'],
      notes: 'Online takeaway customer.',
    },
  ];

  const customerMap: Record<string, string> = {};
  for (const c of customersData) {
    let cust = await prisma.customer.findFirst({
      where: { tenantId: tenant.id, phone: c.phone, isDeleted: false },
    });
    if (!cust) {
      cust = await prisma.customer.create({
        data: {
          tenantId: tenant.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          address: c.address,
          totalSpent: c.totalSpent,
          loyaltyPoints: c.loyaltyPoints,
          tierId: c.tierId,
          notes: c.notes,
          isActive: true,
        },
      });
    } else {
      await prisma.customer.update({
        where: { id: cust.id },
        data: {
          name: c.name,
          email: c.email,
          address: c.address,
          totalSpent: c.totalSpent,
          loyaltyPoints: c.loyaltyPoints,
          tierId: c.tierId,
          notes: c.notes,
        },
      });
    }
    customerMap[c.phone] = cust.id;
  }
  console.log(`Seeded ${customersData.length} Customers with Loyalty Points.`);

  // ==========================================
  // 12. Dining Tables (5 Tables for Gulshan)
  // ==========================================
  const tablesData = [
    { name: 'Table T-1 (লেকভিউ উইন্ডো)', seats: 4, area: 'Lakeview Window', shape: 'square', x: 20, y: 30 },
    { name: 'Table T-2 (ভিআইপি কেবিন)', seats: 8, area: 'VIP Cabin', shape: 'rectangle', x: 60, y: 30 },
    { name: 'Table T-3 (ফ্যামিলি বুথ)', seats: 6, area: 'Family Hall', shape: 'booth', x: 20, y: 70 },
    { name: 'Table T-4 (টেরেস গার্ডেন)', seats: 2, area: 'Terrace Garden', shape: 'round', x: 60, y: 70 },
    { name: 'Table T-5 (মেইন ডাইনিং)', seats: 4, area: 'Main Dining', shape: 'square', x: 40, y: 50 },
  ];

  const tableMap: Record<string, string> = {};
  for (const t of tablesData) {
    const table = await prisma.diningTable.upsert({
      where: {
        branchId_name: {
          branchId: gulshanBranch.id,
          name: t.name,
        },
      },
      update: {
        seats: t.seats,
        area: t.area,
        shape: t.shape,
        x: t.x,
        y: t.y,
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        branchId: gulshanBranch.id,
        name: t.name,
        seats: t.seats,
        area: t.area,
        shape: t.shape,
        x: t.x,
        y: t.y,
        status: TableStatus.AVAILABLE,
        isActive: true,
      },
    });
    tableMap[t.name] = table.id;
  }
  console.log(`Seeded ${tablesData.length} Dining Tables.`);

  // ==========================================
  // 13. Orders & Finance Cash / Card / Mobile Payments
  // ==========================================
  const ordersData = [
    {
      orderNumber: '#1001',
      type: OrderType.DINE_IN,
      status: OrderStatus.IN_KITCHEN,
      kitchenStatus: KitchenStatus.PREPARING,
      tableName: 'Table T-1 (লেকভিউ উইন্ডো)',
      tableId: tableMap['Table T-1 (লেকভিউ উইন্ডো)'],
      customerId: customerMap['+8801711223344'],
      customerName: 'Tanvir Hossain',
      customerPhone: '+8801711223344',
      subtotal: 1120,
      tax: 88.2,
      serviceCharge: 56,
      discount: 0,
      total: 1264.2,
      paid: 0,
      notes: 'কম ঝাল (Mild spicy)',
      lines: [
        { name: 'ঢাকা শাহী কাচ্চি বিরিয়ানি', qty: 2, unitPrice: 480 },
        { name: 'স্পেশাল মশলাদার বোরহানি', qty: 2, unitPrice: 80 },
      ],
      payment: null,
    },
    {
      orderNumber: '#1002',
      type: OrderType.DINE_IN,
      status: OrderStatus.READY,
      kitchenStatus: KitchenStatus.READY,
      tableName: 'Table T-2 (ভিআইপি কেবিন)',
      tableId: tableMap['Table T-2 (ভিআইপি কেবিন)'],
      customerId: customerMap['+8801811223344'],
      customerName: 'Farhana Ahmed',
      customerPhone: '+8801811223344',
      subtotal: 1440,
      discount: 0,
      tax: 113.4,
      serviceCharge: 72,
      total: 1625.4,
      paid: 0,
      notes: 'গরম গরম পরিবেশন করুন',
      lines: [
        { name: 'চট্টগ্রাম মেজবানি গরুর কালা ভুনা', qty: 2, unitPrice: 420 },
        { name: 'পুরান ঢাকা শাহী চিকেন রোস্ট', qty: 2, unitPrice: 220 },
        { name: 'স্পেশাল মশলাদার বোরহানি', qty: 2, unitPrice: 80 },
      ],
      payment: null,
    },
    {
      orderNumber: '#1003',
      type: OrderType.DINE_IN,
      status: OrderStatus.SERVED,
      kitchenStatus: KitchenStatus.BUMPED,
      tableName: 'Table T-3 (ফ্যামিলি বুথ)',
      tableId: tableMap['Table T-3 (ফ্যামিলি বুথ)'],
      customerId: customerMap['+8801911223344'],
      customerName: 'Rakibul Islam',
      customerPhone: '+8801911223344',
      subtotal: 740,
      tax: 58.28,
      serviceCharge: 37,
      discount: 0,
      total: 835.28,
      paid: 0,
      notes: 'টেবিলে অতিরিক্ত গ্লাস প্রয়োজন',
      lines: [
        { name: 'পুরান ঢাকা শাহী চিকেন রোস্ট', qty: 2, unitPrice: 220 },
        { name: 'নবাবী শাহী টুকরা ও রাবড়ি', qty: 2, unitPrice: 150 },
      ],
      payment: null,
    },
    {
      orderNumber: '#1004',
      type: OrderType.TAKEAWAY,
      status: OrderStatus.COMPLETED,
      kitchenStatus: KitchenStatus.BUMPED,
      customerId: customerMap['+8801611223344'],
      customerName: 'Nusrat Jahan',
      customerPhone: '+8801611223344',
      subtotal: 1120,
      tax: 84,
      serviceCharge: 0,
      discount: 0,
      total: 1204,
      paid: 1204,
      notes: 'পার্সেল প্যাক সম্পন্ন',
      lines: [
        { name: 'ঢাকা শাহী কাচ্চি বিরিয়ানি', qty: 2, unitPrice: 480 },
        { name: 'স্পেশাল মশলাদার বোরহানি', qty: 2, unitPrice: 80 },
      ],
      payment: {
        method: PaymentMethod.CASH,
        amount: 1204,
        tendered: 1500,
        change: 296,
        reference: 'Cash Register Drawer #01',
      },
    },
  ];

  for (const o of ordersData) {
    const existing = await prisma.order.findFirst({
      where: {
        tenantId: tenant.id,
        orderNumber: o.orderNumber,
      },
    });

    if (!existing) {
      await prisma.order.create({
        data: {
          tenantId: tenant.id,
          branchId: gulshanBranch.id,
          orderNumber: o.orderNumber,
          type: o.type,
          status: o.status,
          tableId: o.tableId,
          tableName: o.tableName,
          customerId: o.customerId,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          deliveryAddress: (o as any).deliveryAddress,
          subtotal: o.subtotal,
          tax: o.tax,
          serviceCharge: o.serviceCharge,
          discount: o.discount,
          discountReason: o.discountReason,
          promoCode: o.promoCode,
          total: o.total,
          paid: o.paid,
          lines: {
            create: o.lines.map((l) => ({
              name: l.name,
              qty: l.qty,
              unitPrice: l.unitPrice,
            })),
          },
          payments: o.payment
            ? {
                create: {
                  method: o.payment.method,
                  amount: o.payment.amount,
                  tendered: o.payment.tendered,
                  change: o.payment.change,
                  reference: o.payment.reference,
                },
              }
            : undefined,
        },
      });
    } else {
      await prisma.order.update({
        where: { id: existing.id },
        data: {
          customerName: o.customerName,
          customerId: o.customerId,
          promoCode: o.promoCode,
          discountReason: o.discountReason,
        },
      });
    }
  }
  console.log(`Seeded ${ordersData.length} Orders with Payments & Cash Drawer Ledger.`);

  console.log('--- Bangladeshi Seed Data Seeding Successfully Completed! ---\n');
}
