import { Response } from 'express';
import { dbStore } from '../../db/store';
import { Order, OrderItem, Product, ProductBatch, ServiceItem, Customer, Branch, InventoryItem, StockMovement, User } from '@saas/types';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';
import { NotificationService } from '../../services/notification.service';
import { EmailService } from '../../services/email.service';

export class OrderController {
  static async listOrders(req: AuthenticatedRequest, res: Response) {
    const shopId = req.user?.role === 'super_admin' ? (req.query.shopId as string) || req.shopId : req.shopId;
    if (!shopId) return sendSuccess(res, []);

    const { branchId, status, paymentStatus, isJob, search, dateFrom, dateTo, customerId, customer, page = '1', limit = '10' } = req.query;

    const where: Array<{ field: string; op: any; value: any }> = [
      { field: 'shopId', op: '==', value: shopId },
    ];

    const orders = await dbStore.collection<Order>('orders').query({
      where,
      orderBy: { field: 'createdAt', direction: 'desc' },
    });

    let results = orders.data;

    // Filter by branch
    if (branchId && branchId !== 'all') {
      if (status === 'draft' || isJob === 'true' || status === 'jobs') {
        // For parked jobs, show jobs for this branch or unassigned branch jobs
        results = results.filter(o => o.branchId === branchId || !o.branchId);
      } else {
        results = results.filter(o => o.branchId === branchId);
      }
    }

    if (status && status !== 'all' && status !== 'jobs') {
      results = results.filter(o => o.status === status);
    }
    if (paymentStatus && paymentStatus !== 'all') {
      results = results.filter(o => o.paymentStatus === paymentStatus);
    }
    if (customerId && customerId !== 'all') {
      results = results.filter(o => o.customerId === customerId);
    }
    if (customer && customer !== 'all') {
      const cQuery = (customer as string).toLowerCase().trim();
      results = results.filter(o =>
        (o.customerName && o.customerName.toLowerCase().includes(cQuery)) ||
        (o.customerPhone && o.customerPhone.toLowerCase().includes(cQuery)) ||
        (o.customerId && o.customerId.toLowerCase() === cQuery)
      );
    }
    if (isJob === 'true' || status === 'jobs') {
      results = results.filter(o => o.status === 'draft' || o.isJob);
    }

    // Filter by Date Range if provided
    if (dateFrom) {
      const fromStr = (dateFrom as string).split('T')[0];
      const fromTimestamp = new Date(`${fromStr}T00:00:00.000Z`).getTime();
      if (!isNaN(fromTimestamp)) {
        results = results.filter(o => new Date(o.createdAt).getTime() >= fromTimestamp);
      }
    }
    if (dateTo) {
      const toStr = (dateTo as string).split('T')[0];
      const toTimestamp = new Date(`${toStr}T23:59:59.999Z`).getTime();
      if (!isNaN(toTimestamp)) {
        results = results.filter(o => new Date(o.createdAt).getTime() <= toTimestamp);
      }
    }

    // Search filter across orderNumber, customerName, customerPhone, items
    if (search) {
      const q = (search as string).toLowerCase();
      results = results.filter(o =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.customerPhone && o.customerPhone.includes(q)) ||
        (o.jobTitle && o.jobTitle.toLowerCase().includes(q)) ||
        o.items.some(i => i.name.toLowerCase().includes(q))
      );
    }

