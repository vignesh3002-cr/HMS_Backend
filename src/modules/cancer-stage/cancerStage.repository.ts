import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { GetCancerStagesQuery } from "./cancerStage.types";

export class CancerStageRepository {

    async findByCode(code: string) {

        return prisma.cancer_stage_master.findFirst({
            where: {
                stage_code: code
            }
        });

    }

    async findById(cancerStageId: string) {

        return prisma.cancer_stage_master.findUnique({
            where: {
                cancer_stage_id: cancerStageId
            }
        });

    }

    async create(tx: Prisma.TransactionClient, data: Prisma.cancer_stage_masterCreateInput) {

        return tx.cancer_stage_master.create({
            data
        });

    }

    async list(query: GetCancerStagesQuery) {

        const {
            search,
            stageGroup,
            isActive,
            page = 1,
            limit = 10,
            sortBy = "created_at",
            sortOrder = "desc"
        } = query;

        const where: Prisma.cancer_stage_masterWhereInput = {};

        if (stageGroup) {
            where.stage_group = stageGroup;
        }

        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }

        if (search) {

            where.OR = [

                { stage_name: { contains: search, mode: "insensitive" } },

                { stage_code: { contains: search, mode: "insensitive" } }

            ];

        }

        const [records, total] = await Promise.all([

            prisma.cancer_stage_master.findMany({

                where,

                skip: (page - 1) * limit,

                take: limit,

                orderBy: { [sortBy]: sortOrder }

            }),

            prisma.cancer_stage_master.count({ where })

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

    async update(cancerStageId: string, data: Prisma.cancer_stage_masterUpdateInput) {

        return prisma.cancer_stage_master.update({
            where: { cancer_stage_id: cancerStageId },
            data
        });

    }

}
