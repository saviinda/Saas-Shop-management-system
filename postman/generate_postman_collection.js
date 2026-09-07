const fs = require('fs');
const path = require('path');

// Helper to create Postman request item
function createRequestItem({
  name,
  method = 'GET',
  urlPath = [],
  queryParams = [],
  headers = [],
  authType = 'bearer', // 'bearer', 'none'
  authTokenVar = 'ownerToken', // 'adminToken', 'ownerToken', 'staffToken'
  body = null,
  testScripts = [],
  description = ''
}) {
  const headerList = [...headers];
  
  if (body) {
    if (!headerList.some(h => h.key.toLowerCase() === 'content-type')) {
      headerList.push({ key: 'Content-Type', value: 'application/json' });
    }
  }

  if (authType === 'bearer') {
    headerList.push({
      key: 'Authorization',
      value: `Bearer {{${authTokenVar}}}`,
      type: 'text'
    });
  }

  const item = {
    name,
    request: {
      method,
      header: headerList,
      url: {
        raw: `{{baseUrl}}/${urlPath.join('/')}${queryParams.length > 0 ? '?' + queryParams.map(q => `${q.key}=${encodeURIComponent(q.value)}`).join('&') : ''}`,
        host: ['{{baseUrl}}'],
        path: urlPath,
        query: queryParams.map(q => ({
          key: q.key,
          value: q.value,
          description: q.description || ''
        }))
      },
      description: description || name
    },
    response: []
  };

  if (body) {
    item.request.body = {
      mode: 'raw',
      raw: typeof body === 'string' ? body : JSON.stringify(body, null, 2),
      options: {
        raw: {
          language: 'json'
        }
      }
    };
  }

  if (testScripts && testScripts.length > 0) {
    item.event = [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: testScripts
        }
      }
    ];
  }

  return item;
}

// Common Test Script Generators
const scripts = {
  status200: (entityName = 'Response') => [
    'pm.test("Status code is 200 OK", function () {',
    '    pm.response.to.have.status(200);',
    '});',
    'pm.test("Response is JSON with success: true", function () {',
    '    var jsonData = pm.response.json();',
    '    pm.expect(jsonData).to.be.an("object");',
    '    pm.expect(jsonData.success).to.be.true;',
    '});'
  ],
  status201: (entityName = 'Resource') => [
    'pm.test("Status code is 201 Created", function () {',
    '    pm.response.to.have.status(201);',
    '});',
    'pm.test("Response confirms resource creation", function () {',
    '    var jsonData = pm.response.json();',
    '    pm.expect(jsonData.success).to.be.true;',
    '    pm.expect(jsonData.data).to.be.an("object");',
    '});'
  ],
  status400: (errorSnippet = '') => [
    'pm.test("Status code is 400 Bad Request", function () {',
    '    pm.response.to.have.status(400);',
    '});',
    'pm.test("Returns descriptive error payload", function () {',
    '    var jsonData = pm.response.json();',
    '    pm.expect(jsonData.success).to.be.false;',
    '    pm.expect(jsonData.error).to.be.an("object");',
    errorSnippet ? `    pm.expect(JSON.stringify(jsonData)).to.include('${errorSnippet}');` : '',
    '});'
  ].filter(Boolean),
  status401: () => [
    'pm.test("Status code is 401 Unauthorized", function () {',
    '    pm.response.to.have.status(401);',
    '});',
    'pm.test("Unauthorized error code returned", function () {',
    '    var jsonData = pm.response.json();',
    '    pm.expect(jsonData.success).to.be.false;',
    '});'
  ],
  status403: () => [
    'pm.test("Status code is 403 Forbidden", function () {',
    '    pm.response.to.have.status(403);',
    '});',
    'pm.test("Access denied / permission error returned", function () {',
    '    var jsonData = pm.response.json();',
    '    pm.expect(jsonData.success).to.be.false;',
    '});'
  ],
  status404: () => [
    'pm.test("Status code is 404 Not Found", function () {',
    '    pm.response.to.have.status(404);',
    '});',
    'pm.test("Resource not found error payload", function () {',
    '    var jsonData = pm.response.json();',
    '    pm.expect(jsonData.success).to.be.false;',
    '});'
  ],
  loginSuperAdmin: () => [
    'pm.test("Status code is 200 OK", function () {',
    '    pm.response.to.have.status(200);',
    '});',
    'pm.test("Super Admin JWT token received & stored", function () {',
    '    var jsonData = pm.response.json();',
    '    pm.expect(jsonData.success).to.be.true;',
    '    pm.expect(jsonData.data.token).to.be.a("string");',
    '    pm.expect(jsonData.data.user.role).to.eql("super_admin");',
    '    pm.environment.set("adminToken", jsonData.data.token);',
    '    pm.collectionVariables.set("adminToken", jsonData.data.token);',
    '    console.log("Super Admin Token Saved Successfully");',
    '});'
  ],
  loginShopOwner: () => [
    'pm.test("Status code is 200 OK", function () {',
    '    pm.response.to.have.status(200);',
    '});',
    'pm.test("Shop Owner JWT token & context stored", function () {',
    '    var jsonData = pm.response.json();',
    '    pm.expect(jsonData.success).to.be.true;',
    '    pm.expect(jsonData.data.token).to.be.a("string");',
    '    pm.expect(jsonData.data.user.role).to.eql("shop_owner");',
    '    pm.environment.set("ownerToken", jsonData.data.token);',
    '    pm.collectionVariables.set("ownerToken", jsonData.data.token);',
    '    if (jsonData.data.shop && jsonData.data.shop.id) {',
    '        pm.environment.set("shopId", jsonData.data.shop.id);',
    '        pm.collectionVariables.set("shopId", jsonData.data.shop.id);',
    '    }',
    '    if (jsonData.data.defaultBranch && jsonData.data.defaultBranch.id) {',
    '        pm.environment.set("branchId", jsonData.data.defaultBranch.id);',
    '        pm.collectionVariables.set("branchId", jsonData.data.defaultBranch.id);',
    '    }',
    '    console.log("Shop Owner Token & Context Saved");',
    '});'
  ],
  loginStaff: () => [
    'pm.test("Status code is 200 OK", function () {',
    '    pm.response.to.have.status(200);',
    '});',
    'pm.test("Staff JWT token stored", function () {',
    '    var jsonData = pm.response.json();',
    '    pm.expect(jsonData.success).to.be.true;',
    '    pm.expect(jsonData.data.token).to.be.a("string");',
    '    pm.environment.set("staffToken", jsonData.data.token);',
    '    pm.collectionVariables.set("staffToken", jsonData.data.token);',
    '    console.log("Staff Token Saved");',
    '});'
  ],
  saveCreatedId: (varName, jsonPath = 'data.id') => [
    'pm.test("Status code is 201 Created", function () {',
    '    pm.response.to.have.status(201);',
    '});',
    'pm.test("Save created ID to environment variables", function () {',
    '    var jsonData = pm.response.json();',
    '    pm.expect(jsonData.success).to.be.true;',
    `    var id = jsonData.${jsonPath};`,
    '    pm.expect(id).to.be.a("string");',
    `    pm.environment.set("${varName}", id);`,
    `    pm.collectionVariables.set("${varName}", id);`,
    `    console.log("Saved ${varName}: " + id);`,
    '});'
  ]
};

console.log("Building complete Postman Collection...");

const collection = {
  info: {
    _postman_id: "saas-full-api-test-suite-v1",
    name: "SaaS Communication & Shop Management API Test Suite",
    description: "Production-grade, comprehensive Postman test suite covering all 22 REST API modules, RBAC roles (Super Admin, Shop Owner, Manager, Staff/Worker), positive, negative, validation, authorization, and edge-case test workflows.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:5000/api/v1", type: "string" },
    { key: "healthUrl", value: "http://localhost:5000/health", type: "string" },
    { key: "adminToken", value: "", type: "string" },
    { key: "ownerToken", value: "", type: "string" },
    { key: "staffToken", value: "", type: "string" },
    { key: "shopId", value: "shp_urban_cafe", type: "string" },
    { key: "branchId", value: "br_urban_downtown", type: "string" },
    { key: "branchId2", value: "br_urban_westside", type: "string" },
    { key: "packageId", value: "pkg_standard", type: "string" },
    { key: "userId", value: "usr_worker_1", type: "string" },
    { key: "managerId", value: "usr_manager_1", type: "string" },
    { key: "productId", value: "prod_ethiopian_roast", type: "string" },
    { key: "serviceId", value: "srv_barista_class", type: "string" },
    { key: "customerId", value: "cust_david_miller", type: "string" },
    { key: "orderId", value: "ord_1001", type: "string" },
    { key: "supplierId", value: "sup_colombia_beans", type: "string" },
    { key: "purchaseOrderId", value: "", type: "string" },
    { key: "grnId", value: "", type: "string" },
    { key: "taskId", value: "tsk_grinder_calibration", type: "string" },
    { key: "ticketId", value: "tkt_custom_domain", type: "string" },
    { key: "paymentId", value: "pay_init_sub", type: "string" },
    { key: "changeRequestId", value: "", type: "string" },
    { key: "notificationId", value: "", type: "string" },
    { key: "newCreatedShopId", value: "", type: "string" },
    { key: "newCreatedBranchId", value: "", type: "string" },
    { key: "newCreatedStaffId", value: "", type: "string" },
    { key: "newCreatedPackageId", value: "", type: "string" },
    { key: "newCreatedProductId", value: "", type: "string" },
    { key: "newCreatedServiceId", value: "", type: "string" },
    { key: "newCreatedCustomerId", value: "", type: "string" },
    { key: "newCreatedOrderId", value: "", type: "string" },
    { key: "newCreatedSupplierId", value: "", type: "string" },
    { key: "newCreatedPOId", value: "", type: "string" },
    { key: "newCreatedGRNId", value: "", type: "string" },
    { key: "newCreatedTaskId", value: "", type: "string" },
    { key: "newCreatedTicketId", value: "", type: "string" },
    { key: "newCreatedPaymentId", value: "", type: "string" },
    { key: "newCreatedChangeReqId", value: "", type: "string" }
  ],
  item: []
};

