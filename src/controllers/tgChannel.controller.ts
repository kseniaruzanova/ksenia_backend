import { Response } from "express";
import { AuthRequest } from "../interfaces/authRequest";
import * as tgChannelService from "../services/tgChannel.service";

export const createInviteLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user } = req;
    const payerId = user?.customerId || user?.clubMemberId;
    if (!user || (user.role !== "customer" && user.role !== "club_member") || !payerId) {
      res.status(403).json({ message: "Forbidden: Only customers can create invite link" });
      return;
    }

    const { link } = await tgChannelService.createInviteLink(String(payerId));
    res.status(200).json({ link });
  } catch (error: any) {
    const message = error?.message || "Failed to create invite link";
    const status = message.includes("not set") ? 503 : message.includes("not found") || message.includes("not active") ? 400 : 500;
    res.status(status).json({ message });
  }
};
