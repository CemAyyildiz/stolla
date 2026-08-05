# Community metadata and governance schema

This is the version-1 schema used by `CommunityFactory`. It is the normative
schema follow-up to [ADR-005: CommunityFactory and on-chain registry](adr/005-community-factory-registry.md).
The Rust contract types are defined in
[`community-factory/src/lib.rs`](../contracts/contracts/community-factory/src/lib.rs).

## On-chain creation schema

Soroban contract values use canonical SCVal/XDR serialization. Struct field
names and integer widths below are part of the public interface; clients must
not serialize these structs as JSON when invoking the contract.

### `CreateCommunityRequest`

| Field | Soroban type | Required | Validation | Update policy |
|---|---|---:|---|---|
| `community_owner` | `Address` | yes | Valid Soroban account or contract address | Immutable in the registry; becomes the NFT owner |
| `external_key` | `Bytes` | yes | 1–64 bytes; interpreted as opaque bytes | Immutable and included in the community ID |
| `metadata` | `CommunityMetadata` | yes | Version-1 rules below | Registry commitment immutable; NFT ownership controls future NFT operations |
| `governance` | `GovernanceParams` | yes | Bounds below | Immutable constructor configuration in the Governor |

`creator` is a separate `Address` argument to `create_community`. Version 1
requires its authorization and requires it to equal the factory owner.

### `CommunityMetadata`

| Field | Soroban type | Required | Validation | Update policy |
|---|---|---:|---|---|
| `schema_version` | `u32` | yes | Exactly `1` | Immutable |
| `name` | `String` | yes | 1–64 UTF-8 bytes, at least one non-space character, no ASCII control characters | Immutable NFT collection metadata |
| `symbol` | `String` | yes | 1–12 ASCII characters from `A-Z` or `0-9` | Immutable NFT collection metadata |
| `collection_uri` | `String` | yes | 1–256 bytes after `ipfs://` or `https://` | Immutable NFT collection URI |
| `metadata_uri` | `String` | yes | 1–256 bytes after `ipfs://` or `https://` | Immutable registry discovery pointer |
| `metadata_hash` | `BytesN<32>` | yes | Non-zero SHA-256 digest of the exact metadata document bytes | Immutable registry commitment |

The factory stores only `schema_version`, `metadata_uri`, and `metadata_hash`.
The NFT stores collection name, symbol, and URI. Description, logo, and links
stay in the committed off-chain document so registry state cannot diverge from
the authoritative NFT and Governor configuration.

### `GovernanceParams`

All time fields are Stellar ledger counts, not timestamps. At the protocol
target of roughly five seconds per ledger, displayed wall-clock durations are
estimates only.

| Field | Soroban type | Required | Validation | Update policy |
|---|---|---:|---|---|
| `voting_delay` | `u32` ledgers | yes | `0..=120,960` (up to 7 days); zero explicitly means voting may start without a delay | Immutable Governor configuration |
| `voting_period` | `u32` ledgers | yes | `1..=1,555,200` (up to 90 days) | Immutable Governor configuration |
| `proposal_threshold` | `u128` NFT votes | yes | `1..=4,294,967,295` | Immutable Governor configuration |
| `quorum` | `u128` NFT votes | yes | `1..=4,294,967,295` | Immutable Governor configuration |

The contract checks `voting_delay + voting_period` for `u32` overflow even
though the individual bounds already keep it safe. Zero voting period,
threshold, and quorum are rejected because they can make governance vacuous.
Threshold and quorum are independent: requiring one to be less than the other
would incorrectly reject valid configurations. A community owner must choose
values achievable by its intended membership; supply does not exist yet when
the Governor is constructed.

## Off-chain metadata document, version 1

The bytes committed by `metadata_hash` are a UTF-8 JSON document. Producers
must use the exact camel-case keys below, must reject duplicate keys, and must
omit absent optional fields instead of encoding them as `null`.

| JSON field | Type | Required | Validation | Update policy |
|---|---|---:|---|---|
| `schemaVersion` | integer | yes | Exactly `1` | Immutable for a committed document |
| `name` | string | yes | Must exactly equal on-chain `name` | Immutable for a committed document |
| `description` | string | yes | 1–2,000 UTF-8 bytes | New content requires a new document; registry commitment remains immutable |
| `logo` | string | no | Non-empty `ipfs://` or `https://` URI, at most 256 bytes | Same as description |
| `externalLinks` | array of objects | no | At most 10 entries; deterministic ordering chosen by producer | Same as description |
| `externalLinks[].label` | string | yes per entry | 1–32 UTF-8 bytes, no control characters | Same as description |
| `externalLinks[].url` | string | yes per entry | Non-empty `https://` URI, at most 256 bytes | Same as description |
| `nftContract` | string | no before creation | StrKey contract address; if present after creation, must equal the registry record | Derived; not authoritative |
| `governorContract` | string | no before creation | StrKey contract address; if present after creation, must equal the registry record | Derived; not authoritative |

Contract references are optional because deterministic metadata is commonly
prepared before deployment. The on-chain `CommunityRecord` is always
authoritative for the NFT/Governor pair.

JSON object member order is not semantically significant, but the hash commits
to bytes. Producers that need reproducible hashes must emit UTF-8 JSON with:

1. keys in the table order;
2. no insignificant whitespace;
3. arrays in the supplied order;
4. no Unicode normalization after user input has been accepted.

Unknown JSON fields are rejected in schema version 1. Unknown on-chain schema
versions are rejected by the factory. A future version must use a new
`schema_version`, document its canonical encoding and validation, and be added
through an additive factory upgrade. Existing records and hashes are never
rewritten during migration.

## Examples

Valid off-chain document (shown pretty-printed; canonical hashing removes the
formatting whitespace):

```json
{
  "schemaVersion": 1,
  "name": "Builders Guild",
  "description": "A community for public-goods builders.",
  "logo": "ipfs://bafy-logo/logo.png",
  "externalLinks": [
    {
      "label": "Website",
      "url": "https://builders.example"
    }
  ]
}
```

Valid governance input:

```json
{
  "voting_delay": 12,
  "voting_period": 17280,
  "proposal_threshold": "1",
  "quorum": "10"
}
```

Invalid examples include an empty `external_key`, lowercase NFT symbol,
`http://` metadata URI, a zero metadata hash, zero voting period, zero quorum,
a delay above 120,960 ledgers, or an unknown `schema_version`. JavaScript
clients should represent `u128` vote fields as decimal strings/`bigint`, never
as floating-point numbers.
