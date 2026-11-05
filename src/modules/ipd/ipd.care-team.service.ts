import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { generateIdBatch } from "../../utils/idGenerator";
import { ADMIN, BRANCH_ADMIN, NURSE, TOP_LEVEL_ADMIN_ROLES } from "../../permissions/roles";
import { IpdService } from "./ipd.service";
import { DutyRosterService } from "./duty-roster/dutyRoster.service";
import {
    AllocateCareTeamDTO,
    BulkAllocateCareTeamDTO,
    IpdActor,
    IPD_STATUS,
} from "./ipd.types";
import {
    CARE_TEAM_END_REASON,
    CARE_TEAM_ROLE,
    IST_OFFSET_MS,
} from "./ipd.constants";
import { EmployeeRepository } from "../employee/employee.repository";

const httpError = (message: string, status: number) => {
    const err: any = new Error(message);
    err.status = status;
    return err;
};

// A whole ward is touched in one transaction; same headroom the chemo
// bulk writes use for the high-latency database.
const BULK_TX_OPTIONS = { timeout: 20000 };

// Roles that may re-roster a whole ward at a staff change (a charge nurse or
// an admin). A doctor can still hand over their own patients one by one.
const BULK_ROLES = [...TOP_LEVEL_ADMIN_ROLES, BRANCH_ADMIN, ADMIN, NURSE];

/** The IST calendar day (yyyy-MM-dd) of an instant. */
const istDate = (at: Date) => new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

const fullName = (e?: { first_name?: string | null; middle_name?: string | null; last_name?: string | null } | null) =>
    [e?.first_name, e?.middle_name, e?.last_name].filter(Boolean).join(" ");

interface AllocationPlan {
    /** undefined = leave unchanged, null = clear, string = employee_id */
    doctor?: string | null;
    nurse?: string | null;
    notes: string | null;
}

/*
 * Duty doctor / primary nurse allocation and handover. Times are tracked
 * automatically: a row starts when it is saved and ends when the person is
 * replaced or removed, or the patient is discharged.
 *
 * admission_care_team is append-only history; admission.current_* mirror the
 * active rows. Every change closes the role's active row and opens a new one
 * in one transaction, under a lock on the admission row(s), so the
 * "one active row per role" index can never be tripped by a race.
 * Lives apart from IpdService (like DaycareService) and reuses its branch
 * isolation and admission lookup.
 */
export class CareTeamService {

    constructor(
        private readonly ipd: IpdService = new IpdService(),
        private readonly employees: EmployeeRepository = new EmployeeRepository(),
        private readonly dutyRoster: DutyRosterService = new DutyRosterService()
    ) {}

    /* The doctor/nurse must exist, hold the right role, be active, and work at the branch. */
    private async assertStaff(
        employeeId: string,
        role: "DOCTOR" | "NURSE",
        branchId: string,
        checkAvailability = false
    ) {

        const label = role === "DOCTOR" ? "Doctor" : "Nurse";

        const employee = await prisma.employees.findUnique({
            where: { employee_id: employeeId },
            select: {
                employee_id: true,
                emp_status: true,
                deleted_at: true,
                user_table: { select: { role_type: true } },
            },
        });

        if (!employee || employee.deleted_at) {
            throw httpError(`${label} not found`, 400);
        }
        if (String(employee.user_table?.role_type ?? "").toUpperCase() !== role) {
            throw httpError(`Selected employee is not a ${label.toLowerCase()}`, 400);
        }
        if (employee.emp_status !== true) {
            throw httpError(`${label} is inactive`, 400);
        }

        const mapping = await prisma.user_branch_mapping.findFirst({
            where: { employee_id: employeeId, branch_id: branchId, status: 1 },
            select: { id: true },
        });
        if (!mapping) {
            throw httpError(`${label} is not assigned to this branch`, 400);
        }

        // A duty doctor or nurse being allocated to a care team must not be on
        // approved leave today. (Duty schedule is managed via staff_duty_roster,
        // independent of OPD clinic consultation slots in doctor_schedule).
        if (checkAvailability) {
            // DATE columns: compare against today's IST calendar day at UTC midnight,
            // not the current UTC instant (which is yesterday before 05:30 IST).
            const today = new Date(`${istDate(new Date())}T00:00:00.000Z`);
            const onLeave = await prisma.doctor_leave.findFirst({
                where: {
                    employee_id: employeeId,
                    status: "APPROVED",
                    leave_start_date: { lte: today },
                    leave_end_date: { gte: today },
                },
            });
            if (onLeave) {
                throw httpError(`${label} is on approved leave today`, 400);
            }
        }

    }

