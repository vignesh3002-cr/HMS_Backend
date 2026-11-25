import * as nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

export interface SmtpConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  from?: string;
}

const isSmtpConfigured = () =>
  Boolean(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS);

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT) || 587,
      secure: Number(process.env.MAIL_PORT) === 465,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  
  transporter.verify((error, success) => {
    if (error) {         
    console.error("SMTP Verify Error:", error);
   } else 
    {console.log("SMTP Server is ready");

     }
     });}

  return transporter;
};

const otpHtml = (otp: string) => `
      <h2>Hospital Management System</h2>
      <p>Your OTP is:</p>
      <h1>${otp}</h1>
      <p>This OTP is valid for 5 minutes.</p>
    `;

export const sendOtpEmail = async (
  to: string,
  otp: string
) => {
  if (!isSmtpConfigured()) {
    console.warn(
      `[dev] SMTP not configured (set MAIL_HOST/MAIL_USER/MAIL_PASS) - OTP for ${to}: ${otp}`
    );
    return;
  }

  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to,
    subject: "Your Login OTP",
    html: otpHtml(otp),
  });
};

/**
 * Sends an arbitrary email using the MAIL_* environment SMTP settings.
 * Throws (instead of silently logging) when SMTP is not configured or the
 * send fails, so callers can block dependent workflows as needed.
 */
export const sendMail = async (options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}) => {
  if (!isSmtpConfigured()) {
    throw new Error(
      "Email is not configured. Set MAIL_HOST/MAIL_USER/MAIL_PASS or add an EMAIL provider in Settings → Integrations."
    );
  }

  return getTransporter().sendMail({
    from: options.from || process.env.MAIL_FROM || process.env.MAIL_USER,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
};

/**
 * Sends an OTP using the SMTP settings stored in the Settings -> Integration
 * EMAIL provider. Falls back to the MAIL_* environment variables when no
 * provider is configured, and throws (instead of quietly logging) when
 * neither is available so callers can surface a real failure to the user.
 */
export const sendOtpEmailWithConfig = async (
  config: SmtpConfig | null | undefined,
  to: string,
  otp: string
) => {
  if (config?.host && config.auth?.user && config.auth?.pass) {
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port ?? 587,
      secure: config.secure ?? config.port === 465,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
    });

    await transport.sendMail({
      from: config.from || config.auth.user,
      to,
      subject: "Your Login OTP",
      html: otpHtml(otp),
    });
    return;
  }

  if (!isSmtpConfigured()) {
    throw new Error(
      "Email is not configured. Add an EMAIL provider in Settings → Integrations or set MAIL_HOST/MAIL_USER/MAIL_PASS."
    );
  }

  await sendOtpEmail(to, otp);
};
