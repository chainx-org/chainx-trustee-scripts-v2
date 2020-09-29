/**
 * 此脚本用于构造热转冷交易
 */

require("dotenv").config();
require("console.table");
const { getApi } = require("./chainx");
const { getUnspents, calcTargetUnspents } = require("./btc-common");
const bitcoin = require("bitcoinjs-lib");
const { remove0x, isNull } = require("./utils");
const {
  getTrusteeSessionInfo,
  getChainProperties
} = require("./chainx-common");

let amount;
let api;

const rawAmount = process.argv[2];
if (!rawAmount) {
  throw new Error("没有指定转账金额");
  process.exit(1);
}

amount = Math.pow(10, 8) * parseFloat(rawAmount);

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
}

async function construct() {
  const info = await getTrusteeSessionInfo(api);
  const properties = await getChainProperties(api);

  const { redeemScript } = info.hotAddress;
  const { addr } = info.coldAddress;

  const required = info.threshold;
  const total = info.trusteeList.length;

  const unspents = await getUnspents(addr, properties["bitcoin_type"]);
  unspents.sort((a, b) => a.amount > b.amount);

  const [targetInputs, minerFee] = await calcTargetUnspents(
    unspents,
    amount,
    process.env.bitcoin_fee_rate,
    required,
    total
  );
  const inputSum = targetInputs.reduce((sum, input) => sum + input.amount, 0);

  let change = inputSum - amount - minerFee;
  if (change < Number(process.env.min_change)) {
    change = 0;
  }

  logMinerFee(minerFee);

  const network =
    properties["bitcoin_type"] === "mainnet"
      ? bitcoin.networks.bitcoin
      : bitcoin.networks.testnet;
  const txb = new bitcoin.TransactionBuilder(network);
  txb.setVersion(1);

  for (const unspent of targetInputs) {
    txb.addInput(unspent.txid, unspent.vout);
  }

  txb.addOutput(coldAddr, amount);
  if (change > 0) {
    txb.addOutput(addr, change);
  }

  const keyPair = bitcoin.ECPair.fromWIF(
    process.env.bitcoin_private_key,
    network
  );

  let redeem = Buffer.from(remove0x(redeemScript), "hex");
  for (let i = 0; i < txb.__inputs.length; i++) {
    txb.sign(i, keyPair, redeem);
  }

  logInputs(targetInputs);
  logOutputs(txb, network);

  const rawTx = txb.build().toHex();
  console.log("生成代签原文:");
  console.log(rawTx);
}

function logMinerFee(minerFee) {
  console.log("所花手续费:");
  console.log(minerFee / Math.pow(10, 8) + " BTC\n");
}

function logInputs(inputs) {
  console.log("所花UTXO列表:");
  console.table(
    inputs.map(input => ({
      ...input,
      amount: input.amount / Math.pow(10, 8) + " BTC"
    }))
  );
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
    await construct();

    chainx.provider.websocket.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
