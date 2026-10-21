"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CareTeamService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const idGenerator_1 = require("../../utils/idGenerator");
const roles_1 = require("../../permissions/roles");
const ipd_service_1 = require("./ipd.service");
const dutyRoster_service_1 = require("./duty-roster/dutyRoster.service");
const ipd_types_1 = require("./ipd.types");
const ipd_constants_1 = require("./ipd.constants");
const employee_repository_1 = require("../employee/employee.repository");
const httpError = (message, status) => {
    const err = new Error(message);
    err.status = status;
    return err;
};
// A whole ward is touched in one transaction; same headroom the chemo
// bulk writes use for the high-latency database.
const BULK_TX_OPTIONS = { timeout: 20000 };
// Roles that may re-roster a whole ward at a staff change (a charge nurse or
// an admin). A doctor can still hand over their own patients one by one.
const BULK_ROLES = [...roles_1.TOP_LEVEL_ADMIN_ROLES, roles_1.BRANCH_ADMIN, roles_1.ADMIN, roles_1.NURSE];
/** The IST calendar day (yyyy-MM-dd) of an instant. */
const istDate = (at) => new Date(at.getTime() + ipd_constants_1.IST_OFFSET_MS).toISOString().slice(0, 10);
const fullName = (e) => [e?.first_name, e?.middle_name, e?.last_name].filter(Boolean).join(" ");
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
class CareTeamService {
    ipd;
    employees;
    dutyRoster;
    constructor(ipd = new ipd_service_1.IpdService(), employees = new employee_repository_1.EmployeeRepository(), dutyRoster = new dutyRoster_service_1.DutyRosterService()) {
        this.ipd = ipd;
        this.employees = employees;
        this.dutyRoster = dutyRoster;
    }
    /* The doctor/nurse must exist, hold the right role, be active, and work at the branch. */
    async assertStaff(employeeId, role, branchId, checkAvailability = false) {
        const label = role === "DOCTOR" ? "Doctor" : "Nurse";
        const employee = await prisma_1.default.employees.findUnique({
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
        const mapping = await prisma_1.default.user_branch_mapping.findFirst({
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
            const onLeave = await prisma_1.default.doctor_leave.findFirst({
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
    async buildPlan(dto, branchId, currentDoctorIds, currentNurseIds = []) {
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
        const guard = async (employeeId, role, currentIds) => {
            const unchangedEverywhere = currentIds.every((id) => id === employeeId);
            await this.assertStaff(employeeId, role, branchId, !unchangedEverywhere);
            if (unchangedEverywhere)
                return;
            const { enforced, onDuty } = await this.dutyRoster.checkOnDuty(branchId, employeeId, role === "DOCTOR" ? "DUTY_DOCTOR" : "DUTY_NURSE");
            if (!enforced || onDuty)
                return;
            if (!dto.roster_override) {
                throw httpError(`${role === "DOCTOR" ? "Doctor" : "Nurse"} is not on the duty roster for the current shift. ` +
                    `Pick rostered staff, or use Emergency Override with a reason.`, 409);
            }
            if (!notes) {
                throw httpError("A reason in the handover notes is required for an emergency override", 400);
            }
            overridden = true;
        };
        if (dto.assigned_doctor_id)
            await guard(dto.assigned_doctor_id, "DOCTOR", currentDoctorIds);
        if (dto.nurse_id)
            await guard(dto.nurse_id, "NURSE", currentNurseIds);
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
    async applyAllocation(tx, admissionIds, plan, actor) {
        const locked = await tx.$queryRawUnsafe(`SELECT admission_id, status FROM public.admission WHERE admission_id = ANY($1::varchar[]) FOR UPDATE`, admissionIds);
        const stillAdmitted = new Set(locked.filter((r) => r.status === ipd_types_1.IPD_STATUS.ADMITTED).map((r) => r.admission_id));
        if (admissionIds.some((id) => !stillAdmitted.has(id))) {
            throw httpError("Care team can only be assigned to an admitted patient", 409);
        }
        const now = new Date();
        const changed = new Set();
        const roles = [
            { role: ipd_constants_1.CARE_TEAM_ROLE.ASSIGNED_DOCTOR, value: plan.doctor, pointer: "current_assigned_doctor_id" },
            { role: ipd_constants_1.CARE_TEAM_ROLE.PRIMARY_NURSE, value: plan.nurse, pointer: "current_nurse_id" },
        ];
        for (const { role, value, pointer } of roles) {
            if (value === undefined)
                continue;
            const active = await tx.admission_care_team.findMany({
                where: { admission_id: { in: admissionIds }, role_in_team: role, is_active: true },
            });
            const activeByAdmission = new Map(active.map((a) => [a.admission_id, a]));
            const toClose = [];
            const toOpen = [];
            for (const admissionId of admissionIds) {
                const current = activeByAdmission.get(admissionId);
                if (value === null) {
                    if (current)
                        toClose.push(current.id);
                    if (current)
                        changed.add(admissionId);
                    continue;
                }
                // Same person and no new note: nothing to record.
                const unchanged = current &&
                    current.employee_id === value &&
                    !plan.notes;
                if (unchanged)
                    continue;
                if (current)
                    toClose.push(current.id);
                toOpen.push(admissionId);
                changed.add(admissionId);
            }
            if (toClose.length > 0) {
                await tx.admission_care_team.updateMany({
                    where: { id: { in: toClose } },
                    data: {
                        is_active: false,
                        end_time: now,
                        end_reason: value === null ? ipd_constants_1.CARE_TEAM_END_REASON.REMOVED : ipd_constants_1.CARE_TEAM_END_REASON.HANDOVER,
                    },
                });
            }
            if (value !== null && toOpen.length > 0) {
                const ids = await (0, idGenerator_1.generateIdBatch)(tx, "CARE_TEAM", toOpen.length);
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
            }
            else if (value === null) {
                await tx.admission.updateMany({
                    where: { admission_id: { in: admissionIds } },
                    data: { [pointer]: null },
                });
            }
        }
        return [...changed];
    }
    /** Allocate / hand over the duty doctor and/or nurse of one admission. */
    async allocate(id, dto, actor) {
        const admission = await this.ipd.getAdmissionForActor(id, actor);
        if (admission.status !== ipd_types_1.IPD_STATUS.ADMITTED) {
            throw httpError("Care team can only be assigned to an admitted patient", 400);
        }
        const plan = await this.buildPlan(dto, admission.branch_id, [admission.current_assigned_doctor_id], [admission.current_nurse_id]);
        await prisma_1.default.$transaction((tx) => this.applyAllocation(tx, [admission.admission_id], plan, actor), BULK_TX_OPTIONS);
        return this.getCareTeam(admission.admission_id, actor);
    }
    /*
     * Re-roster many admitted patients of one ward at a staff change. All or
     * nothing: every admission must be ADMITTED, in the stated ward and branch.
     */
    async bulkAllocate(dto, actor) {
        const role = String(actor.role ?? "").toUpperCase();
        if (!BULK_ROLES.some((r) => r === role)) {
            throw httpError("Only a nurse or an admin can allocate a whole ward", 403);
        }
        await this.ipd.assertBranchAccess(actor, dto.branch_id);
        const ward = await prisma_1.default.ward_master.findUnique({
            where: { ward_id: dto.ward_id },
            select: { ward_id: true, branch_id: true, active_status: true },
        });
        if (!ward)
            throw httpError("Ward not found", 404);
        if (ward.branch_id !== dto.branch_id) {
            throw httpError("Ward does not belong to the selected branch", 400);
        }
        const admissionIds = [...new Set(dto.admission_ids)];
        const admissions = await prisma_1.default.admission.findMany({
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
            return !a || a.status !== ipd_types_1.IPD_STATUS.ADMITTED || a.ward_id !== dto.ward_id || a.branch_id !== dto.branch_id;
        });
        if (problems.length > 0) {
            throw httpError(`These admissions are not admitted patients of the selected ward: ${problems.join(", ")}`, 400);
        }
        const plan = await this.buildPlan(dto, dto.branch_id, admissions.map((a) => a.current_assigned_doctor_id), admissions.map((a) => a.current_nurse_id));
        const changed = await prisma_1.default.$transaction((tx) => this.applyAllocation(tx, admissionIds, plan, actor), BULK_TX_OPTIONS);
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
    async getCareTeam(id, actor) {
        const admission = await this.ipd.getAdmissionForActor(id, actor);
        const rows = await prisma_1.default.admission_care_team.findMany({
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
        const userIds = [...new Set(rows.map((r) => r.assigned_by).filter((u) => !!u))];
        const assigners = userIds.length
            ? await prisma_1.default.employees.findMany({
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
                assigned_doctor: history.find((h) => h.is_active && h.role_in_team === ipd_constants_1.CARE_TEAM_ROLE.ASSIGNED_DOCTOR) ?? null,
                nurse: history.find((h) => h.is_active && h.role_in_team === ipd_constants_1.CARE_TEAM_ROLE.PRIMARY_NURSE) ?? null,
            },
            history,
        };
    }
}
exports.CareTeamService = CareTeamService;