// ==========================================
// 00. System Health & Infrastructure
// ==========================================
collection.item.push({
  name: "00. System Health & Verification",
  item: [
    {
      name: "GET System Health Status [Public]",
      request: {
        method: "GET",
        header: [],
        url: {
          raw: "{{healthUrl}}",
          host: ["{{healthUrl}}"]
        },
        description: "Verify backend service health, version, uptime, and database connectivity."
      },
      event: [
        {
          listen: "test",
          script: {
            type: "text/javascript",
            exec: [
              'pm.test("Status code is 200 OK", function () {',
              '    pm.response.to.have.status(200);',
              '});',
              'pm.test("Health payload reports healthy status", function () {',
              '    var jsonData = pm.response.json();',
              '    pm.expect(jsonData.status).to.eql("healthy");',
              '    pm.expect(jsonData.service).to.be.a("string");',
              '    pm.expect(jsonData.version).to.eql("1.0.0");',
              '    pm.expect(jsonData.timestamp).to.be.a("string");',
              '});'
            ]
          }
        }
      ]
    }
  ]
});

// ==========================================
// 01. Authentication & Session Management
// ==========================================
collection.item.push({
  name: "01. Authentication & Session",
  item: [
    createRequestItem({
      name: "POST Super Admin Login (Capture adminToken)",
      method: "POST",
      urlPath: ["auth", "login"],
      authType: "none",
      body: {
        email: "admin@platform.com",
        password: "Admin@123456"
      },
      testScripts: scripts.loginSuperAdmin(),
      description: "Authenticate platform Super Administrator and capture JWT adminToken."
    }),
    createRequestItem({
      name: "POST Shop Owner Login (Capture ownerToken & Context)",
      method: "POST",
      urlPath: ["auth", "login"],
      authType: "none",
      body: {
        email: "owner@urbancafe.com",
        password: "Shop@123456"
      },
      testScripts: scripts.loginShopOwner(),
      description: "Authenticate Shop Owner and capture JWT token, shopId, and default branchId."
    }),
    createRequestItem({
      name: "POST Staff Manager Login (Capture staffToken)",
      method: "POST",
      urlPath: ["auth", "login"],
      authType: "none",
      body: {
        email: "sarah.manager@urbancafe.com",
        password: "Staff@123456"
      },
      testScripts: scripts.loginStaff(),
      description: "Authenticate Shop Manager/Staff and capture staffToken."
    }),
    createRequestItem({
      name: "GET Current User Profile (Me)",
      method: "GET",
      urlPath: ["auth", "me"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns authenticated user profile", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.user.email).to.eql("owner@urbancafe.com");',
        '    pm.expect(jsonData.data.shop).to.be.an("object");',
        '    pm.expect(jsonData.data.branches).to.be.an("array");',
        '});'
      ],
      description: "Get authenticated session profile, shop metadata, permissions, and assigned branches."
    }),
    createRequestItem({
      name: "POST Register New Shop Owner (Self-Service Onboarding)",
      method: "POST",
      urlPath: ["auth", "register"],
      authType: "none",
      body: {
        name: "Elena Rostova",
        email: `newowner_${Date.now()}@bakeryhub.io`,
        password: "OwnerPassword@123",
        phone: "+1 555 999 8888",
        businessName: "Gourmet Patisserie Hub",
        businessAddress: "45 French Quarter Way",
        businessCategory: "Bakery & Sweets",
        packageId: "pkg_standard"
      },
      testScripts: [
        ...scripts.status201(),
        'pm.test("Owner registered and auto-provisioned default branch", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.user).to.be.an("object");',
        '    pm.expect(jsonData.data.shop).to.be.an("object");',
        '    pm.expect(jsonData.data.token).to.be.a("string");',
        '});'
      ],
      description: "Self-service registration of a new Shop Owner with automatic default branch and initial subscription provisioning."
    }),
    createRequestItem({
      name: "POST Change Password (Authenticated)",
      method: "POST",
      urlPath: ["auth", "change-password"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        oldPassword: "Shop@123456",
        newPassword: "Shop@123456"
      },
      testScripts: scripts.status200(),
      description: "Update password for the logged-in user with old password validation."
    }),
    createRequestItem({
      name: "POST Forgot Password Request",
      method: "POST",
      urlPath: ["auth", "forgot-password"],
      authType: "none",
      body: {
        email: "owner@urbancafe.com"
      },
      testScripts: [
        ...scripts.status200(),
        'pm.test("Forgot password instructions dispatched", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.message).to.be.a("string");',
        '});'
      ],
      description: "Request a password reset link/token to be emailed."
    }),
    createRequestItem({
      name: "POST Reset Password with Token",
      method: "POST",
      urlPath: ["auth", "reset-password"],
      authType: "none",
      body: {
        token: "sample_or_mock_reset_token",
        newPassword: "BrandNewPassword@123"
      },
      testScripts: [
        'pm.test("Handles reset token verification (200 or 400 invalid token)", function () {',
        '    pm.expect(pm.response.code).to.be.oneOf([200, 400]);',
        '});'
      ],
      description: "Reset account password given a valid reset token."
    }),
    createRequestItem({
      name: "POST Logout Session",
      method: "POST",
      urlPath: ["auth", "logout"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: scripts.status200(),
      description: "Terminate the authenticated user session."
    }),
    createRequestItem({
      name: "[-] Negative: Login with Invalid Credentials",
      method: "POST",
      urlPath: ["auth", "login"],
      authType: "none",
      body: {
        email: "admin@platform.com",
        password: "WrongPassword@999"
      },
      testScripts: [
        'pm.test("Status code is 401 Unauthorized", function () {',
        '    pm.response.to.have.status(401);',
        '});',
        'pm.test("Returns invalid credentials error", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.success).to.be.false;',
        '});'
      ],
      description: "Negative Test: Verify rejection when supplying incorrect password."
    }),
    createRequestItem({
      name: "[-] Negative: Missing Required Login Fields",
      method: "POST",
      urlPath: ["auth", "login"],
      authType: "none",
      body: {
        email: "invalid-email-format"
      },
      testScripts: scripts.status400("validation"),
      description: "Validation Test: Verify 400 Bad Request when email format is invalid and password missing."
    }),
    createRequestItem({
      name: "[-] Negative: Access /me without Authorization Token",
      method: "GET",
      urlPath: ["auth", "me"],
      authType: "none",
      testScripts: scripts.status401(),
      description: "Authentication Test: Ensure protected endpoint rejects requests without Bearer token."
    })
  ]
});

// ==========================================
// 02. Super Admin - Shop Management
// ==========================================
collection.item.push({
  name: "02. Super Admin - Shop Management",
  item: [
    createRequestItem({
      name: "GET List All Shops (Super Admin Filter & Pagination)",
      method: "GET",
      urlPath: ["shops"],
      queryParams: [
        { key: "status", value: "all", description: "Filter by status (all, active, pending, suspended, inactive)" },
        { key: "page", value: "1", description: "Page number" },
        { key: "limit", value: "20", description: "Items per page" }
      ],
      authType: "bearer",
      authTokenVar: "adminToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns paginated shops list with total meta", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '    pm.expect(jsonData.meta).to.be.an("object");',
        '    pm.expect(jsonData.meta.total).to.be.at.least(1);',
        '});'
      ],
      description: "Super Admin retrieves list of all registered tenant shops with search and status filtering."
    }),
    createRequestItem({
      name: "GET Shop Details by ID (with Full Diagnostic Summary)",
      method: "GET",
      urlPath: ["shops", "{{shopId}}"],
      authType: "bearer",
      authTokenVar: "adminToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Shop diagnostic payload includes branches, usage, subscription, and owner", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.shop.id).to.eql(pm.collectionVariables.get("shopId") || "shp_urban_cafe");',
        '    pm.expect(jsonData.data.branches).to.be.an("array");',
        '    pm.expect(jsonData.data.usage).to.be.an("object");',
        '});'
      ],
      description: "Super Admin or Owner retrieves comprehensive shop details, branch list, usage quotas, active subscription, and audit log history."
    }),
    createRequestItem({
      name: "POST Super Admin Create Shop with Owner & Subscription",
      method: "POST",
      urlPath: ["shops"],
      authType: "bearer",
      authTokenVar: "adminToken",
      body: {
        name: "Artisan Roastery Hub",
        category: "Coffee Roastery & Bakery",
        address: "740 Bean Boulevard, Seattle WA",
        contactNumber: "+1 555 432 1098",
        ownerName: "Alexander Hayes",
        ownerEmail: `alex.hayes_${Date.now()}@roastery.com`,
        password: "OwnerPassword@123",
        packageId: "pkg_standard",
        status: "active",
        description: "Specialty micro-lot coffee roaster with flagship cafe."
      },
      testScripts: [
        ...scripts.saveCreatedId("newCreatedShopId", "data.shop.id"),
        'pm.test("Owner user and default branch created", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.user).to.be.an("object");',
        '    pm.expect(jsonData.data.defaultBranch).to.be.an("object");',
        '    pm.expect(jsonData.data.subscription).to.be.an("object");',
        '});'
      ],
      description: "Super Admin provisions an entire tenant workspace including shop record, owner account, default branch, and active subscription."
    }),
    createRequestItem({
      name: "PATCH Super Admin Update Shop Details",
      method: "PATCH",
      urlPath: ["shops", "{{shopId}}"],
      authType: "bearer",
      authTokenVar: "adminToken",
      body: {
        description: "Updated description for Urban Cafe Hub flagship store.",
        category: "Food & Beverage / Specialty Roastery"
      },
      testScripts: scripts.status200(),
      description: "Super Admin updates tenant shop metadata."
    }),
    createRequestItem({
      name: "PATCH Update Shop Status (Active/Suspended/Restricted)",
      method: "PATCH",
      urlPath: ["shops", "{{shopId}}", "status"],
      authType: "bearer",
      authTokenVar: "adminToken",
      body: {
        status: "active",
        restrictionNotes: "Verified account standing. Operational status set to Active."
      },
      testScripts: scripts.status200(),
      description: "Super Admin updates operational status of a shop (active, suspended, inactive, restricted)."
    }),
    createRequestItem({
      name: "POST Super Admin Approve Pending Shop Registration",
      method: "POST",
      urlPath: ["shops", "{{shopId}}", "approve"],
      authType: "bearer",
      authTokenVar: "adminToken",
      testScripts: scripts.status200(),
      description: "Super Admin approves a pending self-registered shop, activating owner account and sending confirmation email."
    }),
    createRequestItem({
      name: "PATCH Shop Owner Update Shop Profile / Information",
      method: "PATCH",
      urlPath: ["shops", "{{shopId}}", "profile"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        name: "Urban Cafe Hub",
        description: "Award-winning specialty cafe, roastery and community gathering hub.",
        openingHours: "Mon-Sun: 06:30 AM - 10:30 PM",
        socialMedia: {
          instagram: "https://instagram.com/urbancafehub",
          facebook: "https://facebook.com/urbancafehub"
        }
      },
      testScripts: scripts.status200(),
      description: "Shop Owner updates their public shop profile, operating hours, social media links, and description."
    }),
    createRequestItem({
      name: "[-] Negative: Non-SuperAdmin attempts to Create Shop (403 Forbidden)",
      method: "POST",
      urlPath: ["shops"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        name: "Unauthorized Shop Attempt",
        ownerEmail: "hacker@test.com"
      },
      testScripts: scripts.status403(),
      description: "Authorization Test: Verify Shop Owner or Staff cannot create shops via Super Admin endpoint."
    }),
    createRequestItem({
      name: "[-] Negative: Get Non-Existent Shop (404 Not Found)",
      method: "GET",
      urlPath: ["shops", "shp_non_existent_99999"],
      authType: "bearer",
      authTokenVar: "adminToken",
      testScripts: scripts.status404(),
      description: "Edge Case Test: Verify 404 Not Found when requesting invalid shop ID."
    })
  ]
});

