import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

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
    html: `
      <h2>Hospital Management System</h2>
      <p>Your OTP is:</p>
      <h1>${otp}</h1>
      <p>This OTP is valid for 5 minutes.</p>
    `,
  });
};