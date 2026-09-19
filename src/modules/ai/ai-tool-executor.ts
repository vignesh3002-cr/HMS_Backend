import type { AIUserContext } from "./ai-types";
import { canUseTool } from "./ai-permissions";
import { getToolByName } from "./ai-tools";

import { AppointmentService } from "../appointment/appointment.service";
import { PatientService } from "../patient/patient.service";
import { EncounterService } from "../encounter/encounter.service";
import { PrescriptionService } from "../prescription/prescription.service";
import { DepartmentService } from "../department/department.services";
import { NotificationService } from "../notification/notification.service";
import { PriorityFlagsService } from "../priority-flags/priorityFlags.service";

import prisma from "../../config/prisma";

const appointmentService = new AppointmentService();
const patientService = new PatientService();
const encounterService = new EncounterService();
const prescriptionService = new PrescriptionService();
const departmentService = new DepartmentService();
const notificationService = new NotificationService();
const priorityFlagsService = new PriorityFlagsService();

export async function executeAITool(
    toolName: string,
    args: any,
    user: AIUserContext
): Promise<{ success: boolean; output: any; error?: string }> {

    if (!canUseTool(user, toolName)) {
        return {
            success: false,
            output: null,
            error: `You do not have permission to use the ${toolName} tool.`
        };
    }

    try {
        switch (toolName) {
            // ──── PATIENT ────
            case "search_patient":
                return await searchPatient(args, user);
            case "get_patient":
                return await getPatient(args);
            case "create_patient":
                return await createPatient(args, user);
            case "update_patient":
                return await updatePatient(args);

            // ──── APPOINTMENTS ────
            case "search_appointments":
                return await searchAppointments(args, user);
            case "get_appointment":
                return await getAppointment(args);
            case "get_today_appointments":
                return await getTodayAppointments(args, user);
            case "create_appointment":
                return await createAppointment(args, user);
            case "reschedule_appointment":
                return await rescheduleAppointment(args, user);
            case "cancel_appointment":
                return await cancelAppointment(args, user);
            case "get_available_slots":
                return await getAvailableSlots(args);

            // ──── DOCTORS ────
            case "search_doctor":
                return await searchDoctor(args, user);
            case "get_doctor":
                return await getDoctor(args);
            case "get_doctor_schedule":
                return await getDoctorSchedule(args);

            // ──── DEPARTMENTS ────
            case "search_department":
                return await searchDepartment(args);
            case "get_department":
                return await getDepartments();

            // ──── VITALS ────
            case "get_patient_vitals":
                return await getPatientVitals(args, user);
            case "get_latest_vitals":
                return await getLatestVitals(args, user);

            // ──── MEDICINES ────
            case "search_medicine":
                return await searchMedicine(args);

            // ──── PRESCRIPTIONS ────
            case "get_patient_prescriptions":
                return await getPatientPrescriptions(args);
            case "get_prescription":
                return await getPrescription(args);

            // ──── LAB ────
            case "get_patient_lab_orders":
                return await getPatientLabOrders(args);

            // ──── ENCOUNTERS ────
            case "get_patient_encounters":
                return await getPatientEncounters(args, user);

            // ──── DASHBOARD ────
            case "get_dashboard_summary":
                return await getDashboardSummary(args, user);

            // ──── NOTIFICATIONS ────
            case "get_notifications":
                return await getNotifications(user);

            default:
                return {
                    success: false,
                    output: null,
                    error: `Unknown tool: ${toolName}`
                };
        }
    } catch (error: any) {
        return {
            success: false,
            output: null,
            error: error.message || "An unexpected error occurred while executing the operation."
        };
    }
}

// ═══════════════════════════════════════════════════════════════
// PATIENT TOOLS
// ═══════════════════════════════════════════════════════════════

async function searchPatient(args: any, user: AIUserContext) {
    const patients = await patientService.getPatients({
        search: args.query,
        branchId: args.branch_id || user.branch_id,
        limit: args.limit || 10,
        page: 1
    });

    const list = (patients as any)?.patients || (patients as any)?.data || patients;
    if (Array.isArray(list)) {
        return {
            success: true,
            output: list.map((p: any) => ({
                patient_id: p.patient_id,
                name: `${p.patient_first_name} ${p.patient_last_name || ""}`.trim(),
                gender: p.patient_gender,
                dob: p.patient_dob,
                age: p.patient_age,
                mobile: p.patient_primary_mobile,
                email: p.patient_email,
                type: p.patient_type,
                active: p.patient_active
            }))
        };
    }
    return { success: true, output: patients };
}

