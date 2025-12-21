import * as crypto from "crypto";
import * as nacl from "tweetnacl";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Logger } from "../utils/Logger";
import {
    EncryptedPersonalInfo,
    EncryptedField,
    PersonalInfo,
    SelectiveDisclosure,
} from "../types";

export class EncryptionService {
    private logger: Logger;
    private readonly ALGORITHM = "aes-256-gcm";
    private readonly KEY_LENGTH = 32; // 256 bits
    private readonly IV_LENGTH = 12; // 96 bits for GCM
    private readonly SALT_LENGTH = 16;
    private readonly ITERATIONS = 100000;

    constructor() {
        this.logger = new Logger("EncryptionService");
    }

    /**
     * Derive master key from wallet signature
     * This is deterministic - same wallet always generates same key
     */
    async deriveMasterKey(wallet: Keypair): Promise<Buffer> {
        try {
            // Sign a deterministic message to get reproducible signature
            const message = Buffer.from("DataSov Master Key Derivation v1.0");
            const signature = nacl.sign.detached(message, wallet.secretKey);

            // Use wallet pubkey as salt (deterministic)
            const salt = Buffer.alloc(this.SALT_LENGTH);
            const pubkeyBytes = wallet.publicKey.toBytes();
            for (let i = 0; i < this.SALT_LENGTH; i++) {
                salt[i] = pubkeyBytes[i % pubkeyBytes.length];
            }

            // Derive key using PBKDF2
            const masterKey = crypto.pbkdf2Sync(
                signature.slice(0, 32),
                salt,
                this.ITERATIONS,
                this.KEY_LENGTH,
                "sha256"
            );

            this.logger.info("Master key derived successfully");
            return masterKey;
        } catch (error) {
            this.logger.error("Failed to derive master key", error);
            throw error;
        }
    }

    /**
     * Encrypt personal information
     * Each field is encrypted separately for selective disclosure
     */
    async encryptPersonalInfo(
        data: PersonalInfo,
        masterKey: Buffer
    ): Promise<EncryptedPersonalInfo> {
        try {
            const encryptedFields: Record<string, EncryptedField> = {};

            for (const [key, value] of Object.entries(data)) {
                if (value !== undefined && value !== null) {
                    encryptedFields[key] = await this.encryptField(
                        value,
                        masterKey
                    );
                }
            }

            const result: EncryptedPersonalInfo = {
                fields: encryptedFields,
                encryptionMetadata: {
                    algorithm: this.ALGORITHM,
                    keyDerivation: "PBKDF2",
                },
            };

            this.logger.info(`Encrypted ${Object.keys(encryptedFields).length} fields`);
            return result;
        } catch (error) {
            this.logger.error("Failed to encrypt personal info", error);
            throw error;
        }
    }

    /**
     * Decrypt personal information
     */
    async decryptPersonalInfo(
        encrypted: EncryptedPersonalInfo,
        masterKey: Buffer
    ): Promise<PersonalInfo> {
        try {
            const decryptedData: Record<string, any> = {};

            for (const [key, encryptedField] of Object.entries(encrypted.fields)) {
                decryptedData[key] = await this.decryptField(
                    encryptedField,
                    masterKey
                );
            }

            this.logger.info(`Decrypted ${Object.keys(decryptedData).length} fields`);
            return decryptedData as PersonalInfo;
        } catch (error) {
            this.logger.error("Failed to decrypt personal info", error);
            throw error;
        }
    }

    /**
     * Encrypt a single field
     */
    async encryptField(value: any, key: Buffer): Promise<EncryptedField> {
        try {
            const iv = crypto.randomBytes(this.IV_LENGTH);
            const plaintext = Buffer.from(JSON.stringify(value), "utf8");

            const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
            const encrypted = Buffer.concat([
                cipher.update(plaintext),
                cipher.final(),
            ]);
            const authTag = cipher.getAuthTag();

            return {
                encrypted: encrypted.toString("base64"),
                iv: iv.toString("base64"),
                authTag: authTag.toString("base64"),
            };
        } catch (error) {
            this.logger.error("Failed to encrypt field", error);
            throw error;
        }
    }

    /**
     * Decrypt a single field
     */
    async decryptField(encryptedField: EncryptedField, key: Buffer): Promise<any> {
        try {
            const iv = Buffer.from(encryptedField.iv, "base64");
            const encrypted = Buffer.from(encryptedField.encrypted, "base64");
            const authTag = Buffer.from(encryptedField.authTag, "base64");

            const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
            decipher.setAuthTag(authTag);

            const decrypted = Buffer.concat([
                decipher.update(encrypted),
                decipher.final(),
            ]);

            return JSON.parse(decrypted.toString("utf8"));
        } catch (error) {
            this.logger.error("Failed to decrypt field", error);
            throw error;
        }
    }

