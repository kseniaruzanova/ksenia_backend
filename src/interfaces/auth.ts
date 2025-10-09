export interface AuthPayload {
  username: string;
  role: 'customer',
  customerId: unknown;
  botToken: string;
  tariff: "pro" | "none" | "basic" | undefined;
};
