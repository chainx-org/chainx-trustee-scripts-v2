const bitcoin = require("bitcoinjs-lib");
// 获取信托节点列表
async function getTrusteeSessionInfo(api) {
  const trusteeList = await api.rpc.xgatewaycommon.bitcoinTrusteeSessionInfo();
  return trusteeList;
}

// 获取Storage中信托提现的Proposal状态
async function getTxByReadStorage(api) {
  const { parentHash } = await api.rpc.chain.getHeader();
  const btcTxLists = await api.query.xGatewayBitcoin.withdrawalProposal.at(
    parentHash
  );
  return JSON.parse(btcTxLists.toString());
}

// 获取BitCoin的Type
async function getBtcNetworkState(api) {
  const { parentHash } = await api.rpc.chain.getHeader();
  const netWorkType = await api.query.xGatewayBitcoin.networkId.at(parentHash);
  if (netWorkType.toString() === "Testnet") {
    return "testnet";
  } else {
    return "mainnet";
  }
}

// 获取链状态
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

  const networkType = await getBtcNetworkState(api);

  properties.bitcoin_type = networkType;

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

module.exports = {
  getBTCWithdrawList,
  getBtcNetworkState,
  getWithdrawLimit,
  getTxByReadStorage,
  getTrusteeSessionInfo,
  getChainProperties
};
