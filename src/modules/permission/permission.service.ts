import crypto from "crypto";
import prisma from "../../config/prisma";

const PERMISSION_CACHE_TTL = 5 * 60 * 1000;

const cache = new Map<string, { permissions: string[]; expires: number }>();

function getCacheKey(role: string): string {
  return `perm:${role.toUpperCase()}`;
}

function isCacheValid(entry: { permissions: string[]; expires: number }): boolean {
  return Date.now() < entry.expires;
}

export class PermissionService {
  async getPermissionMatrix(): Promise<{
    permissions: Array<{
      id: string;
      key: string;
      name: string;
      description: string | null;
      category: string;
      is_active: boolean;
      roles: Array<{ role_type: string; granted: boolean }>;
    }>;
    roles: Array<{
      role_type: string;
      display_name: string | null;
      sort_order: number;
      is_active: boolean;
    }>;
  }> {
    const [permissions, roles, rolePermissions] = await Promise.all([
      prisma.permission.findMany({
        where: { is_active: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
      prisma.role_id_config.findMany({
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
      }),
      prisma.rolePermission.findMany({
        where: { revoked_at: null },
        include: { Permission: true },
      }),
    ]);

    const rolePermMap = new Map<string, Set<string>>();

    for (const rp of rolePermissions) {
      if (!rolePermMap.has(rp.role_type)) {
        rolePermMap.set(rp.role_type, new Set());
      }

      rolePermMap.get(rp.role_type)!.add(rp.permission_id);
    }

    const permissionsWithRoles = permissions.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      description: p.description,
      category: p.category,
      is_active: p.is_active,
      roles: roles.map((r) => ({
        role_type: r.role_type,
        granted: rolePermMap.get(r.role_type)?.has(p.id) ?? false,
      })),
    }));
    const rolesWithConfig = roles.map((r) => ({
      role_type: r.role_type,
      display_name: r.display_name,
      sort_order: r.sort_order,
      is_active: r.is_active,
    }));
    return {
      permissions: permissionsWithRoles,
      roles: rolesWithConfig,
    };
  }


  async grantPermission(
    roleType: string,
    permissionKey: string,
    grantedBy: string
  ): Promise<void> {

    const permission = await prisma.permission.findUnique({
      where: { key: permissionKey },
    });

    if (!permission) {
      throw new Error(`Permission not found: ${permissionKey}`);
    }


    await prisma.rolePermission.upsert({
      where: {
        role_type_permission_id: {
          role_type: roleType.toUpperCase(),
          permission_id: permission.id,
        },
      },
      update: {
        revoked_at: null,
        revoked_by: null,
      },
      create: {
        id: crypto.randomUUID(),
        role_type: roleType.toUpperCase(),
        permission_id: permission.id,
        granted_by: grantedBy,
      },
    });


    await prisma.permissionAuditLog.create({
      data: {
        role_type: roleType,
        permission_key: permissionKey,
        action: "GRANTED",
        changed_by: grantedBy,
        metadata: {
          permission_id: permission.id,
        },
      },
    });


    this.invalidateCache(roleType);
  }



  async revokePermission(
    roleType: string,
    permissionKey: string,
    revokedBy: string
  ): Promise<void> {


    const permission = await prisma.permission.findUnique({
      where: { key: permissionKey },
    });


    if (!permission) {
      throw new Error(`Permission not found: ${permissionKey}`);
    }


    const existing = await prisma.rolePermission.findUnique({
      where: {
        role_type_permission_id: {
          role_type: roleType.toUpperCase(),
          permission_id: permission.id,
        },
      },
    });

    if (!existing || existing.revoked_at) {
      throw new Error(`Permission not granted to role: ${roleType}`);
    }


    await prisma.rolePermission.update({
      where: {
        role_type_permission_id: {
          role_type: roleType.toUpperCase(),
          permission_id: permission.id,
        },
      },
      data: {
        revoked_at: new Date(),
        revoked_by: revokedBy,
      },
    });


    await prisma.permissionAuditLog.create({
      data: {
        role_type: roleType,
        permission_key: permissionKey,
        action: "REVOKED",
        changed_by: revokedBy,
        metadata: {
          permission_id: permission.id,
        },
      },
    });


    this.invalidateCache(roleType);
  }




