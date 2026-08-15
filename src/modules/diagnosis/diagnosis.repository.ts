import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import {
    DiagnosisCategory,
    DiagnosisItem,
    GetDiagnosisCategoriesQuery,
    GetDiagnosesByCategoryQuery,
} from "./diagnosis.types";

export class DiagnosisRepository {
    async getDiagnosisCategories(query: GetDiagnosisCategoriesQuery) {
        const { search, activeOnly = true, page = 1, limit = 50 } = query;

        const where: Prisma.diagnosisWhereInput = {};

        if (activeOnly) {
            where.active_status = 1;
        }

        if (search) {
            where.OR = [
                { diagnosis_category: { contains: search, mode: "insensitive" } },
                { diagnosis_catogory_id: { contains: search, mode: "insensitive" } },
            ];
        }

        // Get distinct categories with counts
        const categories = await prisma.diagnosis.groupBy({
            by: ["diagnosis_catogory_id", "diagnosis_category"],
            where,
            _count: {
                diagnosis_id: true,
            },
            orderBy: {
                diagnosis_category: "asc",
            },
            skip: (page - 1) * limit,
            take: limit,
        });

        const total = await prisma.diagnosis.groupBy({
            by: ["diagnosis_catogory_id", "diagnosis_category"],
            where,
        });

        const formattedCategories: DiagnosisCategory[] = categories.map((cat) => ({
            diagnosis_catogory_id: cat.diagnosis_catogory_id ?? "",
            diagnosis_category: cat.diagnosis_category ?? "Uncategorized",
            count: cat._count.diagnosis_id,
        }));

        return {
            total: total.length,
            page,
            limit,
            totalPages: Math.ceil(total.length / limit),
            categories: formattedCategories,
        };
    }

    async getDiagnosesByCategory(query: GetDiagnosesByCategoryQuery) {
        const { categoryId, search, activeOnly = true, page = 1, limit = 50 } = query;

        const where: Prisma.diagnosisWhereInput = {
            diagnosis_catogory_id: categoryId,
        };

        if (activeOnly) {
            where.active_status = 1;
        }

        if (search) {
            where.OR = [
                { diagnosis_name: { contains: search, mode: "insensitive" } },
                { icd_code: { contains: search, mode: "insensitive" } },
                { diagnosis_alias: { contains: search, mode: "insensitive" } },
            ];
        }

        const [diagnoses, total] = await Promise.all([
            prisma.diagnosis.findMany({
                where,
                select: {
                    diagnosis_id: true,
                    diagnosis_name: true,
                    icd_code: true,
                    diagnosis_description: true,
                },
                orderBy: { diagnosis_name: "asc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.diagnosis.count({ where }),
        ]);

        const formattedDiagnoses: DiagnosisItem[] = diagnoses.map((d) => ({
            diagnosis_id: d.diagnosis_id,
            diagnosis_name: d.diagnosis_name,
            icd_code: d.icd_code,
            diagnosis_description: d.diagnosis_description,
        }));

        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            diagnoses: formattedDiagnoses,
        };
    }

    async getDiagnosisById(diagnosisId: string) {
        return prisma.diagnosis.findUnique({
            where: { diagnosis_id: diagnosisId },
            select: {
                diagnosis_id: true,
                diagnosis_name: true,
                icd_code: true,
                icd_version: true,
                diagnosis_category: true,
                diagnosis_catogory_id: true,
                diagnosis_description: true,
                diagnosis_alias: true,
                disease_group: true,
                body_system: true,
                body_site: true,
                severity_level: true,
                is_chronic: true,
                is_contagious: true,
                is_notifiable: true,
                standard_treatment: true,
                treatment_guidelines: true,
                followup_required: true,
                followup_days: true,
                active_status: true,
                created_by: true,
                created_at: true,
            },
        });
    }
}