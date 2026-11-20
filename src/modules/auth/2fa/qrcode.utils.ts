import QRCode from "qrcode";

/**
 * Generates an in-memory SVG string of the QR Code (zero external network requests)
 */
export async function generateQrCodeSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
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
export async function generateQrCodeDataUrl(text: string): Promise<string> {
  const svg = await generateQrCodeSvg(text);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
