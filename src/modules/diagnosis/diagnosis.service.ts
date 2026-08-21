import { DiagnosisRepository } from "./diagnosis.repository";
import {
    GetDiagnosisCategoriesQuery,
    GetDiagnosesByCategoryQuery,
} from "./diagnosis.types";

const repository = new DiagnosisRepository();

export class DiagnosisService {
    async getDiagnosisCategories(query: GetDiagnosisCategoriesQuery) {
        return repository.getDiagnosisCategories(query);
    }

    async getDiagnosesByCategory(query: GetDiagnosesByCategoryQuery) {
        return repository.getDiagnosesByCategory(query);
    }

    async getDiagnosisById(diagnosisId: string) {
        const diagnosis = await repository.getDiagnosisById(diagnosisId);
        if (!diagnosis) {
            throw new Error("Diagnosis not found");
        }
        return diagnosis;
    }
}