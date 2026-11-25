import crypto from "crypto";

const SAFE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 characters, no 0/O or 1/I

export interface RecoveryCodeRecord {
  hash: string;
  used: boolean;
  used_at: string | null;
}

export function hashRecoveryCode(code: string): string {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function generateRecoveryCodes(count: number = 8): {
  plaintextCodes: string[];
  hashedRecords: RecoveryCodeRecord[];
} {
  const plaintextCodes: string[] = [];
  const hashedRecords: RecoveryCodeRecord[] = [];

  for (let i = 0; i < count; i++) {
    let part1 = "";
    let part2 = "";
    const randomBytes = crypto.randomBytes(8);

    for (let j = 0; j < 4; j++) {
      part1 += SAFE_CHARS[randomBytes[j] % SAFE_CHARS.length];
      part2 += SAFE_CHARS[randomBytes[j + 4] % SAFE_CHARS.length];
    }

    const code = `${part1}-${part2}`;
    plaintextCodes.push(code);
    hashedRecords.push({
      hash: hashRecoveryCode(code),
      used: false,
      used_at: null,
    });
  }

  return { plaintextCodes, hashedRecords };
}

export function verifyAndConsumeRecoveryCode(
  inputCode: string,
  storedJson: string | null | undefined
): { valid: boolean; updatedJson: string | null; remainingCount: number } {
  if (!inputCode || !storedJson) {
    return { valid: false, updatedJson: null, remainingCount: 0 };
  }

  let records: RecoveryCodeRecord[] = [];
  try {
    records = JSON.parse(storedJson);
  } catch {
    return { valid: false, updatedJson: null, remainingCount: 0 };
  }

  const inputHash = hashRecoveryCode(inputCode);
  let matchedIndex = -1;

  for (let i = 0; i < records.length; i++) {
    if (!records[i].used && records[i].hash === inputHash) {
      matchedIndex = i;
      break;
    }
  }

  if (matchedIndex === -1) {
    const remaining = records.filter((r) => !r.used).length;
    return { valid: false, updatedJson: storedJson, remainingCount: remaining };
  }

  records[matchedIndex].used = true;
  records[matchedIndex].used_at = new Date().toISOString();

  const remainingCount = records.filter((r) => !r.used).length;
  return {
    valid: true,
    updatedJson: JSON.stringify(records),
    remainingCount,
  };
}

export function countUnusedCodes(storedJson: string | null | undefined): number {
  if (!storedJson) return 0;
  try {
    const records: RecoveryCodeRecord[] = JSON.parse(storedJson);
    return records.filter((r) => !r.used).length;
  } catch {
    return 0;
  }
}
