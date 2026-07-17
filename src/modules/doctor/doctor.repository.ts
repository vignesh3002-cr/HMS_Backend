<<<<<<< HEAD
import prisma from "../../config/prisma";
=======
{/*import prisma from "../../config/prisma";
>>>>>>> 8513f9342964d7350f5775a3b575ab03ee99de79

export const getDoctors = async () => {
    return prisma.employees.findMany({
        where: {
            user_table: {
                role_type: "DOCTOR"
            }
        },
        include: {
            user_table: true,
            doctor_profile: true,
            doctor_schedule: true,
<<<<<<< HEAD
            branch: true
=======
            branch: true,
            department_master: true
>>>>>>> 8513f9342964d7350f5775a3b575ab03ee99de79
        },
        orderBy: {
            first_name: "asc"
        }
    });
};
export const getDoctorByEmployeeId = async (
    employeeId: string
) => {

    return prisma.employees.findUnique({

        where: {
            employee_id: employeeId
        },

        include: {

            user_table: true,

            doctor_profile: true,

<<<<<<< HEAD
=======
            department_master: true,

>>>>>>> 8513f9342964d7350f5775a3b575ab03ee99de79
            branch: true,

            doctor_schedule: true,

            user_branch_mapping: {
                include: {
                    branch: true
                }
            }

        }

    });

<<<<<<< HEAD
};
=======
};*/}
>>>>>>> 8513f9342964d7350f5775a3b575ab03ee99de79
