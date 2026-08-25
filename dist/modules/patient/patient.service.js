"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = __importDefault(require("../../config/prisma"));
const patient_repository_1 = require("./patient.repository");
const idGenerator_1 = require("../../utils/idGenerator");
const repository = new patient_repository_1.PatientRepository();
class PatientService {
    async createPatient(data, createdBy) {
        const username = await repository.findUsername(data.username);
        if (username) {
            throw new Error("Username already exists");
        }
        if (data.email) {
            const email = await repository.findEmail(data.email);
            if (email) {
                throw new Error("Email already exists");
            }
        }
        const mobile = await repository.findMobile(data.mobile);
        if (mobile) {
            throw new Error("Mobile already exists");
        }
        const branch = await repository.findBranch(data.branch_id);
        if (!branch) {
            throw new Error("Branch not found");
        }
        const hashedPassword = await bcrypt_1.default.hash(data.password, Number(process.env.BCRYPT_SALT_ROUNDS));
        return prisma_1.default.$transaction(async (tx) => {
            const userId = await (0, idGenerator_1.generateId)(tx, "USER");
            const user = await tx.user_table.create({
                data: {
                    user_id: userId,
                    username: data.username,
                    password: hashedPassword,
                    role_type: "PATIENT",
                    created_by: createdBy,
                    branch_id: data.branch_id,
                    user_status: 0
                }
            });
            const patientId = await (0, idGenerator_1.generateId)(tx, "PATIENT");
            const patient = await tx.patient_bio_data.create({
                data: {
                    patient_id: patientId,
                    user_id: user.user_id,
                    branch_id: data.branch_id,
                    patient_first_name: data.first_name,
                    patient_middle_name: data.middle_name,
                    patient_last_name: data.last_name,
                    patient_gender: data.gender,
                    patient_dob: data.dob
                        ? new Date(data.dob)
                        : undefined,
                    patient_age: data.age,
                    patient_blood_group: data.blood_group,
                    patient_primary_mobile: data.mobile,
                    patient_alternate_mobile: data.alternate_mobile,
                    patient_email: data.email,
                    patient_marital_status: data.marital_status,
                    patient_nationality: data.nationality,
                    patient_photo_url: data.photo,
                    patient_type: data.patient_type,
                    patient_active: "Active",
                    patient_state: data.patient_state,
                    patient_district: data.patient_district,
                    patient_area: data.patient_area,
                    patient_pincode: data.patient_pincode,
                    Patient_address: data.current_address,
                    Patient_Emergency_contact_name: data.emergency_name,
                    Emergency_contact_relation: data.emergency_relation,
                    Patient_emergency_mobile: data.emergency_mobile
                }
            });
            return {
                patient: {
                    patient_id: patient.patient_id,
                    patient_first_name: patient.patient_first_name,
                    patient_middle_name: patient.patient_middle_name,
                    patient_last_name: patient.patient_last_name
                },
                user: {
                    user_id: user.user_id,
                    username: user.username
                }
            };
        });
    }
    async getPatients(query) {
        return repository.getPatients(query);
    }
    async getPatientById(patientId) {
        const patient = await repository.getPatientById(patientId);
        if (!patient) {
            throw new Error("Patient not found");
        }
        return {
            ...patient,
            current_address: patient.Patient_address ?? null,
            emergency_name: patient.Patient_Emergency_contact_name ?? null,
            emergency_relation: patient.Emergency_contact_relation ?? null,
            emergency_mobile: patient.Patient_emergency_mobile ?? null
        };
    }
    async updatePatient(patientId, data) {
        const existing = await repository.getPatientById(patientId);
        if (!existing) {
            throw new Error("Patient not found");
        }
        if (data.email &&
            data.email !== existing.patient_email) {
            const email = await repository.findEmail(data.email);
            if (email) {
                throw new Error("Email already exists");
            }
        }
        if (data.mobile &&
            data.mobile !== existing.patient_primary_mobile) {
            const mobile = await repository.findMobile(data.mobile);
            if (mobile) {
                throw new Error("Mobile already exists");
            }
        }
        if (data.branch_id) {
            const branch = await repository.findBranch(data.branch_id);
            if (!branch) {
                throw new Error("Branch not found");
            }
        }
        return repository.updatePatient(patientId, {
            patient_first_name: data.first_name,
            patient_middle_name: data.middle_name,
            patient_last_name: data.last_name,
            patient_gender: data.gender,
            patient_dob: data.dob
                ? new Date(data.dob)
                : undefined,
            patient_age: data.age,
            patient_blood_group: data.blood_group,
            patient_primary_mobile: data.mobile,
            patient_alternate_mobile: data.alternate_mobile,
            patient_email: data.email,
            patient_marital_status: data.marital_status,
            patient_nationality: data.nationality,
            patient_photo_url: data.photo,
            patient_type: data.patient_type,
            patient_active: data.patient_active,
            patient_state: data.patient_state,
            patient_district: data.patient_district,
            patient_area: data.patient_area,
            patient_pincode: data.patient_pincode,
            Patient_address: data.current_address,
            Patient_Emergency_contact_name: data.emergency_name,
            Emergency_contact_relation: data.emergency_relation,
            Patient_emergency_mobile: data.emergency_mobile,
            branch: data.branch_id
                ? {
                    connect: {
                        branch_id: data.branch_id
                    }
                }
                : undefined
        });
    }
    async createPatientHistory(data, createdBy) {
        const hasAnyVital = data.systolicBp !== undefined ||
            data.diastolicBp !== undefined ||
            data.pulse !== undefined ||
            data.respiratoryRate !== undefined ||
            data.temperature !== undefined ||
            data.oxygenSaturation !== undefined ||
            (data.bloodSugar !== undefined && data.bloodSugar !== "") ||
            data.weight !== undefined ||
            data.height !== undefined ||
            data.severity !== undefined ||
            data.painScore !== undefined ||
            (data.clinicalNotes !== undefined && data.clinicalNotes !== "");
        if (!hasAnyVital) {
            throw new Error("At least one vital value is required to record vitals.");
        }
        let branchId = data.branchId;
        let departmentId = data.departmentId;
        let employeeId = data.employeeId;
        if (data.appointmentId) {
            const appointment = await prisma_1.default.appointment_history.findUnique({
                where: { appointment_id: data.appointmentId },
                select: {
                    branch_id: true,
                    department_id: true,
                    employee_id: true,
                }
            });
            if (appointment) {
                branchId ??= appointment.branch_id ?? undefined;
                departmentId ??= appointment.department_id ?? undefined;
                employeeId ??= appointment.employee_id ?? undefined;
            }
        }
        // If still no branch, use createdBy's branch
        if (!branchId) {
            const user = await prisma_1.default.user_table.findUnique({
                where: { user_id: createdBy },
                select: { branch_id: true }
            });
            branchId ??= user?.branch_id ?? undefined;
        }
        if (!branchId) {
            throw new Error("Branch not found for the current user. Unable to record vitals.");
        }
        let computedBmi = null;
        if (data.height && data.weight) {
            computedBmi = Math.round((data.weight / Math.pow(data.height / 100, 2)) * 10) / 10;
        }
        const bloodSugarRaw = data.bloodSugar !== undefined && data.bloodSugar !== null && String(data.bloodSugar).trim() !== ""
            ? Number(data.bloodSugar)
            : NaN;
        const bloodSugarValue = Number.isFinite(bloodSugarRaw) ? bloodSugarRaw : null;
        const painRaw = data.severity ?? data.painScore;
        const painScoreValue = painRaw === undefined || painRaw === null ? null : BigInt(painRaw);
        return prisma_1.default.$transaction(async (tx) => {
            let encounter = data.appointmentId
                ? await tx.encounter.findUnique({ where: { appointment_id: data.appointmentId } })
                : null;
            if (!encounter) {
                const encounterNo = await (0, idGenerator_1.generateId)(tx, "ENCOUNTER");
                encounter = await tx.encounter.create({
                    data: {
                        encounter_no: encounterNo,
                        branch_id: branchId,
                        patient_id: data.patientId,
                        appointment_id: data.appointmentId,
                        department_id: departmentId,
                        employee_id: employeeId,
                        user_id: createdBy,
                    }
                });
            }
            // Per-field fill: only write fields that are still empty on the encounter
            const updateData = {};
            const fillIfEmpty = (key, existing, incoming) => {
                if (incoming !== undefined && incoming !== null && (existing === null || existing === undefined)) {
                    updateData[key] = incoming;
                }
            };
            fillIfEmpty("systolic_bp", encounter.systolic_bp, data.systolicBp);
            fillIfEmpty("diastolic_bp", encounter.diastolic_bp, data.diastolicBp);
            fillIfEmpty("pulse", encounter.pulse, data.pulse);
            fillIfEmpty("respiratory_rate", encounter.respiratory_rate, data.respiratoryRate);
            fillIfEmpty("spo2", encounter.spo2, data.oxygenSaturation);
            fillIfEmpty("temperature", encounter.temperature, data.temperature);
            fillIfEmpty("weight", encounter.weight, data.weight);
            fillIfEmpty("height", encounter.height, data.height);
            fillIfEmpty("BMI", encounter.BMI, computedBmi);
            fillIfEmpty("blood_sugar", encounter.blood_sugar, bloodSugarValue);
            fillIfEmpty("pain_score", encounter.pain_score, painScoreValue);
            fillIfEmpty("clinical_notes", encounter.clinical_notes, data.clinicalNotes);
            if (Object.keys(updateData).length > 0) {
                encounter = await tx.encounter.update({
                    where: { encounter_no: encounter.encounter_no },
                    data: updateData
                });
            }
            return {
                patientHistoryId: encounter.encounter_no,
                patientId: encounter.patient_id,
                appointmentId: encounter.appointment_id,
                visitDate: encounter.encounter_ts.toISOString(),
                systolicBp: encounter.systolic_bp,
                diastolicBp: encounter.diastolic_bp,
                pulse: encounter.pulse,
                respiratoryRate: encounter.respiratory_rate,
                temperature: encounter.temperature === null ? null : Number(encounter.temperature),
                oxygenSaturation: encounter.spo2,
                bloodSugar: encounter.blood_sugar === null ? null : encounter.blood_sugar.toString(),
                weight: encounter.weight === null ? null : Number(encounter.weight),
                height: encounter.height === null ? null : Number(encounter.height),
                bmi: encounter.BMI === null ? null : Number(encounter.BMI),
                painScore: encounter.pain_score === null ? null : Number(encounter.pain_score),
                severity: encounter.pain_score === null ? null : Number(encounter.pain_score),
                visitType: encounter.encounter_type,
                visitStatus: encounter.status,
                clinicalNotes: encounter.clinical_notes,
            };
        });
    }
}
exports.PatientService = PatientService;
