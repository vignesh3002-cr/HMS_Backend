import prisma from "../../config/prisma";

export class AuthRepository {

  async findUserById(userId: string) {
    return prisma.user_table.findFirst({
      where: { user_id: userId },
    });
  }

  async findUserByUsername(username: string) {
    const trimmed = (username || "").trim();

    let user = await prisma.user_table.findFirst({
      where: {
        OR: [
          {
            username: {
              equals: trimmed,
              mode: "insensitive",
            },
          },
          {
            patient_bio_data: {
              some: {
                OR: [
                  { patient_id: { equals: trimmed, mode: "insensitive" } },
                  { patient_primary_mobile: { equals: trimmed } },
                  { patient_email: { equals: trimmed, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      },
      include: {
        branch: true,
        employees: {
          include: {
            branch: true,
          },
        },
        patient_bio_data: true,
        user_branch_mapping: {
          where: { status: 1 },
          include: {
            branch: true,
          },
        },
      },
    });

    // If not found or if patient_bio_data was not populated, query patient_bio_data directly
    if (!user || (!user.patient_bio_data?.length && !user.employees)) {
      const patient = await prisma.patient_bio_data.findFirst({
        where: {
          OR: [
            { patient_id: { equals: trimmed, mode: "insensitive" } },
            { patient_primary_mobile: { equals: trimmed } },
            { patient_email: { equals: trimmed, mode: "insensitive" } },
          ],
        },
        include: {
          user_table: {
            include: {
              branch: true,
              employees: {
                include: {
                  branch: true,
                },
              },
              patient_bio_data: true,
              user_branch_mapping: {
                where: { status: 1 },
                include: {
                  branch: true,
                },
              },
            },
          },
        },
      });

      if (patient?.user_table) {
        user = patient.user_table;
        if (!user.patient_bio_data || user.patient_bio_data.length === 0) {
          (user as any).patient_bio_data = [patient];
        }
      }
    }

    return user;
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