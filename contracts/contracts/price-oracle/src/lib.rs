//! # Price Oracle Aggregator
//!
//! Aggregates price submissions from authorised relayers and settles fees in a
//! configurable SEP-0041 token (typically the Stellar native XLM token).
//!
//! ## Key design choices
//!
//! * **Configurable settlement token** – the admin sets a SEP-0041–compatible
//!   token address at initialisation time.  Any token (native-asset wrapper,
//!   stablecoin, …) can be used.
//! * **Automatic transfer on submission** – each accepted `submit_price` call
//!   transfers `fee_per_submission` tokens from the fee-pool (this contract's
//!   own balance) to the relayer immediately, so no manual bookkeeping is
//!   needed by the relayer.  If the pool is empty the call still succeeds, but
//!   no transfer takes place (the contract records how much is owed so the
//!   relayer can withdraw once the pool is refilled).
//! * **`withdraw_relayer_fees` endpoint** – a relayer can call this any time to
//!   pull out any accrued-but-unpaid fees (owed balance).
//! * **Access control** – only addresses in the `relayers` list may submit
//!   prices; only the admin may update configuration and the relayer list.

#![no_std]

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, Map, Symbol, Vec,
};

// ---------------------------------------------------------------------------
// Storage key enum
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// The administrator address.
    Admin,
    /// The SEP-0041 token used for fee settlement.
    SettlementToken,
    /// Fee paid to a relayer per accepted price submission (in stroops or the
    /// token's smallest unit).
    FeePerSubmission,
    /// Set of addresses authorised to submit prices.
    Relayers,
    /// Latest aggregated price for an asset pair symbol (e.g. "XLM_USDC").
    Price(Symbol),
    /// Ledger sequence of the last update for a given asset symbol.
    PriceTs(Symbol),
    /// Accrued-but-unpaid fees owed to a relayer (used when the pool has
    /// insufficient balance at submission time).
    OwedFees(Address),
}

// ---------------------------------------------------------------------------
// SEP-0041 token client (generated at compile time by soroban-sdk)
// ---------------------------------------------------------------------------

// `token::Client` is the standard SEP-0041 interface shipped with soroban-sdk.
// We use it to call `transfer` on the settlement token contract.

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct PriceOracle;

#[contractimpl]
impl PriceOracle {
    // -----------------------------------------------------------------------
    // Initialisation
    // -----------------------------------------------------------------------

    /// Initialise the oracle.
    ///
    /// * `admin`            – address that controls configuration.
    /// * `settlement_token` – SEP-0041 token contract used to pay relayer fees.
    /// * `fee_per_submission` – amount (in the token's smallest unit) transferred
    ///   to the relayer for each accepted price submission.
    pub fn __constructor(
        e: &Env,
        admin: Address,
        settlement_token: Address,
        fee_per_submission: i128,
    ) {
        admin.require_auth();
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage()
            .instance()
            .set(&DataKey::SettlementToken, &settlement_token);
        e.storage()
            .instance()
            .set(&DataKey::FeePerSubmission, &fee_per_submission);

        let relayers: Vec<Address> = Vec::new(e);
        e.storage().instance().set(&DataKey::Relayers, &relayers);
    }

    // -----------------------------------------------------------------------
    // Admin – configuration
    // -----------------------------------------------------------------------

    /// Update the settlement token.  Only the admin may call this.
    pub fn set_settlement_token(e: &Env, settlement_token: Address) {
        Self::require_admin(e);
        e.storage()
            .instance()
            .set(&DataKey::SettlementToken, &settlement_token);
    }

    /// Update the per-submission fee amount.  Only the admin may call this.
    pub fn set_fee_per_submission(e: &Env, fee_per_submission: i128) {
        Self::require_admin(e);
        e.storage()
            .instance()
            .set(&DataKey::FeePerSubmission, &fee_per_submission);
    }

    /// Replace the full relayer allowlist.  Only the admin may call this.
    pub fn set_relayers(e: &Env, relayers: Vec<Address>) {
        Self::require_admin(e);
        e.storage().instance().set(&DataKey::Relayers, &relayers);
    }

