import { z } from 'zod';

export interface PasswordStrengthResult {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  isValid: boolean;
  errors: string[];
}

export function checkPasswordStrength(password: string): PasswordStrengthResult {
  const pwd = password || '';
  const minLength = pwd.length >= 8;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(pwd);

  const errors: string[] = [];
  if (!minLength) errors.push('Password must be at least 8 characters long');
  if (!hasUpper) errors.push('Password must contain at least one uppercase letter (A-Z)');
  if (!hasLower) errors.push('Password must contain at least one lowercase letter (a-z)');
  if (!hasNumber) errors.push('Password must contain at least one number (0-9)');
  if (!hasSpecial) errors.push('Password must contain at least one special character (!@#$%^&* etc.)');

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
export function validateSriLankanPhone(phone: string): { isValid: boolean; normalized?: string; error?: string } {
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

export const sriLankanPhoneSchema = z.string().refine(val => validateSriLankanPhone(val).isValid, {
  message: 'Please enter a valid Sri Lankan mobile number (e.g. +94 77 123 4567 or 077 123 4567)',
});

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter (A-Z)')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter (a-z)')
  .regex(/[0-9]/, 'Password must contain at least one number (0-9)')
  .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/, 'Password must contain at least one special character (!@#$%^&* etc.)');

export const loginSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema,
});

export const verifyEmailSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  token: z.string().optional(),
  code: z.string().optional(),
}).refine(data => !!(data.token || (data.email && data.code)), {
  message: 'Either verification token or email with verification code must be provided',
});

export const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const checkEmailSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
});

export const reviewPaymentSchema = z.object({
  status: z.enum(['pending', 'processing', 'successful', 'failed', 'cancelled', 'refunded', 'approved']),
  notes: z.string().optional(),
});

export const restrictShopPaymentSchema = z.object({
  isRestricted: z.boolean(),
  reason: z.string().optional(),
});

export const registerShopOwnerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: passwordSchema,
  phone: sriLankanPhoneSchema,
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  businessAddress: z.string().min(3, 'Business address must be at least 3 characters'),
  businessCategory: z.string().min(2, 'Business category must be at least 2 characters'),
  packageId: z.string().optional(),
});

export const createShopSchema = z.object({
  name: z.string().min(2),
  ownerId: z.string().min(1),
  email: z.string().email('Invalid email format'),
  contactNumber: z.string().min(8),
  address: z.string().min(3),
  category: z.string().min(2),
  packageId: z.string().min(1),
  description: z.string().optional(),
  openingHours: z.string().optional(),
});

export const updateShopSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  openingHours: z.string().optional(),
  socialMedia: z.record(z.string()).optional(),
  logoUrl: z.string().optional(),
});

export const createBranchSchema = z.object({
  name: z.string().min(2),
  address: z.string().min(3),
  phone: z.string().min(8),
  code: z.string().optional(),
});

export const updateBranchSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().min(3).optional(),
  phone: z.string().min(8).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const createStaffUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email('Invalid email format'),
  password: passwordSchema,
  phone: z.string().optional(),
  role: z.enum(['manager', 'sales_staff', 'inventory_staff', 'purchasing_staff', 'worker']),
  branchIds: z.array(z.string()).optional(),
  branchId: z.string().optional(),
});

export const createPackageSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(5),
  price: z.number().min(0),
  durationDays: z.number().int().min(1).default(30),
  limits: z.object({
    shops: z.number().int().min(1),
    branches: z.number().int().min(1),
    users: z.number().int().min(1),
    products: z.number().int().min(1),
    services: z.number().int().min(1),
    storageMb: z.number().int().min(50),
  }),
  features: z.array(z.string()),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const createPaymentRequestSchema = z.object({
  packageId: z.string().min(1),
  amount: z.number().min(0),
  method: z.enum(['card', 'bank_transfer']),
  bankSlipUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const createChangeRequestSchema = z.object({
  field: z.string().min(1),
  currentValue: z.any(),
  requestedValue: z.any(),
  reason: z.string().min(5),
});

export const reviewChangeRequestSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewNotes: z.string().optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters'),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(2, 'Product name must be at least 2 characters'),
  description: z.string().optional(),
  category: z.string().min(2, 'Category is required'),
  costPrice: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  minimumStockLevel: z.number().int().min(0).default(5),
  initialStock: z.number().int().min(0).default(0),
  isPublic: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  variants: z.array(z.object({
    name: z.string(),
    options: z.array(z.string()),
    priceModifier: z.number().optional(),
    sku: z.string().optional(),
    stock: z.number().optional(),
  })).optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  status: z.enum(['active', 'inactive']).optional(),
});

