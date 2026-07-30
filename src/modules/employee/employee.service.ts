import bcrypt from "bcrypt";
import prisma from "../../config/prisma";
import { EmployeeRepository } from "./employee.repository";
import { CreateEmployeeDto, UpdateEmployeeDto, GetEmployeesQuery } from "./employee.types";
import { generateId } from "../../utils/idGenerator";

const repository = new EmployeeRepository();
let employeeId: string;

export class EmployeeService {
    async createEmployee(
    data: CreateEmployeeDto,
    createdBy: string
) {
    const username = await repository.findUsername(data.username);

if (username) {
    throw new Error("Username already exists");
}

const email = await repository.findEmail(data.email);

if (email) {
    throw new Error("Email already exists");
}

const mobile = await repository.findMobile(data.mobile_no);

if (mobile) {
    throw new Error("Mobile already exists");
}
if (data.aadhaar_no) {

    const aadhaar = await repository.findAadhaar(data.aadhaar_no);

    if (aadhaar) {
        throw new Error("Aadhaar already exists");
    }

}
if (data.pan_no) {

    const pan = await repository.findPAN(data.pan_no);

    if (pan) {
        throw new Error("PAN already exists");
    }

}
const department = await repository.findDepartment(
    data.department_id
);

if (!department) {

    throw new Error("Department not found");

}
for (const branchId of data.branch_ids) {

    const branch = await repository.findBranch(branchId);

    if (!branch) {

        throw new Error(`Branch ${branchId} not found`);

    }

}
if (
    data.role_type === "DOCTOR" &&
    data.license_no
) {

    const license = await repository.findLicense(
        data.license_no
    );

    if (license) {

        throw new Error("Doctor License already exists");

    }

}
const hashedPassword = await bcrypt.hash(
    data.password,
    Number(process.env.BCRYPT_SALT_ROUNDS)
);
return await prisma.$transaction(async (tx) => {
    const userId = await generateId(
    tx,
    "USER"
);
const user = await tx.user_table.create({

    data: {

        user_id: userId,

        username: data.username,

        password: hashedPassword,

        role_type: data.role_type,

        created_by: createdBy,

        user_status: 0

    }

});
if(data.role_type === "DOCTOR"){
    employeeId = await generateId(
    tx,
    "DOCTOR"
);
}else if(data.role_type === "BRANCH_ADMIN"){
    employeeId = await generateId(
    tx,
    "BRANCH_ADMIN"
);
}else{
    employeeId = await generateId(
    tx,
    "EMPLOYEE"
);
}

const employee = await tx.employees.create({

    data: {

        employee_id: employeeId,

        user_id: user.user_id,

        branch_id: data.branch_ids[0],

        first_name: data.first_name,

        middle_name: data.middle_name,

        last_name: data.last_name,

        email: data.email,

        mobile_no: data.mobile_no,

        blood_group: data.blood_group,

        nationality: data.nationality,

        marital_status: data.marital_status,

        aadhaar_no: data.aadhaar_no,

        pan_no: data.pan_no,
        emp_gender:data.gender,

        passport_no: data.passport_no,

        parmanent_address: data.permanent_address,

        current_address: data.current_address,

        emergency_contact_name: data.emergency_contact_name,

        emergency_contact_relationship:
            data.emergency_contact_relationship,

        emergency_contact_number:
            data.emergency_contact_number,

        department_id: data.department_id,

        designation: data.designation,

        joining_date: new Date(data.joining_date),
        specialization: data.specialization,

        qualification: data.qualification,
        permanent_employee_state:data.permanent_employee_state,
        permanent_employee_district:data.permanent_employee_district,
        permanent_employee_area:data.permanent_employee_area,
        license_no: data.license_no,
        emp_status: true,
        employee_photo_URL: data.employee_photo_URL,
        employee_state: data.employee_state,
        employee_district: data.employee_district,
        employee_area: data.employee_area,
        employee_pincode: data.employee_pincode,
        employee_no_experence: data.employee_no_experence

    }

});
for (const branchId of data.branch_ids) {

    await tx.user_branch_mapping.create({

        data: {

            user_id: user.user_id!,

            branch_id: branchId,
            employee_id: employeeId,

            status: 1

        }

    });

}
if (data.role_type === "DOCTOR") {

    await tx.doctor_profile.create({

        data: {

            employee_id: employee.employee_id!,

            consultation_minutes:
                data.consultation_minutes ?? 20

        }

    });

}
for (const schedule of data.working_hours ?? []) {

    await tx.doctor_schedule.create({

        data: {

            employee_id: employee.employee_id!,

            branch_id: schedule.branch_id,

            day_of_week: schedule.day_of_week,

            shift_name: schedule.shift_name,

            start_time: new Date(
                `1970-01-01T${schedule.start_time}:00`
            ),

            end_time: new Date(
                `1970-01-01T${schedule.end_time}:00`
            ),

            consultation_minutes:
                data.consultation_minutes ?? 20,

            is_active: true

        }

    });

}
return {

    user:{
        user_username: user.username,
        user_id: user.user_id,
        role_type: user.role_type,
        user_status: user.user_status,
    },

    employee:{
        employee_id: employee.employee_id,
        first_name: employee.first_name,
        middle_name: employee.middle_name,
        license_no:employee.license_no
    }
    
};

});

}


async updateEmployee(
    employeeId: string,
    data: UpdateEmployeeDto
) {

    const employee = await repository.findEmployeeById(employeeId);

    if (!employee) {
        throw new Error("Employee not found");
    }

    // A doctor's branch is tied to their doctor_schedule/user_branch_mapping
    // rows, which future appointments point at. Changing it here would hit
    // the destructive deleteMany/create block below and silently orphan any
    // future appointment still on the old schedule. Branch changes for a
    // doctor must go through the transfer workflow instead, which checks for
    // future appointments and closes old rows rather than deleting them.
    if (employee.user_table?.role_type === "DOCTOR" && data.branch_ids) {

        const activeMappings = await prisma.user_branch_mapping.findMany({
            where: { employee_id: employeeId, status: 1 },
            select: { branch_id: true }
        });

        const currentBranchIds = activeMappings.map((mapping) => mapping.branch_id);
        const requestedBranchIds = data.branch_ids;

        const isBranchChange =
            requestedBranchIds.some((id) => !currentBranchIds.includes(id)) ||
            currentBranchIds.some((id) => !requestedBranchIds.includes(id));

        if (isBranchChange) {
            throw new Error(
                "Doctor branch changes must go through POST /api/doctors/:employeeId/transfer to preserve appointment history"
            );
        }

    }

    if (data.department_id) {

        const department = await repository.findDepartment(
            data.department_id
        );

        if (!department) {
            throw new Error("Department not found");
        }

    }

    if (data.username && employee.user_id) {

        const existingUsername = await repository.findUsername(data.username);

        if (existingUsername && existingUsername.user_id !== employee.user_id) {
            throw new Error("Username already exists");
        }

    }

    const hashedPassword = data.password
        ? await bcrypt.hash(data.password, Number(process.env.BCRYPT_SALT_ROUNDS))
        : undefined;

    // Login credentials + active/inactive status live on user_table, not
    // employees — only touch it when the caller actually changed one of these.
    const userUpdateData: { username?: string; password?: string; user_status?: number } = {};
    if (data.username) userUpdateData.username = data.username;
    if (hashedPassword) userUpdateData.password = hashedPassword;
    if (data.emp_status !== undefined) userUpdateData.user_status = data.emp_status ? 1 : 0;

    // A Branch Admin's branch_id is a real assignment — deactivating them
    // must release that branch rather than leaving a stale branch_id on an
    // inactive admin. Every other role's branch_id is just their home branch
    // and is left untouched regardless of active/inactive status.
    const isBranchAdmin = employee.user_table?.role_type === "BRANCH_ADMIN";
    const shouldReleaseBranch = isBranchAdmin && data.emp_status === false;

    const employeeUpdateData: Record<string, unknown> = {
        first_name: data.first_name,
        middle_name: data.middle_name,
        last_name: data.last_name,
        email: data.email,
        gender:data.gender,
        mobile_no: data.mobile_no,
        blood_group: data.blood_group,
        nationality: data.nationality,
        marital_status: data.marital_status,
        aadhaar_no: data.aadhaar_no,
        pan_no: data.pan_no,
        age:data.age,
        passport_no: data.passport_no,
        parmanent_address: data.permanent_address,
        current_address: data.current_address,
        emergency_contact_name: data.emergency_contact_name,
        emergency_contact_relationship: data.emergency_contact_relationship,
        emergency_contact_number: data.emergency_contact_number,
        department_id: data.department_id,
        designation: data.designation,
        joining_date: data.joining_date ? new Date(data.joining_date) : undefined,
        emp_status: data.emp_status,
        employee_photo_URL: data.employee_photo_URL,
        employee_state: data.employee_state,
        employee_district: data.employee_district,
        employee_area: data.employee_area,
        employee_pincode: data.employee_pincode,
        employee_no_experence: data.employee_no_experence,
        specialization: data.specialization,
        qualification: data.qualification,
        license_no: data.license_no,
        permanent_employee_state:data.permanent_employee_state,
        permanent_employee_district:data.permanent_employee_district,
        permanent_employee_area:data.permanent_employee_area,
    };

    if (shouldReleaseBranch) {
        employeeUpdateData.branch_id = null;
    }

    const hasUserUpdate = Object.keys(userUpdateData).length > 0 && !!employee.user_id;
    const isDoctor = data.role_type === "DOCTOR" || employee.user_table?.role_type === "DOCTOR";

    const [updatedEmployee] = await prisma.$transaction([
        prisma.employees.update({
            where: { employee_id: employeeId },
            data: employeeUpdateData,
        }),
        ...(hasUserUpdate
            ? [
                prisma.user_table.update({
                    where: { user_id: employee.user_id! },
                    data: userUpdateData,
                }),
            ]
            : []),
        // Deactivating a Branch Admin also releases whichever branch's
        // active mapping they hold — getAssignableAdmins/getBranchById's
        // "current admin" lookups key off user_branch_mapping.status, not
        // employees.branch_id, so both must be released together or the
        // branch would still show this now-inactive admin as current.
        ...(shouldReleaseBranch && employee.user_id
            ? [
                prisma.user_branch_mapping.updateMany({
                    where: { user_id: employee.user_id, status: 1 },
                    data: { status: 0, is_primary_branch: false },
                }),
            ]
            : []),
    ]);

    await prisma.$transaction(async (tx) => {
        if (data.branch_ids) {
            await tx.user_branch_mapping.deleteMany({
                where: {
                    user_id: employee.user_table?.user_id!
                }
            });

            for (const branchId of data.branch_ids) {
                await tx.user_branch_mapping.create({
                    data: {
                        user_id: employee.user_table?.user_id!,
                        branch_id: branchId,
                        employee_id: employeeId,
                        status: 1
                    }
                });
            }
        }

        if (isDoctor) {
            await tx.doctor_profile.upsert({
                where: {
                    employee_id: employeeId
                },
                update: {
                    consultation_minutes: data.consultation_minutes ?? 20
                },
                create: {
                    employee_id: employeeId,
                    consultation_minutes: data.consultation_minutes ?? 20
                }
            });
        }

        if (data.working_hours) {
            await tx.doctor_schedule.deleteMany({
                where: {
                    employee_id: employeeId
                }
            });

            for (const schedule of data.working_hours) {
                await tx.doctor_schedule.create({
                    data: {
                        employee_id: employeeId,
                        branch_id: schedule.branch_id,
                        day_of_week: schedule.day_of_week,
                        shift_name: schedule.shift_name,
                        start_time: new Date(`1970-01-01T${schedule.start_time}:00`),
                        end_time: new Date(`1970-01-01T${schedule.end_time}:00`),
                        consultation_minutes: data.consultation_minutes ?? 20,
                        is_active: true
                    }
                });
            }
        }
    });

    return {
        employee_id: updatedEmployee.employee_id,
        first_name: updatedEmployee.first_name,
        middle_name: updatedEmployee.middle_name,
        last_name: updatedEmployee.last_name,
        email: updatedEmployee.email
    };
}
async getAllEmployees() {
    return repository.getAllEmployees();
}
async softDeleteEmployee(employeeId: string) {

    const employee = await repository.findEmployeeById(employeeId);

    if (!employee) {
        throw new Error("Employee not found");
    }

    await repository.softDeleteEmployee(employeeId);

    return {
        message: "Employee deactivated successfully"
    };
}
async getEmployees (

    query: GetEmployeesQuery

) {

    return repository.getEmployees(query);

};
 async getEmployeeById(

    employeeId: string

){

    return repository.getEmployeeById(
        employeeId
    );

};

}

