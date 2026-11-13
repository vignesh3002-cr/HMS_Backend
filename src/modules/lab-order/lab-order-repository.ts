import prisma from "../../config/prisma";

import {
    CreateLabOrderDto,
    LabOrderFilters,
    UpdateLabOrderDto
} from "./lab-order-types";

class LabOrderRepository {

    async create(
        data: CreateLabOrderDto & {
            lab_order_id: string;
            branch_id?: string;
            user_id?: string;
        }
    ) {

        return prisma.lab_order.create({
            data
        });

    }

    async findById(lab_order_id: string) {

    return prisma.lab_order.findUnique({

        where: {
            lab_order_id
        },

        include: {

            patient_history: {
                include: {
                    patient_bio_data: true
                }
            },

            employees: true,

            department_master: true,

            appointment_history: true,

                        lab_order_item: {
                include: {
                    lab_test_master: {
                        include: {
                            lab_test_parameter: {
                                orderBy: { sort_order: "asc" }
                            }
                        }
                    },
                    sample_collection: true,
                    lab_result: {
                        include: {
                            lab_test_parameter: true
                        }
                    }
                }
            },

            lab_report: true

        }

    });

}

    async findAll(
        {
            patientId,
            appointmentId,
            patientHistoryId,
            limit
        }: LabOrderFilters = {}
    ) {

    const hasFilter = Boolean(patientId || appointmentId || patientHistoryId);

    return prisma.lab_order.findMany({

        /* Callers that pass a filter only ever see that patient's / visit's
           orders - the list used to return every order in the branch, which
           let clinical flows attach items to another patient's order. */
        ...(hasFilter ? {
            where: {
                ...(appointmentId ? { appointment_id: appointmentId } : {}),
                ...(patientHistoryId ? { patient_history_id: patientHistoryId } : {}),
                ...(patientId ? { patient_history: { patient_id: patientId } } : {})
            }
        } : {}),

        /* Only a caller that asks for a limit is capped (clinical flows ask
           for the latest visit's rows); the lab screens still get the full
           list they have always shown. */
        ...(limit && limit > 0 ? { take: Math.min(limit, 500) } : {}),

        select: {

            lab_order_id: true,
            patient_history_id: true,
            appointment_id: true,
            doctor_employee_id: true,
            department_id: true,
            order_datetime: true,
            priority: true,
            clinical_notes: true,
            lab_description: true,
            order_status: true,

            patient_history: {
                select: {
                    patient_history_id: true,
                    patient_id: true,
                    visit_type: true,
                    visit_status: true,
                    patient_bio_data: {
                        select: {
                            patient_id: true,
                            patient_first_name: true,
                            patient_middle_name: true,
                            patient_last_name: true,
                            patient_dob: true,
                            patient_gender: true,
                            patient_primary_mobile: true,
                            patient_email: true,
                            Patient_address: true,
                            patient_photo_url: true,
                            patient_area: true,
                            patient_district: true,
                            patient_state: true
                        }
                    }
                }
            },

            /* Which tests this order already has (the consultation flows skip
               those instead of ordering the same test twice). Only loaded for
               filtered (clinical) calls - the lab's full list would otherwise
               join every order's items. */
            ...(hasFilter ? {
                lab_order_item: {
                    select: {
                        lab_order_item_id: true,
                        lab_test_id: true,
                        item_status: true,
                        /* The test's name / code, so clinical flows can spot a
                           test already ordered under a different catalog id
                           (the same test exists under more than one id). */
                        lab_test_master: {
                            select: {
                                test_name: true,
                                test_code: true
                            }
                        }
                    }
                }
            } : {}),

            employees: {
                select: {
                    employee_id: true,
                    first_name: true,
                    last_name: true,
                    designation: true
                }
            },

            department_master: {
                select: {
                    department_id: true,
                    department_name: true
                }
            },

                        lab_order_item: {
                include: {
                    lab_test_master: {
                        include: {
                            lab_test_parameter: {
                                orderBy: { sort_order: "asc" }
                            }
                        }
                    },
                    sample_collection: true,
                    lab_result: {
                        include: {
                            lab_test_parameter: true
                        }
                    }
                }
            }

        },

        orderBy: {
            created_at: "desc"
        }

    });

}
            
        
            

      

    async findPatient(patient_history_id: string) {

        return prisma.patient_history.findUnique({

            where: {
                patient_history_id
            }

        });

    }

    async findMostRecentPatientHistory(patient_id: string) {

        return prisma.patient_history.findFirst({
            where: { patient_id },
            orderBy: { id: "desc" }
        });

    }

    /* The visit record an appointment belongs to. Orders placed from a visit
       must hang off that visit - not off the patient's latest one. */
    async findPatientHistoryByAppointment(appointment_id: string) {

        return prisma.patient_history.findFirst({
            where: { appointment_id },
            orderBy: { id: "desc" }
        });

    }

    async findDoctor(employee_id: string) {

        return prisma.employees.findUnique({

            where: {
                employee_id
            }

        });

    }

    async findDepartment(department_id: string) {

        return prisma.department_master.findUnique({

            where: {
                department_id
            }

        });

    }

    async findAppointment(appointment_id: string) {

        return prisma.appointment_history.findUnique({

            where: {
                appointment_id
            }

        });

    }

    async update(
        lab_order_id: string,
        data: UpdateLabOrderDto
    ) {

        return prisma.lab_order.update({

            where: {
                lab_order_id
            },

            data

        });

    }

    async delete(lab_order_id: string) {

        return prisma.lab_order.delete({

            where: {
                lab_order_id
            }

        });

    }

}

export default new LabOrderRepository();