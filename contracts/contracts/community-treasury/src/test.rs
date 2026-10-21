#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Bytes, Env, Event,
};

use crate::{
    AssetPolicy, CommunityTreasury, CommunityTreasuryClient, Deposited, PeriodSpend, TreasuryError,
    TreasuryPayment, DEFAULT_PERIOD_LEDGERS, MAX_RECIPIENTS,
};

fn token(e: &Env) -> Address {
    let admin = Address::generate(e);
    e.register_stellar_asset_contract_v2(admin).address()
}

fn treasury<'a>(e: &'a Env, timelock: &Address) -> CommunityTreasuryClient<'a> {
    let id = e.register(CommunityTreasury, (timelock.clone(),));
    CommunityTreasuryClient::new(e, &id)
}

fn reference(e: &Env) -> Bytes {
    Bytes::from_slice(e, b"action-ref")
}

fn allow(
    client: &CommunityTreasuryClient<'_>,
    asset: &Address,
    max_per_call: i128,
    max_per_period: i128,
    period_ledgers: u32,
    recipients_restricted: bool,
) {
    client.set_asset_policy(
        asset,
        &max_per_call,
        &max_per_period,
        &period_ledgers,
        &recipients_restricted,
    );
}

fn mint_and_deposit(
    e: &Env,
    client: &CommunityTreasuryClient<'_>,
    asset: &Address,
    from: &Address,
    amount: i128,
) {
    StellarAssetClient::new(e, asset).mint(from, &amount);
    client.deposit(from, asset, &amount);
}

#[test]
fn deposit_and_pay_move_balances_and_emit_payment() {
    let e = Env::default();
    e.mock_all_auths();
    let timelock = Address::generate(&e);
    let payer = Address::generate(&e);
    let recipient = Address::generate(&e);
    let asset = token(&e);
    let client = treasury(&e, &timelock);
    allow(&client, &asset, 500, 1_000, DEFAULT_PERIOD_LEDGERS, false);
    StellarAssetClient::new(&e, &asset).mint(&payer, &800);
    client.deposit(&payer, &asset, &800);
    let deposited = Deposited {
        asset: asset.clone(),
        from: payer.clone(),
        amount: 800,
    }
    .to_xdr(&e, &client.address);
    assert_eq!(e.events().all().events().last(), Some(&deposited));

    let balances = TokenClient::new(&e, &asset);
    client.pay(&asset, &recipient, &250, &reference(&e));
    assert!(e.auths().iter().any(|(address, _)| address == &timelock));
    let paid = TreasuryPayment {
        asset: asset.clone(),
        recipient: recipient.clone(),
        amount: 250,
        reference: reference(&e),
    }
    .to_xdr(&e, &client.address);
    assert_eq!(e.events().all().events().last(), Some(&paid));

    assert_eq!(balances.balance(&client.address), 550);
    assert_eq!(balances.balance(&recipient), 250);
    assert_eq!(balances.balance(&payer), 0);
    assert_eq!(
        client.period_spend(&asset),
        Some(PeriodSpend {
            window_start: e.ledger().sequence(),
            spent: 250,
        })
    );
}

#[test]
fn unauthorized_caller_cannot_spend_or_edit_policy() {
    let e = Env::default();
    let timelock = Address::generate(&e);
    let stranger = Address::generate(&e);
    let asset = token(&e);
    let client = treasury(&e, &timelock);
    let reference = reference(&e);

    assert!(client.try_pay(&asset, &stranger, &1, &reference).is_err());
    assert!(client
        .try_set_asset_policy(&asset, &10, &10, &DEFAULT_PERIOD_LEDGERS, &false)
        .is_err());
    assert!(client.try_set_recipient(&asset, &stranger, &true).is_err());
    assert!(client.try_remove_asset(&asset).is_err());
    assert!(client.try_deposit(&stranger, &asset, &1).is_err());
    assert_eq!(client.timelock(), timelock);
    assert_eq!(client.asset_policy(&asset), None);
    assert_eq!(client.period_spend(&asset), None);
    assert_eq!(TokenClient::new(&e, &asset).balance(&client.address), 0);
}

#[test]
fn policy_rejects_unknown_asset_bad_amount_and_self_recipient() {
    let e = Env::default();
    e.mock_all_auths();
    let timelock = Address::generate(&e);
    let payer = Address::generate(&e);
    let asset = token(&e);
    let other = token(&e);
    let client = treasury(&e, &timelock);
    allow(&client, &asset, 100, 100, 10, false);
    mint_and_deposit(&e, &client, &asset, &payer, 100);

    assert_eq!(
        client.try_deposit(&payer, &other, &1),
        Err(Ok(TreasuryError::AssetNotAllowed))
    );
    assert_eq!(
        client.try_deposit(&payer, &asset, &0),
        Err(Ok(TreasuryError::AmountNotPositive))
    );
    assert_eq!(
        client.try_deposit(&payer, &asset, &-1),
        Err(Ok(TreasuryError::AmountNotPositive))
    );
    assert_eq!(
        client.try_pay(&other, &payer, &1, &reference(&e)),
        Err(Ok(TreasuryError::AssetNotAllowed))
    );
    assert_eq!(
        client.try_pay(&asset, &payer, &0, &reference(&e)),
        Err(Ok(TreasuryError::AmountNotPositive))
    );
    assert_eq!(
        client.try_pay(&asset, &payer, &-5, &reference(&e)),
        Err(Ok(TreasuryError::AmountNotPositive))
    );
    assert_eq!(
        client.try_pay(&asset, &client.address, &1, &reference(&e)),
        Err(Ok(TreasuryError::InvalidRecipient))
    );
    assert_eq!(client.period_spend(&asset), None);
    assert_eq!(TokenClient::new(&e, &asset).balance(&client.address), 100);
}

