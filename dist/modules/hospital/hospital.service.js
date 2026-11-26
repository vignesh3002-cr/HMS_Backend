"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HospitalService = void 0;
const idGenerator_1 = require("../../utils/idGenerator");
const prisma_1 = __importDefault(require("../../config/prisma"));
const hospital_repository_1 = require("./hospital.repository");
const repository = new hospital_repository_1.HospitalRepository();
class HospitalService {
    async create(data) {
        // Validate hospital name uniqueness
        const existing = await prisma_1.default.hospital.findFirst({
            where: { hospital_name: data.hospital_name },
        });
        if (existing) {
            throw new Error("A hospital with this name already exists");
        }
        const hospitalId = await (0, idGenerator_1.generateId)(prisma_1.default, "HOSPITAL");
        const created = await repository.create(data, hospitalId);
        return {
            ...created,
            branch_count: 0,
        };
    }
    async getById(hospitalId) {
        const hospital = await repository.findById(hospitalId);
        if (!hospital)
            return null;
        const branchCount = await repository.countBranches(hospitalId);
        return { ...hospital, branch_count: branchCount };
    }
    async getAll(page = 1, limit = 50) {
        const { hospitals, total, page: currentPage, limit: currentLimit, totalPages } = await repository.findAll(page, limit);
        // Add branch counts
        const hospitalsWithCounts = await Promise.all(hospitals.map(async (h) => {
            const branchCount = await repository.countBranches(h.hospital_id);
            return { ...h, branch_count: branchCount };
        }));
        return {
            hospitals: hospitalsWithCounts,
            total,
            page: currentPage,
            limit: currentLimit,
            totalPages,
        };
    }
    async update(hospitalId, data) {
        // Validate hospital exists
        const existing = await repository.findById(hospitalId);
        if (!existing) {
            throw new Error("Hospital not found");
        }
        // Validate name uniqueness if changing
        if (data.hospital_name && data.hospital_name !== existing.hospital_name) {
            const duplicate = await prisma_1.default.hospital.findFirst({
                where: { hospital_name: data.hospital_name },
            });
            if (duplicate) {
                throw new Error("A hospital with this name already exists");
            }
        }
        const updated = await repository.update(hospitalId, data);
        const branchCount = await repository.countBranches(hospitalId);
        return { ...updated, branch_count: branchCount };
    }
}
exports.HospitalService = HospitalService;
