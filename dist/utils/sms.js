"use strict";
/**
 * TextBee SMS Service Integration
 * Gateway: https://api.textbee.dev/api/v1/gateway/send-sms
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtpSms = exports.sendSms = void 0;
const sendSms = async ({ recipient, message, deviceId, simSlotIndex = 0, }) => {
    const apiKey = process.env.TEXTBEE_API_KEY || "txb_YiixWl0RKgbVn3J7qFp8xRTDWczLP1mA";
    const defaultDeviceId = process.env.TEXTBEE_DEVICE_ID || "6afd2c135b9635c5ddda253a";
    const cleanRecipient = recipient.trim();
    const recipients = [cleanRecipient];
    try {
        const res = await fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                deviceId: deviceId || defaultDeviceId,
                recipients,
                message,
                simSlotIndex,
            }),
        });
        const data = await res.json();
        if (!res.ok) {
            console.warn(`[TextBee SMS] Delivery status: ${res.status}`, data);
            return { success: false, data };
        }
        console.log(`[TextBee SMS] Delivered successfully to ${cleanRecipient}`);
        return { success: true, data };
    }
    catch (err) {
        console.error(`[TextBee SMS] Error sending SMS:`, err.message);
        return { success: false, error: err.message };
    }
};
exports.sendSms = sendSms;
/**
 * Sends a standard 6-digit OTP SMS via TextBee
 */
const sendOtpSms = async (phone, otp, purpose = "verification") => {
    const message = `Your HMS security code is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`;
    return (0, exports.sendSms)({ recipient: phone, message });
};
exports.sendOtpSms = sendOtpSms;
