import { AuthRepository } from "./auth.repository";
import { comparePassword } from "../../utils/bcrypt";
import { generateToken } from "../../utils/jwt";
import prisma from "../../config/prisma";
import { generateId } from "../../utils/idGenerator";
import { randomInt } from "crypto";
import { sendOtpEmail } from "../../utils/mail";

export class AuthService {

  private authRepository = new AuthRepository();

  async login(username: string, password: string) {

    const user =
      await this.authRepository.findUserByUsername(username);

    if (!user) {
      throw new Error("Invalid username or password");
    }

    if (user.user_status !== 0) {
      throw new Error("Account is inactive");
    }

    const passwordMatched =
      await comparePassword(password, user.password!);

    if (!passwordMatched) {
      throw new Error("Invalid username or password");
    }
    const previousOtp = await prisma.login_otp.findFirst({
  where: {
    user_id: user.user_id!,
    is_verified: true
  },
  orderBy: {
    created_at: "desc"
  }
});

const now = new Date();

const otpRequired =
  !previousOtp ||
  previousOtp.created_at.getTime() + (7 * 24 * 60 * 60 * 1000) < now.getTime();

if (otpRequired) {

  const otp = randomInt(100000, 999999).toString();

  const otpId = await generateId(prisma, "LOGIN_OTP");

  const expiry = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.login_otp.create({
    data: {
      otp_id: otpId,
      user_id: user.user_id!,
      user_type: user.role_type === "PATIENT" ? "PATIENT" : "EMPLOYEE",
      otp_code: otp,
      expires_at: expiry
    }
  });
  let email: string | undefined;

if (user.role_type === "PATIENT") {
  email = user.patient_bio_data?.[0]?.patient_email ?? undefined;
} else {
  email = user.employees?.email ?? undefined;
}

if (!email) {
  throw new Error("Email address not found");
}

await sendOtpEmail(email, otp);

  

  return {
    otp_required: true,
    message: "OTP sent successfully"
  };
}


 const token = generateToken({
  username: user.username,
  role: user.role_type,
  hospital_id: user.branch?.hospital_id,
});

    return {
      token,
      user_details: {
        user_id: user.user_id,
        username: user.username,
        role: user.role_type,
        hospital_id: user.branch?.hospital_id,
      },
      branch: {
        branch_id: user.branch_id,
        branch_name: user.branch?.branch_name,
        branch_area: user.branch?.branch_area,
  }
    };
    
  }
  async verifyOtp(username: string, otp: string) {

  const user = await this.authRepository.findUserByUsername(username);

  if (!user) {
    throw new Error("User not found");
  }

  const otpRecord = await prisma.login_otp.findFirst({
    where: {
      user_id: user.user_id!,
      is_verified: false
    },
    orderBy: {
      created_at: "desc"
    }
  });

  if (!otpRecord) {
    throw new Error("OTP not found");
  }

  if (otpRecord.otp_code !== otp) {
    throw new Error("Invalid OTP");
  }

  if (otpRecord.expires_at < new Date()) {
    throw new Error("OTP has expired");
  }

  await prisma.login_otp.update({
    where: {
      id: otpRecord.id
    },
    data: {
      is_verified: true
    }
  });

  const token = generateToken({
    username: user.username,
    role: user.role_type,
    hospital_id: user.branch?.hospital_id
  });

  return {
    token,
    user_details: {
      user_id: user.user_id,
      username: user.username,
      role: user.role_type,
      hospital_id: user.branch?.hospital_id
    },
    branch: {
      branch_id: user.branch_id,
      branch_name: user.branch?.branch_name,
      branch_area: user.branch?.branch_area
    }
  };

}

}