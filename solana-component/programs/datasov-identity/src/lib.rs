use anchor_lang::prelude::*;

declare_id!("DataSovIdentity11111111111111111111111111111");

#[program]
pub mod datasov_identity {
    use super::*;

    /// Initialize the KYC Oracle Registry
    pub fn initialize_oracle_registry(
        ctx: Context<InitializeOracleRegistry>,
        minimum_stake: u64,
        slash_amount: u64,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.oracle_registry;
        registry.authority = ctx.accounts.authority.key();
        registry.minimum_stake = minimum_stake;
        registry.slash_amount = slash_amount;
        registry.oracle_count = 0;
        registry.bump = ctx.bumps.oracle_registry;

        msg!("KYC Oracle Registry initialized with minimum stake: {} lamports", minimum_stake);
        Ok(())
    }

    /// Register a new KYC oracle
    pub fn register_oracle(
        ctx: Context<RegisterOracle>,
        provider_name: String,
        stake_amount: u64,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.oracle_registry;
        let oracle = &mut ctx.accounts.oracle;

        require!(stake_amount >= registry.minimum_stake, ErrorCode::InsufficientStake);

        oracle.oracle_pubkey = ctx.accounts.oracle_authority.key();
        oracle.provider_name = provider_name.clone();
        oracle.stake_amount = stake_amount;
        oracle.verification_count = 0;
        oracle.successful_verifications = 0;
        oracle.reputation_score = 5000; // Start with 50% (5000 basis points)
        oracle.is_active = true;
        oracle.registered_at = Clock::get()?.unix_timestamp;
        oracle.bump = ctx.bumps.oracle;

        registry.oracle_count += 1;

        emit!(OracleRegisteredEvent {
            oracle_pubkey: oracle.oracle_pubkey,
            provider_name: provider_name,
            stake_amount: stake_amount,
        });

        msg!("KYC Oracle registered: {}", oracle.oracle_pubkey);
        Ok(())
    }

    /// Register a new identity
    pub fn register_identity(
        ctx: Context<RegisterIdentity>,
        identity_id: String,
        arweave_tx_id: String,
    ) -> Result<()> {
        let identity = &mut ctx.accounts.identity;

        require!(identity_id.len() <= 64, ErrorCode::IdentityIdTooLong);
        require!(arweave_tx_id.len() <= 128, ErrorCode::ArweaveTxIdTooLong);

        identity.identity_id = identity_id.clone();
        identity.owner = ctx.accounts.owner.key();
        identity.arweave_tx_id = arweave_tx_id.clone();
        identity.status = IdentityStatus::Pending;
        identity.verification_level = VerificationLevel::None;
        identity.verified_at = None;
        identity.created_at = Clock::get()?.unix_timestamp;
        identity.updated_at = Clock::get()?.unix_timestamp;
        identity.bump = ctx.bumps.identity;

        emit!(IdentityRegisteredEvent {
            identity_id: identity_id,
            owner: identity.owner,
            arweave_tx_id: arweave_tx_id,
        });

        msg!("Identity registered: {}", identity.identity_id);
        Ok(())
    }

    /// Verify an identity (called by KYC oracle)
    pub fn verify_identity(
        ctx: Context<VerifyIdentity>,
        verification_level: VerificationLevel,
        arweave_kyc_tx_id: String,
    ) -> Result<()> {
        let identity = &mut ctx.accounts.identity;
        let oracle = &mut ctx.accounts.oracle;

        require!(identity.status == IdentityStatus::Pending, ErrorCode::InvalidStatus);
        require!(oracle.is_active, ErrorCode::OracleNotActive);
        require!(arweave_kyc_tx_id.len() <= 128, ErrorCode::ArweaveTxIdTooLong);

        identity.status = IdentityStatus::Verified;
        identity.verification_level = verification_level.clone();
        identity.verified_at = Some(Clock::get()?.unix_timestamp);
        identity.arweave_tx_id = arweave_kyc_tx_id.clone();
        identity.updated_at = Clock::get()?.unix_timestamp;

        // Update oracle statistics
        oracle.verification_count += 1;
        oracle.successful_verifications += 1;

        emit!(IdentityVerifiedEvent {
            identity_id: identity.identity_id.clone(),
            verification_level: verification_level,
            oracle_pubkey: oracle.oracle_pubkey,
            arweave_tx_id: arweave_kyc_tx_id,
        });

        msg!("Identity verified: {} at level: {:?}", identity.identity_id, identity.verification_level);
        Ok(())
    }