    /*
     * `currentDoctorIds` are the duty doctors the targeted admissions already
     * have: keeping the same doctor is never blocked by today's availability,
     * only putting a different one on duty is.
     */
    private async buildPlan(
        dto: AllocateCareTeamDTO,
        branchId: string,
        currentDoctorIds: Array<string | null | undefined>,
        currentNurseIds: Array<string | null | undefined> = []
    ): Promise<AllocationPlan> {

        if (dto.assigned_doctor_id === undefined && dto.nurse_id === undefined) {
            throw httpError("Select a duty doctor or a nurse", 400);
        }

        const notes = dto.handover_notes?.trim() || null;
        let overridden = false;

        /*
         * Putting someone NEW on duty is checked against the roster (when the
         * branch keeps one for that role) as well as leave. An emergency
         * override is allowed, but only with a written reason, and it is
         * recorded in the handover note so the history shows who was off-roster.
         */
        const guard = async (
            employeeId: string,
            role: "DOCTOR" | "NURSE",
            currentIds: Array<string | null | undefined>
        ) => {
            const unchangedEverywhere = currentIds.every((id) => id === employeeId);
            await this.assertStaff(employeeId, role, branchId, !unchangedEverywhere);
            if (unchangedEverywhere) return;

            const { enforced, onDuty } = await this.dutyRoster.checkOnDuty(
                branchId,
                employeeId,
                role === "DOCTOR" ? "DUTY_DOCTOR" : "DUTY_NURSE"
            );
            if (!enforced || onDuty) return;

            if (!dto.roster_override) {
                throw httpError(
                    `${role === "DOCTOR" ? "Doctor" : "Nurse"} is not on the duty roster for the current shift. ` +
                    `Pick rostered staff, or use Emergency Override with a reason.`,
                    409
                );
            }
            if (!notes) {
                throw httpError("A reason in the handover notes is required for an emergency override", 400);
            }
            overridden = true;
        };

        if (dto.assigned_doctor_id) await guard(dto.assigned_doctor_id, "DOCTOR", currentDoctorIds);
        if (dto.nurse_id) await guard(dto.nurse_id, "NURSE", currentNurseIds);

        return {
            doctor: dto.assigned_doctor_id,
            nurse: dto.nurse_id,
            notes: overridden ? `[ROSTER OVERRIDE] ${notes}` : notes,
        };

    }

