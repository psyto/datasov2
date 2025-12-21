"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionService = void 0;
const crypto = __importStar(require("crypto"));
const nacl = __importStar(require("tweetnacl"));
const Logger_1 = require("../utils/Logger");
class EncryptionService {
    constructor() {
        this.ALGORITHM = "aes-256-gcm";
        this.KEY_LENGTH = 32; // 256 bits
        this.IV_LENGTH = 12; // 96 bits for GCM
        this.SALT_LENGTH = 16;
        this.ITERATIONS = 100000;
        this.logger = new Logger_1.Logger("EncryptionService");
    }
    /**
     * Derive master key from wallet signature
     * This is deterministic - same wallet always generates same key
     */
    async deriveMasterKey(wallet) {
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
            const masterKey = crypto.pbkdf2Sync(signature.slice(0, 32), salt, this.ITERATIONS, this.KEY_LENGTH, "sha256");
            this.logger.info("Master key derived successfully");
            return masterKey;
        }
        catch (error) {
            this.logger.error("Failed to derive master key", error);
            throw error;
        }
    }
    /**
     * Encrypt personal information
     * Each field is encrypted separately for selective disclosure
     */
    async encryptPersonalInfo(data, masterKey) {
        try {
            const encryptedFields = {};
            for (const [key, value] of Object.entries(data)) {
                if (value !== undefined && value !== null) {
                    encryptedFields[key] = await this.encryptField(value, masterKey);
                }
            }
            const result = {
                fields: encryptedFields,
                encryptionMetadata: {
                    algorithm: this.ALGORITHM,
                    keyDerivation: "PBKDF2",
                },
            };
            this.logger.info(`Encrypted ${Object.keys(encryptedFields).length} fields`);
            return result;
        }
        catch (error) {
            this.logger.error("Failed to encrypt personal info", error);
            throw error;
        }
    }
    /**
     * Decrypt personal information
     */
    async decryptPersonalInfo(encrypted, masterKey) {
        try {
            const decryptedData = {};
            for (const [key, encryptedField] of Object.entries(encrypted.fields)) {
                decryptedData[key] = await this.decryptField(encryptedField, masterKey);
            }
            this.logger.info(`Decrypted ${Object.keys(decryptedData).length} fields`);
            return decryptedData;
        }
        catch (error) {
            this.logger.error("Failed to decrypt personal info", error);
            throw error;
        }
    }
    /**
     * Encrypt a single field
     */
    async encryptField(value, key) {
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
        }
        catch (error) {
            this.logger.error("Failed to encrypt field", error);
            throw error;
        }
    }
    /**
     * Decrypt a single field
     */
    async decryptField(encryptedField, key) {
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
        }
        catch (error) {
            this.logger.error("Failed to decrypt field", error);
            throw error;
        }
    }
    /**
     * Share specific fields with consumer using ECDH key exchange
     */
    async shareFieldsWithConsumer(fields, consumerPublicKey, ownerKeypair, encryptedData, ownerMasterKey) {
        try {
            // Derive shared key using ECDH
            const sharedKey = await this.deriveSharedKey(ownerKeypair, consumerPublicKey);
            // Re-encrypt only specified fields with shared key
            const sharedFields = {};
            for (const field of fields) {
                if (encryptedData.fields[field]) {
                    // Decrypt with owner's key
                    const decrypted = await this.decryptField(encryptedData.fields[field], ownerMasterKey);
                    // Re-encrypt with shared key
                    sharedFields[field] = await this.encryptField(decrypted, sharedKey);
                }
            }
            this.logger.info(`Shared ${fields.length} fields with consumer ${consumerPublicKey.toString()}`);
            return {
                fields: Object.keys(sharedFields),
                encryptedFields: sharedFields,
                consumer: consumerPublicKey.toString(),
                timestamp: Date.now(),
            };
        }
        catch (error) {
            this.logger.error("Failed to share fields with consumer", error);
            throw error;
        }
    }
    /**
     * Derive shared key using Elliptic Curve Diffie-Hellman (ECDH)
     */
    async deriveSharedKey(ownerKeypair, consumerPublicKey) {
        try {
            // Use X25519 key exchange
            // Note: nacl.box.before computes the shared secret
            const sharedSecret = nacl.box.before(consumerPublicKey.toBytes(), ownerKeypair.secretKey.slice(0, 32));
            // Derive AES key from shared secret using HKDF-like approach
            const salt = Buffer.from("DataSov-ECDH-Salt");
            const sharedKey = crypto.pbkdf2Sync(Buffer.from(sharedSecret), salt, 10000, this.KEY_LENGTH, "sha256");
            this.logger.info("Shared key derived successfully");
            return sharedKey;
        }
        catch (error) {
            this.logger.error("Failed to derive shared key", error);
            throw error;
        }
    }
    /**
     * Decrypt fields shared with consumer
     */
    async decryptSharedFields(selectiveDisclosure, consumerKeypair, ownerPublicKey) {
        try {
            // Derive shared key
            const sharedKey = await this.deriveSharedKey(consumerKeypair, ownerPublicKey);
            // Decrypt shared fields
            const decryptedFields = {};
            for (const [field, encryptedField] of Object.entries(selectiveDisclosure.encryptedFields)) {
                decryptedFields[field] = await this.decryptField(encryptedField, sharedKey);
            }
            this.logger.info(`Decrypted ${selectiveDisclosure.fields.length} shared fields`);
            return decryptedFields;
        }
        catch (error) {
            this.logger.error("Failed to decrypt shared fields", error);
            throw error;
        }
    }
    /**
     * Generate a hash of data for integrity verification
     */
    generateHash(data) {
        const hash = crypto.createHash("sha256");
        hash.update(JSON.stringify(data));
        return hash.digest("hex");
    }
    /**
     * Verify data integrity using hash
     */
    verifyHash(data, expectedHash) {
        const actualHash = this.generateHash(data);
        return actualHash === expectedHash;
    }
    /**
     * Generate a random encryption key
     */
    generateRandomKey() {
        return crypto.randomBytes(this.KEY_LENGTH);
    }
    /**
     * Generate a random IV
     */
    generateRandomIV() {
        return crypto.randomBytes(this.IV_LENGTH);
    }
    /**
     * Sign data with wallet
     */
    signData(data, wallet) {
        const message = Buffer.from(JSON.stringify(data));
        const signature = nacl.sign.detached(message, wallet.secretKey);
        return Buffer.from(signature).toString("base64");
    }
    /**
     * Verify signature
     */
    verifySignature(data, signature, publicKey) {
        try {
            const message = Buffer.from(JSON.stringify(data));
            const signatureBytes = Buffer.from(signature, "base64");
            return nacl.sign.detached.verify(message, signatureBytes, publicKey.toBytes());
        }
        catch (error) {
            this.logger.error("Failed to verify signature", error);
            return false;
        }
    }
}
exports.EncryptionService = EncryptionService;
//# sourceMappingURL=EncryptionService.js.map