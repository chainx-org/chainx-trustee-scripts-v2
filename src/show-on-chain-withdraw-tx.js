/**
 * 此脚本显示目前链上代签原文
 */

const { getApi } = require("./chainx");
require("console.table");
const { isNull, remove0x } = require("./utils");
const {
  getTxByReadStorage,
  getTrusteeSessionInfo
} = require("./chainx-common/index");
const bitcoin = require("bitcoinjs-lib");

let api;

async function init() {
  api = await getApi();
}

// 显示链上代签原文
async function showWithdrawalTx() {
  const result = await getTxByReadStorage(api);
  const withdrawTx = JSON.parse(result.toString());

  if (isNull(withdrawTx.toString())) {
    console.log("当前链上无待签原文");
  } else {
    console.log("代签原文: \n", withdrawTx.tx);
    await parseRawTxAndLog(withdrawTx.tx);

    if (withdrawTx.trusteeList.length <= 0) {
      console.log("目前没有信托签名");
    } else {
      await logSignedIntentions(withdrawTx.trusteeList);
      if (withdrawTx.signStatus) {
        console.log("签名已完成");
      }
    }
  }
  process.exit(0);
}

async function parseRawTxAndLog(rawTx) {
  const tx = bitcoin.Transaction.fromHex(remove0x(rawTx));

  const normalizedOuts = tx.outs.map(out => {
    const address = bitcoin.address.fromOutputScript(
      out.script,
      bitcoin.networks.testnet
    );
    const value = out.value / Math.pow(10, 8);
    return { address, ["value(BTC)"]: value };
  });

  // TODO: 输出inputs列表，需查询比特币网络

  console.log("\nOutputs 列表:");
  console.table(normalizedOuts);
}

async function logSignedIntentions(trusteeList) {
  //返回信托列表
  const info = await getTrusteeSessionInfo(api);

  console.log("已签信托列表:\n");
  for (let trustee of trusteeList) {
    const [accountId, signed] = trustee;
    if (signed) {
      const targetIntention = info.trusteeList.filter(
        account => account === accountId
      );
      console.log(`${accountId}`);
    }
  }
}

(async function() {
  try {
    await init();
    await showWithdrawalTx();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
