"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientPortalService = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../../config/prisma"));
const lab_report_service_1 = require("../lab-report/lab-report.service");
const appointment_service_1 = require("../appointment/appointment.service");
const chemotherapy_schedule_1 = require("../chemotherapy/chemotherapy.schedule");
class PatientPortalService {
    appointmentService = new appointment_service_1.AppointmentService();
    /**
     * Resolve patient_id from the authenticated user token or user_table
     */
    async resolvePatientId(user) {
        if (user.patient_id) {
            return user.patient_id;
        }
        if (user.user_id) {
            const bio = await prisma_1.default.patient_bio_data.findFirst({
                where: { user_id: user.user_id },
                select: { patient_id: true },
            });
            if (bio?.patient_id)
                return bio.patient_id;
        }
        throw new Error("Patient identifier not found. Please log in again.");
    }
    /**
     * Aggregated dashboard data: next appointment, recent reports, today's meds, latest vitals
     */
    async getDashboard(patientId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [patient, nextAppointment, recentOrders, recentPrescriptions, latestEncounter, latestHistory, activeChemoPlan] = await Promise.all([
            // 1. Patient profile
            prisma_1.default.patient_bio_data.findFirst({
                where: { patient_id: patientId },
                select: {
                    patient_id: true,
                    patient_first_name: true,
                    patient_middle_name: true,
                    patient_last_name: true,
                    patient_gender: true,
                    patient_dob: true,
                    patient_age: true,
                    patient_blood_group: true,
                    patient_primary_mobile: true,
                    patient_email: true,
                    branch: { select: { branch_name: true, branch_area: true } },
                },
            }),
            // 2. Next confirmed/scheduled appointment
            prisma_1.default.appointment_history.findFirst({
                where: {
                    patient_id: patientId,
                    appointment_date: { gte: today },
                    status: {
                        notIn: ["CANCELLED", "NO_SHOW"],
                    },
                },
                orderBy: [{ appointment_date: "asc" }, { appointment_time: "asc" }],
                select: {
                    appointment_id: true,
                    employee_id: true,
                    branch_id: true,
                    department_id: true,
                    doctor_name: true,
                    department: true,
                    appointment_date: true,
                    appointment_time: true,
                    token_number: true,
                    status: true,
                    reason_for_visit: true,
                    consultation_fee: true,
                    duration_minutes: true,
                    branch: {
                        select: { branch_id: true, branch_name: true, branch_area: true },
                    },
                },
            }),
            // 3. Recent lab orders
            prisma_1.default.lab_order.findMany({
                where: {
                    OR: [
                        { appointment_history: { patient_id: patientId } },
                        { patient_history: { patient_id: patientId } },
                    ],
                },
                orderBy: { created_at: "desc" },
                take: 3,
                include: {
                    lab_order_item: {
                        include: {
                            lab_test_master: {
                                select: { test_name: true, test_code: true, sample_type: true },
                            },
                            sample_collection: {
                                select: { barcode: true, collection_status: true, collection_datetime: true },
                            },
                            lab_result: {
                                include: {
                                    lab_report: true,
                                },
                            },
                        },
                    },
                    lab_report: {
                        select: {
                            lab_report_id: true,
                            report_number: true,
                            report_status: true,
                            generated_datetime: true,
                            report_file: true,
                            approved_by: true,
                            report_comment: true,
                        },
                    },
                    employees: {
                        select: { first_name: true, last_name: true },
                    },
                },
            }),
            // 4. Recent prescription with items
            prisma_1.default.prescription.findFirst({
                where: {
                    patient_history: { patient_id: patientId },
                },
                orderBy: { prescription_date: "desc" },
                include: {
                    prescription_items: {
                        include: {
                            medicine_master: true,
                        },
                    },
                    employees: {
                        select: { first_name: true, last_name: true, specialization: true },
                    },
                    department_master: {
                        select: { department_name: true },
                    },
                    diagnosis: {
                        select: { diagnosis_name: true, icd_code: true },
                    },
                    branch: {
                        select: { branch_name: true, branch_area: true },
                    },
                    patient_history: {
                        select: {
                            patient_id: true,
                            mrn_no: true,
                            visit_date: true,
                            visit_type: true,
                            systolic_bp: true,
                            diastolic_bp: true,
                            pulse: true,
                            temperature: true,
                            weight: true,
                            height: true,
                            bmi: true,
                            oxygen_saturation: true,
                            allergy_history: true,
                            clinical_notes: true,
                            patient_bio_data: {
                                select: {
                                    patient_id: true,
                                    patient_first_name: true,
                                    patient_middle_name: true,
                                    patient_last_name: true,
                                    patient_gender: true,
                                    patient_dob: true,
                                    patient_age: true,
                                    patient_blood_group: true,
                                    patient_primary_mobile: true,
                                },
                            },
                        },
                    },
                },
            }),
            // 5. Latest recorded vitals from encounter
            prisma_1.default.encounter.findFirst({
                where: {
                    patient_id: patientId,
                    OR: [
                        { systolic_bp: { not: null } },
                        { pulse: { not: null } },
                        { temperature: { not: null } },
                        { spo2: { not: null } },
                        { weight: { not: null } },
                        { vitals_log: { not: client_1.Prisma.JsonNull } },
                    ],
                },
                orderBy: [{ encounter_ts: "desc" }, { created_at: "desc" }],
                include: {
                    employees: {
                        select: { first_name: true, last_name: true, specialization: true },
                    },
                },
            }),
            // 6. Latest recorded vitals from patient_history
            prisma_1.default.patient_history.findFirst({
                where: {
                    patient_id: patientId,
                    OR: [
                        { systolic_bp: { not: null } },
                        { pulse: { not: null } },
                        { temperature: { not: null } },
                        { oxygen_saturation: { not: null } },
                        { weight: { not: null } },
                    ],
                },
                orderBy: [{ visit_date: "desc" }, { updated_at: "desc" }],
                select: {
                    id: true,
                    patient_history_id: true,
                    visit_date: true,
                    visit_type: true,
                    treating_doctor_name: true,
                    systolic_bp: true,
                    diastolic_bp: true,
                    pulse: true,
                    temperature: true,
                    weight: true,
                    height: true,
                    bmi: true,
                    blood_sugar: true,
                    oxygen_saturation: true,
                    allergy_history: true,
                    chronic_disease: true,
                    clinical_notes: true,
                },
            }),
            // 7. Active or planned chemotherapy plan
            prisma_1.default.chemotherapy_plan.findFirst({
                where: {
                    patient_id: patientId,
                    active_status: 1,
                    treatment_status: { in: ["ACTIVE", "PLANNED"] },
                },
                orderBy: [{ treatment_status: "asc" }, { created_at: "desc" }],
                select: {
                    chemotherapy_plan_id: true,
                    source_protocol_id: true,
                    regimen_name: true,
                    protocol_name: true,
                    treatment_status: true,
                    treatment_intent: true,
                    cancer_type: true,
                    cancer_stage: true,
                    planned_cycles: true,
                    completed_cycles: true,
                    cycle_interval_days: true,
                    treatment_start_date: true,
                    employees: {
                        select: { first_name: true, last_name: true, specialization: true },
                    },
                    chemotherapy_cycle: {
                        where: { active_status: 1 },
                        orderBy: { cycle_number: "asc" },
                        select: {
                            chemotherapy_cycle_id: true,
                            cycle_number: true,
                            planned_date: true,
                            actual_date: true,
                            cycle_status: true,
                            completion_status: true,
                            treatment_delay: true,
                            rescheduled_date: true,
                        },
                    },
                },
            }),
        ]);
        const fullName = patient
            ? [patient.patient_first_name, patient.patient_middle_name, patient.patient_last_name]
                .filter(Boolean)
                .join(" ")
            : patientId;
        // Resolve latest vitals from either encounter or patient_history (whichever is newer / available)
        const encounterVitals = this.formatEncounterVitals(latestEncounter);
        const historyVitals = this.formatHistoryVitals(latestHistory);
        let resolvedLatestVitals = null;
        if (encounterVitals && historyVitals) {
            const encTime = new Date(encounterVitals.visit_date || 0).getTime();
            const histTime = new Date(historyVitals.visit_date || 0).getTime();
            resolvedLatestVitals = encTime >= histTime
                ? { ...historyVitals, ...encounterVitals }
                : { ...encounterVitals, ...historyVitals };
        }
        else {
            resolvedLatestVitals = encounterVitals || historyVitals || null;
        }
        // Resolve active chemotherapy summary for dashboard
        let activeChemoSummary = null;
        if (activeChemoPlan) {
            let schedule = [];
            try {
                schedule = await (0, chemotherapy_schedule_1.computePlanSchedule)(prisma_1.default, activeChemoPlan);
            }
            catch (err) {
                console.error("Failed to compute dashboard chemo plan schedule:", err?.message ?? err);
            }
            const formattedCycles = (activeChemoPlan.chemotherapy_cycle || []).map((c) => {
                const scheduledDayOne = schedule.find((s) => s.cycle_number === c.cycle_number && s.cycle_day === 1);
                return {
                    ...c,
                    planned_date: c.rescheduled_date || scheduledDayOne?.planned_date || c.planned_date,
                };
            });
            const nextCycle = formattedCycles.find((c) => c.cycle_status !== "COMPLETED" && c.completion_status !== "COMPLETED") || formattedCycles[formattedCycles.length - 1];
            const docName = activeChemoPlan.employees
                ? `Dr. ${[activeChemoPlan.employees.first_name, activeChemoPlan.employees.last_name].filter(Boolean).join(" ")}`
                : null;
            const totalPlanned = activeChemoPlan.planned_cycles || 0;
            const completedCount = formattedCycles.filter((c) => c.cycle_status === "COMPLETED" || c.completion_status === "COMPLETED").length || activeChemoPlan.completed_cycles || 0;
            const firstDate = schedule[0]?.planned_date || activeChemoPlan.treatment_start_date;
            activeChemoSummary = {
                chemotherapy_plan_id: activeChemoPlan.chemotherapy_plan_id,
                regimen_name: activeChemoPlan.regimen_name,
                protocol_name: activeChemoPlan.protocol_name,
                treatment_status: activeChemoPlan.treatment_status,
                treatment_intent: activeChemoPlan.treatment_intent,
                cancer_type: activeChemoPlan.cancer_type,
                cancer_stage: activeChemoPlan.cancer_stage,
                planned_cycles: totalPlanned,
                completed_cycles: completedCount,
                cycle_interval_days: activeChemoPlan.cycle_interval_days,
                treatment_start_date: firstDate,
                doctor_name: docName,
                specialization: activeChemoPlan.employees?.specialization || "Medical Oncology",
                progress_percentage: totalPlanned > 0 ? Math.round((completedCount / totalPlanned) * 100) : 0,
                next_cycle: nextCycle
                    ? {
                        cycle_number: nextCycle.cycle_number,
                        planned_date: nextCycle.planned_date,
                        cycle_status: nextCycle.cycle_status,
                        treatment_delay: nextCycle.treatment_delay,
                    }
                    : null,
            };
        }
        return {
            patient: {
                ...patient,
                full_name: fullName,
            },
            nextAppointment,
            recentOrders: (recentOrders || []).map((o) => this.enrichLabOrder(o)),
            activePrescription: recentPrescriptions,
            latestVitals: resolvedLatestVitals,
            activeChemoPlan: activeChemoSummary,
        };
    }
    /**
     * List all appointments for this patient
     */
    async getAppointments(patientId) {
        const appointments = await prisma_1.default.appointment_history.findMany({
            where: { patient_id: patientId },
            orderBy: [{ appointment_date: "desc" }, { appointment_time: "desc" }],
            select: {
                appointment_id: true,
                employee_id: true,
                branch_id: true,
                department_id: true,
                doctor_name: true,
                department: true,
                appointment_date: true,
                appointment_time: true,
                token_number: true,
                status: true,
                reason_for_visit: true,
                consultation_fee: true,
                duration_minutes: true,
                created_at: true,
                branch: {
                    select: { branch_id: true, branch_name: true, branch_area: true },
                },
            },
        });
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const upcoming = appointments
            .filter((a) => {
            const apptDate = new Date(a.appointment_date);
            return apptDate >= now && a.status !== "CANCELLED" && a.status !== "NO_SHOW";
        })
            .reverse();
        const past = appointments.filter((a) => {
            const apptDate = new Date(a.appointment_date);
            return apptDate < now || a.status === "CANCELLED" || a.status === "NO_SHOW";
        });
        return {
            total: appointments.length,
            upcoming,
            past,
        };
    }
    /**
     * List diagnostic lab orders & reports for this patient
     */
    async getLabReports(patientId) {
        const orders = await prisma_1.default.lab_order.findMany({
            where: {
                OR: [
                    { appointment_history: { patient_id: patientId } },
                    { patient_history: { patient_id: patientId } },
                ],
            },
            orderBy: { created_at: "desc" },
            include: {
                lab_order_item: {
                    include: {
                        lab_test_master: {
                            select: { test_name: true, test_code: true, sample_type: true },
                        },
                        sample_collection: {
                            select: { barcode: true, collection_status: true, collection_datetime: true },
                        },
                        lab_result: {
                            include: {
                                lab_report: true,
                            },
                        },
                    },
                },
                lab_report: true,
                employees: {
                    select: { first_name: true, last_name: true },
                },
                department_master: {
                    select: { department_name: true },
                },
            },
        });
        return orders.map((o) => this.enrichLabOrder(o));
    }
    /**
     * List prescriptions and medications for this patient
     */
    async getPrescriptions(patientId) {
        const prescriptions = await prisma_1.default.prescription.findMany({
            where: {
                patient_history: { patient_id: patientId },
            },
            orderBy: { prescription_date: "desc" },
            include: {
                prescription_items: {
                    include: {
                        medicine_master: true,
                    },
                },
                employees: {
                    select: { first_name: true, last_name: true, specialization: true },
                },
                department_master: {
                    select: { department_name: true },
                },
                diagnosis: {
                    select: { diagnosis_name: true, icd_code: true },
                },
                branch: {
                    select: { branch_name: true, branch_area: true },
                },
                patient_history: {
                    select: {
                        patient_id: true,
                        mrn_no: true,
                        visit_date: true,
                        visit_type: true,
                        systolic_bp: true,
                        diastolic_bp: true,
                        pulse: true,
                        temperature: true,
                        weight: true,
                        height: true,
                        bmi: true,
                        oxygen_saturation: true,
                        allergy_history: true,
                        clinical_notes: true,
                        patient_bio_data: {
                            select: {
                                patient_id: true,
                                patient_first_name: true,
                                patient_middle_name: true,
                                patient_last_name: true,
                                patient_gender: true,
                                patient_dob: true,
                                patient_age: true,
                                patient_blood_group: true,
                                patient_primary_mobile: true,
                            },
                        },
                    },
                },
            },
        });
        return prescriptions;
    }
    /**
     * List vitals and clinical history for this patient from both encounters and patient_history
     */
    async getVitalsHistory(patientId) {
        const [encounters, patientHistories] = await Promise.all([
            prisma_1.default.encounter.findMany({
                where: {
                    patient_id: patientId,
                    OR: [
                        { systolic_bp: { not: null } },
                        { pulse: { not: null } },
                        { temperature: { not: null } },
                        { spo2: { not: null } },
                        { weight: { not: null } },
                        { vitals_log: { not: client_1.Prisma.JsonNull } },
                    ],
                },
                orderBy: [{ encounter_ts: "desc" }, { created_at: "desc" }],
                include: {
                    employees: {
                        select: { first_name: true, last_name: true, specialization: true },
                    },
                    department_master: {
                        select: { department_name: true },
                    },
                },
            }),
            prisma_1.default.patient_history.findMany({
                where: {
                    patient_id: patientId,
                },
                orderBy: [{ visit_date: "desc" }, { updated_at: "desc" }],
                select: {
                    id: true,
                    patient_history_id: true,
                    encounter_no: true,
                    visit_date: true,
                    visit_type: true,
                    treating_doctor_name: true,
                    systolic_bp: true,
                    diastolic_bp: true,
                    pulse: true,
                    temperature: true,
                    weight: true,
                    height: true,
                    bmi: true,
                    blood_sugar: true,
                    oxygen_saturation: true,
                    respiratory_rate: true,
                    allergy_history: true,
                    chronic_disease: true,
                    clinical_notes: true,
                },
            }),
        ]);
        const resultList = [];
        const seenKeys = new Set();
        // 1. Process encounters
        for (const enc of encounters) {
            if (Array.isArray(enc.vitals_log) && enc.vitals_log.length > 1) {
                const logs = enc.vitals_log;
                for (let i = logs.length - 1; i >= 0; i--) {
                    const logItem = logs[i];
                    const logVitals = this.formatEncounterLogItem(enc, logItem, i);
                    if (logVitals) {
                        const key = `${enc.encounter_no}_${logItem?.entry_id || logItem?.recorded_at || i}`;
                        if (!seenKeys.has(key)) {
                            seenKeys.add(key);
                            resultList.push(logVitals);
                        }
                    }
                }
            }
            else {
                const v = this.formatEncounterVitals(enc);
                if (v) {
                    const key = enc.encounter_no;
                    seenKeys.add(key);
                    resultList.push(v);
                }
            }
        }
        // 2. Process patient histories
        for (const ph of patientHistories) {
            const v = this.formatHistoryVitals(ph);
            if (!v)
                continue;
            if (ph.encounter_no && seenKeys.has(ph.encounter_no)) {
                const existingIdx = resultList.findIndex((r) => r.patient_history_id === ph.encounter_no || r.id === ph.encounter_no);
                if (existingIdx !== -1) {
                    resultList[existingIdx] = {
                        ...resultList[existingIdx],
                        allergy_history: ph.allergy_history || resultList[existingIdx].allergy_history,
                        chronic_disease: ph.chronic_disease || resultList[existingIdx].chronic_disease,
                        clinical_notes: resultList[existingIdx].clinical_notes || ph.clinical_notes,
                    };
                    continue;
                }
            }
            const key = String(ph.patient_history_id || ph.id);
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                resultList.push(v);
            }
        }
        resultList.sort((a, b) => {
            const ta = new Date(a.visit_date || 0).getTime();
            const tb = new Date(b.visit_date || 0).getTime();
            return tb - ta;
        });
        return resultList;
    }
    /**
     * List all allergies and clinical alerts for this patient
     */
    async getAllergies(patientId) {
        const [structuredAllergies, pastHistories] = await Promise.all([
            prisma_1.default.patient_allergy.findMany({
                where: { patient_id: patientId },
                include: {
                    allergy_master: {
                        select: {
                            code: true,
                            substance_name: true,
                            substance_type: true,
                            description: true,
                            severity_level: true,
                        },
                    },
                    employees: {
                        select: {
                            first_name: true,
                            last_name: true,
                        },
                    },
                },
                orderBy: { identified_at: "desc" },
            }),
            prisma_1.default.patient_history.findMany({
                where: {
                    patient_id: patientId,
                    allergy_history: { not: null },
                },
                select: {
                    patient_history_id: true,
                    encounter_no: true,
                    visit_date: true,
                    treating_doctor_name: true,
                    allergy_history: true,
                },
                orderBy: { visit_date: "desc" },
            }),
        ]);
        const formattedAllergies = structuredAllergies.map((pa) => ({
            id: pa.id ? pa.id.toString() : String(Math.random()),
            allergy_id: pa.allergy_id ? pa.allergy_id.toString() : null,
            substance_name: pa.allergy_master?.substance_name || "Unknown Allergen",
            substance_code: pa.allergy_master?.code || null,
            substance_type: pa.allergy_master?.substance_type || "OTHER",
            severity: pa.severity || pa.allergy_master?.severity_level || "MODERATE",
            reaction: pa.reaction || null,
            status: pa.status || "ACTIVE",
            clinical_notes: pa.clinical_notes || null,
            identified_at: pa.identified_at ? pa.identified_at.toISOString() : null,
            duration_value: pa.duration_value,
            duration_unit: pa.duration_unit,
            doctor_name: pa.employees
                ? `Dr. ${pa.employees.first_name || ""} ${pa.employees.last_name || ""}`.trim()
                : null,
            source: "STRUCTURED",
        }));
        const knownNames = new Set(formattedAllergies.map((a) => a.substance_name.toLowerCase().trim()));
        const historyAllergies = [];
        for (const ph of pastHistories) {
            if (!ph.allergy_history || !ph.allergy_history.trim())
                continue;
            const rawText = ph.allergy_history.trim();
            const lower = rawText.toLowerCase();
            if (lower === "nil" ||
                lower === "none" ||
                lower === "no" ||
                lower === "nka" ||
                lower === "nkda" ||
                lower === "no known allergies" ||
                lower === "no allergies" ||
                lower === "na" ||
                lower === "n/a") {
                continue;
            }
            const alreadyIncluded = Array.from(knownNames).some((name) => lower.includes(name) || name.includes(lower));
            if (!alreadyIncluded) {
                historyAllergies.push({
                    id: `hist_${ph.patient_history_id || ph.encounter_no || Math.random()}`,
                    substance_name: rawText,
                    substance_type: "CONSULTATION_NOTE",
                    severity: "MODERATE",
                    reaction: "Recorded during clinical consultation",
                    status: "ACTIVE",
                    clinical_notes: `Noted during consultation on ${ph.visit_date ? new Date(ph.visit_date).toLocaleDateString() : "past visit"}`,
                    identified_at: ph.visit_date ? new Date(ph.visit_date).toISOString() : null,
                    doctor_name: ph.treating_doctor_name || null,
                    source: "CLINICAL_NOTE",
                });
                knownNames.add(lower);
            }
        }
        const all = [...formattedAllergies, ...historyAllergies];
        return {
            total: all.length,
            active_count: all.filter((a) => a.status?.toUpperCase() === "ACTIVE").length,
            allergies: all,
        };
    }
    formatEncounterVitals(enc) {
        if (!enc)
            return null;
        let sys = enc.systolic_bp ?? null;
        let dia = enc.diastolic_bp ?? null;
        let pulse = enc.pulse ?? null;
        let temp = enc.temperature ? Number(enc.temperature) : null;
        let spo2 = enc.spo2 ?? null;
        let rr = enc.respiratory_rate ?? null;
        let wt = enc.weight ? Number(enc.weight) : null;
        let ht = enc.height ? Number(enc.height) : null;
        let bmi = enc.BMI ? Number(enc.BMI) : null;
        let bs = enc.blood_sugar ? String(enc.blood_sugar) : null;
        let recordedAt = enc.encounter_ts || enc.created_at;
        if (Array.isArray(enc.vitals_log) && enc.vitals_log.length > 0) {
            const lastLog = enc.vitals_log[enc.vitals_log.length - 1];
            if (lastLog.systolic_bp != null)
                sys = lastLog.systolic_bp;
            if (lastLog.diastolic_bp != null)
                dia = lastLog.diastolic_bp;
            if (lastLog.pulse != null)
                pulse = lastLog.pulse;
            if (lastLog.temperature != null)
                temp = Number(lastLog.temperature);
            if (lastLog.spo2 != null)
                spo2 = lastLog.spo2;
            if (lastLog.respiratory_rate != null)
                rr = lastLog.respiratory_rate;
            if (lastLog.weight != null)
                wt = Number(lastLog.weight);
            if (lastLog.height != null)
                ht = Number(lastLog.height);
            if (lastLog.bmi != null)
                bmi = Number(lastLog.bmi);
            if (lastLog.blood_sugar != null)
                bs = String(lastLog.blood_sugar);
            if (lastLog.recorded_at)
                recordedAt = lastLog.recorded_at;
        }
        if (!bmi && wt && ht && ht > 0) {
            const hm = ht / 100;
            bmi = Number((wt / (hm * hm)).toFixed(1));
        }
        if (sys == null && dia == null && pulse == null && temp == null && spo2 == null && wt == null && ht == null) {
            return null;
        }
        const doctorName = enc.employees
            ? `Dr. ${[enc.employees.first_name, enc.employees.last_name].filter(Boolean).join(" ")}`
            : undefined;
        return {
            id: String(enc.encounter_id || enc.encounter_no),
            patient_history_id: enc.encounter_no,
            visit_date: recordedAt,
            visit_type: enc.encounter_type || "Outpatient (OPD)",
            treating_doctor_name: doctorName,
            systolic_bp: sys,
            diastolic_bp: dia,
            pulse: pulse,
            temperature: temp,
            oxygen_saturation: spo2,
            respiratory_rate: rr,
            weight: wt,
            height: ht,
            bmi: bmi,
            blood_sugar: bs,
            clinical_notes: enc.clinical_notes || enc.chief_complaint || null,
        };
    }
    formatEncounterLogItem(enc, logItem, idx) {
        if (!logItem)
            return null;
        let sys = logItem.systolic_bp ?? null;
        let dia = logItem.diastolic_bp ?? null;
        let pulse = logItem.pulse ?? null;
        let temp = logItem.temperature ? Number(logItem.temperature) : null;
        let spo2 = logItem.spo2 ?? null;
        let rr = logItem.respiratory_rate ?? null;
        let wt = logItem.weight ? Number(logItem.weight) : null;
        let ht = logItem.height ? Number(logItem.height) : null;
        let bmi = logItem.bmi ? Number(logItem.bmi) : null;
        let bs = logItem.blood_sugar ? String(logItem.blood_sugar) : null;
        if (!bmi && wt && ht && ht > 0) {
            const hm = ht / 100;
            bmi = Number((wt / (hm * hm)).toFixed(1));
        }
        if (sys == null && dia == null && pulse == null && temp == null && spo2 == null && wt == null && ht == null) {
            return null;
        }
        const doctorName = enc.employees
            ? `Dr. ${[enc.employees.first_name, enc.employees.last_name].filter(Boolean).join(" ")}`
            : undefined;
        return {
            id: logItem.entry_id || `${enc.encounter_no}_log_${idx}`,
            patient_history_id: enc.encounter_no,
            visit_date: logItem.recorded_at || enc.encounter_ts || enc.created_at,
            visit_type: enc.encounter_type ? `${enc.encounter_type} Reading` : "Vital Signs Log",
            treating_doctor_name: logItem.recorded_by_name || doctorName,
            systolic_bp: sys,
            diastolic_bp: dia,
            pulse: pulse,
            temperature: temp,
            oxygen_saturation: spo2,
            respiratory_rate: rr,
            weight: wt,
            height: ht,
            bmi: bmi,
            blood_sugar: bs,
            clinical_notes: logItem.remarks || enc.clinical_notes || null,
        };
    }
    formatHistoryVitals(ph) {
        if (!ph)
            return null;
        let sys = ph.systolic_bp ?? null;
        let dia = ph.diastolic_bp ?? null;
        let pulse = ph.pulse ?? null;
        let temp = ph.temperature ? Number(ph.temperature) : null;
        let spo2 = ph.oxygen_saturation ? Number(ph.oxygen_saturation) : null;
        let rr = ph.respiratory_rate ?? null;
        let wt = ph.weight ? Number(ph.weight) : null;
        let ht = ph.height ? Number(ph.height) : null;
        let bmi = ph.bmi ? Number(ph.bmi) : null;
        let bs = ph.blood_sugar ? String(ph.blood_sugar) : null;
        if (!bmi && wt && ht && ht > 0) {
            const hm = ht / 100;
            bmi = Number((wt / (hm * hm)).toFixed(1));
        }
        if (sys == null && dia == null && pulse == null && temp == null &&
            spo2 == null && wt == null && ht == null && !ph.clinical_notes && !ph.allergy_history) {
            return null;
        }
        return {
            id: String(ph.id || ph.patient_history_id),
            patient_history_id: ph.patient_history_id,
            visit_date: ph.visit_date,
            visit_type: ph.visit_type || "Outpatient (OPD)",
            treating_doctor_name: ph.treating_doctor_name || (ph.employees ? `Dr. ${[ph.employees.first_name, ph.employees.last_name].filter(Boolean).join(" ")}` : null),
            systolic_bp: sys,
            diastolic_bp: dia,
            pulse: pulse,
            temperature: temp,
            oxygen_saturation: spo2,
            respiratory_rate: rr,
            weight: wt,
            height: ht,
            bmi: bmi,
            blood_sugar: bs,
            allergy_history: ph.allergy_history || null,
            chronic_disease: ph.chronic_disease || null,
            clinical_notes: ph.clinical_notes || null,
        };
    }
    enrichLabOrder(order) {
        if (!order)
            return order;
        const orderReports = Array.isArray(order.lab_report)
            ? order.lab_report
            : order.lab_report
                ? [order.lab_report]
                : [];
        const orderItems = order.lab_order_item || [];
        const enrichedItems = orderItems.map((item) => {
            const candidateReports = orderReports.filter((r) => (0, lab_report_service_1.doesReportBelongToItem)(item, r, orderItems));
            const matchedReport = candidateReports.find((r) => Boolean(r.report_file)) ??
                candidateReports[0] ??
                null;
            const isReady = Boolean(matchedReport) &&
                (Boolean(matchedReport?.report_file) ||
                    ["REPORT GENERATED", "VERIFIED", "COMPLETED", "DELIVERED", "GENERATED"].includes((matchedReport?.report_status || "").toUpperCase()));
            const sampleCollection = Array.isArray(item.sample_collection) && item.sample_collection.length > 0
                ? item.sample_collection[0]
                : item.sample_collection || null;
            return {
                ...item,
                sample_collection: sampleCollection,
                lab_report: isReady ? matchedReport : null,
                is_ready: isReady,
            };
        });
        return {
            ...order,
            lab_order_item: enrichedItems,
        };
    }
    /**
     * List active branches for appointment booking
     */
    async getBranches() {
        return prisma_1.default.branch.findMany({
            where: {
                branch_status: {
                    in: ["Active", "ACTIVE"],
                },
            },
            select: {
                branch_id: true,
                branch_name: true,
                branch_area: true,
                district: true,
                state_name: true,
                address: true,
                emergency_no: true,
            },
            orderBy: { branch_name: "asc" },
        });
    }
    /**
     * List clinical departments, optionally filtered by branch
     */
    async getDepartments(branchId) {
        if (branchId) {
            const doctorDepts = await prisma_1.default.employees.findMany({
                where: {
                    department_id: { not: null },
                    emp_status: true,
                    user_table: { role_type: "DOCTOR" },
                    user_branch_mapping: {
                        some: {
                            branch_id: branchId,
                            status: 1,
                        },
                    },
                },
                select: { department_id: true },
                distinct: ["department_id"],
            });
            const deptIds = doctorDepts.map((d) => d.department_id).filter(Boolean);
            return prisma_1.default.department_master.findMany({
                where: {
                    department_id: { in: deptIds },
                },
                select: {
                    department_id: true,
                    department_name: true,
                },
                orderBy: { department_name: "asc" },
            });
        }
        return prisma_1.default.department_master.findMany({
            select: {
                department_id: true,
                department_name: true,
            },
            orderBy: { department_name: "asc" },
        });
    }
    /**
     * List active doctors, optionally filtered by branch and department
     */
    async getDoctors(params) {
        const where = {
            user_table: { role_type: "DOCTOR" },
            emp_status: true,
            user_branch_mapping: {
                some: {
                    status: 1,
                    ...(params.branchId ? { branch_id: params.branchId } : {}),
                },
            },
        };
        if (params.departmentId) {
            where.department_id = params.departmentId;
        }
        const doctors = await prisma_1.default.employees.findMany({
            where,
            select: {
                employee_id: true,
                first_name: true,
                middle_name: true,
                last_name: true,
                specialization: true,
                designation: true,
                qualification: true,
                employee_photo_URL: true,
                branch_id: true,
                department_id: true,
                department_master: {
                    select: {
                        department_id: true,
                        department_name: true,
                    },
                },
                user_branch_mapping: {
                    where: {
                        status: 1,
                        ...(params.branchId ? { branch_id: params.branchId } : {}),
                    },
                    select: {
                        branch_id: true,
                        branch: {
                            select: {
                                branch_id: true,
                                branch_name: true,
                                branch_area: true,
                            },
                        },
                    },
                },
            },
            orderBy: [{ first_name: "asc" }, { last_name: "asc" }],
        });
        return doctors.map((doc) => {
            const mapping = doc.user_branch_mapping?.[0];
            const branchId = mapping?.branch_id || doc.branch_id;
            const branchName = mapping?.branch?.branch_name;
            return {
                employee_id: doc.employee_id,
                first_name: doc.first_name,
                middle_name: doc.middle_name,
                last_name: doc.last_name,
                full_name: `Dr. ${doc.first_name}${doc.middle_name ? ` ${doc.middle_name}` : ""} ${doc.last_name}`.trim(),
                specialization: doc.specialization || doc.department_master?.department_name || "General Physician",
                designation: doc.designation || "Consultant",
                qualification: doc.qualification,
                photo_url: doc.employee_photo_URL,
                consultation_fee: 500,
                branch_id: branchId,
                branch_name: branchName,
                department_id: doc.department_id,
                department_name: doc.department_master?.department_name,
            };
        });
    }
    /**
     * Get available appointment slots for doctor, branch, and date
     */
    async getAvailableSlots(employeeId, branchId, date) {
        return this.appointmentService.getAvailableSlots(employeeId, branchId, date);
    }
    /**
     * Book an appointment directly by the authenticated patient
     */
    async bookAppointment(patientId, data, user) {
        const patient = await prisma_1.default.patient_bio_data.findUnique({
            where: { patient_id: patientId },
        });
        if (!patient) {
            throw new Error("Patient profile not found");
        }
        const fullName = [patient.patient_first_name, patient.patient_middle_name, patient.patient_last_name]
            .filter(Boolean)
            .join(" ");
        const payload = {
            patient_id: patientId,
            patient_name: fullName || "Patient",
            patient_number: patient.patient_primary_mobile || "",
            branch_id: data.branch_id,
            department_id: data.department_id,
            employee_id: data.employee_id,
            appointment_date: data.appointment_date,
            appointment_time: data.appointment_time,
            reason_for_visit: data.reason_for_visit || "OPD Consultation",
            patient_type: "Outpatient (OPD)",
            patient_visit_type: data.patient_visit_type || "Consultation",
            booking_source: "PATIENT_PORTAL",
            duration_minutes: Number(data.duration_minutes) || 10,
        };
        const createdBy = user?.username || patientId;
        return this.appointmentService.bookAppointment(payload, createdBy);
    }
    /**
     * Cancel an upcoming scheduled appointment by the patient
     */
    async cancelAppointment(patientId, appointmentId, reason) {
        const appointment = await prisma_1.default.appointment_history.findUnique({
            where: { appointment_id: appointmentId },
        });
        if (!appointment) {
            throw new Error("Appointment not found");
        }
        if (appointment.patient_id !== patientId) {
            throw new Error("You are not authorized to cancel this appointment");
        }
        if (appointment.status === "COMPLETED" || appointment.status === "CANCELLED") {
            throw new Error(`Cannot cancel appointment with status ${appointment.status}`);
        }
        return this.appointmentService.cancelAppointment(appointmentId, reason || "Cancelled by patient via portal", "PATIENT");
    }
    /**
     * Reschedule an upcoming scheduled appointment by the patient
     */
    async rescheduleAppointment(patientId, appointmentId, data, user) {
        const appointment = await prisma_1.default.appointment_history.findUnique({
            where: { appointment_id: appointmentId },
        });
        if (!appointment) {
            throw new Error("Appointment not found");
        }
        if (appointment.patient_id !== patientId) {
            throw new Error("You are not authorized to reschedule this appointment");
        }
        if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(appointment.status || "")) {
            throw new Error(`Cannot reschedule an appointment with status ${appointment.status}`);
        }
        if (["CHECKED_IN", "IN_CONSULTATION"].includes(appointment.status || "")) {
            throw new Error(`Cannot reschedule an appointment that is currently in progress`);
        }
        const payload = {
            employee_id: data.employee_id || appointment.employee_id || undefined,
            branch_id: data.branch_id || appointment.branch_id || undefined,
            department_id: data.department_id || appointment.department_id || undefined,
            appointment_date: data.appointment_date,
            appointment_time: data.appointment_time,
            reason_for_visit: data.reason_for_visit ?? appointment.reason_for_visit ?? undefined,
            patient_visit_type: data.patient_visit_type ??
                appointment.patient_visit_type ??
                appointment.Patient_visit_type ??
                "Consultation",
        };
        const actingUser = user?.username || patientId;
        return this.appointmentService.updateAppointment(appointmentId, payload, actingUser);
    }
    /**
     * Get all chemotherapy plans, cycles, planned drugs, and pre-chemo investigations for patient
     */
    async getChemotherapyPlans(patientId) {
        const plans = await prisma_1.default.chemotherapy_plan.findMany({
            where: {
                patient_id: patientId,
                active_status: 1,
            },
            orderBy: [
                { treatment_status: "asc" },
                { created_at: "desc" },
            ],
            include: {
                cancer_types: {
                    select: {
                        cancer_type: true,
                        staging_system: true,
                        icd10: true,
                    },
                },
                cancer_subtypes: {
                    select: {
                        subtype_name: true,
                    },
                },
                employees: {
                    select: {
                        first_name: true,
                        last_name: true,
                        specialization: true,
                        designation: true,
                    },
                },
                branch: {
                    select: {
                        branch_id: true,
                        branch_name: true,
                        branch_area: true,
                        emergency_no: true,
                        address: true,
                    },
                },
                chemotherapy_plan_items: {
                    where: { drug_role: "DISCHARGE", active_status: 1 },
                    orderBy: { drug_sequence: "asc" },
                    include: {
                        medicine_master: {
                            select: {
                                medicine_name: true,
                                generic_name: true,
                                dosage_form: true,
                                route: true,
                                unit: true,
                                strength: true,
                            },
                        },
                    },
                },
                chemotherapy_regimen_protocol: {
                    include: {
                        chemotherapy_discharge_instructions: {
                            where: { active_status: 1 },
                            orderBy: { drug_sequence: "asc" },
                            include: {
                                medicine_master: {
                                    select: {
                                        medicine_name: true,
                                        generic_name: true,
                                        dosage_form: true,
                                        route: true,
                                        unit: true,
                                        strength: true,
                                    },
                                },
                            },
                        },
                    },
                },
                chemotherapy_cycle: {
                    where: { active_status: 1 },
                    orderBy: { cycle_number: "asc" },
                    include: {
                        chemotherapy_plan_order: {
                            orderBy: { cycle_day: "asc" },
                            include: {
                                chemotherapy_plan_items: {
                                    where: { active_status: 1 },
                                    orderBy: { drug_sequence: "asc" },
                                    select: {
                                        chemotherapy_plan_item_id: true,
                                        drug_name: true,
                                        drug_role: true,
                                        calculated_dose: true,
                                        calculated_dose_unit: true,
                                        protocol_dose: true,
                                        protocol_dose_unit: true,
                                        administration_route: true,
                                        administration_detail: true,
                                        duration: true,
                                        infusion_duration_minutes: true,
                                        dilution_solution: true,
                                        dilution_volume: true,
                                        cycle_day: true,
                                        remarks: true,
                                        medicine_master: {
                                            select: {
                                                medicine_name: true,
                                                generic_name: true,
                                            },
                                        },
                                    },
                                },
                                chemotherapy_plan_order_investigation: {
                                    select: {
                                        investigation_id: true,
                                        investigation_name: true,
                                        investigation_type: true,
                                        investigation_category: true,
                                        priority: true,
                                        target_date: true,
                                        clinical_notes: true,
                                        item_status: true,
                                    },
                                },
                            },
                        },
                        chemotherapy_administration: {
                            where: { active_status: 1 },
                            orderBy: [
                                { administration_date: "asc" },
                                { administration_id: "asc" },
                            ],
                            include: {
                                chemotherapy_plan_items: {
                                    include: {
                                        medicine_master: {
                                            select: {
                                                medicine_name: true,
                                                generic_name: true,
                                                dosage_form: true,
                                                route: true,
                                                unit: true,
                                                strength: true,
                                            },
                                        },
                                    },
                                },
                                employees_chemotherapy_administration_administered_byToemployees: {
                                    select: {
                                        first_name: true,
                                        last_name: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        const plansWithSchedules = await Promise.all(plans.map(async (plan) => {
            let schedule = [];
            try {
                schedule = await (0, chemotherapy_schedule_1.computePlanSchedule)(prisma_1.default, plan);
            }
            catch (err) {
                console.error("Failed to compute plan schedule:", err?.message ?? err);
            }
            // Resolve discharge / take-home supportive medications for this plan
            let dischargeMeds = [];
            // 1. Patient plan-specific discharge items (customized by doctor for this patient)
            if (plan.chemotherapy_plan_items && plan.chemotherapy_plan_items.length > 0) {
                dischargeMeds = plan.chemotherapy_plan_items.map((it) => {
                    const medName = it.drug_name ||
                        it.medicine_master?.medicine_name ||
                        it.medicine_master?.generic_name ||
                        "Supportive Medication";
                    return {
                        id: it.chemotherapy_plan_item_id,
                        medicine_name: medName,
                        brand_name: it.medicine_master?.medicine_name || it.drug_name || null,
                        generic_name: it.medicine_master?.generic_name || null,
                        dosage_form: it.drug_type || it.formulation || it.medicine_master?.dosage_form || "Tablet",
                        dose: it.calculated_dose != null
                            ? Number(it.calculated_dose)
                            : it.protocol_dose != null
                                ? Number(it.protocol_dose)
                                : null,
                        dose_unit: it.calculated_dose_unit ||
                            it.protocol_dose_unit ||
                            it.medicine_master?.unit ||
                            "mg",
                        frequency: it.frequency || "As directed",
                        administration_route: it.administration_route || it.medicine_master?.route || "Oral",
                        administration_detail: it.administration_detail || "After Food",
                        duration: it.duration || "Until next cycle",
                        instructions: it.remarks || null,
                        source: "PATIENT_PLAN",
                    };
                });
            }
            else if (plan.chemotherapy_regimen_protocol?.chemotherapy_discharge_instructions &&
                plan.chemotherapy_regimen_protocol.chemotherapy_discharge_instructions.length > 0) {
                // 2. Standard discharge instructions configured on the linked regimen protocol
                dischargeMeds = plan.chemotherapy_regimen_protocol.chemotherapy_discharge_instructions.map((inst) => {
                    const medName = inst.drug_brand_name ||
                        inst.medicine_master?.medicine_name ||
                        inst.generic_name ||
                        "Supportive Medication";
                    return {
                        id: inst.discharge_instruction_id,
                        medicine_name: medName,
                        brand_name: inst.drug_brand_name || inst.medicine_master?.medicine_name || null,
                        generic_name: inst.generic_name || inst.medicine_master?.generic_name || null,
                        dosage_form: inst.drug_from || inst.medicine_master?.dosage_form || "Tablet",
                        dose: inst.patient_dose != null ? Number(inst.patient_dose) : null,
                        dose_unit: inst.patient_dose_unit || inst.medicine_master?.unit || "mg",
                        frequency: inst.frequency || "Once daily",
                        administration_route: inst.medicine_master?.route || "Oral",
                        administration_detail: inst.administration_detail || "After Food",
                        duration: inst.duration ||
                            (inst.duration_days ? `${inst.duration_days} Days` : "Until next cycle"),
                        instructions: inst.comment || null,
                        source: "PROTOCOL_STANDARD",
                    };
                });
            }
            else if (plan.source_protocol_id || plan.regimen_name) {
                // 3. Fallback: Query discharge instructions by protocol_id or regimen_name
                try {
                    const fallbackInstructions = await prisma_1.default.chemotherapy_discharge_instructions.findMany({
                        where: {
                            active_status: 1,
                            OR: [
                                ...(plan.source_protocol_id ? [{ protocol_id: plan.source_protocol_id }] : []),
                                ...(plan.regimen_name
                                    ? [{ chemotherapy_regimen_protocol: { regimen_name: plan.regimen_name } }]
                                    : []),
                            ],
                        },
                        orderBy: { drug_sequence: "asc" },
                        include: {
                            medicine_master: {
                                select: {
                                    medicine_name: true,
                                    generic_name: true,
                                    dosage_form: true,
                                    route: true,
                                    unit: true,
                                    strength: true,
                                },
                            },
                        },
                    });
                    if (fallbackInstructions.length > 0) {
                        dischargeMeds = fallbackInstructions.map((inst) => {
                            const medName = inst.drug_brand_name ||
                                inst.medicine_master?.medicine_name ||
                                inst.generic_name ||
                                "Supportive Medication";
                            return {
                                id: inst.discharge_instruction_id,
                                medicine_name: medName,
                                brand_name: inst.drug_brand_name || inst.medicine_master?.medicine_name || null,
                                generic_name: inst.generic_name || inst.medicine_master?.generic_name || null,
                                dosage_form: inst.drug_from || inst.medicine_master?.dosage_form || "Tablet",
                                dose: inst.patient_dose != null ? Number(inst.patient_dose) : null,
                                dose_unit: inst.patient_dose_unit || inst.medicine_master?.unit || "mg",
                                frequency: inst.frequency || "Once daily",
                                administration_route: inst.medicine_master?.route || "Oral",
                                administration_detail: inst.administration_detail || "After Food",
                                duration: inst.duration ||
                                    (inst.duration_days ? `${inst.duration_days} Days` : "Until next cycle"),
                                instructions: inst.comment || null,
                                source: "PROTOCOL_STANDARD",
                            };
                        });
                    }
                }
                catch (e) {
                    console.error("Failed to query fallback discharge instructions:", e?.message);
                }
            }
            return { plan, schedule, dischargeMeds };
        }));
        return plansWithSchedules.map(({ plan, schedule, dischargeMeds }) => {
            const docName = plan.employees
                ? `Dr. ${[plan.employees.first_name, plan.employees.last_name].filter(Boolean).join(" ")}`
                : null;
            const cycles = plan.chemotherapy_cycle || [];
            const completedCount = cycles.filter((c) => c.cycle_status === "COMPLETED" || c.completion_status === "COMPLETED").length;
            const formatOrders = (orders, cycleNumber) => (orders || []).map((o) => {
                const cNum = o.cycle_number || cycleNumber;
                const scheduledOrder = schedule.find((s) => s.cycle_number === cNum && s.cycle_day === o.cycle_day);
                const orderPlannedDate = o.planned_date || scheduledOrder?.planned_date || null;
                return {
                    plan_order_id: o.plan_order_id,
                    cycle_day: o.cycle_day,
                    planned_date: orderPlannedDate,
                    chemo_instructions: o.chemo_instructions,
                    additional_notes: o.additional_notes,
                    items: (o.chemotherapy_plan_items || []).map((it) => ({
                        chemotherapy_plan_item_id: it.chemotherapy_plan_item_id,
                        drug_name: it.drug_name ||
                            it.medicine_master?.medicine_name ||
                            it.medicine_master?.generic_name ||
                            "Chemotherapy Agent",
                        drug_role: it.drug_role,
                        calculated_dose: it.calculated_dose != null ? Number(it.calculated_dose) : null,
                        calculated_dose_unit: it.calculated_dose_unit,
                        protocol_dose: it.protocol_dose != null ? Number(it.protocol_dose) : null,
                        protocol_dose_unit: it.protocol_dose_unit,
                        administration_route: it.administration_route,
                        administration_detail: it.administration_detail,
                        duration: it.duration,
                        infusion_duration_minutes: it.infusion_duration_minutes,
                        dilution_solution: it.dilution_solution,
                        dilution_volume: it.dilution_volume,
                        cycle_day: it.cycle_day,
                        remarks: it.remarks,
                    })),
                    investigations: (o.chemotherapy_plan_order_investigation || []).map((inv) => ({
                        investigation_id: inv.investigation_id,
                        investigation_name: inv.investigation_name,
                        investigation_type: inv.investigation_type,
                        investigation_category: inv.investigation_category,
                        priority: inv.priority,
                        target_date: inv.target_date,
                        clinical_notes: inv.clinical_notes,
                        item_status: inv.item_status,
                    })),
                };
            });
            const formatChemoAdmin = (a) => {
                const administeredByName = a.employees_chemotherapy_administration_administered_byToemployees
                    ? `Nurse ${[a.employees_chemotherapy_administration_administered_byToemployees.first_name, a.employees_chemotherapy_administration_administered_byToemployees.last_name].filter(Boolean).join(" ")}`.trim()
                    : a.administered_by || null;
                const drugName = a.chemotherapy_plan_items?.drug_name ||
                    a.chemotherapy_plan_items?.medicine_master?.medicine_name ||
                    a.chemotherapy_plan_items?.medicine_master?.generic_name ||
                    "Chemotherapy Agent";
                return {
                    administration_id: a.administration_id,
                    chemotherapy_cycle_id: a.chemotherapy_cycle_id,
                    chemotherapy_plan_item_id: a.chemotherapy_plan_item_id,
                    plan_order_id: a.plan_order_id,
                    administration_date: a.administration_date,
                    administration_start_time: a.administration_start_time,
                    administration_end_time: a.administration_end_time,
                    administration_status: a.administration_status || "PENDING",
                    administered_dose: a.administered_dose != null ? Number(a.administered_dose) : null,
                    administered_dose_unit: a.administered_dose_unit ||
                        a.chemotherapy_plan_items?.calculated_dose_unit ||
                        a.chemotherapy_plan_items?.protocol_dose_unit ||
                        null,
                    administration_route: a.administration_route || a.chemotherapy_plan_items?.administration_route || null,
                    infusion_completed: a.infusion_completed ?? false,
                    iv_access_type: a.iv_access_type || null,
                    iv_site: a.iv_site || null,
                    cannula_size: a.cannula_size || null,
                    drug_name: drugName,
                    drug_role: a.chemotherapy_plan_items?.drug_role || "SUPPORTIVE",
                    medicine_name: a.chemotherapy_plan_items?.medicine_master?.medicine_name || drugName,
                    generic_name: a.chemotherapy_plan_items?.medicine_master?.generic_name || null,
                    dosage_form: a.chemotherapy_plan_items?.medicine_master?.dosage_form || null,
                    administered_by: a.administered_by,
                    administered_by_name: administeredByName,
                    verified_by: a.verified_by,
                    nursing_notes: a.nursing_notes,
                    remarks: a.remarks,
                    status_reason: a.status_reason,
                };
            };
            const formattedCycles = cycles.map((c) => {
                const scheduledDayOne = schedule.find((s) => s.cycle_number === c.cycle_number && s.cycle_day === 1);
                const cyclePlannedDate = c.rescheduled_date || scheduledDayOne?.planned_date || c.planned_date;
                return {
                    chemotherapy_cycle_id: c.chemotherapy_cycle_id,
                    cycle_number: c.cycle_number,
                    cycle_day: c.cycle_day,
                    planned_date: cyclePlannedDate,
                    actual_date: c.actual_date,
                    cycle_status: c.cycle_status,
                    completion_status: c.completion_status,
                    treatment_delay: c.treatment_delay,
                    delay_days: c.delay_days,
                    delay_reason: c.delay_reason,
                    rescheduled_date: c.rescheduled_date,
                    remarks: c.remarks,
                    physician_approved: c.physician_approved,
                    approval_date: c.approval_date,
                    orders: formatOrders(c.chemotherapy_plan_order, c.cycle_number),
                    administrations: (c.chemotherapy_administration || []).map(formatChemoAdmin),
                };
            });
            // All administrations across all cycles of the plan
            const allPlanAdmins = formattedCycles.flatMap((c) => c.administrations || []);
            // Correlate discharge / take-home supportive medications with administration records
            let enrichedDischargeMeds = dischargeMeds.map((med) => {
                const targetName = (med.medicine_name || med.brand_name || "").toLowerCase().trim();
                const targetGeneric = (med.generic_name || "").toLowerCase().trim();
                const matchedAdmin = allPlanAdmins.find((a) => {
                    if (med.id && a.chemotherapy_plan_item_id && med.id === a.chemotherapy_plan_item_id) {
                        return true;
                    }
                    const adminDrug = (a.drug_name || a.medicine_name || "").toLowerCase().trim();
                    const adminGeneric = (a.generic_name || "").toLowerCase().trim();
                    if (targetName && adminDrug && (adminDrug.includes(targetName) || targetName.includes(adminDrug))) {
                        return true;
                    }
                    if (targetGeneric && adminGeneric && (adminGeneric.includes(targetGeneric) || targetGeneric.includes(adminGeneric))) {
                        return true;
                    }
                    if (targetName && adminGeneric && (adminGeneric.includes(targetName) || targetName.includes(adminGeneric))) {
                        return true;
                    }
                    if (targetGeneric && adminDrug && (adminDrug.includes(targetGeneric) || targetGeneric.includes(adminDrug))) {
                        return true;
                    }
                    return false;
                });
                const isGiven = matchedAdmin
                    ? matchedAdmin.administration_status === "GIVEN" || matchedAdmin.administration_status === "Completed"
                    : false;
                return {
                    ...med,
                    is_administered: isGiven,
                    administration_status: matchedAdmin ? matchedAdmin.administration_status : "PENDING",
                    administered_date: matchedAdmin?.administration_date || null,
                    administered_dose: matchedAdmin?.administered_dose ?? null,
                    administered_dose_unit: matchedAdmin?.administered_dose_unit || med.dose_unit || null,
                    administered_route: matchedAdmin?.administration_route || med.administration_route || null,
                    administered_by_name: matchedAdmin?.administered_by_name || null,
                    nursing_notes: matchedAdmin?.nursing_notes || matchedAdmin?.remarks || null,
                    administration_id: matchedAdmin?.administration_id || null,
                };
            });
            // Also append any supportive or discharge medications administered at daycare
            const existingNames = new Set(enrichedDischargeMeds.map((m) => (m.medicine_name || "").toLowerCase().trim()));
            for (const a of allPlanAdmins) {
                if ((a.administration_status === "GIVEN" || a.administration_status === "Completed") &&
                    (a.drug_role === "DISCHARGE" || a.drug_role === "SUPPORTIVE")) {
                    const adminName = (a.drug_name || a.medicine_name || "").toLowerCase().trim();
                    if (!existingNames.has(adminName)) {
                        existingNames.add(adminName);
                        enrichedDischargeMeds.push({
                            id: a.administration_id,
                            medicine_name: a.drug_name || a.medicine_name,
                            brand_name: a.medicine_name || null,
                            generic_name: a.generic_name || null,
                            dosage_form: a.dosage_form || "Tablet",
                            dose: a.administered_dose ?? null,
                            dose_unit: a.administered_dose_unit || "mg",
                            frequency: "Administered at Center",
                            administration_route: a.administration_route || "IV",
                            administration_detail: "Administered during daycare stay",
                            duration: "Completed",
                            instructions: a.nursing_notes || a.remarks || "Administered as supportive medication",
                            source: "ADMINISTRATION_RECORD",
                            is_administered: true,
                            administration_status: "GIVEN",
                            administered_date: a.administration_date,
                            administered_dose: a.administered_dose,
                            administered_dose_unit: a.administered_dose_unit,
                            administered_route: a.administration_route,
                            administered_by_name: a.administered_by_name,
                            nursing_notes: a.nursing_notes || a.remarks,
                            administration_id: a.administration_id,
                        });
                    }
                }
            }
            // Find current / next upcoming cycle from the formatted cycles
            const upcomingCycles = formattedCycles.filter((c) => c.cycle_status !== "COMPLETED" && c.completion_status !== "COMPLETED");
            const nextCycle = upcomingCycles[0] || null;
            const firstDate = schedule[0]?.planned_date || plan.treatment_start_date;
            const lastDate = schedule[schedule.length - 1]?.planned_date || plan.expected_end_date;
            return {
                chemotherapy_plan_id: plan.chemotherapy_plan_id,
                patient_id: plan.patient_id,
                regimen_name: plan.regimen_name,
                regimen_code: plan.regimen_code,
                protocol_name: plan.protocol_name,
                treatment_status: plan.treatment_status,
                treatment_intent: plan.treatment_intent,
                cancer_stage: plan.cancer_stage,
                cancer_type: plan.cancer_type || plan.cancer_types?.cancer_type,
                cancer_subtype: plan.cancer_subtype || plan.cancer_subtypes?.subtype_name,
                planned_cycles: plan.planned_cycles,
                completed_cycles: completedCount || plan.completed_cycles || 0,
                cycle_interval_days: plan.cycle_interval_days,
                treatment_start_date: firstDate,
                expected_end_date: lastDate,
                remarks: plan.remarks,
                discussion: plan.discussion,
                dosing_height_cm: plan.dosing_height_cm,
                dosing_weight_kg: plan.dosing_weight_kg,
                dosing_bsa: plan.dosing_bsa,
                doctor: {
                    name: docName,
                    specialization: plan.employees?.specialization || "Medical Oncology",
                    designation: plan.employees?.designation,
                },
                branch: plan.branch,
                progress_percentage: plan.planned_cycles > 0
                    ? Math.round((completedCount / plan.planned_cycles) * 100)
                    : 0,
                next_upcoming_cycle: nextCycle
                    ? {
                        ...nextCycle,
                    }
                    : null,
                discharge_medications: enrichedDischargeMeds,
                cycles: formattedCycles,
            };
        });
    }
}
exports.PatientPortalService = PatientPortalService;
