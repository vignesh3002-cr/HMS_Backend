import { Request, Response } from "express";
import prisma from "../../config/prisma";

export class RoleController {
  async listRoles(req: Request, res: Response) {
    try {
      const [roles, sequences] = await Promise.all([
        prisma.role_id_config.findMany({
          orderBy: { sort_order: "asc" },
          include: {
            _count: {
  select: {
    RolePermission: {
      where: { revoked_at: null },
    },
  },
},
          },
        }),
        prisma.id_sequences.findMany(),
      ]);

      const prefixMap = new Map(sequences.map((s) => [s.entity_name, s.prefix]));

      return res.json({
        success: true,
        data: roles.map((role) => ({
          role_type: role.role_type,
          prefix: prefixMap.get(role.role_type) ?? null,
          display_name: role.display_name,
          description: role.description,
          is_active: role.is_active,
          sort_order: role.sort_order,
          permission_count: role._count.RolePermission,
        })),
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateRole(req: Request, res: Response) {
    try {
      const roleType = String(req.params.roleType);
      const { display_name, description, is_active, sort_order } = req.body;

      if (display_name !== undefined && (typeof display_name !== "string" || !display_name.trim())) {
        return res.status(400).json({ success: false, message: "display_name must be a non-empty string" });
      }
      if (description !== undefined && description !== null && typeof description !== "string") {
        return res.status(400).json({ success: false, message: "description must be a string or null" });
      }
      if (is_active !== undefined && typeof is_active !== "boolean") {
        return res.status(400).json({ success: false, message: "is_active must be a boolean" });
      }
      if (sort_order !== undefined && typeof sort_order !== "number") {
        return res.status(400).json({ success: false, message: "sort_order must be a number" });
      }

      const role = await prisma.role_id_config.update({
        where: { role_type: roleType },
        data: {
          ...(display_name !== undefined ? { display_name: display_name.trim() } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(is_active !== undefined ? { is_active } : {}),
          ...(sort_order !== undefined ? { sort_order } : {}),
        },
      });

      return res.json({
        success: true,
        message: "Role updated",
        data: {
          role_type: role.role_type,
          display_name: role.display_name,
          description: role.description,
          is_active: role.is_active,
          sort_order: role.sort_order,
        },
      });
    } catch (error: any) {
      if (error?.code === "P2025") {
        return res.status(404).json({ success: false, message: "Role not found" });
      }
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}
