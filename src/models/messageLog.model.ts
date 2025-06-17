import { Schema, model, Document } from 'mongoose';

export interface IMessageLog extends Document {
    chat_id: string;
    message: string;
    status: 'sent' | 'failed';
    error?: string;
    customerId: Schema.Types.ObjectId;
    createdAt: Date;
}

const messageLogSchema = new Schema<IMessageLog>({
    chat_id: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, required: true, enum: ['sent', 'failed'] },
    error: { type: String },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
}, {
    timestamps: true,
});

const MessageLog = model<IMessageLog>('MessageLog', messageLogSchema);

export default MessageLog; 