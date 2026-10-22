"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTicketSchema = exports.addTaskCommentSchema = exports.updateTaskStatusSchema = exports.createTaskSchema = exports.createGRNSchema = exports.updatePOSchema = exports.createPOSchema = exports.updateSupplierSchema = exports.createSupplierSchema = exports.updateTransferStatusSchema = exports.receiveTransferSchema = exports.createTransferRequestSchema = exports.stockTransferSchema = exports.stockAdjustmentSchema = exports.updateOrderStatusSchema = exports.updateOrderSchema = exports.createOrderSchema = exports.updateCustomerSchema = exports.createCustomerSchema = exports.updateServiceSchema = exports.createServiceSchema = exports.updateServiceCategorySchema = exports.createServiceCategorySchema = exports.updateProductBatchSchema = exports.createProductBatchSchema = exports.updateProductSchema = exports.createProductSchema = exports.updateCategorySchema = exports.createCategorySchema = exports.reviewChangeRequestSchema = exports.createChangeRequestSchema = exports.createPaymentRequestSchema = exports.createPackageSchema = exports.createStaffUserSchema = exports.updateBranchSchema = exports.createBranchSchema = exports.updateShopSchema = exports.createShopSchema = exports.registerShopOwnerSchema = exports.restrictShopPaymentSchema = exports.reviewPaymentSchema = exports.checkEmailSchema = exports.resendVerificationSchema = exports.verifyEmailSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.changePasswordSchema = exports.loginSchema = exports.passwordSchema = exports.sriLankanPhoneSchema = void 0;
exports.replyTicketSchema = void 0;
exports.checkPasswordStrength = checkPasswordStrength;
exports.validateSriLankanPhone = validateSriLankanPhone;
const zod_1 = require("zod");
function checkPasswordStrength(password) {
    const pwd = password || '';
    const minLength = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(pwd);
    const errors = [];
    if (!minLength)
        errors.push('Password must be at least 8 characters long');
    if (!hasUpper)
        errors.push('Password must contain at least one uppercase letter (A-Z)');
    if (!hasLower)
        errors.push('Password must contain at least one lowercase letter (a-z)');
    if (!hasNumber)
        errors.push('Password must contain at least one number (0-9)');
    if (!hasSpecial)
        errors.push('Password must contain at least one special character (!@#$%^&* etc.)');
    return {
        minLength,
        hasUpper,
        hasLower,
        hasNumber,
        hasSpecial,
        isValid: minLength && hasUpper && hasLower && hasNumber && hasSpecial,
        errors,
    };
}
/**
 * Validates Sri Lankan mobile & landline phone numbers.
 * Supported formats:
 * - +94 7X XXX XXXX (or +947XXXXXXXX)
 * - 07X XXX XXXX (or 07XXXXXXXX)
 * - 7X XXX XXXX (or 7XXXXXXXX)
 * - Landlines: +94 11 XXX XXXX, 011 XXX XXXX, etc.
 */
