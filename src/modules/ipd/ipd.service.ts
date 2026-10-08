import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { TOP_LEVEL_ADMIN_ROLES } from "../../permissions/roles";
import { EncounterRepository } from "../encounter/encounter.repository";
import { ENCOUNTER_STATUS, ENCOUNTER_TYPE_IPD } from "../encounter/encounter.constants";
import { IPDRepository, IpdRepository } from "./ipd.repository";
import {
    CreateAdmissionDTO,
    UpdateAdmissionDTO,
    UpdateWardDTO,
    UpdateBedDTO,
    AdmissionSearchQuery,
    DaycareBookingDTO,
    IpdActor,
    IPD_STATUS,
    BED_STATUS,
} from "./ipd.types";
import {
    ADMISSION_TYPE,
    IPD_STATUS_VALUES,
    IST_OFFSET_MS,
    MANUAL_BED_STATUSES,
    RESERVATION_MAX_DAYS_AHEAD,
} from "./ipd.constants";

const encounterRepository = new EncounterRepository();

const httpError = (message: string, status: number) => {
    const err: any = new Error(message);
    err.status = status;
    return err;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** yyyy-MM-dd of the given instant in IST. */
const istDateString = (at: Date) =>
    new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** The UTC instant at which an IST calendar day (yyyy-MM-dd) begins. */
const startOfIstDay = (istDate: string) =>
    new Date(Date.parse(`${istDate}T00:00:00.000Z`) - IST_OFFSET_MS);

/** Whole days from IST date `from` to IST date `to` (negative if earlier). */
const istDayDiff = (from: string, to: string) =>
    Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS);

/** UTC instant of an IST date (yyyy-MM-dd) + time (HH:mm). */
const istSlotToUtc = (istDate: string, time: string) => {
    const t = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(time ?? "").trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(istDate ?? "")) || !t) {
        throw new Error("A valid date and time slot are required");
    }
    return new Date(
        Date.parse(`${istDate}T${t[1].padStart(2, "0")}:${t[2]}:00.000Z`) - IST_OFFSET_MS
    );
};

// Emergency admissions are admitted on the spot and may start without a
// doctor / department (assigned afterwards from the IPD list).
const isEmergencyType = (admissionType?: string | null) =>
    String(admissionType ?? "").trim().toUpperCase() === ADMISSION_TYPE.EMERGENCY;

interface DaycareSlot {
    admission_id: string;
    ip_number: string;
    status: string;
    start: Date;
    end: Date;
}

/*
 * Most daycare sessions running at the same moment within [start, end) --
 * concurrency can only rise at a session start, so checking the window start
 * and every session start inside it is enough.
 */
const peakDaycareOverlap = (slots: DaycareSlot[], start: Date, end: Date) => {
    const overlapping = slots.filter((s) => s.start < end && s.end > start);
    const instants = [start, ...overlapping.map((s) => s.start).filter((t) => t > start && t < end)];
    return instants.reduce(
        (peak, t) => Math.max(peak, overlapping.filter((s) => s.start <= t && s.end > t).length),
        0
    );
};

export class IpdService {

    constructor(private readonly ipdRepository: IPDRepository = new IpdRepository()) {}