// ==========================================
// 03. Branch Management
// ==========================================
collection.item.push({
  name: "03. Branch Management",
  item: [
    createRequestItem({
      name: "GET List Branches for Current Shop",
      method: "GET",
      urlPath: ["branches"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns active branches list", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '    pm.expect(jsonData.data.length).to.be.at.least(1);',
        '    pm.expect(jsonData.data[0]).to.have.property("name");',
        '});'
      ],
      description: "Retrieve all branches configured under the authenticated shop."
    }),
    createRequestItem({
      name: "POST Create New Branch (BR-14 Quota Validation)",
      method: "POST",
      urlPath: ["branches"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        name: "Uptown Express Kiosk",
        address: "500 Grand Avenue, Concourse Level",
        phone: "+1 555 888 1234",
        code: `BR-UP${Date.now().toString().slice(-4)}`
      },
      testScripts: scripts.saveCreatedId("newCreatedBranchId"),
      description: "Add a new branch under the current shop. Automatically validates subscription branch limit quotas."
    }),
    createRequestItem({
      name: "PATCH Update Branch Details",
      method: "PATCH",
      urlPath: ["branches", "{{branchId}}"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        name: "Downtown Main Flagship Branch",
        phone: "+1 555 234 5678"
      },
      testScripts: scripts.status200(),
      description: "Update branch address, contact phone, or display name."
    }),
    createRequestItem({
      name: "PATCH Update Branch Status (Active / Inactive)",
      method: "PATCH",
      urlPath: ["branches", "{{branchId2}}", "status"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        status: "active"
      },
      testScripts: scripts.status200(),
      description: "Toggle operational status for a secondary branch."
    }),
    createRequestItem({
      name: "[-] Negative: Create Branch Missing Required Phone/Address",
      method: "POST",
      urlPath: ["branches"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        name: "Missing Fields Branch"
      },
      testScripts: scripts.status400("validation"),
      description: "Validation Test: Verify 400 Bad Request when missing mandatory branch fields."
    }),
    createRequestItem({
      name: "[-] Negative: Deactivate Primary Default Branch (BR-13 Restriction)",
      method: "PATCH",
      urlPath: ["branches", "{{branchId}}", "status"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        status: "inactive"
      },
      testScripts: scripts.status400("primary default branch"),
      description: "Business Rule Test: System must reject deactivation of the primary default branch."
    })
  ]
});

// ==========================================
// 04. Staff & User Management
// ==========================================
collection.item.push({
  name: "04. Staff & User Management",
  item: [
    createRequestItem({
      name: "GET List Staff Users (Filtered by Shop)",
      method: "GET",
      urlPath: ["users"],
      queryParams: [
        { key: "role", value: "all", description: "Filter by role" },
        { key: "status", value: "all", description: "Filter by status" }
      ],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns staff members with assigned permissions", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '    pm.expect(jsonData.data[0]).to.have.property("email");',
        '    pm.expect(jsonData.data[0]).to.have.property("permissions");',
        '});'
      ],
      description: "List all employees, managers, and staff for the shop."
    }),
    createRequestItem({
      name: "GET Super Admin - List Shop Owners (with metrics)",
      method: "GET",
      urlPath: ["users", "owners"],
      authType: "bearer",
      authTokenVar: "adminToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns shop owners with subscription and worker counts", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '    pm.expect(jsonData.data[0].role).to.eql("shop_owner");',
        '});'
      ],
      description: "Super Admin retrieves list of all shop owner accounts with linked subscription and worker statistics."
    }),
    createRequestItem({
      name: "POST Create Staff User (Manager / Worker with RBAC)",
      method: "POST",
      urlPath: ["users", "staff"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        name: "Daniel Craig",
        email: `daniel.barista_${Date.now()}@urbancafe.com`,
        password: "StaffPassword@123",
        phone: "+1 555 333 4444",
        role: "worker",
        branchIds: ["{{branchId}}"]
      },
      testScripts: scripts.saveCreatedId("newCreatedStaffId"),
      description: "Create a new staff user, assign roles, branch restrictions, and check user subscription quota."
    }),
    createRequestItem({
      name: "POST Reset Staff User Access (Credentials Regeneration)",
      method: "POST",
      urlPath: ["users", "{{userId}}", "reset-access"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        newPassword: "NewTempPassword@123",
        reason: "Employee requested password reset after lockout."
      },
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns regenerated temporary credentials & dispatch confirmation", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.user.status).to.eql("active");',
        '    pm.expect(jsonData.data.temporaryPassword).to.be.a("string");',
        '});'
      ],
      description: "Admin or Shop Owner resets staff password, reactivates locked accounts, and dispatches credentials via email."
    }),
    createRequestItem({
      name: "PATCH Update Staff User (Role / Permissions / Branches)",
      method: "PATCH",
      urlPath: ["users", "{{userId}}"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        phone: "+1 555 444 7799",
        status: "active",
        permissions: ["dashboard", "orders", "inventory", "tasks"]
      },
      testScripts: scripts.status200(),
      description: "Modify user profile, role, status, or granular permission overrides."
    }),
    createRequestItem({
      name: "GET User Activity Logs by ID",
      method: "GET",
      urlPath: ["users", "{{userId}}", "activity"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: scripts.status200(),
      description: "Audit trail of actions performed by this specific user account."
    }),
    createRequestItem({
      name: "[-] Negative: Create Staff with Existing Duplicate Email",
      method: "POST",
      urlPath: ["users", "staff"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        name: "Duplicate User",
        email: "sarah.manager@urbancafe.com",
        password: "Password@123",
        role: "worker"
      },
      testScripts: scripts.status400("EMAIL_EXISTS"),
      description: "Negative Test: Verify 400 rejection when attempting to register an already taken email address."
    }),
    createRequestItem({
      name: "[-] Negative: Worker attempts to create staff (403 Forbidden)",
      method: "POST",
      urlPath: ["users", "staff"],
      authType: "bearer",
      authTokenVar: "staffToken",
      body: {
        name: "Unauthorized Staff",
        email: "unauth@test.com",
        password: "Password@123",
        role: "worker"
      },
      testScripts: scripts.status403(),
      description: "Authorization Test: Verify worker/staff roles cannot create additional users."
    })
  ]
});

