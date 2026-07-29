"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChemoProtocolRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class ChemoProtocolRepository {
    async findByCode(code) {
        return prisma_1.default.chemo_protocol_master.findFirst({
            where: {
                protocol_code: code
            }
        });
    }
    async findById(protocolId) {
        return prisma_1.default.chemo_protocol_master.findUnique({
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
    async findCancerType(cancerTypeId) {
        return prisma_1.default.cancer_type_master.findUnique({
            where: { cancer_type_id: cancerTypeId }
        });
    }
    async findCancerStage(cancerStageId) {
        return prisma_1.default.cancer_stage_master.findUnique({
            where: { cancer_stage_id: cancerStageId }
        });
    }
    async findTreatmentIntent(treatmentIntentId) {
        return prisma_1.default.treatment_intent_master.findUnique({
            where: { treatment_intent_id: treatmentIntentId }
        });
    }
    async findDrug(drugId) {
        return prisma_1.default.drug_master.findUnique({
            where: { drug_id: drugId }
        });
    }
    async create(tx, data) {
        return tx.chemo_protocol_master.create({ data });
    }
    async list(query) {
        const { search, cancerTypeId, cancerStageId, treatmentIntentId, isActive, page = 1, limit = 10, sortBy = "created_at", sortOrder = "desc" } = query;
        const where = {};
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
            prisma_1.default.chemo_protocol_master.findMany({
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
            prisma_1.default.chemo_protocol_master.count({ where })
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
    async update(protocolId, data) {
        return prisma_1.default.chemo_protocol_master.update({
            where: { protocol_id: protocolId },
            data
        });
    }
    // ---- Bridge: chemo_protocol_drug ----
    async createProtocolDrug(tx, data) {
        return tx.chemo_protocol_drug.create({ data });
    }
    async findProtocolDrugById(protocolDrugId) {
        return prisma_1.default.chemo_protocol_drug.findUnique({
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
    async findProtocolDrugByPair(protocolId, drugId) {
        return prisma_1.default.chemo_protocol_drug.findFirst({
            where: {
                protocol_id: protocolId,
                drug_id: drugId,
                is_active: true
            }
        });
    }
    async updateProtocolDrug(protocolDrugId, data) {
        return prisma_1.default.chemo_protocol_drug.update({
            where: { protocol_drug_id: protocolDrugId },
            data
        });
    }
}
exports.ChemoProtocolRepository = ChemoProtocolRepository;
