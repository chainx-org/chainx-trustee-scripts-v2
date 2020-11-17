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
  const alice = keyring.addFromUri(process.env.chainx_private_key);

  const extrinsic = await api.tx["xGatewayBitcoin"]["signWithdrawTx"](
    addOx(rawTx)
  );
  extrinsic.signAndSend(alice, ({ events = [], status }) => {
    console.log(`Current status is ${status.type}`);
    if (status.isFinalized) {
      console.log(`Transaction included at blockHash ${status.asFinalized}`);
      // Loop through Vec<EventRecord> to display all events
      events.forEach(({ phase, event: { data, method, section } }) => {
        //console.log(`\t' ${phase}: ${section}.${method}:: ${data}`);
        if (method === "ExtrinsicFailed") {
          console.error(
            `提交ChainX信托签名交易失败 \n ${phase}: ${section}.${method}:: ${data}`
          );
          process.exit(0);
        } else if (method === "ExtrinsicSuccess") {
          console.log(
            `提交信托签名交易成功 \n ${phase}: ${section}.${method}:: ${data}`
          );
        }
      });
      process.exit(0);
    }
  });
}

(async function() {
  try {
    await init();
    await submit();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
