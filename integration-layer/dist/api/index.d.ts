/**
 * DataSov Integration Layer API Gateway
 *
 * Provides REST API endpoints for cross-chain operations
 * between Storage backend and Solana networks.
 */
import express from "express";
import { BridgeConfig } from "@/types";
import { CrossChainBridge } from "@/services/CrossChainBridge";
import { IdentityService } from "@/services/IdentityService";
import { SolanaService } from "@/services/SolanaService";
export declare class ApiGateway {
    private app;
    private bridge;
    private identityService;
    private solanaService;
    private config;
    private logger;
    constructor(bridge: CrossChainBridge, identityService: IdentityService, solanaService: SolanaService, config: BridgeConfig);
    /**
     * Setup middleware
     */
    private setupMiddleware;
    /**
     * Setup API routes
     */
    private setupRoutes;
    /**
     * Health check endpoint
     */
    private healthCheck;
    /**
     * Get bridge status
     */
    private getBridgeStatus;
    /**
     * Get identity by ID
     */
    private getIdentity;
    /**
     * Generate identity proof
     */
    private generateIdentityProof;
    /**
     * Validate identity proof
     */
    private validateIdentityProof;
    /**
     * Generate access proof
     */
    private generateAccessProof;
    /**
     * Create data listing
     */
    private createDataListing;
    /**
     * Get data listing
     */
    private getDataListing;
    /**
     * Get data listings
     */
    private getDataListings;
    /**
     * Update data listing
     */
    private updateDataListing;
    /**
     * Cancel data listing
     */
    private cancelDataListing;
    /**
     * Purchase data
     */
    private purchaseData;
    /**
     * Start synchronization
     */
    private startSync;
    /**
     * Get state snapshot
     */
    private getStateSnapshot;
    /**
     * Error handler middleware
     */
    private errorHandler;
    /**
     * 404 handler
     */
    private notFoundHandler;
    /**
     * Validate access proof
     */
    private validateAccessProof;
    /**
     * Stop synchronization
     */
    private stopSync;
    /**
     * Get synchronization status
     */
    private getSyncStatus;
    /**
     * Create standardized API response
     */
    private createApiResponse;
    /**
     * Determine overall system status
     */
    private determineOverallStatus;
    /**
     * Get Express app
     */
    getApp(): express.Application;
    /**
     * Start the API server
     */
    start(port: number): void;
}
//# sourceMappingURL=index.d.ts.map