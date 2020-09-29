async function getTrusteeSessionInfo(api) {
  const trusteeList = await api.rpc.xgatewaycommon.bitcoinTrusteeSessionInfo();
  return trusteeList;
}

async function getChainProperties(api) {
  const systemProperties = await api.rpc.system.properties();
  const properties = systemProperties.toJSON();

  // BTC 精度信息
  const assets = await api.rpc.xassets.getAssets();
  const json = assets.toJSON();
  const normalized = Object.keys(json).map(id => {
    return {
      id,
      ...json[id]
    };
  });
  properties["bitcoin_type"] = "testnet";

  return properties;
}

async function getBTCWithdrawList(api) {
  //  TODO: 处理分页问题
  const withdrawObject = await api.rpc.xgatewayrecords.withdrawalListByChain(
    "Bitcoin"
  );
  let withdrawList = [];
  Object.entries(withdrawObject.toJSON()).forEach(([key, value]) => {
    withdrawList.push({
      id: key,
      ...value
    });
  });

  return withdrawList;
}

async function getWithdrawLimit(api) {
  // TODO: Bitcoin asstId为1
  const limit = await api.rpc.xgatewaycommon.withdrawalLimit("1");
  const json = JSON.parse(limit.toString());
  return json;
}

async function getTxByReadStorage(api) {
  const { parentHash } = await api.rpc.chain.getHeader();
  console.log(`hash.... ${parentHash}`);
  const btcTxLists = await api.query.xGatewayBitcoin.withdrawalProposal.at(
    parentHash
  );

  return JSON.parse(btcTxLists.toString());
}
module.exports = {
  getBTCWithdrawList,
  getWithdrawLimit,
  getTxByReadStorage,
  getTrusteeSessionInfo,
  getChainProperties
};
