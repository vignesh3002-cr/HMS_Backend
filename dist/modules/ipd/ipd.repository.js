"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPDRepository = exports.IpdRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
/**
 * Row-level-security note: ward_master/bed_master/admission carry the
 * branch_id column and read routes use branchScope middleware, so plain
 * prisma reads here are fine. Writes inside create/transfer/discharge go
 * through the provided tx client so row policies + the admission vlog
 * sequence stay consistent within the same transaction.
 */
class IpdRepository {
    // ------------------------------------------------------------------ wards
    async findWardById(wardId) {
        return prisma_1.default.ward_master.findUnique({
            where: { ward_id: wardId },
            include: {
                branch: {
                    select: {
                        branch_id: true,
                        branch_name: true,
                        branch_status: true,
                    },
                },
                bed_master: {
                    where: { active_status: 1 },
                    orderBy: { bed_number: "asc" },
                    select: {
                        bed_id: true,
                        bed_number: true,
                        bed_type: true,
                        status: true,
                        tariff: true,
                        active_status: true,
                    },
                },
            },
        });
    }
    async findWardByBranchAndName(branchId, wardName) {
        return prisma_1.default.ward_master.findFirst({
            where: {
                branch_id: branchId,
                ward_name: { equals: wardName, mode: "insensitive" },
            },
        });
    }
    async findDoctorById(employeeId) {
        return prisma_1.default.employees.findUnique({
            where: { employee_id: employeeId },
            include: {
                user_table: { select: { role_type: true } },
            },
        });
    }
    async findDepartmentById(departmentId) {
        return prisma_1.default.department_master.findUnique({
            where: { department_id: departmentId },
        });
    }
    async listWards(branchId) {
        return prisma_1.default.ward_master.findMany({
            where: {
                ...(branchId ? { branch_id: branchId } : {}),
                active_status: 1,
            },
            orderBy: { ward_name: "asc" },
            include: {
                branch: { select: { branch_id: true, branch_name: true } },
                _count: {
                    select: {
                        bed_master: true,
                        admission: { where: { status: "ADMITTED" } },
                    },
                },
            },
        });
    }
    async createWard(tx, data) {
        return tx.ward_master.create({ data });
    }
    async updateWard(wardId, data) {
        return prisma_1.default.ward_master.update({ where: { ward_id: wardId }, data });
    }
    async deleteWard(wardId) {
        return prisma_1.default.ward_master.update({
            where: { ward_id: wardId },
            data: { active_status: 0 },
        });
    }
    // ------------------------------------------------------------------ beds
    async findBedById(bedId) {
        return prisma_1.default.bed_master.findUnique({
            where: { bed_id: bedId },
            include: {
                ward_master: {
                    select: {
                        ward_id: true,
                        ward_name: true,
                        branch_id: true,
                    },
                },
            },
        });
    }
    async findBedByWardAndNumber(wardId, bedNumber) {
        return prisma_1.default.bed_master.findFirst({
            where: {
                ward_id: wardId,
                bed_number: { equals: bedNumber, mode: "insensitive" },
            },
        });
    }
    async listBeds(wardId, branchId) {
        return prisma_1.default.bed_master.findMany({
            where: {
                ...(wardId ? { ward_id: wardId } : {}),
                ...(branchId ? { branch_id: branchId } : {}),
                active_status: 1,
            },
            orderBy: { bed_number: "asc" },
            include: {
                ward_master: {
                    select: { ward_id: true, ward_name: true, branch_id: true },
                },
            },
        });
    }
    async countAvailableBeds(wardId, tx) {
        const client = tx ?? prisma_1.default;
        const bedCount = await client.bed_master.count({
            where: {
                ward_id: wardId,
                status: "AVAILABLE",
                active_status: 1,
            },
        });
        const admissionCount = await client.admission.count({
            where: {
                ward_id: wardId,
                status: "ADMITTED",
            },
        });
        return Math.max(bedCount - admissionCount, 0);
    }
    async createBed(tx, data) {
        return tx.bed_master.create({ data });
    }
    async updateBed(bedId, data) {
        return prisma_1.default.bed_master.update({ where: { bed_id: bedId }, data });
    }
    async markBedStatus(tx, bedId, status, updatedBy) {
        return tx.bed_master.update({
            where: { bed_id: bedId },
            data: { status, updated_by: updatedBy, updated_at: new Date() },
        });
    }
    async deleteBed(bedId) {
        return prisma_1.default.bed_master.update({
            where: { bed_id: bedId },
            data: { active_status: 0 },
        });
    }
    async countBedsInWard(wardId) {
        return prisma_1.default.bed_master.count({ where: { ward_id: wardId, active_status: 1 } });
    }
    // ------------------------------------------------------------- admission
    async findAdmissionById(admissionId) {
        return prisma_1.default.admission.findUnique({
            where: { admission_id: admissionId },
            include: {
                patient_bio_data: {
                    select: {
                        patient_id: true,
                        patient_first_name: true,
                        patient_middle_name: true,
                        patient_last_name: true,
                        patient_gender: true,
                        patient_primary_mobile: true,
                        patient_dob: true,
                    },
                },
                appointment_history: {
                    select: {
                        appointment_id: true,
                        appointment_date: true,
                        appointment_time: true,
                        reason_for_visit: true,
                    },
                },
                branch: {
                    select: { branch_id: true, branch_name: true },
                },
                department_master: {
                    select: { department_id: true, department_name: true },
                },
                employees: {
                    select: {
                        employee_id: true,
                        first_name: true,
                        middle_name: true,
                        last_name: true,
                        specialization: true,
                    },
                },
                ward_master: {
                    select: { ward_id: true, ward_name: true },
                },
                bed_master: {
                    select: { bed_id: true, bed_number: true, bed_type: true },
                },
                admission_transfer_log: {
                    orderBy: { transferred_at: "desc" },
                },
            },
        });
    }
    async findAdmissionByAppointmentId(appointmentId) {
        return prisma_1.default.admission.findFirst({
            where: { appointment_id: appointmentId },
            include: {
                patient_bio_data: {
                    select: {
                        patient_id: true,
                        patient_first_name: true,
                        patient_middle_name: true,
                        patient_last_name: true,
                        patient_gender: true,
                    },
                },
                branch: { select: { branch_id: true, branch_name: true } },
                ward_master: { select: { ward_id: true, ward_name: true } },
                bed_master: { select: { bed_id: true, bed_number: true } },
                admission_transfer_log: {
                    orderBy: { transferred_at: "desc" },
                },
            },
        });
    }
    async listAdmissions(filter) {
        const { branchId, status, wardId, patientId, date, search, page = 1, limit = 10 } = filter;
        // Status arrives as a single value or a comma-separated list (the IPD
        // filter panel's Status field is a multiselect, same as OPD's).
        const statusList = status
            ? status.split(",").map((s) => s.trim()).filter(Boolean)
            : [];
        // "date" is a yyyy-MM-dd calendar day (IST, same convention as the
        // appointment day-boundary job) -- matches admissions whose
        // admission_date falls on that day.
        const dateStart = date ? new Date(`${date}T00:00:00.000Z`) : undefined;
        const dateEnd = dateStart ? new Date(dateStart.getTime() + 24 * 60 * 60 * 1000) : undefined;
        const sortDirection = filter.sortDirection === "asc" ? "asc" : "desc";
        const sortField = filter.sortField || "admission_date";
        const orderByMap = {
            ip_number: { ip_number: sortDirection },
            admission_date: { admission_date: sortDirection },
            status: { status: sortDirection },
            patient: { patient_bio_data: { patient_first_name: sortDirection } },
            branch: { branch: { branch_name: sortDirection } },
            ward_bed: { ward_master: { ward_name: sortDirection } },
            doctor: { employee_id: sortDirection },
        };
        const orderBy = orderByMap[sortField] || orderByMap.admission_date;
        const where = {
            ...(branchId ? { branch_id: branchId } : {}),
            ...(statusList.length === 1
                ? { status: statusList[0] }
                : statusList.length > 1
                    ? { status: { in: statusList } }
                    : {}),
            ...(wardId ? { ward_id: wardId } : {}),
            ...(patientId ? { patient_id: patientId } : {}),
            ...(dateStart && dateEnd ? { admission_date: { gte: dateStart, lt: dateEnd } } : {}),
            ...(search
                ? {
                    OR: [
                        { ip_number: { contains: search, mode: "insensitive" } },
                        {
                            patient_bio_data: {
                                OR: [
                                    { patient_first_name: { contains: search, mode: "insensitive" } },
                                    { patient_last_name: { contains: search, mode: "insensitive" } },
                                ],
                            },
                        },
                    ],
                }
                : {}),
        };
        const [admissions, total] = await Promise.all([
            prisma_1.default.admission.findMany({
                where,
                include: {
                    patient_bio_data: {
                        select: {
                            patient_id: true,
                            patient_first_name: true,
                            patient_middle_name: true,
                            patient_last_name: true,
                            patient_gender: true,
                            patient_primary_mobile: true,
                            patient_dob: true,
                        },
                    },
                    branch: { select: { branch_id: true, branch_name: true } },
                    department_master: {
                        select: { department_id: true, department_name: true },
                    },
                    employees: {
                        select: {
                            employee_id: true,
                            first_name: true,
                            last_name: true,
                        },
                    },
                    ward_master: { select: { ward_id: true, ward_name: true } },
                    bed_master: { select: { bed_id: true, bed_number: true } },
                },
                orderBy,
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma_1.default.admission.count({ where }),
        ]);
        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            admissions,
        };
    }
    async createAdmission(tx, data) {
        return tx.admission.create({ data });
    }
    async lockBedForAdmission(tx, bedId) {
        /*
         * Row-level lock on the bed row so two concurrent admit requests
         * cannot both read AVAILABLE and double-assign the same bed.
         */
        return tx.$queryRawUnsafe(`SELECT bed_id, status FROM public.bed_master WHERE bed_id = $1 FOR UPDATE`, bedId);
    }
    async updateAdmission(admissionId, data) {
        return prisma_1.default.admission.update({ where: { admission_id: admissionId }, data });
    }
    async updateAdmissionTx(tx, admissionId, data) {
        return tx.admission.update({ where: { admission_id: admissionId }, data });
    }
    async generateId(tx, entity) {
        return (0, idGenerator_1.generateId)(tx, entity);
    }
    // ------------------------------------------------- transfer / discharge
    async createTransferLog(tx, data) {
        return tx.admission_transfer_log.create({ data });
    }
    async updateEncounterDischarge(tx, encounterNo, dischargeDate) {
        return tx.encounter.update({
            where: { encounter_no: encounterNo },
            data: { status: "CLOSED", closed_at: dischargeDate, checkout_time: dischargeDate },
        });
    }
    async updateAppointmentCompleted(tx, appointmentId) {
        return tx.appointment_history.update({
            where: { appointment_id: appointmentId },
            data: { status: "COMPLETED" },
        });
    }
    async generateAdmissionId(tx) {
        return (0, idGenerator_1.generateId)(tx, "ADMISSION");
    }
    async getAdmissionByIpNumber(ipNumber) {
        return prisma_1.default.admission.findFirst({
            where: {
                OR: [
                    { ip_number: ipNumber },
                    { admission_id: ipNumber }
                ]
            },
            include: {
                patient_bio_data: {
                    select: {
                        patient_id: true,
                        patient_first_name: true,
                        patient_middle_name: true,
                        patient_last_name: true,
                        patient_gender: true,
                        patient_primary_mobile: true,
                        patient_dob: true,
                    },
                },
                appointment_history: {
                    select: {
                        appointment_id: true,
                        appointment_date: true,
                        appointment_time: true,
                        reason_for_visit: true,
                    },
                },
                branch: {
                    select: { branch_id: true, branch_name: true },
                },
                department_master: {
                    select: { department_id: true, department_name: true },
                },
                employees: {
                    select: {
                        employee_id: true,
                        first_name: true,
                        middle_name: true,
                        last_name: true,
                        specialization: true,
                    },
                },
                ward_master: {
                    select: { ward_id: true, ward_name: true },
                },
                bed_master: {
                    select: { bed_id: true, bed_number: true, bed_type: true },
                },
                admission_transfer_log: {
                    orderBy: { transferred_at: "desc" },
                },
            },
        });
    }
}
exports.IpdRepository = IpdRepository;
exports.IPDRepository = IpdRepository;
