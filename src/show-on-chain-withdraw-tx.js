/**
 * 此脚本显示目前链上代签原文
 */

const { getApi } = require("./chainx");
require("console.table");
const { getBTCWithdrawList } = require("./chainx-common/index");
const bitcoin = require("bitcoinjs-lib");

let network;
let api;

async function init() {
  api = await getApi();
}

// 显示链上代签原文
async function showWithdrawalTx() {
  const withdrawTx = await getBTCWithdrawList();

  console.log(`当前链上提现原文: ${withdrawTx}`);
}

(async function() {
  try {
    await init();
    await showWithdrawalTx();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
