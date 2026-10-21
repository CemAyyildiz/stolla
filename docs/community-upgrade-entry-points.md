# Community upgrade entry points

This scaffolding adds `upgrade(new_wasm_hash)` to `CommunityNft` and
`CommunityGovernor`. The hash must already be uploaded to the network. The
contracts do not upload WASM or choose an upgrade target for the caller.

## Authority

- The NFT uses the OpenZeppelin `Ownable` owner for `upgrade`. The same owner
  currently controls minting. Transfer ownership to the community Timelock
  through `transfer_ownership` and `accept_ownership` before activating
  executable governance.
- The Governor reads the current owner of its configured NFT and requires that
  address to authorize `upgrade`. Its upgrade authority therefore follows the
  accepted NFT ownership transfer. Neither a proposer nor the Guardian gets a
  separate upgrade route.
- Both contracts expose `bootstrap_authority_remaining()`. It is true while
  the NFT's constructor owner remains the current NFT owner. Check that it is
  false after the two-step ownership transfer. This is an observable proof for
  these hooks, not a proof that every deployment role has been removed.

Unit tests reject an unauthorized address, reject the former bootstrap owner
after transfer, and invoke each upgrade with a previously uploaded WASM hash
under the new owner's authorization.

## Remaining gate

`CommunityTimelock` and `CommunityTreasury` do not yet exist in this repository.
Their upgrade entry points, self-governed Timelock authorization, queue state
preservation, and bootstrap-role revocation proofs are gated until those
contracts are implemented and reviewed. The NFT/Governor hooks do not make the
current two-contract stack ready for mainnet custody. Follow ADR-006 and the
[testnet-to-mainnet runbook](./testnet-to-mainnet-runbook.md) before deployment.
