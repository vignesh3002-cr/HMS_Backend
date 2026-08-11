"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = __importDefault(require("../../config/prisma"));
const branch_repository_1 = require("./branch.repository");
const idGenerator_1 = require("../../utils/idGenerator");
const repository = new branch_repository_1.BranchRepository();
class BranchService {
    async getAllBranches() {
        const branches = await repository.getAllBranches();
        return branches.map((branch) => ({
            branch_id: branch.branch_id,
            branch_name: branch.branch_name,
            branch_area: branch.branch_area,
            branch_email: branch.branch_email,
            branch_contact_number: branch.emergency_no,
            hospital_name: branch.hospital?.hospital_name || "Pummy Hospital",
            hospital_id: branch.hospital?.hospital_id || "D002",
        }));
    }
    async getBranchById(branchId) {
        const branch = await repository.getBranchById(branchId);
        if (!branch)
            throw new Error("Branch not found");
        const { user_branch_mapping, ...branchFields } = branch;
        const primaryMapping = user_branch_mapping?.[0];
        const employee = primaryMapping?.user_table?.employees;
        return {
            ...branchFields,
            current_admin: primaryMapping
                ? {
                    user_id: primaryMapping.user_id,
                    employee_id: employee?.employee_id ?? null,
                    full_name: employee
                        ? `${employee.first_name} ${employee.middle_name ? employee.middle_name + " " : ""}${employee.last_name}`.trim()
                        : primaryMapping.user_table?.username ?? "",
                    email: employee?.email ?? null,
                    mobile_no: employee?.mobile_no ?? null,
                    username: primaryMapping.user_table?.username ?? null,
                    designation: employee?.designation ?? null,
                    employee_photo_URL: employee?.employee_photo_URL ?? null,
                    assigned_date: primaryMapping.assigned_date ?? null,
                }
                : null,
        };
    }
    async createBranch(data, createdBy, hospitalId) {
        // Validate branch_code uniqueness if provided
        if (data.branch_code) {
            const existingBranchCode = await repository.findBranchCode(data.branch_code);
            if (existingBranchCode)
                throw new Error("Branch code already exists");
        }
        if (data.admin_mode === "NEW") {
            // Uniqueness check only makes sense for a brand-new username — EXISTING
            // mode reuses an admin who already has one, so there's nothing to check
            // (looking up that admin's own current username would always "find" it
            // and incorrectly reject every EXISTING-mode submission).
            const adminUsername = data.admin?.username;
            if (adminUsername) {
                const existingUser = await repository.findUsername(adminUsername);
                if (existingUser)
                    throw new Error("Username already exists");
            }
        }
        else if (data.admin_mode === "EXISTING") {
            const user = await repository.findUserById(data.admin_user_id);
            if (!user)
                throw new Error("Selected admin not found");
            if (user.role_type !== "BRANCH_ADMIN")
                throw new Error("Selected user must have BRANCH_ADMIN role");
        }
        // Hash password for NEW mode
        const hashedPassword = data.admin?.password
            ? await bcrypt_1.default.hash(data.admin.password, Number(process.env.BCRYPT_SALT_ROUNDS))
            : undefined;
        return await prisma_1.default.$transaction(async (tx) => {
            // 1. Create branch FIRST (FK target for user_table.branch_id, employees.branch_id)
            const branchId = await (0, idGenerator_1.generateId)(tx, "BRANCH");
            const branch = await tx.branch.create({
                data: {
                    branch_id: branchId,
                    branch_type: data.branch_type,
                    branch_code: data.branch_code,
                    address: data.address,
                    district: data.district,
                    state_name: data.state_name,
                    country: data.country,
                    emergency_no: data.emergency_number,
                    branch_pincode: data.pincode,
                    branch_name: data.branch_name,
                    branch_status: "Active",
                    branch_email: data.email,
                    gst_no: data.gst_no,
                    pan_no: data.pan_no,
                    branch_area: data.area,
                    date_of_establish: data.date_of_establish
                        ? new Date(data.date_of_establish)
                        : new Date(),
                    website_address: data.website_address,
                    branch_license_no: data.license_number,
                    total_beds: data.total_beds,
                    total_no_emp: data.total_no_emp,
                    fax_no: data.fax_no,
                    medical_services: data.medical_services,
                    hospital_id: hospitalId,
                },
            });
            let adminUser = null;
            let adminEmployee = null;
            if (data.admin_mode === "NEW") {
                // 2a. Create user_table (branch admin) with BRANCH_ADMIN role
                const userId = await (0, idGenerator_1.generateId)(tx, "USER");
                adminUser = await tx.user_table.create({
                    data: {
                        user_id: userId,
                        username: data.admin.username,
                        password: hashedPassword,
                        role_type: "BRANCH_ADMIN",
                        created_by: createdBy,
                        user_status: 0,
                        branch_id: branchId,
                    },
                });
                // 2b. Create employees row for admin
                const employeeId = await (0, idGenerator_1.generateId)(tx, "BRANCH_ADMIN");
                adminEmployee = await tx.employees.create({
                    data: {
                        employee_id: employeeId,
                        user_id: adminUser.user_id,
                        branch_id: branchId,
                        first_name: data.admin.first_name,
                        middle_name: data.admin.middle_name,
                        last_name: data.admin.last_name ?? "",
                        email: data.admin.email,
                        mobile_no: data.admin.mobile_no,
                        designation: data.admin.designation || "Branch Admin",
                        department_id: data.admin.department_id,
                        blood_group: data.admin.blood_group,
                        nationality: data.admin.nationality,
                        marital_status: data.admin.marital_status,
                        aadhaar_no: data.admin.aadhaar_no,
                        pan_no: data.admin.pan_no,
                        passport_no: data.admin.passport_no,
                        gender: data.admin.gender,
                        dob: data.admin.dob,
                        parmanent_address: data.admin.permanent_address,
                        current_address: data.admin.current_address,
                        employee_photo_URL: data.admin.employee_photo_URL,
                        employee_state: data.admin.employee_state,
                        employee_district: data.admin.employee_district,
                        employee_area: data.admin.employee_area,
                        employee_pincode: data.admin.employee_pincode,
                        permanent_employee_state: data.admin.permanent_employee_state,
                        permanent_employee_district: data.admin.permanent_employee_district,
                        permanent_employee_area: data.admin.permanent_employee_area,
                        permanent_employee_pincode: data.admin.permanent_employee_pincode,
                        employee_no_experence: data.admin.employee_no_experence,
                        emergency_contact_name: data.admin.emergency_contact_name,
                        emergency_contact_relationship: data.admin.emergency_contact_relationship,
                        emergency_contact_number: data.admin.emergency_contact_number,
                        emp_status: true,
                        joining_date: data.admin.joining_date
                            ? new Date(data.admin.joining_date)
                            : new Date(),
                    },
                });
                // 2c. Create user_branch_mapping
                await tx.user_branch_mapping.create({
                    data: {
                        user_id: adminUser.user_id,
                        branch_id: branchId,
                        employee_id: adminEmployee.employee_id,
                        status: 1,
                        is_primary_branch: true,
                    },
                });
            }
            else if (data.admin_mode === "EXISTING") {
                // A Branch Admin is exclusive to one branch — reassigning them here
                // means deactivating whatever branch they were previously mapped to.
                await tx.user_branch_mapping.updateMany({
                    where: {
                        user_id: data.admin_user_id,
                        status: 1,
                    },
                    data: {
                        status: 0,
                        is_primary_branch: false,
                    },
                });
                // 2a. Link existing user to branch via user_branch_mapping
                await tx.user_branch_mapping.create({
                    data: {
                        user_id: data.admin_user_id,
                        branch_id: branchId,
                        status: 1,
                        is_primary_branch: true,
                    },
                });
                // 2b. Move the admin's single employees row to this branch —
                // employees.user_id is UNIQUE, so an existing row must be UPDATEd
                // (never create()'d again) or this throws a unique-constraint error.
                const existingUser = await tx.user_table.findUnique({
                    where: { user_id: data.admin_user_id },
                    include: { employees: true },
                });
                if (existingUser) {
                    if (existingUser.employees) {
                        adminEmployee = await tx.employees.update({
                            where: { user_id: existingUser.user_id },
                            data: { branch_id: branchId },
                        });
                    }
                    else {
                        const employeeId = await (0, idGenerator_1.generateId)(tx, "BRANCH_ADMIN");
                        adminEmployee = await tx.employees.create({
                            data: {
                                employee_id: employeeId,
                                user_id: existingUser.user_id,
                                branch_id: branchId,
                                first_name: "Admin",
                                last_name: "",
                                email: "",
                                mobile_no: "",
                                designation: "Branch Admin",
                                emp_status: true,
                                joining_date: new Date(),
                            },
                        });
                    }
                    // Update the mapping with employee_id
                    await tx.user_branch_mapping.updateMany({
                        where: {
                            user_id: data.admin_user_id,
                            branch_id: branchId,
                        },
                        data: {
                            employee_id: adminEmployee.employee_id,
                        },
                    });
                }
                // Fetch user for response
                adminUser = await tx.user_table.findUnique({
                    where: { user_id: data.admin_user_id },
                });
            }
            return {
                branch: {
                    branch_id: branch.branch_id,
                    emergency_number: branch.emergency_no,
                    address: branch.address,
                    branch_email: branch.branch_email,
                    branch_area: branch.branch_area,
                },
                admin: adminUser
                    ? {
                        user_id: adminUser.user_id,
                        branch_name: branch.branch_name,
                        username: adminUser.username,
                    }
                    : {
                        user_id: null,
                        branch_name: branch.branch_name,
                        username: null,
                    },
            };
        });
    }
    async updateBranch(branchId, data) {
        const existing = await repository.getBranchById(branchId);
        if (!existing)
            throw new Error("Branch not found");
        if (data.branch_code && data.branch_code !== existing.branch_code) {
            const existingBranchCode = await repository.findBranchCode(data.branch_code);
            if (existingBranchCode)
                throw new Error("Branch code already exists");
        }
        return await repository.updateBranch(branchId, {
            branch_type: data.branch_type,
            branch_code: data.branch_code,
            address: data.address,
            district: data.district,
            state_name: data.state_name,
            country: data.country,
            emergency_no: data.emergency_number,
            branch_pincode: data.pincode,
            branch_name: data.branch_name,
            branch_status: data.branch_status,
            branch_email: data.email,
            gst_no: data.gst_no,
            pan_no: data.pan_no,
            branch_area: data.area,
            date_of_establish: data.date_of_establish
                ? new Date(data.date_of_establish)
                : null,
            website_address: data.website_address,
            branch_license_no: data.license_number,
            total_beds: data.total_beds,
            total_no_emp: data.total_no_emp,
            fax_no: data.fax_no,
            medical_services: data.medical_services,
        });
    }
    async deleteBranch(branchId) {
        return await repository.deleteBranch(branchId);
    }
    // Get assignable admins (users with BRANCH_ADMIN role)
    async getAssignableAdmins(search) {
        const where = search
            ? {
                OR: [
                    { username: { contains: search, mode: "insensitive" } },
                    { employees: { first_name: { contains: search, mode: "insensitive" } } },
                    { employees: { email: { contains: search, mode: "insensitive" } } },
                ],
                role_type: "BRANCH_ADMIN",
            }
            : { role_type: "BRANCH_ADMIN" };
        const users = await prisma_1.default.user_table.findMany({
            where,
            include: {
                employees: true,
                user_branch_mapping: {
                    include: { branch: true },
                },
            },
            orderBy: { created_at: "desc" },
        });
        // A deactivated admin isn't eligible for a new branch assignment until
        // reactivated - exclude them from the assignable list entirely, rather
        // than just hiding which branch they used to occupy.
        const activeUsers = users.filter((user) => user.employees?.emp_status === true || user.user_status === 0);
        return activeUsers.map((user) => {
            const activeMappings = user.user_branch_mapping.filter((m) => m.status === 1);
            return {
                user_id: user.user_id,
                employee_id: user.employees?.employee_id ?? null,
                full_name: user.employees
                    ? `${user.employees.first_name} ${user.employees.last_name ?? ""}`.trim()
                    : user.username ?? "",
                email: user.employees?.email ?? null,
                role_type: user.role_type ?? "BRANCH_ADMIN",
                current_branches: activeMappings.map((m) => m.branch_id),
                current_branch_names: activeMappings.map((m) => m.branch?.branch_name ?? null),
            };
        });
    }
    // Assign/reassign admin to branch
    async assignAdmin(branchId, userId) {
        const branch = await repository.getBranchById(branchId);
        if (!branch)
            throw new Error("Branch not found");
        const user = await prisma_1.default.user_table.findUnique({
            where: { user_id: userId },
            include: { employees: true }
        });
        if (!user)
            throw new Error("User not found");
        if (user.role_type !== "BRANCH_ADMIN")
            throw new Error("User must have BRANCH_ADMIN role");
        // Use repository to assign admin (creates mapping + employee record)
        await repository.assignAdminToBranch(userId, branchId, {
            first_name: user.employees?.first_name ?? "Admin",
            last_name: user.employees?.last_name ?? "",
            email: user.employees?.email ?? "",
            mobile_no: user.employees?.mobile_no ?? "",
            designation: user.employees?.designation ?? "Branch Admin",
            department_id: user.employees?.department_id ?? undefined,
        });
        return { success: true, message: "Admin assigned successfully" };
    }
    // Explicitly unassign a Branch Admin from their current branch(es) — the
    // "None" state, distinct from assignAdmin (which always targets a branch).
    async unassignAdmin(userId) {
        const user = await prisma_1.default.user_table.findUnique({ where: { user_id: userId } });
        if (!user)
            throw new Error("User not found");
        if (user.role_type !== "BRANCH_ADMIN")
            throw new Error("User must have BRANCH_ADMIN role");
        await repository.unassignAdmin(userId);
        return { success: true, message: "Admin unassigned successfully" };
    }
}
exports.BranchService = BranchService;
