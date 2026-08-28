import { expect, test, type Page } from "@playwright/test";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import {
  MOCK_WALLET_ADDRESS,
  configureMockWallet,
  signedNetworkPassphrases,
} from "./fixtures/mockWallet";
import {
  MOCK_FACTORY_ID,
  MOCK_GOVERNOR_ID,
  MOCK_NFT_ID,
  installSorobanMocks,
} from "./fixtures/sorobanRpc";

const DRAFT = {
  name: "Stolla Builders",
  symbol: "STBL",
  metadataUri: "ipfs://QmCollectionMetadata",
};

/**
 * Scoped to the application's own markup so the Next.js dev tools button and
 * route announcer cannot satisfy a selector.
 */
const wizard = (page: Page) => page.getByRole("main");

async function connectWallet(page: Page) {
  const header = page.getByRole("banner");
  await page.goto("/community/new");
  const connectedControl =
    (page.viewportSize()?.width ?? 1280) < 640
      ? header.getByRole("button", { name: /^Account / })
      : header.getByRole("button", { name: "Disconnect" });
  await expect(connectedControl).toBeVisible();
}

async function completeDraftSteps(page: Page) {
  const main = wizard(page);
  await main.getByLabel("Community name").fill(DRAFT.name);
  await main.getByLabel("Token symbol").fill(DRAFT.symbol);
  await main.getByLabel("IPFS metadata URI").fill(DRAFT.metadataUri);

  const next = main.getByRole("button", { name: "Next" });
  await next.click();
  await expect(main.getByLabel("Voting delay (ledgers)")).toBeVisible();

  await next.click();
  await expect(main.getByText(DRAFT.metadataUri)).toBeVisible();

  await next.click();
  await expect(simulateButton(page)).toBeVisible();
  await expect(main.getByText(MOCK_WALLET_ADDRESS)).toBeVisible();
}

const simulateButton = (page: Page) =>
  wizard(page).getByRole("button", { name: "Simulate deployment" });
const deployButton = (page: Page) =>
  wizard(page).getByRole("button", { name: /sign and deploy|awaiting wallet/i });
const alert = (page: Page) => wizard(page).getByRole("alert");

test.beforeEach(async ({ page }) => {
  await configureMockWallet(page);
});

test("creates a community and ends on a registry-verified success screen", async ({
  page,
}) => {
  await installSorobanMocks(page);

  await connectWallet(page);
  await completeDraftSteps(page);

  await simulateButton(page).click();
  await expect(wizard(page).getByText("12345 stroops")).toBeVisible();

  await deployButton(page).click();
  const success = wizard(page).getByTestId("community-created");
  await expect(success).toBeVisible();
  await expect(success).toContainText(MOCK_NFT_ID);
  await expect(success).toContainText(MOCK_GOVERNOR_ID);

  const progress = wizard(page).getByRole("list", { name: "Deployment progress" });
  await expect(progress.locator('[data-state="pending"]')).toHaveCount(0);
});

test("sends the expected factory invocation, source account and network", async ({
  page,
}) => {
  const rpc = await installSorobanMocks(page);

  await connectWallet(page);
  await completeDraftSteps(page);
  await simulateButton(page).click();
  await expect(wizard(page).getByText("12345 stroops")).toBeVisible();
  await deployButton(page).click();
  await expect(wizard(page).getByTestId("community-created")).toBeVisible();

  const [invocation] = rpc.invocationsOf("create_community");
  expect(invocation.contractId).toBe(MOCK_FACTORY_ID);
  expect(invocation.sourceAccount).toBe(MOCK_WALLET_ADDRESS);
  expect(invocation.args).toEqual([
    MOCK_WALLET_ADDRESS,
    DRAFT.name,
    DRAFT.symbol,
    DRAFT.metadataUri,
    1,
    10000,
    BigInt(1),
    BigInt(1),
  ]);

  expect(await signedNetworkPassphrases(page)).toEqual([Networks.TESTNET]);

  /**
   * A Stellar signature covers the network id, so verifying it against the
   * testnet passphrase proves the submitted transaction was signed for testnet
   * rather than merely labelled as such.
   */
  const submitted = TransactionBuilder.fromXDR(
    rpc.submittedTransactions[0],
    Networks.TESTNET,
  );
  const signer = Keypair.fromPublicKey(MOCK_WALLET_ADDRESS);
  expect(
    signer.verify(submitted.hash(), submitted.signatures[0].signature()),
  ).toBe(true);
});

test("returns to a recoverable review state when the wallet rejects", async ({
  page,
}) => {
  await configureMockWallet(page, { rejectSignature: true });
  const rpc = await installSorobanMocks(page);

  await connectWallet(page);
  await completeDraftSteps(page);
  await simulateButton(page).click();
  await expect(wizard(page).getByText("12345 stroops")).toBeVisible();

  await deployButton(page).click();
  await expect(alert(page)).toContainText(/declined|rejected/i);

  expect(rpc.submittedTransactions).toHaveLength(0);
  await expect(wizard(page).getByTestId("community-created")).toHaveCount(0);
  await expect(deployButton(page)).toBeEnabled();

  await wizard(page).getByRole("button", { name: "3. Review" }).click();
  await expect(wizard(page).getByText(DRAFT.name)).toBeVisible();
  await expect(wizard(page).getByText(DRAFT.metadataUri)).toBeVisible();
});

test("blocks signing when simulation fails", async ({ page }) => {
  const rpc = await installSorobanMocks(page, {
    simulationError: "HostError: contract call failed",
  });

  await connectWallet(page);
  await completeDraftSteps(page);
  await simulateButton(page).click();

  await expect(alert(page)).toContainText("contract call failed");
  await expect(deployButton(page)).toBeDisabled();
  await expect(wizard(page).getByText(/Run a simulation before deploying/i)).toBeVisible();

  expect(await signedNetworkPassphrases(page)).toEqual([]);
  expect(rpc.submittedTransactions).toHaveLength(0);
});

test("withholds success while the registry does not list the pair", async ({
  page,
}) => {
  const rpc = await installSorobanMocks(page, { registryEmpty: true });

  await connectWallet(page);
  await completeDraftSteps(page);
  await simulateButton(page).click();
  await expect(wizard(page).getByText("12345 stroops")).toBeVisible();
  await deployButton(page).click();

  await expect(alert(page)).toContainText("not visible in the factory registry");
  await expect(wizard(page).getByTestId("community-created")).toHaveCount(0);

  const progress = wizard(page).getByRole("list", { name: "Deployment progress" });
  await expect(progress.locator('[data-stage="verified"]')).toHaveAttribute(
    "data-state",
    "pending",
  );
  expect(rpc.invocationsOf("get_community")).toHaveLength(1);
});

test("submits once when the deploy button is clicked repeatedly", async ({
  page,
}) => {
  const rpc = await installSorobanMocks(page);

  await connectWallet(page);
  await completeDraftSteps(page);
  await simulateButton(page).click();
  await expect(wizard(page).getByText("12345 stroops")).toBeVisible();

  /**
   * Three clicks in one tick, before React can re-render the button as
   * disabled. Playwright's own actionability waits would serialise them and
   * miss the race entirely.
   */
  await deployButton(page).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
    button.click();
  });

  await expect(wizard(page).getByTestId("community-created")).toBeVisible();
  expect(rpc.submittedTransactions).toHaveLength(1);
  expect(rpc.invocationsOf("create_community")).toHaveLength(1);
});
