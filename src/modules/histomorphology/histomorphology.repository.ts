import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { GetHistomorphologiesQuery } from "./histomorphology.types";

export class HistomorphologyRepository {

    async findByCode(code: string) {

        return prisma.histomorphology_master.findFirst({
            where: {
                morphology_code: code
            }
        });

    }

    async findById(histomorphologyId: string) {

        return prisma.histomorphology_master.findUnique({
            where: {
                histomorphology_id: histomorphologyId
            }
        });

    }

    async create(tx: Prisma.TransactionClient, data: Prisma.histomorphology_masterCreateInput) {

        return tx.histomorphology_master.create({
            data
        });

    }

    async list(query: GetHistomorphologiesQuery) {

        const {
            search,
            behavior,
            isActive,
            page = 1,
            limit = 10,
            sortBy = "created_at",
            sortOrder = "desc"
        } = query;

        const where: Prisma.histomorphology_masterWhereInput = {};

        if (behavior) {
            where.behavior = behavior;
        }

        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }

        if (search) {

            where.OR = [

                { morphology_name: { contains: search, mode: "insensitive" } },

                { morphology_code: { contains: search, mode: "insensitive" } }

            ];

        }

        const [records, total] = await Promise.all([

            prisma.histomorphology_master.findMany({

                where,

                skip: (page - 1) * limit,

                take: limit,

                orderBy: { [sortBy]: sortOrder }

            }),

            prisma.histomorphology_master.count({ where })

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

    async update(histomorphologyId: string, data: Prisma.histomorphology_masterUpdateInput) {

        return prisma.histomorphology_master.update({
            where: { histomorphology_id: histomorphologyId },
            data
        });

    }

}
