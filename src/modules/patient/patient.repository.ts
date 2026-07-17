import prisma from "../../config/prisma";

export const findUsername = async (username: string) => {

    return prisma.user_table.findFirst({
        where: {
            username
        }
    });

};

export const findMobile = async (mobile: string) => {

    return prisma.patient_table.findFirst({
        where: {
            alternate_mobile: mobile
        }
    });

};

export const findAadhaar = async (aadhaar: string) => {

    return prisma.patient_table.findFirst({
        where: {
            aadhaar_no: aadhaar
        }
    });

};

export const findBranch = async (branchId: string) => {

    return prisma.branch.findUnique({
        where: {
            branch_id: branchId
        }
    });

};