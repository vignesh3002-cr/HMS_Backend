"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriorityFlagsController = void 0;
const priorityFlags_service_1 = require("./priorityFlags.service");
const service = new priorityFlags_service_1.PriorityFlagsService();
class PriorityFlagsController {
    async getPriorityFlags(req, res) {
        try {
            const idsParam = req.query.patientIds;
            if (!idsParam || typeof idsParam !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "patientIds query parameter is required (comma-separated)",
                });
            }
            const patientIds = idsParam
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean);
            if (patientIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "At least one patient ID is required",
                });
            }
            const flags = await service.getPriorityFlags(patientIds);
            return res.status(200).json({
                success: true,
                message: "Priority flags retrieved successfully",
                data: flags,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to retrieve priority flags",
            });
        }
    }
}
exports.PriorityFlagsController = PriorityFlagsController;
