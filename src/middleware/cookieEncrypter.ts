import * as crypto from 'crypto';
import base64url from 'base64url';
import { InvalidRequestException, UnhandledException } from './exceptions';

const VERSION_SIZE = 1;
const GCM_IV_SIZE = 12;
const GCM_TAG_SIZE = 16;
const CURRENT_VERSION = 1;

export const encryptCookie = (
  encryptionKey: string,
  plaintext: string,
): string => {
  const ivBytes = crypto.randomBytes(GCM_IV_SIZE);
  const encKeyBytes = Buffer.from(encryptionKey, 'hex');

  try {
    const cipher = crypto.createCipheriv('aes-256-gcm', encKeyBytes, ivBytes);

    const encryptedBytes = cipher.update(plaintext);
    const finalBytes = cipher.final();

    const versionBytes = Buffer.from(new Uint8Array([CURRENT_VERSION]));
    const ciphertextBytes = Buffer.concat([encryptedBytes, finalBytes]);
    const tagBytes = cipher.getAuthTag();

    const allBytes = Buffer.concat([
      versionBytes,
      ivBytes,
      ciphertextBytes,
      tagBytes,
    ]);

    return base64url.encode(allBytes);
  } catch (e: any) {
    console.log(`Failed to encrypt plaintext value: ${e}`);
    throw UnhandledException(
      'Failed to encrypt plaintext value',
      e,
      `Failed to encrypt plaintext value with error: ${e}`,
    );
  }
};

export const decryptCookie = (
  encryptionKey: string,
  encryptedbase64value: string,
) => {
  const allBytes = base64url.toBuffer(encryptedbase64value);

  const minSize = VERSION_SIZE + GCM_IV_SIZE + 1 + GCM_TAG_SIZE;
  if (allBytes.length < minSize) {
    throw InvalidRequestException('The received cookie has an invalid length');
  }

  const version = allBytes[0];
  if (version != CURRENT_VERSION) {
    throw InvalidRequestException('The received cookie has an invalid format');
  }

  let offset = VERSION_SIZE;
  const ivBytes = allBytes.subarray(offset, offset + GCM_IV_SIZE);

  offset += GCM_IV_SIZE;
  const ciphertextBytes = allBytes.subarray(
    offset,
    allBytes.length - GCM_TAG_SIZE,
  );

  offset = allBytes.length - GCM_TAG_SIZE;
  const tagBytes = allBytes.subarray(offset, allBytes.length);

  try {
    const encKeyBytes = Buffer.from(encryptionKey, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      encKeyBytes,
      ivBytes,
    );
    decipher.setAuthTag(tagBytes);

    const decryptedBytes = decipher.update(ciphertextBytes);
    const finalBytes = decipher.final();

    const plaintextBytes = Buffer.concat([decryptedBytes, finalBytes]);
    return plaintextBytes.toString();
  } catch (e: any) {
    throw UnhandledException(undefined, e);
  }
};
