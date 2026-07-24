import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { GetProtocolsQuery } from "./chemoProtocol.types";

export class ChemoProtocolRepository {

    async findByCode(code: string) {

        return prisma.chemo_protocol_master.findFirst({
            where: {
                protocol_code: code
            }
        });

    }

    async findById(protocolId: string) {

        return prisma.chemo_protocol_master.findUnique({

            where: {
                protocol_id: protocolId
            },

            include: {

                cancer_type_master: {
                    select: { cancer_type_id: true, cancer_type_name: true }
                },

                cancer_stage_master: {
                    select: { cancer_stage_id: true, stage_name: true }
                },

                treatment_intent_master: {
                    select: { treatment_intent_id: true, intent_name: true }
                },

                chemo_protocol_drug: {

                    where: { is_active: true },

                    orderBy: { sequence_order: "asc" },

                    include: {
                        drug_master: {
                            select: {
                                drug_id: true,
                                drug_name: true,
                                drug_class: true,
                                vesicant_status: true,
                                standard_unit: true
                            }
                        }
                    }

                }

            }

        });

    }

    async findCancerType(cancerTypeId: string) {

        return prisma.cancer_type_master.findUnique({
            where: { cancer_type_id: cancerTypeId }
        });

    }

    async findCancerStage(cancerStageId: string) {

        return prisma.cancer_stage_master.findUnique({
            where: { cancer_stage_id: cancerStageId }
        });

    }

    async findTreatmentIntent(treatmentIntentId: string) {

        return prisma.treatment_intent_master.findUnique({
            where: { treatment_intent_id: treatmentIntentId }
        });

    }

    async findDrug(drugId: string) {

        return prisma.drug_master.findUnique({
            where: { drug_id: drugId }
        });

    }

    async create(tx: Prisma.TransactionClient, data: Prisma.chemo_protocol_masterCreateInput) {

        return tx.chemo_protocol_master.create({ data });

    }

    async list(query: GetProtocolsQuery) {

        const {
            search,
            cancerTypeId,
            cancerStageId,
            treatmentIntentId,
            isActive,
            page = 1,
            limit = 10,
            sortBy = "created_at",
            sortOrder = "desc"
        } = query;

        const where: Prisma.chemo_protocol_masterWhereInput = {};

        if (cancerTypeId) {
            where.cancer_type_id = cancerTypeId;
        }

        if (cancerStageId) {
            where.cancer_stage_id = cancerStageId;
        }

        if (treatmentIntentId) {
            where.treatment_intent_id = treatmentIntentId;
        }

        if (isActive !== undefined) {
            where.is_active = isActive === "true";
        }

        if (search) {

            where.OR = [

                { protocol_name: { contains: search, mode: "insensitive" } },

                { protocol_code: { contains: search, mode: "insensitive" } }

            ];

        }

        const [records, total] = await Promise.all([

            prisma.chemo_protocol_master.findMany({

                where,

                include: {

                    cancer_type_master: {
                        select: { cancer_type_id: true, cancer_type_name: true }
                    },

                    treatment_intent_master: {
                        select: { treatment_intent_id: true, intent_name: true }
                    },

                    _count: {
                        select: { chemo_protocol_drug: true }
                    }

                },

                skip: (page - 1) * limit,

                take: limit,

                orderBy: { [sortBy]: sortOrder }

            }),

            prisma.chemo_protocol_master.count({ where })

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

    async update(protocolId: string, data: Prisma.chemo_protocol_masterUpdateInput) {

        return prisma.chemo_protocol_master.update({
            where: { protocol_id: protocolId },
            data
        });

    }

    // ---- Bridge: chemo_protocol_drug ----

    async createProtocolDrug(
        tx: Prisma.TransactionClient,
        data: Prisma.chemo_protocol_drugCreateInput
    ) {

        return tx.chemo_protocol_drug.create({ data });

    }

    async findProtocolDrugById(protocolDrugId: string) {

        return prisma.chemo_protocol_drug.findUnique({
            where: { protocol_drug_id: protocolDrugId },
            include: {
                drug_master: {
                    select: {
                        drug_id: true,
                        drug_name: true,
                        drug_class: true,
                        vesicant_status: true,
                        standard_unit: true
                    }
                }
            }
        });

    }

    async findProtocolDrugByPair(protocolId: string, drugId: string) {

        return prisma.chemo_protocol_drug.findFirst({
            where: {
                protocol_id: protocolId,
                drug_id: drugId,
                is_active: true
            }
        });

    }

    async updateProtocolDrug(
        protocolDrugId: string,
        data: Prisma.chemo_protocol_drugUpdateInput
    ) {

        return prisma.chemo_protocol_drug.update({
            where: { protocol_drug_id: protocolDrugId },
            data
        });

    }

}