// ==========================================
// 05. Subscription Packages
// ==========================================
collection.item.push({
  name: "05. Subscription Packages",
  item: [
    createRequestItem({
      name: "GET List All Packages [Public / Authenticated]",
      method: "GET",
      urlPath: ["packages"],
      authType: "none",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns tier packages ordered by price", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '    pm.expect(jsonData.data.length).to.be.at.least(3);',
        '    pm.expect(jsonData.data[0]).to.have.property("limits");',
        '});'
      ],
      description: "Retrieve all subscription tiers (Basic, Standard, Premium) with feature matrices and limits."
    }),
    createRequestItem({
      name: "GET Package Details by ID",
      method: "GET",
      urlPath: ["packages", "{{packageId}}"],
      authType: "none",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns single package metadata with quotas", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.id).to.eql(pm.collectionVariables.get("packageId") || "pkg_standard");',
        '    pm.expect(jsonData.data.limits).to.be.an("object");',
        '});'
      ],
      description: "Retrieve tier limits (shops, branches, users, products, services, storageMb) by package ID."
    }),
    createRequestItem({
      name: "POST Super Admin Create Custom Tier Package",
      method: "POST",
      urlPath: ["packages"],
      authType: "bearer",
      authTokenVar: "adminToken",
      body: {
        name: `Enterprise Plus Tier ${Date.now().toString().slice(-4)}`,
        description: "Unlimited high-velocity multi-franchise enterprise suite.",
        price: 499,
        durationDays: 30,
        limits: {
          shops: 10,
          branches: 25,
          users: 100,
          products: 10000,
          services: 1000,
          storageMb: 50000
        },
        features: ["multi_shop", "multi_branch", "custom_roles", "priority_support", "audit_export", "api_access"],
        status: "active"
      },
      testScripts: scripts.saveCreatedId("newCreatedPackageId"),
      description: "Super Admin creates a new subscription tier with specific quota limits and features."
    }),
    createRequestItem({
      name: "PATCH Super Admin Update Package Limits",
      method: "PATCH",
      urlPath: ["packages", "{{packageId}}"],
      authType: "bearer",
      authTokenVar: "adminToken",
      body: {
        price: 139,
        description: "Updated pricing and limits for Standard Tier."
      },
      testScripts: scripts.status200(),
      description: "Super Admin updates price, description, or limits of an existing package."
    }),
    createRequestItem({
      name: "[-] Negative: Create Package with Invalid Negative Price (400 Bad Request)",
      method: "POST",
      urlPath: ["packages"],
      authType: "bearer",
      authTokenVar: "adminToken",
      body: {
        name: "Invalid Package",
        description: "Invalid negative price",
        price: -50,
        limits: {
          shops: 1,
          branches: 1,
          users: 1,
          products: 1,
          services: 1,
          storageMb: 10
        },
        features: []
      },
      testScripts: scripts.status400("validation"),
      description: "Validation Test: Ensure negative pricing is rejected by schema validator."
    })
  ]
});

// ==========================================
// 06. Subscriptions & Quota Usage
// ==========================================
collection.item.push({
  name: "06. Subscriptions & Quota Usage",
  item: [
    createRequestItem({
      name: "GET My Shop Subscription Usage & Limit Metrics",
      method: "GET",
      urlPath: ["subscriptions", "my"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns real-time usage vs tier limits", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.subscription).to.be.an("object");',
        '    pm.expect(jsonData.data.limits).to.be.an("object");',
        '    pm.expect(jsonData.data.usage).to.be.an("object");',
        '    pm.expect(jsonData.data.percentages).to.be.an("object");',
        '});'
      ],
      description: "Shop Owner fetches current quota usage percentages (branches, users, products, services) versus package limits."
    }),
    createRequestItem({
      name: "GET Super Admin - List All Shop Subscriptions",
      method: "GET",
      urlPath: ["subscriptions"],
      queryParams: [
        { key: "status", value: "all", description: "Filter by status" },
        { key: "page", value: "1", description: "Page number" },
        { key: "limit", value: "50", description: "Items per page" }
      ],
      authType: "bearer",
      authTokenVar: "adminToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns enriched subscriptions list with owner and shop names", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '    pm.expect(jsonData.data[0]).to.have.property("packageName");',
        '    pm.expect(jsonData.data[0]).to.have.property("shopName");',
        '});'
      ],
      description: "Super Admin views all shop subscriptions, expiration dates, renewal statuses, and tier assignments."
    }),
    createRequestItem({
      name: "PATCH Super Admin Update Subscription Quotas / Expiry",
      method: "PATCH",
      urlPath: ["subscriptions", "sub_urban_cafe"],
      authType: "bearer",
      authTokenVar: "adminToken",
      body: {
        autoRenew: true,
        limits: {
          shops: 1,
          branches: 5,
          users: 25,
          products: 1000,
          services: 100,
          storageMb: 5000
        }
      },
      testScripts: scripts.status200(),
      description: "Super Admin overrides limits or renews a specific shop's active subscription."
    }),
    createRequestItem({
      name: "PATCH Super Admin Update Subscription Status",
      method: "PATCH",
      urlPath: ["subscriptions", "sub_urban_cafe", "status"],
      authType: "bearer",
      authTokenVar: "adminToken",
      body: {
        status: "active"
      },
      testScripts: scripts.status200(),
      description: "Super Admin updates subscription status (active, past_due, cancelled, expired)."
    })
  ]
});

// ==========================================
// 07. Payments & Billing
// ==========================================
collection.item.push({
  name: "07. Payments & Billing",
  item: [
    createRequestItem({
      name: "GET List Payment Transactions (Tenant Isolated)",
      method: "GET",
      urlPath: ["payments"],
      queryParams: [
        { key: "status", value: "all", description: "Filter by status" },
        { key: "method", value: "all", description: "Filter by method" }
      ],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns payment records for authenticated shop", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '    if (jsonData.data.length > 0) {',
        '        pm.expect(jsonData.data[0]).to.have.property("amount");',
        '        pm.expect(jsonData.data[0]).to.have.property("status");',
        '    }',
        '});'
      ],
      description: "Retrieve payment records, invoices, and bank transfer receipts for the shop."
    }),
    createRequestItem({
      name: "GET Super Admin Payment Financial Report & Volume Analytics",
      method: "GET",
      urlPath: ["payments", "report"],
      authType: "bearer",
      authTokenVar: "adminToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns summary metrics and method breakdown", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.summary).to.be.an("object");',
        '    pm.expect(jsonData.data.summary).to.have.property("totalVolume");',
        '    pm.expect(jsonData.data.summary).to.have.property("verificationRate");',
        '    pm.expect(jsonData.data.transactions).to.be.an("array");',
        '});'
      ],
      description: "Super Admin aggregates platform payment volume, verification rates, and method breakdowns."
    }),
    createRequestItem({
      name: "GET Payment Transaction Details by ID",
      method: "GET",
      urlPath: ["payments", "{{paymentId}}"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns detailed payment item with shop and package metadata", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.id).to.eql(pm.collectionVariables.get("paymentId") || "pay_init_sub");',
        '    pm.expect(jsonData.data.amount).to.be.a("number");',
        '});'
      ],
      description: "Fetch full transaction details including bank slip URL, card last4, and review notes."
    }),
    createRequestItem({
      name: "POST Submit Payment Request - Credit Card (Instant Activation)",
      method: "POST",
      urlPath: ["payments", "request"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        packageId: "pkg_premium",
        amount: 299,
        method: "card",
        cardLast4: "4242",
        cardBrand: "Visa",
        notes: "Upgrade subscription to Premium Tier via corporate card."
      },
      testScripts: [
        ...scripts.saveCreatedId("newCreatedPaymentId"),
        'pm.test("Card payment instantly processed and marked successful", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.status).to.eql("successful");',
        '    pm.expect(jsonData.data.gatewayRef).to.be.a("string");',
        '});'
      ],
      description: "Shop Owner executes subscription renewal/upgrade via Card payment."
    }),
    createRequestItem({
      name: "POST Submit Payment Request - Bank Transfer (Slip Upload)",
      method: "POST",
      urlPath: ["payments", "request"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        packageId: "pkg_standard",
        amount: 129,
        method: "bank_transfer",
        bankSlipUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600",
        notes: "Bank Wire Transfer ref #WIRE-2026-9912. Attached official bank receipt slip."
      },
      testScripts: [
        ...scripts.status201(),
        'pm.test("Bank transfer submitted as pending admin review", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.status).to.eql("pending");',
        '    pm.expect(jsonData.data.bankSlipUrl).to.be.a("string");',
        '});'
      ],
      description: "Shop Owner submits manual Bank Transfer payment with deposit receipt slip for Admin verification."
    }),
    createRequestItem({
      name: "PATCH Super Admin Review & Approve Bank Transfer Payment",
      method: "PATCH",
      urlPath: ["payments", "{{paymentId}}", "review"],
      authType: "bearer",
      authTokenVar: "adminToken",
      body: {
        status: "successful",
        notes: "Bank wire funds verified in corporate clearing account. Approved subscription renewal."
      },
      testScripts: [
        ...scripts.status200(),
        'pm.test("Payment approved and confirmation email dispatched", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.payment.status).to.eql("successful");',
        '    pm.expect(jsonData.data.emailDispatched).to.be.true;',
        '});'
      ],
      description: "Super Admin approves or rejects bank transfer slip, triggering subscription auto-activation and email dispatch."
    }),
    createRequestItem({
      name: "PATCH Super Admin Restrict / Restore Shop Payment Access",
      method: "PATCH",
      urlPath: ["payments", "shops", "{{shopId}}", "restrict"],
      authType: "bearer",
      authTokenVar: "adminToken",
      body: {
        isRestricted: false,
        reason: "Account verified and cleared for standard payment processing."
      },
      testScripts: scripts.status200(),
      description: "Super Admin restricts or restores payment processing privileges for a specific shop."
    }),
    createRequestItem({
      name: "POST Public Payment Gateway Webhook [HMAC Verified]",
      method: "POST",
      urlPath: ["payments", "webhook"],
      headers: [
        { key: "x-signature", value: "dev_mock_signature" }
      ],
      authType: "none",
      body: {
        event: "payment_intent.succeeded",
        data: {
          transactionId: "{{paymentId}}",
          status: "successful",
          gatewayRef: "stripe_ch_9921441",
          amount: 129,
          notes: "Automated webhook charge reconciliation from Stripe/PayHere."
        }
      },
      testScripts: scripts.status200(),
      description: "Public webhook endpoint for gateway callbacks (Stripe/PayPal/PayHere) secured by HMAC signature."
    })
  ]
});