export const createProductBatchSchema = z.object({
  batchNumber: z.string().min(1),
  branchId: z.string().optional(),
  branchName: z.string().optional(),
  costPrice: z.number().min(0),
  sellingPrice: z.number().min(0),
  quantity: z.number().int().min(0),
  manufacturingDate: z.string().optional(),
  expiryDate: z.string().optional(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  status: z.enum(['active', 'depleted', 'expired', 'quarantine']).default('active'),
  notes: z.string().optional(),
});

export const updateProductBatchSchema = createProductBatchSchema.partial();

export const createServiceCategorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters'),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const updateServiceCategorySchema = createServiceCategorySchema.partial();

export const createServiceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().min(2),
  price: z.number().min(0),
  availability: z.string().optional(),
  assignedStaffIds: z.array(z.string()).optional(),
  assignedStaffNames: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const updateServiceSchema = createServiceSchema.partial();

export const createCustomerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(3),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const createOrderSchema = z.object({
  branchId: z.string().min(1),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().optional(),
  customerAddress: z.string().optional(),
  items: z.array(
    z.object({
      type: z.enum(['product', 'service']),
      itemId: z.string().min(1),
      name: z.string().optional(),
      sku: z.string().optional(),
      quantity: z.number().int().min(1),
      unitPrice: z.number().min(0).optional(),
      batchId: z.string().optional(),
      batchNumber: z.string().optional(),
      variant: z.string().optional(),
      assignedStaffId: z.string().optional(),
      assignedStaffName: z.string().optional(),
    })
  ).min(1),
  tax: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  status: z.enum(['draft', 'pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled']).optional(),
  paymentStatus: z.enum(['unpaid', 'partial', 'paid', 'refunded']).default('paid'),
  paymentMethod: z.string().default('cash'),
  notes: z.string().optional(),
  isJob: z.boolean().optional(),
  jobTitle: z.string().optional(),
});

export const updateOrderSchema = createOrderSchema.partial();

export const updateOrderStatusSchema = z.object({
  status: z.enum(['draft', 'pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled']).optional(),
  paymentStatus: z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional(),
  notes: z.string().optional(),
});

export const stockAdjustmentSchema = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
  quantityDelta: z.number().int(),
  reason: z.string().min(3),
  type: z.enum(['adjustment', 'damaged', 'returned', 'opening']),
});

export const stockTransferSchema = z.object({
  sourceBranchId: z.string().min(1),
  destinationBranchId: z.string().min(1),
  productId: z.string().min(1),
  batchId: z.string().optional(),
  quantity: z.number().int().min(1),
  reason: z.string().min(2),
  notes: z.string().optional(),
});

export const createTransferRequestSchema = z.object({
  sourceBranchId: z.string().min(1),
  destinationBranchId: z.string().min(1),
  productId: z.string().optional(),
  batchId: z.string().optional(),
  quantity: z.number().int().min(1).optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      productName: z.string().optional(),
      sku: z.string().optional(),
      batchId: z.string().optional(),
      batchNumber: z.string().optional(),
      quantity: z.number().int().min(1),
    })
  ).optional(),
  reason: z.string().min(2),
  notes: z.string().optional(),
});

export const receiveTransferSchema = z.object({
  receivedQuantity: z.number().int().min(0).optional(),
  receivedItems: z.array(
    z.object({
      productId: z.string().min(1),
      batchId: z.string().optional(),
      quantity: z.number().int().min(0),
    })
  ).optional(),
  notes: z.string().optional(),
});

export const updateTransferStatusSchema = z.object({
  action: z.enum(['approve', 'reject', 'dispatch', 'receive', 'cancel']),
  rejectionReason: z.string().optional(),
  receivedQuantity: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export const createSupplierSchema = z.object({
  name: z.string().min(2),
  contactPerson: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  address: z.string().optional(),
  taxId: z.string().optional(),
  paymentTerms: z.string().optional(),
  productsSupplied: z.array(z.string()).optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  status: z.enum(['active', 'inactive']).optional(),
});

export const createPOSchema = z.object({
  branchId: z.string().min(1),
  supplierId: z.string().min(1),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      orderedQty: z.number().int().min(1),
      unitCost: z.number().min(0),
    })
  ).min(1),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
});

export const updatePOSchema = z.object({
  status: z.enum(['draft', 'submitted', 'approved', 'ordered', 'partially_received', 'fully_received', 'cancelled']).optional(),
  notes: z.string().optional(),
  expectedDate: z.string().optional(),
});

export const createGRNSchema = z.object({
  purchaseOrderId: z.string().min(1),
  receivedItems: z.array(
    z.object({
      productId: z.string().min(1),
      receivedQty: z.number().int().min(0),
      damagedQty: z.number().int().min(0).default(0),
      unitCost: z.number().min(0),
    })
  ).min(1),
  notes: z.string().optional(),
  documentUrl: z.string().optional(),
});

export const createTaskSchema = z.object({
  branchId: z.string().optional(),
  title: z.string().min(1, 'Task title is required'),
  description: z.string().min(1, 'Description is required'),
  assigneeId: z.string().min(1, 'Assignee is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'pending_review', 'completed', 'cancelled']),
  comment: z.string().optional(),
});

export const addTaskCommentSchema = z.object({
  comment: z.string().min(1),
});

export const createTicketSchema = z.object({
  subject: z.string().min(3),
  category: z.enum(['billing', 'account', 'technical', 'general']),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  message: z.string().min(5),
});

export const replyTicketSchema = z.object({
  message: z.string().min(1),
});
