import { Keypair, PublicKey } from "@solana/web3.js";
import { EncryptedPersonalInfo, EncryptedField, PersonalInfo, SelectiveDisclosure } from "../types";
export declare class EncryptionService {
    private logger;
    private readonly ALGORITHM;
    private readonly KEY_LENGTH;
    private readonly IV_LENGTH;
    private readonly SALT_LENGTH;
    private readonly ITERATIONS;
    constructor();
    /**
     * Derive master key from wallet signature
     * This is deterministic - same wallet always generates same key
     */
    deriveMasterKey(wallet: Keypair): Promise<Buffer>;
    /**
     * Encrypt personal information
     * Each field is encrypted separately for selective disclosure
     */
    encryptPersonalInfo(data: PersonalInfo, masterKey: Buffer): Promise<EncryptedPersonalInfo>;
    /**
     * Decrypt personal information
     */
    decryptPersonalInfo(encrypted: EncryptedPersonalInfo, masterKey: Buffer): Promise<PersonalInfo>;
    /**
     * Encrypt a single field
     */
    encryptField(value: any, key: Buffer): Promise<EncryptedField>;
    /**
     * Decrypt a single field
     */
    decryptField(encryptedField: EncryptedField, key: Buffer): Promise<any>;
    /**
     * Share specific fields with consumer using ECDH key exchange
     */
    shareFieldsWithConsumer(fields: string[], consumerPublicKey: PublicKey, ownerKeypair: Keypair, encryptedData: EncryptedPersonalInfo, ownerMasterKey: Buffer): Promise<SelectiveDisclosure>;
    /**
     * Derive shared key using Elliptic Curve Diffie-Hellman (ECDH)
     */
    private deriveSharedKey;
    /**
     * Decrypt fields shared with consumer
     */
    decryptSharedFields(selectiveDisclosure: SelectiveDisclosure, consumerKeypair: Keypair, ownerPublicKey: PublicKey): Promise<Record<string, any>>;
    /**
     * Generate a hash of data for integrity verification
     */
    generateHash(data: any): string;
    /**
     * Verify data integrity using hash
     */
    verifyHash(data: any, expectedHash: string): boolean;
    /**
     * Generate a random encryption key
     */
    generateRandomKey(): Buffer;
    /**
     * Generate a random IV
     */
    generateRandomIV(): Buffer;
    /**
     * Sign data with wallet
     */
    signData(data: any, wallet: Keypair): string;
    /**
     * Verify signature
     */
    verifySignature(data: any, signature: string, publicKey: PublicKey): boolean;
}
//# sourceMappingURL=EncryptionService.d.ts.map