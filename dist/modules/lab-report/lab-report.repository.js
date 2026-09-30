"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabReportRepository = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
class LabReportRepository {
    async findAll() {
        return prisma_1.default.lab_report.findMany({
            orderBy: {
                id: "desc",
            },
            include: {
                employees: {
                    select: {
                        employee_id: true,
                        first_name: true,
                        last_name: true,
                        designation: true,
                    },
                },
                lab_order: {
                    include: {
                        patient_history: true,
                        employees: {
                            select: {
                                employee_id: true,
                                first_name: true,
                                last_name: true,
                                designation: true,
                            },
                        },
                        department_master: true,
                        lab_order_item: {
                            include: {
                                lab_test_master: true,
                                sample_collection: true,
                            },
                        },
                    },
                },
                branch: true,
            },
        });
    }
    async findById(lab_report_id) {
        return prisma_1.default.lab_report.findUnique({
            where: { lab_report_id },
            include: {
                employees: true,
                lab_order: {
                    include: {
                        patient_history: true,
                        employees: true,
                        department_master: true,
                        lab_order_item: {
                            include: {
                                lab_test_master: true,
                                sample_collection: true,
                            },
                        },
                    },
                },
                branch: true,
            },
        });
    }
    async findByOrderId(lab_order_id) {
        return prisma_1.default.lab_report.findFirst({
            where: { lab_order_id },
            include: {
                employees: true,
                lab_order: {
                    include: {
                        patient_history: true,
                        employees: true,
                        department_master: true,
                        lab_order_item: {
                            include: {
                                lab_test_master: true,
                                sample_collection: true,
                            },
                        },
                    },
                },
                branch: true,
            },
        });
    }
    async create(data) {
        return prisma_1.default.lab_report.create({
            data: data,
            include: {
                employees: true,
                lab_order: {
                    include: {
                        patient_history: true,
                        employees: true,
                        lab_order_item: {
                            include: {
                                lab_test_master: true,
                                sample_collection: true,
                            },
                        },
                    },
                },
            },
        });
    }
    async update(lab_report_id, data) {
        return prisma_1.default.lab_report.update({
            where: { lab_report_id },
            data,
            include: {
                employees: true,
                lab_order: {
                    include: {
                        patient_history: true,
                        employees: true,
                        lab_order_item: {
                            include: {
                                lab_test_master: true,
                                sample_collection: true,
                            },
                        },
                    },
                },
            },
        });
    }
    async transfer(lab_report_id, data) {
        return prisma_1.default.lab_report.update({
            where: { lab_report_id },
            data: {
                delivered_to: data.delivered_to,
                delivered_datetime: data.delivered_datetime,
                report_status: data.report_status,
                updated_at: new Date(),
            },
            include: {
                employees: true,
                lab_order: {
                    include: {
                        patient_history: true,
                        employees: true,
                        lab_order_item: {
                            include: {
                                lab_test_master: true,
                                sample_collection: true,
                            },
                        },
                    },
                },
            },
        });
    }
    async delete(lab_report_id) {
        return prisma_1.default.lab_report.delete({
            where: { lab_report_id },
        });
    }
}
exports.LabReportRepository = LabReportRepository;