    /*
     * Record-level branch isolation for admission writes. branchScope only
     * validates a branch passed in the query/header (and picks one for
     * multi-branch users), so it can't vouch for a branch_id in the body or
     * for the branch of an existing admission -- this checks the record's own
     * branch against the caller's ACTIVE mappings instead.
     */
    async assertBranchAccess(actor: IpdActor, branchId: string) {

        const isTopLevelAdmin = TOP_LEVEL_ADMIN_ROLES.some(
            (r) => r.toLowerCase() === String(actor.role ?? "").toLowerCase()
        );
        if (isTopLevelAdmin) {
            return;
        }

        const mapping = await prisma.user_branch_mapping.findFirst({
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
    private rethrowAdmissionConflict(error: any): never {

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
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
    private async openIpEncounter(
        tx: Prisma.TransactionClient,
        admission: { admission_id: string; patient_id: string; branch_id: string; department_id: string | null },
        // null for an emergency admitted before a doctor is assigned.
        employeeId: string | null,
        createdBy: string
    ) {

        const encounterNo = await encounterRepository.generateEncounterNumber(tx);

        await encounterRepository.createEncounter(tx, {
            createdBy,
            encounter_no: encounterNo,
            patient_id: admission.patient_id,
            branch_id: admission.branch_id,
            department_id: admission.department_id,
            employee_id: employeeId,
            encounter_type: ENCOUNTER_TYPE_IPD,
            status: ENCOUNTER_STATUS.OPEN,
        });

        return encounterNo;

    }

    /*
     * Authoritative "one active admission per patient" check, run under the
     * patient row lock so concurrent admits are serialized.
     */
    private async assertPatientNotAdmitted(
        tx: Prisma.TransactionClient,
        patientId: string,
        excludeAdmissionId?: string
    ) {

        await this.ipdRepository.lockPatientForAdmission(tx, patientId);

        const existingAdmission = await tx.admission.findFirst({
            where: {
                patient_id: patientId,
                status: IPD_STATUS.ADMITTED,
                ...(excludeAdmissionId ? { admission_id: { not: excludeAdmissionId } } : {}),
            },
        });

        if (existingAdmission) {
            throw new Error(
                `Patient is already admitted with IP Number ${existingAdmission.ip_number}`
            );
        }

    }

    /*
     * Locks the bed row and confirms it is free. Shared by admit, direct
     * admission, reserve and transfer. A bed RESERVED for this same admission
     * (excludeAdmissionId) counts as free for it; reserved for anyone else,
     * it doesn't.
     */
    private async claimBed(
        tx: Prisma.TransactionClient,
        bedId: string,
        excludeAdmissionId?: string,
        unavailableMessage = "Selected bed is not available"
    ) {

        const locked = await this.ipdRepository.lockBedForAdmission(tx, bedId);
        const bed = locked?.[0];

        const reservedForThis =
            bed?.status === BED_STATUS.RESERVED &&
            !!excludeAdmissionId &&
            bed.reserved_admission_id === excludeAdmissionId;

        // A hold past its reserved_until is as good as released -- the
        // nightly pg_cron sweep tidies it, but nobody has to wait for it.
        const reservationLapsed =
            bed?.status === BED_STATUS.RESERVED &&
            !!bed.reserved_until &&
            new Date(bed.reserved_until).getTime() < Date.now();

        if (bed && reservationLapsed) {
            bed.status = BED_STATUS.AVAILABLE;
        }

        if (bed?.status === BED_STATUS.RESERVED && !reservedForThis) {
            throw new Error("That bed is reserved for another planned admission");
        }
        if (!bed || (bed.status !== BED_STATUS.AVAILABLE && !reservedForThis)) {
            throw new Error(unavailableMessage);
        }

        const heldBy = await tx.admission.findFirst({
            where: {
                bed_id: bedId,
                status: IPD_STATUS.ADMITTED,
                ...(excludeAdmissionId ? { admission_id: { not: excludeAdmissionId } } : {}),
            },
        });
        if (heldBy) {
            throw new Error(`Bed is already occupied by IP ${heldBy.ip_number}`);
        }

    }

    async validateAdmissionContext(data: {
        branchId: string;
        departmentId?: string | null;
        employeeId?: string | null;
        wardId?: string | null;
        bedId?: string | null;
        /** Emergency: doctor / department may be missing (still validated if given). */
        allowUnassigned?: boolean;
    }) {

        const { branchId, departmentId, employeeId, wardId, bedId, allowUnassigned = false } = data;

        if (departmentId) {
            const department = await this.ipdRepository.findDepartmentById(departmentId);
            if (!department) {
                throw new Error("Department not found");
            }
        } else if (!allowUnassigned) {
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
            const mapping = await prisma.user_branch_mapping.findFirst({
                where: {
                    employee_id: employeeId,
                    branch_id: branchId,
                    status: 1,
                },
            });
            if (!mapping) {
                throw new Error("Doctor is not assigned to the selected branch");
            }
        } else if (!allowUnassigned) {
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
    async createAdmission(data: CreateAdmissionDTO, createdBy: string, actor?: IpdActor) {

        const cleanId = (val?: any): string | null => {
            if (val === null || val === undefined) return null;
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
        const encounterNo = cleanId((data as any).encounter_no);

        const status = data.status && IPD_STATUS_VALUES.includes(data.status)
            ? data.status
            : IPD_STATUS.ADMITTED;

        const patient = await prisma.patient_bio_data.findUnique({
            where: { patient_id: patientId },
        });

        if (!patient) {
            throw new Error("Patient not found");
        }

        if (patient.patient_active !== "Active") {
            throw new Error("Patient is inactive");
        }

        const branch = await prisma.branch.findUnique({
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

        const isEmergency = isEmergencyType(data.admission_type);

        // Emergency = admitted on the spot into a chosen bed, never planned.
        if (isEmergency && status !== IPD_STATUS.ADMITTED) {
            throw new Error("An emergency admission is admitted immediately -- choose a ward and bed");
        }

        await this.validateAdmissionContext({
            branchId,
            departmentId,
            employeeId,
            wardId,
            bedId,
            allowUnassigned: isEmergency,
        });

        if (status !== IPD_STATUS.PLANNED && status !== IPD_STATUS.ADMITTED) {
            throw new Error("A new admission must be PLANNED or ADMITTED");
        }

        if (status === IPD_STATUS.ADMITTED) {

            if (!wardId) {
                throw new Error("Ward is required for admission");
            }
            if (!bedId) {
                throw new Error("Bed is required for admission");
            }

        }

        let createdIpNumber: string;

        try {

            createdIpNumber = await prisma.$transaction(async (tx) => {

                /*
                 * Authoritative patient + bed checks under row-level locks so
                 * concurrent admits can neither double-admit the patient nor
                 * double-assign the bed.
                 */
                if (status === IPD_STATUS.ADMITTED && bedId) {
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
                    admission_type: data.admission_type || (data.is_daycare ? ADMISSION_TYPE.DAYCARE : ADMISSION_TYPE.REGULAR),
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
                    // An emergency is admitted now, whatever date was sent.
                    admission_date: isEmergency
                        ? new Date()
                        : data.admission_date
                            ? new Date(data.admission_date)
                            : undefined,
                    status,
                    created_by: createdBy,
                });

                if (status === IPD_STATUS.ADMITTED && bedId) {
                    await this.ipdRepository.markBedStatus(
                        tx,
                        bedId,
                        BED_STATUS.OCCUPIED,
                        createdBy
                    );

                    // A direct admission gets its encounter in the same
                    // transaction, exactly like admitting a planned one.
                    if (!encounterNo) {
                        const newEncounterNo = await this.openIpEncounter(tx, admission, employeeId, createdBy);
                        await this.ipdRepository.updateAdmissionTx(tx, admissionId, { encounter_no: newEncounterNo });
                    }
                }

                return ipNumber;

            });

        } catch (error) {
            this.rethrowAdmissionConflict(error);
        }

        return this.getAdmissionByIpNumber(createdIpNumber);

    }

    async listAdmissions(filter: AdmissionSearchQuery & { wardId?: string }) {

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

    async getAdmissionByIpNumber(ipNumber: string) {

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
    async getAdmissionForActor(ipNumber: string, actor: IpdActor) {

        const admission = await this.getAdmissionByIpNumber(ipNumber);

        await this.assertBranchAccess(actor, admission.branch_id);

        return {
            ...admission,
            updated_by_name: await this.resolveUserName(admission.updated_by),
        };

    }

    private async resolveUserName(userId: string | null | undefined) {

        if (!userId || userId === "SYSTEM") return null;

        const user = await prisma.user_table.findUnique({
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
    async updateAdmission(id: string, data: UpdateAdmissionDTO, actor: IpdActor) {

        const existing = await this.getAdmissionForActor(id, actor);

        if (existing.status !== IPD_STATUS.PLANNED && existing.status !== IPD_STATUS.ADMITTED) {
            throw new Error(`A ${existing.status.toLowerCase()} admission can't be edited`);
        }

        if (data.status !== undefined && data.status !== existing.status) {
            throw new Error("Status can't be changed here -- use Admit, Cancel, Transfer or Discharge");
        }

        if (
            data.discharge_date !== undefined ||
            data.discharge_type !== undefined ||
            data.discharge_summary !== undefined
        ) {
            throw new Error("Discharge details can only be recorded through Discharge");
        }

        const isAdmitted = existing.status === IPD_STATUS.ADMITTED;

        const cleanId = (val?: any) => (val && String(val).trim().length > 0 ? String(val).trim() : null);

        const wardId = data.ward_id !== undefined ? cleanId(data.ward_id) : cleanId(existing.ward_id);
        const bedId = data.bed_id !== undefined ? cleanId(data.bed_id) : cleanId(existing.bed_id);
        const departmentId = data.department_id !== undefined ? cleanId(data.department_id) : cleanId(existing.department_id);
        const employeeId = data.employee_id !== undefined ? cleanId(data.employee_id) : cleanId(existing.employee_id);

        const locationChanged =
            wardId !== cleanId(existing.ward_id) || bedId !== cleanId(existing.bed_id);

        const doctorChanged =
            departmentId !== cleanId(existing.department_id) ||
            employeeId !== cleanId(existing.employee_id);

        // A daycare request booked with a doctor slot: its date, time, doctor,
        // ward and duration were capacity-checked together with that slot, so
        // they can only change by cancelling and booking again. The bed (and
        // payment / diagnosis details) stay editable.
        if (!isAdmitted && existing.is_daycare && existing.appointment_id) {
            const fixedFieldChanged =
                data.admission_date !== undefined ||
                (data.ward_id !== undefined && wardId !== cleanId(existing.ward_id)) ||
                doctorChanged ||
                (data.expected_stay_days !== undefined &&
                    Number(data.expected_stay_days) !== Number(existing.expected_stay_days)) ||
                data.is_daycare === false ||
                (data.admission_type !== undefined && data.admission_type !== existing.admission_type);

            if (fixedFieldChanged) {
                throw new Error(
                    "The date, time, doctor, ward and duration of a daycare booking are fixed -- cancel it and book again to change them"
                );
            }
        }

        if (isAdmitted && locationChanged) {
            throw new Error("Use transfer to move an admitted patient to another ward or bed");
        }

        if (isAdmitted && data.admission_date !== undefined) {
            throw new Error("Admission time is recorded when the patient is admitted and can't be edited");
        }

        // For a PLANNED admission ward/bed are only a request -- no bed is
        // held, so only their existence, branch and active state are checked.
        const contextChanged = locationChanged || doctorChanged;

        if (contextChanged) {
            await this.validateAdmissionContext({
                branchId: existing.branch_id,
                departmentId,
                employeeId,
                wardId,
                bedId,
            });
        }

        await prisma.$transaction(async (tx) => {

            // Moving a planned request off its reserved bed gives that bed
            // back -- the new bed is only a request until reserved again.
            if (!isAdmitted && locationChanged) {
                await this.ipdRepository.releaseReservations(
                    tx,
                    [existing.admission_id],
                    actor.user_id,
                    bedId ?? undefined
                );
            }

            // Assigning / changing the doctor of an admitted patient (e.g. an
            // emergency admitted without one) moves their open IPD encounter
            // with it, so the doctor sees the patient in their list.
            if (isAdmitted && doctorChanged && existing.encounter_no) {
                await tx.encounter.update({
                    where: { encounter_no: existing.encounter_no },
                    data: { employee_id: employeeId, department_id: departmentId },
                });
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
    async admitPlanned(
        id: string,
        actor: IpdActor,
        data: { ward_id?: string; bed_id?: string } = {}
    ) {

        const existing = await this.getAdmissionForActor(id, actor);

        if (existing.status !== IPD_STATUS.PLANNED) {
            throw new Error(`Only a planned admission can be admitted (this one is ${existing.status})`);
        }

        const wardId = data.ward_id?.trim() || existing.ward_id;
        const bedId = data.bed_id?.trim() || existing.bed_id;

        if (!wardId || !bedId) {
            throw new Error("Select a ward and bed before admitting");
        }

        const patient = await prisma.patient_bio_data.findUnique({
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
            allowUnassigned: isEmergencyType(existing.admission_type),
        });

        try {

            await prisma.$transaction(async (tx) => {

                await this.assertPatientNotAdmitted(tx, existing.patient_id, existing.admission_id);

                // Re-read under the patient lock: a double click or a
                // concurrent cancel of this same request is caught here.
                const current = await tx.admission.findUnique({
                    where: { admission_id: existing.admission_id },
                    select: { status: true, encounter_no: true },
                });
                if (current?.status !== IPD_STATUS.PLANNED) {
                    throw new Error("This admission request has already been admitted or cancelled");
                }

                await this.claimBed(tx, bedId, existing.admission_id);

                const admittedAt = new Date();

                const encounterNo = current.encounter_no
                    ?? await this.openIpEncounter(tx, existing, existing.employee_id ?? null, actor.user_id);

                await this.ipdRepository.updateAdmissionTx(tx, existing.admission_id, {
                    status: IPD_STATUS.ADMITTED,
                    ward_id: wardId,
                    bed_id: bedId,
                    admission_date: admittedAt,
                    encounter_no: encounterNo,
                    updated_by: actor.user_id,
                    updated_at: admittedAt,
                });

                await this.ipdRepository.markBedStatus(
                    tx,
                    bedId,
                    BED_STATUS.OCCUPIED,
                    actor.user_id
                );

                // Admitted into a different bed than the one held for this
                // request: hand the reserved one back.
                await this.ipdRepository.releaseReservations(
                    tx,
                    [existing.admission_id],
                    actor.user_id,
                    bedId
                );

            });

        } catch (error) {
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
    async reserveBed(
        id: string,
        actor: IpdActor,
        data: { ward_id?: string; bed_id?: string } = {}
    ) {

        const existing = await this.getAdmissionForActor(id, actor);

        if (existing.status !== IPD_STATUS.PLANNED) {
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

        if (daysAhead > RESERVATION_MAX_DAYS_AHEAD) {
            throw new Error(
                `A bed can be reserved at most ${RESERVATION_MAX_DAYS_AHEAD} day(s) before the planned date (${plannedIst})`
            );
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
            allowUnassigned: isEmergencyType(existing.admission_type),
        });

        await prisma.$transaction(async (tx) => {

            // Same lock order as admit (patient, then bed), so reserving and
            // admitting the same request are serialized.
            await this.ipdRepository.lockPatientForAdmission(tx, existing.patient_id);

            const current = await tx.admission.findUnique({
                where: { admission_id: existing.admission_id },
                select: { status: true },
            });
            if (current?.status !== IPD_STATUS.PLANNED) {
                throw new Error("This admission request has already been admitted or cancelled");
            }

            await this.claimBed(tx, bedId, existing.admission_id);

            await this.ipdRepository.releaseReservations(
                tx,
                [existing.admission_id],
                actor.user_id,
                bedId
            );

            await this.ipdRepository.reserveBed(
                tx,
                bedId,
                existing.admission_id,
                reservedUntil,
                actor.user_id
            );

            await this.ipdRepository.updateAdmissionTx(tx, existing.admission_id, {
                ward_id: wardId,
                bed_id: bedId,
                updated_by: actor.user_id,
                updated_at: new Date(),
            });

        });

        return this.getAdmissionByIpNumber(existing.admission_id);

    }

    async releaseReservation(id: string, actor: IpdActor) {

        const existing = await this.getAdmissionForActor(id, actor);

        const result = await prisma.$transaction((tx) =>
            this.ipdRepository.releaseReservations(tx, [existing.admission_id], actor.user_id)
        );

        if (result.count === 0) {
            throw new Error("This admission has no bed reserved");
        }

        return this.getAdmissionByIpNumber(existing.admission_id);

    }

    async cancelPlanned(id: string, actor: IpdActor, reason?: string) {

        return this.closePlanned(id, actor, IPD_STATUS.CANCELLED, reason);

    }

    async markNoShow(id: string, actor: IpdActor, reason?: string) {

        return this.closePlanned(id, actor, IPD_STATUS.NO_SHOW, reason);

    }

    /*
     * PLANNED -> CANCELLED / NO_SHOW, giving back any bed the request held.
     * Takes the patient lock like admit does, and the status guard in the
     * WHERE means a request that was admitted meanwhile is never closed.
     */
    private async closePlanned(
        id: string,
        actor: IpdActor,
        status: typeof IPD_STATUS.CANCELLED | typeof IPD_STATUS.NO_SHOW,
        reason?: string
    ) {

        const existing = await this.getAdmissionForActor(id, actor);

        const verb = status === IPD_STATUS.CANCELLED ? "cancelled" : "marked as no-show";

        if (existing.status !== IPD_STATUS.PLANNED) {
            throw new Error(`Only a planned admission can be ${verb} (this one is ${existing.status})`);
        }

        if (
            status === IPD_STATUS.NO_SHOW &&
            istDayDiff(istDateString(new Date()), istDateString(new Date(existing.admission_date))) > 0
        ) {
            throw new Error("A planned admission can't be marked as no-show before its planned date");
        }

        await prisma.$transaction(async (tx) => {

            await this.ipdRepository.lockPatientForAdmission(tx, existing.patient_id);

            const result = await tx.admission.updateMany({
                where: { admission_id: existing.admission_id, status: IPD_STATUS.PLANNED },
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

            // A daycare request and its doctor slot live and die together.
            if (existing.appointment_id) {
                await tx.appointment_history.updateMany({
                    where: {
                        appointment_id: existing.appointment_id,
                        status: { in: ["SCHEDULED", "RESCHEDULED"] },
                    },
                    data:
                        status === IPD_STATUS.CANCELLED
                            ? {
                                status: "CANCELLED",
                                cancel_reason: (reason?.trim() || `Daycare request ${existing.ip_number} cancelled`).slice(0, 100),
                                cancelled_at: new Date(),
                                cancelled_by: actor.user_id,
                                notification_status: "NOT_REQUIRED",
                            }
                            : { status: "NO_SHOW", notification_status: "NOT_REQUIRED" },
                });
            }

        });

        return this.getAdmissionByIpNumber(existing.admission_id);

    }

    /*
     * The other direction: an appointment was cancelled / marked no-show, so
     * the PLANNED daycare request booked with it follows (and gives back any
     * bed it held). Runs in the appointment update's own transaction.
     */
    async closePlannedForAppointment(
        tx: Prisma.TransactionClient,
        appointmentId: string,
        status: typeof IPD_STATUS.CANCELLED | typeof IPD_STATUS.NO_SHOW,
        reason: string | undefined,
        updatedBy: string
    ) {

        const linked = await tx.admission.findMany({
            where: { appointment_id: appointmentId, status: IPD_STATUS.PLANNED },
            select: { admission_id: true },
        });

        if (linked.length === 0) return 0;

        const ids = linked.map((a) => a.admission_id);

        const result = await tx.admission.updateMany({
            where: { admission_id: { in: ids }, status: IPD_STATUS.PLANNED },
            data: {
                status,
                cancellation_reason:
                    reason?.trim() ||
                    (status === IPD_STATUS.CANCELLED ? "Linked appointment cancelled" : "Linked appointment marked no-show"),
                updated_by: updatedBy,
                updated_at: new Date(),
            },
        });

        await this.ipdRepository.releaseReservations(tx, ids, updatedBy);

        return result.count;

    }

    /** The PLANNED daycare request booked with this appointment, if any. */
    async findPlannedDaycareForAppointment(appointmentId: string) {

        return prisma.admission.findFirst({
            where: { appointment_id: appointmentId, status: IPD_STATUS.PLANNED, is_daycare: true },
            select: { ip_number: true },
        });

    }

    // ---------------------------------------------------------------- daycare

    /** Beds of a ward that can take a daycare patient (active, not under maintenance). */
    private async countDaycareCapacity(client: Prisma.TransactionClient | typeof prisma, wardId: string) {

        return client.bed_master.count({
            where: {
                ward_id: wardId,
                active_status: 1,
                status: { not: BED_STATUS.MAINTENANCE },
            },
        });

    }

    /*
     * Daycare sessions (planned or running) in a ward that touch one IST day.
     * A session runs from admission_date for expected_stay_days; one without a
     * duration is assumed to run to the end of that day.
     */
    private async daycareSlotsForDay(
        client: Prisma.TransactionClient | typeof prisma,
        wardId: string,
        istDate: string
    ): Promise<DaycareSlot[]> {

        const dayStart = startOfIstDay(istDate);
        const dayEnd = new Date(dayStart.getTime() + DAY_MS);

        const rows = await client.admission.findMany({
            where: {
                ward_id: wardId,
                is_daycare: true,
                status: { in: [IPD_STATUS.PLANNED, IPD_STATUS.ADMITTED] },
                admission_date: { lt: dayEnd },
            },
            select: {
                admission_id: true,
                ip_number: true,
                status: true,
                admission_date: true,
                expected_stay_days: true,
            },
        });

        return rows
            .map((r) => {
                const start = new Date(r.admission_date);
                const stay = Number(r.expected_stay_days) || 0;
                const end = stay > 0
                    ? new Date(start.getTime() + stay * DAY_MS)
                    : new Date(startOfIstDay(istDateString(start)).getTime() + DAY_MS);
                return { admission_id: r.admission_id, ip_number: r.ip_number, status: r.status, start, end };
            })
            .filter((s) => s.end > dayStart);

    }

    /** Capacity and booked sessions of a daycare ward on one IST day (booking form). */
    async getDaycareOccupancy(wardId: string, istDate: string, actor: IpdActor) {

        const ward = await this.ipdRepository.findWardById(wardId);
        if (!ward) {
            throw httpError("Ward not found", 404);
        }

        await this.assertBranchAccess(actor, ward.branch_id);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(istDate ?? ""))) {
            throw new Error("A valid date (yyyy-MM-dd) is required");
        }

        const [capacity, slots] = await Promise.all([
            this.countDaycareCapacity(prisma, wardId),
            this.daycareSlotsForDay(prisma, wardId, istDate),
        ]);

        return {
            ward_id: wardId,
            date: istDate,
            capacity,
            bookings: slots.map((s) => ({
                ip_number: s.ip_number,
                status: s.status,
                start: s.start.toISOString(),
                end: s.end.toISOString(),
            })),
        };

    }

    /*
     * Step 1 of a daycare booking (DaycareService.book): under the ward row
     * lock, check the ward still has a free place for the whole session and
     * create the PLANNED daycare request. The caller then books the doctor's
     * slot and links it -- or discards this request if that fails.
     */
    async createDaycareRequest(data: DaycareBookingDTO, actor: IpdActor) {

        const clean = (val?: any): string | null => {
            const str = val === null || val === undefined ? "" : String(val).trim();
            return str.length > 0 ? str : null;
        };

        const patientId = clean(data.patient_id);
        const branchId = clean(data.branch_id);
        const departmentId = clean(data.department_id);
        const employeeId = clean(data.employee_id);
        const wardId = clean(data.ward_id);
        const bedId = clean(data.bed_id);

        if (!patientId) throw new Error("Patient is required");
        if (!branchId) throw new Error("Branch is required");
        if (!wardId) throw new Error("Ward is required for a daycare booking");

        const stay = Number(data.expected_stay_days);
        if (!(stay > 0) || stay > 1) {
            throw new Error("Daycare duration must be more than 0 and at most 24 hours");
        }

        const start = istSlotToUtc(data.appointment_date, data.appointment_time);
        const end = new Date(start.getTime() + stay * DAY_MS);

        const patient = await prisma.patient_bio_data.findUnique({
            where: { patient_id: patientId },
            select: { patient_active: true },
        });
        if (!patient) throw new Error("Patient not found");
        if (patient.patient_active !== "Active") throw new Error("Patient is inactive");

        const branch = await prisma.branch.findUnique({ where: { branch_id: branchId } });
        if (!branch) throw new Error("Branch not found");
        if (branch.branch_status !== "Active") throw new Error("Branch is inactive");

        await this.assertBranchAccess(actor, branchId);

        await this.validateAdmissionContext({ branchId, departmentId, employeeId, wardId, bedId });

        return prisma.$transaction(async (tx) => {

            // Serializes daycare bookings per ward, so two desks can't both
            // take the last place.
            await tx.$queryRawUnsafe(
                `SELECT ward_id FROM public.ward_master WHERE ward_id = $1 FOR UPDATE`,
                wardId
            );

            const capacity = await this.countDaycareCapacity(tx, wardId);
            if (capacity === 0) {
                throw new Error("This ward has no usable beds for daycare");
            }

            const slots = await this.daycareSlotsForDay(tx, wardId, data.appointment_date);
            if (peakDaycareOverlap(slots, start, end) >= capacity) {
                throw new Error("The ward is full for this time -- pick another slot or ward");
            }

            const ipNumber = await this.ipdRepository.generateAdmissionId(tx);

            await this.ipdRepository.createAdmission(tx, {
                admission_id: ipNumber,
                ip_number: ipNumber,
                patient_id: patientId,
                branch_id: branchId,
                department_id: departmentId ?? undefined,
                employee_id: employeeId ?? undefined,
                admission_type: ADMISSION_TYPE.DAYCARE,
                is_daycare: true,
                provisional_diagnosis: data.provisional_diagnosis?.trim() || undefined,
                ward_id: wardId,
                bed_id: bedId ?? undefined,
                payment_mode: data.payment_mode?.trim() || undefined,
                expected_stay_days: stay,
                advance_amount: data.advance_amount !== undefined ? Number(data.advance_amount) : undefined,
                admission_date: start,
                status: IPD_STATUS.PLANNED,
                created_by: actor.user_id,
            });

            return ipNumber;

        });

    }

    async linkDaycareAppointment(admissionId: string, appointmentId: string) {

        return prisma.admission.update({
            where: { admission_id: admissionId },
            data: { appointment_id: appointmentId },
        });

    }

    /** Undoes step 1 when booking the doctor's slot failed (never shown to anyone). */
    async discardDaycareRequest(admissionId: string) {

        return prisma.admission.deleteMany({
            where: { admission_id: admissionId, status: IPD_STATUS.PLANNED, appointment_id: null },
        });

    }

    async dischargeAdmission(
        id: string,
        actor: IpdActor,
        data?: {
            discharge_type?: string;
            discharge_summary?: string;
            discharge_date?: string | Date;
        }
    ) {

        const existing = await this.getAdmissionForActor(id, actor);

        if (existing.status !== IPD_STATUS.ADMITTED) {
            throw new Error("Admission is not currently active");
        }

        const closedBy = actor.user_id;

        const dischargeDate = data?.discharge_date
            ? new Date(data.discharge_date)
            : new Date();

        return await prisma.$transaction(async (tx) => {

            const updated = await this.ipdRepository.updateAdmissionTx(
                tx,
                existing.admission_id,
                {
                    status: IPD_STATUS.DISCHARGED,
                    discharge_date: dischargeDate,
                    discharge_type: data?.discharge_type,
                    discharge_summary: data?.discharge_summary,
                    updated_by: closedBy,
                }
            );

            // The vacated bed needs turning over before the next patient.
            if (existing.bed_id) {
                await this.ipdRepository.markBedStatus(
                    tx,
                    existing.bed_id,
                    BED_STATUS.CLEANING,
                    closedBy
                );
            }

            if (existing.encounter_no) {
                await this.ipdRepository.updateEncounterDischarge(
                    tx,
                    existing.encounter_no,
                    dischargeDate,
                    closedBy
                );
            }

            if (existing.appointment_id) {
                await this.ipdRepository.updateAppointmentCompleted(
                    tx,
                    existing.appointment_id
                );
            }

            return updated;

        });

    }

    async transferAdmission(
        id: string,
        targetWardId: string,
        targetBedId: string,
        reason: string | undefined,
        actor: IpdActor
    ) {

        const existing = await this.getAdmissionForActor(id, actor);

        if (existing.status !== IPD_STATUS.ADMITTED) {
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
        if (targetBed.status !== BED_STATUS.AVAILABLE) {
            throw new Error("Target bed is not available");
        }

        const transferredBy = actor.user_id;

        try {

            return await prisma.$transaction(async (tx) => {

                await this.claimBed(tx, targetBedId, existing.admission_id, "Target bed is not available");

                // The vacated bed needs turning over before the next patient.
                if (existing.bed_id) {
                    await this.ipdRepository.markBedStatus(
                        tx,
                        existing.bed_id,
                        BED_STATUS.CLEANING,
                        transferredBy
                    );
                }

                await this.ipdRepository.markBedStatus(
                    tx,
                    targetBedId,
                    BED_STATUS.OCCUPIED,
                    transferredBy
                );

                const transferLogId = await this.ipdRepository.generateId(
                    tx,
                    "ADMISSION_TRANSFER"
                );

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

                return await this.ipdRepository.updateAdmissionTx(
                    tx,
                    existing.admission_id,
                    {
                        ward_id: targetWardId,
                        bed_id: targetBedId,
                        updated_by: transferredBy,
                    }
                );

            });

        } catch (error) {
            this.rethrowAdmissionConflict(error);
        }

    }

    async getAdmittedPatientsToday(branchId?: string) {

        const today = new Date().toISOString().slice(0, 10);
        const todayDate = new Date(`${today}T00:00:00.000Z`);

        return prisma.admission.count({
            where: {
                ...(branchId ? { branch_id: branchId } : {}),
                admission_date: {
                    gte: todayDate,
                },
                status: IPD_STATUS.ADMITTED,
            },
        });

    }

    async getIpdOverview(branchId?: string) {

        const [totalPatients, bedsOccupied, totalBeds] = await Promise.all([
            prisma.admission.count({
                where: {
                    ...(branchId ? { branch_id: branchId } : {}),
                    status: IPD_STATUS.ADMITTED,
                },
            }),
            prisma.bed_master.count({
                where: {
                    ...(branchId ? { branch_id: branchId } : {}),
                    active_status: 1,
                    status: "OCCUPIED",
                },
            }),
            prisma.bed_master.count({
                where: {
                    ...(branchId ? { branch_id: branchId } : {}),
                    active_status: 1,
                },
            }),
        ]);

        return { totalPatients, bedsOccupied, totalBeds };

    }

    async listWards(branchId?: string) {

        return this.ipdRepository.listWards(branchId);

    }

    /*
     * Beds with who is in them (occupant) and who they are held for
     * (reserved_for) -- what the bed board renders.
     */
    async listBeds(wardId?: string, branchId?: string) {

        const beds = await this.ipdRepository.listBeds(wardId, branchId);

        const holderIds = [
            ...new Set(
                beds
                    .filter((b) => b.status === BED_STATUS.RESERVED && b.reserved_admission_id)
                    .map((b) => b.reserved_admission_id as string)
            ),
        ];
        const holders = await this.ipdRepository.findReservationHolders(holderIds);
        const holderById = new Map(holders.map((h) => [h.admission_id, h]));

        return beds.map(({ admission, ...bed }) => ({
            ...bed,
            occupant: admission ?? null,
            reserved_for:
                bed.status === BED_STATUS.RESERVED && bed.reserved_admission_id
                    ? holderById.get(bed.reserved_admission_id) ?? null
                    : null,
        }));

    }

    async createWard(data: {
        branch_id: string;
        ward_name: string;
        ward_type?: string;
        floor?: string;
        total_beds?: number;
        tariff?: number;
    }, user?: any) {
        await this.assertBranchAccess(user, data.branch_id);

        const existing = await this.ipdRepository.findWardByBranchAndName(data.branch_id, data.ward_name);
        if (existing) {
            throw new Error(`Ward '${data.ward_name}' already exists in this branch`);
        }

        return prisma.$transaction(async (tx) => {
            const ward_id = await generateId(tx, "WARD");
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

    async updateWard(wardId: string, data: UpdateWardDTO, user?: any) {

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
            const admittedCount = await prisma.admission.count({
                where: { ward_id: wardId, status: IPD_STATUS.ADMITTED },
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

    async createBed(data: {
        ward_id: string;
        branch_id?: string;
        bed_number: string;
        bed_type?: string;
        tariff?: number;
        status?: string;
    }, user?: any) {
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
        if (data.status && !(MANUAL_BED_STATUSES as readonly string[]).includes(data.status)) {
            throw new Error(`A new bed can only start as one of: ${MANUAL_BED_STATUSES.join(", ")}`);
        }

        const existingBed = await this.ipdRepository.findBedByWardAndNumber(data.ward_id, data.bed_number);
        if (existingBed) {
            throw new Error(`Bed '${data.bed_number}' already exists in this ward`);
        }

        return prisma.$transaction(async (tx) => {
            const bed_id = await generateId(tx, "BED");
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

    async updateBed(bedId: string, data: UpdateBedDTO, user?: any) {

        const bed = await this.ipdRepository.findBedById(bedId);
        if (!bed) {
            throw new Error("Bed not found");
        }

        await this.assertBranchAccess(user, bed.branch_id);

        if (bed.status === BED_STATUS.OCCUPIED) {
            throw new Error("Bed is currently occupied by an admitted patient and cannot be edited");
        }

        if (bed.status === BED_STATUS.RESERVED) {
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

        return prisma.$transaction(async (tx) => {

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
            } else if (wasActive !== willBeActive) {
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

    async updateBedStatus(bedId: string, status: string, user?: any, remarks?: string) {

        if (!(MANUAL_BED_STATUSES as readonly string[]).includes(status)) {
            throw new Error(`Status must be one of: ${MANUAL_BED_STATUSES.join(", ")}`);
        }

        const bed = await this.ipdRepository.findBedById(bedId);
        if (!bed) {
            throw new Error("Bed not found");
        }

        await this.assertBranchAccess(user, bed.branch_id);

        return prisma.$transaction(async (tx) => {

            // Checked under the row lock, so a concurrent admit / reserve
            // can't be overwritten by a manual status change.
            const locked = await this.ipdRepository.lockBedForAdmission(tx, bedId);
            const current = locked?.[0]?.status;
            const reservedUntil = locked?.[0]?.reserved_until;
            const reservationLapsed = !!reservedUntil && new Date(reservedUntil).getTime() < Date.now();

            if (current === BED_STATUS.OCCUPIED) {
                throw new Error("Bed is currently occupied by an admitted patient and cannot be changed manually");
            }
            if (current === BED_STATUS.RESERVED && !reservationLapsed) {
                throw new Error("Bed is reserved for a planned admission -- release the reservation first");
            }

            return this.ipdRepository.markBedStatus(tx, bedId, status, user?.user_id || "SYSTEM", remarks);

        });

    }

    async deleteWard(wardId: string, user?: any) {
        const ward = await this.ipdRepository.findWardById(wardId);
        if (!ward) {
            throw new Error("Ward not found");
        }

        await this.assertBranchAccess(user, ward.branch_id);

        const admittedCount = await prisma.admission.count({
            where: { ward_id: wardId, status: IPD_STATUS.ADMITTED },
        });
        if (admittedCount > 0) {
            throw new Error("Cannot delete a ward with currently admitted patients");
        }

        const activeBedCount = await this.ipdRepository.countBedsInWard(wardId);
        if (activeBedCount > 0) {
            throw new Error("Cannot delete a ward that still has active beds -- reassign or delete its beds first");
        }

        return prisma.$transaction(async (tx) => {
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

    async deleteBed(bedId: string, user?: any) {
        const bed = await this.ipdRepository.findBedById(bedId);
        if (!bed) {
            throw new Error("Bed not found");
        }

        await this.assertBranchAccess(user, bed.branch_id);

        if (bed.status === BED_STATUS.OCCUPIED) {
            throw new Error("Cannot delete an occupied bed");
        }

        if (bed.status === BED_STATUS.RESERVED) {
            throw new Error("Cannot delete a bed reserved for a planned admission");
        }

        const activeAdmissionCount = await prisma.admission.count({
            where: { bed_id: bedId, status: IPD_STATUS.ADMITTED },
        });
        if (activeAdmissionCount > 0) {
            throw new Error("Cannot delete a bed with active admissions");
        }

        return prisma.$transaction(async (tx) => {
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

