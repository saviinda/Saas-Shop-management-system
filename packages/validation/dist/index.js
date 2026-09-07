"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replyTicketSchema = exports.createTicketSchema = exports.addTaskCommentSchema = exports.updateTaskStatusSchema = exports.createTaskSchema = exports.createGRNSchema = exports.updatePOSchema = exports.createPOSchema = exports.updateSupplierSchema = exports.createSupplierSchema = exports.stockTransferSchema = exports.stockAdjustmentSchema = exports.updateOrderStatusSchema = exports.createOrderSchema = exports.updateCustomerSchema = exports.createCustomerSchema = exports.updateServiceSchema = exports.createServiceSchema = exports.updateProductSchema = exports.createProductSchema = exports.reviewChangeRequestSchema = exports.createChangeRequestSchema = exports.createPaymentRequestSchema = exports.createPackageSchema = exports.createStaffUserSchema = exports.updateBranchSchema = exports.createBranchSchema = exports.updateShopSchema = exports.createShopSchema = exports.registerShopOwnerSchema = exports.restrictShopPaymentSchema = exports.reviewPaymentSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.changePasswordSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
exports.changePasswordSchema = zod_1.z.object({
    oldPassword: zod_1.z.string().min(1, 'Old password is required'),
    newPassword: zod_1.z.string().min(6, 'New password must be at least 6 characters'),
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Please provide a valid email address'),
});
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Reset token is required'),
    newPassword: zod_1.z.string().min(6, 'New password must be at least 6 characters'),
});
exports.reviewPaymentSchema = zod_1.z.object({
    status: zod_1.z.enum(['pending', 'processing', 'successful', 'failed', 'cancelled', 'refunded', 'approved']),
    notes: zod_1.z.string().optional(),
});
exports.restrictShopPaymentSchema = zod_1.z.object({
    isRestricted: zod_1.z.boolean(),
    reason: zod_1.z.string().optional(),
});
exports.registerShopOwnerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    phone: zod_1.z.string().min(8),
    businessName: zod_1.z.string().min(2),
    businessAddress: zod_1.z.string().min(3),
    businessCategory: zod_1.z.string().min(2),
    packageId: zod_1.z.string().min(1),
});
exports.createShopSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    ownerId: zod_1.z.string().min(1),
    email: zod_1.z.string().email(),
    contactNumber: zod_1.z.string().min(8),
    address: zod_1.z.string().min(3),
    category: zod_1.z.string().min(2),
    packageId: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    openingHours: zod_1.z.string().optional(),
});
exports.updateShopSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    description: zod_1.z.string().optional(),
    openingHours: zod_1.z.string().optional(),
    socialMedia: zod_1.z.record(zod_1.z.string()).optional(),
    logoUrl: zod_1.z.string().optional(),
});
exports.createBranchSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    address: zod_1.z.string().min(3),
    phone: zod_1.z.string().min(8),
    code: zod_1.z.string().optional(),
});
exports.updateBranchSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    address: zod_1.z.string().min(3).optional(),
    phone: zod_1.z.string().min(8).optional(),
    status: zod_1.z.enum(['active', 'inactive']).optional(),
});
exports.createStaffUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    phone: zod_1.z.string().optional(),
    role: zod_1.z.enum(['manager', 'sales_staff', 'inventory_staff', 'purchasing_staff', 'worker']),
    branchIds: zod_1.z.array(zod_1.z.string()).optional(),
    branchId: zod_1.z.string().optional(),
});
exports.createPackageSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    description: zod_1.z.string().min(5),
    price: zod_1.z.number().min(0),
    durationDays: zod_1.z.number().int().min(1).default(30),
    limits: zod_1.z.object({
        shops: zod_1.z.number().int().min(1),
        branches: zod_1.z.number().int().min(1),
        users: zod_1.z.number().int().min(1),
        products: zod_1.z.number().int().min(1),
        services: zod_1.z.number().int().min(1),
        storageMb: zod_1.z.number().int().min(50),
    }),
    features: zod_1.z.array(zod_1.z.string()),
    status: zod_1.z.enum(['active', 'inactive']).default('active'),
});
exports.createPaymentRequestSchema = zod_1.z.object({
    packageId: zod_1.z.string().min(1),
    amount: zod_1.z.number().min(0),
    method: zod_1.z.enum(['card', 'bank_transfer']),
    bankSlipUrl: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
exports.createChangeRequestSchema = zod_1.z.object({
    field: zod_1.z.string().min(1),
    currentValue: zod_1.z.any(),
    requestedValue: zod_1.z.any(),
    reason: zod_1.z.string().min(5),
});
exports.reviewChangeRequestSchema = zod_1.z.object({
    status: zod_1.z.enum(['approved', 'rejected']),
    reviewNotes: zod_1.z.string().optional(),
});
exports.createProductSchema = zod_1.z.object({
    sku: zod_1.z.string().min(1),
    name: zod_1.z.string().min(2),
    description: zod_1.z.string().optional(),
    category: zod_1.z.string().min(2),
    imageUrl: zod_1.z.string().optional(),
    costPrice: zod_1.z.number().min(0),
    sellingPrice: zod_1.z.number().min(0),
    minimumStockLevel: zod_1.z.number().int().min(0).default(5),
    supplierId: zod_1.z.string().optional(),
    supplierName: zod_1.z.string().optional(),
    initialStock: zod_1.z.number().int().min(0).default(0),
    isPublic: zod_1.z.boolean().optional(),
    isFeatured: zod_1.z.boolean().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    variants: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        options: zod_1.z.array(zod_1.z.string()),
        priceModifier: zod_1.z.number().optional(),
        sku: zod_1.z.string().optional(),
        stock: zod_1.z.number().optional(),
    })).optional(),
});
exports.updateProductSchema = exports.createProductSchema.partial().extend({
    status: zod_1.z.enum(['active', 'inactive']).optional(),
});
exports.createServiceSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    description: zod_1.z.string().optional(),
    category: zod_1.z.string().min(2),
    imageUrl: zod_1.z.string().optional(),
    price: zod_1.z.number().min(0),
    durationMinutes: zod_1.z.number().int().min(5),
    availability: zod_1.z.string().optional(),
    assignedStaffIds: zod_1.z.array(zod_1.z.string()).optional(),
    assignedStaffNames: zod_1.z.array(zod_1.z.string()).optional(),
    isPublic: zod_1.z.boolean().optional(),
    isFeatured: zod_1.z.boolean().optional(),
    status: zod_1.z.enum(['active', 'inactive']).default('active'),
});
exports.updateServiceSchema = exports.createServiceSchema.partial();
exports.createCustomerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    phone: zod_1.z.string().min(3),
    address: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.updateCustomerSchema = exports.createCustomerSchema.partial();
