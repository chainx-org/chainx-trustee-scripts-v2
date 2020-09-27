/**
 * 此脚本显示目前链上代签原文
 */

const { getApi } = require("./chainx");
require("console.table");
const { isNull } = require("./utils");
const { getTxByReadStorage } = require("./chainx-common/index");
const bitcoin = require("bitcoinjs-lib");

let api;

async function init() {
  api = await getApi();
}

// 显示链上代签原文
async function showWithdrawalTx() {
  const withdrawTx = await getTxByReadStorage(api);

  if (isNull(withdrawTx)) {
    console.log("当前链上无待签原文");
  } else {
    console.log("代签原文: \n", withdrawalTx.tx);
    await parseRawTxAndLog(withdrawalTx.tx);

    if (withdrawalTx.trusteeList.length <= 0) {
      console.log("目前没有信托签名");
    } else {
      await logSignedIntentions(withdrawalTx.trusteeList);

      if (withdrawalTx.signStatus) {
        console.log("签名已完成");
      }
    }
  }
  process.exit(0);
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
