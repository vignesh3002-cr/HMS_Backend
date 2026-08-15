"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosisService = void 0;
const diagnosis_repository_1 = require("./diagnosis.repository");
const repository = new diagnosis_repository_1.DiagnosisRepository();
class DiagnosisService {
    async getDiagnosisCategories(query) {
        return repository.getDiagnosisCategories(query);
    }
    async getDiagnosesByCategory(query) {
        return repository.getDiagnosesByCategory(query);
    }
    async getDiagnosisById(diagnosisId) {
        const diagnosis = await repository.getDiagnosisById(diagnosisId);
        if (!diagnosis) {
            throw new Error("Diagnosis not found");
        }
        return diagnosis;
    }
}
exports.DiagnosisService = DiagnosisService;
