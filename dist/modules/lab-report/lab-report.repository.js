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
                                lab_result: {
                                    include: {
                                        lab_test_parameter: true,
                                    },
                                },
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
                                lab_result: {
                                    include: {
                                        lab_test_parameter: true,
                                    },
                                },
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
                                lab_result: {
                                    include: {
                                        lab_test_parameter: true,
                                    },
                                },
                            },
                        },
                    },
                },
                branch: true,
            },
        });
    }
    async create(data) {
        const report = await prisma_1.default.lab_report.create({
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
                                lab_result: {
                                    include: {
                                        lab_test_parameter: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        // Link any unassigned lab_result rows for this order to the newly created report
        if (data.lab_order_id && report.lab_report_id) {
            await prisma_1.default.lab_result.updateMany({
                where: {
                    lab_order_item: {
                        lab_order_id: data.lab_order_id,
                    },
                    lab_report_id: null,
                },
                data: {
                    lab_report_id: report.lab_report_id,
                },
            }).catch(() => { });
        }
        return report;
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
                                lab_result: {
                                    include: {
                                        lab_test_parameter: true,
                                    },
                                },
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
                                lab_result: {
                                    include: {
                                        lab_test_parameter: true,
                                    },
                                },
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