    /// Update identity information
    pub fn update_identity(
        ctx: Context<UpdateIdentity>,
        new_arweave_tx_id: String,
    ) -> Result<()> {
        let identity = &mut ctx.accounts.identity;

        require!(identity.status == IdentityStatus::Verified, ErrorCode::IdentityNotVerified);
        require!(identity.owner == ctx.accounts.owner.key(), ErrorCode::Unauthorized);
        require!(new_arweave_tx_id.len() <= 128, ErrorCode::ArweaveTxIdTooLong);

        identity.arweave_tx_id = new_arweave_tx_id.clone();
        identity.updated_at = Clock::get()?.unix_timestamp;

        emit!(IdentityUpdatedEvent {
            identity_id: identity.identity_id.clone(),
            arweave_tx_id: new_arweave_tx_id,
        });

        msg!("Identity updated: {}", identity.identity_id);
        Ok(())
    }

    /// Revoke an identity
    pub fn revoke_identity(
        ctx: Context<RevokeIdentity>,
        arweave_revocation_tx_id: String,
    ) -> Result<()> {
        let identity = &mut ctx.accounts.identity;

        require!(identity.owner == ctx.accounts.owner.key(), ErrorCode::Unauthorized);
        require!(arweave_revocation_tx_id.len() <= 128, ErrorCode::ArweaveTxIdTooLong);

        identity.status = IdentityStatus::Revoked;
        identity.arweave_tx_id = arweave_revocation_tx_id.clone();
        identity.updated_at = Clock::get()?.unix_timestamp;

        emit!(IdentityRevokedEvent {
            identity_id: identity.identity_id.clone(),
            arweave_tx_id: arweave_revocation_tx_id,
        });

        msg!("Identity revoked: {}", identity.identity_id);
        Ok(())
    }

    /// Grant access permission
    pub fn grant_access(
        ctx: Context<GrantAccess>,
        permission_type: PermissionType,
        data_types: Vec<DataType>,
        expires_at: Option<i64>,
        arweave_permission_tx_id: String,
    ) -> Result<()> {
        let permission = &mut ctx.accounts.permission;
        let identity = &ctx.accounts.identity;

        require!(identity.status == IdentityStatus::Verified, ErrorCode::IdentityNotVerified);
        require!(identity.owner == ctx.accounts.owner.key(), ErrorCode::Unauthorized);
        require!(data_types.len() > 0, ErrorCode::NoDataTypes);
        require!(data_types.len() <= 10, ErrorCode::TooManyDataTypes);
        require!(arweave_permission_tx_id.len() <= 128, ErrorCode::ArweaveTxIdTooLong);

        permission.identity_id = identity.identity_id.clone();
        permission.consumer = ctx.accounts.consumer.key();
        permission.permission_type = permission_type.clone();
        permission.data_types = data_types.clone();
        permission.granted_at = Clock::get()?.unix_timestamp;
        permission.expires_at = expires_at;
        permission.is_active = true;
        permission.arweave_proof_tx_id = arweave_permission_tx_id.clone();
        permission.bump = ctx.bumps.permission;

        emit!(AccessGrantedEvent {
            identity_id: identity.identity_id.clone(),
            consumer: ctx.accounts.consumer.key(),
            permission_type: permission_type,
            data_types: data_types,
            arweave_tx_id: arweave_permission_tx_id,
        });

        msg!("Access granted for identity: {} to consumer: {}", identity.identity_id, ctx.accounts.consumer.key());
        Ok(())
    }

    /// Revoke access permission
    pub fn revoke_access(
        ctx: Context<RevokeAccess>,
        arweave_revocation_tx_id: String,
    ) -> Result<()> {
        let permission = &mut ctx.accounts.permission;
        let identity = &ctx.accounts.identity;

        require!(identity.owner == ctx.accounts.owner.key(), ErrorCode::Unauthorized);
        require!(permission.is_active, ErrorCode::PermissionNotActive);
        require!(arweave_revocation_tx_id.len() <= 128, ErrorCode::ArweaveTxIdTooLong);

        permission.is_active = false;
        permission.arweave_proof_tx_id = arweave_revocation_tx_id.clone();

        emit!(AccessRevokedEvent {
            identity_id: identity.identity_id.clone(),
            consumer: permission.consumer,
            arweave_tx_id: arweave_revocation_tx_id,
        });

        msg!("Access revoked for identity: {} from consumer: {}", identity.identity_id, permission.consumer);
        Ok(())
    }

