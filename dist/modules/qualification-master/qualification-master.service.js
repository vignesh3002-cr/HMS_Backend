"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.qualificationMasterService = exports.QualificationMasterService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const qualification_master_repository_1 = require("./qualification-master.repository");
class QualificationMasterService {
    /**
     * Generate Qualification ID
     * Example: QUAL000001
     */
    async generateQualificationId() {
        const lastQualification = await prisma_1.default.qualification_master.findFirst({
            orderBy: {
                id: "desc",
            },
        });
        if (!lastQualification) {
            return "QUAL000001";
        }
        const lastNumber = parseInt(lastQualification.qualification_id.replace("QUAL", ""), 10);
        return `QUAL${String(lastNumber + 1).padStart(6, "0")}`;
    }
    async create(data) {
        const exists = await qualification_master_repository_1.qualificationMasterRepository.findByQualificationName(data.qualification_name);
        if (exists) {
            throw new Error("Qualification already exists");
        }
        const qualification_id = await this.generateQualificationId();
        return qualification_master_repository_1.qualificationMasterRepository.create({
            qualification_id,
            qualification_name: data.qualification_name,
            designation: data.designation,
            is_active: data.is_active ?? true,
        });
    }
    async getAll() {
        return qualification_master_repository_1.qualificationMasterRepository.findAll();
    }
    async getById(qualification_id) {
        const qualification = await qualification_master_repository_1.qualificationMasterRepository.findById(qualification_id);
        if (!qualification) {
            throw new Error("Qualification not found");
        }
        return qualification;
    }
    async getByDesignation(designation) {
        return qualification_master_repository_1.qualificationMasterRepository.findByDesignation(designation);
    }
    async update(qualification_id, data) {
        const qualification = await qualification_master_repository_1.qualificationMasterRepository.findById(qualification_id);
        if (!qualification) {
            throw new Error("Qualification not found");
        }
        if (data.qualification_name) {
            const duplicate = await qualification_master_repository_1.qualificationMasterRepository.findByQualificationName(data.qualification_name);
            if (duplicate &&
                duplicate.qualification_id !== qualification_id) {
                throw new Error("Qualification already exists");
            }
        }
        return qualification_master_repository_1.qualificationMasterRepository.update(qualification_id, data);
    }
    async delete(qualification_id) {
        const qualification = await qualification_master_repository_1.qualificationMasterRepository.findById(qualification_id);
        if (!qualification) {
            throw new Error("Qualification not found");
        }
        return qualification_master_repository_1.qualificationMasterRepository.softDelete(qualification_id);
    }
}
exports.QualificationMasterService = QualificationMasterService;
exports.qualificationMasterService = new QualificationMasterService();