// ==========================================
// 08. Account Change Requests
// ==========================================
collection.item.push({
  name: "08. Account Change Requests",
  item: [
    createRequestItem({
      name: "GET List Change Requests",
      method: "GET",
      urlPath: ["change-requests"],
      queryParams: [
        { key: "status", value: "all", description: "Filter by status (pending, approved, rejected)" }
      ],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns change request submissions", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '});'
      ],
      description: "List sensitive profile change requests (Business Name, Category, Address, Email)."
    }),
    createRequestItem({
      name: "POST Shop Owner Submit Account Change Request",
      method: "POST",
      urlPath: ["change-requests"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        field: "Business Address",
        currentValue: "104 Main Street, Downtown Financial District",
        requestedValue: "104 Main Street, Suite 500, Downtown Plaza",
        reason: "Relocated administrative office to Suite 500 in the same building."
      },
      testScripts: scripts.saveCreatedId("newCreatedChangeReqId"),
      description: "Shop Owner submits formal request to update locked business attributes for Super Admin approval."
    }),
    createRequestItem({
      name: "PATCH Super Admin Review & Approve Change Request",
      method: "PATCH",
      urlPath: ["change-requests", "{{newCreatedChangeReqId}}", "review"],
      authType: "bearer",
      authTokenVar: "adminToken",
      body: {
        status: "approved",
        reviewNotes: "Verified lease documentation. Applied address modification."
      },
      testScripts: [
        'pm.test("Review endpoint responds (200 or 404 if no prior created ID)", function () {',
        '    pm.expect(pm.response.code).to.be.oneOf([200, 404]);',
        '});'
      ],
      description: "Super Admin approves or rejects change request, automatically propagating field updates into the Shop record."
    })
  ]
});

// ==========================================
// 09. Products Catalog
// ==========================================
collection.item.push({
  name: "09. Products Catalog",
  item: [
    createRequestItem({
      name: "GET List Products (with Aggregate Stock across Branches)",
      method: "GET",
      urlPath: ["products"],
      queryParams: [
        { key: "category", value: "all", description: "Filter by category" },
        { key: "status", value: "all", description: "Filter by status" }
      ],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns catalog with currentStock totals", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '    pm.expect(jsonData.data.length).to.be.at.least(1);',
        '    pm.expect(jsonData.data[0]).to.have.property("currentStock");',
        '    pm.expect(jsonData.data[0]).to.have.property("sku");',
        '});'
      ],
      description: "Retrieve products list with live aggregate inventory levels across all branches."
    }),
    createRequestItem({
      name: "GET Product Details by ID (with Branch Stock Breakdown)",
      method: "GET",
      urlPath: ["products", "{{productId}}"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns product details and branchStock array", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.product.id).to.eql(pm.collectionVariables.get("productId") || "prod_ethiopian_roast");',
        '    pm.expect(jsonData.data.branchStock).to.be.an("array");',
        '});'
      ],
      description: "Retrieve product metadata, SKU, pricing, and branch-by-branch stock distribution."
    }),
    createRequestItem({
      name: "POST Create Product (BR-10 SKU Check & Auto-Branch Inventory)",
      method: "POST",
      urlPath: ["products"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        sku: `UCH-TEA-${Date.now().toString().slice(-4)}`,
        name: "Organic Matcha Green Tea Powder (250g)",
        description: "Ceremonial grade stone-ground Japanese matcha from Uji, Kyoto.",
        category: "Tea & Infusions",
        costPrice: 14.50,
        sellingPrice: 28.00,
        minimumStockLevel: 8,
        supplierId: "{{supplierId}}",
        initialStock: 25
      },
      testScripts: scripts.saveCreatedId("newCreatedProductId"),
      description: "Create a new product. Validates tier product quotas, unique SKU, and auto-initializes inventory records across all branches."
    }),
    createRequestItem({
      name: "PATCH Update Product Details",
      method: "PATCH",
      urlPath: ["products", "{{productId}}"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        sellingPrice: 36.00,
        description: "Updated single-origin bean profile notes: Jasmine, bergamot, lemon curd."
      },
      testScripts: scripts.status200(),
      description: "Update product pricing, description, category, or status."
    }),
    createRequestItem({
      name: "[-] Negative: Create Product with Duplicate SKU (400 Bad Request)",
      method: "POST",
      urlPath: ["products"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        sku: "UCH-COF-001",
        name: "Duplicate SKU Ethiopian Roast",
        category: "Coffee Beans",
        costPrice: 10,
        sellingPrice: 20
      },
      testScripts: scripts.status400("SKU_EXISTS"),
      description: "Negative Test: Verify 400 rejection when submitting a duplicated product SKU."
    }),
    createRequestItem({
      name: "[-] Negative: Create Product Missing Price / SKU (Validation Error)",
      method: "POST",
      urlPath: ["products"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        name: "Incomplete Product"
      },
      testScripts: scripts.status400("validation"),
      description: "Validation Test: Verify 400 Bad Request on missing mandatory fields."
    })
  ]
});

// ==========================================
// 10. Services Catalog
// ==========================================
collection.item.push({
  name: "10. Services Catalog",
  item: [
    createRequestItem({
      name: "GET List Services",
      method: "GET",
      urlPath: ["services"],
      queryParams: [
        { key: "category", value: "all", description: "Filter by category" },
        { key: "status", value: "all", description: "Filter by status" }
      ],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns list of bookable services", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '    pm.expect(jsonData.data.length).to.be.at.least(1);',
        '    pm.expect(jsonData.data[0]).to.have.property("durationMinutes");',
        '});'
      ],
      description: "List bookable services and workshops offered by the shop."
    }),
    createRequestItem({
      name: "POST Create Bookable Service (Quota Validated)",
      method: "POST",
      urlPath: ["services"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        name: "Espresso Machine Maintenance & Descaling Workshop",
        description: "Hands-on preventative maintenance course for commercial and prosumer equipment.",
        category: "Equipment Workshops",
        price: 95.00,
        durationMinutes: 90,
        assignedStaffIds: ["{{userId}}"],
        status: "active"
      },
      testScripts: scripts.saveCreatedId("newCreatedServiceId"),
      description: "Create a new bookable service and assign staff members. Validates subscription service limits."
    }),
    createRequestItem({
      name: "PATCH Update Service Details",
      method: "PATCH",
      urlPath: ["services", "{{serviceId}}"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        price: 90.00,
        durationMinutes: 120
      },
      testScripts: scripts.status200(),
      description: "Update service pricing, duration, staff assignments, or active status."
    })
  ]
});

