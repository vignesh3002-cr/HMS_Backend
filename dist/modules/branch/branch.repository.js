"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
class BranchRepository {
    async findBranchCode(branchCode) {
        return prisma_1.default.branch.findFirst({
            where: {
                branch_code: branchCode
            }
        });
    }
    async findUsername(username) {
        return prisma_1.default.user_table.findFirst({
            where: {
                username
            }
        });
    }
    async findEmail(email) {
        return prisma_1.default.employees.findFirst({
            where: {
                email
            }
        });
    }
    async findMobile(mobile) {
        return prisma_1.default.employees.findFirst({
            where: {
                mobile_no: mobile
            }
        });
    }
    async getAllBranches() {
        return await prisma_1.default.branch.findMany({
            where: {
                branch_status: "Active"
            },
            include: {
                hospital: true
            }
        });
    }
    async getBranchById(branchId) {
        return await prisma_1.default.branch.findUnique({
            where: {
                branch_id: branchId
            },
            include: {
                hospital: true,
                // The currently-active Branch Admin mapping — deliberately NOT
                // filtered on is_primary_branch: that flag is only ever set by the
                // branch-creation/reassignment flows, not by the generic Add
                // Employee flow, so requiring it here missed admins hired that way.
                // status: 1 plus the BRANCH_ADMIN role check is enough on its own
                // now that assignAdminToBranch/createBranch also evict any other
                // admin's active mapping on this branch before activating a new one.
                // Also requires the admin to actually be active - deactivating a
                // Branch Admin no longer releases their branch mapping (it behaves
                // like every other role now), so without this check a deactivated
                // admin would keep showing up as this branch's "current admin".
                // Never the raw user_table row either — it carries the password hash,
                // just the safe fields needed to display "who administers this branch".
                user_branch_mapping: {
                    where: {
                        status: 1,
                        user_table: {
                            role_type: "BRANCH_ADMIN",
                            OR: [{ employees: { emp_status: true } }, { user_status: 0 }],
                        },
                    },
                    take: 1,
                    select: {
                        user_id: true,
                        assigned_date: true,
                        user_table: {
                            select: {
                                username: true,
                                employees: {
                                    select: {
                                        employee_id: true,
                                        first_name: true,
                                        middle_name: true,
                                        last_name: true,
                                        email: true,
                                        mobile_no: true,
                                        designation: true,
                                        employee_photo_URL: true,
                                    },
                                },
                            },
                        },
                    },
                },
            }
        });
    }
    async updateBranch(branchId, data) {
        return await prisma_1.default.branch.update({
            where: {
                branch_id: branchId
            },
            data
        });
    }
    async deleteBranch(branchId) {
        return await prisma_1.default.branch.update({
            where: {
                branch_id: branchId
            },
            data: {
                branch_status: "Inactive"
            }
        });
    }
    async findUserById(userId) {
        return prisma_1.default.user_table.findUnique({
            where: { user_id: userId },
        });
    }
    // Get assignable admins (users with BRANCH_ADMIN role who are employees)
    async getAssignableAdmins(search) {
        const where = {
            role_type: "BRANCH_ADMIN",
            user_status: 0, // active users (0 = Active, 1 = Inactive)
            ...(search && {
                OR: [
                    { username: { contains: search, mode: "insensitive" } },
                    { employees: { first_name: { contains: search, mode: "insensitive" } } },
                    { employees: { email: { contains: search, mode: "insensitive" } } },
                ],
            }),
        };
        const users = await prisma_1.default.user_table.findMany({
            where,
            include: {
                employees: true,
                user_branch_mapping: {
                    where: { status: 1 },
                    include: { branch: true },
                },
            },
        });
        return users.map((u) => ({
            user_id: u.user_id,
            employee_id: u.employees?.employee_id ?? null,
            full_name: u.employees
                ? `${u.employees.first_name} ${u.employees.middle_name ? u.employees.middle_name + " " : ""}${u.employees.last_name}`
                : u.username ?? "",
            email: u.employees?.email ?? null,
            role_type: u.role_type ?? "",
            current_branches: u.user_branch_mapping.map((m) => m.branch_id),
        }));
    }
    // Check if user exists and is branch admin
    async findBranchAdminUser(userId) {
        return prisma_1.default.user_table.findFirst({
            where: {
                user_id: userId,
                role_type: "BRANCH_ADMIN",
                user_status: 0,
            },
        });
    }
    // Check if branch exists and is active
    async findActiveBranch(branchId) {
        return prisma_1.default.branch.findFirst({
            where: {
                branch_id: branchId,
                branch_status: "Active",
            },
        });
    }
    // Assign admin to branch (create/update user_branch_mapping + employees
    // record). Wrapped in a single transaction so the old mapping is never
    // deactivated without the new one successfully taking its place (or vice
    // versa).
    //
    // `employees.user_id` is UNIQUE — a user has exactly one employees row for
    // their whole lifetime, no matter how many branches they're assigned to
    // over time. So reassigning a branch admin must UPDATE that one row's
    // branch_id, never `create()` a second row for the same user (that throws
    // a unique-constraint violation on user_id whenever the admin already has
    // an employees row, which is the normal case).
    async assignAdminToBranch(userId, branchId, employeeData) {
        await prisma_1.default.$transaction(async (tx) => {
            // A Branch Admin belongs to one branch at a time — reassigning them
            // deactivates whatever other branch mapping(s) they currently hold.
            await tx.user_branch_mapping.updateMany({
                where: {
                    user_id: userId,
                    status: 1,
                    branch_id: { not: branchId },
                },
                data: {
                    status: 0,
                },
            });
            // ...and a branch belongs to one Branch Admin at a time — evict
            // whichever OTHER admin currently holds this branch (never touches
            // regular staff mapped here, only other BRANCH_ADMIN users).
            await tx.user_branch_mapping.updateMany({
                where: {
                    branch_id: branchId,
                    status: 1,
                    user_id: { not: userId },
                    user_table: { role_type: "BRANCH_ADMIN" },
                },
                data: {
                    status: 0,
                },
            });
            // Move the admin's single employees row to this branch, creating one
            // only if they somehow don't have one yet.
            const existingEmployee = await tx.employees.findUnique({
                where: { user_id: userId },
            });
            let employeeId = existingEmployee?.employee_id ?? undefined;
            if (existingEmployee) {
                await tx.employees.update({
                    where: { user_id: userId },
                    data: { branch_id: branchId },
                });
            }
            else if (employeeData) {
                employeeId = await this.generateEmployeeId(tx);
                await tx.employees.create({
                    data: {
                        employee_id: employeeId,
                        user_id: userId,
                        branch_id: branchId,
                        first_name: employeeData.first_name,
                        last_name: employeeData.last_name || "",
                        email: employeeData.email,
                        mobile_no: employeeData.mobile_no,
                        designation: employeeData.designation || "Branch Admin",
                        department_id: employeeData.department_id,
                        emp_status: true,
                        joining_date: new Date(),
                    },
                });
            }
            // Check if a mapping for this (user, branch) pair already exists
            const existingMapping = await tx.user_branch_mapping.findFirst({
                where: {
                    user_id: userId,
                    branch_id: branchId,
                },
            });
            if (existingMapping) {
                await tx.user_branch_mapping.update({
                    where: { id: existingMapping.id },
                    data: {
                        status: 1,
                        employee_id: employeeId,
                    },
                });
            }
            else {
                await tx.user_branch_mapping.create({
                    data: {
                        user_id: userId,
                        branch_id: branchId,
                        employee_id: employeeId,
                        status: 1,
                    },
                });
            }
        });
    }
    // Unassign a Branch Admin from whatever branch(es) they're currently active
    // on, without assigning a new one — the explicit "None" state.
    async unassignAdmin(userId) {
        return prisma_1.default.user_branch_mapping.updateMany({
            where: {
                user_id: userId,
                status: 1,
            },
            data: {
                status: 0,
            },
        });
    }
    async generateEmployeeId(tx) {
        const client = tx ?? prisma_1.default;
        return (0, idGenerator_1.generateId)(client, "BRANCH_ADMIN");
    }
}
exports.BranchRepository = BranchRepository;
