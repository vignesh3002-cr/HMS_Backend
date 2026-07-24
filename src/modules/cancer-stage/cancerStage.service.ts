import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { CancerStageRepository } from "./cancerStage.repository";
import {
    CreateCancerStageDto,
    UpdateCancerStageDto,
    GetCancerStagesQuery
} from "./cancerStage.types";

const repository = new CancerStageRepository();

export class CancerStageService {

    async createCancerStage(data: CreateCancerStageDto, createdBy: string) {

        const existing = await repository.findByCode(data.stage_code);

        if (existing) {
            throw new Error("Stage code already exists");
        }

        return prisma.$transaction(async (tx) => {

            const cancerStageId = await generateId(tx, "CANCER_STAGE");

            return repository.create(tx, {

                cancer_stage_id: cancerStageId,

                stage_code: data.stage_code,

                stage_name: data.stage_name,

                stage_group: data.stage_group,

                description: data.description,

                created_by: createdBy

            });

        });

    }

    async getCancerStages(query: GetCancerStagesQuery) {

        return repository.list(query);

    }

    async getCancerStageById(cancerStageId: string) {

        const stage = await repository.findById(cancerStageId);

        if (!stage) {
            throw new Error("Cancer stage not found");
        }

        return stage;

    }

    async updateCancerStage(
        cancerStageId: string,
        data: UpdateCancerStageDto,
        updatedBy: string
    ) {

        const existing = await repository.findById(cancerStageId);

        if (!existing) {
            throw new Error("Cancer stage not found");
        }

        if (data.stage_code && data.stage_code !== existing.stage_code) {

            const codeTaken = await repository.findByCode(data.stage_code);

            if (codeTaken) {
                throw new Error("Stage code already exists");
            }

        }

        return repository.update(cancerStageId, {

            stage_code: data.stage_code,

            stage_name: data.stage_name,

            stage_group: data.stage_group,

            description: data.description,

            is_active: data.is_active,

            updated_by: updatedBy

        });

    }

    async deleteCancerStage(cancerStageId: string, updatedBy: string) {

        const existing = await repository.findById(cancerStageId);

        if (!existing) {
            throw new Error("Cancer stage not found");
        }

        return repository.update(cancerStageId, {
            is_active: false,
            updated_by: updatedBy
        });

    }

    async restoreCancerStage(cancerStageId: string, updatedBy: string) {

        const existing = await repository.findById(cancerStageId);

        if (!existing) {
            throw new Error("Cancer stage not found");
        }

        return repository.update(cancerStageId, {
            is_active: true,
            updated_by: updatedBy
        });

    }

}
