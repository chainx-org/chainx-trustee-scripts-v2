require("dotenv").config();
require("console.table");
const { getApi } = require("./chainx");
const bitcoin = require("bitcoinjs-lib");
const { remove0x } = require("./utils");
const reverse = require("buffer-reverse");

const {
  getWithdrawLimit,
  getBTCWithdrawList,
  getTrusteeSessionInfo,
  getChainProperties
} = require("./chainx-common");

const rawTx = process.argv[2];

let api;
if (!rawTx) {
  throw new Error("没有指定待签交易原文");
  process.exit(1);
}

let redeemScript;

async function init() {
  if (!process.env.bitcoin_fee_rate) {
    throw new Error("bitcoin_fee_rate 没有设置");
    process.exit(1);
  }

  if (!process.env.min_change) {
    throw new Error("min_change 没有设置");
    process.exit(1);
  }

  api = await getApi();

  const info = await getTrusteeSessionInfo("Bitcoin");
  redeemScript = Buffer.from(remove0x(info.hotAddress.redeemScript), "hex");
}

async function respond() {
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
  logInputs(txb);

  try {
    for (let i = 0; i < tx.ins.length; i++) {
      txb.sign(i, keyPair, redeemScript);
    }
  } catch (e) {
    console.error("签名出错：", e);
    process.exit(1);
  }

  logOutputs(txb, network);
}

function logInputs(txb) {
  console.log("所花UTXO列表：");
  const normalizedInputs = txb.__tx.ins.map(input => {
    const txid = reverse(input.hash).toString("hex");
    const vout = input.index;
    return { txid, vout };
  });
  console.table(normalizedInputs);
}

function logOutputs(txb, network) {
  console.log("提现列表:");
  const normalizedOuts = txb.__tx.outs.map(out => {
    const address = bitcoin.address.fromOutputScript(out.script, network);
    const value = out.value / Math.pow(10, 8);
    return { address, ["value(BTC)"]: value };
  });

  console.table(normalizedOuts);
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
