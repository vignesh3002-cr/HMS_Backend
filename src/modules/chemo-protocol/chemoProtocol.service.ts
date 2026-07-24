import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { ChemoProtocolRepository } from "./chemoProtocol.repository";
import {
    CreateProtocolDto,
    UpdateProtocolDto,
    GetProtocolsQuery,
    AddProtocolDrugDto,
    UpdateProtocolDrugDto
} from "./chemoProtocol.types";

const repository = new ChemoProtocolRepository();

export class ChemoProtocolService {

    async createProtocol(data: CreateProtocolDto, createdBy: string) {

        const existing = await repository.findByCode(data.protocol_code);

        if (existing) {
            throw new Error("Protocol code already exists");
        }

        if (data.cancer_type_id) {

            const cancerType = await repository.findCancerType(data.cancer_type_id);

            if (!cancerType) {
                throw new Error("Cancer type not found");
            }

        }

        if (data.cancer_stage_id) {

            const cancerStage = await repository.findCancerStage(data.cancer_stage_id);

            if (!cancerStage) {
                throw new Error("Cancer stage not found");
            }

        }

        if (data.treatment_intent_id) {

            const intent = await repository.findTreatmentIntent(data.treatment_intent_id);

            if (!intent) {
                throw new Error("Treatment intent not found");
            }

        }

        return prisma.$transaction(async (tx) => {

            const protocolId = await generateId(tx, "CHEMO_PROTOCOL");

            return repository.create(tx, {

                protocol_id: protocolId,

                protocol_code: data.protocol_code,

                protocol_name: data.protocol_name,

                cancer_type_id: data.cancer_type_id,

                cancer_stage_id: data.cancer_stage_id,

                treatment_intent_id: data.treatment_intent_id,

                cycle_length_days: data.cycle_length_days,

                total_recommended_cycles: data.total_recommended_cycles,

                protocol_description: data.protocol_description,

                reference_guideline: data.reference_guideline,

                created_by: createdBy

            });

        });

    }

    async getProtocols(query: GetProtocolsQuery) {

        return repository.list(query);

    }

    async getProtocolById(protocolId: string) {

        const record = await repository.findById(protocolId);

        if (!record) {
            throw new Error("Chemotherapy protocol not found");
        }

        return record;

    }

    async updateProtocol(
        protocolId: string,
        data: UpdateProtocolDto,
        updatedBy: string
    ) {

        const existing = await repository.findById(protocolId);

        if (!existing) {
            throw new Error("Chemotherapy protocol not found");
        }

        if (data.protocol_code && data.protocol_code !== existing.protocol_code) {

            const codeTaken = await repository.findByCode(data.protocol_code);

            if (codeTaken) {
                throw new Error("Protocol code already exists");
            }

        }

        if (data.cancer_type_id) {

            const cancerType = await repository.findCancerType(data.cancer_type_id);

            if (!cancerType) {
                throw new Error("Cancer type not found");
            }

        }

        if (data.cancer_stage_id) {

            const cancerStage = await repository.findCancerStage(data.cancer_stage_id);

            if (!cancerStage) {
                throw new Error("Cancer stage not found");
            }

        }

        if (data.treatment_intent_id) {

            const intent = await repository.findTreatmentIntent(data.treatment_intent_id);

            if (!intent) {
                throw new Error("Treatment intent not found");
            }

        }

        return repository.update(protocolId, {

            protocol_code: data.protocol_code,

            protocol_name: data.protocol_name,

            cancer_type_master: data.cancer_type_id
                ? { connect: { cancer_type_id: data.cancer_type_id } }
                : undefined,

            cancer_stage_master: data.cancer_stage_id
                ? { connect: { cancer_stage_id: data.cancer_stage_id } }
                : undefined,

            treatment_intent_master: data.treatment_intent_id
                ? { connect: { treatment_intent_id: data.treatment_intent_id } }
                : undefined,

            cycle_length_days: data.cycle_length_days,

            total_recommended_cycles: data.total_recommended_cycles,

            protocol_description: data.protocol_description,

            reference_guideline: data.reference_guideline,

            is_active: data.is_active,

            updated_by: updatedBy

        });

    }

    async deleteProtocol(protocolId: string, updatedBy: string) {

        const existing = await repository.findById(protocolId);

        if (!existing) {
            throw new Error("Chemotherapy protocol not found");
        }

        return repository.update(protocolId, {
            is_active: false,
            updated_by: updatedBy
        });

    }

    async restoreProtocol(protocolId: string, updatedBy: string) {

        const existing = await repository.findById(protocolId);

        if (!existing) {
            throw new Error("Chemotherapy protocol not found");
        }

        return repository.update(protocolId, {
            is_active: true,
            updated_by: updatedBy
        });

    }

    // ---- Protocol <-> Drug bridge ----

    async addDrugToProtocol(
        protocolId: string,
        data: AddProtocolDrugDto,
        createdBy: string
    ) {

        const protocol = await repository.findById(protocolId);

        if (!protocol) {
            throw new Error("Chemotherapy protocol not found");
        }

        const drug = await repository.findDrug(data.drug_id);

        if (!drug) {
            throw new Error("Drug not found");
        }

        const existingPair = await repository.findProtocolDrugByPair(
            protocolId,
            data.drug_id
        );

        if (existingPair) {
            throw new Error("This drug is already part of the protocol");
        }

        return prisma.$transaction(async (tx) => {

            const protocolDrugId = await generateId(tx, "PROTOCOL_DRUG");

            return repository.createProtocolDrug(tx, {

                protocol_drug_id: protocolDrugId,

                chemo_protocol_master: {
                    connect: { protocol_id: protocolId }
                },

                drug_master: {
                    connect: { drug_id: data.drug_id }
                },

                administration_day: data.administration_day,

                dose: data.dose,

                sequence_order: data.sequence_order,

                infusion_duration: data.infusion_duration,

                created_by: createdBy

            });

        });

    }

    async updateProtocolDrug(
        protocolDrugId: string,
        data: UpdateProtocolDrugDto
    ) {

        const existing = await repository.findProtocolDrugById(protocolDrugId);

        if (!existing) {
            throw new Error("Protocol drug entry not found");
        }

        return repository.updateProtocolDrug(protocolDrugId, {

            administration_day: data.administration_day,

            dose: data.dose,

            sequence_order: data.sequence_order,

            infusion_duration: data.infusion_duration,

            is_active: data.is_active

        });

    }

    async removeDrugFromProtocol(protocolDrugId: string) {

        const existing = await repository.findProtocolDrugById(protocolDrugId);

        if (!existing) {
            throw new Error("Protocol drug entry not found");
        }

        return repository.updateProtocolDrug(protocolDrugId, {
            is_active: false
        });

    }

}
