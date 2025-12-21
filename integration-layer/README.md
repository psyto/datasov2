# DataSov Integration Layer

A comprehensive integration service for the DataSov hybrid blockchain system. This layer handles identity proof validation, state synchronization, and seamless communication with Arweave and Solana networks.

## 🚀 Features

-   **Identity Management**: Integration with Arweave for permanent identity storage
-   **Identity Proof Validation**: Cryptographic validation of identity proofs
-   **State Synchronization**: Real-time synchronization of state with Solana
-   **Event Processing**: Event-driven communication with blockchain networks
-   **REST API Gateway**: Comprehensive API for identity and marketplace operations
-   **Health Monitoring**: Built-in health checks and metrics
-   **Security**: Enterprise-grade security with encryption and validation

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DataSov Integration Layer                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌─────────────────────────────────┐     │
│  │  Arweave Service     │    │      Solana Service        │     │
│  │                     │    │                             │     │
│  │ • Identity Storage  │    │ • Data Marketplace         │     │
│  │ • KYC Verification  │    │ • NFT Operations           │     │
│  │ • Access Control    │    │ • Trading Operations       │     │
│  └─────────────────────┘    └─────────────────────────────────┘     │
│           │                              │                         │
│           └──────────────┬───────────────┘                         │
│                          │                                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Cross-Chain Bridge Service                     │ │
│  │                                                             │ │
│  │ • Identity Proof Validation                                │ │
│  │ • State Synchronization                                    │ │
│  │ • Event Bridging                                           │ │
│  │ • Access Control Sync                                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    API Gateway                             │ │
│  │                                                             │ │
│  │ • REST API Endpoints                                       │ │
│  │ • Health Monitoring                                        │ │
│  │ • Request/Response Handling                                │ │
│  │ • Error Management                                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

-   Node.js 18+
-   npm or yarn
-   Solana network access (local validator or devnet)
-   PostgreSQL (optional, for state persistence)
-   Redis (optional, for caching)

## 🛠️ Installation

```bash
# Clone the repository
git clone <repository-url>
cd integration-layer

# Install dependencies
npm install

# Copy environment configuration
cp env.example .env

# Build the project
npm run build

# Start the service
npm start
```

## 🔧 Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
SOLANA_PRIVATE_KEY=your_solana_private_key_here

# Bridge Configuration
BRIDGE_ENABLED=true
SYNC_INTERVAL=5000
PROOF_VALIDATION_TIMEOUT=30000
MAX_RETRY_ATTEMPTS=3

# Security Configuration
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_encryption_key_here
API_RATE_LIMIT=100
```

## 📖 API Usage

### Health Check

```bash
curl http://localhost:3000/health
```

### Get Identity

```bash
curl http://localhost:3000/identity/USER_12345
```

### Generate Identity Proof

```bash
curl http://localhost:3000/identity/USER_12345/proof
```

### Create Data Listing

```bash
curl -X POST http://localhost:3000/data/listing \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "owner_keypair",
    "listingId": 1,
    "price": 1000000,
    "dataType": "LOCATION_HISTORY",
    "description": "Location data from verified user",
    "identityId": "USER_12345"
  }'
```

### Purchase Data

```bash
curl -X POST http://localhost:3000/data/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "buyer": "buyer_keypair",
    "listingId": 1,
    "tokenMint": "token_mint_address",
    "identityId": "USER_12345"
  }'
