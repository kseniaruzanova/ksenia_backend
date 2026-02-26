export interface AuthPayload {
  username: string;
  role: 'customer',
  customerId: unknown;
  botToken: string;
  tariff: "pro" | "none" | "basic" | "tg_max" | undefined;
};
