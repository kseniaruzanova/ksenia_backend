import { Telegraf } from "telegraf";

export interface BotInstance {
  bot: Telegraf;
  customerId: string;
  username: string;
  token: string;
  status: 'active' | 'inactive' | 'error';
  lastUpdated: Date;
  isListening: boolean;
}
