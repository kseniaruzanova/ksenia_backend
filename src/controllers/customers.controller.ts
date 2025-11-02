import { Request, Response } from "express";

import Customer from "../models/customer.model";

import { generatePassword } from "../utils/customers";
import { AuthRequest } from "../interfaces/authRequest";
import { CustomerUpdateData, CustomerCreateData } from "../interfaces/customers";
import { Types } from "mongoose";

export const createCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, botToken, tariff, subscriptionStatus }: CustomerCreateData = req.body;
    if (!username || !botToken) {
      res.status(400).json({ message: "Username and botToken are required" });
      return;
    }

    // Валидация tariff если передан
    if (tariff && !['none', 'basic', 'pro'].includes(tariff)) {
      res.status(400).json({ message: "Invalid tariff. Must be 'none', 'basic', or 'pro'" });
      return;
    }

    // Валидация subscriptionStatus если передан
    if (subscriptionStatus && !['active', 'inactive', 'expired'].includes(subscriptionStatus)) {
      res.status(400).json({ message: "Invalid subscriptionStatus. Must be 'active', 'inactive', or 'expired'" });
      return;
    }

    const existingCustomer = await Customer.findOne({ username });
    if (existingCustomer) {
      res.status(409).json({ message: "Customer with this username already exists" });
      return;
    }

    const password: string = generatePassword();
    
    // Установка подписки
    const subscriptionEndsAt = new Date();
    subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);
    
    const newCustomer = new Customer({
      username,
      botToken,
      password,
      tariff: tariff || 'none',
      subscriptionStatus: subscriptionStatus || 'inactive',
      subscriptionEndsAt: subscriptionStatus === 'active' ? subscriptionEndsAt : null
    });

    await newCustomer.save();

    res.status(201).json({
      message: "Customer created successfully",
      customer: {
        _id: newCustomer._id,
        username: newCustomer.username,
        botToken: newCustomer.botToken,
        password: password,
        tariff: newCustomer.tariff,
        subscriptionStatus: newCustomer.subscriptionStatus,
        subscriptionEndsAt: newCustomer.subscriptionEndsAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error creating customer", error });
  }
};

export const getCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const customers = await Customer.find().select("-password");
    
    res.status(200).json(customers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching customers", error });
  }
};

export const deleteCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) {
      res.status(404).json({ message: "Customer not found" });
      return;
    }

    res.status(200).json({ message: "Customer deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting customer", error });
  }
};

export const getMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user } = req;
    
    if (!user || user.role !== "customer" || !user.customerId) {
      res.status(403).json({ message: "Forbidden: Only customers can access their profile" });
      return;
    }

    const customer = await Customer.findById(user.customerId).select("-password");
    
    if (!customer) {
      res.status(404).json({ message: "Customer profile not found" });
      return;
    }

    res.status(200).json({
      message: "Customer profile data",
      profile: {
        _id: customer._id,
        username: customer.username,
        botToken: customer.botToken,
        currentPrice: customer.currentPrice,
        basePrice: customer.basePrice,
        cardNumber: customer.cardNumber,
        cardHolderName: customer.cardHolderName,
        otherCountries: customer.otherCountries,
        sendTo: customer.sendTo,
        paymentInstructions: customer.paymentInstructions,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt
      },
      tokenData: {
        customerId: user.customerId,
        username: user.username,
        botToken: user.botToken
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching profile", error });
  }
};

export const updateMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user } = req;
    
    if (!user || user.role !== "customer" || !user.customerId) {
      res.status(403).json({ message: "Forbidden: Only customers can update their profile" });
      return;
    }

    const allowedFields: (keyof CustomerUpdateData)[] = [
      "botToken", "currentPrice", "basePrice", "cardNumber", 
      "cardHolderName", "otherCountries", "sendTo", "paymentInstructions"
    ];

    const updateData: CustomerUpdateData = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ message: "No valid fields to update" });
      return;
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      user.customerId,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedCustomer) {
      res.status(404).json({ message: "Customer not found" });
      return;
    }

    res.status(200).json({
      message: "Profile updated successfully",
      profile: updatedCustomer,
      updatedFields: Object.keys(updateData)
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating profile", error });
  }
};

export const getCustomerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      res.status(400).json({ message: 'customerId is required' });
      return;
    }

    if (!Types.ObjectId.isValid(customerId)) {
      res.status(400).json({ message: 'Invalid customerId format' });
      return;
    }

    // Получаем данные кастомера из базы (без пароля)
    const customer = await Customer.findById(customerId).select('-password');
    
    if (!customer) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Customer data retrieved successfully',
      customer: {
        _id: customer.id,
        username: customer.username,
        botToken: customer.botToken,
        currentPrice: customer.currentPrice,
        basePrice: customer.basePrice,
        cardNumber: customer.cardNumber,
        cardHolderName: customer.cardHolderName,
        otherCountries: customer.otherCountries,
        sendTo: customer.sendTo,
        paymentInstructions: customer.paymentInstructions,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt
      }
    });
  } catch (error) {
    console.error('Error getting customer by ID for n8n:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching customer data', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// @TODO
// export const updateCustomerSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const { id } = req.params; // ID кастомера
//     const { status, endsAt, tariff } = req.body; // "active", "inactive", "expired"

//     if (!status || !["active", "inactive", "expired"].includes(status)) {
//       res.status(400).json({ message: "Valid status is required: active, inactive, or expired." });
//       return;
//     }

//     const { botManager } = await import("../services/botManager.service");
//     const result = await botManager.updateSubscription(id, status, endsAt ? new Date(endsAt) : undefined);

//     if (!result.success || !result.customer) {
//       res.status(404).json({ message: result.message || "Customer not found." });
//       return;
//     }
   
//     const customerToUpdate = result.customer;

//     // Дополнительно обновим тариф, если он передан
//     if (tariff && ["basic", "pro"].includes(tariff)) {
//       customerToUpdate.tariff = tariff;
//       await customerToUpdate.save();
//     }

//     res.json({
//       message: `Subscription for customer ${customerToUpdate.username} updated successfully.`,
//       customer: customerToUpdate
//     });
//   } catch (error) {
//     console.error("Error updating subscription:", error);
//     res.status(500).json({ message: "Error updating subscription", error });
//   }
// };
