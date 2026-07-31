import prisma from "../../config/prisma";

import {
    CreateLabTestCategoryDto,
    UpdateLabTestCategoryDto
} from "./lab-test-category.types";

export class LabTestCategoryRepository {

    async create(data: CreateLabTestCategoryDto & {
        lab_test_category_id: string;
        branch_id?: string;
        user_id?: string;
    }) {

        return prisma.lab_test_category.create({
            data
        });

    }

    async findById(lab_test_category_id: string) {

        return prisma.lab_test_category.findUnique({

            where: {
                lab_test_category_id
            }

        });

    }

    async findByCode(category_code: string) {

        return prisma.lab_test_category.findUnique({

            where: {
                category_code
            }

        });

    }

    async findByName(category_name: string) {

        return prisma.lab_test_category.findUnique({

            where: {
                category_name
            }

        });

    }

    async findAll() {

        return prisma.lab_test_category.findMany({

            orderBy: {
                created_at: "desc"
            }

        });

    }

    async update(

        lab_test_category_id: string,
        data: UpdateLabTestCategoryDto

    ) {

        return prisma.lab_test_category.update({

            where: {
                lab_test_category_id
            },

            data

        });

    }

    async delete(lab_test_category_id: string) {

        return prisma.lab_test_category.delete({

            where: {
                lab_test_category_id
            }

        });

    }

}

export default new LabTestCategoryRepository();