import prisma from "../../config/prisma";
import {
    CreateLabOrderItemDto,
    UpdateLabOrderItemDto
} from "./lab-order-item.types";

export class LabOrderItemRepository {

    async create(data: CreateLabOrderItemDto & {
        lab_order_item_id: string;
        price: number;
        net_amount: number;
    }) {

        return prisma.lab_order_item.create({
            data
        });

    }

    async findAll(take = 500) {

        return prisma.lab_order_item.findMany({

            take,

            orderBy: { id: "desc" },

            include: {
                lab_order: {
                    include: {
                        patient_history: {
                            select: {
                                patient_history_id: true,
                                patient_id: true,
                                appointment_id: true,
                                visit_date: true,
                            }
                        }
                    }
                },
                lab_test_master: true
            }

        });

    }

    async findById(lab_order_item_id: string) {

        return prisma.lab_order_item.findUnique({

            where: {
                lab_order_item_id
            },

            include: {
                lab_order: {
                    include: {
                        patient_history: true
                    }
                },
                lab_test_master: true
            }

        });

    }

    async update(

        lab_order_item_id: string,
        data: UpdateLabOrderItemDto

    ) {

        return prisma.lab_order_item.update({

            where: {
                lab_order_item_id
            },

            data

        });

    }

    async delete(lab_order_item_id: string) {

        return prisma.lab_order_item.delete({

            where: {
                lab_order_item_id
            }

        });

    }

}