"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQrCodeSvg = generateQrCodeSvg;
exports.generateQrCodeDataUrl = generateQrCodeDataUrl;
const qrcode_1 = __importDefault(require("qrcode"));
/**
 * Generates an in-memory SVG string of the QR Code (zero external network requests)
 */
async function generateQrCodeSvg(text) {
    return qrcode_1.default.toString(text, {
        type: "svg",
        margin: 2,
        color: {
            dark: "#0F172A", // Slate 900
            light: "#FFFFFF",
        },
        errorCorrectionLevel: "M",
    });
}
/**
 * Generates an in-memory Data URL (data:image/svg+xml;utf8,...) for directly embedding in <img src="..." />
 */
async function generateQrCodeDataUrl(text) {
    const svg = await generateQrCodeSvg(text);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
