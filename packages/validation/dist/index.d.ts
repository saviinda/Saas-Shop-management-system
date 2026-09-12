import { z } from 'zod';
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const changePasswordSchema: z.ZodObject<{
    oldPassword: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    oldPassword: string;
    newPassword: string;
}, {
    oldPassword: string;
    newPassword: string;
}>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const resetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    newPassword: string;
    token: string;
}, {
    newPassword: string;
    token: string;
}>;
export declare const reviewPaymentSchema: z.ZodObject<{
    status: z.ZodEnum<["pending", "processing", "successful", "failed", "cancelled", "refunded", "approved"]>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "processing" | "successful" | "failed" | "cancelled" | "refunded" | "approved";
    notes?: string | undefined;
}, {
    status: "pending" | "processing" | "successful" | "failed" | "cancelled" | "refunded" | "approved";
    notes?: string | undefined;
}>;
export declare const restrictShopPaymentSchema: z.ZodObject<{
    isRestricted: z.ZodBoolean;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    isRestricted: boolean;
    reason?: string | undefined;
}, {
    isRestricted: boolean;
    reason?: string | undefined;
}>;
export declare const registerShopOwnerSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    phone: z.ZodString;
    businessName: z.ZodString;
    businessAddress: z.ZodString;
    businessCategory: z.ZodString;
    packageId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    name: string;
    phone: string;
    businessName: string;
    businessAddress: string;
    businessCategory: string;
    packageId: string;
}, {
    email: string;
    password: string;
    name: string;
    phone: string;
    businessName: string;
    businessAddress: string;
    businessCategory: string;
    packageId: string;
}>;
export declare const createShopSchema: z.ZodObject<{
    name: z.ZodString;
    ownerId: z.ZodString;
    email: z.ZodString;
    contactNumber: z.ZodString;
    address: z.ZodString;
    category: z.ZodString;
    packageId: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    openingHours: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    name: string;
    packageId: string;
    ownerId: string;
    contactNumber: string;
    address: string;
    category: string;
    description?: string | undefined;
    openingHours?: string | undefined;
}, {
    email: string;
    name: string;
    packageId: string;
    ownerId: string;
    contactNumber: string;
    address: string;
    category: string;
    description?: string | undefined;
    openingHours?: string | undefined;
}>;
export declare const updateShopSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    openingHours: z.ZodOptional<z.ZodString>;
    socialMedia: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    logoUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    openingHours?: string | undefined;
    socialMedia?: Record<string, string> | undefined;
    logoUrl?: string | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    openingHours?: string | undefined;
    socialMedia?: Record<string, string> | undefined;
    logoUrl?: string | undefined;
}>;
export declare const createBranchSchema: z.ZodObject<{
    name: z.ZodString;
    address: z.ZodString;
    phone: z.ZodString;
    code: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    phone: string;
    address: string;
    code?: string | undefined;
}, {
    name: string;
    phone: string;
    address: string;
    code?: string | undefined;
}>;
export declare const updateBranchSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
}, {
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
}>;
export declare const createStaffUserSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    role: z.ZodEnum<["manager", "sales_staff", "inventory_staff", "purchasing_staff", "worker"]>;
    branchIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    branchId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    name: string;
    role: "manager" | "sales_staff" | "inventory_staff" | "purchasing_staff" | "worker";
    phone?: string | undefined;
    branchIds?: string[] | undefined;
    branchId?: string | undefined;
}, {
    email: string;
    password: string;
    name: string;
    role: "manager" | "sales_staff" | "inventory_staff" | "purchasing_staff" | "worker";
    phone?: string | undefined;
    branchIds?: string[] | undefined;
    branchId?: string | undefined;
}>;
export declare const createPackageSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    price: z.ZodNumber;
    durationDays: z.ZodDefault<z.ZodNumber>;
    limits: z.ZodObject<{
        shops: z.ZodNumber;
        branches: z.ZodNumber;
        users: z.ZodNumber;
        products: z.ZodNumber;
        services: z.ZodNumber;
        storageMb: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        shops: number;
        branches: number;
        users: number;
        products: number;
        services: number;
        storageMb: number;
    }, {
        shops: number;
        branches: number;
        users: number;
        products: number;
        services: number;
        storageMb: number;
    }>;
    features: z.ZodArray<z.ZodString, "many">;
    status: z.ZodDefault<z.ZodEnum<["active", "inactive"]>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "inactive";
    name: string;
    description: string;
    price: number;
    durationDays: number;
    limits: {
        shops: number;
        branches: number;
        users: number;
        products: number;
        services: number;
        storageMb: number;
    };
    features: string[];
}, {
    name: string;
    description: string;
    price: number;
    limits: {
        shops: number;
        branches: number;
        users: number;
        products: number;
        services: number;
        storageMb: number;
    };
    features: string[];
    status?: "active" | "inactive" | undefined;
    durationDays?: number | undefined;
}>;
export declare const createPaymentRequestSchema: z.ZodObject<{
    packageId: z.ZodString;
    amount: z.ZodNumber;
    method: z.ZodEnum<["card", "bank_transfer"]>;
    bankSlipUrl: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    packageId: string;
    amount: number;
    method: "card" | "bank_transfer";
    notes?: string | undefined;
    bankSlipUrl?: string | undefined;
}, {
    packageId: string;
    amount: number;
    method: "card" | "bank_transfer";
    notes?: string | undefined;
    bankSlipUrl?: string | undefined;
}>;
export declare const createChangeRequestSchema: z.ZodObject<{
    field: z.ZodString;
    currentValue: z.ZodAny;
    requestedValue: z.ZodAny;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    field: string;
    currentValue?: any;
    requestedValue?: any;
}, {
    reason: string;
    field: string;
    currentValue?: any;
    requestedValue?: any;
}>;
export declare const reviewChangeRequestSchema: z.ZodObject<{
    status: z.ZodEnum<["approved", "rejected"]>;
    reviewNotes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "approved" | "rejected";
    reviewNotes?: string | undefined;
}, {
    status: "approved" | "rejected";
    reviewNotes?: string | undefined;
}>;
export declare const createProductSchema: z.ZodObject<{
    sku: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodString;
    imageUrl: z.ZodOptional<z.ZodString>;
    costPrice: z.ZodDefault<z.ZodNumber>;
    sellingPrice: z.ZodDefault<z.ZodNumber>;
    minimumStockLevel: z.ZodDefault<z.ZodNumber>;
    supplierId: z.ZodOptional<z.ZodString>;
    supplierName: z.ZodOptional<z.ZodString>;
    initialStock: z.ZodDefault<z.ZodNumber>;
    isPublic: z.ZodOptional<z.ZodBoolean>;
    isFeatured: z.ZodOptional<z.ZodBoolean>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    variants: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        options: z.ZodArray<z.ZodString, "many">;
        priceModifier: z.ZodOptional<z.ZodNumber>;
        sku: z.ZodOptional<z.ZodString>;
        stock: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        options: string[];
        name: string;
        sku?: string | undefined;
        priceModifier?: number | undefined;
        stock?: number | undefined;
    }, {
        options: string[];
        name: string;
        sku?: string | undefined;
        priceModifier?: number | undefined;
        stock?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    category: string;
    sku: string;
    costPrice: number;
    sellingPrice: number;
    minimumStockLevel: number;
    initialStock: number;
    description?: string | undefined;
    imageUrl?: string | undefined;
    supplierId?: string | undefined;
    supplierName?: string | undefined;
    isPublic?: boolean | undefined;
    isFeatured?: boolean | undefined;
    tags?: string[] | undefined;
    variants?: {
        options: string[];
        name: string;
        sku?: string | undefined;
        priceModifier?: number | undefined;
        stock?: number | undefined;
    }[] | undefined;
}, {
    name: string;
    category: string;
    sku: string;
    description?: string | undefined;
    imageUrl?: string | undefined;
    costPrice?: number | undefined;
    sellingPrice?: number | undefined;
    minimumStockLevel?: number | undefined;
    supplierId?: string | undefined;
    supplierName?: string | undefined;
    initialStock?: number | undefined;
    isPublic?: boolean | undefined;
    isFeatured?: boolean | undefined;
    tags?: string[] | undefined;
    variants?: {
        options: string[];
        name: string;
        sku?: string | undefined;
        priceModifier?: number | undefined;
        stock?: number | undefined;
    }[] | undefined;
}>;
export declare const updateProductSchema: z.ZodObject<{
    sku: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    category: z.ZodOptional<z.ZodString>;
    imageUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    costPrice: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    sellingPrice: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    minimumStockLevel: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    supplierId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    supplierName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    initialStock: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    isPublic: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    isFeatured: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    tags: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    variants: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        options: z.ZodArray<z.ZodString, "many">;
        priceModifier: z.ZodOptional<z.ZodNumber>;
        sku: z.ZodOptional<z.ZodString>;
        stock: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        options: string[];
        name: string;
        sku?: string | undefined;
        priceModifier?: number | undefined;
        stock?: number | undefined;
    }, {
        options: string[];
        name: string;
        sku?: string | undefined;
        priceModifier?: number | undefined;
        stock?: number | undefined;
    }>, "many">>>;
} & {
    status: z.ZodOptional<z.ZodEnum<["active", "inactive"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    category?: string | undefined;
    description?: string | undefined;
    sku?: string | undefined;
    imageUrl?: string | undefined;
    costPrice?: number | undefined;
    sellingPrice?: number | undefined;
    minimumStockLevel?: number | undefined;
    supplierId?: string | undefined;
    supplierName?: string | undefined;
    initialStock?: number | undefined;
    isPublic?: boolean | undefined;
    isFeatured?: boolean | undefined;
    tags?: string[] | undefined;
    variants?: {
        options: string[];
        name: string;
        sku?: string | undefined;
        priceModifier?: number | undefined;
        stock?: number | undefined;
    }[] | undefined;
}, {
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    category?: string | undefined;
    description?: string | undefined;
    sku?: string | undefined;
    imageUrl?: string | undefined;
    costPrice?: number | undefined;
    sellingPrice?: number | undefined;
    minimumStockLevel?: number | undefined;
    supplierId?: string | undefined;
    supplierName?: string | undefined;
    initialStock?: number | undefined;
    isPublic?: boolean | undefined;
    isFeatured?: boolean | undefined;
    tags?: string[] | undefined;
    variants?: {
        options: string[];
        name: string;
        sku?: string | undefined;
        priceModifier?: number | undefined;
        stock?: number | undefined;
    }[] | undefined;
}>;
export declare const createProductBatchSchema: z.ZodObject<{
    batchNumber: z.ZodString;
    branchId: z.ZodOptional<z.ZodString>;
    branchName: z.ZodOptional<z.ZodString>;
    costPrice: z.ZodNumber;
    sellingPrice: z.ZodNumber;
    quantity: z.ZodNumber;
    manufacturingDate: z.ZodOptional<z.ZodString>;
    expiryDate: z.ZodOptional<z.ZodString>;
    supplierId: z.ZodOptional<z.ZodString>;
    supplierName: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["active", "depleted", "expired", "quarantine"]>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "depleted" | "expired" | "quarantine";
    costPrice: number;
    sellingPrice: number;
    batchNumber: string;
    quantity: number;
    notes?: string | undefined;
    branchId?: string | undefined;
    supplierId?: string | undefined;
    supplierName?: string | undefined;
    branchName?: string | undefined;
    manufacturingDate?: string | undefined;
    expiryDate?: string | undefined;
}, {
    costPrice: number;
    sellingPrice: number;
    batchNumber: string;
    quantity: number;
    status?: "active" | "depleted" | "expired" | "quarantine" | undefined;
    notes?: string | undefined;
    branchId?: string | undefined;
    supplierId?: string | undefined;
    supplierName?: string | undefined;
    branchName?: string | undefined;
    manufacturingDate?: string | undefined;
    expiryDate?: string | undefined;
}>;
export declare const updateProductBatchSchema: z.ZodObject<{
    batchNumber: z.ZodOptional<z.ZodString>;
    branchId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    branchName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    costPrice: z.ZodOptional<z.ZodNumber>;
    sellingPrice: z.ZodOptional<z.ZodNumber>;
    quantity: z.ZodOptional<z.ZodNumber>;
    manufacturingDate: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    expiryDate: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    supplierId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    supplierName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<["active", "depleted", "expired", "quarantine"]>>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "depleted" | "expired" | "quarantine" | undefined;
    notes?: string | undefined;
    branchId?: string | undefined;
    costPrice?: number | undefined;
    sellingPrice?: number | undefined;
    supplierId?: string | undefined;
    supplierName?: string | undefined;
    batchNumber?: string | undefined;
    branchName?: string | undefined;
    quantity?: number | undefined;
    manufacturingDate?: string | undefined;
    expiryDate?: string | undefined;
}, {
    status?: "active" | "depleted" | "expired" | "quarantine" | undefined;
    notes?: string | undefined;
    branchId?: string | undefined;
    costPrice?: number | undefined;
    sellingPrice?: number | undefined;
    supplierId?: string | undefined;
    supplierName?: string | undefined;
    batchNumber?: string | undefined;
    branchName?: string | undefined;
    quantity?: number | undefined;
    manufacturingDate?: string | undefined;
    expiryDate?: string | undefined;
}>;
export declare const createServiceSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodString;
    imageUrl: z.ZodOptional<z.ZodString>;
    price: z.ZodNumber;
    durationMinutes: z.ZodNumber;
    availability: z.ZodOptional<z.ZodString>;
    assignedStaffIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    assignedStaffNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    isPublic: z.ZodOptional<z.ZodBoolean>;
    isFeatured: z.ZodOptional<z.ZodBoolean>;
    status: z.ZodDefault<z.ZodEnum<["active", "inactive"]>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "inactive";
    name: string;
    category: string;
    price: number;
    durationMinutes: number;
    description?: string | undefined;
    imageUrl?: string | undefined;
    isPublic?: boolean | undefined;
    isFeatured?: boolean | undefined;
    availability?: string | undefined;
    assignedStaffIds?: string[] | undefined;
    assignedStaffNames?: string[] | undefined;
}, {
    name: string;
    category: string;
    price: number;
    durationMinutes: number;
    status?: "active" | "inactive" | undefined;
    description?: string | undefined;
    imageUrl?: string | undefined;
    isPublic?: boolean | undefined;
    isFeatured?: boolean | undefined;
    availability?: string | undefined;
    assignedStaffIds?: string[] | undefined;
    assignedStaffNames?: string[] | undefined;
}>;
export declare const updateServiceSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    category: z.ZodOptional<z.ZodString>;
    imageUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    price: z.ZodOptional<z.ZodNumber>;
    durationMinutes: z.ZodOptional<z.ZodNumber>;
    availability: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    assignedStaffIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    assignedStaffNames: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    isPublic: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    isFeatured: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<["active", "inactive"]>>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    category?: string | undefined;
    description?: string | undefined;
    price?: number | undefined;
    imageUrl?: string | undefined;
    isPublic?: boolean | undefined;
    isFeatured?: boolean | undefined;
    durationMinutes?: number | undefined;
    availability?: string | undefined;
    assignedStaffIds?: string[] | undefined;
    assignedStaffNames?: string[] | undefined;
}, {
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    category?: string | undefined;
    description?: string | undefined;
    price?: number | undefined;
    imageUrl?: string | undefined;
    isPublic?: boolean | undefined;
    isFeatured?: boolean | undefined;
    durationMinutes?: number | undefined;
    availability?: string | undefined;
    assignedStaffIds?: string[] | undefined;
    assignedStaffNames?: string[] | undefined;
}>;
export declare const createCustomerSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    phone: z.ZodString;
    address: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    phone: string;
    email?: string | undefined;
    notes?: string | undefined;
    address?: string | undefined;
    tags?: string[] | undefined;
}, {
    name: string;
    phone: string;
    email?: string | undefined;
    notes?: string | undefined;
    address?: string | undefined;
    tags?: string[] | undefined;
}>;
export declare const updateCustomerSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>>;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    tags: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    notes?: string | undefined;
    name?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    tags?: string[] | undefined;
}, {
    email?: string | undefined;
    notes?: string | undefined;
    name?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    tags?: string[] | undefined;
}>;
export declare const createOrderSchema: z.ZodObject<{
    branchId: z.ZodString;
    customerId: z.ZodOptional<z.ZodString>;
    customerName: z.ZodOptional<z.ZodString>;
    customerPhone: z.ZodOptional<z.ZodString>;
    customerEmail: z.ZodOptional<z.ZodString>;
    customerAddress: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["product", "service"]>;
        itemId: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        sku: z.ZodOptional<z.ZodString>;
        quantity: z.ZodNumber;
        unitPrice: z.ZodOptional<z.ZodNumber>;
        batchId: z.ZodOptional<z.ZodString>;
        batchNumber: z.ZodOptional<z.ZodString>;
        variant: z.ZodOptional<z.ZodString>;
        assignedStaffId: z.ZodOptional<z.ZodString>;
        assignedStaffName: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "product" | "service";
        quantity: number;
        itemId: string;
        name?: string | undefined;
        sku?: string | undefined;
        batchNumber?: string | undefined;
        unitPrice?: number | undefined;
        batchId?: string | undefined;
        variant?: string | undefined;
        assignedStaffId?: string | undefined;
        assignedStaffName?: string | undefined;
    }, {
        type: "product" | "service";
        quantity: number;
        itemId: string;
        name?: string | undefined;
        sku?: string | undefined;
        batchNumber?: string | undefined;
        unitPrice?: number | undefined;
        batchId?: string | undefined;
        variant?: string | undefined;
        assignedStaffId?: string | undefined;
        assignedStaffName?: string | undefined;
    }>, "many">;
    tax: z.ZodDefault<z.ZodNumber>;
    discount: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["draft", "pending", "confirmed", "processing", "ready", "completed", "cancelled"]>>;
    paymentStatus: z.ZodDefault<z.ZodEnum<["unpaid", "partial", "paid", "refunded"]>>;
    paymentMethod: z.ZodDefault<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    isJob: z.ZodOptional<z.ZodBoolean>;
    jobTitle: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    branchId: string;
    items: {
        type: "product" | "service";
        quantity: number;
        itemId: string;
        name?: string | undefined;
        sku?: string | undefined;
        batchNumber?: string | undefined;
        unitPrice?: number | undefined;
        batchId?: string | undefined;
        variant?: string | undefined;
        assignedStaffId?: string | undefined;
        assignedStaffName?: string | undefined;
    }[];
    tax: number;
    discount: number;
    paymentStatus: "refunded" | "unpaid" | "partial" | "paid";
    paymentMethod: string;
    status?: "pending" | "processing" | "cancelled" | "draft" | "confirmed" | "ready" | "completed" | undefined;
    notes?: string | undefined;
    customerId?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    customerAddress?: string | undefined;
    isJob?: boolean | undefined;
    jobTitle?: string | undefined;
}, {
    branchId: string;
    items: {
        type: "product" | "service";
        quantity: number;
        itemId: string;
        name?: string | undefined;
        sku?: string | undefined;
        batchNumber?: string | undefined;
        unitPrice?: number | undefined;
        batchId?: string | undefined;
        variant?: string | undefined;
        assignedStaffId?: string | undefined;
        assignedStaffName?: string | undefined;
    }[];
    status?: "pending" | "processing" | "cancelled" | "draft" | "confirmed" | "ready" | "completed" | undefined;
    notes?: string | undefined;
    customerId?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    customerAddress?: string | undefined;
    tax?: number | undefined;
    discount?: number | undefined;
    paymentStatus?: "refunded" | "unpaid" | "partial" | "paid" | undefined;
    paymentMethod?: string | undefined;
    isJob?: boolean | undefined;
    jobTitle?: string | undefined;
}>;
export declare const updateOrderSchema: z.ZodObject<{
    branchId: z.ZodOptional<z.ZodString>;
    customerId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    customerName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    customerPhone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    customerEmail: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    customerAddress: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["product", "service"]>;
        itemId: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        sku: z.ZodOptional<z.ZodString>;
        quantity: z.ZodNumber;
        unitPrice: z.ZodOptional<z.ZodNumber>;
        batchId: z.ZodOptional<z.ZodString>;
        batchNumber: z.ZodOptional<z.ZodString>;
        variant: z.ZodOptional<z.ZodString>;
        assignedStaffId: z.ZodOptional<z.ZodString>;
        assignedStaffName: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "product" | "service";
        quantity: number;
        itemId: string;
        name?: string | undefined;
        sku?: string | undefined;
        batchNumber?: string | undefined;
        unitPrice?: number | undefined;
        batchId?: string | undefined;
        variant?: string | undefined;
        assignedStaffId?: string | undefined;
        assignedStaffName?: string | undefined;
    }, {
        type: "product" | "service";
        quantity: number;
        itemId: string;
        name?: string | undefined;
        sku?: string | undefined;
        batchNumber?: string | undefined;
        unitPrice?: number | undefined;
        batchId?: string | undefined;
        variant?: string | undefined;
        assignedStaffId?: string | undefined;
        assignedStaffName?: string | undefined;
    }>, "many">>;
    tax: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    discount: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    status: z.ZodOptional<z.ZodOptional<z.ZodEnum<["draft", "pending", "confirmed", "processing", "ready", "completed", "cancelled"]>>>;
    paymentStatus: z.ZodOptional<z.ZodDefault<z.ZodEnum<["unpaid", "partial", "paid", "refunded"]>>>;
    paymentMethod: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    isJob: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    jobTitle: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status?: "pending" | "processing" | "cancelled" | "draft" | "confirmed" | "ready" | "completed" | undefined;
    notes?: string | undefined;
    branchId?: string | undefined;
    customerId?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    customerAddress?: string | undefined;
    items?: {
        type: "product" | "service";
        quantity: number;
        itemId: string;
        name?: string | undefined;
        sku?: string | undefined;
        batchNumber?: string | undefined;
        unitPrice?: number | undefined;
        batchId?: string | undefined;
        variant?: string | undefined;
        assignedStaffId?: string | undefined;
        assignedStaffName?: string | undefined;
    }[] | undefined;
    tax?: number | undefined;
    discount?: number | undefined;
    paymentStatus?: "refunded" | "unpaid" | "partial" | "paid" | undefined;
    paymentMethod?: string | undefined;
    isJob?: boolean | undefined;
    jobTitle?: string | undefined;
}, {
    status?: "pending" | "processing" | "cancelled" | "draft" | "confirmed" | "ready" | "completed" | undefined;
    notes?: string | undefined;
    branchId?: string | undefined;
    customerId?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    customerAddress?: string | undefined;
    items?: {
        type: "product" | "service";
        quantity: number;
        itemId: string;
        name?: string | undefined;
        sku?: string | undefined;
        batchNumber?: string | undefined;
        unitPrice?: number | undefined;
        batchId?: string | undefined;
        variant?: string | undefined;
        assignedStaffId?: string | undefined;
        assignedStaffName?: string | undefined;
    }[] | undefined;
    tax?: number | undefined;
    discount?: number | undefined;
    paymentStatus?: "refunded" | "unpaid" | "partial" | "paid" | undefined;
    paymentMethod?: string | undefined;
    isJob?: boolean | undefined;
    jobTitle?: string | undefined;
}>;
export declare const updateOrderStatusSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["draft", "pending", "confirmed", "processing", "ready", "completed", "cancelled"]>>;
    paymentStatus: z.ZodOptional<z.ZodEnum<["unpaid", "partial", "paid", "refunded"]>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: "pending" | "processing" | "cancelled" | "draft" | "confirmed" | "ready" | "completed" | undefined;
    notes?: string | undefined;
    paymentStatus?: "refunded" | "unpaid" | "partial" | "paid" | undefined;
}, {
    status?: "pending" | "processing" | "cancelled" | "draft" | "confirmed" | "ready" | "completed" | undefined;
    notes?: string | undefined;
    paymentStatus?: "refunded" | "unpaid" | "partial" | "paid" | undefined;
}>;
export declare const stockAdjustmentSchema: z.ZodObject<{
    branchId: z.ZodString;
    productId: z.ZodString;
    quantityDelta: z.ZodNumber;
    reason: z.ZodString;
    type: z.ZodEnum<["adjustment", "damaged", "returned", "opening"]>;
}, "strip", z.ZodTypeAny, {
    type: "adjustment" | "damaged" | "returned" | "opening";
    reason: string;
    branchId: string;
    productId: string;
    quantityDelta: number;
}, {
    type: "adjustment" | "damaged" | "returned" | "opening";
    reason: string;
    branchId: string;
    productId: string;
    quantityDelta: number;
}>;
export declare const stockTransferSchema: z.ZodObject<{
    sourceBranchId: z.ZodString;
    destinationBranchId: z.ZodString;
    productId: z.ZodString;
    quantity: z.ZodNumber;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    quantity: number;
    productId: string;
    sourceBranchId: string;
    destinationBranchId: string;
}, {
    reason: string;
    quantity: number;
    productId: string;
    sourceBranchId: string;
    destinationBranchId: string;
}>;
export declare const createSupplierSchema: z.ZodObject<{
    name: z.ZodString;
    contactPerson: z.ZodString;
    email: z.ZodString;
    phone: z.ZodString;
    address: z.ZodOptional<z.ZodString>;
    taxId: z.ZodOptional<z.ZodString>;
    paymentTerms: z.ZodOptional<z.ZodString>;
    productsSupplied: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    email: string;
    name: string;
    phone: string;
    contactPerson: string;
    address?: string | undefined;
    taxId?: string | undefined;
    paymentTerms?: string | undefined;
    productsSupplied?: string[] | undefined;
}, {
    email: string;
    name: string;
    phone: string;
    contactPerson: string;
    address?: string | undefined;
    taxId?: string | undefined;
    paymentTerms?: string | undefined;
    productsSupplied?: string[] | undefined;
}>;
export declare const updateSupplierSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    contactPerson: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    taxId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    paymentTerms: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    productsSupplied: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
} & {
    status: z.ZodOptional<z.ZodEnum<["active", "inactive"]>>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    contactPerson?: string | undefined;
    taxId?: string | undefined;
    paymentTerms?: string | undefined;
    productsSupplied?: string[] | undefined;
}, {
    email?: string | undefined;
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    phone?: string | undefined;
    address?: string | undefined;
    contactPerson?: string | undefined;
    taxId?: string | undefined;
    paymentTerms?: string | undefined;
    productsSupplied?: string[] | undefined;
}>;
export declare const createPOSchema: z.ZodObject<{
    branchId: z.ZodString;
    supplierId: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        orderedQty: z.ZodNumber;
        unitCost: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        orderedQty: number;
        unitCost: number;
    }, {
        productId: string;
        orderedQty: number;
        unitCost: number;
    }>, "many">;
    expectedDate: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    branchId: string;
    supplierId: string;
    items: {
        productId: string;
        orderedQty: number;
        unitCost: number;
    }[];
    notes?: string | undefined;
    expectedDate?: string | undefined;
}, {
    branchId: string;
    supplierId: string;
    items: {
        productId: string;
        orderedQty: number;
        unitCost: number;
    }[];
    notes?: string | undefined;
    expectedDate?: string | undefined;
}>;
export declare const updatePOSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["draft", "submitted", "approved", "ordered", "partially_received", "fully_received", "cancelled"]>>;
    notes: z.ZodOptional<z.ZodString>;
    expectedDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: "cancelled" | "approved" | "draft" | "submitted" | "ordered" | "partially_received" | "fully_received" | undefined;
    notes?: string | undefined;
    expectedDate?: string | undefined;
}, {
    status?: "cancelled" | "approved" | "draft" | "submitted" | "ordered" | "partially_received" | "fully_received" | undefined;
    notes?: string | undefined;
    expectedDate?: string | undefined;
}>;
export declare const createGRNSchema: z.ZodObject<{
    purchaseOrderId: z.ZodString;
    receivedItems: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        receivedQty: z.ZodNumber;
        damagedQty: z.ZodDefault<z.ZodNumber>;
        unitCost: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        unitCost: number;
        receivedQty: number;
        damagedQty: number;
    }, {
        productId: string;
        unitCost: number;
        receivedQty: number;
        damagedQty?: number | undefined;
    }>, "many">;
    notes: z.ZodOptional<z.ZodString>;
    documentUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    purchaseOrderId: string;
    receivedItems: {
        productId: string;
        unitCost: number;
        receivedQty: number;
        damagedQty: number;
    }[];
    notes?: string | undefined;
    documentUrl?: string | undefined;
}, {
    purchaseOrderId: string;
    receivedItems: {
        productId: string;
        unitCost: number;
        receivedQty: number;
        damagedQty?: number | undefined;
    }[];
    notes?: string | undefined;
    documentUrl?: string | undefined;
}>;
export declare const createTaskSchema: z.ZodObject<{
    branchId: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    assigneeId: z.ZodString;
    priority: z.ZodDefault<z.ZodEnum<["low", "medium", "high", "urgent"]>>;
    dueDate: z.ZodOptional<z.ZodString>;
    attachments: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    description: string;
    branchId: string;
    title: string;
    assigneeId: string;
    priority: "low" | "medium" | "high" | "urgent";
    dueDate?: string | undefined;
    attachments?: string[] | undefined;
}, {
    description: string;
    branchId: string;
    title: string;
    assigneeId: string;
    priority?: "low" | "medium" | "high" | "urgent" | undefined;
    dueDate?: string | undefined;
    attachments?: string[] | undefined;
}>;
export declare const updateTaskStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["todo", "in_progress", "pending_review", "completed", "cancelled"]>;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "cancelled" | "completed" | "todo" | "in_progress" | "pending_review";
    comment?: string | undefined;
}, {
    status: "cancelled" | "completed" | "todo" | "in_progress" | "pending_review";
    comment?: string | undefined;
}>;
export declare const addTaskCommentSchema: z.ZodObject<{
    comment: z.ZodString;
}, "strip", z.ZodTypeAny, {
    comment: string;
}, {
    comment: string;
}>;
export declare const createTicketSchema: z.ZodObject<{
    subject: z.ZodString;
    category: z.ZodEnum<["billing", "account", "technical", "general"]>;
    priority: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    category: "billing" | "account" | "technical" | "general";
    priority: "low" | "medium" | "high";
    subject: string;
}, {
    message: string;
    category: "billing" | "account" | "technical" | "general";
    subject: string;
    priority?: "low" | "medium" | "high" | undefined;
}>;
export declare const replyTicketSchema: z.ZodObject<{
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
}, {
    message: string;
}>;
//# sourceMappingURL=index.d.ts.map