import { Response, NextFunction } from "express";

import Customer from "../models/customer.model";
import { AuthRequest } from "../interfaces/authRequest";

export const checkSubscription = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (req.user?.role === 'admin') {
    return next();
  }

  if (req.user?.role !== 'customer' || !req.user?.customerId) {
    res.status(403).json({ message: 'Forbidden: Access denied' });
    return;
  }

  try {
    const customer = await Customer.findById(req.user.customerId);

    if (!customer) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }

    const isSubscriptionActive = 
      customer.subscriptionStatus === 'active' &&
      customer.subscriptionEndsAt &&
      customer.subscriptionEndsAt > new Date();

    if (!isSubscriptionActive) {
      res.status(403).json({ 
        message: 'Forbidden: Active subscription required',
        subscriptionStatus: customer.subscriptionStatus,
        subscriptionEndsAt: customer.subscriptionEndsAt
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Error checking subscription:', error);
    res.status(500).json({ message: 'Internal server error while checking subscription' });
  }
};
