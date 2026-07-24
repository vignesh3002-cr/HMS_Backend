import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { GetTnmStagesQuery } from "./tnmStage.types";

export class TnmStageRepository {

    async findById(tnmStageId: string) {

        return prisma.tnm_stage_master.findUnique({

            where: {
                tnm_stage_id: tnmStageId
            },
        });

    }

    async findByCombinedCode(cancerTypeId: string | undefined, combinedCode: string) {

        return prisma.tnm_stage_master.findFirst({
            where: {
                cancer_type_id: cancerTypeId,
                tnm_combined_code: combinedCode
            }
        });

    }

    async findCancerType(cancerTypeId: string) {

        return prisma.cancer_type_master.findUnique({
            where: {
                cancer_type_id: cancerTypeId
            }
        });

    }

    async create(tx: Prisma.TransactionClient, data: Prisma.tnm_stage_masterCreateInput) {

        return tx.tnm_stage_master.create({
            data
        });

    }

    async list(query: GetTnmStagesQuery) {

        const {
            search,
            cancerTypeId,
            overallStageGroup,
            isActive,
            page = 1,
            limit = 10,
            sortBy = "created_at",
            sortOrder = "desc"
        } = query;

        const where: Prisma.tnm_stage_masterWhereInput = {};

        if (cancerTypeId) {
            where.cancer_type_id = cancerTypeId;
        }

        if (overallStageGroup) {
            where.overall_stage_group = overallStageGroup;
        }

        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }

        if (search) {

            where.OR = [

                { tnm_combined_code: { contains: search, mode: "insensitive" } },

                { overall_stage_group: { contains: search, mode: "insensitive" } }

            ];

        }

        const [records, total] = await Promise.all([

            prisma.tnm_stage_master.findMany({

                where,

                

                skip: (page - 1) * limit,

                take: limit,

                orderBy: { [sortBy]: sortOrder }

            }),

            prisma.tnm_stage_master.count({ where })

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

    async update(tnmStageId: string, data: Prisma.tnm_stage_masterUpdateInput) {

        return prisma.tnm_stage_master.update({
            where: { tnm_stage_id: tnmStageId },
            data
        });

    }

}
