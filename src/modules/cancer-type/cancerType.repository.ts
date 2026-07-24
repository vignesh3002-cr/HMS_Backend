import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { UpdateCancerTypeDto } from "./cancerType.types";
import { GetCancerTypesQuery } from "./cancerType.types";

export class CancerTypeRepository {

    async findByCode(code: string) {

        return prisma.cancer_type_master.findFirst({
            where: {
                cancer_type_code: code
            }
        });

    }
    async findByName(name: string) {

    return prisma.cancer_type_master.findFirst({
        where: {
            cancer_type_name: {
                equals: name,
                mode: "insensitive"
            }
        }
    });

}

    async findById(cancerTypeId: string) {

        return prisma.cancer_type_master.findUnique({
            where: {
                cancer_type_id: cancerTypeId
            }
        });

    }

    async create(tx: Prisma.TransactionClient, data: Prisma.cancer_type_masterCreateInput) {

        return tx.cancer_type_master.create({
            data
        });

    }

    async list(query: GetCancerTypesQuery) {

        const {
            search,
            category,
            isActive,
            page = 1,
            limit = 10,
            sortBy = "created_at",
            sortOrder = "desc"
        } = query;

        const where: Prisma.cancer_type_masterWhereInput = {};

        if (category) {
            where.cancer_category = category;
        }

        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }

        if (search) {

            where.OR = [

                {
                    cancer_type_name: {
                        contains: search,
                        mode: "insensitive"
                    }
                },

                {
                    cancer_type_code: {
                        contains: search,
                        mode: "insensitive"
                    }
                },

                {
                    icd_o3_code: {
                        contains: search,
                        mode: "insensitive"
                    }
                }

            ];

        }

        const [records, total] = await Promise.all([

            prisma.cancer_type_master.findMany({

                where,

                skip: (page - 1) * limit,

                take: limit,

                orderBy: {
                    [sortBy]: sortOrder
                }

            }),

            prisma.cancer_type_master.count({ where })

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

    async update(cancerTypeId: string, data: UpdateCancerTypeDto) {
    return prisma.cancer_type_master.update({
        where: {
            cancer_type_id: cancerTypeId
        },
        data: {
            cancer_type_name: data.cancer_type_name,
            cancer_category: data.cancer_category,
            icd_o3_code: data.icd_o3_code,
            description: data.description,
            is_active: data.is_active,
            updated_at: new Date()
        }
    });
}

}
