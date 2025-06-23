import { Schema, model, Document } from 'mongoose';

export interface ICustomer extends Document {
  username: string;
  password?: string;
  botToken: string;
  currentPrice?: number;
  basePrice?: number;
  cardNumber?: string;
  cardHolderName?: string;
  otherCountries?: string;
  sendTo?: string;
  paymentInstructions?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  botToken: { type: String, required: true },
  currentPrice: { type: Number },
  basePrice: { type: Number },
  cardNumber: { type: String },
  cardHolderName: { type: String },
  otherCountries: { type: String },
  sendTo: { type: String },
  paymentInstructions: { type: String },
}, {
  timestamps: true,
});

// Middleware для отслеживания изменений ботов
customerSchema.post('save', async function(doc: ICustomer) {
  try {
    // Импорт BotManager только при необходимости, чтобы избежать циклических зависимостей
    const { botManager } = await import('../services/botManager.service');
    
    console.log(`📝 Customer saved: ${doc.username}`);
    
    // Уведомляем BotManager о сохранении
    await botManager.handleCustomerChange('save', doc);
  } catch (error) {
    console.error('❌ Error in customer save middleware:', error);
  }
});

customerSchema.post('findOneAndUpdate', async function(doc: ICustomer) {
  try {
    if (doc) {
      const { botManager } = await import('../services/botManager.service');
      
      console.log(`📝 Customer updated: ${doc.username}`);
      
      // Уведомляем BotManager об обновлении
      await botManager.handleCustomerChange('update', doc);
    }
  } catch (error) {
    console.error('❌ Error in customer update middleware:', error);
  }
});

customerSchema.post('findOneAndDelete', async function(doc: ICustomer) {
  try {
    if (doc) {
      const { botManager } = await import('../services/botManager.service');
      
      console.log(`🗑️ Customer deleted: ${doc.username}`);
      
      // Уведомляем BotManager об удалении
      await botManager.handleCustomerChange('delete', doc);
    }
  } catch (error) {
    console.error('❌ Error in customer delete middleware:', error);
  }
});

const Customer = model<ICustomer>('Customer', customerSchema);

export default Customer; 