// ==========================================
// 11. Customers Management
// ==========================================
collection.item.push({
  name: "11. Customers Management",
  item: [
    createRequestItem({
      name: "GET List Customers (with Search Query)",
      method: "GET",
      urlPath: ["customers"],
      queryParams: [
        { key: "search", value: "David", description: "Search by customer name, phone, or email" }
      ],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns customers matching query with lifetime spend stats", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '    pm.expect(jsonData.data.length).to.be.at.least(1);',
        '    pm.expect(jsonData.data[0]).to.have.property("totalSpent");',
        '});'
      ],
      description: "Search and list customer profiles along with lifetime order counts and spend metrics."
    }),
    createRequestItem({
      name: "GET Customer Details by ID (with Order History)",
      method: "GET",
      urlPath: ["customers", "{{customerId}}"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns customer profile and historical order list", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.customer.id).to.eql(pm.collectionVariables.get("customerId") || "cust_david_miller");',
        '    pm.expect(jsonData.data.orders).to.be.an("array");',
        '});'
      ],
      description: "Fetch customer profile and their past transaction receipts."
    }),
    createRequestItem({
      name: "POST Create Customer Profile",
      method: "POST",
      urlPath: ["customers"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        name: "Sophia Martinez",
        email: `sophia_${Date.now()}@domain.com`,
        phone: "+1 555 777 6655",
        address: "320 West End Avenue, Apt 8C",
        notes: "Prefers oat milk for coffee subscriptions. VIP wholesale loyalty customer."
      },
      testScripts: scripts.saveCreatedId("newCreatedCustomerId"),
      description: "Register a new customer profile for order linkage and loyalty tracking."
    }),
    createRequestItem({
      name: "PATCH Update Customer Details",
      method: "PATCH",
      urlPath: ["customers", "{{customerId}}"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        address: "18 Hudson Square, Penthouse A",
        notes: "Updated delivery address preference."
      },
      testScripts: scripts.status200(),
      description: "Update customer phone, email, delivery address, or notes."
    })
  ]
});

// ==========================================
// 12. Orders & POS Sales
// ==========================================
collection.item.push({
  name: "12. Orders & POS Sales",
  item: [
    createRequestItem({
      name: "GET List Orders (with Branch & Payment Filters)",
      method: "GET",
      urlPath: ["orders"],
      queryParams: [
        { key: "branchId", value: "{{branchId}}", description: "Filter by branch ID" },
        { key: "status", value: "all", description: "Filter by order status" },
        { key: "paymentStatus", value: "all", description: "Filter by payment status" }
      ],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns orders list with calculated totals", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '    pm.expect(jsonData.data.length).to.be.at.least(1);',
        '    pm.expect(jsonData.data[0]).to.have.property("orderNumber");',
        '    pm.expect(jsonData.data[0]).to.have.property("totalAmount");',
        '});'
      ],
      description: "List orders and sales receipts filtered by branch and status."
    }),
    createRequestItem({
      name: "GET Order Details by ID",
      method: "GET",
      urlPath: ["orders", "{{orderId}}"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns complete order breakdown and items array", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.id).to.eql(pm.collectionVariables.get("orderId") || "ord_1001");',
        '    pm.expect(jsonData.data.items).to.be.an("array");',
        '});'
      ],
      description: "Fetch single order receipt including line items, discounts, taxes, and customer details."
    }),
    createRequestItem({
      name: "POST Create New POS Order (Auto Inventory Deduction & Low-Stock Alert)",
      method: "POST",
      urlPath: ["orders"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        branchId: "{{branchId}}",
        customerId: "{{customerId}}",
        items: [
          {
            type: "product",
            itemId: "{{productId}}",
            quantity: 2
          },
          {
            type: "service",
            itemId: "{{serviceId}}",
            quantity: 1
          }
        ],
        tax: 5.50,
        discount: 2.00,
        paymentStatus: "paid",
        paymentMethod: "credit_card",
        notes: "POS counter sale with combined product and workshop booking."
      },
      testScripts: [
        ...scripts.saveCreatedId("newCreatedOrderId"),
        'pm.test("Order created and assigned unique orderNumber", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.orderNumber).to.include("ORD-");',
        '    pm.expect(jsonData.data.totalAmount).to.be.above(0);',
        '});'
      ],
      description: "Execute a POS checkout transaction. Automatically deducts product stock from branch inventory, logs stock movement, and fires low-stock alerts if below threshold."
    }),
    createRequestItem({
      name: "PATCH Update Order Status (Confirmed -> Processing -> Completed)",
      method: "PATCH",
      urlPath: ["orders", "{{orderId}}", "status"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        status: "completed",
        paymentStatus: "paid"
      },
      testScripts: scripts.status200(),
      description: "Update fulfillment status (pending, confirmed, processing, ready, completed, cancelled)."
    }),
    createRequestItem({
      name: "[-] Negative: Create Order with Empty Line Items (400 Bad Request)",
      method: "POST",
      urlPath: ["orders"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        branchId: "{{branchId}}",
        items: []
      },
      testScripts: scripts.status400("validation"),
      description: "Validation Test: Verify order creation requires at least 1 item."
    })
  ]
});

// ==========================================
// 13. Inventory & Stock Movements
// ==========================================
collection.item.push({
  name: "13. Inventory & Stock Movements",
  item: [
    createRequestItem({
      name: "GET List Branch Inventory (with Low-Stock & Search Filter)",
      method: "GET",
      urlPath: ["inventory"],
      queryParams: [
        { key: "branchId", value: "{{branchId}}", description: "Filter by branch ID or 'all'" },
        { key: "lowStock", value: "false", description: "Filter items at or below minimumStockLevel" },
        { key: "search", value: "", description: "Search by product name or SKU" }
      ],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns branch inventory records with branchName enrichment", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '    pm.expect(jsonData.data.length).to.be.at.least(1);',
        '    pm.expect(jsonData.data[0]).to.have.property("quantity");',
        '});'
      ],
      description: "List stock levels for each product across branches."
    }),
    createRequestItem({
      name: "GET List Stock Movement Audit Trail",
      method: "GET",
      urlPath: ["inventory", "movements"],
      queryParams: [
        { key: "branchId", value: "all", description: "Filter by branch" },
        { key: "productId", value: "all", description: "Filter by product" }
      ],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns stock movement history with delta and reason", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '    if (jsonData.data.length > 0) {',
        '        pm.expect(jsonData.data[0]).to.have.property("quantityDelta");',
        '        pm.expect(jsonData.data[0]).to.have.property("performedBy");',
        '    }',
        '});'
      ],
      description: "Audit trail of all inventory changes (sales, adjustments, damage, transfers, PO receipts)."
    }),
    createRequestItem({
      name: "POST Adjust Stock by Product and Branch",
      method: "POST",
      urlPath: ["inventory", "adjust"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        branchId: "{{branchId}}",
        productId: "{{productId}}",
        quantityDelta: 5,
        reason: "Cycle count audit reconciliation +5 units found in rear storage.",
        type: "adjustment"
      },
      testScripts: [
        ...scripts.status200(),
        'pm.test("Stock adjusted and movement logged", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.inventory).to.be.an("object");',
        '    pm.expect(jsonData.data.movement).to.be.an("object");',
        '});'
      ],
      description: "Perform manual stock adjustment (delta +/-), updating branch inventory and appending a stock movement."
    }),
    createRequestItem({
      name: "POST Inter-Branch Stock Transfer (Source to Destination)",
      method: "POST",
      urlPath: ["inventory", "transfer"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        sourceBranchId: "{{branchId}}",
        destinationBranchId: "{{branchId2}}",
        productId: "{{productId}}",
        quantity: 2,
        reason: "Stock rebalance from Downtown flagship to Westside Mall branch."
      },
      testScripts: [
        ...scripts.status200(),
        'pm.test("Stock transferred between branches successfully", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.message).to.include("Stock transferred");',
        '    pm.expect(jsonData.data).to.have.property("sourceQuantity");',
        '    pm.expect(jsonData.data).to.have.property("destinationQuantity");',
        '});'
      ],
      description: "Transfer stock units between two branches. Validates source branch quantity availability."
    }),
    createRequestItem({
      name: "[-] Negative: Stock Transfer with Same Source & Destination (400)",
      method: "POST",
      urlPath: ["inventory", "transfer"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        sourceBranchId: "{{branchId}}",
        destinationBranchId: "{{branchId}}",
        productId: "{{productId}}",
        quantity: 5,
        reason: "Invalid same branch transfer"
      },
      testScripts: scripts.status400("different"),
      description: "Negative Test: Verify transfer is rejected when source and destination branch are identical."
    })
  ]
});

