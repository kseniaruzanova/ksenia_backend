import mongoose from 'mongoose';

export function isMongoId(id: string): boolean {
    return mongoose.Types.ObjectId.isValid(id)
}