function validateSriLankanPhone(phone) {
    if (!phone || typeof phone !== 'string') {
        return { isValid: false, error: 'Mobile number is required' };
    }
    // Remove spaces, hyphens, brackets, dots
    const clean = phone.replace(/[\s\-\(\)\.]/g, '');
    // Sri Lankan phone regex
    // Matches +94, 0094, 0 or without prefix, followed by 9 digits
    const slPhoneRegex = /^(?:(?:\+94|0094)|0)?([1-9][0-9]{8})$/;
    const match = clean.match(slPhoneRegex);
    if (!match) {
        return {
            isValid: false,
            error: 'Please enter a valid Sri Lankan mobile number (e.g. +94 77 123 4567 or 077 123 4567)',
        };
    }
    const nationalNumber = match[1]; // 9 digits, e.g. 771234567
    const operatorOrArea = nationalNumber.substring(0, 2);
    // Check valid mobile prefixes (70, 71, 72, 74, 75, 76, 77, 78) and landline area codes
    const validMobilePrefixes = ['70', '71', '72', '74', '75', '76', '77', '78'];
    const validLandlinePrefixes = [
        '11', '21', '23', '24', '25', '26', '27',
        '31', '32', '33', '34', '35', '36', '37', '38',
        '41', '45', '47', '51', '52', '54', '55', '57',
        '63', '65', '66', '67', '81', '91',
    ];
    if (!validMobilePrefixes.includes(operatorOrArea) && !validLandlinePrefixes.includes(operatorOrArea)) {
        return {
            isValid: false,
            error: 'Please enter a valid Sri Lankan mobile operator prefix (e.g. 070, 071, 072, 074, 075, 076, 077, 078)',
        };
    }
    // Format nicely: +94 XX XXX XXXX
    const formatted = `+94 ${nationalNumber.substring(0, 2)} ${nationalNumber.substring(2, 5)} ${nationalNumber.substring(5)}`;
    return {
        isValid: true,
        normalized: formatted,
    };
}
exports.sriLankanPhoneSchema = zod_1.z.string().refine(val => validateSriLankanPhone(val).isValid, {
    message: 'Please enter a valid Sri Lankan mobile number (e.g. +94 77 123 4567 or 077 123 4567)',
});
exports.passwordSchema = zod_1.z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter (A-Z)')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter (a-z)')
    .regex(/[0-9]/, 'Password must contain at least one number (0-9)')
    .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/, 'Password must contain at least one special character (!@#$%^&* etc.)');
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Please provide a valid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.changePasswordSchema = zod_1.z.object({
    oldPassword: zod_1.z.string().min(1, 'Old password is required'),
    newPassword: exports.passwordSchema,
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Please provide a valid email address'),
});
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Reset token is required'),
    newPassword: exports.passwordSchema,
});
exports.verifyEmailSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format').optional(),
    token: zod_1.z.string().optional(),
    code: zod_1.z.string().optional(),
}).refine(data => !!(data.token || (data.email && data.code)), {
    message: 'Either verification token or email with verification code must be provided',
});
exports.resendVerificationSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
});
exports.checkEmailSchema = zod_1.z.object({
    email: zod_1.z.string().email('Please provide a valid email address'),
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
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    email: zod_1.z.string().email('Please enter a valid email address'),
    password: exports.passwordSchema,
    phone: exports.sriLankanPhoneSchema,
    businessName: zod_1.z.string().min(2, 'Business name must be at least 2 characters'),
    businessAddress: zod_1.z.string().min(3, 'Business address must be at least 3 characters'),
    businessCategory: zod_1.z.string().min(2, 'Business category must be at least 2 characters'),
    packageId: zod_1.z.string().optional(),
});
exports.createShopSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    ownerId: zod_1.z.string().min(1),
    email: zod_1.z.string().email('Invalid email format'),
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
    email: zod_1.z.string().email('Invalid email format'),
    password: exports.passwordSchema,
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
exports.createCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Category name must be at least 2 characters'),
    description: zod_1.z.string().optional(),
    status: zod_1.z.enum(['active', 'inactive']).default('active'),
});
exports.updateCategorySchema = exports.createCategorySchema.partial();
exports.createProductSchema = zod_1.z.object({
    sku: zod_1.z.string().min(1, 'SKU is required'),
    name: zod_1.z.string().min(2, 'Product name must be at least 2 characters'),
    description: zod_1.z.string().optional(),
    category: zod_1.z.string().min(2, 'Category is required'),
    costPrice: zod_1.z.number().min(0).default(0),
    sellingPrice: zod_1.z.number().min(0).default(0),
    minimumStockLevel: zod_1.z.number().int().min(0).default(5),
    initialStock: zod_1.z.number().int().min(0).default(0),
    isPublic: zod_1.z.boolean().optional(),
    isFeatured: zod_1.z.boolean().optional(),
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
exports.createProductBatchSchema = zod_1.z.object({
    batchNumber: zod_1.z.string().min(1),
    branchId: zod_1.z.string().optional(),
    branchName: zod_1.z.string().optional(),
    costPrice: zod_1.z.number().min(0),
    sellingPrice: zod_1.z.number().min(0),
    quantity: zod_1.z.number().int().min(0),
    manufacturingDate: zod_1.z.string().optional(),
    expiryDate: zod_1.z.string().optional(),
    supplierId: zod_1.z.string().optional(),
    supplierName: zod_1.z.string().optional(),
    status: zod_1.z.enum(['active', 'depleted', 'expired', 'quarantine']).default('active'),
    notes: zod_1.z.string().optional(),
});
exports.updateProductBatchSchema = exports.createProductBatchSchema.partial();
exports.createServiceCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Category name must be at least 2 characters'),
    description: zod_1.z.string().optional(),
    status: zod_1.z.enum(['active', 'inactive']).default('active'),
});
exports.updateServiceCategorySchema = exports.createServiceCategorySchema.partial();
exports.createServiceSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    description: zod_1.z.string().optional(),
    category: zod_1.z.string().min(2),
    price: zod_1.z.number().min(0),
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
        batchId: zod_1.z.string().optional(),
        batchNumber: zod_1.z.string().optional(),
        variant: zod_1.z.string().optional(),
        assignedStaffId: zod_1.z.string().optional(),
        assignedStaffName: zod_1.z.string().optional(),
    })).min(1),
    tax: zod_1.z.number().min(0).default(0),
    discount: zod_1.z.number().min(0).default(0),
    status: zod_1.z.enum(['draft', 'pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled']).optional(),
    paymentStatus: zod_1.z.enum(['unpaid', 'partial', 'paid', 'refunded']).default('paid'),
    paymentMethod: zod_1.z.string().default('cash'),
    notes: zod_1.z.string().optional(),
    isJob: zod_1.z.boolean().optional(),
    jobTitle: zod_1.z.string().optional(),
});
exports.updateOrderSchema = exports.createOrderSchema.partial();
exports.updateOrderStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['draft', 'pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled']).optional(),
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
    batchId: zod_1.z.string().optional(),
    quantity: zod_1.z.number().int().min(1),
    reason: zod_1.z.string().min(2),
    notes: zod_1.z.string().optional(),
});
exports.createTransferRequestSchema = zod_1.z.object({
    sourceBranchId: zod_1.z.string().min(1),
    destinationBranchId: zod_1.z.string().min(1),
    productId: zod_1.z.string().optional(),
    batchId: zod_1.z.string().optional(),
    quantity: zod_1.z.number().int().min(1).optional(),
    items: zod_1.z.array(zod_1.z.object({
        productId: zod_1.z.string().min(1),
        productName: zod_1.z.string().optional(),
        sku: zod_1.z.string().optional(),
        batchId: zod_1.z.string().optional(),
        batchNumber: zod_1.z.string().optional(),
        quantity: zod_1.z.number().int().min(1),
    })).optional(),
    reason: zod_1.z.string().min(2),
    notes: zod_1.z.string().optional(),
});
exports.receiveTransferSchema = zod_1.z.object({
    receivedQuantity: zod_1.z.number().int().min(0).optional(),
    receivedItems: zod_1.z.array(zod_1.z.object({
        productId: zod_1.z.string().min(1),
        batchId: zod_1.z.string().optional(),
        quantity: zod_1.z.number().int().min(0),
    })).optional(),
    notes: zod_1.z.string().optional(),
});
exports.updateTransferStatusSchema = zod_1.z.object({
    action: zod_1.z.enum(['approve', 'reject', 'dispatch', 'receive', 'cancel']),
    rejectionReason: zod_1.z.string().optional(),
    receivedQuantity: zod_1.z.number().int().min(0).optional(),
    notes: zod_1.z.string().optional(),
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
    branchId: zod_1.z.string().optional(),
    title: zod_1.z.string().min(1, 'Task title is required'),
    description: zod_1.z.string().min(1, 'Description is required'),
    assigneeId: zod_1.z.string().min(1, 'Assignee is required'),
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
