/**
 *
 *  该脚本显示链上提现列表
 *
 */

const { getApi } = require("./chainx");
const {
  getWithdrawLimit,
  getBTCWithdrawList,
  getTxByReadStorage,
  getTrusteeSessionInfo
} = require("./chainx-common/index");

let api = null;

async function init() {
  api = await getApi();
}
async function showWithdrawLimit() {
  const limit = await getWithdrawLimit(api);
  console.log("提现设置:\n");
  console.log(JSON.stringify(limit));
}

async function showWithdrawList() {
  const withdrawList = await getBTCWithdrawList(api);
  console.log("提现列表");
  console.log(JSON.stringify(withdrawList));
  const btcTxList = await getTxByReadStorage(api);
  console.log(`交易原文列表 ${btcTxList}`);
  const trusteeList = await getTrusteeSessionInfo(api);
  console.log(`验证者列表 ${trusteeList}`);
}

(async function() {
  try {
    await init();
    await showWithdrawLimit();
    await showWithdrawList();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
