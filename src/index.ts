import {
  Connection,
  ConnectionConfig,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
// import { MyFirstPythApp, IDL } from "./idl/my_first_pyth_app";

const SOL_PRICE_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const ETH_PRICE_FEED_ID =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

async function main() {
  const priceServiceConnection = new PriceServiceConnection(
    "https://hermes.pyth.network/",
    { priceFeedRequestConfig: { binary: true } }
  );
  const priceUpdateData = await priceServiceConnection.getLatestVaas([
    SOL_PRICE_FEED_ID,
    ETH_PRICE_FEED_ID,
  ]); // Fetch off-chain price update data

  console.log("Price update data: ", priceUpdateData);

  const rpc = "https://api.devnet.solana.com";
  const env = await initEnv(rpc);
  const pythSolanaReceiver = new PythSolanaReceiver({
    connection: env.provider.connection,
    wallet: env.wallet,
  });

  // const myFirstPythApp = new Program<MyFirstPythApp>(
  //   IDL as MyFirstPythApp,
  //   MY_FIRST_PYTH_APP_PROGRAM_ID,
  //   {}
  // );

  const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({});
  await transactionBuilder.addPostPriceUpdates(priceUpdateData);
  await transactionBuilder.addPriceConsumerInstructions(
    async (
      getPriceUpdateAccount: (priceFeedId: string) => PublicKey
    ): Promise<InstructionWithEphemeralSigners[]> => {
      return [
        {
          instruction: await myFirstPythApp.methods
            .consume()
            .accounts({
              solPriceUpdate: getPriceUpdateAccount(SOL_PRICE_FEED_ID),
              ethPriceUpdate: getPriceUpdateAccount(ETH_PRICE_FEED_ID),
            })
            .instruction(),
          signers: [],
        },
      ];
    }
  );
  await pythSolanaReceiver.provider.sendAll(
    await transactionBuilder.buildVersionedTransactions({
      computeUnitPriceMicroLamports: 1000000,
    })
  );
}

main()
  .then(() => {
    process.exit();
  })
  .catch((e) => {
    console.error("\n\nKamino CLI exited with error:\n\n", e);
    process.exit(1);
  });

export type Env = {
  provider: AnchorProvider;
  admin: Keypair;
  wallet: Wallet;
};

export async function initEnv(
  endpoint: string,
  adminKeypair: Keypair | null = null
): Promise<Env> {
  const config: ConnectionConfig = {
    commitment: "processed",
    confirmTransactionInitialTimeout: 220000,
  };

  console.log(`Connecting to ${endpoint}...`);
  const connection = new Connection(endpoint, config);

  const admin = adminKeypair ?? Keypair.generate();

  const wallet = new Wallet(admin);
  const provider = new AnchorProvider(connection, wallet, {
    preflightCommitment: "processed",
  });

  const env: Env = {
    provider: new AnchorProvider(connection, wallet, {
      preflightCommitment: "processed",
    }),
    admin,
    wallet,
  };

  return env;
}
