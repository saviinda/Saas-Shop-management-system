import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
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
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().min(8),
  businessName: z.string().min(2),
  businessAddress: z.string().min(3),
  businessCategory: z.string().min(2),
  packageId: z.string().min(1),
});

export const createShopSchema = z.object({
  name: z.string().min(2),
  ownerId: z.string().min(1),
  email: z.string().email(),
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
  email: z.string().email(),
  password: z.string().min(6),
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

export const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().min(2),
  imageUrl: z.string().optional(),
  costPrice: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  minimumStockLevel: z.number().int().min(0).default(5),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  initialStock: z.number().int().min(0).default(0),
  isPublic: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
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

export const createServiceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().min(2),
  imageUrl: z.string().optional(),
  price: z.number().min(0),
  durationMinutes: z.number().int().min(5),
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
  address: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
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
  quantity: z.number().int().min(1),
  reason: z.string().min(3),
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
  branchId: z.string().min(1),
  title: z.string().min(2),
  description: z.string().min(5),
  assigneeId: z.string().min(1),
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