```

## 🔄 Cross-Chain Operations

### Identity Proof Flow

1. **Generate Proof**: Create cryptographic proof of identity from Arweave
2. **Validate Proof**: Verify proof authenticity and expiration
3. **Enable Trading**: Allow data trading on Solana with validated identity
4. **Sync State**: Keep networks synchronized

### Data Trading Flow

1. **Identity Validation**: Verify identity before creating listing
2. **Access Control**: Check permissions before allowing data access
3. **Trading Operations**: Execute trades on Solana with identity validation
4. **Fee Distribution**: Distribute fees based on permissions

### State Synchronization

1. **Periodic Sync**: Regular synchronization of state between networks
2. **Event-Driven Sync**: Real-time synchronization based on events
3. **Conflict Resolution**: Handle conflicts between network states
4. **Audit Trail**: Complete audit trail of all synchronization operations

## 🔒 Security Features

### Identity Proof Validation

-   **Cryptographic Signatures**: Verify proof authenticity
-   **Expiration Checks**: Ensure proofs are still valid
-   **Chain Validation**: Validate against source chain
-   **Replay Protection**: Prevent replay attacks

### Access Control

-   **Permission Validation**: Verify access permissions
-   **Time-based Expiration**: Automatic permission expiration
-   **Granular Control**: Fine-grained access control
-   **Revocation Support**: Immediate permission revocation

### Data Protection

-   **Encryption**: All sensitive data encrypted
-   **Selective Disclosure**: Only necessary data exposed
-   **Audit Trails**: Complete audit trails
-   **Privacy Preservation**: Maintain user privacy

## 📊 Monitoring and Metrics

### Health Checks

-   **Service Health**: Monitor all service components
-   **Network Connectivity**: Check network connections
-   **Performance Metrics**: Track performance indicators
-   **Error Rates**: Monitor error rates and patterns

### Metrics

-   **Request Count**: Track API request volumes
-   **Response Times**: Monitor response times
-   **Error Rates**: Track error rates by service
-   **Sync Performance**: Monitor synchronization performance

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

## 🚀 Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
    name: datasov-integration-layer
spec:
    replicas: 3
    selector:
        matchLabels:
            app: datasov-integration-layer
    template:
        metadata:
            labels:
                app: datasov-integration-layer
        spec:
            containers:
                - name: integration-layer
                  image: datasov/integration-layer:latest
                  ports:
                      - containerPort: 3000
                  env:
                      - name: PORT
                        value: "3000"
                      - name: SOLANA_RPC_URL
                        value: "https://api.devnet.solana.com"
```

## 🔧 Development

### Project Structure

```
src/
├── api/                 # API Gateway
│   └── index.ts
├── services/           # Core Services
│   ├── SolanaService.ts
│   ├── CrossChainBridge.ts
│   └── DataSovClient.ts
├── types/              # Type Definitions
│   └── index.ts
├── utils/              # Utilities
│   └── Logger.ts
└── index.ts            # Main Entry Point
```

### Adding New Features

1. **Define Types**: Add types in `src/types/index.ts`
2. **Implement Service**: Create service in `src/services/`
3. **Add API Endpoint**: Add endpoint in `src/api/index.ts`
4. **Update Bridge**: Update bridge logic if needed
5. **Add Tests**: Write comprehensive tests
6. **Update Documentation**: Update README and docs

## 📈 Performance

### Expected Performance

-   **API Response Time**: < 100ms for most operations
-   **Cross-Chain Sync**: < 5 seconds for state synchronization
-   **Proof Validation**: < 1 second for identity proof validation
-   **Throughput**: 1000+ requests per second

### Optimization Strategies

-   **Caching**: Redis caching for frequently accessed data
-   **Connection Pooling**: Efficient database connections
-   **Batch Operations**: Batch multiple operations together
-   **Async Processing**: Non-blocking operations where possible

## 🔗 Integration with DataSov Components

### Solana Component Integration

-   **Data Marketplace**: Direct integration with Solana marketplace
-   **NFT Operations**: Seamless NFT creation and management
-   **Trading Operations**: Real-time trading with identity validation
-   **Identity Management**: On-chain identity verification and access control

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For questions and support:

-   Create an issue in the repository
-   Contact the DataSov team
-   Check the documentation wiki

---

**DataSov Integration Layer** - Seamlessly connecting Arweave and Solana for the future of data ownership.

---

## ⚡ Quick Start (Demo Simple API)

For local demo and integration tests, run the lightweight Simple API instead of the full API:

```bash
cd integration-layer
npm install
npm run build
node dist/simple-api.js
```

This starts an Express server on http://localhost:3001 and prints demo credentials:

- Email: demo@datasov.com
- Password: password123

Pair this with the frontend:

```bash
cd ../frontend
npm install
npm start
```

Then run the integration smoke tests from the repo root:

```bash
node ../integration-test.js
```

### About TS Path Aliases

The full API (`dist/index.js`) uses TS path aliases like `@/utils/Logger`. If you see runtime errors like `Cannot find module '@/utils/Logger'`, either:

- use the Simple API (`dist/simple-api.js`) for demos, or
- add runtime alias resolution (e.g., `tsconfig-paths` / `module-alias`), or
- adjust build configuration to emit relative imports.
