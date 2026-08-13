"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissionService = exports.PermissionService = void 0;
const crypto_1 = require("crypto");
const prisma_1 = __importDefault(require("../../config/prisma"));
const PERMISSION_CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();
function getCacheKey(role) {
    return `perm:${role.toUpperCase()}`;
}
function isCacheValid(entry) {
    return Date.now() < entry.expires;
}
class PermissionService {
    async getPermissionMatrix() {
        const [permissions, roles, rolePermissions] = await Promise.all([
            prisma_1.default.permission.findMany({
                where: { is_active: true },
                orderBy: [{ category: "asc" }, { name: "asc" }],
            }),
            prisma_1.default.role_id_config.findMany({
                where: { is_active: true },
                orderBy: { sort_order: "asc" },
            }),
            prisma_1.default.rolePermission.findMany({
                where: { revoked_at: null },
                include: { Permission: true },
            }),
        ]);
        const rolePermMap = new Map();
        for (const rp of rolePermissions) {
            if (!rolePermMap.has(rp.role_type)) {
                rolePermMap.set(rp.role_type, new Set());
            }
            rolePermMap.get(rp.role_type).add(rp.permission_id);
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
        return { permissions: permissionsWithRoles, roles: rolesWithConfig };
    }
    async grantPermission(roleType, permissionKey, grantedBy) {
        const permission = await prisma_1.default.permission.findUnique({ where: { key: permissionKey } });
        if (!permission) {
            throw new Error(`Permission not found: ${permissionKey}`);
        }
        await prisma_1.default.rolePermission.upsert({
            where: { role_type_permission_id: { role_type: roleType, permission_id: permission.id } },
            update: { revoked_at: null, revoked_by: null },
            create: {
                id: (0, crypto_1.randomUUID)(),
                role_type: roleType,
                permission_id: permission.id,
                granted_by: grantedBy,
            },
        });
        await prisma_1.default.permissionAuditLog.create({
            data: {
                role_type: roleType,
                permission_key: permissionKey,
                action: "GRANTED",
                changed_by: grantedBy,
                metadata: { permission_id: permission.id },
            },
        });
        this.invalidateCache(roleType);
    }
    async revokePermission(roleType, permissionKey, revokedBy) {
        const permission = await prisma_1.default.permission.findUnique({ where: { key: permissionKey } });
        if (!permission) {
            throw new Error(`Permission not found: ${permissionKey}`);
        }
        const existing = await prisma_1.default.rolePermission.findUnique({
            where: { role_type_permission_id: { role_type: roleType, permission_id: permission.id } },
        });
        if (!existing || existing.revoked_at) {
            throw new Error(`Permission not granted to role: ${roleType}`);
        }
        await prisma_1.default.rolePermission.update({
            where: { role_type_permission_id: { role_type: roleType, permission_id: permission.id } },
            data: { revoked_at: new Date(), revoked_by: revokedBy },
        });
        await prisma_1.default.permissionAuditLog.create({
            data: {
                role_type: roleType,
                permission_key: permissionKey,
                action: "REVOKED",
                changed_by: revokedBy,
                metadata: { permission_id: permission.id },
            },
        });
        this.invalidateCache(roleType);
    }
    async bulkUpdatePermissions(updates, changedBy) {
        const permissionKeys = [...new Set(updates.map((u) => u.permission_key))];
        const permissions = await prisma_1.default.permission.findMany({
            where: { key: { in: permissionKeys } },
        });
        const permMap = new Map(permissions.map((p) => [p.key, p.id]));
        const toGrant = [];
        const toRevoke = [];
        for (const update of updates) {
            const permId = permMap.get(update.permission_key);
            if (!permId) {
                throw new Error(`Permission not found: ${update.permission_key}`);
            }
            if (update.grant) {
                toGrant.push({ role_type: update.role_type, permission_id: permId, permission_key: update.permission_key });
            }
            else {
                toRevoke.push({ role_type: update.role_type, permission_id: permId, permission_key: update.permission_key });
            }
        }
        await prisma_1.default.$transaction(async (tx) => {
            for (const grant of toGrant) {
                await tx.rolePermission.upsert({
                    where: { role_type_permission_id: { role_type: grant.role_type, permission_id: grant.permission_id } },
                    update: { revoked_at: null, revoked_by: null },
                    create: {
                        id: (0, crypto_1.randomUUID)(),
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
                        metadata: { permission_id: grant.permission_id },
                    },
                });
            }
            for (const revoke of toRevoke) {
                await tx.rolePermission.update({
                    where: { role_type_permission_id: { role_type: revoke.role_type, permission_id: revoke.permission_id } },
                    data: { revoked_at: new Date(), revoked_by: changedBy },
                });
                await tx.permissionAuditLog.create({
                    data: {
                        role_type: revoke.role_type,
                        permission_key: revoke.permission_key,
                        action: "REVOKED",
                        changed_by: changedBy,
                        metadata: { permission_id: revoke.permission_id },
                    },
                });
            }
        });
        const affectedRoles = new Set([...toGrant.map((g) => g.role_type), ...toRevoke.map((r) => r.role_type)]);
        for (const role of affectedRoles) {
            this.invalidateCache(role);
        }
    }
    async hasPermission(roleType, permissionKey) {
        const permissions = await this.getCachedPermissions(roleType);
        return permissions.includes(permissionKey);
    }
    async getCachedPermissions(roleType) {
        const cacheKey = getCacheKey(roleType);
        const cached = cache.get(cacheKey);
        if (cached && isCacheValid(cached)) {
            return cached.permissions;
        }
        const rolePermissions = await prisma_1.default.rolePermission.findMany({
            where: {
                role_type: roleType.toUpperCase(),
                revoked_at: null,
            },
            include: { Permission: true },
        });
        const permissionKeys = rolePermissions.map((rp) => rp.Permission.key);
        cache.set(cacheKey, {
            permissions: permissionKeys,
            expires: Date.now() + PERMISSION_CACHE_TTL,
        });
        return permissionKeys;
    }
    async getUserPermissions(userId) {
        const user = await prisma_1.default.user_table.findUnique({
            where: { user_id: userId },
            select: { role_type: true },
        });
        if (!user?.role_type) {
            return [];
        }
        return this.getCachedPermissions(user.role_type);
    }
    invalidateCache(roleType) {
        if (roleType) {
            cache.delete(getCacheKey(roleType));
        }
        else {
            cache.clear();
        }
    }
    async getAuditLog(roleType, limit = 100, offset = 0) {
        return (await prisma_1.default.permissionAuditLog.findMany({
            where: roleType ? { role_type: roleType } : {},
            orderBy: { changed_at: "desc" },
            take: limit,
            skip: offset,
        })).map((log) => ({ ...log, id: Number(log.id) }));
    }
}
exports.PermissionService = PermissionService;
exports.permissionService = new PermissionService();
