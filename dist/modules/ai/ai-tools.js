"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_TOOLS = void 0;
exports.getToolByName = getToolByName;
exports.getOpenAITools = getOpenAITools;
exports.AI_TOOLS = [
    // ──── PATIENT TOOLS ────
    {
        name: "search_patient",
        description: "Search patients by name, ID, phone, or email. Returns matching patients with their basic info.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search term — patient name, ID, phone, or email" },
                branch_id: { type: "string", description: "Optional branch ID to filter by" },
                limit: { type: "number", description: "Max results (default 10)" }
            },
            required: ["query"]
        }
    },
    {
        name: "get_patient",
        description: "Get full details of a specific patient by their patient_id.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                patient_id: { type: "string", description: "The patient ID (e.g. P10023)" }
            },
            required: ["patient_id"]
        }
    },
    {
        name: "create_patient",
        description: "Register a new patient in the HMS.",
        category: "WRITE",
        parameters: {
            type: "object",
            properties: {
                first_name: { type: "string", description: "Patient first name" },
                last_name: { type: "string", description: "Patient last name" },
                mobile: { type: "string", description: "Primary mobile number" },
                gender: { type: "string", description: "Gender (Male/Female/Other)" },
                dob: { type: "string", description: "Date of birth (YYYY-MM-DD)" },
                age: { type: "number", description: "Age" },
                email: { type: "string", description: "Email address" },
                blood_group: { type: "string", description: "Blood group" },
                patient_type: { type: "string", description: "Patient type (OPD/IPD)" },
                branch_id: { type: "string", description: "Branch ID" },
                username: { type: "string", description: "Login username for patient portal" },
                password: { type: "string", description: "Login password for patient portal" }
            },
            required: ["first_name", "mobile", "branch_id", "username", "password"]
        }
    },
    {
        name: "update_patient",
        description: "Update an existing patient's information.",
        category: "WRITE",
        parameters: {
            type: "object",
            properties: {
                patient_id: { type: "string", description: "Patient ID" },
                first_name: { type: "string" },
                last_name: { type: "string" },
                mobile: { type: "string" },
                email: { type: "string" },
                gender: { type: "string" },
                dob: { type: "string" },
                age: { type: "number" },
                blood_group: { type: "string" },
                patient_type: { type: "string" },
                patient_active: { type: "string", description: "active or inactive" }
            },
            required: ["patient_id"]
        }
    },
    // ──── APPOINTMENT TOOLS ────
    {
        name: "search_appointments",
        description: "Search appointments by patient name, doctor name, status, or date. Use for finding specific appointments.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                patient_id: { type: "string", description: "Filter by patient ID" },
                employee_id: { type: "string", description: "Filter by doctor/employee ID" },
                status: { type: "string", description: "Filter by status (SCHEDULED, CHECKED_IN, IN_CONSULTATION, COMPLETED, CANCELLED, NO_SHOW, RESCHEDULED)" },
                date: { type: "string", description: "Filter by date (YYYY-MM-DD)" },
                dateFrom: { type: "string", description: "Start date range (YYYY-MM-DD)" },
                dateTo: { type: "string", description: "End date range (YYYY-MM-DD)" },
                branch_id: { type: "string", description: "Branch ID" },
                limit: { type: "number", description: "Max results (default 10)" }
            }
        }
    },
    {
        name: "get_appointment",
        description: "Get a specific appointment by its appointment number.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                appointment_no: { type: "string", description: "Appointment number" }
            },
            required: ["appointment_no"]
        }
    },
    {
        name: "get_today_appointments",
        description: "Get all appointments for today. Optionally filter by doctor or status.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                employee_id: { type: "string", description: "Filter by doctor ID" },
                status: { type: "string", description: "Filter by status" },
                branch_id: { type: "string", description: "Branch ID" }
            }
        }
    },
    {
        name: "create_appointment",
        description: "Create a new appointment. Requires patient_id, employee_id (doctor), branch_id, date, and time.",
        category: "WRITE",
        parameters: {
            type: "object",
            properties: {
                patient_id: { type: "string", description: "Patient ID" },
                employee_id: { type: "string", description: "Doctor/Employee ID" },
                branch_id: { type: "string", description: "Branch ID" },
                department_id: { type: "string", description: "Department ID (optional)" },
                appointment_date: { type: "string", description: "Date (YYYY-MM-DD)" },
                appointment_time: { type: "string", description: "Time (HH:mm)" },
                reason_for_visit: { type: "string", description: "Reason for visit" },
                patient_type: { type: "string", description: "OPD or IPD" },
                patient_visit_type: { type: "string", description: "Visit type" }
            },
            required: ["patient_id", "employee_id", "branch_id", "appointment_date", "appointment_time"]
        }
    },
    {
        name: "reschedule_appointment",
        description: "Reschedule an existing appointment to a new date and/or time.",
        category: "WRITE",
        parameters: {
            type: "object",
            properties: {
                appointment_no: { type: "string", description: "Appointment number" },
                appointment_date: { type: "string", description: "New date (YYYY-MM-DD)" },
                appointment_time: { type: "string", description: "New time (HH:mm)" },
                employee_id: { type: "string", description: "New doctor ID (optional)" },
                branch_id: { type: "string", description: "Branch ID" }
            },
            required: ["appointment_no", "branch_id"]
        }
    },
    {
        name: "cancel_appointment",
        description: "Cancel an appointment. This requires a reason and confirmation.",
        category: "DESTRUCTIVE",
        requiresConfirmation: true,
        parameters: {
            type: "object",
            properties: {
                appointment_no: { type: "string", description: "Appointment number to cancel" },
                cancel_reason: { type: "string", description: "Reason for cancellation" },
                branch_id: { type: "string", description: "Branch ID" }
            },
            required: ["appointment_no", "cancel_reason", "branch_id"]
        }
    },
    {
        name: "get_available_slots",
        description: "Get available appointment slots for a doctor on a specific date.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                employee_id: { type: "string", description: "Doctor/Employee ID" },
                branch_id: { type: "string", description: "Branch ID" },
                date: { type: "string", description: "Date (YYYY-MM-DD)" }
            },
            required: ["employee_id", "branch_id", "date"]
        }
    },
    // ──── DOCTOR TOOLS ────
    {
        name: "search_doctor",
        description: "Search doctors by name, specialization, or department.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search term — doctor name, specialization, or department" },
                branch_id: { type: "string", description: "Filter by branch" },
                department_id: { type: "string", description: "Filter by department" }
            },
            required: ["query"]
        }
    },
    {
        name: "get_doctor",
        description: "Get detailed information about a specific doctor by their employee ID.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                employee_id: { type: "string", description: "Doctor/Employee ID" }
            },
            required: ["employee_id"]
        }
    },
    {
        name: "get_doctor_schedule",
        description: "Get the schedule for a doctor. Can get recurring weekly schedule or schedule for a specific date.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                employee_id: { type: "string", description: "Doctor/Employee ID" },
                branch_id: { type: "string", description: "Branch ID (optional)" },
                date: { type: "string", description: "Specific date (YYYY-MM-DD) to check overrides/changes" }
            },
            required: ["employee_id"]
        }
    },
    // ──── DEPARTMENT TOOLS ────
    {
        name: "search_department",
        description: "Search departments by name.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Department name search term" }
            },
            required: ["query"]
        }
    },
    {
        name: "get_department",
        description: "Get all departments.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {}
        }
    },
    // ──── VITALS TOOLS ────
    {
        name: "get_patient_vitals",
        description: "Get recent vitals for a patient from their encounters. Returns blood pressure, pulse, temperature, SpO2, etc.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                patient_id: { type: "string", description: "Patient ID" },
                limit: { type: "number", description: "Number of recent encounters to check (default 5)" }
            },
            required: ["patient_id"]
        }
    },
    {
        name: "get_latest_vitals",
        description: "Get the most recent vitals for a patient.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                patient_id: { type: "string", description: "Patient ID" }
            },
            required: ["patient_id"]
        }
    },
    // ──── MEDICINE TOOLS ────
    {
        name: "search_medicine",
        description: "Search medicines by name or generic name.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Medicine name or generic name" },
                limit: { type: "number", description: "Max results (default 10)" }
            },
            required: ["query"]
        }
    },
    // ──── PRESCRIPTION TOOLS ────
    {
        name: "get_patient_prescriptions",
        description: "Get all prescriptions for a patient.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                patient_id: { type: "string", description: "Patient ID" },
                limit: { type: "number", description: "Max results (default 10)" }
            },
            required: ["patient_id"]
        }
    },
    {
        name: "get_prescription",
        description: "Get a specific prescription by ID with all items.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                prescription_id: { type: "string", description: "Prescription ID" }
            },
            required: ["prescription_id"]
        }
    },
    // ──── LAB TOOLS ────
    {
        name: "get_patient_lab_orders",
        description: "Get lab orders for a patient.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                patient_history_id: { type: "string", description: "Patient history ID" }
            },
            required: ["patient_history_id"]
        }
    },
    // ──── ENCOUNTER TOOLS ────
    {
        name: "get_patient_encounters",
        description: "Get recent encounters/visits for a patient, including vitals and clinical notes.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                patient_id: { type: "string", description: "Patient ID" },
                limit: { type: "number", description: "Number of recent encounters (default 5)" }
            },
            required: ["patient_id"]
        }
    },
    // ──── DASHBOARD TOOLS ────
    {
        name: "get_dashboard_summary",
        description: "Get a summary of today's dashboard — total appointments, checked-in patients, in-consultation, completed, cancelled, etc.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {
                branch_id: { type: "string", description: "Branch ID (optional)" }
            }
        }
    },
    // ──── NOTIFICATION TOOLS ────
    {
        name: "get_notifications",
        description: "Get recent notifications for the current user.",
        category: "READ",
        parameters: {
            type: "object",
            properties: {}
        }
    }
];
function getToolByName(name) {
    return exports.AI_TOOLS.find(t => t.name === name);
}
function getOpenAITools() {
    return exports.AI_TOOLS.map(tool => ({
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }
    }));
}
