import prisma from "../../config/prisma";

export class AuthRepository {

  async findUserById(userId: string) {
    return prisma.user_table.findFirst({
      where: { user_id: userId },
    });
  }

  async findUserByUsername(username: string) {
    return prisma.user_table.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
      },
      include: {
        branch: {
          include: { hospital: true },
        },
        employees: {
          include: {
            branch: {
              include: { hospital: true },
            },
          },
        },
        patient_bio_data: true,
        user_branch_mapping: {
          where: { status: 1 },
          include: {
            branch: {
              include: { hospital: true },
            },
          },
        },
      },
    });
  }

  async updateKpiPreferences(userId: string, kpiPreferences: string | null) {
    return prisma.user_table.update({
      where: { user_id: userId },
      data: { kpi_preferences: kpiPreferences },
    });
  }

  async updateKpiUsage(userId: string, kpiUsage: string | null) {
    return prisma.user_table.update({
      where: { user_id: userId },
      data: { kpi_usage: kpiUsage },
    });
  }

}