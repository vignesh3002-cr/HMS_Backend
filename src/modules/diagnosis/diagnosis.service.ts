import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { DiagnosisRepository } from "./diagnosis.repository";
import {
    CreateDiagnosisDto,
    UpdateDiagnosisDto,
    GetDiagnosesQuery
} from "./diagnosis.types";

const repository = new DiagnosisRepository();

export class DiagnosisService {

    private async validateReferences(data: {

        branch_id?: string;
        department_id?: string;
        diagnosing_doctor_id?: string;
        cancer_type_id?: string;
        cancer_stage_id?: string;
        tnm_stage_id?: string;
        histomorphology_id?: string;
        histological_grade_id?: string;
        icd_code_id?: string;

    }) {

        if (data.branch_id) {

            const branch = await repository.findBranch(data.branch_id);

            if (!branch) {
                throw new Error("Branch not found");
            }

        }

        if (data.department_id) {

            const department = await repository.findDepartment(data.department_id);

            if (!department) {
                throw new Error("Department not found");
            }

        }

        if (data.diagnosing_doctor_id) {

            const doctor = await repository.findDoctor(data.diagnosing_doctor_id);

            if (!doctor) {
                throw new Error("Diagnosing doctor not found");
            }

        }

        if (data.cancer_type_id) {

            const cancerType = await repository.findCancerType(data.cancer_type_id);

            if (!cancerType) {
                throw new Error("Cancer type not found");
            }

        }

        if (data.cancer_stage_id) {

            const cancerStage = await repository.findCancerStage(data.cancer_stage_id);

            if (!cancerStage) {
                throw new Error("Cancer stage not found");
            }

        }

        if (data.tnm_stage_id) {

            const tnmStage = await repository.findTnmStage(data.tnm_stage_id);

            if (!tnmStage) {
                throw new Error("TNM stage not found");
            }

        }

        if (data.histomorphology_id) {

            const histomorphology = await repository.findHistomorphology(
                data.histomorphology_id
            );

            if (!histomorphology) {
                throw new Error("Histomorphology not found");
            }

        }

        if (data.histological_grade_id) {

            const grade = await repository.findHistologicalGrade(
                data.histological_grade_id
            );

            if (!grade) {
                throw new Error("Histological grade not found");
            }

        }

        if (data.icd_code_id) {

            const icdCode = await repository.findIcdCode(data.icd_code_id);

            if (!icdCode) {
                throw new Error("ICD code not found");
            }

        }

    }

    async createDiagnosis(data: CreateDiagnosisDto, createdBy: string) {

        const patient = await repository.findPatient(data.patient_id);

        if (!patient) {
            throw new Error("Patient not found");
        }

        await this.validateReferences(data);

        return prisma.$transaction(async (tx) => {

            const diagnosisId = await generateId(tx, "DIAGNOSIS");

            return tx.diagnosis.create({

                data: {

                    diagnosis_id: diagnosisId,

                    patient_bio_data: { connect: { patient_id: data.patient_id } },

                    branch: data.branch_id
                        ? { connect: { branch_id: data.branch_id } }
                        : undefined,

                    department_master: data.department_id
                        ? { connect: { department_id: data.department_id } }
                        : undefined,

                    employees: data.diagnosing_doctor_id
                        ? { connect: { employee_id: data.diagnosing_doctor_id } }
                        : undefined,

                    cancer_type_master: data.cancer_type_id
                        ? { connect: { cancer_type_id: data.cancer_type_id } }
                        : undefined,

                    cancer_stage_master: data.cancer_stage_id
                        ? { connect: { cancer_stage_id: data.cancer_stage_id } }
                        : undefined,

                    tnm_stage_master: data.tnm_stage_id
                        ? { connect: { tnm_stage_id: data.tnm_stage_id } }
                        : undefined,

                    histomorphology_master: data.histomorphology_id
                        ? { connect: { histomorphology_id: data.histomorphology_id } }
                        : undefined,

                    histological_grade_master: data.histological_grade_id
                        ? {
                            connect: {
                                histological_grade_id: data.histological_grade_id
                            }
                        }
                        : undefined,

                    icd_code_master: data.icd_code_id
                        ? { connect: { icd_code_id: data.icd_code_id } }
                        : undefined,

                    primary_site: data.primary_site,

                    laterality: data.laterality,

                    diagnosis_date: data.diagnosis_date
                        ? new Date(data.diagnosis_date)
                        : undefined,

                    diagnosis_basis: data.diagnosis_basis,

                    clinical_notes: data.clinical_notes,

                    created_by: createdBy

                }

            });

        });

    }

    async getDiagnoses(query: GetDiagnosesQuery) {

        return repository.list(query);

    }

    async getDiagnosisById(diagnosisId: string) {

        const record = await repository.findById(diagnosisId);

        if (!record) {
            throw new Error("Diagnosis not found");
        }

        return record;

    }

    async updateDiagnosis(
        diagnosisId: string,
        data: UpdateDiagnosisDto,
        updatedBy: string
    ) {

        const existing = await repository.findById(diagnosisId);

        if (!existing) {
            throw new Error("Diagnosis not found");
        }

        await this.validateReferences(data);

        return repository.update(diagnosisId, {

            branch: data.branch_id
                ? { connect: { branch_id: data.branch_id } }
                : undefined,

            department_master: data.department_id
                ? { connect: { department_id: data.department_id } }
                : undefined,

            employees: data.diagnosing_doctor_id
                ? { connect: { employee_id: data.diagnosing_doctor_id } }
                : undefined,

            cancer_type_master: data.cancer_type_id
                ? { connect: { cancer_type_id: data.cancer_type_id } }
                : undefined,

            cancer_stage_master: data.cancer_stage_id
                ? { connect: { cancer_stage_id: data.cancer_stage_id } }
                : undefined,

            tnm_stage_master: data.tnm_stage_id
                ? { connect: { tnm_stage_id: data.tnm_stage_id } }
                : undefined,

            histomorphology_master: data.histomorphology_id
                ? { connect: { histomorphology_id: data.histomorphology_id } }
                : undefined,

            histological_grade_master: data.histological_grade_id
                ? { connect: { histological_grade_id: data.histological_grade_id } }
                : undefined,

            icd_code_master: data.icd_code_id
                ? { connect: { icd_code_id: data.icd_code_id } }
                : undefined,

            primary_site: data.primary_site,

            laterality: data.laterality,

            diagnosis_date: data.diagnosis_date
                ? new Date(data.diagnosis_date)
                : undefined,

            diagnosis_basis: data.diagnosis_basis,

            clinical_notes: data.clinical_notes,

            diagnosis_status: data.diagnosis_status,

            is_active: data.is_active,

            updated_by: updatedBy

        });

    }

    async deleteDiagnosis(diagnosisId: string, updatedBy: string) {

        const existing = await repository.findById(diagnosisId);

        if (!existing) {
            throw new Error("Diagnosis not found");
        }

        return repository.update(diagnosisId, {
            is_active: false,
            updated_by: updatedBy
        });

    }

    async restoreDiagnosis(diagnosisId: string, updatedBy: string) {

        const existing = await repository.findById(diagnosisId);

        if (!existing) {
            throw new Error("Diagnosis not found");
        }

        return repository.update(diagnosisId, {
            is_active: true,
            updated_by: updatedBy
        });

    }

}
