"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.base32Encode = base32Encode;
exports.base32Decode = base32Decode;
exports.generateBase32Secret = generateBase32Secret;
exports.generateTotpCode = generateTotpCode;
exports.verifyTotpCode = verifyTotpCode;
exports.generateOtpAuthUrl = generateOtpAuthUrl;
const crypto_1 = __importDefault(require("crypto"));
const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
/**
 * Encodes a buffer to Base32 string (RFC 4648)
 */
function base32Encode(buffer) {
    let bits = 0;
    let value = 0;
    let output = "";
    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;
        while (bits >= 5) {
            output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += BASE32_CHARS[(value << (5 - bits)) & 31];
    }
    return output;
}
/**
 * Decodes a Base32 string into a Buffer
 */
function base32Decode(input) {
    const cleanInput = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
    let bits = 0;
    let value = 0;
    const bytes = [];
    for (let i = 0; i < cleanInput.length; i++) {
        const char = cleanInput[i];
        const index = BASE32_CHARS.indexOf(char);
        if (index === -1) {
            continue;
        }
        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
}
/**
 * Generates a random Base32 TOTP secret (20 bytes = 160 bits = 32 Base32 characters)
 */
function generateBase32Secret(byteLength = 20) {
    const buffer = crypto_1.default.randomBytes(byteLength);
    return base32Encode(buffer);
}
/**
 * Computes 6-digit TOTP code for a specific time step (RFC 6238)
 */
function generateTotpCode(secretBase32, timestampMs = Date.now(), periodSeconds = 30) {
    const key = base32Decode(secretBase32);
    const timeStep = Math.floor(timestampMs / 1000 / periodSeconds);
    const counterBuffer = Buffer.alloc(8);
    // Write counter as 64-bit big-endian integer
    counterBuffer.writeBigInt64BE(BigInt(timeStep), 0);
    const hmac = crypto_1.default.createHmac("sha1", key);
    hmac.update(counterBuffer);
    const digest = hmac.digest();
    // Dynamic truncation (RFC 4226)
    const offset = digest[digest.length - 1] & 0x0f;
    const binary = ((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff);
    const otp = binary % 1000000;
    return otp.toString().padStart(6, "0");
}
/**
 * Verifies a 6-digit TOTP code with time drift window (default ±1 step = ±30s)
 */
function verifyTotpCode(code, secretBase32, windowSteps = 1, periodSeconds = 30) {
    if (!code || code.trim().length !== 6 || !/^\d{6}$/.test(code.trim())) {
        return false;
    }
    const cleanCode = code.trim();
    const now = Date.now();
    const stepMs = periodSeconds * 1000;
    for (let offset = -windowSteps; offset <= windowSteps; offset++) {
        const checkTime = now + offset * stepMs;
        const expected = generateTotpCode(secretBase32, checkTime, periodSeconds);
        if (crypto_1.default.timingSafeEqual(Buffer.from(cleanCode), Buffer.from(expected))) {
            return true;
        }
    }
    return false;
}
/**
 * Generates the standard `otpauth://totp/...` URI for authenticator apps
 */
function generateOtpAuthUrl(issuer, accountName, secretBase32) {
    const encIssuer = encodeURIComponent(issuer);
    const encAccount = encodeURIComponent(accountName);
    return `otpauth://totp/${encIssuer}:${encAccount}?secret=${secretBase32}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
}