    /**
     * Share specific fields with consumer using ECDH key exchange
     */
    async shareFieldsWithConsumer(
        fields: string[],
        consumerPublicKey: PublicKey,
        ownerKeypair: Keypair,
        encryptedData: EncryptedPersonalInfo,
        ownerMasterKey: Buffer
    ): Promise<SelectiveDisclosure> {
        try {
            // Derive shared key using ECDH
            const sharedKey = await this.deriveSharedKey(
                ownerKeypair,
                consumerPublicKey
            );

            // Re-encrypt only specified fields with shared key
            const sharedFields: Record<string, EncryptedField> = {};

            for (const field of fields) {
                if (encryptedData.fields[field]) {
                    // Decrypt with owner's key
                    const decrypted = await this.decryptField(
                        encryptedData.fields[field],
                        ownerMasterKey
                    );

                    // Re-encrypt with shared key
                    sharedFields[field] = await this.encryptField(
                        decrypted,
                        sharedKey
                    );
                }
            }

            this.logger.info(
                `Shared ${fields.length} fields with consumer ${consumerPublicKey.toString()}`
            );

            return {
                fields: Object.keys(sharedFields),
                encryptedFields: sharedFields,
                consumer: consumerPublicKey.toString(),
                timestamp: Date.now(),
            };
        } catch (error) {
            this.logger.error("Failed to share fields with consumer", error);
            throw error;
        }
    }

    /**
     * Derive shared key using Elliptic Curve Diffie-Hellman (ECDH)
     */
    private async deriveSharedKey(
        ownerKeypair: Keypair,
        consumerPublicKey: PublicKey
    ): Promise<Buffer> {
        try {
            // Use X25519 key exchange
            // Note: nacl.box.before computes the shared secret
            const sharedSecret = nacl.box.before(
                consumerPublicKey.toBytes(),
                ownerKeypair.secretKey.slice(0, 32)
            );

            // Derive AES key from shared secret using HKDF-like approach
            const salt = Buffer.from("DataSov-ECDH-Salt");
            const sharedKey = crypto.pbkdf2Sync(
                Buffer.from(sharedSecret),
                salt,
                10000,
                this.KEY_LENGTH,
                "sha256"
            );

            this.logger.info("Shared key derived successfully");
            return sharedKey;
        } catch (error) {
            this.logger.error("Failed to derive shared key", error);
            throw error;
        }
    }

    /**
     * Decrypt fields shared with consumer
     */
    async decryptSharedFields(
        selectiveDisclosure: SelectiveDisclosure,
        consumerKeypair: Keypair,
        ownerPublicKey: PublicKey
    ): Promise<Record<string, any>> {
        try {
            // Derive shared key
            const sharedKey = await this.deriveSharedKey(
                consumerKeypair,
                ownerPublicKey
            );

            // Decrypt shared fields
            const decryptedFields: Record<string, any> = {};

            for (const [field, encryptedField] of Object.entries(
                selectiveDisclosure.encryptedFields
            )) {
                decryptedFields[field] = await this.decryptField(
                    encryptedField,
                    sharedKey
                );
            }

            this.logger.info(`Decrypted ${selectiveDisclosure.fields.length} shared fields`);
            return decryptedFields;
        } catch (error) {
            this.logger.error("Failed to decrypt shared fields", error);
            throw error;
        }
    }

    /**
     * Generate a hash of data for integrity verification
     */
    generateHash(data: any): string {
        const hash = crypto.createHash("sha256");
        hash.update(JSON.stringify(data));
        return hash.digest("hex");
    }

    /**
     * Verify data integrity using hash
     */
    verifyHash(data: any, expectedHash: string): boolean {
        const actualHash = this.generateHash(data);
        return actualHash === expectedHash;
    }

    /**
     * Generate a random encryption key
     */
    generateRandomKey(): Buffer {
        return crypto.randomBytes(this.KEY_LENGTH);
    }

    /**
     * Generate a random IV
     */
    generateRandomIV(): Buffer {
        return crypto.randomBytes(this.IV_LENGTH);
    }

    /**
     * Sign data with wallet
     */
    signData(data: any, wallet: Keypair): string {
        const message = Buffer.from(JSON.stringify(data));
        const signature = nacl.sign.detached(message, wallet.secretKey);
        return Buffer.from(signature).toString("base64");
    }

    /**
     * Verify signature
     */
    verifySignature(data: any, signature: string, publicKey: PublicKey): boolean {
        try {
            const message = Buffer.from(JSON.stringify(data));
            const signatureBytes = Buffer.from(signature, "base64");
            return nacl.sign.detached.verify(
                message,
                signatureBytes,
                publicKey.toBytes()
            );
        } catch (error) {
            this.logger.error("Failed to verify signature", error);
            return false;
        }
    }
}
