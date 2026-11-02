# Multi-Tenant Restaurant POS: Frontend vs Backend Gap Analysis Report

> **তারিখ**: ৩০ অক্টোবর ২০২৬  
> **প্রজেক্টের ধরন**: Multi-Tenant Restaurant POS & Management System (Monorepo: NestJS + React TanStack Router)  
> **বিশ্লেষণের উদ্দেশ্য**: সম্পূর্ণ কোডবেস অডিট করে কোন কোন ফিচার এখনও শুধুমাত্র Frontend-এ (Mock / Local Storage / In-memory) সীমাবদ্ধ আছে এবং Backend-এর সাথে কোনো সংযোগ নেই বা ইন্টিগ্রেশন বাকি আছে তা চিহ্নিত করা।

---

## ১. সারাংশ (Executive Summary)

প্রজেক্টের আর্কিটেকচার পর্যালোচনা করে দেখা গেছে যে, অ্যাপ্লিকেশনটির প্রধান কোর মডিউলসমূহ (যেমন: ক্যাটাগরি, মেনু আইটেম, পিওএস অর্ডার তৈরি, কিচেন স্ট্যাটাস আপডেট, টেবিল ম্যানেজমেন্ট, সাপ্লায়ার ও পারচেজ অর্ডার, কাস্টমার এবং লয়্যালটি টায়ার) সফলভাবে NestJS ব্যাকএন্ড ও PostgreSQL ডাটাবেজের সাথে যুক্ত হয়েছে।

তবে এখনও এমন বেশ কিছু ক্রিটিক্যাল বিজনেস মডিউল রয়েছে যা **সম্পূর্ণ ফ্রন্টএন্ড মক (In-Memory `tenantDb` বা `localStorage`)**-এ চলছে। এগুলোকে ৩টি প্রধান ক্যাটাগরিতে ভাগ করা হয়েছে:
1. **Category A (সম্পূর্ণ অনুপস্থিত Backend)**: ব্যাকএন্ডে কোনো ডাটাবেজ মডেল (Prisma), সার্ভিস বা কন্ট্রোলার নেই—পুরোটাই ফ্রন্টএন্ডে সিমুলেট করা।
2. **Category B (Backend তৈরি আছে, কিন্তু Frontend যুক্ত হয়নি)**: ব্যাকএন্ডে API রেডি থাকা সত্ত্বেও ফ্রন্টএন্ড এখনও মক ডাটা ব্যবহার করছে।
3. **Category C (আংশিক বা একমুখী ইন্টিগ্রেশন)**: মূল ভিউ ব্যাকএন্ড থেকে আসলেও কিছু গুরুত্বপূর্ণ অ্যাকশন (যেমন Void/Cancel বা Refund) লোকাল স্টেটে রয়ে গেছে।

---

## ২. Category A: সম্পূর্ণ Frontend-Only ফিচার (Backend-এ কোনো অস্তিত্ব নেই)V

এই ফিচারগুলোর জন্য ব্যাকএন্ডে কোনো Prisma Schema মডেল, সার্ভিস বা REST API কন্ট্রোলার নেই। এগুলো অবিলম্বে ব্যাকএন্ডে ডেভেলপ করা প্রয়োজন:

