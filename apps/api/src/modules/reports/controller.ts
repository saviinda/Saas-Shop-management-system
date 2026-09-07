import { Response } from 'express';
import { dbStore } from '../../db/store';
import {
  Shop,
  Subscription,
  PaymentTransaction,
  ChangeRequest,
  Order,
  Product,
  InventoryItem,
  EmployeeTask,
  User,
  Branch,
  Customer,
  PurchaseOrder,
  GoodsReceivedNote,
  Supplier,
  ServiceItem,
} from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';

export class ReportController {
  static async getSuperAdminDashboard(req: AuthenticatedRequest, res: Response) {
    const [
      shopsRes,
      subsRes,
      paymentsRes,
      pendingRequestsRes,
      auditLogsRes,
      usersRes,
      ordersRes,
      branchesRes,
    ] = await Promise.all([
      dbStore.collection<Shop>('shops').query(),
      dbStore.collection<Subscription>('subscriptions').query(),
      dbStore.collection<PaymentTransaction>('payments').query(),
      dbStore.collection<ChangeRequest>('changeRequests').query({ where: [{ field: 'status', op: '==', value: 'pending' }] }),
      dbStore.collection('auditLogs').query({ orderBy: { field: 'createdAt', direction: 'desc' }, limit: 15 }),
      dbStore.collection<User>('users').query(),
      dbStore.collection<Order>('orders').query(),
      dbStore.collection<Branch>('branches').query(),
    ]);

    const shops = shopsRes.data;
    const totalShops = shops.length;
    const activeShops = shops.filter(s => s.status === 'active').length;
    const pendingShops = shops.filter(s => s.status === 'pending').length;
    const inactiveShops = shops.filter(s => s.status === 'inactive').length;
    const restrictedShops = shops.filter(s => s.status === 'restricted' || s.status === 'suspended').length;

    const subscriptions = subsRes.data;
    const activeSubs = subscriptions.filter(s => s.status === 'active').length;

    // Payments and Real Revenue Calculation
    const payments = paymentsRes.data;
    const successfulPayments = payments.filter(p => p.status === 'successful');
    const totalRevenue = successfulPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const pendingPaymentsCount = payments.filter(p => p.status === 'pending').length;
    const totalPendingRequests = pendingRequestsRes.data.length + pendingPaymentsCount + pendingShops;

    // Calculate Monthly Recurring Revenue (MRR) from active subscriptions
    const mrr = subscriptions
      .filter(s => s.status === 'active')
      .reduce((sum, s) => sum + (s.price || 0), 0);

    // Calculate dynamic Subscription Tier Distribution
    const tierCounts: Record<string, number> = {};
    subscriptions.forEach(s => {
      const tierName = s.packageName || 'Standard Tier';
      tierCounts[tierName] = (tierCounts[tierName] || 0) + 1;
    });

    const tierColors: Record<string, string> = {
      'Premium Tier': '#4F46E5',
      'Standard Tier': '#3B82F6',
      'Basic Tier': '#94A3B8',
    };

    const subTotal = Math.max(1, subscriptions.length);
    const subDistribution = Object.entries(tierCounts).map(([name, count]) => ({
      name,
      count,
      value: Math.round((count / subTotal) * 100),
      color: tierColors[name] || '#6366F1',
    }));

    if (subDistribution.length === 0) {
      subDistribution.push({ name: 'Standard Tier', count: 1, value: 100, color: '#4F46E5' });
    }

    // Dynamic Monthly Revenue Aggregation (Last 6 Months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const last6Months: Array<{ month: string; year: number; revenue: number; transactions: number }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mName = monthNames[d.getMonth()];
      const year = d.getFullYear();

      const monthPayments = successfulPayments.filter(p => {
        if (!p.createdAt) return false;
        const pDate = new Date(p.createdAt);
        return pDate.getFullYear() === year && pDate.getMonth() === d.getMonth();
      });

      const mRev = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      last6Months.push({
        month: `${mName} ${year}`,
        year,
        revenue: mRev,
        transactions: monthPayments.length,
      });
    }

