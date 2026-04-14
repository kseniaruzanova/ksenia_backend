export interface AuthPayload {
  username: string;
  role: "customer";
  customerId: unknown;
  botToken: string;
  tariff: "pro" | "none" | "basic" | "tg_max" | undefined;
}

export interface ClubAuthPayload {
  username: string;
  role: "club_member";
  clubMemberId: unknown;
  botToken: string;
  tariff: "pro" | "none" | "basic" | "tg_max" | undefined;
}