### ১. ক্যাশ ড্রয়ার সেশন ও শিফট ম্যানেজমেন্ট (Cash Drawer / Shift Register)
* **ফ্রন্টএন্ড ফাইল**: [`app.$tenantSlug.finance.cash.tsx`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/routes/app.$tenantSlug.finance.cash.tsx), [`money.service.ts`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/services/money.service.ts#L100-L150)
* **বর্তমান অবস্থা**: সম্পূর্ণ ইন-মেমোরি মক (`tenantDb(tenantId).cashSessions`)।
* **যেসব ফাংশনালিটি ফ্রন্টএন্ডে সীমাবদ্ধ**:
  * ক্যাশ ড্রয়ার ওপেন করা (`openCashSession` - ওপেনিং ব্যালেন্স/ফ্লোট ইনপুট)।
  * পে-ইন এবং পে-আউট এন্ট্রি দেওয়া (`addCashEntry` - ড্রয়ার থেকে ক্যাশ উত্তোলন বা জমা)।
  * শিফট ক্লোজ ও ক্যাশ কাউন্ট রিকনসিলিয়েশন (`closeCashSession` - ক্লোজিং ক্যাশ হিসাব এবং শর্টেজ/সারপ্লাস চেক)।
* **প্রয়োজনীয় Backend কাজ**: `CashSession` ও `CashEntry` প্রিজমা মডেল তৈরি এবং `CashDrawerModule` (কন্ট্রোলার + সার্ভিস) তৈরি।

### ২. খরচের হিসাব / পেটি ক্যাশ (Expenses & Petty Cash)
* **ফ্রন্টএন্ড ফাইল**: [`app.$tenantSlug.finance.expenses.tsx`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/routes/app.$tenantSlug.finance.expenses.tsx), [`money.service.ts`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/services/money.service.ts#L157-L190)
* **বর্তমান অবস্থা**: সম্পূর্ণ ইন-মেমোরি মক (`tenantDb(tenantId).expenses`)।
* **যেসব ফাংশনালিটি ফ্রন্টএন্ডে সীমাবদ্ধ**:
  * রেস্তোরাঁর দৈনন্দিন খরচ এন্ট্রি (`createExpense` - ইউটিলিটি, মজুরি, ভাড়া, সাপ্লাই ইত্যাদি)।
  * ব্যাংক বনাম ক্যাশ ড্রয়ার থেকে খরচ পে করার হিসাব।
  * খরচের তালিকা ও ডিলিট করা (`listExpenses`, `deleteExpense`)।
* **প্রয়োজনীয় Backend কাজ**: `Expense` প্রিজমা মডেল এবং `ExpenseController` (`GET/POST/DELETE /tenants/:slug/expenses`) তৈরি।

### ৩. ডেলিভারি ডিসপ্যাচ ও রাইডার ম্যানেজমেন্ট (Delivery & Riders Dispatch) - [COMPLETED / সম্পন্ন]
* **ফ্রন্টএন্ড ফাইল**: [`app.$tenantSlug.delivery.tsx`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/routes/app.$tenantSlug.delivery.tsx), [`money.service.ts`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/services/money.service.ts#L195-L235)
* **বর্তমান অবস্থা**: রাইডার মডেল, সম্পূর্ণ CRUD API (`/tenants/:slug/riders`) এবং অর্ডারে রাইডার ডিসপ্যাচ ও স্ট্যাটাস ট্র্যাকিং এন্ডপয়েন্ট (`PATCH /tenants/:slug/orders/:id/delivery`) ব্যাকএন্ডে বাস্তবায়িত ও ডাটাবেজে যুক্ত। ফ্রন্টএন্ডেও রিয়েল API ইন্টিগ্রেশন এবং রাইডার ম্যানেজমেন্ট ইন্টারফেস যুক্ত সম্পন্ন।
* **যেসব ফাংশনালিটি ফ্রন্টএন্ডে ছিল**:
  * নতুন রাইডার যুক্ত করা (`saveRider`).
  * অর্ডারে রাইডার অ্যাসাইন করা এবং ডেলিভারি স্ট্যাটাস ট্র্যাকিং (`updateDelivery` - pending, assigned, out, delivered)।
* **সম্পন্ন Backend কাজ**: `Rider` মডেল, রাইডারদের CRUD API, এবং অর্ডারে রাইডার ডিসপ্যাচ ও ডেলিভারি স্ট্যাটাস আপডেট এন্ডপয়েন্ট (`PATCH /orders/:id/delivery`)।

### ৪. স্টাফ শিডিউলিং ও শিফট (Staff Shifts) - [REMOVED / ডিলিট করা হয়েছে]
* **স্ট্যাটাস**: ব্যবহারকারীর নির্দেশনায় স্টাফ শিডিউলিং ও শিফট ফিচারটি এবং সংশ্লিষ্ট ফাইল, মক ও সার্ভিস কোড প্রজেক্ট থেকে সম্পূর্ণ ডিলিট করা হয়েছে।

### ৫. স্টাফ অ্যাটেনডেন্স ও ক্লক-ইন/আউট (Staff Attendance & Time Clock) - [REMOVED / ডিলিট করা হয়েছে]
* **স্ট্যাটাস**: ব্যবহারকারীর নির্দেশনায় স্টাফ অ্যাটেনডেন্স ও টাইম ক্লক ফিচারটি এবং সংশ্লিষ্ট ফাইল, মক ও সার্ভিস কোড প্রজেক্ট থেকে সম্পূর্ণ ডিলিট করা হয়েছে।

### ৬. কাস্টম রোল তৈরি (Custom Roles & Dynamic Permissions) [সম্পন্ন / RESOLVED]
* **ফ্রন্টএন্ড ফাইল**: [`app.$tenantSlug.team.roles.tsx`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/routes/app.$tenantSlug.team.roles.tsx), [`app.$tenantSlug.team.index.tsx`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/routes/app.$tenantSlug.team.index.tsx), [`people.service.ts`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/services/people.service.ts)
* **সমাধান সম্পন্ন**: ব্যাকএন্ডে PostgreSQL `CustomRole` মডেল ও `StaffMember` রিলেশন যুক্ত করা হয়েছে। সম্পূর্ণ CRUD API এন্ডপয়েন্ট (`GET`, `POST`, `PUT`, `DELETE` on `/tenants/:tenantSlug/custom-roles`) এবং `PermissionsGuard`-এ কাস্টম রোলের পারমিশন অটোমেটিক মার্জ করার ব্যবস্থা যুক্ত করা হয়েছে। ফ্রন্টএন্ডেও লোকাল স্টোরেজ নির্ভরতা দূর করে সম্পূর্ণ ব্যাকএন্ড সিঙ্ক নিশ্চিত করা হয়েছে।

### ৭. রেস্তোরাঁ ব্র্যান্ডিং, অ্যাম্বিয়েন্স, থিম ও ট্যাক্স সেটিংস (Tenant Settings)
* **ফ্রন্টএন্ড ফাইল**: [`app.$tenantSlug.settings.tsx`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/routes/app.$tenantSlug.settings.tsx), [`brand-ambience-tab.tsx`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/features/settings/brand-ambience-tab.tsx), [`taxes-charges-tab.tsx`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/features/settings/taxes-charges-tab.tsx), [`receipt-security-tab.tsx`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/features/settings/receipt-security-tab.tsx)
* **বর্তমান অবস্থা**: সেটিংস পেজে লোগো পরিবর্তন, প্রিভিউ কালার থিম সিলেকশন, ট্যাক্স রেট, সার্ভিস চার্জ এবং রিসিট ফুটার নোট পরিবর্তন করা হলে তা শুধুমাত্র ইন-মেমোরি `TENANTS` অবজেক্ট এবং `localStorage`-এ সেভ হয় (`stage4.updateTenantSettings`)। ব্যাকএন্ডে কোনো সেটিংস আপডেট কন্ট্রোলার নেই।
* **প্রয়োজনীয় Backend কাজ**: `PATCH /tenants/:tenantSlug/settings` এন্ডপয়েন্ট তৈরি করা যা লোগো URL, থিম আইডি, ট্যাক্স রেট ও রিসিট কনফিগারেশন ডাটাবেজে সংরক্ষণ করবে।

### ৮. ড্যাশবোর্ড ওভারভিউ মেট্রিক্স (Dashboard Aggregated Summary) [সম্পন্ন / RESOLVED]
* **ফ্রন্টএন্ড ফাইল**: [`app.$tenantSlug.dashboard.tsx`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/routes/app.$tenantSlug.dashboard.tsx), [`operations.service.ts`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/services/operations.service.ts)
* **সমাধান সম্পন্ন**: ব্যাকএন্ডে নতুন `DashboardModule` ও `GET /tenants/:tenantSlug/dashboard/summary?branchId=...` এন্ডপয়েন্ট তৈরি করা হয়েছে যা ডেটাবেজের রিয়েলটাইম অর্ডার ও পেমেন্ট হিসেব করে `todaySales`, `todayOrders`, `avgTicket`, `activeOrders`, `kitchenQueue`, `occupiedTables`, `totalTables`, গত ৭ দিনের দৈনিক সেলস চার্ট (`salesByDay`), টপ সেলিং আইটেম (`topItems`), লো স্টক ওয়ার্নিং (`lowStock`), এবং সাম্প্রতিক অর্ডার (`recentOrders`) সরাসরি অ্যাগ্রিগেট করে পাঠায়। ফ্রন্টএন্ডে ক্লায়েন্ট-সাইড ম্যানুয়াল লুপ গণনা বন্ধ করে ব্যাকএন্ড এপিআই কল ইন্টিগ্রেট করা হয়েছে।

### ৯. ইনভেন্টরি ও অপারেশন রিপোর্টস (Inventory & Operations Reports) [সম্পন্ন / RESOLVED]
* **ফ্রন্টএন্ড ফাইল**: [`app.$tenantSlug.reports.tsx`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/routes/app.$tenantSlug.reports.tsx), [`stage4.service.ts`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/services/stage4.service.ts)
* **সমাধান সম্পন্ন**: ব্যাকএন্ডে ডেডিকেটেড `ReportModule` তৈরি করা হয়েছে যার মধ্যে `GET /tenants/:tenantSlug/reports/inventory` (ইনভেন্টরি স্টক ভ্যালুয়েশন, লো স্টক কাউন্ট, ওয়েস্টেজ খরচ, এবং স্টক মুভমেন্টস), `GET /tenants/:tenantSlug/reports/operations` (কিচেন ভেলোসিটি, অর্ডার স্ট্যাটাস ও টাইপ ডিস্ট্রিবিউশন, টেবিল টার্নওভার), `GET /tenants/:tenantSlug/reports/sales` এবং `GET /tenants/:tenantSlug/reports/financial` এন্ডপয়েন্ট তৈরি করা হয়েছে। ফ্রন্টএন্ডে `stage4.service.ts`-এর লোকাল মক ফাংশনগুলোকে এই ডেডিকেটেড ব্যাকএন্ড এপিআই-এর সাথে সরাসরি যুক্ত করা হয়েছে।

### ১০. থার্ড পার্টি ইন্টিগ্রেশন (Integrations / Marketplace)
* **ফ্রন্টএন্ড ফাইল**: [`stage4.service.ts`](file:///d:/Orvio/multi-tenant-restaurant-pos/apps/frontend/src/services/stage4.service.ts#L750-L780)
* **বর্তমান অবস্থা**: `listIntegrations` এবং `toggleIntegration` ১০০% মক।

---

## ৩. Category B: Backend API তৈরি আছে, কিন্তু Frontend এখনও Mock ব্যবহার করছে

এই ফিচারগুলোর জন্য ব্যাকএন্ডে NestJS কন্ট্রোলার ও ডাটাবেজ মডেল সম্পূর্ণ প্রস্তুত আছে, কিন্তু ফ্রন্টএন্ড সার্ভিস এখনও ব্যাকএন্ডে কল না দিয়ে লোকাল স্টোরেজে কাজ করছে:

| ফিচার | ফ্রন্টএন্ড ফাইল | প্রস্তুত থাকা Backend এন্ডপয়েন্ট | স্ট্যাটাস & বাস্তবায়ন |
| :--- | :--- | :--- | :--- |
| **Stock Counts (ইনভেন্টরি ফিজিক্যাল কাউন্ট)** | [`stock-counts.tsx`](file:///apps/frontend/src/routes/app.$tenantSlug.inventory.stock-counts.tsx), [`stock.service.ts`](file:///apps/frontend/src/services/stock.service.ts) | `POST /tenants/:tenantSlug/inventory/stock-counts`<br>`GET /tenants/:tenantSlug/inventory/stock-counts` | ✅ **সম্পূর্ণ ইন্টিগ্রেটেড**: `listStockCounts` এবং `submitStockCount` সরাসরি ব্যাকএন্ড API এবং রেconciliation লজিকের সাথে যুক্ত। |
| **Stock Movements (স্টক হিস্ট্রি লগ)** | [`stock-movements.tsx`](file:///apps/frontend/src/routes/app.$tenantSlug.inventory.stock-movements.tsx), [`operations.service.ts`](file:///apps/frontend/src/services/operations.service.ts) | `GET /tenants/:tenantSlug/inventory/movements`<br>`GET /tenants/:tenantSlug/stock-movements` | ✅ **সম্পূর্ণ ইন্টিগ্রেটেড**: `listMovements` ব্যাকএন্ডের অডিট হিস্ট্রি এন্ডপয়েন্ট থেকে রিয়েল ডাটা ফেচ করছে। |
| **Stock Manual Adjustment (স্টক সমন্বয়/ওয়েস্টেজ)** | [`inventory.index.tsx`](file:///apps/frontend/src/routes/app.$tenantSlug.inventory.index.tsx), [`stock.service.ts`](file:///apps/frontend/src/services/stock.service.ts) | `POST /tenants/:tenantSlug/inventory/adjust`<br>`POST /tenants/:tenantSlug/stock-movements/adjust` | ✅ **সম্পূর্ণ ইন্টিগ্রেটেড**: `adjustStock` এখন ব্যাকএন্ডে সমন্বয় কল পাঠায় এবং ব্র্যাঞ্চ স্টক আপডেট পায়। |
| **Change Password (পাসওয়ার্ড পরিবর্তন)** | [`password-change-card.tsx`](file:///apps/frontend/src/features/settings/password-change-card.tsx) | `POST /auth/change-password` | ✅ **সম্পূর্ণ ইন্টিগ্রেটেড**: আসল `POST /auth/change-password` এন্ডপয়েন্টে ওল্ড ও নিউ পাসওয়ার্ড দিয়ে কল যুক্ত। |
| **Top Bar Branch Switcher (ব্রাঞ্চ ড্রপডাউন)** | [`app.$tenantSlug.tsx`](file:///apps/frontend/src/routes/app.$tenantSlug.tsx), [`platform.service.ts`](file:///apps/frontend/src/services/platform.service.ts) | `GET /tenants/:tenantSlug/branches` | ✅ **সম্পূর্ণ ইন্টিগ্রেটেড**: `listBranches` এখন ডাটাবেজে থাকা রিয়েল ব্রাঞ্চসমূহ ফেচ করে শীর্ষ বারে দেখায়। |
| **Reservation Rules & Settings** | [`reservations.tsx`](file:///apps/frontend/src/routes/app.$tenantSlug.reservations.tsx), [`people.service.ts`](file:///apps/frontend/src/services/people.service.ts) | `GET/PUT /tenants/:tenantSlug/reservation-settings` | ✅ **সম্পূর্ণ ইন্টিগ্রেটেড**: রিজার্ভেশন রুলস ও পলিসি মডাল যুক্ত করা হয়েছে যা `GET` ও `PUT` এন্ডপয়েন্টে পারসিস্ট করে। |

---

## ৪. Category C: আংশিক ইন্টিগ্রেশন ও মিসিং ওয়ার্কফ্লো

কিছু মডিউলে প্রধান কাজগুলো ব্যাকএন্ডে হলেও নিচের সাব-ফিচারগুলো লোকাল স্টেটে রয়ে গেছে:

1. **অর্ডার রিফান্ড (Order Refunds)**: [✅ সমাধান সম্পন্ন]
   * **কোড**: [`RefundDialog`](file:///apps/frontend/src/features/payments/refund-dialog.tsx), [`money.service.ts`](file:///apps/frontend/src/services/money.service.ts)
   * **বাস্তবায়ন**: ব্যাকএন্ডে `POST /tenants/:tenantSlug/orders/:orderId/refunds` এন্ডপয়েন্ট, `CreateOrderRefundDto`, `refundOrder()` সার্ভিস মেথড তৈরি করা হয়েছে যা অ্যাটমিক ট্রানজ্যাকশনে `OrderRefund` তৈরি করে, অর্ডারের `refunded` অ্যামাউন্ট আপডেট করে, এবং গ্রাহকের লয়াল্টি পয়েন্ট সমন্বয় করে। ফ্রন্টএন্ডের `money.refundOrder()` সরাসরি এই রিয়েল ব্যাকএন্ড এন্ডপয়েন্টে রিকোয়েস্ট পাঠায়।
2. **অর্ডার বাতিল / ভয়েড (Order Void / Cancel)**: [✅ সমাধান সম্পন্ন]
   * **কোড**: [`operations.service.ts`](file:///apps/frontend/src/services/operations.service.ts)
   * **বাস্তবায়ন**: ব্যাকএন্ডে `PATCH /tenants/:tenantSlug/orders/:orderId/cancel` এন্ডপয়েন্ট, `CancelOrderDto`, এবং `cancelOrder()` সার্ভিস মেথড তৈরি করা হয়েছে যা `ORDERS_VOID` পারমিশন ভ্যালিডেশন করে, আনপেইড বা ফুল-রিফান্ডেড অর্ডার ক্যানসেল করে, কারণ নোটসে যুক্ত করে এবং সংশ্লিষ্ট ডাইনিং টেবিল স্বয়ংক্রিয়ভাবে মুক্ত (`AVAILABLE`) করে দেয়। ফ্রন্টএন্ডের `cancelOrder()` এখন সরাসরি ব্যাকএন্ডের এই এন্ডপয়েন্টে কল পাঠায়।
3. **ক্যাটাগরি রি-অর্ডারিং (Category Drag/Move Order)**: [✅ সমাধান সম্পন্ন]
   * **কোড**: [`catalog.service.ts`](file:///apps/frontend/src/services/catalog.service.ts)
   * **বাস্তবায়ন**: ব্যাকএন্ডে `PATCH /tenants/:tenantSlug/categories/:categoryId/move` (উপরে/নিচে একক স্টেপে মুভ) এবং `PATCH /tenants/:tenantSlug/categories/reorder` (অ্যারে অব আইডি দিয়ে ব্যাচ রি-অর্ডার) এন্ডপয়েন্ট তৈরি করা হয়েছে। ডাটাবেজে `Category.sort` কলাম অ্যাটমিক প্রিজমা ট্রানজ্যাকশনের মাধ্যমে নরম্যালাইজড ক্রমানুসারে আপডেট হয়। ফ্রন্টএন্ডের `catalog.moveCategory()` এখন সরাসরি ব্যাকএন্ডের মুভ এন্ডপয়েন্টে রিকোয়েস্ট পাঠায় এবং লোকাল ক্যাশ আপডেট করে।
4. **পাসওয়ার্ড রিসেট ফ্লো (Forgot/Reset Password)**: [✅ সমাধান সম্পন্ন]
   * **কোড**: [`forgot-password.tsx`](file:///apps/frontend/src/routes/forgot-password.tsx), [`reset-password.tsx`](file:///apps/frontend/src/routes/reset-password.tsx), [`password.controller.ts`](file:///apps/backend/src/modules/auth/controllers/password.controller.ts), [`password.service.ts`](file:///apps/backend/src/modules/auth/services/password.service.ts)
   * **বাস্তবায়ন**: ব্যাকএন্ডে ক্রিপ্টোগ্রাফিক সিঙ্গেল-ইউজ JWT রিসেট টোকেন মেকানিজম যুক্ত করা হয়েছে (যা ব্যবহারকারীর বর্তমান পাসওয়ার্ড হ্যাশের সাথে বাইন্ড থাকায় পাসওয়ার্ড পরিবর্তনের সাথে সাথেই টোকেন স্বয়ংক্রিয়ভাবে অকার্যকর হয়ে যায়)। `POST /auth/forgot-password`, `GET /auth/reset-password/validate`, এবং `POST /auth/reset-password` এন্ডপয়েন্ট তৈরি করা হয়েছে এবং `EmailService` দিয়ে রেসপনসিভ এইচটিএমএল ইমেইল পাঠানো হয়। ফ্রন্টএন্ডে মক নোটিসগুলো সম্পূর্ণরূপে মুছে রিয়েল টোকেন ভ্যালিডেশন এবং পাসওয়ার্ড রিসেট ফ্লো ইন্টিগ্রেট করা হয়েছে।
5. **মাল্টি-টেন্যান্ট ওয়ার্কস্পেস সিলেকশন (Workspace Select)**: [✅ সমাধান সম্পন্ন]
   * **কোড**: [`workspace.select.tsx`](file:///apps/frontend/src/routes/workspace.select.tsx), [`platform.service.ts`](file:///apps/frontend/src/services/platform.service.ts), [`auth.controller.ts`](file:///apps/backend/src/modules/auth/controllers/auth.controller.ts), [`auth.service.ts`](file:///apps/backend/src/modules/auth/services/auth.service.ts)
   * **বাস্তবায়ন**: ব্যাকএন্ডে `GET /auth/me/tenants` এন্ডপয়েন্ট ও `getMyTenants()` সার্ভিস মেথড তৈরি করা হয়েছে। এটি ওনারদের জন্য সমস্ত রেস্তোরাঁ ও অন্যান্য স্টাফদের জন্য তাদের অ্যাসাইন করা এক্টিভ রেস্তোরাঁসমূহ রোল সহ ডাটাবেজ থেকে ফেচ করে। ফ্রন্টএন্ডের `platform.listTenantsForUser()` এখন সরাসরি ব্যাকএন্ড থেকে টেন্যান্ট তালিকা নিয়ে আসে, ইউজার মেম্বারশিপ আপডেট করে এবং `workspace.select.tsx` পেজে ডাইনামিক রোল ও ডেডিকেটেড ওয়ার্কস্পেস লোড করে।

---

## ৫. Category D: যে ফিচারগুলো ইতিমধ্যেই সফলভাবে Backend-এ যুক্ত আছে

তুলনা করার সুবিধার্থে নিচে অলরেডি কানেক্টেড মডিউলগুলোর তালিকা দেওয়া হলো:
* ✅ **অথেনটিকেশন**: লগইন (`/auth/login`), রিফ্রেশ টোকেন, স্টাফ ইনভাইট ডিটেইলস ও অ্যাকসেপ্ট ইনভাইট।
* ✅ **মেনু ও ক্যাটালগ**: মেনু ক্যাটাগরি (CRUD), মেনু আইটেম (CRUD + Availability), মডিফায়ার গ্রুপস (CRUD), কম্বো মিলস (CRUD), রেসিপি কস্টিং ও রেসিপি সেভ।
* ✅ **পিওএস অর্ডার প্রসেসিং**: নতুন অর্ডার ক্রিয়েট, অ্যাডিশনাল অর্ডার লাইনস যুক্ত করা, কিচেন স্ট্যাটাস অ্যাডভান্স (`/kitchen/advance`, `/kitchen/status`), সার্ভড মার্ক করা, অর্ডারের বিপরীতে পেমেন্ট রেকর্ড করা।
* ✅ **ডাইনিং টেবিল**: টেবিল তৈরি, আপডেট, ডিলিট, লেআউট পজিশন এবং টেবিল অকুপেন্সি স্ট্যাটাস আপডেট।
* ✅ **সাপ্লায়ার ও পারচেজিং**: সাপ্লায়ার CRUD, পারচেজ অর্ডার তৈরি/আপডেট/স্ট্যাটাস চেঞ্জ, গুডস রিসিট (GRN) গ্রহণ, সাপ্লায়ার রিটার্ন।
* ✅ **ইনভেন্টরি আইটেমস**: ইনগ্রেডিয়েন্ট তৈরি, আপডেট ও ডিলিট।
* ✅ **কাস্টমার ও লয়্যালটি**: কাস্টমার CRUD, লয়্যালটি পয়েন্ট অ্যাডজাস্ট, লয়্যালটি টিয়ারস (CRUD), লয়্যালটি গ্লোবাল সেটিংস।
* ✅ **প্রমোশন / ডিসকাউন্ট**: প্রমোশন কোড তৈরি, কুপন ভ্যালিডেশন এবং ডিলিট।
* ✅ **টিম ও স্টাফ**: স্টাফ মেম্বার তৈরি, ইনভাইটেশন পাঠানো, এডিট, ডিলিট এবং সিস্টেম রোল পারমিশন ম্যাট্রিক্স আপডেট।
* ✅ **ফাইন্যান্স লেজার**: অল ট্রানজ্যাকশন লেজার (পেমেন্টস হিস্ট্রি)।
* ✅ **অডিট লগ**: রিয়েল-টাইম সিস্টেম অডিট লগিং, ফিল্টারিং ও স্ট্যাটস।
* ✅ **নোটিফিকেশন**: Socket.io রিয়েল-টাইম গেটওয়ে, নোটিফিকেশন ফেচ ও মার্ক অ্যাজ রিড।

---

## ৬. প্রায়োরিটি অ্যাকশন প্ল্যান (Recommended Roadmap)

| প্রায়োরিটি | মডিউল | কী কাজ করতে হবে |
| :--- | :--- | :--- |
| **High** (P0) | **Cash Drawer & Sessions** | ব্যাকএন্ডে শিফট ওপেন/ক্লোজ এবং ক্যাশ এন্ট্রি মডেল ও API তৈরি করা। |
| **High** (P0) | **Order Refund & Cancel API** | ব্যাকএন্ডে `POST /orders/:id/refund` এবং `PATCH /orders/:id/cancel` যুক্ত করা। |
| **High** (P0) | **Stock Counts & Adjustments Integration** | অলরেডি রেডি থাকা ব্যাকএন্ড এন্ডপয়েন্টগুলোতে ফ্রন্টএন্ড কোড যুক্ত করা। |
| **Medium** (P1) | **Tenant Settings API** | রেস্তোরাঁর ট্যাক্স, সার্ভিস চার্জ, কারেন্সি, লোগো ও রিসিট ফুটার ডাটাবেজে সংরক্ষণের API তৈরি। |
| **Medium** (P1) | **Dashboard Aggregation API** | ক্লায়েন্ট-সাইড ক্যালকুলেশন বাদ দিয়ে ব্যাকএন্ড থেকে দ্রুত সারাংশ কুয়েরি দেওয়া। |
| **Medium** (P1) | **Expenses Management** | পেটি ক্যাশ ও খরচ এন্ট্রি মডেল এবং কন্ট্রোলার তৈরি। |
| ~~Low (P2)~~ | **Delivery & Riders Module** | ✅ **সম্পন্ন** - Rider মডেল, CRUD API, এবং ডেলিভারি ট্র্যাকিং/ডিসপ্যাচ এন্ডপয়েন্ট। |
| ~~Low (P2)~~ | ~~**Shifts & Attendance**~~ | ❌ **ডিলিট করা হয়েছে** - ব্যবহারকারীর নির্দেশনায় স্টাফ শিফট ও অ্যাটেনডেন্স ফিচার সম্পূর্ণ মুছে ফেলা হয়েছে। |
