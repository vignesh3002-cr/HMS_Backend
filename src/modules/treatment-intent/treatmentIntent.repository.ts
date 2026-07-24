import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { GetTreatmentIntentsQuery } from "./treatmentIntent.types";

export class TreatmentIntentRepository {

    async findByCode(code: string) {

        return prisma.treatment_intent_master.findFirst({
            where: {
                intent_code: code
            }
        });

    }

    async findById(treatmentIntentId: string) {

        return prisma.treatment_intent_master.findUnique({
            where: {
                treatment_intent_id: treatmentIntentId
            }
        });

    }

    async create(tx: Prisma.TransactionClient, data: Prisma.treatment_intent_masterCreateInput) {

        return tx.treatment_intent_master.create({
            data
        });

    }

    async list(query: GetTreatmentIntentsQuery) {

        const {
            search,
            isActive,
            page = 1,
            limit = 10,
            sortBy = "created_at",
            sortOrder = "desc"
        } = query;

        const where: Prisma.treatment_intent_masterWhereInput = {};

        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }

        if (search) {

            where.OR = [

                { intent_name: { contains: search, mode: "insensitive" } },

                { intent_code: { contains: search, mode: "insensitive" } }

            ];

        }

        const [records, total] = await Promise.all([

            prisma.treatment_intent_master.findMany({

                where,

                skip: (page - 1) * limit,

                take: limit,

                orderBy: { [sortBy]: sortOrder }

            }),

            prisma.treatment_intent_master.count({ where })

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

    async update(treatmentIntentId: string, data: Prisma.treatment_intent_masterUpdateInput) {

        return prisma.treatment_intent_master.update({
            where: { treatment_intent_id: treatmentIntentId },
            data
        });

    }

}