    /// Validate access (can be called by marketplace or other programs)
    pub fn validate_access(
        ctx: Context<ValidateAccess>,
        data_type: DataType,
    ) -> Result<()> {
        let permission = &ctx.accounts.permission;
        let identity = &ctx.accounts.identity;

        require!(identity.status == IdentityStatus::Verified, ErrorCode::IdentityNotVerified);
        require!(permission.is_active, ErrorCode::PermissionNotActive);
        require!(permission.data_types.contains(&data_type), ErrorCode::DataTypeNotAuthorized);

        // Check expiration
        if let Some(expires_at) = permission.expires_at {
            require!(Clock::get()?.unix_timestamp < expires_at, ErrorCode::PermissionExpired);
        }

        msg!("Access validated for identity: {} consumer: {} data_type: {:?}",
             identity.identity_id, permission.consumer, data_type);
        Ok(())
    }
}

// Account structures

#[derive(Accounts)]
pub struct InitializeOracleRegistry<'info> {
    #[account(
        init,
        payer = authority,
        space = KYCOracleRegistry::LEN,
        seeds = [b"oracle_registry"],
        bump
    )]
    pub oracle_registry: Account<'info, KYCOracleRegistry>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterOracle<'info> {
    #[account(
        init,
        payer = oracle_authority,
        space = KYCOracle::LEN,
        seeds = [b"oracle", oracle_authority.key().as_ref()],
        bump
    )]
    pub oracle: Account<'info, KYCOracle>,

    #[account(
        mut,
        seeds = [b"oracle_registry"],
        bump = oracle_registry.bump
    )]
    pub oracle_registry: Account<'info, KYCOracleRegistry>,

    #[account(mut)]
    pub oracle_authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(identity_id: String)]
pub struct RegisterIdentity<'info> {
    #[account(
        init,
        payer = owner,
        space = IdentityAccount::LEN,
        seeds = [b"identity", identity_id.as_bytes()],
        bump
    )]
    pub identity: Account<'info, IdentityAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyIdentity<'info> {
    #[account(
        mut,
        seeds = [b"identity", identity.identity_id.as_bytes()],
        bump = identity.bump
    )]
    pub identity: Account<'info, IdentityAccount>,

    #[account(
        mut,
        seeds = [b"oracle", oracle_authority.key().as_ref()],
        bump = oracle.bump
    )]
    pub oracle: Account<'info, KYCOracle>,

    #[account(
        seeds = [b"oracle_registry"],
        bump = oracle_registry.bump
    )]
    pub oracle_registry: Account<'info, KYCOracleRegistry>,

    pub oracle_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateIdentity<'info> {
    #[account(
        mut,
        seeds = [b"identity", identity.identity_id.as_bytes()],
        bump = identity.bump,
        has_one = owner
    )]
    pub identity: Account<'info, IdentityAccount>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct RevokeIdentity<'info> {
    #[account(
        mut,
        seeds = [b"identity", identity.identity_id.as_bytes()],
        bump = identity.bump,
        has_one = owner
    )]
    pub identity: Account<'info, IdentityAccount>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct GrantAccess<'info> {
    #[account(
        init,
        payer = owner,
        space = AccessPermission::LEN,
        seeds = [
            b"permission",
            identity.key().as_ref(),
            consumer.key().as_ref()
        ],
        bump
    )]
    pub permission: Account<'info, AccessPermission>,

    #[account(
        seeds = [b"identity", identity.identity_id.as_bytes()],
        bump = identity.bump
    )]
    pub identity: Account<'info, IdentityAccount>,

    /// CHECK: This is the consumer who will receive access permissions
    pub consumer: AccountInfo<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeAccess<'info> {
    #[account(
        mut,
        seeds = [
            b"permission",
            identity.key().as_ref(),
            permission.consumer.as_ref()
        ],
        bump = permission.bump
    )]
    pub permission: Account<'info, AccessPermission>,

    #[account(
        seeds = [b"identity", identity.identity_id.as_bytes()],
        bump = identity.bump,
        has_one = owner
    )]
    pub identity: Account<'info, IdentityAccount>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ValidateAccess<'info> {
    #[account(
        seeds = [
            b"permission",
            identity.key().as_ref(),
            consumer.key().as_ref()
        ],
        bump = permission.bump
    )]
    pub permission: Account<'info, AccessPermission>,

    #[account(
        seeds = [b"identity", identity.identity_id.as_bytes()],
        bump = identity.bump
    )]
    pub identity: Account<'info, IdentityAccount>,

    pub consumer: Signer<'info>,
}

