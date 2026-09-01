import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { generateId, generateIdBatch } from "../../utils/idGenerator";
import { GetPrescriptionsQuery } from "./prescription.types";

const prescriptionItemInclude = {
    medicine_master: {
        select: {
            medicine_id: true,
            medicine_code: true,
            medicine_name: true,
            generic_name: true,
            dosage_form: true,
            strength: true
        }
    }
};

const prescriptionDetailInclude = {
    patient_history: {
        select: {
            patient_history_id: true,
            appointment_id: true,
            visit_date: true,
            patient_bio_data: {
                select: {
                    patient_id: true,
                    patient_first_name: true,
                    patient_middle_name: true,
                    patient_last_name: true,
                    patient_gender: true,
                    patient_primary_mobile: true
                }
            }
        }
    },
    employees: {
        select: {
            employee_id: true,
            first_name: true,
            middle_name: true,
            last_name: true,
            specialization: true
        }
    },
    branch: {
        select: {
            branch_id: true,
            branch_name: true,
            branch_area: true
        }
    },
    department_master: {
        select: {
            department_id: true,
            department_name: true
        }
    },
    diagnosis: {
        select: {
            diagnosis_id: true,
            diagnosis_name: true,
            icd_code: true
        }
    },
    prescription_items: {
        include: prescriptionItemInclude
    }
};

function startOfDay(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
}

function startOfNextDay(date: string): Date {
    const day = startOfDay(date);
    day.setUTCDate(day.getUTCDate() + 1);
    return day;
}

export class PrescriptionRepository {

    async findEncounterForPrescription(encounterNo: string) {

        return prisma.encounter.findUnique({
            where: { encounter_no: encounterNo },
            include: {
                patient_bio_data: true,
                employees: true,
                branch: true,
                department_master: true
            }
        });

    }

    async findDiagnosis(diagnosisId: string) {

        return prisma.diagnosis.findUnique({
            where: { diagnosis_id: diagnosisId }
        });

    }

    async findMedicine(medicineId: string) {

        return prisma.medicine_master.findUnique({
            where: { medicine_id: medicineId }
        });

    }

    async findMedicines(medicineIds: string[]) {

        if (medicineIds.length === 0) {
            return [];
        }

        return prisma.medicine_master.findMany({
            where: { medicine_id: { in: medicineIds } }
        });

    }

    async findPatientHistoryByAppointment(appointmentId: string) {

        return prisma.patient_history.findFirst({
            where: { appointment_id: appointmentId }
        });

    }

    async generatePatientHistoryId(tx: Prisma.TransactionClient) {

        return generateId(tx, "PATIENT_HISTORY");

    }

    async createPatientHistory(tx: Prisma.TransactionClient, data: Prisma.patient_historyUncheckedCreateInput) {

        return tx.patient_history.create({ data });

    }

    async generatePrescriptionNumber(tx: Prisma.TransactionClient) {

        return generateId(tx, "PRESCRIPTION");

    }

    async generatePrescriptionItemId(tx: Prisma.TransactionClient) {

        return generateId(tx, "PRESCRIPTION_ITEM");

    }

    // One sequence lock + one update for the whole batch instead of three
    // queries per item - keeps the createPrescription transaction far
    // under Prisma's interactive transaction timeout.
    async generatePrescriptionItemIds(tx: Prisma.TransactionClient, count: number) {

        return generateIdBatch(tx, "PRESCRIPTION_ITEM", count);

    }

    async createPrescription(tx: Prisma.TransactionClient, data: Prisma.prescriptionUncheckedCreateInput) {

        return tx.prescription.create({ data });

    }

    async createPrescriptionItem(tx: Prisma.TransactionClient, data: Prisma.prescription_itemsUncheckedCreateInput) {

        return tx.prescription_items.create({
            data,
            include: prescriptionItemInclude
        });

    }

    async createPrescriptionItems(tx: Prisma.TransactionClient, data: Prisma.prescription_itemsUncheckedCreateInput[]) {

        await tx.prescription_items.createMany({ data });

    }

    async getPrescriptionById(prescriptionId: string) {

        return prisma.prescription.findUnique({
            where: { prescription_id: prescriptionId },
            include: prescriptionDetailInclude
        });

    }

    async updatePrescription(prescriptionId: string, data: Prisma.prescriptionUncheckedUpdateInput) {

        return prisma.prescription.update({
            where: { prescription_id: prescriptionId },
            data,
            include: prescriptionDetailInclude
        });

    }

    async findPrescriptionItem(prescriptionId: string, itemId: string) {

        return prisma.prescription_items.findFirst({
            where: {
                prescription_item_id: itemId,
                prescription_id: prescriptionId
            }
        });

    }

    async findDuplicateMedicineItem(prescriptionId: string, medicineId: string, excludeItemId?: string) {

        return prisma.prescription_items.findFirst({
            where: {
                prescription_id: prescriptionId,
                medicine_id: medicineId,
                ...(excludeItemId
                    ? { prescription_item_id: { not: excludeItemId } }
                    : {})
            }
        });

    }

    async getPrescriptionItems(prescriptionId: string) {

        return prisma.prescription_items.findMany({
            where: { prescription_id: prescriptionId },
            include: prescriptionItemInclude,
            orderBy: { id: "asc" }
        });

    }