#[test]
fn per_call_cap_allows_exact_amount_and_rejects_one_over() {
    let e = Env::default();
    e.mock_all_auths();
    let timelock = Address::generate(&e);
    let payer = Address::generate(&e);
    let recipient = Address::generate(&e);
    let asset = token(&e);
    let client = treasury(&e, &timelock);
    allow(&client, &asset, 40, 1_000, 10, false);
    mint_and_deposit(&e, &client, &asset, &payer, 200);

    assert_eq!(
        client.try_pay(&asset, &recipient, &41, &reference(&e)),
        Err(Ok(TreasuryError::ExceedsPerCallCap))
    );
    client.pay(&asset, &recipient, &40, &reference(&e));
    assert_eq!(TokenClient::new(&e, &asset).balance(&recipient), 40);
    assert_eq!(client.period_spend(&asset).unwrap().spent, 40);
}

#[test]
fn zero_cap_disables_spending() {
    let e = Env::default();
    e.mock_all_auths();
    let timelock = Address::generate(&e);
    let payer = Address::generate(&e);
    let recipient = Address::generate(&e);
    let asset = token(&e);
    let client = treasury(&e, &timelock);
    allow(&client, &asset, 0, 50, 10, false);
    mint_and_deposit(&e, &client, &asset, &payer, 50);
    assert_eq!(
        client.try_pay(&asset, &recipient, &1, &reference(&e)),
        Err(Ok(TreasuryError::SpendingDisabled))
    );

    allow(&client, &asset, 50, 0, 10, false);
    assert_eq!(
        client.try_pay(&asset, &recipient, &1, &reference(&e)),
        Err(Ok(TreasuryError::SpendingDisabled))
    );
    assert_eq!(TokenClient::new(&e, &asset).balance(&client.address), 50);
    assert_eq!(client.period_spend(&asset), None);
}

#[test]
fn period_cap_aggregates_and_resets_on_window_boundary() {
    let e = Env::default();
    e.ledger().with_mut(|ledger| ledger.sequence_number = 1_000);
    e.mock_all_auths();
    let timelock = Address::generate(&e);
    let payer = Address::generate(&e);
    let recipient = Address::generate(&e);
    let asset = token(&e);
    let other = token(&e);
    let client = treasury(&e, &timelock);
    allow(&client, &asset, 100, 150, 10, false);
    allow(&client, &other, 100, 150, 10, false);
    mint_and_deposit(&e, &client, &asset, &payer, 400);
    mint_and_deposit(&e, &client, &other, &payer, 100);

    client.pay(&asset, &recipient, &100, &reference(&e));
    client.pay(&asset, &recipient, &50, &reference(&e));
    assert_eq!(
        client.try_pay(&asset, &recipient, &1, &reference(&e)),
        Err(Ok(TreasuryError::ExceedsPeriodCap))
    );
    assert_eq!(client.period_spend(&asset).unwrap().spent, 150);
    client.pay(&other, &recipient, &20, &reference(&e));
    assert_eq!(client.period_spend(&other).unwrap().spent, 20);

    e.ledger().with_mut(|ledger| ledger.sequence_number = 1_009);
    assert_eq!(client.effective_period_spend(&asset).unwrap().spent, 150);
    assert_eq!(
        client.try_pay(&asset, &recipient, &1, &reference(&e)),
        Err(Ok(TreasuryError::ExceedsPeriodCap))
    );

    e.ledger().with_mut(|ledger| ledger.sequence_number = 1_010);
    assert_eq!(
        client.effective_period_spend(&asset),
        Some(PeriodSpend {
            window_start: 1_010,
            spent: 0,
        })
    );
    client.pay(&asset, &recipient, &100, &reference(&e));
    assert_eq!(
        client.period_spend(&asset),
        Some(PeriodSpend {
            window_start: 1_010,
            spent: 100,
        })
    );
    assert_eq!(TokenClient::new(&e, &asset).balance(&recipient), 250);
}

