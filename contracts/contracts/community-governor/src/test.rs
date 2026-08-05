#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _},
    vec, Address, Env, Event, String, Symbol, Val, Vec,
};
extern crate std;
use stellar_governance::{
    governor::{
        get_proposal_vote_counts, GovernorClient, ProposalCreated, ProposalState, VoteCast,
        VOTE_ABSTAIN, VOTE_AGAINST, VOTE_FOR,
    },
    votes::VotesClient,
};

use community_nft::{CommunityNft, CommunityNftClient};

use crate::CommunityGovernor;

/// Default governance parameters used by most Governor unit tests.
pub struct GovernanceParams {
    pub voting_delay: u32,
    pub voting_period: u32,
    pub proposal_threshold: u128,
    pub quorum: u128,
}

impl Default for GovernanceParams {
    fn default() -> Self {
        Self {
            voting_delay: 1,
            voting_period: 10_000,
            proposal_threshold: 1,
            quorum: 1,
        }
    }
}

/// How many NFTs to mint for a voter and who receives their delegated votes.
pub struct VoterSpec {
    pub nft_count: u32,
    /// When `None`, the voter delegates to themselves.
    pub delegatee: Option<Address>,
}

impl VoterSpec {
    pub fn self_delegate(nft_count: u32) -> Self {
        Self {
            nft_count,
            delegatee: None,
        }
    }
}

/// Signaling proposal payload returned by [`signaling_proposal`].
pub struct SignalingProposal {
    pub targets: Vec<Address>,
    pub functions: Vec<Symbol>,
    pub args: Vec<Vec<Val>>,
    pub description: String,
}

/// Deployed NFT + Governor stack with configured voters.
#[allow(dead_code)] // Fields are part of the shared fixture surface for follow-up tests.
pub struct GovernanceFixture<'a> {
    pub env: &'a Env,
    pub owner: Address,
    pub nft_id: Address,
    pub governor_id: Address,
    pub nft: CommunityNftClient<'a>,
    pub votes: VotesClient<'a>,
    pub governor: GovernorClient<'a>,
    pub params: GovernanceParams,
    pub voters: std::vec::Vec<Address>,
}

impl<'a> GovernanceFixture<'a> {
    pub fn primary_voter(&self) -> &Address {
        self.voters
            .first()
            .expect("fixture must include at least one voter")
    }

    /// Create a signaling proposal from `proposer` and return its id.
    pub fn propose_signaling(&self, proposer: &Address) -> soroban_sdk::BytesN<32> {
        let proposal = signaling_proposal(self.env);
        self.governor.propose(
            &proposal.targets,
            &proposal.functions,
            &proposal.args,
            &proposal.description,
            proposer,
        )
    }
}

/// Set the ledger sequence to an absolute value.
pub fn set_ledger_sequence(e: &Env, sequence: u32) {
    e.ledger().with_mut(|li| {
        li.sequence_number = sequence;
    });
}

/// Advance the ledger sequence by a named delta.
pub fn advance_ledger(e: &Env, by: u32) {
    e.ledger().with_mut(|li| {
        li.sequence_number += by;
    });
}

/// Advance past the voting delay so a freshly created proposal becomes Active.
pub fn advance_past_voting_delay(e: &Env, params: &GovernanceParams) {
    advance_ledger(e, params.voting_delay.saturating_add(1));
}

/// Advance through the full voting period so an Active proposal can close.
pub fn advance_past_voting_period(e: &Env, params: &GovernanceParams) {
    advance_ledger(e, params.voting_period);
}

/// Build the standard no-op signaling proposal payload.
pub fn signaling_proposal(e: &Env) -> SignalingProposal {
    let target = Address::generate(e);
    SignalingProposal {
        targets: vec![e, target],
        functions: vec![e, Symbol::new(e, "noop")],
        args: vec![e, vec![e]],
        description: String::from_str(e, "Signal proposal: welcome members"),
    }
}

fn mint_nfts(e: &Env, nft: &CommunityNftClient<'_>, to: &Address, count: u32) {
    for i in 0..count {
        let uri = String::from_str(e, &std::format!("ipfs://QmMember/{i}/metadata.json"));
        nft.mint(to, &uri);
    }
}

