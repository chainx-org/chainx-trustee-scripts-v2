/**
 * 此脚本用于构造比特币提现交易原文
 */

require("dotenv").config();
require("console.table");
const { getApi } = require("./chainx");

const {
  getWithdrawLimit,
  getBTCWithdrawList,
  getTrusteeSessionInfo,
  getChainProperties
} = require("./chainx-common");

const { getUnspents, pickUtxos } = require("./btc-common");
const bitcoin = require("bitcoinjs-lib");
const { remove0x, addOx, isNull } = require("./utils");

const args = process.argv.slice(2);
const needSign = args.find(arg => arg === "--sign");
const needSubmit = args.find(arg => arg === "--submit");

let api;

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

function filterSmallWithdraw(list, minimal) {
  return list.filter(withdrawal => withdrawal.balance >= minimal);
}

function leaveOnelyApplying(list) {
  return list.filter(
    withdrawal =>
      withdrawal.state === "Applying" || withdrawal.state === "Processing"
  );
}

async function construct() {
  const list = await getBTCWithdrawList(api);
  const limit = await getWithdrawLimit(api);
  console.log("limit:" + JSON.stringify(list));

  let filteredList = filterSmallWithdraw(list, limit.minimalWithdrawal);
  filteredList = leaveOnelyApplying(filteredList);

  if (filteredList <= 0) {
    console.log("暂无合法体现");
    process.exit(0);
  }

  await composeBtcTx(filteredList, limit.fee);

  if (!needSubmit) {
    process.exit(0);
  }
}

async function composeBtcTx(withdrawals, fee) {
  const info = await getTrusteeSessionInfo(api);
  const properties = await getChainProperties(api);

  const { addr } = info.hotAddress;

  const required = info.threshold;
  const total = info.trusteeList.length;

  const unspents = await getUnspents(addr, properties["bitcoin_type"]);
  unspents.sort((a, b) => Number(b.amount) - Number(a.amount));

  let outSum = withdrawals.reduce(
    (result, withdraw) => result + withdraw.balance - fee,
    0
  );
  let targetInputs = pickUtxos(unspents, outSum);
  let inputSum = targetInputs.reduce((sum, input) => sum + input.amount, 0);
  let bytes =
    targetInputs.length * (48 + 73 * required + 34 * total) +
    34 * (withdrawals.length + 1) +
    14;
  let minerFee = parseInt(
    (Number(process.env.bitcoin_fee_rate) * bytes) / 1000
  );

  while (inputSum < outSum + minerFee) {
    targetInputs = pickUtxos(unspents, outSum + minerFee);
    bytes =
      targetInputs.length * (48 + 73 * required + 34 * total) +
      34 * (withdrawals.length + 1) +
      14;
    minerFee = (Number(process.env.bitcoin_fee_rate) * bytes) / 1000;
  }
  let change = inputSum - outSum - minerFee;
  if (change < Number(process.env.min_change)) {
    change = 0;
  }

  logMinerFee(minerFee);
  logInputs(targetInputs);
  logOutputs(withdrawals);

  const network =
    properties["bitcoin_type"] === "mainnet"
      ? bitcoin.networks.bitcoin
      : bitcoin.networks.testnet;
  const txb = new bitcoin.TransactionBuilder(network);
  txb.setVersion(1);

  for (const unspent of targetInputs) {
    txb.addInput(unspent.txid, unspent.vout);
  }

  for (const withdrawal of withdrawals) {
    txb.addOutput(withdrawal.address, withdrawal.balance);
  }
  if (change > 0) {
    txb.addOutput(addr, change);
  }

  const signed = await signIfRequired(txb, network);
  let rawTx;
  if (signed) {
    rawTx = txb.build().toHex();
  } else {
    rawTx = txb.buildIncomplete().toHex();
  }
  console.log("生成代签原文:");
  console.log(rawTx);

  await submitIfRequired(withdrawals, rawTx);
}

async function signIfRequired(txb, network) {
  if (!needSign) {
    return false;
  }

  if (!process.env.bitcoin_private_key) {
    console.error("没有设置bitcoin_private_key");
    process.exit(1);
  }

  const info = await getTrusteeSessionInfo(api);

  const redeemScript = Buffer.from(
    remove0x(info.hotAddress.redeemScript.toString()),
    "hex"
  );

  const keyPair = bitcoin.ECPair.fromWIF(
    process.env.bitcoin_private_key,
    network
  );
  for (let i = 0; i < txb.__inputs.length; i++) {
    txb.sign(i, keyPair, redeemScript);
  }

  return true;
}

async function submitIfRequired(withdrawals, rawTx) {
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
  const ids = withdrawals.map(withdrawal => withdrawal.id);
  const extrinsic = await api.tx["xGatewayBitcoin"]["createWithdrawTx"](
    ids,
    addOx(rawTx)
  );

  extrinsic.signAndSend(alice, ({ events = [], status }) => {
    console.log(`Current status is ${status.type}`);
    if (status.isFinalized) {
      console.log(`Transaction included at blockHash ${status.asFinalized}`);
      // Loop through Vec<EventRecord> to display all events
      events.forEach(({ phase, event: { data, method, section } }) => {
        //console.log(`\t' ${phase}: ${section}.${method}:: ${data}`);
        if (method === "ExtrinsicFailed") {
          console.error(
            `提交ChainX信托签名交易失败 \n ${phase}: ${section}.${method}:: ${data}`
          );
          process.exit(0);
        } else if (method === "ExtrinsicSuccess") {
          console.log(
            `提交信托签名交易成功 \n ${phase}: ${section}.${method}:: ${data}`
          );
        }
      });
    }
  });
}

function logMinerFee(minerFee) {
  console.log("所花手续费:");
  console.log(minerFee / Math.pow(10, 8) + " BTC");
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

function logOutputs(outputs) {
  console.log("提现列表:");
  console.table(
    outputs.map(out => ({
      address: out.address,
      balance: out.balance / Math.pow(10, 8) + " BTC"
    }))
  );

  const all = outputs.reduce((result, out) => result + out.balance, 0);
  console.table([{ all: all / Math.pow(10, 8) + " BTC" }]);
}

(async function() {
  try {
    await init();
    await construct();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
