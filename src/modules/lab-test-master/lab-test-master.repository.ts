import prisma from "../../config/prisma";

import {
    CreateLabTestMasterDto,
    UpdateLabTestMasterDto
} from "./lab-test-master.types";

class LabTestMasterRepository {

    async create(
        data: CreateLabTestMasterDto & {
            lab_test_id: string;
            branch_id?: string;
            user_id?: string;
        }
    ) {

        return prisma.lab_test_master.create({
            data
        });

    }

    async findById(lab_test_id: string) {
        return prisma.lab_test_master.findUnique({
            where: {
                lab_test_id
            },
            include: {
                lab_test_category: true,
                lab_test_parameter: {
                    orderBy: { sort_order: "asc" }
                }
            }
        });

    }

    async findByCode(test_code: string) {

        return prisma.lab_test_master.findUnique({

            where: {
                test_code
            }

        });

    }

    async findByName(test_name: string) {

        return prisma.lab_test_master.findFirst({

            where: {
                test_name
            }

        });

    }

    async findCategory(lab_test_category_id: string) {

        return prisma.lab_test_category.findUnique({

            where: {
                lab_test_category_id
            }

        });

    }

        async findAllParameters() {
        return prisma.lab_test_parameter.findMany({
            include: {
                lab_test_master: {
                    select: {
                        test_name: true,
                        test_code: true,
                        unit: true,
                        reference_range: true,
                        sample_type: true
                    }
                }
            },
            orderBy: [
                { lab_test_id: "asc" },
                { sort_order: "asc" }
            ]
        });
    }

    async findAll() {

        return prisma.lab_test_master.findMany({

            include: {
                lab_test_category: true,
                lab_test_parameter: {
                    orderBy: { sort_order: "asc" }
                }
            },

            orderBy: {
                created_at: "desc"
            }

        });

    }

    async update(
        lab_test_id: string,
        data: UpdateLabTestMasterDto
    ) {

        return prisma.lab_test_master.update({

            where: {
                lab_test_id
            },

            data

        });

    }

    async delete(lab_test_id: string) {

        return prisma.lab_test_master.delete({

            where: {
                lab_test_id
            }

        });

    }

}

export default new LabTestMasterRepository();