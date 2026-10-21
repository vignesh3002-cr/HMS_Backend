"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowupService = exports.FOLLOWUP_ALERT_DAYS = void 0;
const followup_repository_1 = require("./followup.repository");
const appointment_utils_1 = require("../appointment/appointment.utils");
const appointment_constants_1 = require("../appointment/appointment.constants");
const roles_1 = require("../../permissions/roles");
const repository = new followup_repository_1.FollowupRepository();
/*
 * Follow-up due alerts. A visit's encounter.follow_up_date raises an alert
 * to book the patient's follow-up appointment:
 *   - from the visit (consult) day the doctor assigned it, for 30 days -
 *     "Follow-up in N days" / "Due tomorrow" / "Due today" / "Overdue N
 *     days" - then it is gone (nothing to delete: the visit simply falls
 *     out of this window);
 *   - for the staff of the branch where the patient was consulted (all
 *     branches for Head / Super Admin);
 *   - "Booked" once the patient has a later appointment.
 * Only each user's read / dismissed marks are stored.
 */
exports.FOLLOWUP_ALERT_DAYS = 30;
const BRANCH_ROLES = [roles_1.DOCTOR, roles_1.NURSE, roles_1.RECEPTIONIST, roles_1.ADMIN, roles_1.BRANCH_ADMIN];
const DAY_MS = 86_400_000;
const dateOnly = (iso) => new Date(`${iso}T00:00:00.000Z`);
const isoOf = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);
const fullName = (...parts) => parts.map((part) => (part ?? "").trim()).filter(Boolean).join(" ");
class FollowupService {
    /* The branches the user's alerts cover: null = every branch. Throws
       for a branch the user does not belong to. */
    async scopeFor(userId, role, branchId) {
        const normalized = String(role ?? "").toUpperCase();
        if (roles_1.TOP_LEVEL_ADMIN_ROLES.includes(normalized)) {
            return branchId ? [branchId] : null;
        }
        if (!BRANCH_ROLES.includes(normalized)) {
            return "none";
        }
        const branches = await repository.findActiveBranchIdsForUser(userId);
        if (branchId) {
            if (!branches.includes(branchId)) {
                throw new Error("You do not have access to this branch");
            }
            return [branchId];
        }
        return branches.length > 0 ? branches : "none";
    }
    async listAlerts(userId, role, branchId) {
        const scope = await this.scopeFor(userId, role, branchId);
        if (scope === "none") {
            return { alerts: [], unreadCount: 0, window_days: exports.FOLLOWUP_ALERT_DAYS };
        }
        // Visits from the last 30 days, today included (encounter_ts is IST
        // wall-clock time).
        const today = dateOnly((0, appointment_utils_1.getTodayInIST)());
        const from = addDays(today, -(exports.FOLLOWUP_ALERT_DAYS - 1));
        const before = addDays(today, 1);
        const encounters = await repository.findEncountersWithFollowUp(from, before, scope);
        // One alert per patient: the latest visit's follow-up.
        const latestByPatient = new Map();
        for (const encounter of encounters) {
            if (!latestByPatient.has(encounter.patient_id)) {
                latestByPatient.set(encounter.patient_id, encounter);
            }
        }
        const candidates = [...latestByPatient.values()];
        const earliestVisit = candidates.reduce((min, encounter) => {
            const visit = encounter.encounter_ts ? dateOnly(isoOf(encounter.encounter_ts)) : null;
            return visit && (!min || visit < min) ? visit : min;
        }, null) ?? from;
        const [appointments, states] = await Promise.all([
            repository.findLaterAppointments(candidates.map((encounter) => encounter.patient_id), earliestVisit, [appointment_constants_1.APPOINTMENT_STATUS.CANCELLED, appointment_constants_1.APPOINTMENT_STATUS.NO_SHOW]),
            repository.findStates(userId, candidates.map((encounter) => encounter.encounter_no))
        ]);
        const alerts = candidates.flatMap((encounter) => {
            const followUp = encounter.follow_up_date;
            const followUpIso = isoOf(followUp);
            const state = states.find((row) => row.encounter_no === encounter.encounter_no && isoOf(row.follow_up_date) === followUpIso);
            if (state?.dismissed_at)
                return [];
            // Booked: another appointment of the patient on/after this visit.
            const visitIso = encounter.encounter_ts ? isoOf(encounter.encounter_ts) : null;
            const booked = appointments.find((appointment) => appointment.patient_id === encounter.patient_id &&
                appointment.appointment_id !== encounter.appointment_id &&
                (!visitIso || isoOf(appointment.appointment_date) >= visitIso));
            const daysFromDue = Math.round((today.getTime() - followUp.getTime()) / DAY_MS);
            const dueStatus = daysFromDue < -1 ? "UPCOMING"
                : daysFromDue === -1 ? "DUE_TOMORROW"
                    : daysFromDue === 0 ? "DUE_TODAY" : "OVERDUE";
            const assignedOn = visitIso ? dateOnly(visitIso) : today;
            const patient = encounter.patient_bio_data;
            const doctor = encounter.employees;
            return [{
                    encounter_no: encounter.encounter_no,
                    follow_up_date: followUpIso,
                    visit_date: visitIso,
                    due_status: dueStatus,
                    days_until: Math.max(-daysFromDue, 0),
                    days_overdue: Math.max(daysFromDue, 0),
                    expires_on: isoOf(addDays(assignedOn, exports.FOLLOWUP_ALERT_DAYS - 1)),
                    patient: {
                        patient_id: encounter.patient_id,
                        name: fullName(patient?.patient_first_name, patient?.patient_middle_name, patient?.patient_last_name),
                        gender: patient?.patient_gender ?? null,
                        age: patient?.patient_age ?? null,
                        mobile: patient?.patient_primary_mobile ?? null
                    },
                    doctor: doctor
                        ? {
                            employee_id: doctor.employee_id,
                            name: fullName(doctor.first_name, doctor.middle_name, doctor.last_name),
                            specialization: doctor.specialization ?? null,
                            mobile: doctor.mobile_no ?? null
                        }
                        : null,
                    branch: { branch_id: encounter.branch_id, branch_name: encounter.branch?.branch_name ?? null },
                    department: encounter.department_master
                        ? { department_id: encounter.department_master.department_id, department_name: encounter.department_master.department_name }
                        : null,
                    booked: booked
                        ? { appointment_id: booked.appointment_id, appointment_date: isoOf(booked.appointment_date), status: booked.status }
                        : null,
                    read: Boolean(state?.read_at)
                }];
        });
        // Pending first (due today, overdue - most overdue first, due
        // tomorrow, upcoming - nearest first), then the booked ones.
        const rank = (alert) => alert.booked ? 4
            : alert.due_status === "DUE_TODAY" ? 0
                : alert.due_status === "OVERDUE" ? 1
                    : alert.due_status === "DUE_TOMORROW" ? 2 : 3;
        alerts.sort((a, b) => rank(a) - rank(b) || b.days_overdue - a.days_overdue || a.follow_up_date.localeCompare(b.follow_up_date));
        return {
            alerts,
            unreadCount: alerts.filter((alert) => !alert.booked && !alert.read).length,
            window_days: exports.FOLLOWUP_ALERT_DAYS
        };
    }
    /* Marks the given (or every listed) alert as read for the user. */
    async markRead(userId, role, encounterNos, branchId) {
        const { alerts } = await this.listAlerts(userId, role, branchId);
        const targets = encounterNos ? alerts.filter((alert) => encounterNos.includes(alert.encounter_no)) : alerts;
        const now = new Date();
        for (const alert of targets.filter((item) => !item.read)) {
            await repository.upsertState(userId, alert.encounter_no, dateOnly(alert.follow_up_date), { read_at: now });
        }
        return { updated: targets.length };
    }
    /* Hides one alert for the user (it comes back if the date is moved). */
    async dismiss(userId, role, encounterNo) {
        const { alerts } = await this.listAlerts(userId, role);
        const alert = alerts.find((item) => item.encounter_no === encounterNo);
        if (!alert) {
            throw new Error("Follow-up alert not found");
        }
        await repository.upsertState(userId, encounterNo, dateOnly(alert.follow_up_date), {
            dismissed_at: new Date(),
            read_at: new Date()
        });
        return { encounter_no: encounterNo };
    }
}
exports.FollowupService = FollowupService;
