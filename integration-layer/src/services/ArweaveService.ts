import Arweave from "arweave";
import { JWKInterface } from "arweave/node/lib/wallet";
import { EventEmitter } from "events";
import { Logger } from "../utils/Logger";
import {
    ArweaveConfig,
    ArweaveIdentityDocument,
    ArweaveError
} from "../types";

export class ArweaveService extends EventEmitter {
    private arweave: Arweave;
    private wallet: JWKInterface;
    private config: ArweaveConfig;
    private logger: Logger;
    private isConnected: boolean = false;

    constructor(config: ArweaveConfig) {
        super();
        this.config = config;
        this.logger = new Logger("ArweaveService");

        // Initialize Arweave client
        this.arweave = Arweave.init({
            host: config.host,
            port: config.port,
            protocol: config.protocol,
            timeout: config.timeout,
            logging: config.logging,
        });

        this.wallet = config.wallet;
    }

    /**
     * Connect to Arweave network
     */
    async connect(): Promise<void> {
        try {
            // Test connection by getting network info
            const info = await this.arweave.network.getInfo();
            this.isConnected = true;
            this.logger.info("Connected to Arweave network", {
                height: info.height,
                network: info.network,
                peers: info.peers,
            });
            this.emit("connected", { network: info.network, height: info.height });
        } catch (error) {
            this.logger.error("Failed to connect to Arweave", error);
            throw new ArweaveError("Connection failed", { error });
        }
    }

    /**
     * Disconnect from Arweave network
     */
    async disconnect(): Promise<void> {
        this.isConnected = false;
        this.logger.info("Disconnected from Arweave network");
        this.emit("disconnected");
    }

    /**
     * Upload identity document to Arweave
     */
    async uploadIdentityDocument(document: ArweaveIdentityDocument): Promise<string> {
        try {
            this.validateConnection();

            const transaction = await this.arweave.createTransaction(
                {
                    data: JSON.stringify(document),
                },
                this.wallet
            );

            // Add tags for querying
            transaction.addTag("App-Name", "DataSov");
            transaction.addTag("App-Version", "1.0.0");
            transaction.addTag("Content-Type", "application/json");
            transaction.addTag("Document-Type", document.documentType);
            transaction.addTag("Identity-Id", document.identityId);
            transaction.addTag("Owner", document.owner);
            if (document.status) {
                transaction.addTag("Status", document.status);
            }
            transaction.addTag("Unix-Time", document.timestamp.toString());

            await this.arweave.transactions.sign(transaction, this.wallet);
            const response = await this.arweave.transactions.post(transaction);

            if (response.status === 200) {
                this.logger.info(`Identity document uploaded: ${transaction.id}`, {
                    identityId: document.identityId,
                    documentType: document.documentType,
                });
                this.emit("documentUploaded", {
                    txId: transaction.id,
                    identityId: document.identityId,
                    documentType: document.documentType,
                });
                return transaction.id;
            } else {
                throw new ArweaveError("Upload failed", {
                    status: response.status,
                    statusText: response.statusText,
                });
            }
        } catch (error) {
            this.logger.error("Failed to upload identity document", error);
            throw new ArweaveError("Upload failed", { error });
        }
    }

    /**
     * Query identity documents by identity ID
     */
    async queryIdentityDocuments(identityId: string): Promise<ArweaveIdentityDocument[]> {
        try {
            this.validateConnection();

            const query = {
                query: `{
                    transactions(
                        tags: [
                            { name: "App-Name", values: ["DataSov"] },
                            { name: "Identity-Id", values: ["${identityId}"] }
                        ],
                        sort: HEIGHT_DESC,
                        first: 100
                    ) {
                        edges {
                            node {
                                id
                                tags {
                                    name
                                    value
                                }
                            }
                        }
                    }
                }`,
            };

            const response = await this.arweave.api.post("/graphql", query);
            const transactions = response.data.data.transactions.edges;

            const documents: ArweaveIdentityDocument[] = [];

            for (const edge of transactions) {
                const txId = edge.node.id;
                const data = await this.arweave.transactions.getData(txId, {
                    decode: true,
                    string: true,
                });
                documents.push(JSON.parse(data as string));
            }

            this.logger.info(`Found ${documents.length} documents for identity ${identityId}`);
            return documents;
        } catch (error) {
            this.logger.error(`Failed to query identity documents for ${identityId}`, error);
            throw new ArweaveError("Query failed", { error });
        }
    }

    /**
     * Get latest identity document
     */
    async getLatestIdentityDocument(
        identityId: string
    ): Promise<ArweaveIdentityDocument | null> {
        const documents = await this.queryIdentityDocuments(identityId);
        return documents.length > 0 ? documents[0] : null;
    }

    /**
     * Get document by transaction ID
     */
    async getDocumentByTxId(txId: string): Promise<ArweaveIdentityDocument> {
        try {
            this.validateConnection();

            const data = await this.arweave.transactions.getData(txId, {
                decode: true,
                string: true,
            });
            const document = JSON.parse(data as string);

            this.logger.info(`Retrieved document ${txId}`);
            return document;
        } catch (error) {
            this.logger.error(`Failed to get document ${txId}`, error);
            throw new ArweaveError("Document fetch failed", { error, txId });
        }
    }

