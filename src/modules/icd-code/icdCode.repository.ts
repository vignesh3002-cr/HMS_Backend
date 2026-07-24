import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { GetIcdCodesQuery } from "./icdCode.types";

export class IcdCodeRepository {

    async findByCode(code: string) {

        return prisma.icd_code_master.findFirst({
            where: {
                icd_code: code
            }
        });

    }

    async findById(icdCodeId: string) {

        return prisma.icd_code_master.findUnique({
            where: {
                icd_code_id: icdCodeId
            }
        });

    }

    async create(tx: Prisma.TransactionClient, data: Prisma.icd_code_masterCreateInput) {

        return tx.icd_code_master.create({
            data
        });

    }

    async list(query: GetIcdCodesQuery) {

        const {
            search,
            icdVersion,
            category,
            isActive,
            page = 1,
            limit = 10,
            sortBy = "created_at",
            sortOrder = "desc"
        } = query;

        const where: Prisma.icd_code_masterWhereInput = {};

        if (icdVersion) {
            where.icd_version = icdVersion;
        }

        if (category) {
            where.icd_category = category;
        }

        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }

        if (search) {

            where.OR = [

                { icd_code: { contains: search, mode: "insensitive" } },

                { icd_description: { contains: search, mode: "insensitive" } }

            ];

        }

        const [records, total] = await Promise.all([

            prisma.icd_code_master.findMany({

                where,

                skip: (page - 1) * limit,

                take: limit,

                orderBy: { [sortBy]: sortOrder }

            }),

            prisma.icd_code_master.count({ where })

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

    async update(icdCodeId: string, data: Prisma.icd_code_masterUpdateInput) {

        return prisma.icd_code_master.update({
            where: { icd_code_id: icdCodeId },
            data
        });

    }

}
