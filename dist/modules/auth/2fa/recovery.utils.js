"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashRecoveryCode = hashRecoveryCode;
exports.generateRecoveryCodes = generateRecoveryCodes;
exports.verifyAndConsumeRecoveryCode = verifyAndConsumeRecoveryCode;
exports.countUnusedCodes = countUnusedCodes;
const crypto_1 = __importDefault(require("crypto"));
const SAFE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 characters, no 0/O or 1/I
function hashRecoveryCode(code) {
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return crypto_1.default.createHash("sha256").update(normalized).digest("hex");
}
function generateRecoveryCodes(count = 8) {
    const plaintextCodes = [];
    const hashedRecords = [];
    for (let i = 0; i < count; i++) {
        let part1 = "";
        let part2 = "";
        const randomBytes = crypto_1.default.randomBytes(8);
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
function verifyAndConsumeRecoveryCode(inputCode, storedJson) {
    if (!inputCode || !storedJson) {
        return { valid: false, updatedJson: null, remainingCount: 0 };
    }
    let records = [];
    try {
        records = JSON.parse(storedJson);
    }
    catch {
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
function countUnusedCodes(storedJson) {
    if (!storedJson)
        return 0;
    try {
        const records = JSON.parse(storedJson);
        return records.filter((r) => !r.used).length;
    }
    catch {
        return 0;
    }
}
