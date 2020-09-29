require("dotenv").config();
const { remove0x, addOx, isNull } = require("./utils");
const { Keyring } = require("@polkadot/api");
const { getApi } = require("./chainx");
const bitcoin = require("bitcoinjs-lib");
const {
  getTrusteeSessionInfo,
  getTxByReadStorage,
  getChainProperties
} = require("./chainx-common/index");

const args = process.argv.slice(2);
const needSubmit = args.find(arg => arg === "--submit");

let redeemScript;
let api;

async function init() {
  api = await getApi();

  const info = await getTrusteeSessionInfo(api);
  redeemScript = Buffer.from(
    remove0x(info.hotAddress.redeemScript.toString()),
    "hex"
  );

  if (!process.env.bitcoin_private_key) {
    console.error("没有设置bitcoin_private_key");
    process.exit(1);
  }
}

async function respond() {
  const withdrawalTx = await getTxByReadStorage(api);

  if (isNull(withdrawalTx.toString())) {
    console.log("当前链上无待签原文");
    process.exit(0);
  } else {
    console.log("代签原文: \n", withdrawalTx.tx);
    await parseRawTxAndLog(withdrawalTx.tx);

    await sign(withdrawalTx.tx);

    if (!needSubmit) {
      process.exit(0);
    }
  }
}

async function parseRawTxAndLog(rawTx) {
  const tx = bitcoin.Transaction.fromHex(remove0x(rawTx));

  const properties = await getChainProperties(api);
  const network =
    properties["bitcoin_type"] === "mainnet"
      ? bitcoin.networks.bitcoin
      : bitcoin.networks.testnet;

  const normalizedOuts = tx.outs.map(out => {
    const address = bitcoin.address.fromOutputScript(out.script, network);
    const value = out.value / Math.pow(10, 8);
    return { address, ["value(BTC)"]: value };
  });

  // TODO: 输出inputs列表，需查询比特币网络

  console.log("\nOutputs 列表:");
  console.table(normalizedOuts);
}

async function sign(rawTx) {
  const properties = await getChainProperties(api);
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
    process.exit(0);
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

  await extrinsic.signAndSend(alice, ({ events = [], status }) => {
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
