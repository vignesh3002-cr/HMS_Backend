import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import {
    CreateSampleCollectionDto,
    UpdateSampleCollectionDto
} from "./sample-collection.types";

class SampleCollectionRepository {

    async create(data: CreateSampleCollectionDto) {
        const sample_collection_id = await generateId(prisma, "SAMPLE_COLLECTION");
        return prisma.sample_collection.create({
            data: { sample_collection_id, ...data }
        });
    }

    async findAll() {
        return prisma.sample_collection.findMany({
            include: {
                lab_order_item: true,
                employees: true
            },
            orderBy: {
                created_at: "desc"
            }
        });
    }

    async findById(sample_collection_id: string) {
        return prisma.sample_collection.findUnique({
            where: {
                sample_collection_id
            },
            include: {
                lab_order_item: true,
                employees: true
            }
        });
    }

    async findByLabOrderItemId(lab_order_item_id: string) {
        return prisma.sample_collection.findFirst({
            where: {
                lab_order_item_id
            }
        });
    }

    async findLabOrderItem(lab_order_item_id: string) {
        return prisma.lab_order_item.findUnique({
            where: {
                lab_order_item_id
            }
        });
    }

    async findEmployee(employee_id: string) {
        return prisma.employees.findUnique({
            where: {
                employee_id
            }
        });
    }

    async update(
        sample_collection_id: string,
        data: UpdateSampleCollectionDto
    ) {
        return prisma.sample_collection.update({
            where: {
                sample_collection_id
            },
            data
        });
    }

    async delete(sample_collection_id: string) {
        return prisma.sample_collection.delete({
            where: {
                sample_collection_id
            }
        });
    }
    async updateLabOrderItemStatus(
    lab_order_item_id: string,
    item_status: string
) {
    return prisma.lab_order_item.update({
        where: {
            lab_order_item_id
        },
        data: {
            item_status
        }
    });
}
}

export default new SampleCollectionRepository();