async function getPatient(args: any) {
    const patient = await patientService.getPatientById(args.patient_id);
    return { success: true, output: patient };
}

async function createPatient(args: any, user: AIUserContext) {
    const result = await patientService.createPatient({
        first_name: args.first_name,
        last_name: args.last_name || "",
        mobile: args.mobile,
        gender: args.gender,
        dob: args.dob,
        age: args.age,
        email: args.email,
        blood_group: args.blood_group,
        patient_type: args.patient_type || "OPD",
        branch_id: args.branch_id,
        username: args.username,
        password: args.password,
        created_by: user.user_id
    }, user.user_id);
    return { success: true, output: result };
}

async function updatePatient(args: any) {
    const { patient_id, ...data } = args;
    const result = await patientService.updatePatient(patient_id, data);
    return { success: true, output: result };
}

// ═══════════════════════════════════════════════════════════════
// APPOINTMENT TOOLS
// ═══════════════════════════════════════════════════════════════

async function searchAppointments(args: any, user: AIUserContext) {
    const appointments = await appointmentService.getAppointments({
        patientId: args.patient_id,
        employeeId: args.employee_id,
        status: args.status,
        date: args.date,
        dateFrom: args.dateFrom,
        dateTo: args.dateTo,
        branchId: args.branch_id || user.branch_id,
        limit: args.limit || 10,
        page: 1
    });
    return { success: true, output: appointments };
}

async function getAppointment(args: any) {
    const appointment = await appointmentService.getAppointmentByNumber(args.appointment_no);
    return { success: true, output: appointment };
}

async function getTodayAppointments(args: any, user: AIUserContext) {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const appointments = await appointmentService.getAppointments({
        employeeId: args.employee_id,
        status: args.status,
        date: dateStr,
        branchId: args.branch_id || user.branch_id,
        limit: 50,
        page: 1
    });
    return { success: true, output: appointments };
}

async function createAppointment(args: any, user: AIUserContext) {
    const result = await appointmentService.bookAppointment({
        patient_id: args.patient_id,
        employee_id: args.employee_id,
        branch_id: args.branch_id,
        department_id: args.department_id,
        appointment_date: args.appointment_date,
        appointment_time: args.appointment_time,
        reason_for_visit: args.reason_for_visit,
        patient_type: args.patient_type,
        patient_visit_type: args.patient_visit_type
    }, user.user_id);
    return { success: true, output: result };
}

async function rescheduleAppointme(args: any, user: AIUserContext) {
    const result = await appointmentService.updateAppointment(
        args.appointment_no,
        {
            appointment_date: args.appointment_date,
            appointment_time: args.appointment_time,
            employee_id: args.employee_id,
            branch_id: args.branch_id
        },
        user.user_id
    );
    return { success: true, output: result };
}

async function rescheduleAppointment(args: any, user: AIUserContext) {
    const result = await appointmentService.updateAppointment(
        args.appointment_no,
        {
            appointment_date: args.appointment_date,
            appointment_time: args.appointment_time,
            employee_id: args.employee_id,
            branch_id: args.branch_id
        },
        user.user_id
    );
    return { success: true, output: result };
}

async function cancelAppointment(args: any, user: AIUserContext) {
    const result = await appointmentService.cancelAppointment(
        args.appointment_no,
        args.cancel_reason,
        user.user_id
    );
    return { success: true, output: result };
}

async function getAvailableSlots(args: any) {
    const slots = await appointmentService.getAvailableSlots(
        args.employee_id,
        args.branch_id,
        args.date
    );
    return { success: true, output: slots };
}

// ═══════════════════════════════════════════════════════════════
// DOCTOR TOOLS
// ═══════════════════════════════════════════════════════════════

