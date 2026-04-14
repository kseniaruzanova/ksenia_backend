import Customer from "../models/customer.model";
import ClubMember from "../models/clubMember.model";
import type { ICustomer } from "../models/customer.model";
import type { IClubMember } from "../models/clubMember.model";

export type SubscriptionPayerDoc = ICustomer | IClubMember;

export async function findPayerById(id: string): Promise<SubscriptionPayerDoc | null> {
  const customer = await Customer.findById(id);
  if (customer) return customer;
  return ClubMember.findById(id);
}

type SubscriptionSet = {
  tariff?: "basic" | "pro" | "tg_max";
  subscriptionStatus?: "active" | "inactive" | "expired";
  subscriptionEndsAt?: Date | null;
};

export async function updatePayerSubscription(
  id: string,
  $set: SubscriptionSet
): Promise<SubscriptionPayerDoc | null> {
  const customer = await Customer.findByIdAndUpdate(id, { $set }, { new: true });
  if (customer) return customer;
  return ClubMember.findByIdAndUpdate(id, { $set }, { new: true });
}
