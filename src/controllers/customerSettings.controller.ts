import { RequestHandler } from 'express';
import Customer from '../models/customer.model';

export const getCustomerSettings: RequestHandler<{ id: string }> = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            res.status(404).json({ message: 'Customer not found' });
            return;
        }

        const settings = {
            currentPrice: customer.currentPrice,
            basePrice: customer.basePrice,
            cardNumber: customer.cardNumber,
            cardHolderName: customer.cardHolderName,
            otherCountries: customer.otherCountries,
            sendTo: customer.sendTo,
        };

        res.status(200).json(settings);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateCustomerSettings: RequestHandler<{ id: string }> = async (req, res) => {
    try {
        const { id } = req.params;
        const settingsToUpdate = req.body;

        const updatedCustomer = await Customer.findByIdAndUpdate(
            id,
            { $set: settingsToUpdate },
            { new: true, runValidators: true }
        );

        if (!updatedCustomer) {
            res.status(404).json({ message: 'Customer not found' });
            return;
        }
        
        const settings = {
            currentPrice: updatedCustomer.currentPrice,
            basePrice: updatedCustomer.basePrice,
            cardNumber: updatedCustomer.cardNumber,
            cardHolderName: updatedCustomer.cardHolderName,
            otherCountries: updatedCustomer.otherCountries,
            sendTo: updatedCustomer.sendTo,
        };

        res.status(200).json(settings);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
}; 