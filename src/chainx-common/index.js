async function getTrusteeSessionInfo(api) {
  const trusteeList = await api.rpc.xgatewaycommon.bitcoinTrusteeSessionInfo();
  return trusteeList;
}

async function getBTCWithdrawList(api) {
  //  TODO: 处理分页问题
  const withdrawList = await api.rpc.xgatewayrecords.withdrawalListByChain(
    "Bitcoin"
  );
  console.log(JSON.stringify(withdrawList));
  return withdrawList;
}

async function getWithdrawLimit(api) {
  // TODO: Bitcoin asstId为1
  const limit = await api.rpc.xgatewaycommon.withdrawalLimit("1");
  return limit;
}

async function getTxByReadStorage(api) {
  const { parentHash } = await api.rpc.chain.getHeader();
  const btcTxLists = await api.query.xGatewayBitcoin.withdrawalProposal.at(
    parentHash
  );
  return btcTxLists;
}
module.exports = {
  getBTCWithdrawList,
  getWithdrawLimit,
  getTxByReadStorage,
  getTrusteeSessionInfo
};
