import prisma from "../../config/prisma";

export const findUsername = async (username: string) => {

    return prisma.user_table.findFirst({
        where: {
            username
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