    /// Add a single relayer to the allowlist.  Only the admin may call this.
    pub fn add_relayer(e: &Env, relayer: Address) {
        Self::require_admin(e);
        let mut relayers: Vec<Address> = e
            .storage()
            .instance()
            .get(&DataKey::Relayers)
            .unwrap_or_else(|| Vec::new(e));
        if !relayers.contains(&relayer) {
            relayers.push_back(relayer);
        }
        e.storage().instance().set(&DataKey::Relayers, &relayers);
    }

    /// Remove a single relayer from the allowlist.  Only the admin may call this.
    pub fn remove_relayer(e: &Env, relayer: Address) {
        Self::require_admin(e);
        let relayers: Vec<Address> = e
            .storage()
            .instance()
            .get(&DataKey::Relayers)
            .unwrap_or_else(|| Vec::new(e));
        let mut updated: Vec<Address> = Vec::new(e);
        for i in 0..relayers.len() {
            let r = relayers.get(i).unwrap();
            if r != relayer {
                updated.push_back(r);
            }
        }
        e.storage().instance().set(&DataKey::Relayers, &updated);
    }

    // -----------------------------------------------------------------------
    // Core oracle – price submission
    // -----------------------------------------------------------------------

    /// Submit (or update) the price for `asset`.
    ///
    /// The caller must be in the relayer allowlist.  Upon success the contract
    /// immediately attempts to transfer `fee_per_submission` tokens from its
    /// own balance to the relayer.  If the contract holds insufficient tokens
    /// the owed amount is recorded and the relayer can later call
    /// `withdraw_relayer_fees` to claim it.
    ///
    /// Returns the new aggregated price (currently a passthrough – extend this
    /// with median/TWAP logic as needed).
    pub fn submit_price(e: &Env, relayer: Address, asset: Symbol, price: i128) -> i128 {
        relayer.require_auth();
        Self::require_relayer(e, &relayer);

        // Store price + timestamp.
        e.storage().persistent().set(&DataKey::Price(asset.clone()), &price);
        e.storage()
            .persistent()
            .set(&DataKey::PriceTs(asset), &e.ledger().sequence());

        // Settle fee immediately or accrue it.
        Self::settle_fee(e, &relayer);

        price
    }

    // -----------------------------------------------------------------------
    // Relayer fee withdrawal
    // -----------------------------------------------------------------------

    /// Withdraw any accrued-but-unpaid fees owed to `relayer`.
    ///
    /// This is necessary when the fee pool was empty at submission time and the
    /// owed balance was only recorded.  The relayer calls this once the pool has
    /// been refilled.
    pub fn withdraw_relayer_fees(e: &Env, relayer: Address) {
        relayer.require_auth();

        let owed: i128 = e
            .storage()
            .instance()
            .get(&DataKey::OwedFees(relayer.clone()))
            .unwrap_or(0_i128);

        if owed <= 0 {
            return;
        }

        let token_addr: Address = e
            .storage()
            .instance()
            .get(&DataKey::SettlementToken)
            .unwrap();
        let token = token::Client::new(e, &token_addr);

        let contract_balance = token.balance(&e.current_contract_address());
        if contract_balance >= owed {
            // Clear owed record before transfer (reentrancy safety).
            e.storage()
                .instance()
                .set(&DataKey::OwedFees(relayer.clone()), &0_i128);
            token.transfer(&e.current_contract_address(), &relayer, &owed);
        } else if contract_balance > 0 {
            // Pay what we can, keep the remainder owed.
            let remaining = owed - contract_balance;
            e.storage()
                .instance()
                .set(&DataKey::OwedFees(relayer.clone()), &remaining);
            token.transfer(
                &e.current_contract_address(),
                &relayer,
                &contract_balance,
            );
        }
        // If contract_balance == 0 we do nothing; owed stays as-is.
    }

    // -----------------------------------------------------------------------
    // Read-only accessors
    // -----------------------------------------------------------------------

