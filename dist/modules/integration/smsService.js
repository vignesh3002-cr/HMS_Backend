"use strict";
// TextBee SMS gateway client.
//
// Everything that identifies a send (device, recipients, body, credentials)
// is passed in by the caller so the same helper serves the Settings ->
// Integration "test" button and the real 2FA delivery path.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSmsGatewayHealth = getSmsGatewayHealth;
exports.verifySmsDelivery = verifySmsDelivery;
exports.sendSMS = sendSMS;
const DEFAULT_API_URL = "https://api.textbee.dev/api/v1";
const DEFAULT_API_KEY = "txb_YiixWl0RKgbVn3J7qFp8xRTDWczLP1mA";
/** Statuses that mean the phone has not confirmed delivery yet. */
const PENDING_STATUSES = new Set([
    "dispatched",
    "pending",
    "queued",
    "scheduled",
    "sending",
]);
/**
 * A failing gateway only blocks new sends while its last attempt is this
 * fresh. Older failures degrade to a warning so a fixed phone can recover
 * without the user having to wait for a cooldown.
 */
const BLOCK_WINDOW_MS = 3 * 60 * 1000;
function resolveBaseUrl(apiUrl) {
    return (apiUrl || process.env.TEXTBEE_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
}
function resolveApiKey(apiKey) {
    return apiKey || process.env.TEXTBEE_API_KEY || DEFAULT_API_KEY;
}
function resolveEndpoint(apiUrl) {
    const base = resolveBaseUrl(apiUrl);
    return base.endsWith("/gateway/send-sms") ? base : `${base}/gateway/send-sms`;
}
function onlyDigits(value) {
    return String(value ?? "").replace(/\D+/g, "");
}
async function fetchRecentMessages(deviceId, apiKey, apiUrl) {
    const response = await fetch(`${resolveBaseUrl(apiUrl)}/gateway/messages?limit=20`, {
        method: "GET",
        headers: { "x-api-key": resolveApiKey(apiKey) },
    });
    if (!response.ok) {
        throw new Error(`TextBee messages API error (${response.status})`);
    }
    const body = (await response.json());
    return (body.data ?? []).filter((message) => !message.device?._id || message.device?._id === deviceId);
}
function toGatewayMessage(message) {
    return {
        recipient: String(message.recipient ?? ""),
        status: String(message.status ?? "unknown"),
        error: message.errorMessage || message.errorName || undefined,
        requestedAt: String(message.requestedAt ?? ""),
    };
}
/**
 * Looks at the most recent messages for this device. If none of the last
 * three reached the carrier, the gateway is unhealthy: a very recent failure
 * blocks the send (hard error), an older one only flags `recentFailure` so the
 * caller can warn the user instead of claiming delivery.
 */
async function getSmsGatewayHealth(options) {
    const { deviceId, apiKey, apiUrl } = options;
    let messages;
    try {
        messages = await fetchRecentMessages(deviceId, apiKey, apiUrl);
    }
    catch (err) {
        // A read failure must never block sending; just skip the preflight.
        return {
            healthy: true,
            recentFailure: false,
            reason: `Could not read gateway history: ${err.message}`,
            checkedMessages: [],
        };
    }
    const checkedMessages = messages.slice(0, 3).map(toGatewayMessage);
    if (checkedMessages.length === 0) {
        return { healthy: true, recentFailure: false, checkedMessages };
    }
    const reachedCarrier = checkedMessages.some((message) => !PENDING_STATUSES.has(message.status) && message.status !== "failed");
    if (reachedCarrier) {
        return { healthy: true, recentFailure: false, checkedMessages };
    }
    const failed = checkedMessages.find((message) => message.status === "failed");
    const reason = failed?.error ||
        (failed
            ? "the sending phone rejected the last messages (radio/SIM error)"
            : "the last messages are still stuck at 'dispatched' — the sending phone is not delivering SMS (app asleep, battery saver, no SMS balance or SIM issue)");
    const newest = checkedMessages[0];
    const newestAge = newest.requestedAt
        ? Date.now() - new Date(newest.requestedAt).getTime()
        : Number.POSITIVE_INFINITY;
    return {
        healthy: newestAge > BLOCK_WINDOW_MS,
        recentFailure: true,
        reason,
        checkedMessages,
    };
}
/**
 * After a send, watch the gateway briefly for an immediate device failure
 * (permission/radio errors surface within seconds) and throw the real reason.
 * Returns "delivered" when the carrier confirmed it, otherwise "unknown" —
 * still queued is not an error because delivery can take a minute.
 */
async function verifySmsDelivery(options) {
    const { deviceId, recipients, message, apiKey, apiUrl, attempts = 3, delayMs = 1500, } = options;
    const targets = (Array.isArray(recipients) ? recipients : [recipients])
        .map(onlyDigits)
        .filter((value) => value.length > 0);
    const wanted = String(message ?? "").trim();
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        let messages;
        try {
            messages = await fetchRecentMessages(deviceId, apiKey, apiUrl);
        }
        catch {
            return "unknown";
        }
        const match = messages.find((candidate) => String(candidate.message ?? "").trim() === wanted &&
            targets.includes(onlyDigits(candidate.recipient)));
        if (!match) {
            continue;
        }
        if (match.status === "failed") {
            throw new Error(`TextBee could not deliver the SMS: ${match.errorMessage || match.errorName || "unknown device error"}`);
        }
        if (match.status === "delivered") {
            return "delivered";
        }
    }
    return "unknown";
}
async function sendSMS({ deviceId, recipients, message, apiKey, apiUrl, simSlotIndex = 0, }) {
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
    const key = resolveApiKey(apiKey);
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
            simSlotIndex,
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