    if (limit === 'all') {
      return sendSuccess(res, results, {
        total: results.length,
        page: 1,
        limit: results.length,
        totalPages: 1,
      });
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit as string, 10) || 10);
    const offset = (pageNum - 1) * limitNum;
    const paginated = results.slice(offset, offset + limitNum);

    return sendSuccess(res, paginated, {
      total: results.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(results.length / limitNum),
    });
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

            // Dispatch Low Stock Reminder Email to shop owners
            const owners = await dbStore.collection<User>('users').query({
              where: [
                { field: 'shopId', op: '==', value: shopId },
                { field: 'role', op: '==', value: 'shop_owner' },
              ],
            });
            for (const owner of owners.data) {
              if (owner.email) {
                await EmailService.sendLowStockReminderEmail({
                  email: owner.email,
                  name: owner.name,
                  shopName: branchName || 'Print Shop',
                  productName: item.name,
                  sku: item.sku || 'N/A',
                  currentStock: newQty,
                  minimumStockLevel: inv.minimumStockLevel,
                  branchName,
                  shopId,
                  userId: owner.id,
                });
              }
            }
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

    // Customer resolution - default walkin does not create fake records
    let finalCustomerId = 'walkin';
    let finalCustomerName = 'Walk-in Customer';
    let finalCustomerPhone: string | undefined = undefined;

    if (customerId && customerId !== 'walkin') {
      const foundCustomer = await dbStore.collection<Customer>('customers').get(customerId);
      if (!foundCustomer || foundCustomer.shopId !== shopId) {
        return sendError(res, 'BAD_REQUEST', 'Invalid customer', 400);
      }
      finalCustomerId = foundCustomer.id;
      finalCustomerName = foundCustomer.name;
      finalCustomerPhone = foundCustomer.phone;
    } else {
      finalCustomerId = 'walkin';
      finalCustomerName = 'Walk-in Customer';
      finalCustomerPhone = undefined; // Do not store phone for default walk-in
    }

    // Permission check for Price Override
    const canOverride = req.user?.role === 'super_admin' ||
      req.user?.role === 'shop_owner' ||
      req.user?.role === 'manager' ||
      Boolean(req.user?.permissions && (
        req.user.permissions.includes('price_override') ||
        req.user.permissions.includes('orders_override_price')
      ));

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

        const expectedPrice = batchPrice !== undefined ? batchPrice : prod.sellingPrice;
        let unitPrice = expectedPrice;

        // Check if cashier attempted to override the price
        if (typeof it.unitPrice === 'number' && it.unitPrice >= 0) {
          if (Math.abs(it.unitPrice - expectedPrice) > 0.001) {
            if (!canOverride) {
              return sendError(
                res,
                'FORBIDDEN',
                `Price override requires manager or owner permission for item "${prod.name}".`,
                403
              );
            }
            unitPrice = it.unitPrice;
          } else {
            unitPrice = it.unitPrice;
          }
        }

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

        let unitPrice = serv.price;
        if (typeof it.unitPrice === 'number' && it.unitPrice >= 0) {
          if (Math.abs(it.unitPrice - serv.price) > 0.001) {
            if (!canOverride) {
              return sendError(
                res,
                'FORBIDDEN',
                `Price override requires manager or owner permission for service "${serv.name}".`,
                403
              );
            }
            unitPrice = it.unitPrice;
          } else {
            unitPrice = it.unitPrice;
          }
        }

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
      customerId: finalCustomerId,
      customerName: finalCustomerName,
      customerPhone: finalCustomerPhone,
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

      // Update customer lifetime stats for registered customers
      if (finalCustomerId !== 'walkin') {
        const cust = await dbStore.collection<Customer>('customers').get(finalCustomerId);
        if (cust) {
          await dbStore.collection<Customer>('customers').update(cust.id, {
            totalOrdersCount: (cust.totalOrdersCount || 0) + 1,
            totalSpent: (cust.totalSpent || 0) + totalAmount,
          });
        }
      }

      await NotificationService.notifyShop(shopId, {
        title: 'New Order Received',
        message: `Order #${orderNumber} (${totalAmount.toFixed(2)}) placed for ${finalCustomerName}.`,
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
    const existingOrder = await dbStore.collection<Order>('orders').get(id);
    if (!existingOrder || (req.user?.role !== 'super_admin' && existingOrder.shopId !== req.shopId)) {
      return sendError(res, 'NOT_FOUND', 'Order not found', 404);
    }
    const shopId = req.user?.role === 'super_admin' ? (req.query.shopId as string) || existingOrder.shopId : req.shopId || existingOrder.shopId;

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
      isJob,
      jobTitle = existingOrder.jobTitle,
    } = req.body;

    // Price override permission
    const canOverride = req.user?.role === 'super_admin' ||
      req.user?.role === 'shop_owner' ||
      req.user?.role === 'manager' ||
      Boolean(req.user?.permissions && (
        req.user.permissions.includes('price_override') ||
        req.user.permissions.includes('orders_override_price')
      ));

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

          const expectedPrice = batchPrice !== undefined ? batchPrice : prod.sellingPrice;
          let unitPrice = expectedPrice;

          if (typeof it.unitPrice === 'number' && it.unitPrice >= 0) {
            if (Math.abs(it.unitPrice - expectedPrice) > 0.001) {
              if (!canOverride) {
                return sendError(
                  res,
                  'FORBIDDEN',
                  `Price override requires manager or owner permission for item "${prod.name}".`,
                  403
                );
              }
              unitPrice = it.unitPrice;
            } else {
              unitPrice = it.unitPrice;
            }
          }

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

          let unitPrice = serv.price;
          if (typeof it.unitPrice === 'number' && it.unitPrice >= 0) {
            if (Math.abs(it.unitPrice - serv.price) > 0.001) {
              if (!canOverride) {
                return sendError(
                  res,
                  'FORBIDDEN',
                  `Price override requires manager or owner permission for service "${serv.name}".`,
                  403
                );
              }
              unitPrice = it.unitPrice;
            } else {
              unitPrice = it.unitPrice;
            }
          }

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
    const finalIsJob = status === 'draft' ? true : (typeof isJob === 'boolean' ? isJob : false);

    // Customer handling
    let finalCustId = customerId !== undefined ? customerId : existingOrder.customerId;
    let finalCustName = customerName !== undefined ? customerName : existingOrder.customerName;
    let finalCustPhone = customerPhone !== undefined ? customerPhone : existingOrder.customerPhone;

    if (finalCustId === 'walkin') {
      finalCustName = 'Walk-in Customer';
      finalCustPhone = undefined;
    }

    const updated = await dbStore.collection<Order>('orders').update(id, {
      ...(branchId && { branchId }),
      customerId: finalCustId,
      customerName: finalCustName,
      customerPhone: finalCustPhone,
      items: resolvedItems,
      subtotal,
      tax,
      discount,
      totalAmount,
      status,
      paymentStatus,
      paymentMethod,
      notes,
      isJob: finalIsJob,
      jobTitle,
      updatedAt: new Date().toISOString(),
    });

    if (!updated) {
      return sendError(res, 'SERVER_ERROR', 'Failed to update order', 500);
    }

    // If order was a draft/job and is now finalized to confirmed or completed, deduct inventory!
    if (existingOrder.status === 'draft' && (status === 'confirmed' || status === 'completed')) {
      await OrderController.deductOrderInventory(updated, req.user?.name || 'Staff');

      if (updated.customerId && updated.customerId !== 'walkin') {
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
      ...(status && { isJob: status === 'draft' }),
      updatedAt: new Date().toISOString(),
    });

    if (!updated) {
      return sendError(res, 'SERVER_ERROR', 'Failed to update order status', 500);
    }

    // If transitioning from draft to confirmed/completed, deduct inventory
    if (order.status === 'draft' && (status === 'confirmed' || status === 'completed')) {
      await OrderController.deductOrderInventory(updated, req.user?.name || 'Staff');

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
