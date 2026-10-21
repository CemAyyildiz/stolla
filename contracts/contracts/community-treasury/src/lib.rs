#![no_std]

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Bytes, Env,
    Vec,
};

const DAY_IN_LEDGERS: u32 = 17_280;
pub const STORAGE_EXTEND_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
pub const STORAGE_TTL_THRESHOLD: u32 = STORAGE_EXTEND_AMOUNT - DAY_IN_LEDGERS;
/// ADR-006 rolling spend window: about 24 hours at a five-second ledger close.
pub const DEFAULT_PERIOD_LEDGERS: u32 = DAY_IN_LEDGERS;
pub const MAX_RECIPIENTS: u32 = 32;

/// Spend limits for one allowlisted SEP-41 asset.
///
/// A zero `max_per_call` or `max_per_period` disables spending. Neither value
/// means unlimited. `period_ledgers` is a tumbling window measured in ledger
/// sequence numbers, starting at the first spend of that window.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AssetPolicy {
    pub max_per_call: i128,
    pub max_per_period: i128,
    pub period_ledgers: u32,
    pub recipients_restricted: bool,
    pub recipients: Vec<Address>,
}

/// Amount already spent in the open tumbling window for one asset.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PeriodSpend {
    pub window_start: u32,
    pub spent: i128,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Timelock,
    AssetPolicy(Address),
    PeriodSpend(Address),
}

