/**
 *
 *  该脚本显示链上提现列表
 *
*/

const { getApi } = require('./chainx')
const { getWithdrawLimit, getBTCWithdrawList } = require('./chainx-common/index')

const api = null

async function init() {
    api = await getApi()
}
async function showWithdrawLimit() {
    const limit = await getWithdrawLimit(api)
    console.log("提现设置:\n")
    console.log(JSON.stringify(limit))
}

async function showWithdrawList() {
    const withdrawList = await getBTCWithdrawList(api)
    console.log('提现列表')
    console.log(JSON.stringify(withdrawList))
}

(
    async function () {
        try {
            await init()
            await showWithdrawLimit()
            await showWithdrawList()
        } catch (e) {
            console.error(e);
            process.exit(1);
        }
    }
)();

