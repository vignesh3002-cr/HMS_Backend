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

    async findAll() {

        return prisma.lab_order_item.findMany({

            include: {
                lab_order: {
                    include: {
                        patient_history: true
                    }
                },
                lab_test_master: true,
                sample_collection: true
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
                lab_test_master: true,
                sample_collection: true
            }

        });

    }

    async generateBarcodes(items: { lab_order_item_id: string; barcode: string; sample_type?: string }[]) {
        const results = [];
        for (const item of items) {
            const existing = await prisma.sample_collection.findFirst({
                where: { lab_order_item_id: item.lab_order_item_id }
            });

            let sc;
            if (existing) {
                sc = await prisma.sample_collection.update({
                    where: { sample_collection_id: existing.sample_collection_id },
                    data: {
                        barcode: item.barcode,
                        container_type: item.sample_type,
                        collection_status: "Collected",
                        remarks: `Barcode: ${item.barcode}`
                    }
                });
            } else {
                sc = await prisma.sample_collection.create({
                    data: {
                        sample_collection_id: `SC${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                        lab_order_item_id: item.lab_order_item_id,
                        barcode: item.barcode,
                        container_type: item.sample_type,
                        collection_status: "Collected",
                        remarks: `Barcode: ${item.barcode}`
                    }
                });
            }

            const updatedItem = await prisma.lab_order_item.update({
                where: { lab_order_item_id: item.lab_order_item_id },
                data: {
                    item_status: "Barcode Generated",
                    remarks: `Barcode: ${item.barcode}`
                }
            });

            // Also update parent lab_order if needed
            if (updatedItem.lab_order_id) {
                await prisma.lab_order.update({
                    where: { lab_order_id: updatedItem.lab_order_id },
                    data: { order_status: "Processing" }
                }).catch(() => {});
            }

            results.push({ sample_collection: sc, lab_order_item: updatedItem });
        }
        return results;
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