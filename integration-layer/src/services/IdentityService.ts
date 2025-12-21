/**
 * Identity Service
 *
 * Provides identity management functionality using distributed storage backends.
 * Currently implements ArweaveService, designed to support multiple storage providers.
 */

import { EventEmitter } from "events";
import {
    DigitalIdentity,
    IdentityProof,
    AccessProof,
    StorageEvent,
    StorageConfig,
    StorageError,
    PermissionType,
    ValidationResult,
    IdentityStatus,
    VerificationLevel,
} from "@/types";
import { Logger } from "@/utils/Logger";
import { ArweaveService } from "./ArweaveService";
import { ArweaveConfig, ArweaveIdentityDocument } from "@/types";

export class IdentityService extends EventEmitter {
    private storageService: ArweaveService;
    private config: StorageConfig;
    private logger: Logger;
    private isConnected: boolean = false;

    constructor(config: StorageConfig) {
        super();
        this.config = config;
        this.logger = new Logger("IdentityService");

        // Initialize ArweaveService (can be extended to support other storage backends)
        const arweaveConfig: ArweaveConfig = {
            host: config.host || "arweave.net",
            port: config.port || 443,
            protocol: config.protocol || "https",
            timeout: config.timeout || 30000,
            logging: config.logging || false,
            wallet: config.wallet || ({} as any), // Wallet should be provided in config
        };

        this.storageService = new ArweaveService(arweaveConfig);

        // Forward storage service events
        this.storageService.on("connected", () => {
            this.isConnected = true;
            this.emit("storageEvent", {
                type: "CONNECTED",
                timestamp: Date.now(),
            } as StorageEvent);
        });

        this.storageService.on("disconnected", () => {
            this.isConnected = false;
            this.emit("storageEvent", {
                type: "DISCONNECTED",
                timestamp: Date.now(),
            } as StorageEvent);
        });

        this.storageService.on("documentUploaded", (data: any) => {
            this.emit("storageEvent", {
                type: "IDENTITY_REGISTERED",
                identityId: data.identityId,
                timestamp: Date.now(),
                transactionHash: data.txId,
            } as StorageEvent);
        });
    }

