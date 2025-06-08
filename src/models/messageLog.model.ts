import { Schema, model, Document } from 'mongoose';

export interface IMessageLog extends Document {
    chat_id: string;
    message: string;
    status: 'sent' | 'failed';
    error?: string;
    createdAt: Date;
}

const messageLogSchema = new Schema<IMessageLog>({
    chat_id: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, required: true, enum: ['sent', 'failed'] },
    error: { type: String },
}, {
    timestamps: true,
});

const MessageLog = model<IMessageLog>('MessageLog', messageLogSchema);

export default MessageLog; 