"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = __importDefault(require("../../config/prisma"));
const branch_repository_1 = require("./branch.repository");
const idGenerator_1 = require("../../utils/idGenerator");
const repository = new branch_repository_1.BranchRepository();
class BranchService {
    async getAllBranches() {
        const branches = await repository.getAllBranches();
        return branches.map((branch) => ({
            branch_id: branch.branch_id,
            branch_name: branch.branch_name,
            branch_area: branch.branch_area,
            branch_email: branch.branch_email,
            branch_contact_number: branch.emergency_no,
            hospital_name: branch.hospital?.hospital_name || "pummy Hospital",
            hospital_id: branch.hospital?.hospital_id || "D002",
        }));
    }
    async createBranch(data, createdBy, hospitalId) {
        const username = await repository.findUsername(data.username);
        if (username) {
            throw new Error("Username already exists");
        }
        if (data.branch_code) {
            const existingBranchCode = await repository.findBranchCode(data.branch_code);
            if (existingBranchCode) {
                throw new Error("Branch code already exists");
            }
        }
        const hashedPassword = await bcrypt_1.default.hash(data.password, Number(process.env.BCRYPT_SALT_ROUNDS));
        const result = await prisma_1.default.$transaction(async (tx) => {
            const branchId = await (0, idGenerator_1.generateId)(tx, "BRANCH");
            const userId = await (0, idGenerator_1.generateId)(tx, "USER");
            const branch = await tx.branch.create({
                data: {
                    branch_type: data.branch_type,
                    branch_code: data.branch_code,
                    address: data.address,
                    district: data.district,
                    state_name: data.state_name,
                    country: data.country,
                    emergency_no: data.emergency_number,
                    branch_pincode: data.pincode,
                    branch_name: data.branch_name,
                    branch_status: "Active",
                    branch_email: data.email,
                    gst_no: data.gst_no,
                    pan_no: data.pan_no,
                    branch_area: data.area,
                    date_of_establish: data.date_of_establish
                        ? new Date(data.date_of_establish)
                        : new Date(),
                    website_address: data.website_address,
                    branch_license_no: data.license_number,
                    total_beds: data.total_beds,
                    total_no_emp: data.total_no_emp,
                    fax_no: data.fax_no,
                    medical_services: data.medical_services,
                    branch_id: branchId,
                    hospital_id: hospitalId,
                }
            });
            const admin = await tx.user_table.create({
                data: {
                    created_by: createdBy,
                    username: data.username,
                    password: hashedPassword,
                    user_status: 0,
                    user_id: userId,
                    branch_id: branchId,
                }
            });
            return {
                branch: {
                    branch_id: branch.branch_id,
                    emergency_number: branch.emergency_no,
                    address: branch.address,
                    branch_email: branch.branch_email,
                    branch_area: branch.branch_area,
                },
                admin: {
                    user_id: admin.user_id,
                    branch_name: branch.branch_name,
                    username: admin.username,
                }
            };
        });
        return result;
    }
}
exports.BranchService = BranchService;
