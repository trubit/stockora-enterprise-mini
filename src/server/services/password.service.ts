import bcrypt from 'bcryptjs';

export class PasswordService {
  private static readonly BCRYPT_REGEX = /^\$2[abxy]?\$\d{1,2}\$[./A-Za-z0-9]{53}$/;
  private static readonly SALT_ROUNDS = 10;

  /**
   * Checks whether a given string is already a valid bcrypt hash
   */
  public static isBcryptHash(str: string): boolean {
    if (!str || typeof str !== 'string') return false;
    return this.BCRYPT_REGEX.test(str.trim());
  }

  /**
   * Hashes a plaintext password using bcrypt with 10 salt rounds.
   * If the string is already a valid bcrypt hash, returns it untouched to prevent double-hashing.
   */
  public static async hashPassword(password: string): Promise<string> {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string.');
    }
    const trimmed = password.trim();
    if (this.isBcryptHash(trimmed)) {
      return trimmed;
    }
    const salt = await bcrypt.genSalt(this.SALT_ROUNDS);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compares a plaintext password against a stored bcrypt hash.
   * Returns false safely if either input is missing or empty.
   */
  public static async comparePassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash || typeof password !== 'string' || typeof hash !== 'string') {
      return false;
    }
    try {
      return await bcrypt.compare(password, hash);
    } catch {
      return false;
    }
  }

  /**
   * Validates minimum password strength policy:
   * 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special character
   */
  public static validateStrength(password: string): boolean {
    if (!password || typeof password !== 'string') return false;
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
  }
}
