export interface PaymentQueryParams {
  page?: string;
  limit?: string;
  filters?: {
    username?: string;
    [key: string]: unknown;
  };
}