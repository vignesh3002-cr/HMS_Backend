import prisma from "../../config/prisma";
import { CreateLabReportDto, UpdateLabReportDto, TransferLabReportDto } from "./lab-report.types";

export class LabReportRepository {
  async findAll() {
    return prisma.lab_report.findMany({
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

  async findById(lab_report_id: string) {
    return prisma.lab_report.findUnique({
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

  async findByOrderId(lab_order_id: string) {
    return prisma.lab_report.findFirst({
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

  async create(data: {
    lab_report_id: string;
    lab_order_id: string;
    report_number?: string | null;
    generated_datetime?: Date | null;
    approved_by?: string | null;
    approved_datetime?: Date | null;
    report_status?: string | null;
    report_file?: string | null;
    digital_signature?: string | null;
    report_comment?: any;
    delivered_to?: string | null;
    delivered_datetime?: Date | null;
    branch_id?: string | null;
    user_id?: string | null;
  }) {
    const { report_comment, ...rest } = data;
    return prisma.lab_report.create({
      data: {
        ...rest,
        ...(report_comment !== undefined && report_comment !== null
          ? { report_comment }
          : {}),
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

  async update(lab_report_id: string, data: any) {
    return prisma.lab_report.update({
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

  async transfer(
    lab_report_id: string,
    data: {
      delivered_to: string;
      delivered_datetime: Date;
      report_status: string;
    }
  ) {
    return prisma.lab_report.update({
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

  async delete(lab_report_id: string) {
    return prisma.lab_report.delete({
      where: { lab_report_id },
    });
  }
}
