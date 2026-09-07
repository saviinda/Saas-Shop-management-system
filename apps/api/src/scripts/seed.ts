import bcrypt from 'bcryptjs';
import { dbStore } from '../db/store';
import {
  User,
  Shop,
  Branch,
  SubscriptionPackage,
  Subscription,
  Product,
  ServiceItem,
  Customer,
  Order,
  InventoryItem,
  StockMovement,
  Supplier,
  PurchaseOrder,
  GoodsReceivedNote,
  EmployeeTask,
  SupportTicket,
  AppNotification,
  AuditLog,
  PaymentTransaction,
} from '@saas/types';

export async function seedDatabase() {
  console.log('--- Initializing SaaS Platform Data Seeder ---');

  // 1. Create Packages
  const basicPkg = await dbStore.collection<SubscriptionPackage>('packages').create({
    id: 'pkg_basic',
    name: 'Basic Tier',
    description: 'Essential toolkit for single shop and small boutique operations',
    price: 49,
    durationDays: 30,
    limits: {
      shops: 1,
      branches: 1,
      users: 5,
      products: 100,
      services: 20,
      storageMb: 500,
    },
    features: ['basic_inventory', 'order_management', 'standard_support', 'single_branch'],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const standardPkg = await dbStore.collection<SubscriptionPackage>('packages').create({
    id: 'pkg_standard',
    name: 'Standard Tier',
    description: 'Scaling multi-branch business with advanced inventory and purchasing',
    price: 129,
    durationDays: 30,
    limits: {
      shops: 1,
      branches: 3,
      users: 15,
      products: 500,
      services: 50,
      storageMb: 2000,
    },
    features: ['multi_branch', 'advanced_inventory', 'procurement_po_grn', 'task_management', 'priority_support'],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const premiumPkg = await dbStore.collection<SubscriptionPackage>('packages').create({
    id: 'pkg_premium',
    name: 'Premium Tier',
    description: 'Full enterprise SaaS capability with unlimited staff, branches and high throughput',
    price: 299,
    durationDays: 30,
    limits: {
      shops: 5,
      branches: 10,
      users: 50,
      products: 2500,
      services: 250,
      storageMb: 10000,
    },
    features: ['multi_shop', 'multi_branch', 'full_reports', 'custom_roles', 'dedicated_support', 'audit_export'],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 2. Create Super Admin
  const adminPasswordHash = await bcrypt.hash('Admin@123456', 10);
  const superAdmin = await dbStore.collection<User & { passwordHash: string }>('users').create({
    id: 'usr_super_admin',
    name: 'Super Admin',
    email: 'admin@platform.com',
    role: 'super_admin',
    status: 'active',
    phone: '+1 800 555 0199',
    passwordHash: adminPasswordHash,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 3. Create Demo Shop 1: Urban Cafe Hub
  const shopId = 'shp_urban_cafe';
  const ownerId = 'usr_shop_owner_1';
  const branch1Id = 'br_urban_downtown';
  const branch2Id = 'br_urban_westside';
  const subId = 'sub_urban_cafe';

  const defaultBranch = await dbStore.collection<Branch>('branches').create({
    id: branch1Id,
    shopId,
    name: 'Downtown Main Branch',
    code: 'UCH-DT01',
    address: '104 Main Street, Downtown Financial District',
    phone: '+1 555 234 5678',
    isDefault: true,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const branch2 = await dbStore.collection<Branch>('branches').create({
    id: branch2Id,
    shopId,
    name: 'Westside Mall Branch',
    code: 'UCH-WS02',
    address: '420 West Boulevard, Bay Plaza',
    phone: '+1 555 987 6543',
    isDefault: false,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const subscription = await dbStore.collection<Subscription>('subscriptions').create({
    id: subId,
    shopId,
    packageId: standardPkg.id,
    packageName: standardPkg.name,
    limits: standardPkg.limits,
    price: standardPkg.price,
    startAt: new Date().toISOString(),
    expiryAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    autoRenew: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const shopOwnerPasswordHash = await bcrypt.hash('Shop@123456', 10);
  const shopOwner = await dbStore.collection<User & { passwordHash: string }>('users').create({
    id: ownerId,
    name: 'Marcus Vance',
    email: 'owner@urbancafe.com',
    role: 'shop_owner',
    status: 'active',
    shopId,
    branchIds: [branch1Id, branch2Id],
    phone: '+1 555 456 7890',
    passwordHash: shopOwnerPasswordHash,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const shop = await dbStore.collection<Shop>('shops').create({
    id: shopId,
    name: 'Urban Cafe Hub',
    ownerId,
    ownerName: shopOwner.name,
    ownerEmail: shopOwner.email,
    description: 'Artisan coffee roastery, specialty bakery and modern workspace cafe.',
    logoUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=150',
    contactNumber: '+1 555 234 5678',
    email: 'contact@urbancafe.com',
    address: '104 Main Street, Downtown Financial District',
    category: 'Food & Beverage / Specialty Cafe',
    openingHours: 'Mon-Sun: 07:00 AM - 10:00 PM',
    status: 'active',
    packageId: standardPkg.id,
    packageName: standardPkg.name,
    subscriptionId: subId,
    defaultBranchId: defaultBranch.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Additional demo shops for platform overview metrics
  await dbStore.collection<Shop>('shops').create({
    id: 'shp_tech_gear',
    name: 'TechGear Pro',
    ownerId: 'usr_owner_2',
    ownerName: 'Elena Rostova',
    ownerEmail: 'elena@techgear.io',
    contactNumber: '+1 555 901 2233',
    email: 'sales@techgear.io',
    address: '77 Silicon Way, Tech Park',
    category: 'Consumer Electronics & Hardware',
    status: 'active',
    packageId: premiumPkg.id,
    packageName: premiumPkg.name,
    defaultBranchId: 'br_tech_01',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await dbStore.collection<Shop>('shops').create({
    id: 'shp_bloom_floral',
    name: 'Bloom Floral Studio',
    ownerId: 'usr_owner_3',
    ownerName: 'Chloe Bennett',
    ownerEmail: 'chloe@bloomfloral.com',
    contactNumber: '+1 555 334 8899',
    email: 'hello@bloomfloral.com',
    address: '12 Garden Lane, Arts District',
    category: 'Floral & Botanical Design',
    status: 'pending',
    packageId: basicPkg.id,
    packageName: basicPkg.name,
    defaultBranchId: 'br_bloom_01',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 4. Staff Users
  const staffHash = await bcrypt.hash('Staff@123456', 10);
  const manager = await dbStore.collection<User & { passwordHash: string }>('users').create({
    id: 'usr_manager_1',
    name: 'Sarah Jenkins',
    email: 'sarah.manager@urbancafe.com',
    role: 'manager',
    status: 'active',
    shopId,
    branchIds: [branch1Id, branch2Id],
    phone: '+1 555 111 2233',
    passwordHash: staffHash,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const worker = await dbStore.collection<User & { passwordHash: string }>('users').create({
    id: 'usr_worker_1',
    name: 'Alex Rivera',
    email: 'alex.barista@urbancafe.com',
    role: 'worker',
    status: 'active',
    shopId,
    branchIds: [branch1Id],
    phone: '+1 555 444 7788',
    passwordHash: staffHash,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 5. Suppliers
  const supplier1 = await dbStore.collection<Supplier>('suppliers').create({
    id: 'sup_colombia_beans',
    shopId,
    name: 'Highland Coffee Importers',
    contactPerson: 'Carlos Mendez',
    email: 'orders@highlandbeans.com',
    phone: '+1 555 889 0011',
    address: 'Warehouse 4, Roaster Row, Seattle',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 6. Products & Inventory
  const p1 = await dbStore.collection<Product>('products').create({
    id: 'prod_ethiopian_roast',
    shopId,
    sku: 'UCH-COF-001',
    name: 'Single-Origin Ethiopian Yirgacheffe (1kg)',
    description: 'Floral aroma with bright citrus and bergamot notes.',
    category: 'Coffee Beans',
    costPrice: 18.00,
    sellingPrice: 34.00,
    minimumStockLevel: 10,
    supplierId: supplier1.id,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const p2 = await dbStore.collection<Product>('products').create({
    id: 'prod_espresso_machine',
    shopId,
    sku: 'UCH-EQP-002',
    name: 'Dual Boiler Commercial Espresso Machine',
    description: 'Precision temperature PID commercial grade 2-group machine.',
    category: 'Brewing Equipment',
    costPrice: 1200.00,
    sellingPrice: 1850.00,
    minimumStockLevel: 2,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const p3 = await dbStore.collection<Product>('products').create({
    id: 'prod_almond_croissant',
    shopId,
    sku: 'UCH-BAK-003',
    name: 'Fresh Baked Almond Croissant',
    description: 'Flaky French butter pastry with toasted frangipane filling.',
    category: 'Bakery & Pastries',
    costPrice: 1.80,
    sellingPrice: 4.95,
    minimumStockLevel: 15,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Branch Inventory
  await dbStore.collection<InventoryItem>('inventory').create({
    shopId,
    branchId: branch1Id,
    productId: p1.id,
    productName: p1.name,
    sku: p1.sku,
    quantity: 45,
    minimumStockLevel: 10,
    costPrice: 18.00,
    sellingPrice: 34.00,
    updatedAt: new Date().toISOString(),
  });

  await dbStore.collection<InventoryItem>('inventory').create({
    shopId,
    branchId: branch1Id,
    productId: p2.id,
    productName: p2.name,
    sku: p2.sku,
    quantity: 3,
    minimumStockLevel: 2,
    costPrice: 1200.00,
    sellingPrice: 1850.00,
    updatedAt: new Date().toISOString(),
  });

  await dbStore.collection<InventoryItem>('inventory').create({
    shopId,
    branchId: branch1Id,
    productId: p3.id,
    productName: p3.name,
    sku: p3.sku,
    quantity: 4, // Trigger low stock alert!
    minimumStockLevel: 15,
    costPrice: 1.80,
    sellingPrice: 4.95,
    updatedAt: new Date().toISOString(),
  });

  // 7. Services
  await dbStore.collection<ServiceItem>('services').create({
    id: 'srv_barista_class',
    shopId,
    name: 'Masterclass Latte Art & Espresso Crafting',
    description: '2-hour hands-on barista calibration with sensory tasting.',
    category: 'Workshops & Training',
    price: 85.00,
    durationMinutes: 120,
    assignedStaffIds: [worker.id],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 8. Customers & Orders
  const customer1 = await dbStore.collection<Customer>('customers').create({
    id: 'cust_david_miller',
    shopId,
    name: 'David Miller',
    email: 'david.miller@gmail.com',
    phone: '+1 555 776 2211',
    address: '18 Hudson Square, Apt 4B',
    totalOrdersCount: 3,
    totalSpent: 122.95,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await dbStore.collection<Order>('orders').create({
    id: 'ord_1001',
    orderNumber: 'ORD-982104',
    shopId,
    branchId: branch1Id,
    branchName: 'Downtown Main Branch',
    customerId: customer1.id,
    customerName: customer1.name,
    customerPhone: customer1.phone,
    items: [
      {
        type: 'product',
        itemId: p1.id,
        name: p1.name,
        sku: p1.sku,
        quantity: 2,
        unitPrice: 34.00,
        totalPrice: 68.00,
      },
      {
        type: 'product',
        itemId: p3.id,
        name: p3.name,
        sku: p3.sku,
        quantity: 3,
        unitPrice: 4.95,
        totalPrice: 14.85,
      },
    ],
    subtotal: 82.85,
    tax: 6.63,
    discount: 0,
    totalAmount: 89.48,
    status: 'completed',
    paymentStatus: 'paid',
    paymentMethod: 'credit_card',
    createdBy: manager.name,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 9. Tasks
  await dbStore.collection<EmployeeTask>('tasks').create({
    id: 'tsk_grinder_calibration',
    shopId,
    branchId: branch1Id,
    title: 'Daily Espresso Grinder Micron Calibration',
    description: 'Calibrate Mahlkonig EK43 burrs for morning rush profile and log extraction yield TDS.',
    assigneeId: worker.id,
    assigneeName: worker.name,
    createdById: manager.id,
    createdByName: manager.name,
    priority: 'high',
    status: 'in_progress',
    dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    comments: [
      {
        id: 'comm_1',
        userId: worker.id,
        userName: worker.name,
        comment: 'Burrs inspected, running test shots at 18g in / 36g out.',
        createdAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 10. Support Tickets
  await dbStore.collection<SupportTicket>('conversations').create({
    id: 'tkt_custom_domain',
    ticketNumber: 'TKT-702914',
    shopId,
    shopName: shop.name,
    subject: 'Request assistance with custom branch subdomains',
    category: 'technical',
    priority: 'medium',
    status: 'open',
    messages: [
      {
        id: 'msg_1',
        senderId: shopOwner.id,
        senderName: shopOwner.name,
        senderRole: 'shop_owner',
        message: 'Hello Admin team, we would like to configure westside.urbancafe.com for our second branch. Please advise on DNS CNAME records.',
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 11. Payments
  await dbStore.collection<PaymentTransaction>('payments').create({
    id: 'pay_init_sub',
    shopId,
    shopName: shop.name,
    packageId: standardPkg.id,
    amount: standardPkg.price,
    currency: 'USD',
    method: 'bank_transfer',
    status: 'successful',
    bankSlipUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400',
    notes: 'Approved standard subscription invoice #INV-8831',
    reviewedBy: 'Super Admin',
    reviewedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 12. Audit Logs
  await dbStore.collection<AuditLog>('auditLogs').create({
    actorId: superAdmin.id,
    actorName: superAdmin.name,
    actorRole: 'super_admin',
    action: 'PLATFORM_BOOTSTRAP',
    entity: 'system',
    entityId: 'sys_root',
    after: { version: '1.0.0', status: 'ready' },
    createdAt: new Date().toISOString(),
  });

  console.log('--- Database Seeder Finished Successfully! ---');
  console.log('Demo Credentials:');
  console.log('  Super Admin: admin@platform.com / Admin@123456');
  console.log('  Shop Owner:  owner@urbancafe.com / Shop@123456');
  console.log('  Manager:     sarah.manager@urbancafe.com / Staff@123456');
  console.log('  Worker:      alex.barista@urbancafe.com / Staff@123456');
}

if (require.main === module) {
  seedDatabase();
}
