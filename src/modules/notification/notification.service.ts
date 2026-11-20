import { NotificationRepository } from "./notification.repository";
import { sendMail } from "../../utils/mail";

const repository = new NotificationRepository();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class NotificationService {

    async getNotifications(employeeId: string) {

        return repository.getNotifications(employeeId);

    }

    async markAllRead(employeeId: string) {

        return repository.markAllRead(employeeId);

    }

    /**
     * Sends an email directly over SMTP. Throws with a user-facing message
     * on validation problems and on SMTP failures so the caller can block
     * the dependent workflow (patient registration) when sending fails.
     */
    async sendEmail(payload: { to?: unknown; subject?: unknown; text?: unknown }) {

        const to = String(payload?.to ?? "").trim();
        const subject = String(payload?.subject ?? "").trim();
        const text = String(payload?.text ?? "").trim();

        if (!to) throw new Error("Recipient email address is required.");
        if (!EMAIL_PATTERN.test(to)) throw new Error("Recipient email address is not valid.");
        if (!subject) throw new Error("Email subject is required.");
        if (subject.length > 200) throw new Error("Email subject must be 200 characters or fewer.");
        if (!text) throw new Error("Email message is required.");
        if (text.length > 5000) throw new Error("Email message must be 5000 characters or fewer.");

        await sendMail({ to, subject, text });

        return { to, subject };

    }

}