// Account data structures

#[account]
pub struct KYCOracleRegistry {
    pub authority: Pubkey,
    pub minimum_stake: u64,
    pub slash_amount: u64,
    pub oracle_count: u32,
    pub bump: u8,
}

impl KYCOracleRegistry {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 4 + 1;
}

#[account]
pub struct KYCOracle {
    pub oracle_pubkey: Pubkey,
    pub provider_name: String,
    pub stake_amount: u64,
    pub verification_count: u64,
    pub successful_verifications: u64,
    pub reputation_score: u16,
    pub is_active: bool,
    pub registered_at: i64,
    pub bump: u8,
}

impl KYCOracle {
    pub const LEN: usize = 8 + 32 + (4 + 64) + 8 + 8 + 8 + 2 + 1 + 8 + 1;
}

#[account]
pub struct IdentityAccount {
    pub identity_id: String,
    pub owner: Pubkey,
    pub arweave_tx_id: String,
    pub status: IdentityStatus,
    pub verification_level: VerificationLevel,
    pub verified_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl IdentityAccount {
    pub const LEN: usize = 8 + (4 + 64) + 32 + (4 + 128) + 1 + 1 + (1 + 8) + 8 + 8 + 1;
}

#[account]
pub struct AccessPermission {
    pub identity_id: String,
    pub consumer: Pubkey,
    pub permission_type: PermissionType,
    pub data_types: Vec<DataType>,
    pub granted_at: i64,
    pub expires_at: Option<i64>,
    pub is_active: bool,
    pub arweave_proof_tx_id: String,
    pub bump: u8,
}

impl AccessPermission {
    pub const LEN: usize = 8 + (4 + 64) + 32 + 1 + (4 + 10 * 2) + 8 + (1 + 8) + 1 + (4 + 128) + 1;
}

// Enums

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum IdentityStatus {
    Pending,
    Verified,
    Revoked,
    Suspended,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum VerificationLevel {
    None,
    Basic,
    Enhanced,
    High,
    Credential,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum PermissionType {
    ReadOnly,
    ReadWrite,
    Share,
    Analyze,
    Export,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum DataType {
    LocationHistory,
    AppUsage,
    PurchaseHistory,
    HealthData,
    SocialMediaActivity,
    SearchHistory,
    FinancialData,
    CommunicationData,
    Custom,
}

// Events

#[event]
pub struct OracleRegisteredEvent {
    pub oracle_pubkey: Pubkey,
    pub provider_name: String,
    pub stake_amount: u64,
}

#[event]
pub struct IdentityRegisteredEvent {
    pub identity_id: String,
    pub owner: Pubkey,
    pub arweave_tx_id: String,
}

#[event]
pub struct IdentityVerifiedEvent {
    pub identity_id: String,
    pub verification_level: VerificationLevel,
    pub oracle_pubkey: Pubkey,
    pub arweave_tx_id: String,
}

#[event]
pub struct IdentityUpdatedEvent {
    pub identity_id: String,
    pub arweave_tx_id: String,
}

#[event]
pub struct IdentityRevokedEvent {
    pub identity_id: String,
    pub arweave_tx_id: String,
}

#[event]
pub struct AccessGrantedEvent {
    pub identity_id: String,
    pub consumer: Pubkey,
    pub permission_type: PermissionType,
    pub data_types: Vec<DataType>,
    pub arweave_tx_id: String,
}

#[event]
pub struct AccessRevokedEvent {
    pub identity_id: String,
    pub consumer: Pubkey,
    pub arweave_tx_id: String,
}

// Error codes

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient stake amount")]
    InsufficientStake,
    #[msg("Oracle is not active")]
    OracleNotActive,
    #[msg("Identity ID is too long (max 64 chars)")]
    IdentityIdTooLong,
    #[msg("Arweave transaction ID is too long (max 128 chars)")]
    ArweaveTxIdTooLong,
    #[msg("Invalid identity status for this operation")]
    InvalidStatus,
    #[msg("Identity is not verified")]
    IdentityNotVerified,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Permission is not active")]
    PermissionNotActive,
    #[msg("Data type is not authorized")]
    DataTypeNotAuthorized,
    #[msg("Permission has expired")]
    PermissionExpired,
    #[msg("No data types provided")]
    NoDataTypes,
    #[msg("Too many data types (max 10)")]
    TooManyDataTypes,
}
