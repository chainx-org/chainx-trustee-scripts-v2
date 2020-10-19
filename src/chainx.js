const { ApiPromise, WsProvider } = require("@polkadot/api");
const { options } = require("@chainx-v2/api");

const url = "wss://staging-1.chainx.org/ws";

let api = null;
let provider = null;

const getApi = async () => {
  const wsProvider = new WsProvider(url);
  api = new ApiPromise(options({ provider: wsProvider }));

  await api.isReady;

  if (provider) {
    provider.disconnect();
  }

  provider = wsProvider;
  return api;
};

module.exports = {
  getApi
};