  async bulkUpdatePermissions(
    updates: Array<{
      role_type: string;
      permission_key: string;
      grant: boolean;
    }>,
    changedBy: string
  ): Promise<void> {


    const permissionKeys = [
      ...new Set(updates.map((u) => u.permission_key)),
    ];


    const permissions = await prisma.permission.findMany({
      where: {
        key: {
          in: permissionKeys,
        },
      },
    });


    const permMap = new Map(
      permissions.map((p) => [p.key, p.id])
    );


    const toGrant: Array<{
      role_type: string;
      permission_id: string;
      permission_key: string;
    }> = [];


    const toRevoke: Array<{
      role_type: string;
      permission_id: string;
      permission_key: string;
    }> = [];



    for (const update of updates) {

      const permId = permMap.get(update.permission_key);


      if (!permId) {
        throw new Error(
          `Permission not found: ${update.permission_key}`
        );
      }


      if (update.grant) {

        toGrant.push({
          role_type: update.role_type.toUpperCase(),
          permission_id: permId,
          permission_key: update.permission_key,
        });

      } else {

        toRevoke.push({
          role_type: update.role_type.toUpperCase(),
          permission_id: permId,
          permission_key: update.permission_key,
        });

      }
    }



    await prisma.$transaction(async (tx) => {


      for (const grant of toGrant) {


        await tx.rolePermission.upsert({

          where: {
            role_type_permission_id: {
              role_type: grant.role_type,
              permission_id: grant.permission_id,
            },
          },


          update: {
            revoked_at: null,
            revoked_by: null,
          },


create: {
        id: crypto.randomUUID(),
        role_type: grant.role_type,
        permission_id: grant.permission_id,
        granted_by: changedBy,
      },

        });



        await tx.permissionAuditLog.create({
          data: {
            role_type: grant.role_type,
            permission_key: grant.permission_key,
            action: "GRANTED",
            changed_by: changedBy,
            metadata: {
              permission_id: grant.permission_id,
            },
          },
        });

      }



      for (const revoke of toRevoke) {


        await tx.rolePermission.update({

          where: {
            role_type_permission_id: {
              role_type: revoke.role_type,
              permission_id: revoke.permission_id,
            },
          },


          data: {
            revoked_at: new Date(),
            revoked_by: changedBy,
          },

        });



        await tx.permissionAuditLog.create({

          data: {
            role_type: revoke.role_type,
            permission_key: revoke.permission_key,
            action: "REVOKED",
            changed_by: changedBy,
            metadata: {
              permission_id: revoke.permission_id,
            },
          },

        });

      }

    });



    const affectedRoles = new Set([
      ...toGrant.map((g) => g.role_type),
      ...toRevoke.map((r) => r.role_type),
    ]);


    for (const role of affectedRoles) {
      this.invalidateCache(role);
    }

  }




  async hasPermission(
    roleType: string,
    permissionKey: string
  ): Promise<boolean> {

    const permissions = await this.getCachedPermissions(roleType);

    return permissions.includes(permissionKey);
  }




  async getCachedPermissions(
    roleType: string
  ): Promise<string[]> {


    const cacheKey = getCacheKey(roleType);

    const cached = cache.get(cacheKey);


    if (cached && isCacheValid(cached)) {
      return cached.permissions;
    }



    const rolePermissions = await prisma.rolePermission.findMany({

      where: {
        role_type: roleType.toUpperCase(),
        revoked_at: null,
      },


      include: {
  Permission: true,
},

    });



    const permissionKeys = rolePermissions.map(
      (rp) => rp.Permission.key
    );



    cache.set(cacheKey, {

      permissions: permissionKeys,

      expires: Date.now() + PERMISSION_CACHE_TTL,

    });



    return permissionKeys;

  }




  async getUserPermissions(
    userId: string
  ): Promise<string[]> {


    const user = await prisma.user_table.findUnique({

      where: {
        user_id: userId,
      },


      select: {
        role_type: true,
      },

    });



    if (!user?.role_type) {
      return [];
    }



    return this.getCachedPermissions(user.role_type);

  }




  invalidateCache(roleType?: string): void {

    if (roleType) {

      cache.delete(getCacheKey(roleType));

    } else {

      cache.clear();

    }

  }




  async getAuditLog(
    roleType?: string,
    limit = 100,
    offset = 0
  ) {

    const logs = await prisma.permissionAuditLog.findMany({

      where: roleType
        ? { role_type: roleType }
        : {},


      orderBy: {
        changed_at: "desc",
      },


      take: limit,

      skip: offset,

    });


    return logs.map((log) => ({
      ...log,
      id: Number(log.id),
    }));

  }

}


export const permissionService = new PermissionService();