async function searchDoctor(args: any, user: AIUserContext) {
    const employees = await prisma.employees.findMany({
        where: {
            AND: [
                { emp_status: true },
                { deleted_at: null },
                {
                    user_table: {
                        role_type: "DOCTOR"
                    }
                },
                {
                    OR: [
                        { first_name: { contains: args.query, mode: "insensitive" } },
                        { last_name: { contains: args.query, mode: "insensitive" } },
                        { specialization: { contains: args.query, mode: "insensitive" } },
                        { department_master: { department_name: { contains: args.query, mode: "insensitive" } } }
                    ]
                }
            ]
        },
        include: {
            department_master: true,
            doctor_profile: true
        },
        take: 10
    });

    return {
        success: true,
        output: employees.map((e: any) => ({
            employee_id: e.employee_id,
            name: `${e.first_name} ${e.last_name || ""}`.trim(),
            specialization: e.specialization,
            department: e.department_master?.department_name,
            designation: e.designation,
            license_no: e.license_no
        }))
    };
}

async function getDoctor(args: any) {
    const employee = await prisma.employees.findUnique({
        where: { employee_id: args.employee_id },
        include: {
            department_master: true,
            doctor_profile: true,
            user_table: {
                select: { role_type: true }
            }
        }
    });

    if (!employee) {
        return { success: false, output: null, error: "Doctor not found." };
    }

    return {
        success: true,
        output: {
            employee_id: employee.employee_id,
            name: `${employee.first_name} ${employee.last_name || ""}`.trim(),
            specialization: employee.specialization,
            department: employee.department_master?.department_name,
            designation: employee.designation,
            license_no: employee.license_no,
            email: employee.email,
            mobile: employee.mobile_no,
            role: employee.user_table?.role_type
        }
    };
}

async function getDoctorSchedule(args: any) {
    const schedules = await prisma.doctor_schedule.findMany({
        where: {
            employee_id: args.employee_id,
            is_active: true,
            ...(args.branch_id ? { branch_id: args.branch_id } : {})
        },
        include: {
            branch: {
                select: { branch_name: true }
            }
        },
        orderBy: [
            { day_of_week: "asc" },
            { start_time: "asc" }
        ]
    });

    return {
        success: true,
        output: schedules.map((s: any) => ({
            schedule_id: s.schedule_id,
            day: s.day_of_week,
            shift: s.shift_name,
            start_time: s.start_time,
            end_time: s.end_time,
            consultation_minutes: s.consultation_minutes,
            branch: s.branch?.branch_name,
            branch_id: s.branch_id
        }))
    };
}

// ═══════════════════════════════════════════════════════════════
// DEPARTMENT TOOLS
// ═══════════════════════════════════════════════════════════════

async function searchDepartment(args: any) {
    const departments = await departmentService.getAllDepartments();
    const filtered = departments.filter((d: any) =>
        d.department_name.toLowerCase().includes(args.query.toLowerCase())
    );
    return { success: true, output: filtered };
}

async function getDepartments() {
    const departments = await departmentService.getAllDepartments();
    return { success: true, output: departments };
}

// ═══════════════════════════════════════════════════════════════
// VITALS TOOLS
// ═══════════════════════════════════════════════════════════════

async function getPatientVitals(args: any, user: AIUserContext) {
    const encounters = await encounterService.getLatestEncountersForPatient(
        args.patient_id,
        user.user_id,
        user.role,
        args.limit || 5
    );

    const vitals = encounters.map((e: any) => ({
        encounter_no: e.encounter_no,
        date: e.created_at,
        systolic_bp: e.systolic_bp,
        diastolic_bp: e.diastolic_bp,
        pulse: e.pulse,
        temperature: e.temperature,
        spo2: e.spo2,
        respiratory_rate: e.respiratory_rate,
        blood_sugar: e.blood_sugar,
        pain_score: e.pain_score,
        height: e.height,
        weight: e.weight,
        bmi: e.bmi
    }));

    return { success: true, output: vitals };
}

