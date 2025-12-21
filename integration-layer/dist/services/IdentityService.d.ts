/**
 * Identity Service
 *
 * Provides identity management functionality using distributed storage backends.
 * Currently implements ArweaveService, designed to support multiple storage providers.
 */
import { EventEmitter } from "events";
import { DigitalIdentity, IdentityProof, AccessProof, StorageConfig, ValidationResult } from "@/types";
export declare class IdentityService extends EventEmitter {
    private storageService;
    private config;
    private logger;
    private isConnected;
    constructor(config: StorageConfig);
    /**
     * Initialize connection to storage backend
     */
    connect(): Promise<void>;
    /**
     * Disconnect from storage backend
     */
    disconnect(): Promise<void>;
    /**
     * Get digital identity by ID
     */
    getIdentity(identityId: string): Promise<DigitalIdentity | null>;
    /**
     * Get all identities for an owner
     */
    getIdentitiesByOwner(owner: string): Promise<DigitalIdentity[]>;
    /**
     * Generate identity proof for cross-chain validation
     */
    generateIdentityProof(identityId: string): Promise<IdentityProof>;
    /**
     * Generate access proof for data access permissions
     */
    generateAccessProof(identityId: string, consumer: string, dataType: string): Promise<AccessProof>;
    /**
     * Validate identity proof from external source
     */
    validateIdentityProof(proof: IdentityProof): Promise<ValidationResult>;
    /**
     * Validate access proof
     */
    validateAccessProof(proof: AccessProof): Promise<ValidationResult>;
    /**
     * Map Arweave identity document to DigitalIdentity format
     */
    private mapDocumentToDigitalIdentity;
    /**
     * Calculate proof validity period based on verification level
     */
    private calculateValidUntil;
    /**
     * Validate connection status
     */
    private validateConnection;
    /**
     * Get connection status
     */
    isHealthy(): boolean;
    /**
     * Get service metrics
     */
    getMetrics(): Promise<Record<string, any>>;
}
//# sourceMappingURL=IdentityService.d.ts.map