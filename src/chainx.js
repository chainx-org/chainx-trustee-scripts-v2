import { ApiPromise, WsProvider } from '@polkadot/api'
import { options } from '@chainx-v2/api'

const url = 'ws://47.114.150.67:8000'

let api = null
let provider = null

export const getApi = async () => {
    const wsProvider = new WsProvider(url)
    api = new ApiPromise(options({ provider: wsProvider }))

    await api.isReady

    if (provider) {
        provider.disconnect()
    }

    provider = wsProvider
    return api
}
