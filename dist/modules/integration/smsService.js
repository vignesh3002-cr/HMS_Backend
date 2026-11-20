"use strict";
// TextBee SMS gateway client.
//
// Everything that identifies a send (device, recipients, body, credentials)
// is passed in by the caller so the same helper serves the Settings ->
// Integration "test" button and the real 2FA delivery path.
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSMS = sendSMS;
const DEFAULT_API_URL = "https://api.textbee.dev/api/v1";
const DEFAULT_API_KEY = "txb_YiixWl0RKgbVn3J7qFp8xRTDWczLP1mA";
function resolveEndpoint(apiUrl) {
    const base = (apiUrl || process.env.TEXTBEE_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
    return base.endsWith("/gateway/send-sms") ? base : `${base}/gateway/send-sms`;
}
async function sendSMS({ deviceId, recipients, message, apiKey, apiUrl, }) {
    if (!deviceId || !String(deviceId).trim()) {
        throw new Error("TextBee device ID is required to send an SMS");
    }
    const recipientArray = (Array.isArray(recipients) ? recipients : [recipients])
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length > 0);
    if (recipientArray.length === 0) {
        throw new Error("At least one SMS recipient is required");
    }
    if (!message || !String(message).trim()) {
        throw new Error("SMS message body is required");
    }
    const key = apiKey || process.env.TEXTBEE_API_KEY || DEFAULT_API_KEY;
    const response = await fetch(resolveEndpoint(apiUrl), {
        method: "POST",
        headers: {
            "x-api-key": key,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            deviceId,
            recipients: recipientArray,
            message,
        }),
    });
    const raw = await response.text();
    let data = {};
    try {
        data = raw ? JSON.parse(raw) : {};
    }
    catch {
        data = { raw };
    }
    if (!response.ok) {
        throw new Error(`TextBee API error (${response.status}): ${raw || response.statusText}`);
    }
    return data;
}
