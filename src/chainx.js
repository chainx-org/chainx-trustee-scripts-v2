const { ApiPromise, WsProvider } = require("@polkadot/api");
const { options } = require("@chainx-v2/api");

require("dotenv").config();

if (!process.env.chainx_ws_addr) {
  console.error("没有设置chainx_ws_addr");
  process.exit(1);
}

let api = null;
let provider = null;

const getApi = async () => {
  const wsProvider = new WsProvider(process.env.chainx_ws_addr);
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
