import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { GetPremedicationsQuery } from "./premedication.types";

export class PremedicationRepository {

    async findByCode(code: string) {

        return prisma.premedication_master.findFirst({
            where: {
                premed_code: code
            }
        });

    }

    async findById(premedicationId: string) {

        return prisma.premedication_master.findUnique({

            where: {
                premedication_id: premedicationId
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

    async create(tx: Prisma.TransactionClient, data: Prisma.premedication_masterCreateInput) {

        return tx.premedication_master.create({
            data
        });

    }

    async list(query: GetPremedicationsQuery) {

        const {
            search,
            category,
            isActive,
            page = 1,
            limit = 10,
            sortBy = "created_at",
            sortOrder = "desc"
        } = query;

        const where: Prisma.premedication_masterWhereInput = {};

        if (category) {
            where.premed_category = category;
        }

        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }

        if (search) {

            where.OR = [

                { premed_name: { contains: search, mode: "insensitive" } },

                { premed_code: { contains: search, mode: "insensitive" } }

            ];

        }

        const [records, total] = await Promise.all([

            prisma.premedication_master.findMany({

                where,

                skip: (page - 1) * limit,

                take: limit,

                orderBy: { [sortBy]: sortOrder }

            }),

            prisma.premedication_master.count({ where })

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

    async update(premedicationId: string, data: Prisma.premedication_masterUpdateInput) {

        return prisma.premedication_master.update({
            where: { premedication_id: premedicationId },
            data
        });

    }

}
