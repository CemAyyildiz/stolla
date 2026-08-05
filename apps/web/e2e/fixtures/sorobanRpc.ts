import type { Page } from "@playwright/test";
import {
  Keypair,
  Networks,
  SorobanDataBuilder,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
  Address,
} from "@stellar/stellar-sdk";

const RPC_ENDPOINT = "https://soroban-rpc.invalid/";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export const MOCK_FACTORY_ID =
  "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE";
export const MOCK_NFT_ID =
  "CBQHNAXSI55GX2GN6D67GK7BHVPSLJUGZQEU7WJ5LKR5PNUCGLIMAO4K";
export const MOCK_GOVERNOR_ID =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
export const MOCK_TRANSACTION_HASH =
  "3389e9f0f1a54fc1cd54c5b0c1f7ea6f8f0e5a2b7c1d3e4f5061728394a5b6c7";

export type ContractInvocation = {
  sourceAccount: string;
  contractId: string;
  functionName: string;
  args: unknown[];
};

export type SorobanMockOptions = {
  /** Fails `create_community` simulation with this message instead of succeeding. */
  simulationError?: string;
  /** Number of `getTransaction` polls that report NOT_FOUND before success. */
  pollsBeforeConfirmation?: number;
  /** Omits the pair from the registry read so verification cannot succeed. */
  registryEmpty?: boolean;
};

export type SorobanMock = {
  invocations: ContractInvocation[];
  submittedTransactions: string[];
  invocationsOf: (functionName: string) => ContractInvocation[];
};

function accountEntry(address: string, sequence: string) {
  const accountId = Keypair.fromPublicKey(address).xdrAccountId();
  return {
    key: xdr.LedgerKey.account(
      new xdr.LedgerKeyAccount({ accountId }),
    ).toXDR("base64"),
    xdr: xdr.LedgerEntryData.account(
      new xdr.AccountEntry({
        accountId,
        balance: xdr.Int64.fromString("100000000"),
        seqNum: xdr.Int64.fromString(sequence),
        numSubEntries: 0,
        inflationDest: null,
        flags: 0,
        homeDomain: "",
        thresholds: Buffer.from([1, 0, 0, 0]),
        signers: [],
        ext: new xdr.AccountEntryExt(0),
      }),
    ).toXDR("base64"),
    lastModifiedLedgerSeq: 100,
  };
}

function readInvocation(transactionXdr: string): ContractInvocation {
  const transaction = TransactionBuilder.fromXDR(
    transactionXdr,
    Networks.TESTNET,
  );

  if ("innerTransaction" in transaction) {
    throw new Error("The creation flow does not use fee bump transactions.");
  }

  const operation = transaction.operations[0];

  if (operation.type !== "invokeHostFunction") {
    throw new Error(`Unexpected operation type: ${operation.type}`);
  }

  const invocation = operation.func.invokeContract();
  return {
    sourceAccount: transaction.source,
    contractId: Address.fromScAddress(invocation.contractAddress()).toString(),
    functionName: invocation.functionName().toString(),
    args: invocation.args().map((arg) => scValToNative(arg)),
  };
}

const registryValue = (empty: boolean) =>
  empty
    ? nativeToScVal(null)
    : nativeToScVal({
        governor: new Address(MOCK_GOVERNOR_ID),
        nft: new Address(MOCK_NFT_ID),
      });

/**
 * The SDK parses these envelopes before the application sees a status, so they
 * are built with the real XDR types rather than stubbed strings.
 */
const SUCCESS_RESULT_XDR = new xdr.TransactionResult({
  feeCharged: xdr.Int64.fromString("100"),
  result: xdr.TransactionResultResult.txSuccess([]),
  ext: new xdr.TransactionResultExt(0),
}).toXDR("base64");

const successMetaXdr = () =>
  new xdr.TransactionMeta(
    3,
    new xdr.TransactionMetaV3({
      ext: new xdr.ExtensionPoint(0),
      txChangesBefore: [],
      operations: [],
      txChangesAfter: [],
      sorobanMeta: new xdr.SorobanTransactionMeta({
        ext: new xdr.SorobanTransactionMetaExt(0),
        events: [],
        returnValue: registryValue(false),
        diagnosticEvents: [],
      }),
    }),
  ).toXDR("base64");

/**
 * Intercepts the Soroban JSON-RPC endpoint in the browser and answers with
 * transaction data built by the real SDK, so the application exercises its
 * normal parsing, assembly and polling paths.
 */
export async function installSorobanMocks(
  page: Page,
  options: SorobanMockOptions = {},
): Promise<SorobanMock> {
  const { simulationError, pollsBeforeConfirmation = 1, registryEmpty } = options;

  const invocations: ContractInvocation[] = [];
  const submittedTransactions: string[] = [];
  let polls = 0;

  await page.route(`${RPC_ENDPOINT}**`, async (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }

    const { method, params, id } = route.request().postDataJSON();
    const reply = (result: unknown) =>
      route.fulfill({
        contentType: "application/json",
        headers: CORS_HEADERS,
        body: JSON.stringify({ jsonrpc: "2.0", id, result }),
      });

    switch (method) {
      case "getLedgerEntries":
        return reply({
          latestLedger: 100,
          entries: [accountEntry(Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7)).publicKey(), "12345")],
        });

      case "simulateTransaction": {
        const invocation = readInvocation(params.transaction);
        invocations.push(invocation);

        if (invocation.functionName === "get_community") {
          return reply({
            latestLedger: 100,
            minResourceFee: "100",
            transactionData: new SorobanDataBuilder().build().toXDR("base64"),
            events: [],
            results: [
              { auth: [], xdr: registryValue(Boolean(registryEmpty)).toXDR("base64") },
            ],
          });
        }

        if (simulationError) {
          return reply({ latestLedger: 100, error: simulationError });
        }

        return reply({
          latestLedger: 100,
          minResourceFee: "12345",
          transactionData: new SorobanDataBuilder().build().toXDR("base64"),
          events: [],
          results: [
            { auth: [], xdr: registryValue(false).toXDR("base64") },
          ],
        });
      }

      case "sendTransaction":
        submittedTransactions.push(params.transaction);
        return reply({
          status: "PENDING",
          hash: MOCK_TRANSACTION_HASH,
          latestLedger: 100,
          latestLedgerCloseTime: "1700000000",
        });

      case "getTransaction":
        polls += 1;
        if (polls <= pollsBeforeConfirmation) {
          return reply({
            status: "NOT_FOUND",
            latestLedger: 100,
            latestLedgerCloseTime: "1700000000",
            oldestLedger: 1,
            oldestLedgerCloseTime: "1700000000",
          });
        }
        return reply({
          status: "SUCCESS",
          latestLedger: 101,
          latestLedgerCloseTime: "1700000001",
          oldestLedger: 1,
          oldestLedgerCloseTime: "1700000000",
          ledger: 101,
          createdAt: "1700000001",
          applicationOrder: 1,
          feeBump: false,
          envelopeXdr: submittedTransactions.at(-1),
          resultXdr: SUCCESS_RESULT_XDR,
          resultMetaXdr: successMetaXdr(),
        });

      default:
        return reply({});
    }
  });

  return {
    invocations,
    submittedTransactions,
    invocationsOf: (functionName) =>
      invocations.filter((entry) => entry.functionName === functionName),
  };
}