// ==========================================
// 14. Suppliers Management
// ==========================================
collection.item.push({
  name: "14. Suppliers Management",
  item: [
    createRequestItem({
      name: "GET List Suppliers (with Spend & PO Metrics)",
      method: "GET",
      urlPath: ["suppliers"],
      queryParams: [
        { key: "search", value: "", description: "Search by supplier name or contact" },
        { key: "status", value: "all", description: "Filter by active/inactive" }
      ],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns suppliers with purchaseOrderCount and totalSpend", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '    pm.expect(jsonData.data.length).to.be.at.least(1);',
        '    pm.expect(jsonData.data[0]).to.have.property("purchaseOrderCount");',
        '});'
      ],
      description: "List vendor suppliers along with cumulative PO counts and total spend."
    }),
    createRequestItem({
      name: "GET Supplier Details by ID (with PO and GRN History)",
      method: "GET",
      urlPath: ["suppliers", "{{supplierId}}"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns supplier item with linked POs, GRNs, and products", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.supplier.id).to.eql(pm.collectionVariables.get("supplierId") || "sup_colombia_beans");',
        '    pm.expect(jsonData.data.purchaseOrders).to.be.an("array");',
        '    pm.expect(jsonData.data.grns).to.be.an("array");',
        '});'
      ],
      description: "Retrieve vendor profile, associated purchase orders, goods received notes, and supplied products."
    }),
    createRequestItem({
      name: "POST Create Supplier",
      method: "POST",
      urlPath: ["suppliers"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        name: "Pacific Dairy & Oat Milk Distributors",
        contactPerson: "Marcus Lindqvist",
        email: `orders_${Date.now()}@pacificdairy.com`,
        phone: "+1 555 332 9900",
        address: "Warehouse 12, Pier 48, Seattle WA",
        taxId: "TAX-US-991283",
        paymentTerms: "Net 15",
        productsSupplied: ["Barista Oat Milk", "Organic Whole Milk", "Almond Base"]
      },
      testScripts: scripts.saveCreatedId("newCreatedSupplierId"),
      description: "Register a new vendor supplier."
    }),
    createRequestItem({
      name: "PATCH Update Supplier Details",
      method: "PATCH",
      urlPath: ["suppliers", "{{supplierId}}"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        paymentTerms: "Net 30",
        address: "Warehouse 4, Roaster Row, Seattle WA"
      },
      testScripts: scripts.status200(),
      description: "Update supplier terms, contact details, or status."
    })
  ]
});

// ==========================================
// 15. Purchase Orders (Procurement)
// ==========================================
collection.item.push({
  name: "15. Purchase Orders (Procurement)",
  item: [
    createRequestItem({
      name: "GET List Purchase Orders",
      method: "GET",
      urlPath: ["purchase-orders"],
      queryParams: [
        { key: "branchId", value: "all", description: "Filter by branch" },
        { key: "status", value: "all", description: "Filter by status" }
      ],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns purchase orders list", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '});'
      ],
      description: "List procurement purchase orders."
    }),
    createRequestItem({
      name: "POST Create Purchase Order",
      method: "POST",
      urlPath: ["purchase-orders"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        branchId: "{{branchId}}",
        supplierId: "{{supplierId}}",
        items: [
          {
            productId: "{{productId}}",
            orderedQty: 50,
            unitCost: 18.00
          }
        ],
        expectedDate: "2026-09-15T00:00:00.000Z",
        notes: "Restock order for Single-Origin Ethiopian coffee roast."
      },
      testScripts: [
        ...scripts.saveCreatedId("newCreatedPOId"),
        'pm.test("PO generated with poNumber and status submitted", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.poNumber).to.include("PO-");',
        '    pm.expect(jsonData.data.status).to.eql("submitted");',
        '    pm.environment.set("purchaseOrderId", jsonData.data.id);',
        '    pm.collectionVariables.set("purchaseOrderId", jsonData.data.id);',
        '});'
      ],
      description: "Create a new supplier purchase order with items, expected arrival date, and cost calculations."
    }),
    createRequestItem({
      name: "GET Purchase Order Details by ID",
      method: "GET",
      urlPath: ["purchase-orders", "{{newCreatedPOId}}"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        'pm.test("Returns PO details (200 or 404 if no prior PO created)", function () {',
        '    pm.expect(pm.response.code).to.be.oneOf([200, 404]);',
        '});'
      ],
      description: "Fetch single PO item details and ordered quantities."
    }),
    createRequestItem({
      name: "PATCH Update Purchase Order Status",
      method: "PATCH",
      urlPath: ["purchase-orders", "{{newCreatedPOId}}", "status"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        status: "ordered"
      },
      testScripts: [
        'pm.test("Status updated (200 or 404 if no PO)", function () {',
        '    pm.expect(pm.response.code).to.be.oneOf([200, 404]);',
        '});'
      ],
      description: "Update PO lifecycle status (draft, submitted, approved, ordered, partially_received, fully_received, cancelled)."
    })
  ]
});

// ==========================================
// 16. Goods Received Notes (GRN)
// ==========================================
collection.item.push({
  name: "16. Goods Received Notes (GRN)",
  item: [
    createRequestItem({
      name: "GET List Goods Received Notes",
      method: "GET",
      urlPath: ["grns"],
      queryParams: [
        { key: "branchId", value: "all", description: "Filter by branch" }
      ],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns GRN receiving records", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '});'
      ],
      description: "List receiving notes for warehouse stock intake."
    }),
    createRequestItem({
      name: "POST Create GRN against PO (Auto-Increments Inventory & Closes PO)",
      method: "POST",
      urlPath: ["grns"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        purchaseOrderId: "{{newCreatedPOId}}",
        receivedItems: [
          {
            productId: "{{productId}}",
            receivedQty: 50,
            damagedQty: 0,
            unitCost: 18.00
          }
        ],
        notes: "All 50 bags inspected in excellent condition. Lot #ET-2026-B8.",
        documentUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500"
      },
      testScripts: [
        'pm.test("GRN processed (201 if PO exists or 404 if PO absent)", function () {',
        '    pm.expect(pm.response.code).to.be.oneOf([201, 404]);',
        '    if (pm.response.code === 201) {',
        '        var jsonData = pm.response.json();',
        '        pm.expect(jsonData.data.grnNumber).to.include("GRN-");',
        '        pm.environment.set("grnId", jsonData.data.id);',
        '        pm.collectionVariables.set("grnId", jsonData.data.id);',
        '    }',
        '});'
      ],
      description: "Receive items against a PO. Automatically increments branch inventory, writes receiving stock movements, and marks the PO as fully_received."
    })
  ]
});

// ==========================================
// 17. Employee Task Management
// ==========================================
collection.item.push({
  name: "17. Employee Task Management",
  item: [
    createRequestItem({
      name: "GET List Tasks (with Status, Priority & Assignee Filters)",
      method: "GET",
      urlPath: ["tasks"],
      queryParams: [
        { key: "branchId", value: "{{branchId}}", description: "Filter by branch" },
        { key: "status", value: "all", description: "Filter by status" },
        { key: "priority", value: "all", description: "Filter by priority" }
      ],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns task list with priority and assigneeName", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '    pm.expect(jsonData.data.length).to.be.at.least(1);',
        '    pm.expect(jsonData.data[0]).to.have.property("title");',
        '});'
      ],
      description: "List operational tasks assigned to team members."
    }),
    createRequestItem({
      name: "GET Task Details by ID",
      method: "GET",
      urlPath: ["tasks", "{{taskId}}"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns task details and comments array", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.id).to.eql(pm.collectionVariables.get("taskId") || "tsk_grinder_calibration");',
        '    pm.expect(jsonData.data.comments).to.be.an("array");',
        '});'
      ],
      description: "Fetch single task details, checklist, and employee comment thread."
    }),
    createRequestItem({
      name: "POST Create and Assign Employee Task",
      method: "POST",
      urlPath: ["tasks"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        branchId: "{{branchId}}",
        title: "Sanitize & Re-grease Espresso Group Heads",
        description: "Perform quarterly group gasket replacement and backflush with Cafiza cleaner.",
        assigneeId: "{{userId}}",
        priority: "high",
        dueDate: "2026-09-10T18:00:00.000Z"
      },
      testScripts: scripts.saveCreatedId("newCreatedTaskId"),
      description: "Create and assign an operational task to a worker. Dispatches in-app notification to assignee."
    }),
    createRequestItem({
      name: "PATCH Update Task Status & Append Progress Note",
      method: "PATCH",
      urlPath: ["tasks", "{{taskId}}", "status"],
      authType: "bearer",
      authTokenVar: "staffToken",
      body: {
        status: "in_progress",
        comment: "Started burr inspection. Current extraction yield is at 19.8%."
      },
      testScripts: scripts.status200(),
      description: "Update task lifecycle status (todo, in_progress, pending_review, completed, cancelled) and append status note."
    }),
    createRequestItem({
      name: "POST Add Comment to Task Thread",
      method: "POST",
      urlPath: ["tasks", "{{taskId}}", "comments"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        comment: "Excellent progress! Please make sure to test the steam wand pressure gauge as well."
      },
      testScripts: scripts.status200(),
      description: "Add a discussion comment to a task."
    })
  ]
});

