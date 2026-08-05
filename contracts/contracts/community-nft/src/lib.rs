#![no_std]

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, String,
};
use stellar_access::ownable::{set_owner, Ownable};
use stellar_governance::votes::Votes;
use stellar_macros::only_owner;
use stellar_tokens::non_fungible::{votes::NonFungibleVotes, Base, NonFungibleToken};

#[contracttype]
pub enum DataKey {
    TokenUri(u32),
}

/// Stable errors returned by the Community NFT contract.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum CommunityNftError {
    /// The per-token metadata URI must contain at least one byte.
    EmptyTokenUri = 1,
}

const DAY_IN_LEDGERS: u32 = 17_280;
pub const STORAGE_EXTEND_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
pub const STORAGE_TTL_THRESHOLD: u32 = STORAGE_EXTEND_AMOUNT - DAY_IN_LEDGERS;

#[contract]
pub struct CommunityNft;

fn bump_instance_ttl(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(STORAGE_TTL_THRESHOLD, STORAGE_EXTEND_AMOUNT);
}

#[contractimpl]
impl CommunityNft {
    pub fn __constructor(e: &Env, uri: String, name: String, symbol: String, owner: Address) {
        Base::set_metadata(e, uri, name, symbol);
        set_owner(e, &owner);
        bump_instance_ttl(e);
    }

    /// Mint an NFT with an unchanged, non-empty metadata URI.
    ///
    /// Whitespace is significant and is neither trimmed nor rejected.
    ///
    /// # Errors
    ///
    /// Panics with [`CommunityNftError::EmptyTokenUri`] before changing any
    /// token, ownership, URI, counter, or voting-power state when `token_uri`
    /// has zero bytes.
    #[only_owner]
    pub fn mint(e: &Env, to: Address, token_uri: String) -> u32 {
        if token_uri.len() == 0 {
            panic_with_error!(e, CommunityNftError::EmptyTokenUri);
        }
        bump_instance_ttl(e);
        let token_id = NonFungibleVotes::sequential_mint(e, &to);
        let key = DataKey::TokenUri(token_id);
        e.storage().persistent().set(&key, &token_uri);
        e.storage()
            .persistent()
            .extend_ttl(&key, STORAGE_TTL_THRESHOLD, STORAGE_EXTEND_AMOUNT);
        token_id
    }

    pub fn custom_token_uri(e: &Env, token_id: u32) -> String {
        bump_instance_ttl(e);
        let key = DataKey::TokenUri(token_id);
        e.storage()
            .persistent()
            .get(&key)
            .inspect(|_| {
                e.storage().persistent().extend_ttl(
                    &key,
                    STORAGE_TTL_THRESHOLD,
                    STORAGE_EXTEND_AMOUNT,
                );
            })
            .unwrap_or_else(|| Base::token_uri(e, token_id))
    }

    /// Permissionlessly renew the contract instance and its configuration.
    ///
    /// Scalable persistent records are renewed separately when they are read.
    pub fn extend_instance_ttl(e: &Env) {
        bump_instance_ttl(e);
    }
}

#[contractimpl(contracttrait)]
impl NonFungibleToken for CommunityNft {
    type ContractType = NonFungibleVotes;
}

#[contractimpl(contracttrait)]
impl Votes for CommunityNft {}

#[contractimpl(contracttrait)]
impl Ownable for CommunityNft {}
