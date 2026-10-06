"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpdService = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const roles_1 = require("../../permissions/roles");
const encounter_repository_1 = require("../encounter/encounter.repository");
const encounter_constants_1 = require("../encounter/encounter.constants");
const ipd_repository_1 = require("./ipd.repository");
const ipd_types_1 = require("./ipd.types");
const ipd_constants_1 = require("./ipd.constants");
const encounterRepository = new encounter_repository_1.EncounterRepository();
const httpError = (message, status) => {
    const err = new Error(message);
    err.status = status;
    return err;
};
const DAY_MS = 24 * 60 * 60 * 1000;
/** yyyy-MM-dd of the given instant in IST. */
const istDateString = (at) => new Date(at.getTime() + ipd_constants_1.IST_OFFSET_MS).toISOString().slice(0, 10);
/** The UTC instant at which an IST calendar day (yyyy-MM-dd) begins. */
const startOfIstDay = (istDate) => new Date(Date.parse(`${istDate}T00:00:00.000Z`) - ipd_constants_1.IST_OFFSET_MS);
/** Whole days from IST date `from` to IST date `to` (negative if earlier). */
const istDayDiff = (from, to) => Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS);
class IpdService {
    ipdRepository;
    constructor(ipdRepository = new ipd_repository_1.IpdRepository()) {
        this.ipdRepository = ipdRepository;
    }
    /*
     * Record-level branch isolation for admission writes. branchScope only
     * validates a branch passed in the query/header (and picks one for
     * multi-branch users), so it can't vouch for a branch_id in the body or
     * for the branch of an existing admission -- this checks the record's own
     * branch against the caller's ACTIVE mappings instead.
     */
    async assertBranchAccess(actor, branchId) {
        const isTopLevelAdmin = roles_1.TOP_LEVEL_ADMIN_ROLES.some((r) => r.toLowerCase() === String(actor.role ?? "").toLowerCase());
        if (isTopLevelAdmin) {
            return;
        }
        const mapping = await prisma_1.default.user_branch_mapping.findFirst({
            where: { user_id: actor.user_id, branch_id: branchId, status: 1 },
            select: { branch_id: true },
        });
        if (!mapping) {
            throw httpError("Forbidden. You don't have access to this branch.", 403);
        }
    }
    /*
     * The partial unique indexes on admission (one ADMITTED row per patient,
     * one per bed) are the final guard against double admission; turn their
     * violation into the same message the pre-checks give.
     */
    rethrowAdmissionConflict(error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            // The index name sits in a different meta field depending on the
            // engine/driver adapter, so match on the whole meta payload.
            if (JSON.stringify(error.meta ?? {}).includes("uq_admission_bed_admitted")) {
                throw new Error("Selected bed is not available");
            }
            throw new Error("Patient is already admitted");
        }
        throw error;
    }
    /*
     * Opens the IPD encounter inside the caller's admit transaction, so a
     * patient can never end up ADMITTED (bed occupied) without an encounter.
     */
    async openIpEncounter(tx, admission, employeeId, createdBy) {
        const encounterNo = await encounterRepository.generateEncounterNumber(tx);
        await encounterRepository.createEncounter(tx, {
            createdBy,
            encounter_no: encounterNo,
            patient_id: admission.patient_id,
            branch_id: admission.branch_id,
            department_id: admission.department_id,
            employee_id: employeeId,
            encounter_type: encounter_constants_1.ENCOUNTER_TYPE_IPD,
            status: encounter_constants_1.ENCOUNTER_STATUS.OPEN,
        });
        return encounterNo;
    }
    /*
     * Authoritative "one active admission per patient" check, run under the
     * patient row lock so concurrent admits are serialized.
     */
    async assertPatientNotAdmitted(tx, patientId, excludeAdmissionId) {
        await this.ipdRepository.lockPatientForAdmission(tx, patientId);
        const existingAdmission = await tx.admission.findFirst({
            where: {
                patient_id: patientId,
                status: ipd_types_1.IPD_STATUS.ADMITTED,
                ...(excludeAdmissionId ? { admission_id: { not: excludeAdmissionId } } : {}),
            },
        });
        if (existingAdmission) {
            throw new Error(`Patient is already admitted with IP Number ${existingAdmission.ip_number}`);
        }
    }
    /*
     * Locks the bed row and confirms it is free. Shared by admit, direct
     * admission, reserve and transfer. A bed RESERVED for this same admission
     * (excludeAdmissionId) counts as free for it; reserved for anyone else,
     * it doesn't.
     */
    async claimBed(tx, bedId, excludeAdmissionId, unavailableMessage = "Selected bed is not available") {
        const locked = await this.ipdRepository.lockBedForAdmission(tx, bedId);
        const bed = locked?.[0];
        const reservedForThis = bed?.status === ipd_types_1.BED_STATUS.RESERVED &&
            !!excludeAdmissionId &&
            bed.reserved_admission_id === excludeAdmissionId;
        // A hold past its reserved_until is as good as released -- the
        // nightly pg_cron sweep tidies it, but nobody has to wait for it.
        const reservationLapsed = bed?.status === ipd_types_1.BED_STATUS.RESERVED &&
            !!bed.reserved_until &&
            new Date(bed.reserved_until).getTime() < Date.now();
        if (bed && reservationLapsed) {
            bed.status = ipd_types_1.BED_STATUS.AVAILABLE;
        }
        if (bed?.status === ipd_types_1.BED_STATUS.RESERVED && !reservedForThis) {
            throw new Error("That bed is reserved for another planned admission");
        }
        if (!bed || (bed.status !== ipd_types_1.BED_STATUS.AVAILABLE && !reservedForThis)) {
            throw new Error(unavailableMessage);
        }
        const heldBy = await tx.admission.findFirst({
            where: {
                bed_id: bedId,
                status: ipd_types_1.IPD_STATUS.ADMITTED,
                ...(excludeAdmissionId ? { admission_id: { not: excludeAdmissionId } } : {}),
            },
        });
        if (heldBy) {
            throw new Error(`Bed is already occupied by IP ${heldBy.ip_number}`);
        }
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
            if (ward.active_status !== 1) {
                throw new Error("Ward is inactive");
            }
        }
        if (bedId) {
            const bed = await this.ipdRepository.findBedById(bedId);
            if (!bed) {
                throw new Error("Bed not found");
            }
            if (bed.active_status !== 1) {
                throw new Error("Bed is inactive");
            }
            if (bed.branch_id !== branchId) {
                throw new Error("Selected bed does not belong to the selected branch");
            }
            if (wardId && bed.ward_id !== wardId) {
                throw new Error("Selected bed does not belong to the chosen ward");
            }
        }
    }
    /*
     * actor is passed for user-facing requests so the body's branch_id is
     * checked against the caller's branches; internal callers omit it.
     */
    async createAdmission(data, createdBy, actor) {
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
        if (actor) {
            await this.assertBranchAccess(actor, branchId);
        }
        await this.validateAdmissionContext({
            branchId,
            departmentId,
            employeeId,
            wardId,
            bedId,
        });
        if (status !== ipd_types_1.IPD_STATUS.PLANNED && status !== ipd_types_1.IPD_STATUS.ADMITTED) {
            throw new Error("A new admission must be PLANNED or ADMITTED");
        }
        if (status === ipd_types_1.IPD_STATUS.ADMITTED) {
            if (!wardId) {
                throw new Error("Ward is required for admission");
            }
            if (!bedId) {
                throw new Error("Bed is required for admission");
            }
        }
        let createdIpNumber;
        try {
            createdIpNumber = await prisma_1.default.$transaction(async (tx) => {
                /*
                 * Authoritative patient + bed checks under row-level locks so
                 * concurrent admits can neither double-admit the patient nor
                 * double-assign the bed.
                 */
                if (status === ipd_types_1.IPD_STATUS.ADMITTED && bedId) {
                    await this.assertPatientNotAdmitted(tx, patientId);
                    await this.claimBed(tx, bedId);
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
                    // A direct admission gets its encounter in the same
                    // transaction, exactly like admitting a planned one.
                    if (!encounterNo) {
                        const newEncounterNo = await this.openIpEncounter(tx, admission, employeeId, createdBy);
                        await this.ipdRepository.updateAdmissionTx(tx, admissionId, { encounter_no: newEncounterNo });
                    }
                }
                return ipNumber;
            });
        }
        catch (error) {
            this.rethrowAdmissionConflict(error);
        }
        return this.getAdmissionByIpNumber(createdIpNumber);
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
            throw httpError("Admission not found", 404);
        }
        return admission;
    }
    /*
     * Same lookup for a user-facing request, plus branch isolation and the
     * display name of whoever last changed it (updated_by holds a user_id;
     * "SYSTEM" -- the nightly sweep -- resolves to null).
     */
    async getAdmissionForActor(ipNumber, actor) {
        const admission = await this.getAdmissionByIpNumber(ipNumber);
        await this.assertBranchAccess(actor, admission.branch_id);
        return {
            ...admission,
            updated_by_name: await this.resolveUserName(admission.updated_by),
        };
    }
    async resolveUserName(userId) {
        if (!userId || userId === "SYSTEM")
            return null;
        const user = await prisma_1.default.user_table.findUnique({
            where: { user_id: userId },
            select: {
                username: true,
                employees: { select: { first_name: true, last_name: true } },
            },
        });
        const fullName = [user?.employees?.first_name, user?.employees?.last_name]
            .filter(Boolean)
            .join(" ");
        return fullName || user?.username || userId;
    }
    /*
     * Edits the details of a PLANNED or ADMITTED admission. Status changes,
     * moving an admitted patient and discharge details each have their own
     * endpoint (admit / cancel / transfer / discharge) because they move the
     * bed and the encounter along with them -- a generic PATCH must never do
     * that, or a bed can be left OCCUPIED with nobody in it.
     */
    async updateAdmission(id, data, actor) {
        const existing = await this.getAdmissionForActor(id, actor);
        if (existing.status !== ipd_types_1.IPD_STATUS.PLANNED && existing.status !== ipd_types_1.IPD_STATUS.ADMITTED) {
            throw new Error(`A ${existing.status.toLowerCase()} admission can't be edited`);
        }
        if (data.status !== undefined && data.status !== existing.status) {
            throw new Error("Status can't be changed here -- use Admit, Cancel, Transfer or Discharge");
        }
        if (data.discharge_date !== undefined ||
            data.discharge_type !== undefined ||
            data.discharge_summary !== undefined) {
            throw new Error("Discharge details can only be recorded through Discharge");
        }
        const isAdmitted = existing.status === ipd_types_1.IPD_STATUS.ADMITTED;
        const cleanId = (val) => (val && String(val).trim().length > 0 ? String(val).trim() : null);
        const wardId = data.ward_id !== undefined ? cleanId(data.ward_id) : cleanId(existing.ward_id);
        const bedId = data.bed_id !== undefined ? cleanId(data.bed_id) : cleanId(existing.bed_id);
        const departmentId = data.department_id !== undefined ? cleanId(data.department_id) : cleanId(existing.department_id);
        const employeeId = data.employee_id !== undefined ? cleanId(data.employee_id) : cleanId(existing.employee_id);
        const locationChanged = wardId !== cleanId(existing.ward_id) || bedId !== cleanId(existing.bed_id);
        if (isAdmitted && locationChanged) {
            throw new Error("Use transfer to move an admitted patient to another ward or bed");
        }
        if (isAdmitted && data.admission_date !== undefined) {
            throw new Error("Admission time is recorded when the patient is admitted and can't be edited");
        }
        // For a PLANNED admission ward/bed are only a request -- no bed is
        // held, so only their existence, branch and active state are checked.
        const contextChanged = locationChanged ||
            departmentId !== cleanId(existing.department_id) ||
            employeeId !== cleanId(existing.employee_id);
        if (contextChanged) {
            await this.validateAdmissionContext({
                branchId: existing.branch_id,
                departmentId,
                employeeId,
                wardId,
                bedId,
            });
        }
        await prisma_1.default.$transaction(async (tx) => {
            // Moving a planned request off its reserved bed gives that bed
            // back -- the new bed is only a request until reserved again.
            if (!isAdmitted && locationChanged) {
                await this.ipdRepository.releaseReservations(tx, [existing.admission_id], actor.user_id, bedId ?? undefined);
            }
            // Explicit whitelist: spreading the request body here would let a
            // PATCH rewrite patient_id, branch_id, encounter_no, ...
            await this.ipdRepository.updateAdmissionTx(tx, existing.admission_id, {
                ...(data.department_id !== undefined ? { department_id: departmentId } : {}),
                ...(data.employee_id !== undefined ? { employee_id: employeeId } : {}),
                ...(data.ward_id !== undefined ? { ward_id: wardId } : {}),
                ...(data.bed_id !== undefined ? { bed_id: bedId } : {}),
                ...(data.admission_date !== undefined ? { admission_date: new Date(data.admission_date) } : {}),
                admission_type: data.admission_type,
                payment_mode: data.payment_mode,
                insurance_provider: data.insurance_provider,
                insurance_policy_no: data.insurance_policy_no,
                expected_stay_days: data.expected_stay_days,
                advance_amount: data.advance_amount,
                provisional_diagnosis: data.provisional_diagnosis,
                is_daycare: data.is_daycare,
                updated_by: actor.user_id,
                updated_at: new Date(),
            });
        });
        return this.getAdmissionByIpNumber(existing.admission_id);
    }
    /*
     * PLANNED -> ADMITTED in one transaction: binds and occupies the bed,
     * stamps the actual admission time and opens the IPD encounter, so a
     * failure at any step leaves the request exactly as it was. ward_id /
     * bed_id override the requested ones (e.g. the requested bed was taken).
     */
    async admitPlanned(id, actor, data = {}) {
        const existing = await this.getAdmissionForActor(id, actor);
        if (existing.status !== ipd_types_1.IPD_STATUS.PLANNED) {
            throw new Error(`Only a planned admission can be admitted (this one is ${existing.status})`);
        }
        const wardId = data.ward_id?.trim() || existing.ward_id;
        const bedId = data.bed_id?.trim() || existing.bed_id;
        if (!wardId || !bedId) {
            throw new Error("Select a ward and bed before admitting");
        }
        const patient = await prisma_1.default.patient_bio_data.findUnique({
            where: { patient_id: existing.patient_id },
            select: { patient_active: true },
        });
        if (!patient || patient.patient_active !== "Active") {
            throw new Error("Patient is inactive");
        }
        await this.validateAdmissionContext({
            branchId: existing.branch_id,
            departmentId: existing.department_id,
            employeeId: existing.employee_id,
            wardId,
            bedId,
        });
        try {
            await prisma_1.default.$transaction(async (tx) => {
                await this.assertPatientNotAdmitted(tx, existing.patient_id, existing.admission_id);
                // Re-read under the patient lock: a double click or a
                // concurrent cancel of this same request is caught here.
                const current = await tx.admission.findUnique({
                    where: { admission_id: existing.admission_id },
                    select: { status: true, encounter_no: true },
                });
                if (current?.status !== ipd_types_1.IPD_STATUS.PLANNED) {
                    throw new Error("This admission request has already been admitted or cancelled");
                }
                await this.claimBed(tx, bedId, existing.admission_id);
                const admittedAt = new Date();
                const encounterNo = current.encounter_no
                    ?? await this.openIpEncounter(tx, existing, existing.employee_id, actor.user_id);
                await this.ipdRepository.updateAdmissionTx(tx, existing.admission_id, {
                    status: ipd_types_1.IPD_STATUS.ADMITTED,
                    ward_id: wardId,
                    bed_id: bedId,
                    admission_date: admittedAt,
                    encounter_no: encounterNo,
                    updated_by: actor.user_id,
                    updated_at: admittedAt,
                });
                await this.ipdRepository.markBedStatus(tx, bedId, ipd_types_1.BED_STATUS.OCCUPIED, actor.user_id);
                // Admitted into a different bed than the one held for this
                // request: hand the reserved one back.
                await this.ipdRepository.releaseReservations(tx, [existing.admission_id], actor.user_id, bedId);
            });
        }
        catch (error) {
            this.rethrowAdmissionConflict(error);
        }
        return this.getAdmissionByIpNumber(existing.admission_id);
    }
    /*
     * Holds a bed for a PLANNED admission until the end of its planned day
     * (IST). Only for requests dated within RESERVATION_MAX_DAYS_AHEAD, so a
     * booking weeks out can't sit on an empty bed. One bed per request:
     * reserving another bed gives the previous one back.
     */
    async reserveBed(id, actor, data = {}) {
        const existing = await this.getAdmissionForActor(id, actor);
        if (existing.status !== ipd_types_1.IPD_STATUS.PLANNED) {
            throw new Error(`Only a planned admission can hold a bed (this one is ${existing.status})`);
        }
        const wardId = data.ward_id?.trim() || existing.ward_id;
        const bedId = data.bed_id?.trim() || existing.bed_id;
        if (!wardId || !bedId) {
            throw new Error("Select a ward and bed to reserve");
        }
        const todayIst = istDateString(new Date());
        const plannedIst = istDateString(new Date(existing.admission_date));
        const daysAhead = istDayDiff(todayIst, plannedIst);
        if (daysAhead > ipd_constants_1.RESERVATION_MAX_DAYS_AHEAD) {
            throw new Error(`A bed can be reserved at most ${ipd_constants_1.RESERVATION_MAX_DAYS_AHEAD} day(s) before the planned date (${plannedIst})`);
        }
        // Held until the end of the planned day -- or of today, if the
        // request is already overdue (it may still be admitted in the grace
        // period before it turns NO_SHOW).
        const reservedUntil = startOfIstDay(daysAhead < 0 ? todayIst : plannedIst);
        reservedUntil.setTime(reservedUntil.getTime() + DAY_MS);
        await this.validateAdmissionContext({
            branchId: existing.branch_id,
            departmentId: existing.department_id,
            employeeId: existing.employee_id,
            wardId,
            bedId,
        });
        await prisma_1.default.$transaction(async (tx) => {
            // Same lock order as admit (patient, then bed), so reserving and
            // admitting the same request are serialized.
            await this.ipdRepository.lockPatientForAdmission(tx, existing.patient_id);
            const current = await tx.admission.findUnique({
                where: { admission_id: existing.admission_id },
                select: { status: true },
            });
            if (current?.status !== ipd_types_1.IPD_STATUS.PLANNED) {
                throw new Error("This admission request has already been admitted or cancelled");
            }
            await this.claimBed(tx, bedId, existing.admission_id);
            await this.ipdRepository.releaseReservations(tx, [existing.admission_id], actor.user_id, bedId);
            await this.ipdRepository.reserveBed(tx, bedId, existing.admission_id, reservedUntil, actor.user_id);
            await this.ipdRepository.updateAdmissionTx(tx, existing.admission_id, {
                ward_id: wardId,
                bed_id: bedId,
                updated_by: actor.user_id,
                updated_at: new Date(),
            });
        });
        return this.getAdmissionByIpNumber(existing.admission_id);
    }
    async releaseReservation(id, actor) {
        const existing = await this.getAdmissionForActor(id, actor);
        const result = await prisma_1.default.$transaction((tx) => this.ipdRepository.releaseReservations(tx, [existing.admission_id], actor.user_id));
        if (result.count === 0) {
            throw new Error("This admission has no bed reserved");
        }
        return this.getAdmissionByIpNumber(existing.admission_id);
    }
    async cancelPlanned(id, actor, reason) {
        return this.closePlanned(id, actor, ipd_types_1.IPD_STATUS.CANCELLED, reason);
    }
    async markNoShow(id, actor, reason) {
        return this.closePlanned(id, actor, ipd_types_1.IPD_STATUS.NO_SHOW, reason);
    }
    /*
     * PLANNED -> CANCELLED / NO_SHOW, giving back any bed the request held.
     * Takes the patient lock like admit does, and the status guard in the
     * WHERE means a request that was admitted meanwhile is never closed.
     */
    async closePlanned(id, actor, status, reason) {
        const existing = await this.getAdmissionForActor(id, actor);
        const verb = status === ipd_types_1.IPD_STATUS.CANCELLED ? "cancelled" : "marked as no-show";
        if (existing.status !== ipd_types_1.IPD_STATUS.PLANNED) {
            throw new Error(`Only a planned admission can be ${verb} (this one is ${existing.status})`);
        }
        if (status === ipd_types_1.IPD_STATUS.NO_SHOW &&
            istDayDiff(istDateString(new Date()), istDateString(new Date(existing.admission_date))) > 0) {
            throw new Error("A planned admission can't be marked as no-show before its planned date");
        }
        await prisma_1.default.$transaction(async (tx) => {
            await this.ipdRepository.lockPatientForAdmission(tx, existing.patient_id);
            const result = await tx.admission.updateMany({
                where: { admission_id: existing.admission_id, status: ipd_types_1.IPD_STATUS.PLANNED },
                data: {
                    status,
                    cancellation_reason: reason?.trim() || null,
                    updated_by: actor.user_id,
                    updated_at: new Date(),
                },
            });
            if (result.count === 0) {
                throw new Error("This admission request has already been admitted or cancelled");
            }
            await this.ipdRepository.releaseReservations(tx, [existing.admission_id], actor.user_id);
        });
        return this.getAdmissionByIpNumber(existing.admission_id);
    }
    async dischargeAdmission(id, actor, data) {
        const existing = await this.getAdmissionForActor(id, actor);
        if (existing.status !== ipd_types_1.IPD_STATUS.ADMITTED) {
            throw new Error("Admission is not currently active");
        }
        const closedBy = actor.user_id;
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
            // The vacated bed needs turning over before the next patient.
            if (existing.bed_id) {
                await this.ipdRepository.markBedStatus(tx, existing.bed_id, ipd_types_1.BED_STATUS.CLEANING, closedBy);
            }
            if (existing.encounter_no) {
                await this.ipdRepository.updateEncounterDischarge(tx, existing.encounter_no, dischargeDate, closedBy);
            }
            if (existing.appointment_id) {
                await this.ipdRepository.updateAppointmentCompleted(tx, existing.appointment_id);
            }
            return updated;
        });
    }
    async transferAdmission(id, targetWardId, targetBedId, reason, actor) {
        const existing = await this.getAdmissionForActor(id, actor);
        if (existing.status !== ipd_types_1.IPD_STATUS.ADMITTED) {
            throw new Error("Cannot transfer a patient who is not currently admitted");
        }
        if (targetBedId === existing.bed_id) {
            throw new Error("Patient is already in this bed");
        }
        const targetWard = await this.ipdRepository.findWardById(targetWardId);
        if (!targetWard) {
            throw new Error("Target ward not found");
        }
        if (targetWard.branch_id !== existing.branch_id) {
            throw new Error("Target ward belongs to a different branch");
        }
        if (targetWard.active_status !== 1) {
            throw new Error("Target ward is inactive");
        }
        const targetBed = await this.ipdRepository.findBedById(targetBedId);
        if (!targetBed) {
            throw new Error("Target bed not found");
        }
        if (targetBed.ward_id !== targetWardId) {
            throw new Error("Target bed does not belong to the selected ward");
        }
        if (targetBed.active_status !== 1) {
            throw new Error("Target bed is inactive");
        }
        if (targetBed.status !== ipd_types_1.BED_STATUS.AVAILABLE) {
            throw new Error("Target bed is not available");
        }
        const transferredBy = actor.user_id;
        try {
            return await prisma_1.default.$transaction(async (tx) => {
                await this.claimBed(tx, targetBedId, existing.admission_id, "Target bed is not available");
                // The vacated bed needs turning over before the next patient.
                if (existing.bed_id) {
                    await this.ipdRepository.markBedStatus(tx, existing.bed_id, ipd_types_1.BED_STATUS.CLEANING, transferredBy);
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
        catch (error) {
            this.rethrowAdmissionConflict(error);
        }
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
    /*
     * Beds with who is in them (occupant) and who they are held for
     * (reserved_for) -- what the bed board renders.
     */
    async listBeds(wardId, branchId) {
        const beds = await this.ipdRepository.listBeds(wardId, branchId);
        const holderIds = [
            ...new Set(beds
                .filter((b) => b.status === ipd_types_1.BED_STATUS.RESERVED && b.reserved_admission_id)
                .map((b) => b.reserved_admission_id)),
        ];
        const holders = await this.ipdRepository.findReservationHolders(holderIds);
        const holderById = new Map(holders.map((h) => [h.admission_id, h]));
        return beds.map(({ admission, ...bed }) => ({
            ...bed,
            occupant: admission[0] ?? null,
            reserved_for: bed.status === ipd_types_1.BED_STATUS.RESERVED && bed.reserved_admission_id
                ? holderById.get(bed.reserved_admission_id) ?? null
                : null,
        }));
    }
    async createWard(data, user) {
        await this.assertBranchAccess(user, data.branch_id);
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
    async updateWard(wardId, data, user) {
        const ward = await this.ipdRepository.findWardById(wardId);
        if (!ward) {
            throw new Error("Ward not found");
        }
        await this.assertBranchAccess(user, ward.branch_id);
        if (data.ward_name && data.ward_name.trim().toLowerCase() !== ward.ward_name.toLowerCase()) {
            const duplicate = await this.ipdRepository.findWardByBranchAndName(ward.branch_id, data.ward_name.trim());
            if (duplicate && duplicate.ward_id !== wardId) {
                throw new Error(`Ward '${data.ward_name}' already exists in this branch`);
            }
        }
        // Deactivating a ward must never orphan patients or beds still
        // pointing at it -- both must be cleared out first.
        if (data.active_status === 0) {
            const admittedCount = await prisma_1.default.admission.count({
                where: { ward_id: wardId, status: ipd_types_1.IPD_STATUS.ADMITTED },
            });
            if (admittedCount > 0) {
                throw new Error("Cannot deactivate a ward with currently admitted patients");
            }
            const activeBedCount = await this.ipdRepository.countBedsInWard(wardId);
            if (activeBedCount > 0) {
                throw new Error("Cannot deactivate a ward that still has active beds -- reassign or deactivate its beds first");
            }
        }
        return this.ipdRepository.updateWard(wardId, {
            ward_name: data.ward_name?.trim(),
            ward_type: data.ward_type,
            floor: data.floor,
            tariff: data.tariff,
            active_status: data.active_status,
            updated_by: user?.user_id || "SYSTEM",
            updated_at: new Date(),
        });
    }
    async createBed(data, user) {
        const ward = await this.ipdRepository.findWardById(data.ward_id);
        if (!ward) {
            throw new Error("Ward not found");
        }
        // A bed always lives in its ward's branch.
        if (data.branch_id && data.branch_id !== ward.branch_id) {
            throw new Error("Ward does not belong to the selected branch");
        }
        const branch_id = ward.branch_id;
        await this.assertBranchAccess(user, branch_id);
        // RESERVED / OCCUPIED only ever come from the admission flows.
        if (data.status && !ipd_constants_1.MANUAL_BED_STATUSES.includes(data.status)) {
            throw new Error(`A new bed can only start as one of: ${ipd_constants_1.MANUAL_BED_STATUSES.join(", ")}`);
        }
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
    async updateBed(bedId, data, user) {
        const bed = await this.ipdRepository.findBedById(bedId);
        if (!bed) {
            throw new Error("Bed not found");
        }
        await this.assertBranchAccess(user, bed.branch_id);
        if (bed.status === ipd_types_1.BED_STATUS.OCCUPIED) {
            throw new Error("Bed is currently occupied by an admitted patient and cannot be edited");
        }
        if (bed.status === ipd_types_1.BED_STATUS.RESERVED) {
            throw new Error("Bed is reserved for a planned admission -- release the reservation before editing it");
        }
        const oldWardId = bed.ward_id;
        let newWardId = oldWardId;
        let newBranchId = bed.branch_id;
        if (data.ward_id && data.ward_id !== oldWardId) {
            const targetWard = await this.ipdRepository.findWardById(data.ward_id);
            if (!targetWard) {
                throw new Error("Target ward not found");
            }
            // Moving a bed into another ward needs access to that ward's branch too.
            await this.assertBranchAccess(user, targetWard.branch_id);
            newWardId = data.ward_id;
            newBranchId = targetWard.branch_id;
        }
        if (data.bed_number) {
            const duplicate = await this.ipdRepository.findBedByWardAndNumber(newWardId, data.bed_number.trim());
            if (duplicate && duplicate.bed_id !== bedId) {
                throw new Error(`Bed '${data.bed_number}' already exists in this ward`);
            }
        }
        const wasActive = bed.active_status === 1;
        const willBeActive = data.active_status === undefined ? wasActive : data.active_status === 1;
        const wardChanged = newWardId !== oldWardId;
        return prisma_1.default.$transaction(async (tx) => {
            const updated = await this.ipdRepository.updateBed(bedId, {
                bed_number: data.bed_number?.trim(),
                bed_type: data.bed_type,
                tariff: data.tariff,
                ward_id: newWardId,
                branch_id: newBranchId,
                active_status: data.active_status,
                updated_by: user?.user_id || "SYSTEM",
                updated_at: new Date(),
            }, tx);
            // total_beds on ward_master is a live count of active beds (it is
            // incremented on createBed), so any move/activation change here
            // must keep both wards' counters in sync or they silently drift.
            if (wardChanged) {
                if (wasActive) {
                    await tx.ward_master.update({
                        where: { ward_id: oldWardId },
                        data: { total_beds: { decrement: 1 }, updated_at: new Date() },
                    });
                }
                if (willBeActive) {
                    await tx.ward_master.update({
                        where: { ward_id: newWardId },
                        data: { total_beds: { increment: 1 }, updated_at: new Date() },
                    });
                }
            }
            else if (wasActive !== willBeActive) {
                await tx.ward_master.update({
                    where: { ward_id: newWardId },
                    data: {
                        total_beds: willBeActive ? { increment: 1 } : { decrement: 1 },
                        updated_at: new Date(),
                    },
                });
            }
            return updated;
        });
    }
    async updateBedStatus(bedId, status, user, remarks) {
        if (!ipd_constants_1.MANUAL_BED_STATUSES.includes(status)) {
            throw new Error(`Status must be one of: ${ipd_constants_1.MANUAL_BED_STATUSES.join(", ")}`);
        }
        const bed = await this.ipdRepository.findBedById(bedId);
        if (!bed) {
            throw new Error("Bed not found");
        }
        await this.assertBranchAccess(user, bed.branch_id);
        return prisma_1.default.$transaction(async (tx) => {
            // Checked under the row lock, so a concurrent admit / reserve
            // can't be overwritten by a manual status change.
            const locked = await this.ipdRepository.lockBedForAdmission(tx, bedId);
            const current = locked?.[0]?.status;
            const reservedUntil = locked?.[0]?.reserved_until;
            const reservationLapsed = !!reservedUntil && new Date(reservedUntil).getTime() < Date.now();
            if (current === ipd_types_1.BED_STATUS.OCCUPIED) {
                throw new Error("Bed is currently occupied by an admitted patient and cannot be changed manually");
            }
            if (current === ipd_types_1.BED_STATUS.RESERVED && !reservationLapsed) {
                throw new Error("Bed is reserved for a planned admission -- release the reservation first");
            }
            return this.ipdRepository.markBedStatus(tx, bedId, status, user?.user_id || "SYSTEM", remarks);
        });
    }
    async deleteWard(wardId, user) {
        const ward = await this.ipdRepository.findWardById(wardId);
        if (!ward) {
            throw new Error("Ward not found");
        }
        await this.assertBranchAccess(user, ward.branch_id);
        const admittedCount = await prisma_1.default.admission.count({
            where: { ward_id: wardId, status: ipd_types_1.IPD_STATUS.ADMITTED },
        });
        if (admittedCount > 0) {
            throw new Error("Cannot delete a ward with currently admitted patients");
        }
        const activeBedCount = await this.ipdRepository.countBedsInWard(wardId);
        if (activeBedCount > 0) {
            throw new Error("Cannot delete a ward that still has active beds -- reassign or delete its beds first");
        }
        return prisma_1.default.$transaction(async (tx) => {
            return tx.ward_master.update({
                where: { ward_id: wardId },
                data: {
                    active_status: 0,
                    updated_by: user?.user_id || "SYSTEM",
                    updated_at: new Date(),
                },
            });
        });
    }
    async deleteBed(bedId, user) {
        const bed = await this.ipdRepository.findBedById(bedId);
        if (!bed) {
            throw new Error("Bed not found");
        }
        await this.assertBranchAccess(user, bed.branch_id);
        if (bed.status === ipd_types_1.BED_STATUS.OCCUPIED) {
            throw new Error("Cannot delete an occupied bed");
        }
        if (bed.status === ipd_types_1.BED_STATUS.RESERVED) {
            throw new Error("Cannot delete a bed reserved for a planned admission");
        }
        const activeAdmissionCount = await prisma_1.default.admission.count({
            where: { bed_id: bedId, status: ipd_types_1.IPD_STATUS.ADMITTED },
        });
        if (activeAdmissionCount > 0) {
            throw new Error("Cannot delete a bed with active admissions");
        }
        return prisma_1.default.$transaction(async (tx) => {
            return tx.bed_master.update({
                where: { bed_id: bedId },
                data: {
                    active_status: 0,
                    updated_by: user?.user_id || "SYSTEM",
                    updated_at: new Date(),
                },
            });
        });
    }
}
exports.IpdService = IpdService;
