import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { TnmStageRepository } from "./tnmStage.repository";
import {
    CreateTnmStageDto,
    UpdateTnmStageDto,
    GetTnmStagesQuery
} from "./tnmStage.types";

const repository = new TnmStageRepository();

export class TnmStageService {

    async createTnmStage(data: CreateTnmStageDto, createdBy: string) {

        if (data.cancer_type_id) {

            const cancerType = await repository.findCancerType(data.cancer_type_id);

            if (!cancerType) {
                throw new Error("Cancer type not found");
            }

        }

        const existing = await repository.findByCombinedCode(
            data.cancer_type_id,
            data.tnm_combined_code || ""
        );

        if (existing) {
            throw new Error(
                "This TNM combination already exists for the selected cancer type"
            );
        }

        return prisma.$transaction(async (tx) => {

            const tnmStageId = await generateId(tx, "TNM_STAGE");

            return repository.create(tx, {

                tnm_stage_id: tnmStageId,

                cancer_type_id: data.cancer_type_id,
                    
                             

                t_category: data.t_category,

                n_category: data.n_category,

                m_category: data.m_category,

                tnm_combined_code: data.tnm_combined_code,

                staging_edition: data.staging_edition,

                overall_stage_group: data.overall_stage_group,

                description: data.description,

                created_by: createdBy

            });

        });

    }

    async getTnmStages(query: GetTnmStagesQuery) {

        return repository.list(query);

    }

    async getTnmStageById(tnmStageId: string) {

        const stage = await repository.findById(tnmStageId);

        if (!stage) {
            throw new Error("TNM stage not found");
        }

        return stage;

    }

    async updateTnmStage(
        tnmStageId: string,
        data: UpdateTnmStageDto,
        updatedBy: string
    ) {

        const existing = await repository.findById(tnmStageId);

        if (!existing) {
            throw new Error("TNM stage not found");
        }

        if (data.cancer_type_id) {

            const cancerType = await repository.findCancerType(data.cancer_type_id);

            if (!cancerType) {
                throw new Error("Cancer type not found");
            }

        }

        return repository.update(tnmStageId, {

            cancer_type_id: data.cancer_type_id,
                

            t_category: data.t_category,

            n_category: data.n_category,

            m_category: data.m_category,

            tnm_combined_code: data.tnm_combined_code,

            staging_edition: data.staging_edition,

            overall_stage_group: data.overall_stage_group,

            description: data.description,

            is_active: data.is_active,

            updated_by: updatedBy

        });

    }

    async deleteTnmStage(tnmStageId: string, updatedBy: string) {

        const existing = await repository.findById(tnmStageId);

        if (!existing) {
            throw new Error("TNM stage not found");
        }

        return repository.update(tnmStageId, {
            is_active: false,
            updated_by: updatedBy
        });

    }

    async restoreTnmStage(tnmStageId: string, updatedBy: string) {

        const existing = await repository.findById(tnmStageId);

        if (!existing) {
            throw new Error("TNM stage not found");
        }

        return repository.update(tnmStageId, {
            is_active: true,
            updated_by: updatedBy
        });

    }

}
