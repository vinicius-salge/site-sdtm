import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 16;

export async function deriveKey(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, 'sha256', (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

export async function encryptPDF(pdfBuffer, password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = await deriveKey(password, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(pdfBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  secureWipe(key);

  return {
    encryptedBlob: encrypted,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

export async function decryptPDF(encryptedBlob, password, salt, iv, authTag) {
  const key = await deriveKey(password, Buffer.from(salt, 'hex'));

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    const decrypted = Buffer.concat([decipher.update(encryptedBlob), decipher.final()]);
    secureWipe(key);
    return decrypted;
  } catch (err) {
    secureWipe(key);
    throw new Error('Falha na descriptografia: senha incorreta ou dados corrompidos');
  }
}

export async function encryptData(dataObject, password) {
  const jsonString = JSON.stringify(dataObject);
  const buffer = Buffer.from(jsonString, 'utf-8');
  const result = await encryptPDF(buffer, password);
  secureWipe(buffer);
  return result;
}

export async function decryptData(encryptedBlob, password, salt, iv, authTag) {
  const buffer = await decryptPDF(encryptedBlob, password, salt, iv, authTag);
  const jsonString = buffer.toString('utf-8');
  secureWipe(buffer);
  return JSON.parse(jsonString);
}

export function generateHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function secureWipe(buffer) {
  if (Buffer.isBuffer(buffer)) {
    crypto.randomFillSync(buffer);
    buffer.fill(0);
  }
}