// ==========================================
// 18. Support Tickets & Communication
// ==========================================
collection.item.push({
  name: "18. Support Tickets & Communication",
  item: [
    createRequestItem({
      name: "GET List Support Tickets",
      method: "GET",
      urlPath: ["communication"],
      queryParams: [
        { key: "status", value: "all", description: "Filter by status" },
        { key: "category", value: "all", description: "Filter by category" }
      ],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns support conversations list", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '    pm.expect(jsonData.data.length).to.be.at.least(1);',
        '    pm.expect(jsonData.data[0]).to.have.property("ticketNumber");',
        '});'
      ],
      description: "List support conversations between Shop Owner and Super Admin."
    }),
    createRequestItem({
      name: "GET Support Ticket Details by ID",
      method: "GET",
      urlPath: ["communication", "{{ticketId}}"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns ticket with message history", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.id).to.eql(pm.collectionVariables.get("ticketId") || "tkt_custom_domain");',
        '    pm.expect(jsonData.data.messages).to.be.an("array");',
        '});'
      ],
      description: "Retrieve full conversation message thread on a support ticket."
    }),
    createRequestItem({
      name: "POST Shop Owner Create Support Ticket",
      method: "POST",
      urlPath: ["communication"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      body: {
        subject: "Assistance with custom thermal printer webhook integration",
        category: "technical",
        priority: "medium",
        message: "Hello Super Admin team, we are setting up our receipt printer via the REST API order events. Could you provide the webhook payload schema for completed orders?"
      },
      testScripts: scripts.saveCreatedId("newCreatedTicketId"),
      description: "Shop Owner submits a support ticket, alerting platform Super Administrators."
    }),
    createRequestItem({
      name: "POST Reply to Support Ticket Thread",
      method: "POST",
      urlPath: ["communication", "{{ticketId}}", "reply"],
      authType: "bearer",
      authTokenVar: "adminToken",
      body: {
        message: "Hello Marcus! The webhook schema documentation has been enabled in your developer settings. Let us know if you need further help.",
        status: "waiting_for_user"
      },
      testScripts: scripts.status200(),
      description: "Send reply message in ticket thread (dispatches real-time in-app notification to counterpart)."
    })
  ]
});

// ==========================================
// 19. Notifications System
// ==========================================
collection.item.push({
  name: "19. Notifications System",
  item: [
    createRequestItem({
      name: "GET List User Notifications & Unread Count",
      method: "GET",
      urlPath: ["notifications"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns user notifications and unread count", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.notifications).to.be.an("array");',
        '    pm.expect(jsonData.data).to.have.property("unreadCount");',
        '});'
      ],
      description: "Fetch notification stream (alerts, low-stock, approvals, task assignments) for current user."
    }),
    createRequestItem({
      name: "PATCH Mark All Notifications as Read",
      method: "PATCH",
      urlPath: ["notifications", "all", "read"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: scripts.status200(),
      description: "Batch mark all notifications for the authenticated user as read."
    })
  ]
});

// ==========================================
// 20. Analytics & Reporting Dashboards
// ==========================================
collection.item.push({
  name: "20. Analytics & Reporting",
  item: [
    createRequestItem({
      name: "GET Super Admin Global Platform Dashboard KPIs",
      method: "GET",
      urlPath: ["reports", "super-admin"],
      authType: "bearer",
      authTokenVar: "adminToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns platform KPIs, MRR, revenue trend, and category distributions", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.metrics).to.be.an("object");',
        '    pm.expect(jsonData.data.metrics).to.have.property("mrr");',
        '    pm.expect(jsonData.data.metrics).to.have.property("grossRevenue");',
        '    pm.expect(jsonData.data.revenueTrend).to.be.an("array");',
        '    pm.expect(jsonData.data.subDistribution).to.be.an("array");',
        '});'
      ],
      description: "Super Admin retrieves real-time platform financial metrics (MRR, gross revenue, active shops, sub tier distribution, last 6 months trend, shop summaries)."
    }),
    createRequestItem({
      name: "GET Shop Owner Quick Dashboard Summary",
      method: "GET",
      urlPath: ["reports", "shop-owner"],
      queryParams: [
        { key: "branchId", value: "all", description: "Filter by branch or all" }
      ],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns shop sales, order totals, and low stock counts", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.metrics).to.be.an("object");',
        '    pm.expect(jsonData.data.metrics).to.have.property("totalSales");',
        '    pm.expect(jsonData.data.metrics).to.have.property("lowStockCount");',
        '});'
      ],
      description: "Shop Owner dashboard overview: total sales, pending orders, low stock items, tasks summary."
    }),
    createRequestItem({
      name: "GET Shop Comprehensive Multi-Module Report",
      method: "GET",
      urlPath: ["reports", "shop"],
      queryParams: [
        { key: "branchId", value: "all", description: "Filter by branch" },
        { key: "startDate", value: "2026-01-01", description: "Start date YYYY-MM-DD" },
        { key: "endDate", value: "2026-12-31", description: "End date YYYY-MM-DD" }
      ],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns salesReport, productReport, customerReport, inventoryReport, purchaseReport, grnReport, taskReport", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data.salesReport).to.be.an("object");',
        '    pm.expect(jsonData.data.productReport).to.be.an("object");',
        '    pm.expect(jsonData.data.inventoryReport).to.be.an("object");',
        '    pm.expect(jsonData.data.purchaseReport).to.be.an("object");',
        '    pm.expect(jsonData.data.grnReport).to.be.an("object");',
        '    pm.expect(jsonData.data.taskReport).to.be.an("object");',
        '});'
      ],
      description: "Generates comprehensive end-to-end operational report covering sales, top products, customer AOV, inventory valuation, procurement spend, GRN damaged rates, and staff task completion."
    }),
    createRequestItem({
      name: "[-] Negative: Shop Owner accesses Super Admin Report (403 Forbidden)",
      method: "GET",
      urlPath: ["reports", "super-admin"],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: scripts.status403(),
      description: "Authorization Test: Verify tenant shop owner is forbidden from viewing global platform financial KPIs."
    })
  ]
});

// ==========================================
// 21. Audit Logs & System Activity
// ==========================================
collection.item.push({
  name: "21. Audit Logs & System Activity",
  item: [
    createRequestItem({
      name: "GET List Audit Logs (Tenant Isolated / Admin Comprehensive)",
      method: "GET",
      urlPath: ["audit-logs"],
      queryParams: [
        { key: "action", value: "all", description: "Filter by action" },
        { key: "entity", value: "all", description: "Filter by entity" }
      ],
      authType: "bearer",
      authTokenVar: "ownerToken",
      testScripts: [
        ...scripts.status200(),
        'pm.test("Returns immutable audit log trail", function () {',
        '    var jsonData = pm.response.json();',
        '    pm.expect(jsonData.data).to.be.an("array");',
        '    if (jsonData.data.length > 0) {',
        '        pm.expect(jsonData.data[0]).to.have.property("action");',
        '        pm.expect(jsonData.data[0]).to.have.property("actor");',
        '    }',
        '});'
      ],
      description: "Query immutable audit logs tracking who performed which action on what entity and at what timestamp."
    })
  ]
});

// Write collection JSON to file
const collectionFilePath = path.join(__dirname, "SaaS_Communication_Shop_Management_API.postman_collection.json");
fs.writeFileSync(collectionFilePath, JSON.stringify(collection, null, 2), "utf8");
console.log(`Successfully generated Postman Collection: ${collectionFilePath}`);

// Environment JSON
const environment = {
  id: "saas-full-environment-config",
  name: "SaaS Platform - Local & Cloud Environment",
  values: [
    { key: "baseUrl", value: "http://localhost:5000/api/v1", type: "default", enabled: true },
    { key: "healthUrl", value: "http://localhost:5000/health", type: "default", enabled: true },
    { key: "adminToken", value: "", type: "secret", enabled: true },
    { key: "ownerToken", value: "", type: "secret", enabled: true },
    { key: "staffToken", value: "", type: "secret", enabled: true },
    { key: "shopId", value: "shp_urban_cafe", type: "default", enabled: true },
    { key: "branchId", value: "br_urban_downtown", type: "default", enabled: true },
    { key: "branchId2", value: "br_urban_westside", type: "default", enabled: true },
    { key: "packageId", value: "pkg_standard", type: "default", enabled: true },
    { key: "userId", value: "usr_worker_1", type: "default", enabled: true },
    { key: "managerId", value: "usr_manager_1", type: "default", enabled: true },
    { key: "productId", value: "prod_ethiopian_roast", type: "default", enabled: true },
    { key: "serviceId", value: "srv_barista_class", type: "default", enabled: true },
    { key: "customerId", value: "cust_david_miller", type: "default", enabled: true },
    { key: "orderId", value: "ord_1001", type: "default", enabled: true },
    { key: "supplierId", value: "sup_colombia_beans", type: "default", enabled: true },
    { key: "purchaseOrderId", value: "", type: "default", enabled: true },
    { key: "grnId", value: "", type: "default", enabled: true },
    { key: "taskId", value: "tsk_grinder_calibration", type: "default", enabled: true },
    { key: "ticketId", value: "tkt_custom_domain", type: "default", enabled: true },
    { key: "paymentId", value: "pay_init_sub", type: "default", enabled: true },
    { key: "changeRequestId", value: "", type: "default", enabled: true },
    { key: "notificationId", value: "", type: "default", enabled: true }
  ],
  _postman_variable_scope: "environment"
};

const envFilePath = path.join(__dirname, "SaaS_Local_Environment.postman_environment.json");
fs.writeFileSync(envFilePath, JSON.stringify(environment, null, 2), "utf8");
console.log(`Successfully generated Postman Environment: ${envFilePath}`);
