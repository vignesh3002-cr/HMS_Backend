import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { GetHydrationsQuery } from "./hydration.types";

export class HydrationRepository {

    async findByCode(code: string) {

        return prisma.hydration_master.findFirst({
            where: {
                hydration_code: code
            }
        });

    }

    async findById(hydrationId: string) {

        return prisma.hydration_master.findUnique({

            where: {
                hydration_id: hydrationId
            },

            include: {
                medicine_master: {
                    select: {
                        medicine_id: true,
                        medicine_name: true
                    }
                }
            }

        });

    }

    async findLinkedMedicine(medicineId: string) {

        return prisma.medicine_master.findUnique({
            where: {
                medicine_id: medicineId
            }
        });

    }

    async create(tx: Prisma.TransactionClient, data: Prisma.hydration_masterCreateInput) {

        return tx.hydration_master.create({
            data
        });

    }

    async list(query: GetHydrationsQuery) {

        const {
            search,
            timing,
            isActive,
            page = 1,
            limit = 10,
            sortBy = "created_at",
            sortOrder = "desc"
        } = query;

        const where: Prisma.hydration_masterWhereInput = {};

        if (timing) {
            where.timing = timing;
        }

        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }

        if (search) {

            where.OR = [

                { fluid_name: { contains: search, mode: "insensitive" } },

                { hydration_code: { contains: search, mode: "insensitive" } }

            ];

        }

        const [records, total] = await Promise.all([

            prisma.hydration_master.findMany({

                where,

                skip: (page - 1) * limit,

                take: limit,

                orderBy: { [sortBy]: sortOrder }

            }),

            prisma.hydration_master.count({ where })

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

    async update(hydrationId: string, data: Prisma.hydration_masterUpdateInput) {

        return prisma.hydration_master.update({
            where: { hydration_id: hydrationId },
            data
        });

    }

}