/// Deploy NFT + Governor and provision voters with deterministic mint/delegate setup.
pub fn deploy_governance<'a>(
    e: &'a Env,
    params: GovernanceParams,
    voter_specs: &[VoterSpec],
) -> GovernanceFixture<'a> {
    e.mock_all_auths();

    let owner = Address::generate(e);
    let nft_id = e.register(
        CommunityNft,
        (
            String::from_str(e, "ipfs://collection/"),
            String::from_str(e, "Stolla Community"),
            String::from_str(e, "STOLLA"),
            owner.clone(),
        ),
    );
    let nft = CommunityNftClient::new(e, &nft_id);
    let votes = VotesClient::new(e, &nft_id);

    let mut voters = std::vec::Vec::with_capacity(voter_specs.len());
    for spec in voter_specs {
        let voter = Address::generate(e);
        mint_nfts(e, &nft, &voter, spec.nft_count);
        let delegatee = spec.delegatee.clone().unwrap_or_else(|| voter.clone());
        votes.delegate(&voter, &delegatee);
        voters.push(voter);
    }

    let governor_id = e.register(
        CommunityGovernor,
        (
            nft_id.clone(),
            params.voting_delay,
            params.voting_period,
            params.proposal_threshold,
            params.quorum,
        ),
    );

    GovernanceFixture {
        env: e,
        owner,
        nft_id,
        governor_id: governor_id.clone(),
        nft,
        votes,
        governor: GovernorClient::new(e, &governor_id),
        params,
        voters,
    }
}

/// Convenience wrapper matching the historical single-voter setup.
fn setup_governance(e: &Env) -> GovernanceFixture<'_> {
    deploy_governance(e, GovernanceParams::default(), &[VoterSpec::self_delegate(1)])
}

#[test]
fn multi_voter_fixture_assigns_distinct_weights() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);

    let fixture = deploy_governance(
        &e,
        GovernanceParams {
            voting_delay: 2,
            voting_period: 50,
            proposal_threshold: 1,
            quorum: 3,
        },
        &[
            VoterSpec::self_delegate(1),
            VoterSpec::self_delegate(2),
            VoterSpec::self_delegate(4),
        ],
    );

    assert_eq!(fixture.voters.len(), 3);
    assert_eq!(fixture.votes.get_votes(&fixture.voters[0]), 1);
    assert_eq!(fixture.votes.get_votes(&fixture.voters[1]), 2);
    assert_eq!(fixture.votes.get_votes(&fixture.voters[2]), 4);
    assert_eq!(fixture.params.voting_delay, 2);
    assert_eq!(fixture.params.quorum, 3);

    advance_ledger(&e, 1);
    let proposal_id = fixture.propose_signaling(&fixture.voters[0]);
    advance_past_voting_delay(&e, &fixture.params);

    let reason = String::from_str(&e, "Support");
    fixture
        .governor
        .cast_vote(&proposal_id, &1, &reason, &fixture.voters[1]);
    fixture
        .governor
        .cast_vote(&proposal_id, &0, &reason, &fixture.voters[2]);

    advance_past_voting_period(&e, &fixture.params);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Defeated
    );
}

#[test]
fn propose_and_cast_vote_succeeds() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);

    let fixture = setup_governance(&e);
    let voter = fixture.primary_voter().clone();
    assert_eq!(fixture.votes.get_votes(&voter), 1);

    advance_ledger(&e, 1);

    let proposal = signaling_proposal(&e);
    let proposal_id = fixture.governor.propose(
        &proposal.targets,
        &proposal.functions,
        &proposal.args,
        &proposal.description,
        &voter,
    );

    advance_past_voting_delay(&e, &fixture.params);

    let reason = String::from_str(&e, "Support");
    fixture.governor.cast_vote(&proposal_id, &1, &reason, &voter);

    advance_past_voting_period(&e, &fixture.params);

    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Succeeded
    );
}

#[test]
fn propose_emits_proposal_created_event() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);

    let fixture = setup_governance(&e);
    let voter = fixture.primary_voter().clone();

    advance_ledger(&e, 1);

    let proposal = signaling_proposal(&e);
    let proposal_id = fixture.governor.propose(
        &proposal.targets,
        &proposal.functions,
        &proposal.args,
        &proposal.description,
        &voter,
    );

    let vote_snapshot = 101 + fixture.params.voting_delay;
    let vote_end = vote_snapshot + fixture.params.voting_period;

    let expected = ProposalCreated {
        proposal_id: proposal_id.clone(),
        proposer: voter.clone(),
        targets: proposal.targets.clone(),
        functions: proposal.functions.clone(),
        args: proposal.args.clone(),
        vote_snapshot,
        vote_end,
        description: proposal.description.clone(),
    };

    assert_eq!(
        e.events().all(),
        std::vec![expected.to_xdr(&e, &fixture.governor_id)],
    );

    assert_eq!(proposal_id, expected.proposal_id);
}