#[test]
fn recipient_allowlist_denies_until_the_address_is_added() {
    let e = Env::default();
    e.mock_all_auths();
    let timelock = Address::generate(&e);
    let payer = Address::generate(&e);
    let allowed = Address::generate(&e);
    let blocked = Address::generate(&e);
    let asset = token(&e);
    let client = treasury(&e, &timelock);
    allow(&client, &asset, 10, 100, 10, true);
    mint_and_deposit(&e, &client, &asset, &payer, 80);

    assert_eq!(
        client.try_pay(&asset, &allowed, &10, &reference(&e)),
        Err(Ok(TreasuryError::RecipientNotAllowed))
    );
    assert_eq!(
        client.try_set_recipient(&asset, &client.address, &true),
        Err(Ok(TreasuryError::InvalidRecipient))
    );
    client.set_recipient(&asset, &allowed, &true);
    client.pay(&asset, &allowed, &10, &reference(&e));
    assert_eq!(
        client.try_pay(&asset, &blocked, &10, &reference(&e)),
        Err(Ok(TreasuryError::RecipientNotAllowed))
    );

    client.set_recipient(&asset, &allowed, &false);
    assert_eq!(
        client.try_pay(&asset, &allowed, &10, &reference(&e)),
        Err(Ok(TreasuryError::RecipientNotAllowed))
    );

    allow(&client, &asset, 10, 100, 10, false);
    client.pay(&asset, &blocked, &10, &reference(&e));
    let policy = client.asset_policy(&asset).unwrap();
    assert_eq!(policy.recipients.len(), 0);
    assert!(!policy.recipients_restricted);
    assert_eq!(TokenClient::new(&e, &asset).balance(&blocked), 10);
}

#[test]
fn recipient_list_rejects_the_entry_past_the_cap() {
    let e = Env::default();
    e.mock_all_auths();
    let timelock = Address::generate(&e);
    let asset = token(&e);
    let client = treasury(&e, &timelock);
    allow(&client, &asset, 1, 1, 10, true);
    for _ in 0..MAX_RECIPIENTS {
        client.set_recipient(&asset, &Address::generate(&e), &true);
    }
    assert_eq!(
        client.try_set_recipient(&asset, &Address::generate(&e), &true),
        Err(Ok(TreasuryError::RecipientListFull))
    );
    assert_eq!(
        client.asset_policy(&asset).unwrap().recipients.len(),
        MAX_RECIPIENTS
    );
}

#[test]
fn insufficient_balance_does_not_record_spend() {
    let e = Env::default();
    e.mock_all_auths();
    let timelock = Address::generate(&e);
    let recipient = Address::generate(&e);
    let asset = token(&e);
    let client = treasury(&e, &timelock);
    allow(&client, &asset, 25, 25, 10, false);

    assert_eq!(
        client.try_pay(&asset, &recipient, &25, &reference(&e)),
        Err(Ok(TreasuryError::InsufficientBalance))
    );
    assert_eq!(client.period_spend(&asset), None);
    assert_eq!(TokenClient::new(&e, &asset).balance(&recipient), 0);
}

#[test]
fn invalid_policy_values_and_removed_assets_are_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let timelock = Address::generate(&e);
    let payer = Address::generate(&e);
    let recipient = Address::generate(&e);
    let asset = token(&e);
    let client = treasury(&e, &timelock);

    assert_eq!(
        client.try_set_asset_policy(&asset, &-1, &10, &10, &false),
        Err(Ok(TreasuryError::InvalidCap))
    );
    assert_eq!(
        client.try_set_asset_policy(&asset, &10, &-1, &10, &false),
        Err(Ok(TreasuryError::InvalidCap))
    );
    assert_eq!(
        client.try_set_asset_policy(&asset, &10, &10, &0, &false),
        Err(Ok(TreasuryError::InvalidPeriod))
    );
    assert_eq!(
        client.try_set_recipient(&asset, &recipient, &true),
        Err(Ok(TreasuryError::AssetNotAllowed))
    );
    assert_eq!(
        client.try_remove_asset(&asset),
        Err(Ok(TreasuryError::AssetNotAllowed))
    );

    allow(&client, &asset, 20, 20, 8, false);
    client.set_recipient(&asset, &recipient, &true);
    mint_and_deposit(&e, &client, &asset, &payer, 20);
    client.pay(&asset, &recipient, &5, &reference(&e));
    client.remove_asset(&asset);
    assert_eq!(client.asset_policy(&asset), None);
    assert_eq!(client.period_spend(&asset), None);
    assert_eq!(
        client.try_pay(&asset, &recipient, &5, &reference(&e)),
        Err(Ok(TreasuryError::AssetNotAllowed))
    );
    assert_eq!(
        client.try_deposit(&payer, &asset, &1),
        Err(Ok(TreasuryError::AssetNotAllowed))
    );

    allow(&client, &asset, 20, 20, 8, true);
    let restored = client.asset_policy(&asset).unwrap();
    assert_eq!(
        restored,
        AssetPolicy {
            max_per_call: 20,
            max_per_period: 20,
            period_ledgers: 8,
            recipients_restricted: true,
            recipients: restored.recipients.clone(),
        }
    );
    assert_eq!(restored.recipients.len(), 0);
}
