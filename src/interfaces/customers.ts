export interface CustomerUpdateData {
  botToken?: string;
  currentPrice?: string;
  basePrice?: string;
  cardNumber?: string;
  cardHolderName?: string;
  otherCountries?: string;
  sendTo?: string;
  paymentInstructions?: string;
}

export interface CustomerSettings {
  currentPrice?: number;
  basePrice?: number;
  cardNumber?: string;
  cardHolderName?: string;
  otherCountries?: string;
  sendTo?: string;
};
