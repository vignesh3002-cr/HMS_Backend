import { Request, Response, NextFunction } from "express";
import { IntegrationService } from "./integration.service";
import {
  CreateIntegrationProviderInput,
  UpdateIntegrationProviderInput,
  UpdateUserIntegrationSettingsInput,
  ProviderType,
} from "./integration.types";

const service = new IntegrationService();

function getUserId(req: Request): string | undefined {
  return (req as any).user?.user_id || (req as any).user?.employee_id;
}

export class IntegrationController {
  async getProviders(req: Request, res: Response, next: NextFunction) {
    try {
      const rawBranch = req.query.branch_id;
      const branchId = typeof rawBranch === "string" ? rawBranch : Array.isArray(rawBranch) ? String(rawBranch[0]) : undefined;
      const providers = await service.getProviders(branchId);
      res.json({ data: providers });
    } catch (err) {
      next(err);
    }
  }

  async getProviderByType(req: Request, res: Response, next: NextFunction) {
    try {
      const type = String(req.params.type);
      const rawBranch = req.query.branch_id;
      const branchId = typeof rawBranch === "string" ? rawBranch : Array.isArray(rawBranch) ? String(rawBranch[0]) : undefined;
      const provider = await service.getProviderByType(type as ProviderType, branchId);
      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }
      res.json({ data: provider });
    } catch (err) {
      next(err);
    }
  }

  async getProviderById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const provider = await service.getProviderById(id);
      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }
      res.json({ data: provider });
    } catch (err) {
      next(err);
    }
  }

  async createProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const data: CreateIntegrationProviderInput = req.body;
      data.created_by = getUserId(req);
      const provider = await service.createProvider(data);
      res.status(201).json({ data: provider });
    } catch (err) {
      next(err);
    }
  }

  async updateProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const data: UpdateIntegrationProviderInput = req.body;
      data.updated_by = getUserId(req);
      const provider = await service.updateProvider(id, data);
      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }
      res.json({ data: provider });
    } catch (err) {
      next(err);
    }
  }

  async deleteProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const deleted = await service.deleteProvider(id);
      if (!deleted) {
        return res.status(404).json({ message: "Provider not found" });
      }
      res.json({ message: "Provider deleted successfully" });
    } catch (err) {
      next(err);
    }
  }

  async getUserSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const settings = await service.getUserSettings(userId);
      res.json({ data: settings });
    } catch (err) {
      next(err);
    }
  }

  async updateUserSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const data: UpdateUserIntegrationSettingsInput = req.body;
      const updatedBy = getUserId(req);
      const settings = await service.updateUserSettings(userId, data, updatedBy);
      res.json({ data: settings });
    } catch (err) {
      next(err);
    }
  }

  async getProviderConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const type = String(req.params.type);
      const rawBranch = req.query.branch_id;
      const branchId = typeof rawBranch === "string" ? rawBranch : Array.isArray(rawBranch) ? String(rawBranch[0]) : undefined;
      const config = await service.getProviderConfig(type as ProviderType, branchId);
      if (!config) {
        return res.status(404).json({ message: "Provider configuration not found" });
      }
      res.json({ data: config });
    } catch (err) {
      next(err);
    }
  }
}