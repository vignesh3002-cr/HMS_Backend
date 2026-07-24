import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { GetHistologicalGradesQuery } from "./histologicalGrade.types";

export class HistologicalGradeRepository {

    async findByCode(code: string) {

        return prisma.histological_grade_master.findFirst({
            where: {
                grade_code: code
            }
        });

    }

    async findById(histologicalGradeId: string) {

        return prisma.histological_grade_master.findUnique({
            where: {
                histological_grade_id: histologicalGradeId
            }
        });

    }

    async create(tx: Prisma.TransactionClient, data: Prisma.histological_grade_masterCreateInput) {

        return tx.histological_grade_master.create({
            data
        });

    }

    async list(query: GetHistologicalGradesQuery) {

        const {
            search,
            isActive,
            page = 1,
            limit = 10,
            sortBy = "created_at",
            sortOrder = "desc"
        } = query;

        const where: Prisma.histological_grade_masterWhereInput = {};

        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }

        if (search) {

            where.OR = [

                { grade_name: { contains: search, mode: "insensitive" } },

                { grade_code: { contains: search, mode: "insensitive" } }

            ];

        }

        const [records, total] = await Promise.all([

            prisma.histological_grade_master.findMany({

                where,

                skip: (page - 1) * limit,

                take: limit,

                orderBy: { [sortBy]: sortOrder }

            }),

            prisma.histological_grade_master.count({ where })

        ]);

        return {
            records,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };

    }

    async update(histologicalGradeId: string, data: Prisma.histological_grade_masterUpdateInput) {

        return prisma.histological_grade_master.update({
            where: { histological_grade_id: histologicalGradeId },
            data
        });

    }

}
