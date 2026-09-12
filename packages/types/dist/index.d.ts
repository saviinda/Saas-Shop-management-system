export type UserRole = 'super_admin' | 'shop_owner' | 'manager' | 'sales_staff' | 'inventory_staff' | 'purchasing_staff' | 'worker';
export type UserStatus = 'active' | 'inactive' | 'suspended';
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';
export interface RolePermission {
    module: string;
    actions: PermissionAction[];
}
export interface Role {
    id: string;
    name: string;
    slug?: string;
    description?: string;
    isSystem?: boolean;
    permissions: RolePermission[];
    createdAt: string;
    updatedAt: string;
}
export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    roles?: string[];
    status: UserStatus;
    shopId?: string;
    branchIds?: string[];
    permissions?: string[];
    phone?: string;
    passwordResetToken?: string;
    passwordResetExpires?: string;
    createdAt: string;
    updatedAt: string;
}
export type ShopStatus = 'pending' | 'active' | 'inactive' | 'suspended' | 'restricted' | 'expired';
export interface Shop {
    id: string;
    name: string;
    ownerId: string;
    ownerName?: string;
    ownerEmail?: string;
    description?: string;
    logoUrl?: string;
    contactNumber: string;
    email: string;
    address: string;
    category: string;
    openingHours?: string;
    socialMedia?: Record<string, string>;
    status: ShopStatus;
    packageId: string;
    packageName?: string;
    subscriptionId?: string;
    defaultBranchId?: string;
    isPaymentRestricted?: boolean;
    paymentRestrictionReason?: string;
    createdAt: string;
    updatedAt: string;
}
export interface Branch {
    id: string;
    shopId: string;
    name: string;
    code?: string;
    address: string;
    phone: string;
    isDefault: boolean;
    status: 'active' | 'inactive';
    createdAt: string;
    updatedAt: string;
}
export interface PackageLimits {
    shops: number;
    branches: number;
    users: number;
    products: number;
    services: number;
    storageMb: number;
}
export interface SubscriptionPackage {
    id: string;
    name: string;
    description: string;
    price: number;
    durationDays: number;
    limits: PackageLimits;
    features: string[];
    status: 'active' | 'inactive';
    createdAt: string;
    updatedAt: string;
}
export type SubscriptionStatus = 'active' | 'expired' | 'pending' | 'cancelled';
export interface Subscription {
    id: string;
    shopId: string;
    packageId: string;
    packageName?: string;
    limits: PackageLimits;
    price: number;
    startAt: string;
    expiryAt: string;
    renewalDate?: string;
    status: SubscriptionStatus;
    autoRenew: boolean;
    createdAt: string;
    updatedAt: string;
}
export type PaymentMethod = 'card' | 'bank_transfer';
export type PaymentStatus = 'pending' | 'processing' | 'successful' | 'failed' | 'cancelled' | 'refunded';
export interface PaymentTransaction {
    id: string;
    shopId: string;
    shopName?: string;
    subscriptionId?: string;
    packageId?: string;
    packageName?: string;
    amount: number;
    currency: string;
    method: PaymentMethod;
    status: PaymentStatus;
    bankSlipUrl?: string;
    gatewayRef?: string;
    cardLast4?: string;
    cardBrand?: string;
    notes?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    createdAt: string;
    updatedAt: string;
}
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected';
export interface ChangeRequest {
    id: string;
    shopId: string;
    shopName?: string;
    requesterId: string;
    requesterName?: string;
    field: string;
    currentValue: any;
    requestedValue: any;
    reason: string;
    status: ChangeRequestStatus;
    reviewedBy?: string;
    reviewNotes?: string;
    reviewedAt?: string;
    createdAt: string;
    updatedAt: string;
}
export type ProductBatchStatus = 'active' | 'depleted' | 'expired' | 'quarantine';
export interface ProductBatch {
    id: string;
    shopId: string;
    productId: string;
    branchId?: string;
    branchName?: string;
    batchNumber: string;
    costPrice: number;
    sellingPrice: number;
    quantity: number;
    initialQuantity: number;
    manufacturingDate?: string;
    expiryDate?: string;
    supplierId?: string;
    supplierName?: string;
    status: ProductBatchStatus;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}
