import { NotificationRepository } from "./notification.repository";

const repository = new NotificationRepository();

export class NotificationService {

    async getNotifications(employeeId: string) {

        return repository.getNotifications(employeeId);

    }

    async markAllRead(employeeId: string) {

        return repository.markAllRead(employeeId);

    }

}