async function getLatestVitals(args: any, user: AIUserContext) {
    const encounters = await encounterService.getLatestEncountersForPatient(
        args.patient_id,
        user.user_id,
        user.role,
        1
    );

    if (!encounters || encounters.length === 0) {
        return { success: true, output: null };
    }

    const e = encounters[0] as any;
    return {
        success: true,
        output: {
            encounter_no: e.encounter_no,
            date: e.created_at,
            systolic_bp: e.systolic_bp,
            diastolic_bp: e.diastolic_bp,
            pulse: e.pulse,
            temperature: e.temperature,
            spo2: e.spo2,
            respiratory_rate: e.respiratory_rate,
            blood_sugar: e.blood_sugar,
            pain_score: e.pain_score,
            height: e.height,
            weight: e.weight,
            bmi: e.bmi
        }
    };
}

// ═══════════════════════════════════════════════════════════════
// MEDICINE TOOLS
// ═══════════════════════════════════════════════════════════════

async function searchMedicine(args: any) {
    const medicines = await prisma.medicine_master.findMany({
        where: {
            is_active: true,
            OR: [
                { medicine_name: { contains: args.query, mode: "insensitive" } },
                { generic_name: { contains: args.query, mode: "insensitive" } }
            ]
        },
        take: args.limit || 10,
        orderBy: { medicine_name: "asc" }
    });

    return {
        success: true,
        output: medicines.map((m: any) => ({
            medicine_id: m.medicine_id,
            name: m.medicine_name,
            generic_name: m.generic_name,
            strength: m.strength,
            dosage_form: m.dosage_form,
            route: m.route,
            manufacturer: m.manufacturer_name,
            selling_price: m.selling_price
        }))
    };
}

// ═══════════════════════════════════════════════════════════════
// PRESCRIPTION TOOLS
// ═══════════════════════════════════════════════════════════════

async function getPatientPrescriptions(args: any) {
    const prescriptions = await prescriptionService.getPrescriptionsByPatientId(
        args.patient_id,
        { limit: args.limit || 10, page: 1 }
    );
    return { success: true, output: prescriptions };
}

async function getPrescription(args: any) {
    const prescription = await prescriptionService.getPrescriptionById(args.prescription_id);
    const items = await prescriptionService.getPrescriptionItems(args.prescription_id);
    return {
        success: true,
        output: {
            ...prescription,
            items
        }
    };
}

// ═══════════════════════════════════════════════════════════════
// LAB TOOLS
// ═══════════════════════════════════════════════════════════════

async function getPatientLabOrders(args: any) {
    const orders = await prisma.lab_order.findMany({
        where: {
            patient_history_id: args.patient_history_id
        },
        include: {
            lab_order_item: {
                include: {
                    lab_test_master: true
                }
            }
        },
        orderBy: { created_at: "desc" }
    });

    return { success: true, output: orders };
}

// ═══════════════════════════════════════════════════════════════
// ENCOUNTER TOOLS
// ═══════════════════════════════════════════════════════════════

async function getPatientEncounters(args: any, user: AIUserContext) {
    const encounters = await encounterService.getLatestEncountersForPatient(
        args.patient_id,
        user.user_id,
        user.role,
        args.limit || 5
    );
    return { success: true, output: encounters };
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD TOOLS
// ═══════════════════════════════════════════════════════════════

async function getDashboardSummary(args: any, user: AIUserContext) {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const branchId = args.branch_id || user.branch_id;

    const [allAppointments, checkedIn] = await Promise.all([
        appointmentService.getAppointments({
            date: dateStr,
            branchId,
            limit: 200,
            page: 1
        }),
        encounterService.getCheckedInPatientsToday(
            undefined,
            branchId
        )
    ]);

    const appts = (allAppointments as any)?.appointments || (allAppointments as any)?.data || allAppointments;
    const apptList = Array.isArray(appts) ? appts : [];

    const statusCounts: Record<string, number> = {};
    for (const a of apptList) {
        const s = a.status || "UNKNOWN";
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    }

    return {
        success: true,
        output: {
            date: dateStr,
            total_appointments: apptList.length,
            status_breakdown: statusCounts,
            checked_in_today: Array.isArray(checkedIn) ? checkedIn.length : checkedIn,
            branch_id: branchId
        }
    };
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION TOOLS
// ═══════════════════════════════════════════════════════════════

async function getNotifications(user: AIUserContext) {
    if (!user.employee_id) {
        return { success: true, output: [] };
    }
    const notifications = await notificationService.getNotifications(user.employee_id);
    return { success: true, output: notifications };
}