export interface Product {
    id: string;
    shopId: string;
    sku: string;
    name: string;
    description?: string;
    category: string;
    imageUrl?: string;
    costPrice: number;
    sellingPrice: number;
    stockQuantity?: number;
    minimumStockLevel: number;
    status: 'active' | 'inactive';
    supplierId?: string;
    supplierName?: string;
    isPublic?: boolean;
    isFeatured?: boolean;
    tags?: string[];
    variants?: Array<{
        name: string;
        options: string[];
        priceModifier?: number;
        sku?: string;
        stock?: number;
    }>;
    batches?: ProductBatch[];
    batchesCount?: number;
    createdAt: string;
    updatedAt: string;
}
export interface ServiceItem {
    id: string;
    shopId: string;
    name: string;
    description?: string;
    category: string;
    imageUrl?: string;
    price: number;
    durationMinutes: number;
    availability?: string;
    assignedStaffIds?: string[];
    assignedStaffNames?: string[];
    isPublic?: boolean;
    isFeatured?: boolean;
    status: 'active' | 'inactive';
    createdAt: string;
    updatedAt: string;
}
export interface Customer {
    id: string;
    shopId: string;
    name: string;
    email?: string;
    phone: string;
    address?: string;
    notes?: string;
    tags?: string[];
    loyaltyPoints?: number;
    lastVisitDate?: string;
    totalOrdersCount: number;
    totalSpent: number;
    createdAt: string;
    updatedAt: string;
}
export type OrderStatus = 'draft' | 'pending' | 'confirmed' | 'processing' | 'ready' | 'completed' | 'cancelled';
export type OrderPaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';
export interface OrderItem {
    type: 'product' | 'service';
    itemId: string;
    name: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    batchId?: string;
    batchNumber?: string;
    variant?: string;
    assignedStaffId?: string;
    assignedStaffName?: string;
}
export interface Order {
    id: string;
    orderNumber: string;
    shopId: string;
    branchId: string;
    branchName?: string;
    customerId: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    customerAddress?: string;
    items: OrderItem[];
    subtotal: number;
    tax: number;
    discount: number;
    totalAmount: number;
    status: OrderStatus;
    paymentStatus: OrderPaymentStatus;
    paymentMethod?: string;
    notes?: string;
    isJob?: boolean;
    jobTitle?: string;
    statusHistory?: Array<{
        status: OrderStatus;
        timestamp: string;
        note?: string;
        updatedBy?: string;
    }>;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
export interface InventoryItem {
    id: string;
    shopId: string;
    branchId: string;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    minimumStockLevel: number;
    costPrice: number;
    sellingPrice: number;
    updatedAt: string;
}
export type StockMovementType = 'opening' | 'po_receive' | 'adjustment' | 'sale' | 'damaged' | 'returned' | 'transfer';
export interface StockMovement {
    id: string;
    shopId: string;
    branchId: string;
    productId: string;
    type: StockMovementType;
    quantityDelta: number;
    newQuantity: number;
    reason?: string;
    referenceId?: string;
    performedBy: string;
    createdAt: string;
}
export interface Supplier {
    id: string;
    shopId: string;
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
    address?: string;
    taxId?: string;
    paymentTerms?: string;
    productsSupplied?: string[];
    status: 'active' | 'inactive';
    createdAt: string;
    updatedAt: string;
}
export type POStatus = 'draft' | 'submitted' | 'approved' | 'ordered' | 'partially_received' | 'fully_received' | 'cancelled';
export interface PurchaseOrderItem {
    productId: string;
    productName: string;
    sku: string;
    orderedQty: number;
    receivedQty: number;
    unitCost: number;
    totalCost: number;
}
export interface PurchaseOrder {
    id: string;
    poNumber: string;
    shopId: string;
    branchId: string;
    supplierId: string;
    supplierName: string;
    items: PurchaseOrderItem[];
    totalAmount: number;
    expectedDate?: string;
    notes?: string;
    status: POStatus;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
export interface GRNItem {
    productId: string;
    productName: string;
    receivedQty: number;
    damagedQty: number;
    unitCost: number;
}
export interface GoodsReceivedNote {
    id: string;
    grnNumber: string;
    shopId: string;
    branchId: string;
    purchaseOrderId: string;
    supplierId: string;
    supplierName: string;
    receivedItems: GRNItem[];
    totalValue: number;
    notes?: string;
    documentUrl?: string;
    receivedBy: string;
    status: 'completed' | 'cancelled';
    createdAt: string;
}
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'pending_review' | 'completed' | 'cancelled';
export interface EmployeeTask {
    id: string;
    shopId: string;
    branchId: string;
    title: string;
    description: string;
    assigneeId: string;
    assigneeName?: string;
    createdById: string;
    createdByName?: string;
    priority: TaskPriority;
    status: TaskStatus;
    dueDate?: string;
    attachments?: string[];
    comments?: Array<{
        id: string;
        userId: string;
        userName: string;
        comment: string;
        createdAt: string;
    }>;
    createdAt: string;
    updatedAt: string;
}
export type TicketStatus = 'open' | 'in_progress' | 'waiting_for_user' | 'resolved' | 'closed';
export interface TicketMessage {
    id: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    message: string;
    attachments?: string[];
    createdAt: string;
}
export interface SupportTicket {
    id: string;
    ticketNumber: string;
    shopId: string;
    shopName: string;
    subject: string;
    category: 'billing' | 'account' | 'technical' | 'general';
    priority: 'low' | 'medium' | 'high';
    status: TicketStatus;
    messages: TicketMessage[];
    assignedAdminId?: string;
    createdAt: string;
    updatedAt: string;
}
export interface AppNotification {
    id: string;
    recipientId: string;
    shopId?: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'alert';
    link?: string;
    isRead: boolean;
    createdAt: string;
}
export interface AuditLog {
    id: string;
    actorId: string;
    actorName: string;
    actorRole: string;
    shopId?: string;
    action: string;
    entity: string;
    entityId: string;
    before?: any;
    after?: any;
    ipAddress?: string;
    createdAt: string;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    meta?: {
        total?: number;
        page?: number;
        limit?: number;
        [key: string]: any;
    };
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}
//# sourceMappingURL=index.d.ts.map