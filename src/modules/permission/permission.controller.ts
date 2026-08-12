import { Request, Response } from "express";
import { permissionService } from "./permission.service";

export class PermissionController {
  async getMatrix(req: Request, res: Response) {
    try {
      const matrix = await permissionService.getPermissionMatrix();
      return res.json({ success: true, data: matrix });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async grantPermission(req: Request, res: Response) {
    try {
      const { role_type, permission_key } = req.body;
      const userId = (req as any).user?.user_id;

      if (!role_type || !permission_key) {
        return res.status(400).json({ success: false, message: "role_type and permission_key are required" });
      }

      await permissionService.grantPermission(role_type, permission_key, userId);
      return res.json({ success: true, message: "Permission granted" });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async revokePermission(req: Request, res: Response) {
    try {
      const { role_type, permission_key } = req.body;
      const userId = (req as any).user?.user_id;

      if (!role_type || !permission_key) {
        return res.status(400).json({ success: false, message: "role_type and permission_key are required" });
      }

      await permissionService.revokePermission(role_type, permission_key, userId);
      return res.json({ success: true, message: "Permission revoked" });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async bulkUpdatePermissions(req: Request, res: Response) {
    try {
      const { updates } = req.body;
      const userId = (req as any).user?.user_id;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ success: false, message: "updates array is required" });
      }

      for (const u of updates) {
        if (!u.role_type || !u.permission_key || typeof u.grant !== "boolean") {
          return res.status(400).json({ success: false, message: "Each update must have role_type, permission_key, and grant (boolean)" });
        }
      }

      await permissionService.bulkUpdatePermissions(updates, userId);
      return res.json({ success: true, message: "Permissions updated" });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async getMyPermissions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.user_id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const permissions = await permissionService.getUserPermissions(userId);
      return res.json({ success: true, data: permissions });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getAuditLog(req: Request, res: Response) {
    try {
      const { role_type, limit, offset } = req.query;
      const logs = await permissionService.getAuditLog(
        role_type as string,
        limit ? Number(limit) : 100,
        offset ? Number(offset) : 0
      );
      return res.json({ success: true, data: logs });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}