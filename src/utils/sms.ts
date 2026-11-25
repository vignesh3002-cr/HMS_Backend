/**
 * TextBee SMS Service Integration
 * Gateway: https://api.textbee.dev/api/v1/gateway/send-sms
 */

interface SendSmsOptions {
  recipient: string;
  message: string;
  deviceId?: string;
  simSlotIndex?: number;
}

export const sendSms = async ({
  recipient,
  message,
  deviceId,
  simSlotIndex = 0,
}: SendSmsOptions): Promise<{ success: boolean; data?: any; error?: string }> => {
  const apiKey =
    process.env.TEXTBEE_API_KEY || "txb_YiixWl0RKgbVn3J7qFp8xRTDWczLP1mA";
  const defaultDeviceId =
    process.env.TEXTBEE_DEVICE_ID || "6afd2c135b9635c5ddda253a";

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
  } catch (err: any) {
    console.error(`[TextBee SMS] Error sending SMS:`, err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Sends a standard 6-digit OTP SMS via TextBee
 */
export const sendOtpSms = async (
  phone: string,
  otp: string,
  purpose: string = "verification"
): Promise<{ success: boolean; data?: any; error?: string }> => {
  const message = `Your HMS security code is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`;
  return sendSms({ recipient: phone, message });
};
