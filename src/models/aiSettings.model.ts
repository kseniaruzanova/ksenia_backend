import { Schema, model, Document } from "mongoose";

export interface IAISettings extends Document {
  // VseGPT Settings
  vsegptApiKey: string;
  
  // OpenAI Settings
  openaiApiKey?: string;
  
  // Proxy Settings
  proxyEnabled?: boolean;
  proxyType?: 'SOCKS5' | 'HTTP' | 'HTTPS';
  proxyIp?: string;
  proxyPort?: number;
  proxyUsername?: string;
  proxyPassword?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const aiSettingsSchema = new Schema<IAISettings>({
  // VseGPT Settings
  vsegptApiKey: { type: String, required: true },
  
  // OpenAI Settings
  openaiApiKey: { type: String },
  
  // Proxy Settings
  proxyEnabled: { type: Boolean, default: false },
  proxyType: { type: String, enum: ['SOCKS5', 'HTTP', 'HTTPS'], default: 'SOCKS5' },
  proxyIp: { type: String },
  proxyPort: { type: Number },
  proxyUsername: { type: String },
  proxyPassword: { type: String },
}, {
  timestamps: true,
});

const AISettings = model<IAISettings>('AISettings', aiSettingsSchema);

export default AISettings;