    /*
     * Applies one plan to the given admissions inside the caller's
     * transaction. Locks the admission rows, re-checks they are still ADMITTED,
     * closes the replaced rows, opens the new ones and updates the roster
     * pointers. Returns the admissions that actually changed.
     */
    private async applyAllocation(
        tx: Prisma.TransactionClient,
        admissionIds: string[],
        plan: AllocationPlan,
        actor: IpdActor
    ) {

        const locked = await tx.$queryRawUnsafe<Array<{ admission_id: string; status: string }>>(
            `SELECT admission_id, status FROM public.admission WHERE admission_id = ANY($1::varchar[]) FOR UPDATE`,
            admissionIds
        );
        const stillAdmitted = new Set(
            locked.filter((r) => r.status === IPD_STATUS.ADMITTED).map((r) => r.admission_id)
        );
        if (admissionIds.some((id) => !stillAdmitted.has(id))) {
            throw httpError("Care team can only be assigned to an admitted patient", 409);
        }

        const now = new Date();
        const changed = new Set<string>();

        const roles = [
            { role: CARE_TEAM_ROLE.ASSIGNED_DOCTOR, value: plan.doctor, pointer: "current_assigned_doctor_id" as const },
            { role: CARE_TEAM_ROLE.PRIMARY_NURSE, value: plan.nurse, pointer: "current_nurse_id" as const },
        ];

        for (const { role, value, pointer } of roles) {

            if (value === undefined) continue;

            const active = await tx.admission_care_team.findMany({
                where: { admission_id: { in: admissionIds }, role_in_team: role, is_active: true },
            });
            const activeByAdmission = new Map(active.map((a) => [a.admission_id, a]));

            const toClose: bigint[] = [];
            const toOpen: string[] = [];

            for (const admissionId of admissionIds) {

                const current = activeByAdmission.get(admissionId);

                if (value === null) {
                    if (current) toClose.push(current.id);
                    if (current) changed.add(admissionId);
                    continue;
                }

                // Same person and no new note: nothing to record.
                const unchanged =
                    current &&
                    current.employee_id === value &&
                    !plan.notes;
                if (unchanged) continue;

                if (current) toClose.push(current.id);
                toOpen.push(admissionId);
                changed.add(admissionId);

            }

            if (toClose.length > 0) {
                await tx.admission_care_team.updateMany({
                    where: { id: { in: toClose } },
                    data: {
                        is_active: false,
                        end_time: now,
                        end_reason: value === null ? CARE_TEAM_END_REASON.REMOVED : CARE_TEAM_END_REASON.HANDOVER,
                    },
                });
            }

            if (value !== null && toOpen.length > 0) {

                const ids = await generateIdBatch(tx, "CARE_TEAM", toOpen.length);

                await tx.admission_care_team.createMany({
                    data: toOpen.map((admissionId, i) => ({
                        assignment_id: ids[i],
                        admission_id: admissionId,
                        employee_id: value,
                        role_in_team: role,
                        start_time: now,
                        handover_notes: plan.notes,
                        assigned_by: actor.user_id,
                    })),
                });

                await tx.admission.updateMany({
                    where: { admission_id: { in: toOpen } },
                    data: { [pointer]: value },
                });

            } else if (value === null) {

                await tx.admission.updateMany({
                    where: { admission_id: { in: admissionIds } },
                    data: { [pointer]: null },
                });

            }

        }

        return [...changed];

    }

    /** Allocate / hand over the duty doctor and/or nurse of one admission. */
    async allocate(id: string, dto: AllocateCareTeamDTO, actor: IpdActor) {

        const admission = await this.ipd.getAdmissionForActor(id, actor);

        if (admission.status !== IPD_STATUS.ADMITTED) {
            throw httpError("Care team can only be assigned to an admitted patient", 400);
        }

        const plan = await this.buildPlan(
            dto,
            admission.branch_id,
            [admission.current_assigned_doctor_id],
            [admission.current_nurse_id]
        );

        await prisma.$transaction(
            (tx) => this.applyAllocation(tx, [admission.admission_id], plan, actor),
            BULK_TX_OPTIONS
        );

        return this.getCareTeam(admission.admission_id, actor);

    }

