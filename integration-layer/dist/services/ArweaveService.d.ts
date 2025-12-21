import { EventEmitter } from "events";
import { ArweaveConfig, ArweaveIdentityDocument } from "../types";
export declare class ArweaveService extends EventEmitter {
    private arweave;
    private wallet;
    private config;
    private logger;
    private isConnected;
    constructor(config: ArweaveConfig);
    /**
     * Connect to Arweave network
     */
    connect(): Promise<void>;
    /**
     * Disconnect from Arweave network
     */
    disconnect(): Promise<void>;
    /**
     * Upload identity document to Arweave
     */
    uploadIdentityDocument(document: ArweaveIdentityDocument): Promise<string>;
    /**
     * Query identity documents by identity ID
     */
    queryIdentityDocuments(identityId: string): Promise<ArweaveIdentityDocument[]>;
    /**
     * Get latest identity document
     */
    getLatestIdentityDocument(identityId: string): Promise<ArweaveIdentityDocument | null>;
    /**
     * Get document by transaction ID
     */
    getDocumentByTxId(txId: string): Promise<ArweaveIdentityDocument>;
    /**
     * Query documents by type
     */
    queryDocumentsByType(documentType: string, limit?: number): Promise<ArweaveIdentityDocument[]>;
    /**
     * Query documents by owner
     */
    queryDocumentsByOwner(owner: string, limit?: number): Promise<ArweaveIdentityDocument[]>;
    /**
     * Get wallet balance
     */
    getWalletBalance(): Promise<{
        winston: string;
        ar: string;
    }>;
    /**
     * Get transaction status
     */
    getTransactionStatus(txId: string): Promise<{
        confirmed: boolean;
        confirmations: number;
        blockHeight?: number;
    }>;
    /**
     * Validate connection
     */
    private validateConnection;
    /**
     * Check if service is healthy
     */
    isHealthy(): boolean;
    /**
     * Get service metrics
     */
    getMetrics(): Promise<Record<string, any>>;
}
//# sourceMappingURL=ArweaveService.d.ts.map