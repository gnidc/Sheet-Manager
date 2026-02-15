/**
 * AES-256-GCM 기반 암호화/복호화 유틸리티
 * DB에 저장되는 민감한 데이터(API 키, 시크릿 등)를 암호화합니다.
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM 권장 IV 길이
const TAG_LENGTH = 16; // GCM 인증 태그 길이
const SALT_LENGTH = 16;

/**
 * 암호화 키를 가져옵니다.
 * 환경변수 ENCRYPTION_KEY가 있으면 사용하고, 없으면 SESSION_SECRET에서 파생합니다.
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    // 환경변수에 직접 32바이트(64자 hex) 키가 설정된 경우
    if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
      return Buffer.from(envKey, "hex");
    }
    // 다른 형식이면 PBKDF2로 파생
    return crypto.pbkdf2Sync(envKey, "sheet-manager-salt", 100000, 32, "sha256");
  }
  // ENCRYPTION_KEY가 없으면 SESSION_SECRET에서 파생
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD_HASH || "default-fallback-key";
  return crypto.pbkdf2Sync(secret, "sheet-manager-encryption", 100000, 32, "sha256");
}

/**
 * 문자열을 AES-256-GCM으로 암호화합니다.
 * 반환 형식: "enc:v1:{iv_hex}:{tag_hex}:{ciphertext_hex}"
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  
  return `enc:v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

/**
 * 암호화된 문자열을 복호화합니다.
 * 암호화되지 않은 평문도 그대로 반환합니다 (하위 호환).
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return ciphertext;
  
  // 암호화되지 않은 기존 데이터는 그대로 반환 (하위 호환)
  if (!ciphertext.startsWith("enc:v1:")) {
    return ciphertext;
  }
  
  try {
    const parts = ciphertext.split(":");
    // "enc" : "v1" : iv : tag : encrypted
    if (parts.length !== 5) return ciphertext;
    
    const iv = Buffer.from(parts[2], "hex");
    const tag = Buffer.from(parts[3], "hex");
    const encrypted = parts[4];
    
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("[Encryption] 복호화 실패 - 키가 변경되었거나 데이터가 손상되었을 수 있습니다:", (error as any).message);
    // 복호화 실패 시 원본 반환 (이전 키로 암호화된 데이터)
    return ciphertext;
  }
}

/**
 * 문자열이 암호화된 형식인지 확인합니다.
 */
export function isEncrypted(value: string): boolean {
  return !!value && value.startsWith("enc:v1:");
}

/**
 * API 키를 마스킹합니다 (UI 표시용).
 * 암호화된 키는 먼저 복호화 후 마스킹합니다.
 */
export function maskApiKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const plainKey = decrypt(key);
  if (plainKey.length <= 8) return "••••••••";
  return plainKey.slice(0, 8) + "••••••••";
}

