import { Prisma } from "@prisma/client";

// Table + id column that each entity's generated ID lands in. Used to
// detect collisions when a sequence's current_number has fallen out of
// sync with the real data (e.g. after manual seeds/imports bypassed it).
const ENTITY_TARGET: Record<string, { table: string; column: string }> = {
    APPOINTMENT: { table: "appointment", column: "appointment_id" },
    BRANCH: { table: "branch", column: "branch_id" },
    BRANCH_ADMIN: { table: "employees", column: "employee_id" },
    DEPARTMENT: { table: "department_master", column: "department_id" },
    DOCTOR: { table: "employees", column: "employee_id" },
    EMPLOYEE: { table: "employees", column: "employee_id" },
    ENCOUNTER: { table: "encounter", column: "encounter_no" },
    LOGIN_OTP: { table: "login_otp", column: "otp_id" },
    NOTIFICATION: { table: "appointment_notification", column: "notification_id" },
    PATIENT: { table: "patient", column: "patient_id" },
    RESCHEDULE_QUEUE: { table: "appointment_reschedule_queue", column: "queue_id" },
    USER: { table: "user_table", column: "user_id" },
    DOCTOR_TRANSFER: { table: "doctor_transfer", column: "transfer_id" },
};

export async function generateId(
    tx: Prisma.TransactionClient,
    entity: string
): Promise<string> {

    // Lock the row
    const rows = await tx.$queryRawUnsafe<any[]>(`
        SELECT *
        FROM id_sequences
        WHERE entity_name='${entity}'
        FOR UPDATE
    `);

    if (rows.length === 0) {

        throw new Error(`Sequence not found for ${entity}`);

    }

    const sequence = rows[0];

    const target = ENTITY_TARGET[entity];

    let nextNumber = sequence.current_number;
    let generatedId: string;

    do {

        nextNumber += 1;

        generatedId = sequence.prefix +
            nextNumber
                .toString()
                .padStart(3, "0");

        if (!target) break;

        const existing = await tx.$queryRawUnsafe<any[]>(
            `SELECT 1 FROM ${target.table} WHERE ${target.column} = '${generatedId}'`
        );

        if (existing.length === 0) break;

    } while (true);

    await tx.id_sequences.update({

        where: {

            entity_name: entity

        },

        data: {

            current_number: nextNumber,

            updated_at: new Date()

        }

    });

    return generatedId;

}