    /**
     * Query documents by type
     */
    async queryDocumentsByType(
        documentType: string,
        limit: number = 100
    ): Promise<ArweaveIdentityDocument[]> {
        try {
            this.validateConnection();

            const query = {
                query: `{
                    transactions(
                        tags: [
                            { name: "App-Name", values: ["DataSov"] },
                            { name: "Document-Type", values: ["${documentType}"] }
                        ],
                        sort: HEIGHT_DESC,
                        first: ${limit}
                    ) {
                        edges {
                            node {
                                id
                                tags {
                                    name
                                    value
                                }
                            }
                        }
                    }
                }`,
            };

            const response = await this.arweave.api.post("/graphql", query);
            const transactions = response.data.data.transactions.edges;

            const documents: ArweaveIdentityDocument[] = [];

            for (const edge of transactions) {
                const txId = edge.node.id;
                const data = await this.arweave.transactions.getData(txId, {
                    decode: true,
                    string: true,
                });
                documents.push(JSON.parse(data as string));
            }

            this.logger.info(`Found ${documents.length} documents of type ${documentType}`);
            return documents;
        } catch (error) {
            this.logger.error(`Failed to query documents of type ${documentType}`, error);
            throw new ArweaveError("Query failed", { error });
        }
    }

    /**
     * Query documents by owner
     */
    async queryDocumentsByOwner(
        owner: string,
        limit: number = 100
    ): Promise<ArweaveIdentityDocument[]> {
        try {
            this.validateConnection();

            const query = {
                query: `{
                    transactions(
                        tags: [
                            { name: "App-Name", values: ["DataSov"] },
                            { name: "Owner", values: ["${owner}"] }
                        ],
                        sort: HEIGHT_DESC,
                        first: ${limit}
                    ) {
                        edges {
                            node {
                                id
                                tags {
                                    name
                                    value
                                }
                            }
                        }
                    }
                }`,
            };

            const response = await this.arweave.api.post("/graphql", query);
            const transactions = response.data.data.transactions.edges;

            const documents: ArweaveIdentityDocument[] = [];

            for (const edge of transactions) {
                const txId = edge.node.id;
                const data = await this.arweave.transactions.getData(txId, {
                    decode: true,
                    string: true,
                });
                documents.push(JSON.parse(data as string));
            }

            this.logger.info(`Found ${documents.length} documents for owner ${owner}`);
            return documents;
        } catch (error) {
            this.logger.error(`Failed to query documents for owner ${owner}`, error);
            throw new ArweaveError("Query failed", { error });
        }
    }

    /**
     * Get wallet balance
     */
    async getWalletBalance(): Promise<{ winston: string; ar: string }> {
        try {
            this.validateConnection();

            const address = await this.arweave.wallets.jwkToAddress(this.wallet);
            const balanceWinston = await this.arweave.wallets.getBalance(address);
            const balanceAr = this.arweave.ar.winstonToAr(balanceWinston);

            this.logger.info(`Wallet balance: ${balanceAr} AR`);

            return {
                winston: balanceWinston,
                ar: balanceAr,
            };
        } catch (error) {
            this.logger.error("Failed to get wallet balance", error);
            throw new ArweaveError("Failed to get balance", { error });
        }
    }

    /**
     * Get transaction status
     */
    async getTransactionStatus(txId: string): Promise<{
        confirmed: boolean;
        confirmations: number;
        blockHeight?: number;
    }> {
        try {
            this.validateConnection();

            const status = await this.arweave.transactions.getStatus(txId);

            return {
                confirmed: status.confirmed?.number_of_confirmations ? status.confirmed.number_of_confirmations > 0 : false,
                confirmations: status.confirmed?.number_of_confirmations || 0,
                blockHeight: status.confirmed?.block_height,
            };
        } catch (error) {
            this.logger.error(`Failed to get status for transaction ${txId}`, error);
            throw new ArweaveError("Failed to get transaction status", { error, txId });
        }
    }

    /**
     * Validate connection
     */
    private validateConnection(): void {
        if (!this.isConnected) {
            throw new ArweaveError("Not connected to Arweave network");
        }
    }

    /**
     * Check if service is healthy
     */
    isHealthy(): boolean {
        return this.isConnected;
    }

    /**
     * Get service metrics
     */
    async getMetrics(): Promise<Record<string, any>> {
        try {
            const networkInfo = await this.arweave.network.getInfo();
            const balance = await this.getWalletBalance();

            return {
                connected: this.isConnected,
                network: networkInfo.network,
                blockHeight: networkInfo.height,
                peers: networkInfo.peers,
                walletBalance: balance.ar,
            };
        } catch (error) {
            this.logger.error("Failed to get metrics", error);
            return {
                connected: this.isConnected,
                error: (error as Error).message,
            };
        }
    }
}
