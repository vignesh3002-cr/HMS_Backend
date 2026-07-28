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
          select: {
            employee_id: true,
            email: true,
            first_name: true
          }
        },

        patient_bio_data: {
          select: {
            patient_id: true,
            patient_email: true,
            patient_first_name: true
          }
        }
      }
    });

  }

}