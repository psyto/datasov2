/**
 * Cross-Chain Bridge Service
 *
 * Handles cross-chain communication between Storage backend and Solana,
 * including identity proof validation, state synchronization, and event bridging.
 */
import { IdentityProof, AccessProof, SyncResult, ProofValidationResult, StateSnapshot, BridgeConfig } from "@/types";
import { IdentityService } from "./IdentityService";
import { SolanaService } from "./SolanaService";
import { EventEmitter } from "events";
import { Keypair, PublicKey } from "@solana/web3.js";
export declare class CrossChainBridge extends EventEmitter {
    private identityService;
    private solanaService;
    private config;
    private logger;
    private isRunning;
    private syncRunning;
    private lastSyncTime?;
    private syncInterval?;
    private eventHandlers;
    constructor(identityService: IdentityService, solanaService: SolanaService, config: BridgeConfig);
    /**
     * Start the cross-chain bridge
     */
    start(): Promise<void>;
    /**
     * Stop the cross-chain bridge
     */
    stop(): Promise<void>;
    /**
     * Validate identity proof from Storage backend for Solana usage
     */
    validateIdentityProof(proof: IdentityProof): Promise<ProofValidationResult>;
    /**
     * Generate identity proof for cross-chain usage
     */
    generateIdentityProof(identityId: string): Promise<IdentityProof>;
    /**
     * Generate access proof for data access
     */
    generateAccessProof(identityId: string, consumer: string, dataType: string): Promise<AccessProof>;
    /**
     * Create data listing on Solana with Storage identity validation
     */
    createDataListing(owner: Keypair, listingId: number, price: number, dataType: string, description: string, identityId: string, accessProof?: AccessProof): Promise<string>;
    /**
     * Purchase data with access validation
     */
    purchaseData(buyer: Keypair, listingId: number, tokenMint: PublicKey, identityId: string): Promise<any>;
    /**
     * Synchronize state between Storage backend and Solana
     */
    synchronizeState(): Promise<SyncResult>;
    /**
     * Get current state snapshot
     */
    getStateSnapshot(): Promise<StateSnapshot>;
    /**
     * Stop synchronization
     */
    stopSync(): Promise<void>;
    /**
     * Get synchronization status
     */
    getSyncStatus(): {
        isRunning: boolean;
        lastSync?: number;
    };
    /**
     * Setup event handlers for cross-chain communication
     */
    private setupEventHandlers;
    /**
     * Handle Storage events
     */
    private handleStorageEvent;
    /**
     * Handle Solana events
     */
    private handleSolanaEvent;
    /**
     * Start event monitoring
     */
    private startEventMonitoring;
    /**
     * Start periodic synchronization
     */
    private startPeriodicSync;
    /**
     * Validate proof format
     */
    private validateProofFormat;
    /**
     * Enable data trading for identity
     */
    private enableDataTrading;
    /**
     * Disable data trading for identity
     */
    private disableDataTrading;
    /**
     * Update access permissions
     */
    private updateAccessPermissions;
    /**
     * Revoke access permissions
     */
    private revokeAccessPermissions;
    /**
     * Update access log
     */
    private updateAccessLog;
    /**
     * Record fee distribution
     */
    private recordFeeDistribution;
    /**
     * Get bridge status
     */
    getStatus(): Record<string, any>;
}
//# sourceMappingURL=CrossChainBridge.d.ts.map