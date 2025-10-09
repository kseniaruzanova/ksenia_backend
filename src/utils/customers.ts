import { randomBytes } from "crypto";
import { AuthRequest } from "../interfaces/authRequest";

export function generatePassword(length: number = 8): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

export const getCustomerId = (req: AuthRequest) => {
  const { user } = req;

  if (user?.role === 'admin') {
    return 'admin';
  }
  if (user?.role !== 'customer' || !user.customerId) {
    return null;
  }

  return user.customerId;
};
