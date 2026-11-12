"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabResultService = void 0;
const lab_result_repository_1 = require("./lab-result.repository");
class LabResultService {
    repository;
    constructor() {
        this.repository = new lab_result_repository_1.LabResultRepository();
    }
    async getByOrderItemId(lab_order_item_id) {
        if (!lab_order_item_id) {
            throw new Error("lab_order_item_id is required");
        }
        return this.repository.findByOrderItemId(lab_order_item_id);
    }
    async getById(lab_result_id) {
        if (!lab_result_id) {
            throw new Error("lab_result_id is required");
        }
        const result = await this.repository.findById(lab_result_id);
        if (!result) {
            throw new Error("Lab result not found");
        }
        return result;
    }
    async create(data) {
        const lab_result_id = `RES${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        return this.repository.create({ ...data, lab_result_id });
    }
    async update(lab_result_id, data) {
        return this.repository.update(lab_result_id, data);
    }
    async batchSave(payload) {
        if (!payload.lab_order_item_id) {
            throw new Error("lab_order_item_id is required for batch saving results");
        }
        if (!Array.isArray(payload.parameters) || payload.parameters.length === 0) {
            throw new Error("At least one parameter result must be provided");
        }
        return this.repository.batchSave(payload);
    }
    async delete(lab_result_id) {
        return this.repository.delete(lab_result_id);
    }
}
exports.LabResultService = LabResultService;
