"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpdService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const ipd_repository_1 = require("./ipd.repository");
const ipd_types_1 = require("./ipd.types");
const ipd_constants_1 = require("./ipd.constants");
class IpdService {
    ipdRepository;
    constructor(ipdRepository = new ipd_repository_1.IpdRepository()) {
        this.ipdRepository = ipdRepository;
    }
    async validateAdmissionContext(data) {
        const { branchId, departmentId, employeeId, wardId, bedId } = data;
        if (departmentId) {
            const department = await this.ipdRepository.findDepartmentById(departmentId);
            if (!department) {
                throw new Error("Department not found");
            }
        }
        else {
            throw new Error("Department is required");
        }
        if (employeeId) {
            const doctor = await this.ipdRepository.findDoctorById(employeeId);
            if (!doctor) {
                throw new Error("Doctor not found");
            }
            if (doctor.user_table?.role_type !== "DOCTOR") {
                throw new Error("Selected employee is not a doctor");
            }
            if (doctor.emp_status !== true) {
                throw new Error("Doctor is inactive");
            }
            const mapping = await prisma_1.default.user_branch_mapping.findFirst({
                where: {
                    employee_id: employeeId,
                    branch_id: branchId,
                    status: 1,
                },
            });
            if (!mapping) {
                throw new Error("Doctor is not assigned to the selected branch");
            }
        }
        else {
            throw new Error("Attending doctor is required");
        }
        if (wardId) {
            const ward = await this.ipdRepository.findWardById(wardId);
            if (!ward) {
                throw new Error("Ward not found");
            }
            if (ward.branch_id !== branchId) {
                throw new Error("Ward does not belong to the selected branch");
            }
        }
        if (bedId) {
            const bed = await this.ipdRepository.findBedById(bedId);
            if (!bed) {
                throw new Error("Bed not found");
            }
            if (bed.branch_id !== branchId) {
                throw new Error("Selected bed does not belong to the selected branch");
            }
            if (wardId && bed.ward_id !== wardId) {
                throw new Error("Selected bed does not belong to the chosen ward");
            }
        }
    }
    async createAdmission(data, createdBy) {
        const cleanId = (val) => {
            if (val === null || val === undefined)
                return null;
            const str = String(val).trim();
            return str.length > 0 ? str : null;
        };
        const patientId = cleanId(data.patient_id);
        if (!patientId) {
            throw new Error("Patient is required");
        }
        const branchId = cleanId(data.branch_id);
        if (!branchId) {
            throw new Error("Branch is required");
        }
        const wardId = cleanId(data.ward_id);
        const bedId = cleanId(data.bed_id);
        const appointmentId = cleanId(data.appointment_id);
        const departmentId = cleanId(data.department_id);
        const employeeId = cleanId(data.employee_id);
        const encounterNo = cleanId(data.encounter_no);
        const status = data.status && ipd_constants_1.IPD_STATUS_VALUES.includes(data.status)
            ? data.status
            : ipd_types_1.IPD_STATUS.ADMITTED;
        const patient = await prisma_1.default.patient_bio_data.findUnique({
            where: { patient_id: patientId },
        });
        if (!patient) {
            throw new Error("Patient not found");
        }
        if (patient.patient_active !== "Active") {
            throw new Error("Patient is inactive");
        }
        const branch = await prisma_1.default.branch.findUnique({
            where: { branch_id: branchId },
        });
        if (!branch) {
            throw new Error("Branch not found");
        }
        if (branch.branch_status !== "Active") {
            throw new Error("Branch is inactive");
        }
        await this.validateAdmissionContext({
            branchId,
            departmentId,
            employeeId,
            wardId,
            bedId,
        });
        if (status === ipd_types_1.IPD_STATUS.ADMITTED) {
            if (!wardId) {
                throw new Error("Ward is required for admission");
            }
            if (!bedId) {
                throw new Error("Bed is required for admission");
            }
            const preBed = await this.ipdRepository.findBedById(bedId);
            if (preBed && preBed.status !== ipd_types_1.BED_STATUS.AVAILABLE) {
                throw new Error("Selected bed is not available");
            }
            const existingAdmission = await prisma_1.default.admission.findFirst({
                where: {
                    patient_id: patientId,
                    status: ipd_types_1.IPD_STATUS.ADMITTED,
                },
            });
            if (existingAdmission) {
                throw new Error(`Patient is already admitted with IP Number ${existingAdmission.ip_number}`);
            }
        }
        return await prisma_1.default.$transaction(async (tx) => {
            /*
             * Authoritative availability check under a row-level lock so two
             * concurrent admit requests cannot both assign the same bed.
             */
            if (status === ipd_types_1.IPD_STATUS.ADMITTED && bedId) {
                const locked = await this.ipdRepository.lockBedForAdmission(tx, bedId);
                if (!locked?.[0] || locked[0].status !== ipd_types_1.BED_STATUS.AVAILABLE) {
                    throw new Error("Selected bed is not available");
                }
                const heldBy = await tx.admission.findFirst({
                    where: {
                        bed_id: bedId,
                        status: ipd_types_1.IPD_STATUS.ADMITTED,
                    },
                });
                if (heldBy) {
                    throw new Error(`Bed is already occupied by IP ${heldBy.ip_number}`);
                }
            }
            const ipNumber = await this.ipdRepository.generateAdmissionId(tx);
            const admissionId = ipNumber;
            const admission = await this.ipdRepository.createAdmission(tx, {
                admission_id: admissionId,
                ip_number: ipNumber,
                patient_id: patientId,
                appointment_id: appointmentId ?? undefined,
                encounter_no: encounterNo ?? undefined,
                branch_id: branchId,
                department_id: departmentId ?? undefined,
                employee_id: employeeId ?? undefined,
                admission_type: data.admission_type || (data.is_daycare ? ipd_constants_1.ADMISSION_TYPE.DAYCARE : ipd_constants_1.ADMISSION_TYPE.REGULAR),
                provisional_diagnosis: data.provisional_diagnosis?.trim() || undefined,
                ward_id: wardId ?? undefined,
                bed_id: bedId ?? undefined,
                is_daycare: data.is_daycare ?? false,
                payment_mode: data.payment_mode?.trim() || undefined,
                insurance_provider: data.insurance_provider?.trim() || undefined,
                insurance_policy_no: data.insurance_policy_no?.trim() || undefined,
                expected_stay_days: data.expected_stay_days !== undefined
                    ? Number(data.expected_stay_days)
                    : undefined,
                advance_amount: data.advance_amount !== undefined
                    ? Number(data.advance_amount)
                    : undefined,
                admission_date: data.admission_date
                    ? new Date(data.admission_date)
                    : undefined,
                status,
                created_by: createdBy,
            });
            if (status === ipd_types_1.IPD_STATUS.ADMITTED && bedId) {
                await this.ipdRepository.markBedStatus(tx, bedId, ipd_types_1.BED_STATUS.OCCUPIED, createdBy);
            }
            return admission;
        });
    }
    async listAdmissions(filter) {
        const page = filter.page ? parseInt(String(filter.page), 10) : 1;
        const limit = filter.limit ? parseInt(String(filter.limit), 10) : 10;
        return this.ipdRepository.listAdmissions({
            branchId: filter.branchId,
            status: filter.status,
            wardId: filter.wardId,
            patientId: filter.patientId,
            date: filter.date,
            search: filter.search,
            page: Number.isFinite(page) ? page : 1,
            limit: Number.isFinite(limit) ? limit : 10,
            sortField: filter.sortField,
            sortDirection: filter.sortDirection,
        });
    }
    async getAdmissionByIpNumber(ipNumber) {
        let admission = await this.ipdRepository.getAdmissionByIpNumber(ipNumber);
        if (!admission) {
            admission = await this.ipdRepository.findAdmissionById(ipNumber);
        }
        if (!admission) {
            throw new Error("Admission not found");
        }
        return admission;
    }
    async updateAdmission(id, data, updatedBy) {
        const existing = await this.getAdmissionByIpNumber(id);
        if (!existing) {
            throw new Error("Admission not found");
        }
        const cleanId = (val) => (val && String(val).trim().length > 0 ? String(val).trim() : null);
        const status = data.status && ipd_constants_1.IPD_STATUS_VALUES.includes(data.status)
            ? data.status
            : existing.status;
        const wardId = data.ward_id !== undefined ? cleanId(data.ward_id) : cleanId(existing.ward_id);
        const bedId = data.bed_id !== undefined ? cleanId(data.bed_id) : cleanId(existing.bed_id);
        const departmentId = data.department_id !== undefined ? cleanId(data.department_id) : cleanId(existing.department_id);
        const employeeId = data.employee_id !== undefined ? cleanId(data.employee_id) : cleanId(existing.employee_id);
        if (existing.status === ipd_types_1.IPD_STATUS.ADMITTED &&
            (wardId !== cleanId(existing.ward_id) || bedId !== cleanId(existing.bed_id))) {
            throw new Error("Use transfer to move an admitted patient to another ward or bed");
        }
        if (departmentId !== cleanId(existing.department_id) || employeeId !== cleanId(existing.employee_id)) {
            await this.validateAdmissionContext({
                branchId: existing.branch_id,
                departmentId,
                employeeId,
            });
        }
        if (status === ipd_types_1.IPD_STATUS.ADMITTED) {
            if (!wardId) {
                throw new Error("Ward is required for admission");
            }
            if (!bedId) {
                throw new Error("Bed is required for admission");
            }
            await this.validateAdmissionContext({
                branchId: existing.branch_id,
                departmentId,
                employeeId,
                wardId,
                bedId,
            });
            const bed = await this.ipdRepository.findBedById(bedId);
            if (bed && bedId !== cleanId(existing.bed_id) && bed.status !== ipd_types_1.BED_STATUS.AVAILABLE) {
                throw new Error("Selected bed is not available");
            }
        }
        else if (wardId || bedId) {
            await this.validateAdmissionContext({
                branchId: existing.branch_id,
                departmentId,
                employeeId,
                wardId,
                bedId,
            });
        }
        const updateData = {
            ...data,
            updated_by: updatedBy ?? data.updated_by,
        };
        updateData.ward_id = wardId ?? undefined;
        updateData.bed_id = bedId ?? undefined;
        if (data.department_id !== undefined) {
            updateData.department_id = departmentId ?? undefined;
        }
        if (data.employee_id !== undefined) {
            updateData.employee_id = employeeId ?? undefined;
        }
        if (data.admission_date !== undefined) {
            updateData.admission_date = new Date(data.admission_date);
        }
        updateData.status = status;
        const needsBedOccupancy = status === ipd_types_1.IPD_STATUS.ADMITTED &&
            bedId &&
            (bedId !== cleanId(existing.bed_id) || existing.status !== ipd_types_1.IPD_STATUS.ADMITTED);
        return await prisma_1.default.$transaction(async (tx) => {
            if (needsBedOccupancy) {
                const locked = await this.ipdRepository.lockBedForAdmission(tx, bedId);
                if (!locked?.[0] || locked[0].status !== ipd_types_1.BED_STATUS.AVAILABLE) {
                    throw new Error("Selected bed is not available");
                }
                const heldBy = await tx.admission.findFirst({
                    where: {
                        bed_id: bedId,
                        status: ipd_types_1.IPD_STATUS.ADMITTED,
                        admission_id: { not: existing.admission_id },
                    },
                });
                if (heldBy) {
                    throw new Error(`Bed is already occupied by IP ${heldBy.ip_number}`);
                }
            }
            const updated = await this.ipdRepository.updateAdmissionTx(tx, existing.admission_id, updateData);
            if (needsBedOccupancy) {
                await this.ipdRepository.markBedStatus(tx, bedId, ipd_types_1.BED_STATUS.OCCUPIED, updatedBy);
            }
            return updated;
        });
    }
    async dischargeAdmission(id, closedBy, data) {
        const existing = await this.getAdmissionByIpNumber(id);
        if (!existing) {
            throw new Error("Admission not found");
        }
        if (existing.status !== ipd_types_1.IPD_STATUS.ADMITTED) {
            throw new Error("Admission is not currently active");
        }
        const dischargeDate = data?.discharge_date
            ? new Date(data.discharge_date)
            : new Date();
        return await prisma_1.default.$transaction(async (tx) => {
            const updated = await this.ipdRepository.updateAdmissionTx(tx, existing.admission_id, {
                status: ipd_types_1.IPD_STATUS.DISCHARGED,
                discharge_date: dischargeDate,
                discharge_type: data?.discharge_type,
                discharge_summary: data?.discharge_summary,
                updated_by: closedBy,
            });
            if (existing.bed_id) {
                await this.ipdRepository.markBedStatus(tx, existing.bed_id, ipd_types_1.BED_STATUS.AVAILABLE, closedBy);
            }
            if (existing.encounter_no) {
                await this.ipdRepository.updateEncounterDischarge(tx, existing.encounter_no, dischargeDate);
            }
            if (existing.appointment_id) {
                await this.ipdRepository.updateAppointmentCompleted(tx, existing.appointment_id);
            }
            return updated;
        });
    }
    async transferAdmission(id, targetWardId, targetBedId, reason, transferredBy) {
        const existing = await this.getAdmissionByIpNumber(id);
        if (!existing) {
            throw new Error("Admission not found");
        }
        if (existing.status !== ipd_types_1.IPD_STATUS.ADMITTED) {
            throw new Error("Cannot transfer a patient who is not currently admitted");
        }
        const targetWard = await this.ipdRepository.findWardById(targetWardId);
        if (!targetWard) {
            throw new Error("Target ward not found");
        }
        const targetBed = await this.ipdRepository.findBedById(targetBedId);
        if (!targetBed) {
            throw new Error("Target bed not found");
        }
        if (targetBed.status !== ipd_types_1.BED_STATUS.AVAILABLE) {
            throw new Error("Target bed is not available");
        }
        return await prisma_1.default.$transaction(async (tx) => {
            const locked = await this.ipdRepository.lockBedForAdmission(tx, targetBedId);
            if (!locked?.[0] || locked[0].status !== ipd_types_1.BED_STATUS.AVAILABLE) {
                throw new Error("Target bed is not available");
            }
            const heldBy = await tx.admission.findFirst({
                where: {
                    bed_id: targetBedId,
                    status: ipd_types_1.IPD_STATUS.ADMITTED,
                    admission_id: { not: existing.admission_id },
                },
            });
            if (heldBy) {
                throw new Error(`Target bed is already occupied by IP ${heldBy.ip_number}`);
            }
            if (existing.bed_id) {
                await this.ipdRepository.markBedStatus(tx, existing.bed_id, ipd_types_1.BED_STATUS.AVAILABLE, transferredBy);
            }
            await this.ipdRepository.markBedStatus(tx, targetBedId, ipd_types_1.BED_STATUS.OCCUPIED, transferredBy);
            const transferLogId = await this.ipdRepository.generateId(tx, "ADMISSION_TRANSFER");
            await this.ipdRepository.createTransferLog(tx, {
                transfer_log_id: transferLogId,
                admission_id: existing.admission_id,
                from_ward_id: existing.ward_id ?? undefined,
                from_bed_id: existing.bed_id ?? undefined,
                to_ward_id: targetWardId,
                to_bed_id: targetBedId,
                reason: reason,
                transferred_by: transferredBy,
            });
            return await this.ipdRepository.updateAdmissionTx(tx, existing.admission_id, {
                ward_id: targetWardId,
                bed_id: targetBedId,
                updated_by: transferredBy,
            });
        });
    }
    async getAdmittedPatientsToday(branchId) {
        const today = new Date().toISOString().slice(0, 10);
        const todayDate = new Date(`${today}T00:00:00.000Z`);
        return prisma_1.default.admission.count({
            where: {
                ...(branchId ? { branch_id: branchId } : {}),
                admission_date: {
                    gte: todayDate,
                },
                status: ipd_types_1.IPD_STATUS.ADMITTED,
            },
        });
    }
    async getIpdOverview(branchId) {
        const [totalPatients, bedsOccupied, totalBeds] = await Promise.all([
            prisma_1.default.admission.count({
                where: {
                    ...(branchId ? { branch_id: branchId } : {}),
                    status: ipd_types_1.IPD_STATUS.ADMITTED,
                },
            }),
            prisma_1.default.bed_master.count({
                where: {
                    ...(branchId ? { branch_id: branchId } : {}),
                    active_status: 1,
                    status: "OCCUPIED",
                },
            }),
            prisma_1.default.bed_master.count({
                where: {
                    ...(branchId ? { branch_id: branchId } : {}),
                    active_status: 1,
                },
            }),
        ]);
        return { totalPatients, bedsOccupied, totalBeds };
    }
    async listWards(branchId) {
        return this.ipdRepository.listWards(branchId);
    }
    async listBeds(wardId, branchId) {
        return this.ipdRepository.listBeds(wardId, branchId);
    }
    async createWard(data, user) {
        const existing = await this.ipdRepository.findWardByBranchAndName(data.branch_id, data.ward_name);
        if (existing) {
            throw new Error(`Ward '${data.ward_name}' already exists in this branch`);
        }
        return prisma_1.default.$transaction(async (tx) => {
            const ward_id = await (0, idGenerator_1.generateId)(tx, "WARD");
            return this.ipdRepository.createWard(tx, {
                ward_id,
                branch_id: data.branch_id,
                ward_name: data.ward_name,
                ward_type: data.ward_type || "GENERAL",
                floor: data.floor,
                total_beds: data.total_beds ?? 0,
                tariff: data.tariff,
                active_status: 1,
                created_by: user?.user_id || "SYSTEM",
            });
        });
    }
    async createBed(data, user) {
        const ward = await this.ipdRepository.findWardById(data.ward_id);
        if (!ward) {
            throw new Error("Ward not found");
        }
        const branch_id = data.branch_id || ward.branch_id;
        const existingBed = await this.ipdRepository.findBedByWardAndNumber(data.ward_id, data.bed_number);
        if (existingBed) {
            throw new Error(`Bed '${data.bed_number}' already exists in this ward`);
        }
        return prisma_1.default.$transaction(async (tx) => {
            const bed_id = await (0, idGenerator_1.generateId)(tx, "BED");
            const bed = await this.ipdRepository.createBed(tx, {
                bed_id,
                ward_id: data.ward_id,
                branch_id,
                bed_number: data.bed_number,
                bed_type: data.bed_type || "STANDARD",
                tariff: data.tariff ?? (ward.tariff ? Number(ward.tariff) : undefined),
                status: data.status || "AVAILABLE",
                active_status: 1,
                created_by: user?.user_id || "SYSTEM",
            });
            // Increment ward total_beds
            await tx.ward_master.update({
                where: { ward_id: data.ward_id },
                data: {
                    total_beds: { increment: 1 },
                    updated_at: new Date(),
                },
            });
            return bed;
        });
    }
}
exports.IpdService = IpdService;