    // Dynamic Business Categories Distribution
    const categoryCounts: Record<string, number> = {};
    shops.forEach(s => {
      const cat = s.category || 'General Store';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const categoryDistribution = Object.entries(categoryCounts).map(([category, count]) => ({
      category,
      count,
      percentage: totalShops > 0 ? Math.round((count / totalShops) * 100) : 0,
    }));

    // Payment Methods Breakdown
    const methodCounts: Record<string, { count: number; amount: number }> = {};
    successfulPayments.forEach(p => {
      const m = (p as any).paymentMethod || (p as any).method || 'card';
      if (!methodCounts[m]) methodCounts[m] = { count: 0, amount: 0 };
      methodCounts[m].count += 1;
      methodCounts[m].amount += p.amount || 0;
    });

    const paymentMethods = Object.entries(methodCounts).map(([method, data]) => ({
      method,
      count: data.count,
      amount: data.amount,
      percentage: totalRevenue > 0 ? Math.round((data.amount / totalRevenue) * 100) : 0,
    }));

    // Detailed Shop Performance Summary for Analytics Table
    const shopSummary = shops.map(s => {
      const shopOrders = ordersRes.data.filter(o => o.shopId === s.id);
      const shopBranches = branchesRes.data.filter(b => b.shopId === s.id);
      const shopStaff = usersRes.data.filter(u => u.shopId === s.id);
      const shopRevenue = shopOrders
        .filter(o => o.paymentStatus === 'paid')
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      return {
        id: s.id,
        name: s.name,
        category: s.category || 'General Store',
        status: s.status,
        packageName: s.packageName || 'Standard Tier',
        branchesCount: shopBranches.length,
        staffCount: shopStaff.length,
        ordersCount: shopOrders.length,
        revenue: shopRevenue,
        createdAt: s.createdAt,
      };
    });

    return sendSuccess(res, {
      metrics: {
        totalShops,
        activeShops,
        pendingShops,
        inactiveShops,
        restrictedShops,
        activeSubs,
        totalSubscriptions: subscriptions.length,
        grossRevenue: totalRevenue,
        mrr,
        arpu: totalShops > 0 ? Math.round(totalRevenue / totalShops) : 0,
        pendingRequests: totalPendingRequests,
        pendingPaymentsCount,
        totalUsers: usersRes.data.length,
        totalBranches: branchesRes.data.length,
        totalOrders: ordersRes.data.length,
        successfulPaymentsCount: successfulPayments.length,
        verificationRate: payments.length > 0 ? Math.round((successfulPayments.length / payments.length) * 100) : 100,
      },
      revenueTrend: last6Months,
      subDistribution,
      categoryDistribution,
      paymentMethods,
      shopSummary,
      recentActivity: auditLogsRes.data,
      lastUpdated: new Date().toISOString(),
    });
  }

  static async getShopOwnerDashboard(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendSuccess(res, {});

    const { branchId } = req.query;

    const [ordersRes, productsRes, invRes, tasksRes, customersRes, shopData] = await Promise.all([
      dbStore.collection<Order>('orders').query({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
      dbStore.collection<Product>('products').query({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
      dbStore.collection<InventoryItem>('inventory').query({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
      dbStore.collection<EmployeeTask>('tasks').query({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
      dbStore.collection('customers').query({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
      dbStore.collection<Shop>('shops').get(shopId),
    ]);

    let orders = ordersRes.data;
    let inventory = invRes.data;
    let tasks = tasksRes.data;

    if (branchId && branchId !== 'all') {
      orders = orders.filter(o => o.branchId === branchId);
      inventory = inventory.filter(i => i.branchId === branchId);
      tasks = tasks.filter(t => t.branchId === branchId);
    }

    const totalSales = orders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.totalAmount, 0);
    const lowStockItems = inventory.filter(i => i.quantity <= i.minimumStockLevel);
    const outOfStockItems = inventory.filter(i => i.quantity === 0);

    return sendSuccess(res, {
      shop: shopData,
      metrics: {
        totalOrders: orders.length,
        pendingOrders: orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length,
        completedOrders: orders.filter(o => o.status === 'completed').length,
        cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
        totalSales,
        totalCustomers: customersRes.data.length,
        totalProducts: productsRes.data.length,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
        pendingTasksCount: tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length,
        completedTasksCount: tasks.filter(t => t.status === 'completed').length,
      },
      recentOrders: orders.slice(0, 10),
      lowStockItems: lowStockItems.slice(0, 5),
      tasks: tasks.slice(0, 5),
    });
  }

  static async getShopReports(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendSuccess(res, {});

    const { branchId, startDate, endDate } = req.query;

    const [
      ordersRes,
      productsRes,
      invRes,
      tasksRes,
      customersRes,
      posRes,
      grnsRes,
      suppliersRes,
      servicesRes,
      usersRes,
    ] = await Promise.all([
      dbStore.collection<Order>('orders').query({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
      dbStore.collection<Product>('products').query({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
      dbStore.collection<InventoryItem>('inventory').query({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
      dbStore.collection<EmployeeTask>('tasks').query({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
      dbStore.collection<Customer>('customers').query({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
      dbStore.collection<PurchaseOrder>('purchaseOrders').query({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
      dbStore.collection<GoodsReceivedNote>('grns').query({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
      dbStore.collection<Supplier>('suppliers').query({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
      dbStore.collection<ServiceItem>('services').query({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
      dbStore.collection<User>('users').query({ where: [{ field: 'shopId', op: '==', value: shopId }] }),
    ]);

    let orders = ordersRes.data;
    let inventory = invRes.data;
    let tasks = tasksRes.data;
    let pos = posRes.data;
    let grns = grnsRes.data;

    // Optional Branch Filter
    if (branchId && branchId !== 'all') {
      orders = orders.filter(o => o.branchId === branchId);
      inventory = inventory.filter(i => i.branchId === branchId);
      tasks = tasks.filter(t => t.branchId === branchId);
      pos = pos.filter(p => p.branchId === branchId);
      grns = grns.filter(g => g.branchId === branchId);
    }

    // Optional Date Filtering
    if (startDate) {
      const s = new Date(startDate as string).getTime();
      orders = orders.filter(o => new Date(o.createdAt).getTime() >= s);
      pos = pos.filter(p => new Date(p.createdAt).getTime() >= s);
      grns = grns.filter(g => new Date(g.createdAt).getTime() >= s);
      tasks = tasks.filter(t => new Date(t.createdAt).getTime() >= s);
    }
    if (endDate) {
      const e = new Date(endDate as string).getTime() + 24 * 60 * 60 * 1000;
      orders = orders.filter(o => new Date(o.createdAt).getTime() <= e);
      pos = pos.filter(p => new Date(p.createdAt).getTime() <= e);
      grns = grns.filter(g => new Date(g.createdAt).getTime() <= e);
      tasks = tasks.filter(t => new Date(t.createdAt).getTime() <= e);
    }

    // 1. Sales & Order Report
    const totalOrdersCount = orders.length;
    const paidOrders = orders.filter(o => o.paymentStatus === 'paid');
    const grossSales = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const subtotalSales = paidOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
    const taxCollected = paidOrders.reduce((sum, o) => sum + (o.tax || 0), 0);
    const discountGiven = paidOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
    const aov = paidOrders.length > 0 ? Math.round(grossSales / paidOrders.length) : 0;

    const paymentMethodsMap: Record<string, { count: number; total: number }> = {};
    orders.forEach(o => {
      const m = o.paymentMethod || 'cash';
      if (!paymentMethodsMap[m]) paymentMethodsMap[m] = { count: 0, total: 0 };
      paymentMethodsMap[m].count += 1;
      paymentMethodsMap[m].total += o.totalAmount || 0;
    });

    // 2. Product Sales Aggregation
    const productSalesMap: Record<string, { id: string; name: string; sku: string; unitsSold: number; totalRevenue: number }> = {};
    orders.forEach(o => {
      o.items?.forEach(it => {
        if (it.type === 'product') {
          if (!productSalesMap[it.itemId]) {
            productSalesMap[it.itemId] = { id: it.itemId, name: it.name, sku: it.sku || '', unitsSold: 0, totalRevenue: 0 };
          }
          productSalesMap[it.itemId].unitsSold += it.quantity;
          productSalesMap[it.itemId].totalRevenue += it.unitPrice * it.quantity;
        }
      });
    });

    const topSellingProducts = Object.values(productSalesMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 15);

    // 3. Customer Analytics
    const customers = customersRes.data;
    const topCustomers = [...customers]
      .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
      .slice(0, 15);

    // 4. Stock & Inventory Report
    const totalStockUnits = inventory.reduce((sum, i) => sum + (i.quantity || 0), 0);
    const totalInventoryCost = inventory.reduce((sum, i) => sum + ((i.quantity || 0) * (i.costPrice || 0)), 0);
    const totalInventoryRetail = inventory.reduce((sum, i) => sum + ((i.quantity || 0) * (i.sellingPrice || 0)), 0);
    const lowStockList = inventory.filter(i => i.quantity > 0 && i.quantity <= i.minimumStockLevel);
    const outOfStockList = inventory.filter(i => i.quantity <= 0);

    // 5. Purchase Orders & Suppliers
    const totalPOSpend = pos.filter(p => p.status !== 'cancelled').reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const suppliers = suppliersRes.data;

    const supplierSpendMap: Record<string, { id: string; name: string; poCount: number; totalSpend: number }> = {};
    pos.forEach(p => {
      if (!supplierSpendMap[p.supplierId]) {
        supplierSpendMap[p.supplierId] = { id: p.supplierId, name: p.supplierName, poCount: 0, totalSpend: 0 };
      }
      supplierSpendMap[p.supplierId].poCount += 1;
      if (p.status !== 'cancelled') {
        supplierSpendMap[p.supplierId].totalSpend += p.totalAmount || 0;
      }
    });

    // 6. Goods Received Notes (GRN)
    const totalGRNValue = grns.reduce((sum, g) => sum + (g.totalValue || 0), 0);
    const totalDamagedUnits = grns.reduce((sum, g) => {
      return sum + (g.receivedItems?.reduce((s, it) => s + (it.damagedQty || 0), 0) || 0);
    }, 0);

    // 7. Tasks & Employees
    const tasksCompleted = tasks.filter(t => t.status === 'completed').length;
    const tasksPending = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;

    // 8. Services Report
    const serviceSalesMap: Record<string, { id: string; name: string; bookingsCount: number; totalRevenue: number }> = {};
    orders.forEach(o => {
      o.items?.forEach(it => {
        if (it.type === 'service') {
          if (!serviceSalesMap[it.itemId]) {
            serviceSalesMap[it.itemId] = { id: it.itemId, name: it.name, bookingsCount: 0, totalRevenue: 0 };
          }
          serviceSalesMap[it.itemId].bookingsCount += it.quantity;
          serviceSalesMap[it.itemId].totalRevenue += it.unitPrice * it.quantity;
        }
      });
    });

    return sendSuccess(res, {
      salesReport: {
        totalOrdersCount,
        paidOrdersCount: paidOrders.length,
        grossSales,
        subtotalSales,
        taxCollected,
        discountGiven,
        aov,
        paymentMethods: Object.entries(paymentMethodsMap).map(([method, val]) => ({
          method,
          count: val.count,
          total: val.total,
        })),
        recentOrders: orders.slice(0, 20),
      },
      productReport: {
        totalProducts: productsRes.data.length,
        topSellingProducts,
      },
      customerReport: {
        totalCustomers: customers.length,
        topCustomers,
      },
      inventoryReport: {
        totalStockUnits,
        totalInventoryCost,
        totalInventoryRetail,
        lowStockCount: lowStockList.length,
        outOfStockCount: outOfStockList.length,
        lowStockItems: lowStockList,
        outOfStockItems: outOfStockList,
      },
      purchaseReport: {
        totalPOCount: pos.length,
        totalPOSpend,
        supplierSpendBreakdown: Object.values(supplierSpendMap),
        recentPOs: pos.slice(0, 15),
      },
      grnReport: {
        totalGRNCount: grns.length,
        totalGRNValue,
        totalDamagedUnits,
        recentGRNs: grns.slice(0, 15),
      },
      taskReport: {
        totalTasks: tasks.length,
        tasksCompleted,
        tasksPending,
        tasksByPriority: {
          urgent: tasks.filter(t => t.priority === 'urgent').length,
          high: tasks.filter(t => t.priority === 'high').length,
          medium: tasks.filter(t => t.priority === 'medium').length,
          low: tasks.filter(t => t.priority === 'low').length,
        },
      },
      serviceReport: {
        totalServices: servicesRes.data.length,
        topServices: Object.values(serviceSalesMap).sort((a, b) => b.totalRevenue - a.totalRevenue),
      },
    });
  }
}
