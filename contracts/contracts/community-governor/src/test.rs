#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _},
    vec, Address, Env, Event, String, Symbol, Val, Vec,
};
extern crate std;
use stellar_governance::{
    governor::{GovernorClient, ProposalCreated, ProposalState},
    votes::VotesClient,
};

use community_nft::CommunityNft;

use crate::CommunityGovernor;

const VOTING_DELAY: u32 = 1;
const VOTING_PERIOD: u32 = 10_000;
const PROPOSAL_THRESHOLD: u128 = 1;
const QUORUM: u128 = 1;

fn simple_proposal(e: &Env) -> (Vec<Address>, Vec<Symbol>, Vec<Vec<Val>>, String) {
    let target = Address::generate(e);
    let targets = vec![e, target];
    let functions = vec![e, Symbol::new(e, "noop")];
    let args: Vec<Vec<Val>> = vec![e, vec![e]];
    let description = String::from_str(e, "Signal proposal: welcome members");
    (targets, functions, args, description)
}

fn setup_governance(e: &Env) -> (Address, GovernorClient<'_>, VotesClient<'_>, Address) {
    e.mock_all_auths();

    let owner = Address::generate(e);
    let voter = Address::generate(e);

    let nft_id = e.register(
        CommunityNft,
        (
            String::from_str(e, "ipfs://collection/"),
            String::from_str(e, "Stolla Community"),
            String::from_str(e, "STOLLA"),
            owner.clone(),
        ),
    );
    let nft = community_nft::CommunityNftClient::new(e, &nft_id);
    nft.mint(&voter, &String::from_str(e, "ipfs://QmMember/metadata.json"));

    let votes = VotesClient::new(e, &nft_id);
    votes.delegate(&voter, &voter);

    let governor_id = e.register(
        CommunityGovernor,
        (
            nft_id.clone(),
            VOTING_DELAY,
            VOTING_PERIOD,
            PROPOSAL_THRESHOLD,
            QUORUM,
        ),
    );

    (
        voter,
        GovernorClient::new(e, &governor_id),
        votes,
        governor_id,
    )
}

#[test]
fn propose_and_cast_vote_succeeds() {
    let e = Env::default();
    e.ledger().with_mut(|li| {
        li.sequence_number = 100;
    });

    let (voter, governor, votes, _) = setup_governance(&e);
    assert_eq!(votes.get_votes(&voter), 1);

    e.ledger().with_mut(|li| {
        li.sequence_number += 1;
    });

    let (targets, functions, calldata, description) = simple_proposal(&e);
    let proposal_id = governor.propose(&targets, &functions, &calldata, &description, &voter);

    e.ledger().with_mut(|li| {
        li.sequence_number += VOTING_DELAY + 1;
    });

    let reason = String::from_str(&e, "Support");
    governor.cast_vote(&proposal_id, &1, &reason, &voter);

    e.ledger().with_mut(|li| {
        li.sequence_number += VOTING_PERIOD;
    });

    assert_eq!(
        governor.proposal_state(&proposal_id),
        ProposalState::Succeeded
    );
}

#[test]
fn propose_emits_proposal_created_event() {
    let e = Env::default();
    e.ledger().with_mut(|li| {
        li.sequence_number = 100;
    });

    let (voter, governor, _votes, governor_id) = setup_governance(&e);

    e.ledger().with_mut(|li| {
        li.sequence_number += 1;
    });

    let (targets, functions, calldata, description) = simple_proposal(&e);
    let proposal_id = governor.propose(&targets, &functions, &calldata, &description, &voter);

    let vote_snapshot = 101 + VOTING_DELAY;
    let vote_end = vote_snapshot + VOTING_PERIOD;

    let expected = ProposalCreated {
        proposal_id: proposal_id.clone(),
        proposer: voter.clone(),
        targets: targets.clone(),
        functions: functions.clone(),
        args: calldata.clone(),
        vote_snapshot,
        vote_end,
        description: description.clone(),
    };

    assert_eq!(
        e.events().all(),
        std::vec![expected.to_xdr(&e, &governor_id)],
    );

    assert_eq!(proposal_id, expected.proposal_id);
}
