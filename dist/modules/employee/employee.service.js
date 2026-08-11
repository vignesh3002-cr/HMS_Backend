"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = __importDefault(require("../../config/prisma"));
const employee_repository_1 = require("./employee.repository");
const idGenerator_1 = require("../../utils/idGenerator");
const roles_1 = require("../../permissions/roles");
const repository = new employee_repository_1.EmployeeRepository();
let employeeId;
// doctor_schedule.start_time/end_time are @db.Time columns with no timezone.
// Every other reader of this value (appointment.utils.ts's timeStringToDate,
// and the frontend's toTimeInputValue/formatScheduleTime helpers) treats it
// as UTC-anchored — construct it the same way here so the round trip is
// timezone-independent. Building this from a bare "1970-01-01THH:MM:00"
// string (no explicit UTC) previously got parsed as the server's LOCAL time,
// silently shifting the stored value whenever the server isn't running in UTC.
function timeStringToUtcDate(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
}
class EmployeeService {
    async createEmployee(data, createdBy) {
        // Get creator's role to enforce creation permissions
        const creator = await prisma_1.default.user_table.findUnique({
            where: { user_id: createdBy },
            select: { role_type: true }
        });
        const creatorRole = creator?.role_type?.toUpperCase() ?? "";
        const isTopLevelAdmin = roles_1.TOP_LEVEL_ADMIN_ROLES.some(r => r === creatorRole);
        const isBranchAdmin = creatorRole === roles_1.BRANCH_ADMIN;
        const isStaffAdmin = creatorRole === roles_1.ADMIN;
        // Validate role creation permissions
        const targetRole = data.role_type?.toUpperCase() ?? "";
        if (isBranchAdmin) {
            // BRANCH_ADMIN can create all roles except BRANCH_ADMIN
            if (targetRole === roles_1.BRANCH_ADMIN) {
                throw new Error("Branch Admin cannot create another Branch Admin");
            }
        }
        if (isStaffAdmin) {
            // STAFF_ADMIN can only create PATIENT role
            if (targetRole !== "PATIENT") {
                throw new Error("Staff Admin can only create Patient records");
            }
        }
        // For BRANCH_ADMIN and STAFF_ADMIN, force branch to their assigned branch
        let allowedBranchIds = data.branch_ids;
        if (isBranchAdmin || isStaffAdmin) {
            const mappings = await prisma_1.default.user_branch_mapping.findMany({
                where: { user_id: createdBy, status: 1 },
                select: { branch_id: true }
            });
            const userBranchIds = mappings.map(m => m.branch_id);
            if (userBranchIds.length === 0) {
                throw new Error("No branch assigned to your account");
            }
            // Force single branch - use first assigned branch
            allowedBranchIds = [userBranchIds[0]];
            // Validate that the requested branch is within their allowed branches
            const invalidBranches = data.branch_ids.filter(b => !userBranchIds.includes(b));
            if (invalidBranches.length > 0) {
                throw new Error("You can only create employees in your assigned branch(es)");
            }
        }
        const username = await repository.findUsername(data.username);
        // ... rest of the existing validation
        if (username) {
            throw new Error("Username already exists");
        }
        const email = await repository.findEmail(data.email);
        if (email) {
            throw new Error("Email already exists");
        }
        const mobile = await repository.findMobile(data.mobile_no);
        if (mobile) {
            throw new Error("Mobile already exists");
        }
        if (data.aadhaar_no) {
            const aadhaar = await repository.findAadhaar(data.aadhaar_no);
            if (aadhaar) {
                throw new Error("Aadhaar already exists");
            }
        }
        if (data.pan_no) {
            const pan = await repository.findPAN(data.pan_no);
            if (pan) {
                throw new Error("PAN already exists");
            }
        }
        const department = await repository.findDepartment(data.department_id);
        if (!department) {
            throw new Error("Department not found");
        }
        for (const branchId of allowedBranchIds) {
            const branch = await repository.findBranch(branchId);
            if (!branch) {
                throw new Error(`Branch ${branchId} not found`);
            }
        }
        if (data.role_type === "DOCTOR" &&
            data.license_no) {
            const license = await repository.findLicense(data.license_no);
            if (license) {
                throw new Error("Doctor License already exists");
            }
        }
        const hashedPassword = await bcrypt_1.default.hash(data.password, Number(process.env.BCRYPT_SALT_ROUNDS));
        return await prisma_1.default.$transaction(async (tx) => {
            const userId = await (0, idGenerator_1.generateId)(tx, "USER");
            const user = await tx.user_table.create({
                data: {
                    user_id: userId,
                    username: data.username,
                    password: hashedPassword,
                    role_type: data.role_type,
                    created_by: createdBy,
                    user_status: 0
                }
            });
            if (data.role_type === "DOCTOR") {
                employeeId = await (0, idGenerator_1.generateId)(tx, "DOCTOR");
            }
            else if (data.role_type === "BRANCH_ADMIN") {
                employeeId = await (0, idGenerator_1.generateId)(tx, "BRANCH_ADMIN");
            }
            else {
                employeeId = await (0, idGenerator_1.generateId)(tx, "EMPLOYEE");
            }
            const employee = await tx.employees.create({
                data: {
                    employee_id: employeeId,
                    user_id: user.user_id,
                    branch_id: allowedBranchIds[0],
                    first_name: data.first_name,
                    middle_name: data.middle_name,
                    last_name: data.last_name,
                    email: data.email,
                    mobile_no: data.mobile_no,
                    blood_group: data.blood_group,
                    nationality: data.nationality,
                    marital_status: data.marital_status,
                    aadhaar_no: data.aadhaar_no,
                    pan_no: data.pan_no,
                    gender: data.gender,
                    dob: data.dob,
                    passport_no: data.passport_no,
                    parmanent_address: data.permanent_address,
                    current_address: data.current_address,
                    emergency_contact_name: data.emergency_contact_name,
                    emergency_contact_relationship: data.emergency_contact_relationship,
                    emergency_contact_number: data.emergency_contact_number,
                    department_id: data.department_id,
                    designation: data.designation,
                    joining_date: new Date(data.joining_date),
                    specialization: data.specialization,
                    qualification: data.qualification,
                    permanent_employee_state: data.permanent_employee_state,
                    permanent_employee_district: data.permanent_employee_district,
                    permanent_employee_area: data.permanent_employee_area,
                    permanent_employee_pincode: data.permanent_employee_pincode,
                    license_no: data.license_no,
                    emp_status: true,
                    employee_photo_URL: data.employee_photo_URL,
                    employee_state: data.employee_state,
                    employee_district: data.employee_district,
                    employee_area: data.employee_area,
                    employee_pincode: data.employee_pincode,
                    employee_no_experence: data.employee_no_experence
                }
            });
            for (const branchId of allowedBranchIds) {
                await tx.user_branch_mapping.create({
                    data: {
                        user_id: user.user_id,
                        branch_id: branchId,
                        employee_id: employeeId,
                        status: 1
                    }
                });
            }
            if (data.role_type === "DOCTOR") {
                await tx.doctor_profile.create({
                    data: {
                        employee_id: employee.employee_id,
                        consultation_minutes: data.consultation_minutes ?? 20,
                        doctor_bio: data.doctor_bio
                    }
                });
            }
            for (const schedule of data.working_hours ?? []) {
                await tx.doctor_schedule.create({
                    data: {
                        employee_id: employee.employee_id,
                        branch_id: schedule.branch_id,
                        day_of_week: schedule.day_of_week,
                        shift_name: schedule.shift_name,
                        start_time: timeStringToUtcDate(schedule.start_time),
                        end_time: timeStringToUtcDate(schedule.end_time),
                        consultation_minutes: data.consultation_minutes ?? 20,
                        is_active: true
                    }
                });
            }
            return {
                user: {
                    user_username: user.username,
                    user_id: user.user_id,
                    role_type: user.role_type,
                    user_status: user.user_status,
                },
                employee: {
                    employee_id: employee.employee_id,
                    first_name: employee.first_name,
                    middle_name: employee.middle_name,
                    license_no: employee.license_no
                }
            };
        });
    }
    async updateEmployee(employeeId, data, updatedBy) {
        // Get caller's role to enforce field-level permissions
        const caller = await prisma_1.default.user_table.findUnique({
            where: { user_id: updatedBy },
            select: { role_type: true }
        });
        const callerRole = caller?.role_type?.toUpperCase() ?? "";
        const isTopLevelAdmin = roles_1.TOP_LEVEL_ADMIN_ROLES.some(r => r === callerRole);
        const isBranchAdmin = callerRole === roles_1.BRANCH_ADMIN;
        const isStaffAdmin = callerRole === roles_1.ADMIN;
        const employee = await repository.findEmployeeById(employeeId);
        if (!employee) {
            throw new Error("Employee not found");
        }
        // STAFF_ADMIN field-level restrictions: read-only fields
        if (isStaffAdmin) {
            const restrictedFields = [
                'role_type', 'branch_ids', 'password', 'user_status',
                'username', 'employee_id', 'user_id'
            ];
            for (const field of restrictedFields) {
                if (data[field] !== undefined) {
                    throw new Error(`Staff Admin cannot modify ${field}`);
                }
            }
        }
        // BRANCH_ADMIN cannot change role to BRANCH_ADMIN or DOCTOR
        if (isBranchAdmin && data.role_type) {
            const targetRole = data.role_type.toUpperCase();
            if (targetRole === roles_1.BRANCH_ADMIN || targetRole === "DOCTOR") {
                throw new Error("Branch Admin cannot assign Branch Admin or Doctor roles");
            }
        }
        // A doctor's branch is tied to their doctor_schedule/user_branch_mapping
        // rows, which future appointments point at. Changing it here would hit
        // the destructive deleteMany/create block below and silently orphan any
        // future appointment still on the old schedule. Branch changes for a
        // doctor must go through the transfer workflow instead, which checks for
        // future appointments and closes old rows rather than deleting them.
        if (employee.user_table?.role_type === "DOCTOR" && data.branch_ids) {
            const activeMappings = await prisma_1.default.user_branch_mapping.findMany({
                where: { employee_id: employeeId, status: 1 },
                select: { branch_id: true },
            });
            const currentBranchIds = activeMappings.map((mapping) => mapping.branch_id);
            const requestedBranchIds = data.branch_ids ?? [];
            const isBranchChange = requestedBranchIds.some((id) => !currentBranchIds.includes(id)) ||
                currentBranchIds.some((id) => !requestedBranchIds.includes(id));
            if (isBranchChange) {
                throw new Error("Doctor branch changes must go through POST /api/doctors/:employeeId/transfer to preserve appointment history");
            }
        }
        if (data.department_id) {
            const department = await repository.findDepartment(data.department_id);
            if (!department) {
                throw new Error("Department not found");
            }
        }
        if (data.username && employee.user_id) {
            const existingUsername = await repository.findUsername(data.username);
            if (existingUsername && existingUsername.user_id !== employee.user_id) {
                throw new Error("Username already exists");
            }
        }
        const hashedPassword = data.password
            ? await bcrypt_1.default.hash(data.password, Number(process.env.BCRYPT_SALT_ROUNDS))
            : undefined;
        // Login credentials + active/inactive status live on user_table, not
        // employees — only touch it when the caller actually changed one of these.
        const userUpdateData = {};
        if (data.username)
            userUpdateData.username = data.username;
        if (hashedPassword)
            userUpdateData.password = hashedPassword;
        if (data.emp_status !== undefined)
            userUpdateData.user_status = data.emp_status ? 0 : 1;
        // A Branch Admin's branch_id/mapping is left untouched by active/inactive
        // status changes, same as every other role (Staff Admin included) —
        // deactivating them doesn't release or otherwise affect their branch.
        const employeeUpdateData = {
            first_name: data.first_name,
            middle_name: data.middle_name,
            last_name: data.last_name,
            email: data.email,
            emp_gender: data.gender,
            emp_DOB: data.dob,
            gender: data.gender,
            dob: data.dob,
            mobile_no: data.mobile_no,
            blood_group: data.blood_group,
            nationality: data.nationality,
            marital_status: data.marital_status,
            aadhaar_no: data.aadhaar_no,
            pan_no: data.pan_no,
            age: data.age,
            passport_no: data.passport_no,
            parmanent_address: data.permanent_address,
            current_address: data.current_address,
            emergency_contact_name: data.emergency_contact_name,
            emergency_contact_relationship: data.emergency_contact_relationship,
            emergency_contact_number: data.emergency_contact_number,
            department_id: data.department_id,
            designation: data.designation,
            joining_date: data.joining_date ? new Date(data.joining_date) : undefined,
            emp_status: data.emp_status,
            employee_photo_URL: data.employee_photo_URL,
            employee_state: data.employee_state,
            employee_district: data.employee_district,
            employee_area: data.employee_area,
            employee_pincode: data.employee_pincode,
            employee_no_experence: data.employee_no_experence,
            specialization: data.specialization,
            qualification: data.qualification,
            license_no: data.license_no,
            permanent_employee_state: data.permanent_employee_state,
            permanent_employee_district: data.permanent_employee_district,
            permanent_employee_area: data.permanent_employee_area,
            permanent_employee_pincode: data.permanent_employee_pincode,
        };
        const hasUserUpdate = Object.keys(userUpdateData).length > 0 && !!employee.user_id;
        const isDoctor = data.role_type === "DOCTOR" || employee.user_table?.role_type === "DOCTOR";
        const userId = employee.user_id ?? employee.user_table?.user_id;
        const updatedEmployee = await prisma_1.default.$transaction(async (tx) => {
            const result = await tx.employees.update({
                where: { employee_id: employeeId },
                data: employeeUpdateData,
            });
            if (hasUserUpdate && userId) {
                await tx.user_table.update({
                    where: { user_id: userId },
                    data: userUpdateData,
                });
            }
            if (data.branch_ids) {
                await tx.user_branch_mapping.deleteMany({
                    where: {
                        user_id: userId,
                    },
                });
                for (const branchId of data.branch_ids) {
                    await tx.user_branch_mapping.create({
                        data: {
                            user_id: userId,
                            branch_id: branchId,
                            employee_id: employeeId,
                            status: 1,
                        },
                    });
                }
                // employees.branch_id is a denormalized copy of the single-branch
                // roles' real assignment (user_branch_mapping is authoritative) -
                // it's read directly by the Staff/Doctor branch column and by
                // login's buildAuthPayload, so it must never be left to drift
                // from the mapping just rewritten above. Doctors are the one
                // genuinely multi-branch role, where a single branch_id can't
                // represent "their branch" - leave that column alone for them.
                if (!isDoctor) {
                    await tx.employees.update({
                        where: { employee_id: employeeId },
                        data: { branch_id: data.branch_ids[0] ?? null },
                    });
                }
            }
            if (isDoctor) {
                await tx.doctor_profile.upsert({
                    where: {
                        employee_id: employeeId,
                    },
                    update: {
                        consultation_minutes: data.consultation_minutes ?? 20,
                        ...(data.doctor_bio !== undefined && { doctor_bio: data.doctor_bio }),
                    },
                    create: {
                        employee_id: employeeId,
                        consultation_minutes: data.consultation_minutes ?? 20,
                        doctor_bio: data.doctor_bio,
                    },
                });
            }
            if (data.working_hours) {
                // appointment_history.schedule_id and encounter.schedule_id both
                // have a real FK (onDelete: NoAction) into doctor_schedule -
                // deleting a slot that already has a booked appointment/encounter
                // against it 500s with a foreign key violation. Keep whichever
                // rows are still referenced instead of deleting everything, and
                // replace only the rest - same end result for every slot that
                // has no bookings, but never crashes for one that does.
                const existingSchedules = await tx.doctor_schedule.findMany({
                    where: { employee_id: employeeId },
                    select: { schedule_id: true },
                });
                const existingIds = existingSchedules.map((s) => s.schedule_id);
                const [referencedByAppointment, referencedByEncounter] = existingIds.length
                    ? await Promise.all([
                        tx.appointment_history.findMany({
                            where: { schedule_id: { in: existingIds } },
                            select: { schedule_id: true },
                            distinct: ["schedule_id"],
                        }),
                        tx.encounter.findMany({
                            where: { schedule_id: { in: existingIds } },
                            select: { schedule_id: true },
                            distinct: ["schedule_id"],
                        }),
                    ])
                    : [[], []];
                const protectedIds = [
                    ...referencedByAppointment.map((r) => r.schedule_id),
                    ...referencedByEncounter.map((r) => r.schedule_id),
                ];
                await tx.doctor_schedule.deleteMany({
                    where: {
                        employee_id: employeeId,
                        schedule_id: { notIn: protectedIds },
                    },
                });
                for (const schedule of data.working_hours) {
                    await tx.doctor_schedule.create({
                        data: {
                            employee_id: employeeId,
                            branch_id: schedule.branch_id,
                            day_of_week: schedule.day_of_week,
                            shift_name: schedule.shift_name,
                            start_time: timeStringToUtcDate(schedule.start_time),
                            end_time: timeStringToUtcDate(schedule.end_time),
                            consultation_minutes: data.consultation_minutes ?? 20,
                            is_active: true,
                        },
                    });
                }
            }
            return {
                employee_id: result.employee_id,
                first_name: result.first_name,
                middle_name: result.middle_name,
                last_name: result.last_name,
                email: result.email,
            };
        });
        return updatedEmployee;
    }
    async getAllEmployees() {
        return repository.getAllEmployees();
    }
    async softDeleteEmployee(employeeId, actingUserId = "SYSTEM") {
        const employee = await repository.findEmployeeById(employeeId);
        if (!employee) {
            throw new Error("Employee not found");
        }
        let affectedAppointments = 0;
        await prisma_1.default.$transaction(async (tx) => {
            // 1. Soft-delete: flag the row so it disappears from every list
            // (getEmployees now excludes deleted_at by default).
            await repository.softDeleteEmployee(tx, employeeId);
            // 2. Block login at the user_table level too (belt-and-braces next
            // to the auth.service emp_status check).
            await repository.blockUserLogin(tx, employee.user_id);
            // 3. Release every branch assignment (branch_id + user_branch_mapping).
            await repository.deleteUserBranchMappings(tx, employee.user_id);
            // 4. Close all of the doctor's schedule rows so no slots can be
            // picked up by availability queries.
            await repository.closeAllActiveSchedules(tx, employeeId, new Date());
            // 5. Future appointments are NOT cancelled - they are flagged
            // RESCHEDULE_REQUIRED, unlinked from the doctor and queued so an
            // admin can reassign them later (via the edit appointment form or
            // the reschedule queue).
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const futureAppointments = await repository.findFutureAppointmentsTx(tx, employeeId, today);
            affectedAppointments = futureAppointments.length;
            for (const appointment of futureAppointments) {
                await repository.requeueAppointment(tx, {
                    appointment_id: appointment.appointment_id,
                    old_employee_id: employeeId,
                    patient_id: appointment.patient_id,
                    branch_id: appointment.branch_id,
                    department_id: appointment.department_id,
                    old_schedule_id: appointment.schedule_id,
                    old_appointment_date: appointment.appointment_date,
                    old_appointment_time: appointment.appointment_time,
                    reason: "Doctor deactivated",
                    created_by: actingUserId
                });
            }
        });
        return {
            message: "Employee deactivated successfully",
            affected_appointments: affectedAppointments
        };
    }
    async getEmployees(query) {
        return repository.getEmployees(query);
    }
    async updateEmployeePhoto(employeeId, employee_photo_URL) {
        return repository.updateEmployeePhoto(employeeId, employee_photo_URL);
    }
    async getEmployeeById(employeeId) {
        return repository.getEmployeeById(employeeId);
    }
}
exports.EmployeeService = EmployeeService;