#[test]
fn voting_period_boundary_keeps_active_through_inclusive_deadline() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);

    let params = GovernanceParams {
        voting_delay: 1,
        voting_period: 5,
        proposal_threshold: 1,
        quorum: 1,
    };
    let fixture = deploy_governance(
        &e,
        params,
        &[VoterSpec::self_delegate(1), VoterSpec::self_delegate(1)],
    );
    let proposer = fixture.voters[0].clone();
    let late_voter = fixture.voters[1].clone();

    advance_ledger(&e, 1); // propose at ledger 101
    let proposal_id = fixture.propose_signaling(&proposer);
    let snapshot = fixture.governor.proposal_snapshot(&proposal_id);
    let deadline = fixture.governor.proposal_deadline(&proposal_id);
    assert_eq!(snapshot, 102); // 101 + voting_delay
    assert_eq!(deadline, snapshot + fixture.params.voting_period);
    assert_eq!(deadline, 107);

    // First Active ledger is the ledger after snapshot.
    set_ledger_sequence(&e, snapshot + 1);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Active
    );

    // Last Active ledger is the inclusive deadline.
    set_ledger_sequence(&e, deadline);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Active
    );
    let reason = String::from_str(&e, "Boundary For");
    let weight = fixture
        .governor
        .cast_vote(&proposal_id, &VOTE_FOR, &reason, &proposer);
    assert_eq!(weight, 1);

    // First closed ledger is deadline + 1.
    set_ledger_sequence(&e, deadline + 1);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Succeeded
    );

    let counts_before = e.as_contract(&fixture.governor_id, || {
        get_proposal_vote_counts(&e, &proposal_id)
    });
    assert!(!fixture.governor.has_voted(&proposal_id, &late_voter));

    let late_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fixture.governor.cast_vote(
            &proposal_id,
            &VOTE_FOR,
            &String::from_str(&e, "Too late"),
            &late_voter,
        );
    }));
    assert!(late_result.is_err());
    assert!(!fixture.governor.has_voted(&proposal_id, &late_voter));

    let counts_after = e.as_contract(&fixture.governor_id, || {
        get_proposal_vote_counts(&e, &proposal_id)
    });
    assert_eq!(counts_after.for_votes, counts_before.for_votes);
    assert_eq!(counts_after.against_votes, counts_before.against_votes);
    assert_eq!(counts_after.abstain_votes, counts_before.abstain_votes);
}

#[test]
#[should_panic(expected = "Error(Contract, #5002)")]
fn proposal_threshold_rejects_proposer_one_below_boundary() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);

    let fixture = deploy_governance(
        &e,
        GovernanceParams {
            voting_delay: 1,
            voting_period: 10,
            proposal_threshold: 2,
            quorum: 1,
        },
        &[VoterSpec::self_delegate(1)],
    );
    assert_eq!(fixture.votes.get_votes(fixture.primary_voter()), 1);

    advance_ledger(&e, 1);
    let _ = fixture.propose_signaling(fixture.primary_voter());
}

#[test]
fn proposal_threshold_allows_proposer_exactly_at_boundary() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);

    let fixture = deploy_governance(
        &e,
        GovernanceParams {
            voting_delay: 1,
            voting_period: 10,
            proposal_threshold: 2,
            quorum: 1,
        },
        &[VoterSpec::self_delegate(2)],
    );
    let proposer = fixture.primary_voter().clone();
    assert_eq!(fixture.votes.get_votes(&proposer), 2);

    advance_ledger(&e, 1);
    let proposal_id = fixture.propose_signaling(&proposer);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Pending
    );
    assert_eq!(fixture.governor.proposal_proposer(&proposal_id), proposer);
}