    async updatePrescriptionItem(itemId: string, data: Prisma.prescription_itemsUncheckedUpdateInput) {

        return prisma.prescription_items.update({
            where: { prescription_item_id: itemId },
            data,
            include: prescriptionItemInclude
        });

    }

    async deletePrescriptionItem(itemId: string) {

        return prisma.prescription_items.delete({
            where: { prescription_item_id: itemId }
        });

    }

    async getSuggestedMedicines(diagnosisId: string) {

        return prisma.diagnosis_medicine_mapping.findMany({
            where: { diagnosis_id: diagnosisId },
            include: {
                medicine_master: {
                    select: {
                        medicine_id: true,
                        medicine_name: true,
                        generic_name: true,
                        dosage_form: true,
                        strength: true,
                        route: true
                    }
                }
            },
            orderBy: [{ is_primary: "desc" }]
        });

    }

    async getPrescriptions(query: GetPrescriptionsQuery) {

        const {
            branchId,
            doctorId,
            patientHistoryId,
            appointmentId,
            diagnosisId,
            status,
            date,
            dateFrom,
            dateTo,
            search,
            sortBy = "prescription_date",
            sortOrder = "desc",
            page = 1,
            limit = 10
        } = query;

        const where: Prisma.prescriptionWhereInput = {};

        if (branchId) where.branch_id = branchId;
        if (doctorId) where.employee_id = doctorId;
        if (patientHistoryId) where.patient_history_id = patientHistoryId;
        if (diagnosisId) where.diagnosis_id = diagnosisId;
        if (status) where.prescription_status = status;

        if (appointmentId) {
            where.patient_history = { appointment_id: appointmentId };
        }

        if (date) {
            where.prescription_date = {
                gte: startOfDay(date),
                lt: startOfNextDay(date)
            };
        } else if (dateFrom || dateTo) {
            where.prescription_date = {
                ...(dateFrom ? { gte: startOfDay(dateFrom) } : {}),
                ...(dateTo ? { lt: startOfNextDay(dateTo) } : {})
            };
        }

        if (search) {
            where.OR = [
                { prescription_id: { contains: search, mode: "insensitive" } },
                {
                    patient_history: {
                        patient_bio_data: {
                            OR: [
                                { patient_first_name: { contains: search, mode: "insensitive" } },
                                { patient_last_name: { contains: search, mode: "insensitive" } }
                            ]
                        }
                    }
                },
                {
                    employees: {
                        OR: [
                            { first_name: { contains: search, mode: "insensitive" } },
                            { last_name: { contains: search, mode: "insensitive" } }
                        ]
                    }
                }
            ];
        }

        const orderBy: Prisma.prescriptionOrderByWithRelationInput =
            sortBy === "created_at"
                ? { created_at: sortOrder }
                : sortBy === "status"
                    ? { prescription_status: sortOrder }
                    : { prescription_date: sortOrder };

        const [prescriptions, total] = await Promise.all([
            prisma.prescription.findMany({
                where,
                include: prescriptionDetailInclude,
                orderBy,
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.prescription.count({ where })
        ]);

        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            prescriptions
        };

    }

    async getPrescriptionsByPatientHistoryId(patientHistoryId: string) {

        const where: Prisma.prescriptionWhereInput = {
            patient_history_id: patientHistoryId
        };

        const prescriptions = await prisma.prescription.findMany({
            where,
            include: prescriptionDetailInclude,
            orderBy: { prescription_date: "desc" }
        });

        return prescriptions;
    }

    async getPrescriptionsByPatientId(patientId: string, query: GetPrescriptionsQuery = {}) {
        const {
            branchId,
            doctorId,
            status,
            date,
            dateFrom,
            dateTo,
            search,
            sortBy = "prescription_date",
            sortOrder = "desc",
            page = 1,
            limit = 10
        } = query;

        const where: Prisma.prescriptionWhereInput = {
            patient_history: {
                patient_id: patientId
            }
        };

        if (branchId) where.branch_id = branchId;
        if (doctorId) where.employee_id = doctorId;
        if (status) where.prescription_status = status;

        if (date) {
            where.prescription_date = {
                gte: startOfDay(date),
                lt: startOfNextDay(date)
            };
        } else if (dateFrom || dateTo) {
            where.prescription_date = {
                ...(dateFrom ? { gte: startOfDay(dateFrom) } : {}),
                ...(dateTo ? { lt: startOfNextDay(dateTo) } : {})
            };
        }

        if (search) {
            where.OR = [
                { prescription_id: { contains: search, mode: "insensitive" } },
                {
                    patient_history: {
                        patient_bio_data: {
                            OR: [
                                { patient_first_name: { contains: search, mode: "insensitive" } },
                                { patient_last_name: { contains: search, mode: "insensitive" } }
                            ]
                        }
                    }
                },
                {
                    employees: {
                        OR: [
                            { first_name: { contains: search, mode: "insensitive" } },
                            { last_name: { contains: search, mode: "insensitive" } }
                        ]
                    }
                }
            ];
        }

        const orderBy: Prisma.prescriptionOrderByWithRelationInput =
            sortBy === "created_at"
                ? { created_at: sortOrder }
                : sortBy === "status"
                    ? { prescription_status: sortOrder }
                    : { prescription_date: sortOrder };

        const [prescriptions, total] = await Promise.all([
            prisma.prescription.findMany({
                where,
                include: prescriptionDetailInclude,
                orderBy,
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.prescription.count({ where })
        ]);

        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            prescriptions
        };
    }

}