exports.createOrderSchema = zod_1.z.object({
    branchId: zod_1.z.string().min(1),
    customerId: zod_1.z.string().optional(),
    customerName: zod_1.z.string().optional(),
    customerPhone: zod_1.z.string().optional(),
    customerEmail: zod_1.z.string().optional(),
    customerAddress: zod_1.z.string().optional(),
    items: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['product', 'service']),
        itemId: zod_1.z.string().min(1),
        name: zod_1.z.string().optional(),
        sku: zod_1.z.string().optional(),
        quantity: zod_1.z.number().int().min(1),
        unitPrice: zod_1.z.number().min(0).optional(),
        variant: zod_1.z.string().optional(),
        assignedStaffId: zod_1.z.string().optional(),
        assignedStaffName: zod_1.z.string().optional(),
    })).min(1),
    tax: zod_1.z.number().min(0).default(0),
    discount: zod_1.z.number().min(0).default(0),
    paymentStatus: zod_1.z.enum(['unpaid', 'partial', 'paid', 'refunded']).default('paid'),
    paymentMethod: zod_1.z.string().default('cash'),
    notes: zod_1.z.string().optional(),
});
exports.updateOrderStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled']),
    paymentStatus: zod_1.z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional(),
    notes: zod_1.z.string().optional(),
});
exports.stockAdjustmentSchema = zod_1.z.object({
    branchId: zod_1.z.string().min(1),
    productId: zod_1.z.string().min(1),
    quantityDelta: zod_1.z.number().int(),
    reason: zod_1.z.string().min(3),
    type: zod_1.z.enum(['adjustment', 'damaged', 'returned', 'opening']),
});
exports.stockTransferSchema = zod_1.z.object({
    sourceBranchId: zod_1.z.string().min(1),
    destinationBranchId: zod_1.z.string().min(1),
    productId: zod_1.z.string().min(1),
    quantity: zod_1.z.number().int().min(1),
    reason: zod_1.z.string().min(3),
});
exports.createSupplierSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    contactPerson: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().min(8),
    address: zod_1.z.string().optional(),
    taxId: zod_1.z.string().optional(),
    paymentTerms: zod_1.z.string().optional(),
    productsSupplied: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.updateSupplierSchema = exports.createSupplierSchema.partial().extend({
    status: zod_1.z.enum(['active', 'inactive']).optional(),
});
exports.createPOSchema = zod_1.z.object({
    branchId: zod_1.z.string().min(1),
    supplierId: zod_1.z.string().min(1),
    items: zod_1.z.array(zod_1.z.object({
        productId: zod_1.z.string().min(1),
        orderedQty: zod_1.z.number().int().min(1),
        unitCost: zod_1.z.number().min(0),
    })).min(1),
    expectedDate: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
exports.updatePOSchema = zod_1.z.object({
    status: zod_1.z.enum(['draft', 'submitted', 'approved', 'ordered', 'partially_received', 'fully_received', 'cancelled']).optional(),
    notes: zod_1.z.string().optional(),
    expectedDate: zod_1.z.string().optional(),
});
exports.createGRNSchema = zod_1.z.object({
    purchaseOrderId: zod_1.z.string().min(1),
    receivedItems: zod_1.z.array(zod_1.z.object({
        productId: zod_1.z.string().min(1),
        receivedQty: zod_1.z.number().int().min(0),
        damagedQty: zod_1.z.number().int().min(0).default(0),
        unitCost: zod_1.z.number().min(0),
    })).min(1),
    notes: zod_1.z.string().optional(),
    documentUrl: zod_1.z.string().optional(),
});
exports.createTaskSchema = zod_1.z.object({
    branchId: zod_1.z.string().min(1),
    title: zod_1.z.string().min(2),
    description: zod_1.z.string().min(5),
    assigneeId: zod_1.z.string().min(1),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    dueDate: zod_1.z.string().optional(),
    attachments: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.updateTaskStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['todo', 'in_progress', 'pending_review', 'completed', 'cancelled']),
    comment: zod_1.z.string().optional(),
});
exports.addTaskCommentSchema = zod_1.z.object({
    comment: zod_1.z.string().min(1),
});
exports.createTicketSchema = zod_1.z.object({
    subject: zod_1.z.string().min(3),
    category: zod_1.z.enum(['billing', 'account', 'technical', 'general']),
    priority: zod_1.z.enum(['low', 'medium', 'high']).default('medium'),
    message: zod_1.z.string().min(5),
});
exports.replyTicketSchema = zod_1.z.object({
    message: zod_1.z.string().min(1),
});
