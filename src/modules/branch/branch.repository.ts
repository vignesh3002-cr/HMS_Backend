import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";

export class BranchRepository {
  async findBranchCode(branchCode: string) {
    return prisma.branch.findFirst({
      where: {
        branch_code: branchCode
      }
    });
  }

  async findUsername(username: string) {
    return prisma.user_table.findFirst({
      where: {
        username
      }
    });
  }

  async findEmail(email: string) {
    return prisma.employees.findFirst({
      where: {
        email
      }
    });
  }

  async findMobile(mobile: string) {
    return prisma.employees.findFirst({
      where: {
        mobile_no: mobile
      }
    });
  }

  async getAllBranches() {
    return await prisma.branch.findMany({
      where: {
        branch_status: "Active"
      },
      include: {
        hospital: true
      }
    });
  }

  async getBranchById(branchId: string) {
    return await prisma.branch.findUnique({
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
        // Never the raw user_table row either — it carries the password hash,
        // just the safe fields needed to display "who administers this branch".
        user_branch_mapping: {
          where: { status: 1, user_table: { role_type: "BRANCH_ADMIN" } },
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

  async updateBranch(branchId: string, data: Prisma.branchUpdateInput) {
    return await prisma.branch.update({
      where: {
        branch_id: branchId
      },
      data
    });
  }

  async deleteBranch(branchId: string) {
    return await prisma.branch.update({
      where: {
        branch_id: branchId
      },
      data: {
        branch_status: "Inactive"
      }
    });
  }

  async findUserById(userId: string) {
    return prisma.user_table.findUnique({
      where: { user_id: userId },
    });
  }

  // Get assignable admins (users with BRANCH_ADMIN role who are employees)
  async getAssignableAdmins(search?: string) {
    const where: Prisma.user_tableWhereInput = {
      role_type: "BRANCH_ADMIN",
      user_status: 1, // active users
      ...(search && {
        OR: [
          { username: { contains: search, mode: "insensitive" } },
          { employees: { first_name: { contains: search, mode: "insensitive" } } },
          { employees: { email: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const users = await prisma.user_table.findMany({
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
      user_id: u.user_id!,
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
  async findBranchAdminUser(userId: string) {
    return prisma.user_table.findFirst({
      where: {
        user_id: userId,
        role_type: "BRANCH_ADMIN",
        user_status: 1,
      },
    });
  }

  // Check if branch exists and is active
  async findActiveBranch(branchId: string) {
    return prisma.branch.findFirst({
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
  async assignAdminToBranch(userId: string, branchId: string, employeeData?: {
    first_name: string;
    last_name?: string;
    email: string;
    mobile_no: string;
    designation?: string;
    department_id?: string;
  }) {
    await prisma.$transaction(async (tx) => {
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
          is_primary_branch: false,
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
          is_primary_branch: false,
        },
      });

      // Move the admin's single employees row to this branch, creating one
      // only if they somehow don't have one yet.
      const existingEmployee = await tx.employees.findUnique({
        where: { user_id: userId },
      });

      let employeeId: string | undefined = existingEmployee?.employee_id ?? undefined;

      if (existingEmployee) {
        await tx.employees.update({
          where: { user_id: userId },
          data: { branch_id: branchId },
        });
      } else if (employeeData) {
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
            is_primary_branch: true,
            employee_id: employeeId,
          },
        });
      } else {
        await tx.user_branch_mapping.create({
          data: {
            user_id: userId,
            branch_id: branchId,
            employee_id: employeeId,
            status: 1,
            is_primary_branch: true,
          },
        });
      }
    });
  }

  // Unassign a Branch Admin from whatever branch(es) they're currently active
  // on, without assigning a new one — the explicit "None" state.
  async unassignAdmin(userId: string) {
    return prisma.user_branch_mapping.updateMany({
      where: {
        user_id: userId,
        status: 1,
      },
      data: {
        status: 0,
        is_primary_branch: false,
      },
    });
  }

  private async generateEmployeeId(tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx ?? prisma;
    return generateId(client as any, "BRANCH_ADMIN");
  }
}