async function getBTCWithdrawList(api) {
    //  TODO: 处理分页问题
    const withdrawList = await api.xgatewayrecords.withdrawalListByChain('Bitcoin')
    console.log(JSON.stringify(withdrawList))
    return withdrawList
}


async function getWithdrawLimit(api) {
    // TODO: Bitcoin asstId为1
    const limit = await api.xgatewaycommon.withdrawalLimit("1");
    return limit;
}


module.exports = {
    getBTCWithdrawList,
    getWithdrawLimit
}
