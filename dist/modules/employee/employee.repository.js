"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class EmployeeRepository {
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
    async findAadhaar(aadhaar) {
        return prisma_1.default.employees.findFirst({
            where: {
                aadhaar_no: aadhaar
            }
        });
    }
    async findPAN(pan) {
        return prisma_1.default.employees.findFirst({
            where: {
                pan_no: pan
            }
        });
    }
    async findLicense(license) {
        return prisma_1.default.employees.findFirst({
            where: {
                license_no: license
            }
        });
    }
    async findDepartment(id) {
        return prisma_1.default.department_master.findUnique({
            where: {
                department_id: id
            }
        });
    }
    async findBranch(branchId) {
        return prisma_1.default.branch.findUnique({
            where: {
                branch_id: branchId
            }
        });
    }
    async softDeleteEmployee(employeeId) {
        return prisma_1.default.employees.update({
            where: {
                employee_id: employeeId
            },
            data: {
                emp_status: false
            }
        });
    }
    async findEmployeeById(employeeId) {
        return prisma_1.default.employees.findUnique({
            where: {
                employee_id: employeeId
            },
            include: {
                user_table: {
                    select: {
                        role_type: true
                    }
                }
            }
        });
    }
    async updateEmployee(employeeId, data) {
        return prisma_1.default.employees.update({
            where: {
                employee_id: employeeId
            },
            data
        });
    }
    async getAllEmployees() {
        return prisma_1.default.employees.findMany();
    }
    async getEmployees(query) {
        const { roleType, branchId, department, status, search, page = 1, limit = 10 } = query;
        const where = {};
        if (department) {
            where.department_id = department;
        }
        if (branchId) {
            where.branch_id = branchId;
        }
        if (status !== undefined) {
            where.emp_status = status;
        }
        if (search) {
            where.OR = [
                {
                    first_name: {
                        contains: search,
                        mode: "insensitive"
                    }
                },
                {
                    last_name: {
                        contains: search,
                        mode: "insensitive"
                    }
                },
                {
                    email: {
                        contains: search,
                        mode: "insensitive"
                    }
                },
                {
                    mobile_no: {
                        contains: search,
                        mode: "insensitive"
                    }
                },
                {
                    employee_id: {
                        contains: search,
                        mode: "insensitive"
                    }
                }
            ];
        }
        if (roleType) {
            where.user_table = {
                role_type: roleType
            };
        }
        const employees = await prisma_1.default.employees.findMany({
            where,
            include: {
                user_table: {
                    select: {
                        role_type: true,
                        user_status: true
                    }
                },
                branch: {
                    select: {
                        branch_name: true,
                        branch_area: true
                    }
                },
                department_master: {
                    select: {
                        department_name: true
                    }
                }
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: {
                id: "desc"
            }
        });
        const total = await prisma_1.default.employees.count({
            where
        });
        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            employees
        };
    }
    async getEmployeeById(employeeId) {
        const employee = await prisma_1.default.employees.findUnique({
            where: {
                employee_id: employeeId
            },
            include: {
                user_table: true,
                branch: true,
                department_master: {
                    select: {
                        department_name: true
                    }
                }
            }
        });
        if (!employee) {
            throw new Error("Employee not found");
        }
        const branches = await prisma_1.default.user_branch_mapping.findMany({
            where: {
                user_id: employee.user_id
            },
            include: {
                branch: true
            }
        });
        const response = {
            employee,
            user: employee.user_table,
            branches: branches.map(x => ({
                branch_id: x.branch.branch_id,
                branch_name: x.branch.branch_name
            }))
        };
        switch (employee.user_table?.role_type) {
            case "DOCTOR":
                const doctorProfile = await prisma_1.default.doctor_profile.findUnique({
                    where: {
                        employee_id: employeeId
                    }
                });
                const doctorSchedules = await prisma_1.default.doctor_schedule.findMany({
                    where: {
                        employee_id: employeeId,
                        is_active: true
                    },
                    include: {
                        branch: {
                            select: {
                                branch_name: true
                            }
                        }
                    }
                });
                response.doctorProfile =
                    doctorProfile;
                response.doctorSchedules =
                    doctorSchedules;
                break;
        }
        return response;
    }
}
exports.EmployeeRepository = EmployeeRepository;
