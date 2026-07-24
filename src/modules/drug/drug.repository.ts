import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { GetDrugsQuery } from "./drug.types";

export class DrugRepository {

    async findByCode(code: string) {

        return prisma.drug_master.findFirst({
            where: {
                drug_code: code
            }
        });

    }

    async findById(drugId: string) {

        return prisma.drug_master.findUnique({

            where: {
                drug_id: drugId
            },

            include: {
                medicine_master: {
                    select: {
                        medicine_id: true,
                        medicine_name: true,
                        mrp: true,
                        is_active: true
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

    async create(tx: Prisma.TransactionClient, data: Prisma.drug_masterCreateInput) {

        return tx.drug_master.create({
            data
        });

    }

    async list(query: GetDrugsQuery) {

        const {
            search,
            drugClass,
            vesicantStatus,
            isActive,
            page = 1,
            limit = 10,
            sortBy = "created_at",
            sortOrder = "desc"
        } = query;

        const where: Prisma.drug_masterWhereInput = {
            is_active: true
       };

        if (drugClass) {
            where.drug_class = drugClass;
        }

        if (vesicantStatus) {
            where.vesicant_status = vesicantStatus;
        }

        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }

        if (search) {

            where.OR = [

                { drug_name: { contains: search, mode: "insensitive" } },

                { drug_code: { contains: search, mode: "insensitive" } },

                { generic_name: { contains: search, mode: "insensitive" } },

                { brand_name: { contains: search, mode: "insensitive" } }

            ];

        }

        const [records, total] = await Promise.all([

            prisma.drug_master.findMany({

                where,

                skip: (page - 1) * limit,

                take: limit,

                orderBy: { [sortBy]: sortOrder }

            }),

            prisma.drug_master.count({ where })

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

    async update(drugId: string, data: Prisma.drug_masterUpdateInput) {

        return prisma.drug_master.update({
            where: { drug_id: drugId },
            data
        });

    }

}