/// Errors returned when a deposit, spend, or policy change is rejected.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum TreasuryError {
    /// Amount must be greater than zero.
    AmountNotPositive = 1,
    /// The asset has no stored policy.
    AssetNotAllowed = 2,
    /// A zero cap disables spending for this asset.
    SpendingDisabled = 3,
    /// The amount is above the per-call cap.
    ExceedsPerCallCap = 4,
    /// The amount would exceed the current period cap.
    ExceedsPeriodCap = 5,
    /// Recipient allowlist is enabled and does not include this address.
    RecipientNotAllowed = 6,
    /// The recipient is this treasury contract.
    InvalidRecipient = 7,
    /// The treasury balance is below the requested amount.
    InsufficientBalance = 8,
    /// A cap must be zero or positive.
    InvalidCap = 9,
    /// The period length must be at least one ledger.
    InvalidPeriod = 10,
    /// The recipient allowlist is full.
    RecipientListFull = 11,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Deposited {
    #[topic]
    pub asset: Address,
    #[topic]
    pub from: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TreasuryPayment {
    #[topic]
    pub asset: Address,
    #[topic]
    pub recipient: Address,
    pub amount: i128,
    pub reference: Bytes,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PolicyChanged {
    #[topic]
    pub asset: Address,
    pub max_per_call: i128,
    pub max_per_period: i128,
    pub period_ledgers: u32,
    pub recipients_restricted: bool,
    pub removed: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecipientChanged {
    #[topic]
    pub asset: Address,
    #[topic]
    pub recipient: Address,
    pub allowed: bool,
}

#[contract]
pub struct CommunityTreasury;

fn bump_instance(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(STORAGE_TTL_THRESHOLD, STORAGE_EXTEND_AMOUNT);
}

fn extend_persistent(e: &Env, key: &DataKey) {
    e.storage()
        .persistent()
        .extend_ttl(key, STORAGE_TTL_THRESHOLD, STORAGE_EXTEND_AMOUNT);
}

fn require_timelock(e: &Env) {
    let timelock: Address = e.storage().instance().get(&DataKey::Timelock).unwrap();
    timelock.require_auth();
}

fn read_policy(e: &Env, asset: &Address) -> Option<AssetPolicy> {
    let key = DataKey::AssetPolicy(asset.clone());
    let policy: Option<AssetPolicy> = e.storage().persistent().get(&key);
    if policy.is_some() {
        extend_persistent(e, &key);
    }
    policy
}

fn write_policy(e: &Env, asset: &Address, policy: &AssetPolicy) {
    let key = DataKey::AssetPolicy(asset.clone());
    e.storage().persistent().set(&key, policy);
    extend_persistent(e, &key);
}

fn recipient_index(recipients: &Vec<Address>, recipient: &Address) -> Option<u32> {
    let len = recipients.len();
    let mut index = 0u32;
    while index < len {
        if recipients.get(index).as_ref() == Some(recipient) {
            return Some(index);
        }
        index += 1;
    }
    None
}

fn active_window(e: &Env, asset: &Address, period_ledgers: u32) -> PeriodSpend {
    let now = e.ledger().sequence();
    let key = DataKey::PeriodSpend(asset.clone());
    if let Some(existing) = e.storage().persistent().get::<_, PeriodSpend>(&key) {
        if let Some(end) = existing.window_start.checked_add(period_ledgers) {
            if now < end {
                return existing;
            }
        }
    }
    PeriodSpend {
        window_start: now,
        spent: 0,
    }
}

fn validate_caps(
    max_per_call: i128,
    max_per_period: i128,
    period_ledgers: u32,
) -> Result<(), TreasuryError> {
    if max_per_call < 0 || max_per_period < 0 {
        return Err(TreasuryError::InvalidCap);
    }
    if period_ledgers == 0 {
        return Err(TreasuryError::InvalidPeriod);
    }
    Ok(())
}

#[contractimpl]
impl CommunityTreasury {
    /// Store the only address allowed to spend or change policy.
    ///
    /// The address is a configured Timelock. This contract does not link
    /// against Timelock implementation code.
    pub fn __constructor(e: &Env, timelock: Address) {
        e.storage().instance().set(&DataKey::Timelock, &timelock);
        bump_instance(e);
    }

    pub fn timelock(e: &Env) -> Address {
        bump_instance(e);
        e.storage().instance().get(&DataKey::Timelock).unwrap()
    }

    pub fn asset_policy(e: &Env, asset: Address) -> Option<AssetPolicy> {
        bump_instance(e);
        read_policy(e, &asset)
    }

    /// Stored period counter, without applying window expiry.
    pub fn period_spend(e: &Env, asset: Address) -> Option<PeriodSpend> {
        bump_instance(e);
        let key = DataKey::PeriodSpend(asset);
        let spend: Option<PeriodSpend> = e.storage().persistent().get(&key);
        if spend.is_some() {
            extend_persistent(e, &key);
        }
        spend
    }

    /// Period counter a later `pay` would use, including a reset window.
    pub fn effective_period_spend(e: &Env, asset: Address) -> Option<PeriodSpend> {
        bump_instance(e);
        let policy = read_policy(e, &asset)?;
        Some(active_window(e, &asset, policy.period_ledgers))
    }

    /// Permissionlessly renew instance configuration.
    pub fn extend_instance_ttl(e: &Env) {
        bump_instance(e);
    }

    /// Replace spend limits for an asset. Existing recipients are kept.
    ///
    /// Only the stored Timelock can call this. A zero cap is stored and
    /// disables later spends.
    pub fn set_asset_policy(
        e: &Env,
        asset: Address,
        max_per_call: i128,
        max_per_period: i128,
        period_ledgers: u32,
        recipients_restricted: bool,
    ) -> Result<(), TreasuryError> {
        require_timelock(e);
        validate_caps(max_per_call, max_per_period, period_ledgers)?;
        let recipients = read_policy(e, &asset)
            .map(|policy| policy.recipients)
            .unwrap_or_else(|| Vec::new(e));
        let policy = AssetPolicy {
            max_per_call,
            max_per_period,
            period_ledgers,
            recipients_restricted,
            recipients,
        };
        write_policy(e, &asset, &policy);
        bump_instance(e);
        PolicyChanged {
            asset,
            max_per_call,
            max_per_period,
            period_ledgers,
            recipients_restricted,
            removed: false,
        }
        .publish(e);
        Ok(())
    }

    /// Add or remove one allowlisted recipient for an asset.
    pub fn set_recipient(
        e: &Env,
        asset: Address,
        recipient: Address,
        allowed: bool,
    ) -> Result<(), TreasuryError> {
        require_timelock(e);
        if recipient == e.current_contract_address() {
            return Err(TreasuryError::InvalidRecipient);
        }
        let mut policy = read_policy(e, &asset).ok_or(TreasuryError::AssetNotAllowed)?;
        let existing = recipient_index(&policy.recipients, &recipient);
        if allowed {
            if existing.is_none() {
                if policy.recipients.len() >= MAX_RECIPIENTS {
                    return Err(TreasuryError::RecipientListFull);
                }
                policy.recipients.push_back(recipient.clone());
            }
        } else if let Some(index) = existing {
            policy.recipients.remove(index);
        }
        write_policy(e, &asset, &policy);
        bump_instance(e);
        RecipientChanged {
            asset,
            recipient,
            allowed,
        }
        .publish(e);
        Ok(())
    }

    /// Drop an asset policy so deposits and spends are rejected.
    pub fn remove_asset(e: &Env, asset: Address) -> Result<(), TreasuryError> {
        require_timelock(e);
        let policy_key = DataKey::AssetPolicy(asset.clone());
        if !e.storage().persistent().has(&policy_key) {
            return Err(TreasuryError::AssetNotAllowed);
        }
        e.storage().persistent().remove(&policy_key);
        let spend_key = DataKey::PeriodSpend(asset.clone());
        e.storage().persistent().remove(&spend_key);
        bump_instance(e);
        PolicyChanged {
            asset,
            max_per_call: 0,
            max_per_period: 0,
            period_ledgers: 0,
            recipients_restricted: false,
            removed: true,
        }
        .publish(e);
        Ok(())
    }

    /// Pull an allowlisted asset into the treasury and emit `deposited`.
    pub fn deposit(
        e: &Env,
        from: Address,
        asset: Address,
        amount: i128,
    ) -> Result<(), TreasuryError> {
        from.require_auth();
        if amount <= 0 {
            return Err(TreasuryError::AmountNotPositive);
        }
        if read_policy(e, &asset).is_none() {
            return Err(TreasuryError::AssetNotAllowed);
        }
        let treasury = e.current_contract_address();
        token::Client::new(e, &asset).transfer(&from, &treasury, &amount);
        bump_instance(e);
        Deposited {
            asset,
            from,
            amount,
        }
        .publish(e);
        Ok(())
    }

    /// Send an allowlisted asset. Only the stored Timelock can authorize this.
    ///
    /// `reference` is opaque bytes supplied by the caller, typically the
    /// Timelock action id. This contract does not verify that id.
    pub fn pay(
        e: &Env,
        asset: Address,
        recipient: Address,
        amount: i128,
        reference: Bytes,
    ) -> Result<(), TreasuryError> {
        require_timelock(e);
        if amount <= 0 {
            return Err(TreasuryError::AmountNotPositive);
        }
        let treasury = e.current_contract_address();
        if recipient == treasury {
            return Err(TreasuryError::InvalidRecipient);
        }
        let policy = read_policy(e, &asset).ok_or(TreasuryError::AssetNotAllowed)?;
        if policy.max_per_call == 0 || policy.max_per_period == 0 {
            return Err(TreasuryError::SpendingDisabled);
        }
        if amount > policy.max_per_call {
            return Err(TreasuryError::ExceedsPerCallCap);
        }
        if policy.recipients_restricted && recipient_index(&policy.recipients, &recipient).is_none()
        {
            return Err(TreasuryError::RecipientNotAllowed);
        }

        let mut window = active_window(e, &asset, policy.period_ledgers);
        let spent = window
            .spent
            .checked_add(amount)
            .ok_or(TreasuryError::ExceedsPeriodCap)?;
        if spent > policy.max_per_period {
            return Err(TreasuryError::ExceedsPeriodCap);
        }

        let token_client = token::Client::new(e, &asset);
        if token_client.balance(&treasury) < amount {
            return Err(TreasuryError::InsufficientBalance);
        }

        window.spent = spent;
        let spend_key = DataKey::PeriodSpend(asset.clone());
        e.storage().persistent().set(&spend_key, &window);
        extend_persistent(e, &spend_key);
        bump_instance(e);
        token_client.transfer(&treasury, &recipient, &amount);
        TreasuryPayment {
            asset,
            recipient,
            amount,
            reference,
        }
        .publish(e);
        Ok(())
    }
}
