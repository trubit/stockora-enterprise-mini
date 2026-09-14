import mongoose from 'mongoose';

/**
 * Safely converts any input string or ObjectId into a guaranteed valid Mongoose ObjectId.
 * Prevents CastError (400 Bad Request) on non-24-character hex strings like 'default-wh', 'default-company', etc.
 */
export function safeObjectId(
  id?: string | mongoose.Types.ObjectId | null
): mongoose.Types.ObjectId {
  if (!id) return new mongoose.Types.ObjectId();
  if (id instanceof mongoose.Types.ObjectId) return id;
  const str = String(id).trim();
  if (mongoose.Types.ObjectId.isValid(str) && str.length === 24) {
    return new mongoose.Types.ObjectId(str);
  }
  const hex = Buffer.from(str).toString('hex').padEnd(24, '0').slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
}