#[test]
fn voting_delay_boundary_transitions_pending_to_active() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);

    let params = GovernanceParams {
        voting_delay: 3,
        voting_period: 10,
        proposal_threshold: 1,
        quorum: 1,
    };
    let fixture = deploy_governance(&e, params, &[VoterSpec::self_delegate(1)]);
    let voter = fixture.primary_voter().clone();

    advance_ledger(&e, 1); // propose at 101
    let proposal_id = fixture.propose_signaling(&voter);
    let snapshot = fixture.governor.proposal_snapshot(&proposal_id);
    assert_eq!(snapshot, 104); // 101 + delay 3
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Pending
    );

    // Still Pending on the snapshot ledger itself.
    set_ledger_sequence(&e, snapshot);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Pending
    );

    let early = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fixture.governor.cast_vote(
            &proposal_id,
            &VOTE_FOR,
            &String::from_str(&e, "Early"),
            &voter,
        );
    }));
    assert!(early.is_err());
    assert!(!fixture.governor.has_voted(&proposal_id, &voter));
    let empty = e.as_contract(&fixture.governor_id, || {
        get_proposal_vote_counts(&e, &proposal_id)
    });
    assert_eq!(empty.for_votes, 0);

    // First Active ledger is snapshot + 1.
    set_ledger_sequence(&e, snapshot + 1);
    assert_eq!(
        fixture.governor.proposal_state(&proposal_id),
        ProposalState::Active
    );
    let weight = fixture.governor.cast_vote(
        &proposal_id,
        &VOTE_FOR,
        &String::from_str(&e, "Now open"),
        &voter,
    );
    assert_eq!(weight, 1);
    assert!(fixture.governor.has_voted(&proposal_id, &voter));
}

#[test]
fn weighted_votes_credit_for_against_and_abstain_buckets() {
    let e = Env::default();
    set_ledger_sequence(&e, 100);

    let fixture = deploy_governance(
        &e,
        GovernanceParams {
            voting_delay: 1,
            voting_period: 20,
            proposal_threshold: 1,
            quorum: 1,
        },
        &[
            VoterSpec::self_delegate(1),
            VoterSpec::self_delegate(2),
            VoterSpec::self_delegate(4),
        ],
    );
    let for_voter = fixture.voters[0].clone();
    let against_voter = fixture.voters[1].clone();
    let abstain_voter = fixture.voters[2].clone();

    assert_eq!(fixture.votes.get_votes(&for_voter), 1);
    assert_eq!(fixture.votes.get_votes(&against_voter), 2);
    assert_eq!(fixture.votes.get_votes(&abstain_voter), 4);

    advance_ledger(&e, 1);
    let proposal_id = fixture.propose_signaling(&for_voter);
    advance_past_voting_delay(&e, &fixture.params);

    let for_reason = String::from_str(&e, "For");
    let against_reason = String::from_str(&e, "Against");
    let abstain_reason = String::from_str(&e, "Abstain");

    assert_eq!(
        fixture
            .governor
            .cast_vote(&proposal_id, &VOTE_FOR, &for_reason, &for_voter),
        1
    );
    assert_eq!(
        e.events().all(),
        std::vec![VoteCast {
            voter: for_voter.clone(),
            proposal_id: proposal_id.clone(),
            vote_type: VOTE_FOR,
            weight: 1,
            reason: for_reason,
        }
        .to_xdr(&e, &fixture.governor_id)],
    );

    assert_eq!(
        fixture
            .governor
            .cast_vote(&proposal_id, &VOTE_AGAINST, &against_reason, &against_voter),
        2
    );
    assert_eq!(
        e.events().all(),
        std::vec![VoteCast {
            voter: against_voter.clone(),
            proposal_id: proposal_id.clone(),
            vote_type: VOTE_AGAINST,
            weight: 2,
            reason: against_reason,
        }
        .to_xdr(&e, &fixture.governor_id)],
    );

    assert_eq!(
        fixture
            .governor
            .cast_vote(&proposal_id, &VOTE_ABSTAIN, &abstain_reason, &abstain_voter),
        4
    );
    assert_eq!(
        e.events().all(),
        std::vec![VoteCast {
            voter: abstain_voter.clone(),
            proposal_id: proposal_id.clone(),
            vote_type: VOTE_ABSTAIN,
            weight: 4,
            reason: abstain_reason,
        }
        .to_xdr(&e, &fixture.governor_id)],
    );

    let counts = e.as_contract(&fixture.governor_id, || {
        get_proposal_vote_counts(&e, &proposal_id)
    });
    assert_eq!(counts.for_votes, 1);
    assert_eq!(counts.against_votes, 2);
    assert_eq!(counts.abstain_votes, 4);

    // Casting does not mutate delegated voting power.
    assert_eq!(fixture.votes.get_votes(&for_voter), 1);
    assert_eq!(fixture.votes.get_votes(&against_voter), 2);
    assert_eq!(fixture.votes.get_votes(&abstain_voter), 4);
}
