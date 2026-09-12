import { Response } from 'express';
import { dbStore } from '../../db/store';
import { Order, OrderItem, Product, ProductBatch, ServiceItem, Customer, Branch, InventoryItem, StockMovement } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';
import { NotificationService } from '../../services/notification.service';

export class OrderController {
  static async listOrders(req: AuthenticatedRequest, res: Response) {
    const shopId = req.user?.role === 'super_admin' ? (req.query.shopId as string) || req.shopId : req.shopId;
    if (!shopId) return sendSuccess(res, []);

    const { branchId, status, paymentStatus, isJob } = req.query;

    const where: Array<{ field: string; op: any; value: any }> = [
      { field: 'shopId', op: '==', value: shopId },
    ];

    if (branchId && branchId !== 'all') {
      where.push({ field: 'branchId', op: '==', value: branchId });
    }
    if (status && status !== 'all') {
      where.push({ field: 'status', op: '==', value: status });
    }
    if (paymentStatus && paymentStatus !== 'all') {
      where.push({ field: 'paymentStatus', op: '==', value: paymentStatus });
    }

    const orders = await dbStore.collection<Order>('orders').query({
      where,
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    let results = orders.data;
    if (isJob === 'true') {
      results = results.filter(o => o.isJob || o.status === 'draft');
    }

    return sendSuccess(res, results);
  }

  static async getOrder(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const order = await dbStore.collection<Order>('orders').get(id);
    if (!order || (req.user?.role !== 'super_admin' && order.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Order not found', 404);
    }
    return sendSuccess(res, order);
  }

  private static async deductOrderInventory(order: Order, performedBy: string) {
    const { shopId, branchId, items, orderNumber, id: orderId } = order;
    const branch = await dbStore.collection<Branch>('branches').get(branchId);
    const branchName = branch?.name || 'Branch';

    for (const item of items) {
      if (item.type === 'product') {
        // 1. Batch deduction if batchId is specified
        if (item.batchId) {
          const batch = await dbStore.collection<ProductBatch>('productBatches').get(item.batchId);
          if (batch && batch.shopId === shopId) {
            const newBatchQty = Math.max(0, batch.quantity - item.quantity);
            await dbStore.collection<ProductBatch>('productBatches').update(batch.id, {
              quantity: newBatchQty,
              status: newBatchQty === 0 ? 'depleted' : batch.status,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        // 2. Branch inventory deduction
        const invList = await dbStore.collection<InventoryItem>('inventory').query({
          where: [
            { field: 'shopId', op: '==', value: shopId },
            { field: 'branchId', op: '==', value: branchId },
            { field: 'productId', op: '==', value: item.itemId },
          ],
        });

        if (invList.data.length > 0) {
          const inv = invList.data[0];
          const newQty = Math.max(0, inv.quantity - item.quantity);
          await dbStore.collection<InventoryItem>('inventory').update(inv.id, {
            quantity: newQty,
            updatedAt: new Date().toISOString(),
          });

          await dbStore.collection<StockMovement>('stockMovements').create({
            shopId,
            branchId,
            productId: item.itemId,
            type: 'sale',
            quantityDelta: -item.quantity,
            newQuantity: newQty,
            reason: item.batchNumber ? `Order sale #${orderNumber} (Batch: ${item.batchNumber})` : `Order sale #${orderNumber}`,
            referenceId: orderId,
            performedBy,
            createdAt: new Date().toISOString(),
          });

          if (newQty <= inv.minimumStockLevel) {
            await NotificationService.notifyShop(shopId, {
              title: 'Low Stock Alert',
              message: `Product "${item.name}" is low on stock (${newQty} units remaining in ${branchName}).`,
              type: 'warning',
              link: '/shop-owner/inventory',
            });
          }
        }
      }
    }
  }

  static async createOrder(req: AuthenticatedRequest, res: Response) {
    const shopId = req.shopId;
    if (!shopId) return sendError(res, 'BAD_REQUEST', 'Shop ID required', 400);

    const {
      branchId,
      customerId,
      customerName,
      customerPhone,
      items,
      tax = 0,
      discount = 0,
      status = 'confirmed',
      paymentStatus = 'paid',
      paymentMethod = 'cash',
      notes,
      isJob = false,
      jobTitle,
    } = req.body;

    const branch = await dbStore.collection<Branch>('branches').get(branchId);
    if (!branch || branch.shopId !== shopId) return sendError(res, 'BAD_REQUEST', 'Invalid branch', 400);

    let customer: Customer | null = null;
    if (customerId && customerId !== 'walkin') {
      customer = await dbStore.collection<Customer>('customers').get(customerId);
      if (!customer || customer.shopId !== shopId) return sendError(res, 'BAD_REQUEST', 'Invalid customer', 400);
    } else {
      // Walk-in customer or new customer
      const targetPhone = customerPhone || 'N/A';
      const targetName = customerName || 'Walk-in Customer';
      if (targetPhone && targetPhone !== 'N/A') {
        const found = await dbStore.collection<Customer>('customers').query({
          where: [
            { field: 'shopId', op: '==', value: shopId },
            { field: 'phone', op: '==', value: targetPhone },
          ],
        });
        if (found.data.length > 0) {
          customer = found.data[0];
        }
      }

      if (!customer) {
        customer = await dbStore.collection<Customer>('customers').create({
          shopId,
          name: targetName,
          phone: targetPhone,
          totalOrdersCount: 0,
          totalSpent: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    let subtotal = 0;
    const resolvedItems: OrderItem[] = [];

    for (const it of items) {
      if (it.type === 'product') {
        const prod = await dbStore.collection<Product>('products').get(it.itemId);
        if (!prod || prod.shopId !== shopId) return sendError(res, 'BAD_REQUEST', `Product ${it.itemId} not found`, 400);

        let selectedBatchNumber = it.batchNumber;
        let batchPrice: number | undefined;

        if (it.batchId) {
          const batch = await dbStore.collection<ProductBatch>('productBatches').get(it.batchId);
          if (batch && batch.shopId === shopId) {
            selectedBatchNumber = batch.batchNumber;
            batchPrice = batch.sellingPrice;
          }
        }

        // Direct editable unit price takes precedence; fallback to batch price or product catalog price
        const unitPrice = typeof it.unitPrice === 'number' && it.unitPrice >= 0
          ? it.unitPrice
          : (batchPrice !== undefined ? batchPrice : prod.sellingPrice);

        const itemTotal = unitPrice * it.quantity;
        subtotal += itemTotal;
        resolvedItems.push({
          type: 'product',
          itemId: prod.id,
          name: prod.name,
          sku: prod.sku,
          quantity: it.quantity,
          unitPrice,
          totalPrice: itemTotal,
          batchId: it.batchId || undefined,
          batchNumber: selectedBatchNumber || undefined,
          variant: it.variant,
        });
      } else {
        const serv = await dbStore.collection<ServiceItem>('services').get(it.itemId);
        if (!serv || serv.shopId !== shopId) return sendError(res, 'BAD_REQUEST', `Service ${it.itemId} not found`, 400);
        const unitPrice = typeof it.unitPrice === 'number' && it.unitPrice >= 0 ? it.unitPrice : serv.price;
        const itemTotal = unitPrice * it.quantity;
        subtotal += itemTotal;
        resolvedItems.push({
          type: 'service',
          itemId: serv.id,
          name: serv.name,
          quantity: it.quantity,
          unitPrice,
          totalPrice: itemTotal,
          assignedStaffId: it.assignedStaffId,
          assignedStaffName: it.assignedStaffName,
        });
      }
    }

    const totalAmount = Math.max(0, subtotal + tax - discount);
    const orderNumber = status === 'draft' || isJob
      ? `JOB-${Date.now().toString().slice(-6)}`
      : `ORD-${Date.now().toString().slice(-6)}`;

    const order = await dbStore.collection<Order>('orders').create({
      orderNumber,
      shopId,
      branchId,
      branchName: branch.name,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      items: resolvedItems,
      subtotal,
      tax,
      discount,
      totalAmount,
      status: status || 'confirmed',
      paymentStatus: status === 'draft' ? 'unpaid' : paymentStatus,
      paymentMethod,
      notes,
      isJob: Boolean(isJob || status === 'draft'),
      jobTitle: jobTitle || undefined,
      createdBy: req.user!.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Auto deduct inventory only for active confirmed/processing/completed orders (not drafts/jobs)
    if (order.status !== 'draft') {
      await OrderController.deductOrderInventory(order, req.user!.name);

      // Update customer lifetime stats
      await dbStore.collection<Customer>('customers').update(customer.id, {
        totalOrdersCount: (customer.totalOrdersCount || 0) + 1,
        totalSpent: (customer.totalSpent || 0) + totalAmount,
      });

      await NotificationService.notifyShop(shopId, {
        title: 'New Order Received',
        message: `Order #${orderNumber} (${totalAmount.toFixed(2)}) placed for ${customer.name}.`,
        type: 'success',
        link: '/shop-owner/orders',
      });
    }

    await AuditLogService.log({
      actor: req.user!,
      action: order.status === 'draft' ? 'CREATE_JOB_DRAFT' : 'CREATE_ORDER',
      entity: 'orders',
      entityId: order.id,
      shopId,
      after: order,
    });

    return sendSuccess(res, order, undefined, 201);
  }

  static async updateOrder(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const shopId = req.shopId;
    const existingOrder = await dbStore.collection<Order>('orders').get(id);
    if (!existingOrder || (req.user?.role !== 'super_admin' && existingOrder.shopId !== shopId)) {
      return sendError(res, 'NOT_FOUND', 'Order not found', 404);
    }

    const {
      branchId,
      customerId,
      customerName,
      customerPhone,
      items,
      tax = existingOrder.tax,
      discount = existingOrder.discount,
      status = existingOrder.status,
      paymentStatus = existingOrder.paymentStatus,
      paymentMethod = existingOrder.paymentMethod,
      notes = existingOrder.notes,
      isJob = existingOrder.isJob,
      jobTitle = existingOrder.jobTitle,
    } = req.body;

    let resolvedItems: OrderItem[] = existingOrder.items;
    let subtotal = existingOrder.subtotal;

    if (items && Array.isArray(items)) {
      subtotal = 0;
      resolvedItems = [];
      for (const it of items) {
        if (it.type === 'product') {
          const prod = await dbStore.collection<Product>('products').get(it.itemId);
          if (!prod || prod.shopId !== shopId) return sendError(res, 'BAD_REQUEST', `Product ${it.itemId} not found`, 400);

          let selectedBatchNumber = it.batchNumber;
          let batchPrice: number | undefined;

          if (it.batchId) {
            const batch = await dbStore.collection<ProductBatch>('productBatches').get(it.batchId);
            if (batch && batch.shopId === shopId) {
              selectedBatchNumber = batch.batchNumber;
              batchPrice = batch.sellingPrice;
            }
          }

          const unitPrice = typeof it.unitPrice === 'number' && it.unitPrice >= 0
            ? it.unitPrice
            : (batchPrice !== undefined ? batchPrice : prod.sellingPrice);

          const itemTotal = unitPrice * it.quantity;
          subtotal += itemTotal;
          resolvedItems.push({
            type: 'product',
            itemId: prod.id,
            name: prod.name,
            sku: prod.sku,
            quantity: it.quantity,
            unitPrice,
            totalPrice: itemTotal,
            batchId: it.batchId || undefined,
            batchNumber: selectedBatchNumber || undefined,
            variant: it.variant,
          });
        } else {
          const serv = await dbStore.collection<ServiceItem>('services').get(it.itemId);
          if (!serv || serv.shopId !== shopId) return sendError(res, 'BAD_REQUEST', `Service ${it.itemId} not found`, 400);
          const unitPrice = typeof it.unitPrice === 'number' && it.unitPrice >= 0 ? it.unitPrice : serv.price;
          const itemTotal = unitPrice * it.quantity;
          subtotal += itemTotal;
          resolvedItems.push({
            type: 'service',
            itemId: serv.id,
            name: serv.name,
            quantity: it.quantity,
            unitPrice,
            totalPrice: itemTotal,
            assignedStaffId: it.assignedStaffId,
            assignedStaffName: it.assignedStaffName,
          });
        }
      }
    }

    const totalAmount = Math.max(0, subtotal + tax - discount);

    const updated = await dbStore.collection<Order>('orders').update(id, {
      ...(branchId && { branchId }),
      ...(customerId && { customerId }),
      ...(customerName && { customerName }),
      ...(customerPhone && { customerPhone }),
      items: resolvedItems,
      subtotal,
      tax,
      discount,
      totalAmount,
      status,
      paymentStatus,
      paymentMethod,
      notes,
      isJob: Boolean(isJob || status === 'draft'),
      jobTitle,
      updatedAt: new Date().toISOString(),
    });

    if (!updated) {
      return sendError(res, 'SERVER_ERROR', 'Failed to update order', 500);
    }

    // If order was a draft/job and is now finalized to confirmed or completed, deduct inventory!
    if (existingOrder.status === 'draft' && (status === 'confirmed' || status === 'completed')) {
      await OrderController.deductOrderInventory(updated, req.user!.name);

      if (updated.customerId) {
        const cust = await dbStore.collection<Customer>('customers').get(updated.customerId);
        if (cust) {
          await dbStore.collection<Customer>('customers').update(cust.id, {
            totalOrdersCount: (cust.totalOrdersCount || 0) + 1,
            totalSpent: (cust.totalSpent || 0) + totalAmount,
          });
        }
      }

      const targetShopId = shopId || existingOrder.shopId;
      await NotificationService.notifyShop(targetShopId, {
        title: 'Job Completed',
        message: `Job #${updated.orderNumber} has been finalized and converted to completed order.`,
        type: 'success',
        link: '/shop-owner/orders',
      });
    }

    await AuditLogService.log({
      actor: req.user!,
      action: 'UPDATE_ORDER',
      entity: 'orders',
      entityId: id,
      shopId: updated.shopId,
      before: existingOrder,
      after: updated,
    });

    return sendSuccess(res, updated);
  }

  static async updateOrderStatus(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { status, paymentStatus } = req.body;

    const order = await dbStore.collection<Order>('orders').get(id);
    if (!order || (req.user?.role !== 'super_admin' && order.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Order not found', 404);
    }

    const updated = await dbStore.collection<Order>('orders').update(id, {
      ...(status && { status }),
      ...(paymentStatus && { paymentStatus }),
      updatedAt: new Date().toISOString(),
    });

    if (!updated) {
      return sendError(res, 'SERVER_ERROR', 'Failed to update order status', 500);
    }

    // If transitioning from draft to confirmed/completed, deduct inventory
    if (order.status === 'draft' && (status === 'confirmed' || status === 'completed')) {
      await OrderController.deductOrderInventory(updated, req.user!.name);

      if (updated.customerId) {
        const cust = await dbStore.collection<Customer>('customers').get(updated.customerId);
        if (cust) {
          await dbStore.collection<Customer>('customers').update(cust.id, {
            totalOrdersCount: (cust.totalOrdersCount || 0) + 1,
            totalSpent: (cust.totalSpent || 0) + updated.totalAmount,
          });
        }
      }
    }

    if (status && status !== order.status) {
      await NotificationService.notifyShop(order.shopId, {
        title: 'Order Status Changed',
        message: `Order #${order.orderNumber} is now marked as "${status.toUpperCase()}".`,
        type: 'info',
        link: '/shop-owner/orders',
      });
    }

    await AuditLogService.log({
      actor: req.user!,
      action: 'UPDATE_ORDER_STATUS',
      entity: 'orders',
      entityId: id,
      shopId: order.shopId,
      before: { status: order.status, paymentStatus: order.paymentStatus },
      after: { status, paymentStatus },
    });

    return sendSuccess(res, updated);
  }

  static async deleteOrder(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const order = await dbStore.collection<Order>('orders').get(id);
    if (!order || (req.user?.role !== 'super_admin' && order.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Order not found', 404);
    }

    await dbStore.collection<Order>('orders').delete(id);

    await AuditLogService.log({
      actor: req.user!,
      action: 'DELETE_ORDER',
      entity: 'orders',
      entityId: id,
      shopId: order.shopId,
      before: order,
    });

    return sendSuccess(res, { deleted: true, id });
  }
}
