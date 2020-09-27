require("dotenv").config();
const { remove0x, addOx } = require("./utils");
const { Keyring } = require("@polkadot/api");
const bitcoin = require("bitcoinjs-lib");

const { getApi } = require("@polkadot/api");
const args = process.argv.slice(2);
const needSubmit = args.find(arg => arg === "--submit");

let redeemScript;
let api;

async function init() {
  api = await getApi();

  const info = await api.rpc.xgatewaycommon.bitcoinTrusteeSessionInfo(
    "Bitcoin"
  );
  redeemScript = Buffer.from(remove0x(info.hotEntity.redeemScript), "hex");

  if (!process.env.bitcoin_private_key) {
    console.error("没有设置bitcoin_private_key");
    process.exit(1);
  }
}

async function respond() {
  const withdrawalTx = await api.rpc.xgatewaycommon.withdrawalListByChain(
    "Bitcoin"
  );

  if (!withdrawalTx) {
    console.log("目前链上无代签原文");
    process.exit(0);
  }

  await sign(withdrawalTx.tx);

  if (!needSubmit) {
    process.exit(0);
  }
}

async function sign(rawTx) {
  const properties = await chainx.chain.chainProperties();
  const network =
    properties["bitcoin_type"] === "mainnet"
      ? bitcoin.networks.bitcoin
      : bitcoin.networks.testnet;

  const tx = bitcoin.Transaction.fromHex(remove0x(rawTx));
  const txb = bitcoin.TransactionBuilder.fromTransaction(tx, network);

  const keyPair = bitcoin.ECPair.fromWIF(
    process.env.bitcoin_private_key,
    network
  );

  try {
    for (let i = 0; i < tx.ins.length; i++) {
      txb.sign(i, keyPair, redeemScript);
    }
  } catch (e) {
    console.error("签名出错：", e);
    process.exit(1);
  }

  const signedRawTx = txb.build().toHex();
  console.log("签名后原文:");
  console.log(signedRawTx);

  await submitIfRequired(signedRawTx);
}

async function submitIfRequired(rawTx) {
  if (!needSubmit) {
    return;
  }

  console.log("\n开始构造并提交ChainX信托交易...");

  if (!process.env.chainx_private_key) {
    console.error("没有设置chainx_private_key");
    process.exit(1);
  }

  const keyring = new Keyring({ type: "sr25519" });
  const alice = keyring.addFromUri(process.env.chainx_private_key);

  const extrinsic = await api.tx["xGatewayBitcoin"]["signWithdrawTx"](
    addOx(rawTx)
  );

  extrinsic.signAndSend(alice, ({ events, status }) => {
    console.log("status:" + JSON.stringify(status));
  });
}

(async function() {
  try {
    await init();
    await respond();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
