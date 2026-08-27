import { Prisma } from "@prisma/client";

// Table + id column that each entity's generated ID lands in. Used to
// detect collisions when a sequence's current_number has fallen out of
// sync with the real data (e.g. after manual seeds/imports bypassed it).
const ENTITY_TARGET: Record<string, { table: string; column: string }> = {
    APPOINTMENT: { table: "appointment_history", column: "appointment_id" },
    BRANCH: { table: "branch", column: "branch_id" },
    BRANCH_ADMIN: { table: "employees", column: "employee_id" },
    DEPARTMENT: { table: "department_master", column: "department_id" },
    DOCTOR: { table: "employees", column: "employee_id" },
    EMPLOYEE: { table: "employees", column: "employee_id" },
    ENCOUNTER: { table: "encounter", column: "encounter_no" },
    LOGIN_OTP: { table: "login_otp", column: "otp_id" },
    NOTIFICATION: { table: "appointment_notification", column: "notification_id" },
    PATIENT: { table: "patient_bio_data", column: "patient_id" },
    RESCHEDULE_QUEUE: { table: "appointment_reschedule_queue", column: "queue_id" },
    SAMPLE_COLLECTION: { table: "sample_collection", column: "sample_collection_id" },
    USER: { table: "user_table", column: "user_id" },
    DOCTOR_TRANSFER: { table: "doctor_transfer", column: "transfer_id" },
    REGIMEN_PROTOCOL: { table: "chemotherapy_regimen_protocol", column: "protocol_id" },
    REGIMEN_PROTOCOL_ITEM: { table: "chemotherapy_regimen_protocol_items", column: "protocol_item_id" },
    REGIMEN_PROTOCOL_DAY: { table: "chemotherapy_regimen_protocol_days", column: "protocol_day_id" },
    REGIMEN_PROTOCOL_DILUTION: { table: "chemotherapy_protocol_dilutions", column: "protocol_dilution_id" },
};

// Generates `count` consecutive ids for one entity while holding the
// sequence row lock exactly once. Batch callers (e.g. prescription items)
// would otherwise pay the lock-read + collision-check + sequence-update
// cost PER id inside an interactive transaction, which blows past the
// default 5s transaction timeout on high-latency databases (Supabase).
export async function generateIdBatch(
    tx: Prisma.TransactionClient,
    entity: string,
    count: number
): Promise<string[]> {

    if (count <= 0) {
        return [];
    }

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

    const generatedIds: string[] = [];

    while (generatedIds.length < count) {

        nextNumber += 1;

        const candidate = sequence.prefix +
            nextNumber
                .toString()
                .padStart(3, "0");

        if (target) {

            const existing = await tx.$queryRawUnsafe<any[]>(
                `SELECT 1 FROM ${target.table} WHERE ${target.column} = '${candidate}'`
            );

            if (existing.length > 0) {
                continue;
            }

        }

        generatedIds.push(candidate);

    }

    await tx.id_sequences.update({

        where: {

            entity_name: entity

        },

        data: {

            current_number: nextNumber,

            updated_at: new Date()

        }

    });

    return generatedIds;

}

export async function generateId(
    tx: Prisma.TransactionClient,
    entity: string
): Promise<string> {

    const [generatedId] = await generateIdBatch(tx, entity, 1);

    return generatedId;

}