    /// Return the latest aggregated price for `asset`.
    pub fn price(e: &Env, asset: Symbol) -> i128 {
        e.storage()
            .persistent()
            .get(&DataKey::Price(asset))
            .unwrap_or(0_i128)
    }

    /// Return the ledger sequence of the last price update for `asset`.
    pub fn price_timestamp(e: &Env, asset: Symbol) -> u32 {
        e.storage()
            .persistent()
            .get(&DataKey::PriceTs(asset))
            .unwrap_or(0_u32)
    }

    /// Return the accrued-but-unpaid fee balance for `relayer`.
    pub fn owed_fees(e: &Env, relayer: Address) -> i128 {
        e.storage()
            .instance()
            .get(&DataKey::OwedFees(relayer))
            .unwrap_or(0_i128)
    }

    /// Return the current per-submission fee.
    pub fn fee_per_submission(e: &Env) -> i128 {
        e.storage()
            .instance()
            .get(&DataKey::FeePerSubmission)
            .unwrap_or(0_i128)
    }

    /// Return the settlement token address.
    pub fn settlement_token(e: &Env) -> Address {
        e.storage()
            .instance()
            .get(&DataKey::SettlementToken)
            .unwrap()
    }

    /// Return the current admin address.
    pub fn admin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Return the full relayer allowlist.
    pub fn relayers(e: &Env) -> Vec<Address> {
        e.storage()
            .instance()
            .get(&DataKey::Relayers)
            .unwrap_or_else(|| Vec::new(e))
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /// Immediately transfer `fee_per_submission` tokens to `relayer`, or
    /// accrue the owed amount when the pool balance is insufficient.
    fn settle_fee(e: &Env, relayer: &Address) {
        let fee: i128 = e
            .storage()
            .instance()
            .get(&DataKey::FeePerSubmission)
            .unwrap_or(0_i128);

        if fee <= 0 {
            return;
        }

        let token_addr: Address = e
            .storage()
            .instance()
            .get(&DataKey::SettlementToken)
            .unwrap();
        let token = token::Client::new(e, &token_addr);

        let contract_balance = token.balance(&e.current_contract_address());

        if contract_balance >= fee {
            // Immediate settlement.
            token.transfer(&e.current_contract_address(), relayer, &fee);
        } else {
            // Accrue owed balance.
            let prev_owed: i128 = e
                .storage()
                .instance()
                .get(&DataKey::OwedFees(relayer.clone()))
                .unwrap_or(0_i128);
            e.storage()
                .instance()
                .set(&DataKey::OwedFees(relayer.clone()), &(prev_owed + fee));
        }
    }

    /// Panic unless the caller is the admin.
    fn require_admin(e: &Env) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
    }

    /// Panic unless `relayer` is in the authorised allowlist.
    fn require_relayer(e: &Env, relayer: &Address) {
        let relayers: Vec<Address> = e
            .storage()
            .instance()
            .get(&DataKey::Relayers)
            .unwrap_or_else(|| Vec::new(e));
        assert!(relayers.contains(relayer), "Unauthorized: not a relayer");
    }

    /// Compute a median from a sorted map of (relayer → submission) values.
    /// Exported for completeness; callers may use this for aggregation.
    pub fn median(e: &Env, submissions: Map<Address, i128>) -> i128 {
        let n = submissions.len();
        if n == 0 {
            return 0;
        }
        let mut values: Vec<i128> = Vec::new(e);
        for (_k, v) in submissions.iter() {
            values.push_back(v);
        }
        // Simple insertion sort (n is expected to be small – few relayers).
        for i in 1..values.len() {
            let mut j = i;
            while j > 0 {
                let a = values.get(j - 1).unwrap();
                let b = values.get(j).unwrap();
                if a > b {
                    values.set(j - 1, b);
                    values.set(j, a);
                    j -= 1;
                } else {
                    break;
                }
            }
        }
        let mid = n / 2;
        if n % 2 == 0 {
            let lo = values.get(mid - 1).unwrap();
            let hi = values.get(mid).unwrap();
            (lo + hi) / 2
        } else {
            values.get(mid).unwrap()
        }
    }
}