    /**
     * Initialize connection to storage backend
     */
    async connect(): Promise<void> {
        try {
            await this.storageService.connect();
            this.isConnected = true;
            this.logger.info("Connected to storage backend");
        } catch (error) {
            this.logger.error("Failed to connect to storage backend", error);
            throw new StorageError("Connection failed", {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Disconnect from storage backend
     */
    async disconnect(): Promise<void> {
        try {
            await this.storageService.disconnect();
            this.isConnected = false;
            this.logger.info("Disconnected from storage backend");
        } catch (error) {
            this.logger.error("Error disconnecting from storage", error);
        }
    }

    /**
     * Get digital identity by ID
     */
    async getIdentity(identityId: string): Promise<DigitalIdentity | null> {
        try {
            this.validateConnection();

            const document = await this.storageService.getLatestIdentityDocument(
                identityId
            );
            if (!document) {
                return null;
            }

            return this.mapDocumentToDigitalIdentity(document);
        } catch (error) {
            this.logger.error(`Failed to get identity ${identityId}`, error);
            throw new StorageError("Failed to get identity", {
                identityId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Get all identities for an owner
     */
    async getIdentitiesByOwner(owner: string): Promise<DigitalIdentity[]> {
        try {
            this.validateConnection();

            const documents =
                await this.storageService.queryDocumentsByOwner(owner);
            return documents
                .filter((doc) => doc.documentType === "IDENTITY")
                .map((doc) => this.mapDocumentToDigitalIdentity(doc));
        } catch (error) {
            this.logger.error(
                `Failed to get identities for owner ${owner}`,
                error
            );
            throw new StorageError("Failed to get identities by owner", {
                owner,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Generate identity proof for cross-chain validation
     */
    async generateIdentityProof(identityId: string): Promise<IdentityProof> {
        try {
            this.validateConnection();

            const identity = await this.getIdentity(identityId);
            if (!identity) {
                throw new StorageError("Identity not found", { identityId });
            }

            if (identity.status !== IdentityStatus.VERIFIED) {
                throw new StorageError("Identity not verified", {
                    identityId,
                    status: identity.status,
                });
            }

            // Get the latest document to get transaction hash
            const document =
                await this.storageService.getLatestIdentityDocument(identityId);
            const txId = document?.arweaveMetadata?.transactionId || "";

            const identityProof: IdentityProof = {
                identityId: identity.identityId,
                owner: identity.owner,
                verificationLevel: identity.verificationLevel,
                verificationTimestamp: identity.verifiedAt || Date.now(),
                storageTransactionHash: txId,
                signature: document?.signatures?.owner || "",
                validUntil: this.calculateValidUntil(identity.verificationLevel),
                metadata: {
                    identityType: identity.identityType,
                    verificationMethod: identity.verificationMethod,
                    createdAt: identity.createdAt,
                },
            };

            this.logger.info(`Generated identity proof for ${identityId}`);
            return identityProof;
        } catch (error) {
            this.logger.error(
                `Failed to generate identity proof for ${identityId}`,
                error
            );
            throw new StorageError("Failed to generate identity proof", {
                identityId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Generate access proof for data access permissions
     */
    async generateAccessProof(
        identityId: string,
        consumer: string,
        dataType: string
    ): Promise<AccessProof> {
        try {
            this.validateConnection();

            const identity = await this.getIdentity(identityId);
            if (!identity) {
                throw new StorageError("Identity not found", { identityId });
            }

            // Check if consumer has access
            const hasAccess = identity.accessPermissions.some(
                (permission) =>
                    permission.consumer === consumer &&
                    permission.dataTypes.includes(dataType as any) &&
                    permission.isActive &&
                    (!permission.expiresAt ||
                        permission.expiresAt > Date.now())
            );

            if (!hasAccess) {
                throw new StorageError("Access not granted", {
                    identityId,
                    consumer,
                    dataType,
                });
            }

            const permission = identity.accessPermissions.find(
                (p) => p.consumer === consumer
            );

            // Get document for transaction hash
            const document =
                await this.storageService.getLatestIdentityDocument(identityId);
            const txId = document?.arweaveMetadata?.transactionId || "";

            const proof: AccessProof = {
                identityId,
                consumer,
                permissionType:
                    permission?.permissionType || PermissionType.READ_ONLY,
                dataTypes: [dataType as any],
                grantedAt: permission?.grantedAt || Date.now(),
                expiresAt: permission?.expiresAt,
                isActive: true,
                grantedBy: identity.owner,
                signature: document?.signatures?.owner || "",
                storageTransactionHash: txId,
            };

            this.logger.info(
                `Generated access proof for ${identityId} -> ${consumer}`
            );
            return proof;
        } catch (error) {
            this.logger.error(
                `Failed to generate access proof for ${identityId}`,
                error
            );
            throw new StorageError("Failed to generate access proof", {
                identityId,
                consumer,
                dataType,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Validate identity proof from external source
     */
    async validateIdentityProof(
        proof: IdentityProof
    ): Promise<ValidationResult> {
        try {
            this.validateConnection();

            // Verify identity exists and is verified
            const identity = await this.getIdentity(proof.identityId);
            if (!identity) {
                return {
                    isValid: false,
                    errors: ["Identity not found"],
                    warnings: [],
                };
            }

            if (identity.status !== IdentityStatus.VERIFIED) {
                return {
                    isValid: false,
                    errors: ["Identity not verified"],
                    warnings: [],
                };
            }

            // Verify proof hasn't expired
            if (proof.validUntil && proof.validUntil < Date.now()) {
                return {
                    isValid: false,
                    errors: ["Proof has expired"],
                    warnings: [],
                };
            }

            // Verify transaction hash exists
            if (proof.storageTransactionHash) {
                try {
                    await this.storageService.getDocumentByTxId(
                        proof.storageTransactionHash
                    );
                } catch (error) {
                    return {
                        isValid: false,
                        errors: ["Invalid transaction hash"],
                        warnings: [],
                    };
                }
            }

            this.logger.info(
                `Identity proof validated for ${proof.identityId}`
            );
            return {
                isValid: true,
                errors: [],
                warnings: [],
            };
        } catch (error) {
            this.logger.error(
                `Failed to validate identity proof for ${proof.identityId}`,
                error
            );
            return {
                isValid: false,
                errors: [
                    error instanceof Error ? error.message : String(error),
                ],
                warnings: [],
            };
        }
    }

    /**
     * Validate access proof
     */
    async validateAccessProof(proof: AccessProof): Promise<ValidationResult> {
        try {
            this.validateConnection();

            const identity = await this.getIdentity(proof.identityId);
            if (!identity) {
                return {
                    isValid: false,
                    errors: ["Identity not found"],
                    warnings: [],
                };
            }

            // Check if permission exists and is active
            const permission = identity.accessPermissions.find(
                (p) => p.consumer === proof.consumer
            );

            if (!permission || !permission.isActive) {
                return {
                    isValid: false,
                    errors: ["Permission not found or inactive"],
                    warnings: [],
                };
            }

            // Check expiration
            if (permission.expiresAt && permission.expiresAt < Date.now()) {
                return {
                    isValid: false,
                    errors: ["Permission has expired"],
                    warnings: [],
                };
            }

            // Check data type is included
            const hasDataType = proof.dataTypes.some((dt) =>
                permission.dataTypes.includes(dt)
            );
            if (!hasDataType) {
                return {
                    isValid: false,
                    errors: ["Data type not authorized"],
                    warnings: [],
                };
            }

            this.logger.info(
                `Access proof validated for ${proof.identityId}`
            );
            return {
                isValid: true,
                errors: [],
                warnings: [],
            };
        } catch (error) {
            this.logger.error("Access proof validation error", {
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                isValid: false,
                errors: [
                    error instanceof Error ? error.message : String(error),
                ],
                warnings: [],
            };
        }
    }

    /**
     * Map Arweave identity document to DigitalIdentity format
     */
    private mapDocumentToDigitalIdentity(
        document: ArweaveIdentityDocument
    ): DigitalIdentity {
        return {
            identityId: document.identityId,
            owner: document.owner,
            identityProvider: document.identityProvider || "STORAGE_BACKEND",
            identityType: document.identityType,
            status: (document.status as IdentityStatus) || IdentityStatus.PENDING,
            verificationLevel:
                (document.kycVerification?.verificationLevel as VerificationLevel) ||
                VerificationLevel.NONE,
            personalInfo: document.encryptedPersonalInfo || {
                encryptedData: {},
            },
            accessPermissions: document.accessPermission
                ? [
                      {
                          consumer: document.accessPermission.consumer,
                          permissionType:
                              document.accessPermission.permissionType ||
                              PermissionType.READ_ONLY,
                          dataTypes: document.accessPermission.dataTypes || [],
                          grantedAt: document.accessPermission.grantedAt || Date.now(),
                          expiresAt: document.accessPermission.expiresAt,
                          isActive: true,
                          grantedBy: document.owner,
                      },
                  ]
                : [],
            createdAt: document.timestamp,
            verifiedAt: document.kycVerification?.performedAt,
            updatedAt: document.timestamp,
            revokedAt: document.status === IdentityStatus.REVOKED ? Date.now() : undefined,
            verificationMethod: document.kycVerification?.verificationMethod,
            metadata: document.metadata || {},
        };
    }

    /**
     * Calculate proof validity period based on verification level
     */
    private calculateValidUntil(verificationLevel: VerificationLevel): number {
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        switch (verificationLevel) {
            case VerificationLevel.CREDENTIAL:
                return now + 365 * oneDay; // 1 year
            case VerificationLevel.HIGH:
                return now + 180 * oneDay; // 6 months
            case VerificationLevel.ENHANCED:
                return now + 90 * oneDay; // 3 months
            case VerificationLevel.BASIC:
                return now + 30 * oneDay; // 1 month
            default:
                return now + 7 * oneDay; // 1 week
        }
    }

    /**
     * Validate connection status
     */
    private validateConnection(): void {
        if (!this.isConnected) {
            throw new StorageError("Not connected to storage backend");
        }
    }

    /**
     * Get connection status
     */
    isHealthy(): boolean {
        return this.isConnected && this.storageService.isHealthy();
    }

    /**
     * Get service metrics
     */
    async getMetrics(): Promise<Record<string, any>> {
        const storageMetrics = await this.storageService.getMetrics();
        return {
            isConnected: this.isConnected,
            storageBackend: "Arweave",
            connectionTime: Date.now(),
            ...storageMetrics,
        };
    }
}

