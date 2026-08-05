#![no_std]

mod test;

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, Symbol, Val, Vec};
use stellar_governance::governor::{self as governor, Governor, ProposalState};

const DAY_IN_LEDGERS: u32 = 17_280;
pub const STORAGE_EXTEND_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
pub const STORAGE_TTL_THRESHOLD: u32 = STORAGE_EXTEND_AMOUNT - DAY_IN_LEDGERS;

#[contract]
pub struct CommunityGovernor;

fn bump_instance_ttl(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(STORAGE_TTL_THRESHOLD, STORAGE_EXTEND_AMOUNT);
}

#[contractimpl]
impl CommunityGovernor {
    pub fn __constructor(
        e: &Env,
        token_contract: Address,
        voting_delay: u32,
        voting_period: u32,
        proposal_threshold: u128,
        quorum: u128,
    ) {
        governor::set_name(e, String::from_str(e, "StollaGovernor"));
        governor::set_version(e, String::from_str(e, "1.0.0"));
        governor::set_token_contract(e, &token_contract);
        governor::set_voting_delay(e, voting_delay);
        governor::set_voting_period(e, voting_period);
        governor::set_proposal_threshold(e, proposal_threshold);
        governor::set_quorum(e, quorum);
        bump_instance_ttl(e);
    }

    /// Permissionlessly renew the contract instance and governance configuration.
    ///
    /// Scalable proposal and vote records are renewed separately when read.
    pub fn extend_instance_ttl(e: &Env) {
        bump_instance_ttl(e);
    }
}

#[contractimpl(contracttrait)]
impl Governor for CommunityGovernor {
    fn execute(
        e: &Env,
        targets: Vec<Address>,
        functions: Vec<Symbol>,
        args: Vec<Vec<Val>>,
        description_hash: BytesN<32>,
        executor: Address,
    ) -> BytesN<32> {
        bump_instance_ttl(e);
        executor.require_auth();
        let proposal_id =
            governor::hash_proposal(e, &targets, &functions, &args, &description_hash);
        let snapshot = governor::get_proposal_snapshot(e, &proposal_id);
        let quorum = Self::quorum(e, snapshot);
        governor::execute(
            e,
            targets,
            functions,
            args,
            &description_hash,
            Self::proposals_need_queuing(e),
            quorum,
        )
    }

    fn cancel(
        e: &Env,
        targets: Vec<Address>,
        functions: Vec<Symbol>,
        args: Vec<Vec<Val>>,
        description_hash: BytesN<32>,
        operator: Address,
    ) -> BytesN<32> {
        bump_instance_ttl(e);
        let proposal_id =
            governor::hash_proposal(e, &targets, &functions, &args, &description_hash);
        let proposer = governor::get_proposal_proposer(e, &proposal_id);
        assert!(operator == proposer);
        operator.require_auth();
        governor::cancel(e, targets, functions, args, &description_hash)
    }
}
