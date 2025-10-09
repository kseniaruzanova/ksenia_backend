import path from "path";
import fs from "fs";

export function getMessageType(message: any): string {
    if (message.text) return 'text';
    if (message.photo) return 'photo';
    if (message.document) return 'document';
    if (message.video) return 'video';
    if (message.audio) return 'audio';
    if (message.voice) return 'voice';
    if (message.video_note) return 'video_note';
    if (message.sticker) return 'sticker';
    if (message.animation) return 'animation';
    if (message.location) return 'location';
    if (message.contact) return 'contact';
    if (message.poll) return 'poll';
    if (message.dice) return 'dice';
    return 'unknown';
}

export function readSystemPromptFromFile(filePath: string): string {
try {
    const absolutePath = path.resolve(__dirname, filePath);
    return fs.readFileSync(absolutePath, 'utf-8');
} catch (err) {
    console.error('Ошибка чтения файла systemPrompt:', err);
    return '';
}
}
