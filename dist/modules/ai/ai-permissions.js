"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canUseTool = canUseTool;
exports.getAllowedTools = getAllowedTools;
exports.isDestructiveTool = isDestructiveTool;
const ai_tools_1 = require("./ai-tools");
const ROLE_TOOL_ACCESS = {
    HEAD_ADMIN: [
        "search_patient", "get_patient", "create_patient", "update_patient",
        "search_appointments", "get_appointment", "get_today_appointments",
        "create_appointment", "reschedule_appointment", "cancel_appointment", "get_available_slots",
        "search_doctor", "get_doctor", "get_doctor_schedule",
        "search_department", "get_department",
        "get_patient_vitals", "get_latest_vitals",
        "search_medicine",
        "get_patient_prescriptions", "get_prescription",
        "get_patient_lab_orders",
        "get_patient_encounters",
        "get_dashboard_summary",
        "get_notifications"
    ],
    SUPER_ADMIN: [
        "search_patient", "get_patient", "create_patient", "update_patient",
        "search_appointments", "get_appointment", "get_today_appointments",
        "create_appointment", "reschedule_appointment", "cancel_appointment", "get_available_slots",
        "search_doctor", "get_doctor", "get_doctor_schedule",
        "search_department", "get_department",
        "get_patient_vitals", "get_latest_vitals",
        "search_medicine",
        "get_patient_prescriptions", "get_prescription",
        "get_patient_lab_orders",
        "get_patient_encounters",
        "get_dashboard_summary",
        "get_notifications"
    ],
    ADMIN: [
        "search_patient", "get_patient", "create_patient", "update_patient",
        "search_appointments", "get_appointment", "get_today_appointments",
        "create_appointment", "reschedule_appointment", "cancel_appointment", "get_available_slots",
        "search_doctor", "get_doctor", "get_doctor_schedule",
        "search_department", "get_department",
        "get_patient_vitals", "get_latest_vitals",
        "search_medicine",
        "get_patient_prescriptions", "get_prescription",
        "get_patient_lab_orders",
        "get_patient_encounters",
        "get_dashboard_summary",
        "get_notifications"
    ],
    BRANCH_ADMIN: [
        "search_patient", "get_patient", "create_patient", "update_patient",
        "search_appointments", "get_appointment", "get_today_appointments",
        "create_appointment", "reschedule_appointment", "cancel_appointment", "get_available_slots",
        "search_doctor", "get_doctor", "get_doctor_schedule",
        "search_department", "get_department",
        "get_patient_vitals", "get_latest_vitals",
        "search_medicine",
        "get_patient_prescriptions", "get_prescription",
        "get_patient_lab_orders",
        "get_patient_encounters",
        "get_dashboard_summary",
        "get_notifications"
    ],
    RECEPTIONIST: [
        "search_patient", "get_patient", "create_patient", "update_patient",
        "search_appointments", "get_appointment", "get_today_appointments",
        "create_appointment", "reschedule_appointment", "cancel_appointment", "get_available_slots",
        "search_doctor", "get_doctor", "get_doctor_schedule",
        "search_department", "get_department",
        "get_patient_vitals", "get_latest_vitals",
        "search_medicine",
        "get_patient_prescriptions", "get_prescription",
        "get_patient_encounters",
        "get_dashboard_summary",
        "get_notifications"
    ],
    DOCTOR: [
        "search_patient", "get_patient",
        "search_appointments", "get_appointment", "get_today_appointments",
        "get_available_slots",
        "search_doctor", "get_doctor", "get_doctor_schedule",
        "search_department", "get_department",
        "get_patient_vitals", "get_latest_vitals",
        "search_medicine",
        "get_patient_prescriptions", "get_prescription",
        "get_patient_lab_orders",
        "get_patient_encounters",
        "get_dashboard_summary",
        "get_notifications"
    ],
    NURSE: [
        "search_patient", "get_patient",
        "search_appointments", "get_appointment", "get_today_appointments",
        "search_doctor", "get_doctor", "get_doctor_schedule",
        "search_department", "get_department",
        "get_patient_vitals", "get_latest_vitals",
        "get_patient_encounters",
        "get_notifications"
    ],
    PHARMACIST: [
        "search_patient", "get_patient",
        "search_medicine",
        "get_patient_prescriptions", "get_prescription",
        "get_notifications"
    ],
    LAB_TECHNICIAN: [
        "search_patient", "get_patient",
        "get_patient_lab_orders",
        "get_patient_vitals", "get_latest_vitals",
        "get_notifications"
    ],
    STAFF: [
        "search_patient", "get_patient",
        "search_appointments", "get_appointment", "get_today_appointments",
        "search_doctor", "get_doctor",
        "search_department", "get_department",
        "get_notifications"
    ]
};
function canUseTool(user, toolName) {
    const allowed = ROLE_TOOL_ACCESS[user.role];
    if (!allowed)
        return false;
    return allowed.includes(toolName);
}
function getAllowedTools(user) {
    return ROLE_TOOL_ACCESS[user.role] || [];
}
function isDestructiveTool(toolName) {
    const tool = (0, ai_tools_1.getToolByName)(toolName);
    return tool?.category === "DESTRUCTIVE" || tool?.requiresConfirmation === true;
}
