import { Schema, model, Document } from 'mongoose';

export interface IProductRequest extends Document {
  productType: 'archetypeShadow' | 'archetypeMonth' | 'forecast' | 'financialCast' | 'mistakesIncarnation' | 'arcanumRealization' | 'awakeningCodes' | 'matrixLife' | 'lifeMatrix' | 'karmicTail' | 'stagnationCycle' | 'moneyMandala';
  customerId: Schema.Types.ObjectId;
  birthDate: string;
  requestType: 'pdf' | 'json';
  createdAt: Date;
  updatedAt: Date;
}

const productRequestSchema = new Schema<IProductRequest>({
  productType: { 
    type: String, 
    required: true,
    enum: ['archetypeShadow', 'archetypeMonth', 'forecast', 'financialCast', 'mistakesIncarnation', 'arcanumRealization', 'awakeningCodes', 'matrixLife', 'lifeMatrix', 'karmicTail', 'stagnationCycle', 'moneyMandala'],
    index: true
  },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  birthDate: { type: String, required: true },
  requestType: { type: String, enum: ['pdf', 'json'], required: true },
}, {
  timestamps: true,
  collection: 'ProductRequests'
});

// Индексы для быстрой статистики
productRequestSchema.index({ productType: 1, createdAt: -1 });
productRequestSchema.index({ customerId: 1, createdAt: -1 });

const ProductRequest = model<IProductRequest>('ProductRequest', productRequestSchema);

export default ProductRequest;

