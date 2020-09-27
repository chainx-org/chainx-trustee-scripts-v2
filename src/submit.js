require("dotenv").config();
const { getApi } = require("./chainx");
const { Keyring } = require("@polkadot/api");
const { addOx } = require("./utils");

let api = null;

const rawTx = process.argv[2];
if (!rawTx) {
  throw new Error("没有指定待签交易原文");
  process.exit(1);
}

async function init() {
  api = await getApi();

  if (!process.env.chainx_private_key) {
    console.error("没有设置chainx_private_key");
    process.exit(1);
  }
}

async function submit() {
  console.log("\n开始构造并提交ChainX信托交易...");
  const keyring = new Keyring({ type: "sr25519" });
  const alice = keyring.addFromUri("//Alice");

  const extrinsic = await api.tx.hex(addOx(rawTx));

  extrinsic.signAndSend(alice, ({ events, status }) => {
    console.log("status:" + JSON.stringify(status));
  });
}

(async function() {
  try {
    await init();
    await submit();
    process.exit(1);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