    /*
     * Re-roster many admitted patients of one ward at a staff change. All or
     * nothing: every admission must be ADMITTED, in the stated ward and branch.
     */
    async bulkAllocate(dto: BulkAllocateCareTeamDTO, actor: IpdActor) {

        const role = String(actor.role ?? "").toUpperCase();
        if (!BULK_ROLES.some((r) => r === role)) {
            throw httpError("Only a nurse or an admin can allocate a whole ward", 403);
        }

        await this.ipd.assertBranchAccess(actor, dto.branch_id);

        const ward = await prisma.ward_master.findUnique({
            where: { ward_id: dto.ward_id },
            select: { ward_id: true, branch_id: true, active_status: true },
        });
        if (!ward) throw httpError("Ward not found", 404);
        if (ward.branch_id !== dto.branch_id) {
            throw httpError("Ward does not belong to the selected branch", 400);
        }

        const admissionIds = [...new Set(dto.admission_ids)];

        const admissions = await prisma.admission.findMany({
            where: { admission_id: { in: admissionIds } },
            select: {
                admission_id: true,
                ip_number: true,
                status: true,
                ward_id: true,
                branch_id: true,
                current_assigned_doctor_id: true,
                current_nurse_id: true,
            },
        });

        const byId = new Map(admissions.map((a) => [a.admission_id, a]));
        const problems = admissionIds.filter((admissionId) => {
            const a = byId.get(admissionId);
            return !a || a.status !== IPD_STATUS.ADMITTED || a.ward_id !== dto.ward_id || a.branch_id !== dto.branch_id;
        });
        if (problems.length > 0) {
            throw httpError(
                `These admissions are not admitted patients of the selected ward: ${problems.join(", ")}`,
                400
            );
        }

        const plan = await this.buildPlan(
            dto,
            dto.branch_id,
            admissions.map((a) => a.current_assigned_doctor_id),
            admissions.map((a) => a.current_nurse_id)
        );

        const changed = await prisma.$transaction(
            (tx) => this.applyAllocation(tx, admissionIds, plan, actor),
            BULK_TX_OPTIONS
        );

        return {
            ward_id: dto.ward_id,
            requested: admissionIds.length,
            updated: changed.length,
            unchanged: admissionIds.length - changed.length,
        };

    }

    /*
     * Current duty team plus the full history (newest first) with handover
     * notes -- read-only, so it is also valid for a discharged admission.
     */
    async getCareTeam(id: string, actor: IpdActor) {

        const admission = await this.ipd.getAdmissionForActor(id, actor);

        const rows = await prisma.admission_care_team.findMany({
            where: { admission_id: admission.admission_id },
            orderBy: [{ start_time: "desc" }, { id: "desc" }],
            include: {
                employees: {
                    select: {
                        employee_id: true,
                        first_name: true,
                        middle_name: true,
                        last_name: true,
                        designation: true,
                        specialization: true,
                    },
                },
            },
        });

        // assigned_by holds a user_id; show the person's name.
        const userIds = [...new Set(rows.map((r) => r.assigned_by).filter((u): u is string => !!u))];
        const assigners = userIds.length
            ? await prisma.employees.findMany({
                  where: { user_id: { in: userIds } },
                  select: { user_id: true, first_name: true, middle_name: true, last_name: true },
              })
            : [];
        const assignerName = new Map(assigners.map((e) => [e.user_id, fullName(e)]));

        const history = rows.map((r) => ({
            assignment_id: r.assignment_id,
            role_in_team: r.role_in_team,
            employee_id: r.employee_id,
            employee_name: fullName(r.employees),
            designation: r.employees.designation,
            specialization: r.employees.specialization,
            start_time: r.start_time,
            end_time: r.end_time,
            is_active: r.is_active,
            end_reason: r.end_reason,
            handover_notes: r.handover_notes,
            assigned_by: r.assigned_by,
            assigned_by_name: (r.assigned_by && assignerName.get(r.assigned_by)) || r.assigned_by,
        }));

        return {
            admission_id: admission.admission_id,
            ip_number: admission.ip_number,
            status: admission.status,
            consultant: admission.employees
                ? { ...admission.employees, employee_name: fullName(admission.employees) }
                : null,
            current: {
                assigned_doctor: history.find((h) => h.is_active && h.role_in_team === CARE_TEAM_ROLE.ASSIGNED_DOCTOR) ?? null,
                nurse: history.find((h) => h.is_active && h.role_in_team === CARE_TEAM_ROLE.PRIMARY_NURSE) ?? null,
            },
            history,
        };

    }

}
