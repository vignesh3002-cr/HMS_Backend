import prisma from "../../config/prisma";

export class AuthRepository {

  async findUserByUsername(username: string) {
    return prisma.user_table.findFirst({
      where: {
        username: username,
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
  }

}