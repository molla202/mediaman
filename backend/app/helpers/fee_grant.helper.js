const async = require('async');
const Axios = require('axios');
const AxiosRetry = require('axios-retry');
AxiosRetry(Axios, {
    retries: 3,
    retryDelay: (retryCount) => {
        console.log(`retry attempt: ${retryCount}`);
        return retryCount * 2000; // time interval between retries
    },
});
const { flixnet } = require('../../config/index');

const enableFeeGrant = (bcAccountAddress, cb) => {
    async.waterfall([
        (next) => {
            const url = flixnet.feeGrantAPIURL;
            const reqBody = {
                address: bcAccountAddress,
            };
            Axios({
                method: 'post',
                url,
                data: JSON.stringify(reqBody),
            }).then(res => {
                const transactionHash = (res.data && res.data.txhash) ? res.data.txhash : null;
                next(null, transactionHash);
            }).catch((_) => {
                console.log(_);
                next({
                    message: 'Unable to grant fee.',
                });
            });
        }, (txHash, next) => {
            if (txHash) {
                const url = `${flixnet.apiAddress}/cosmos/tx/v1beta1/txs/${txHash}`;
                Axios({
                    method: 'get',
                    url,
                }).then(res => {
                    if (res && res.data && res.data.tx_response) {
                        if (res.data.tx_response.code === 0) {
                            next(null, txHash);
                        } else {
                            next({
                                message: 'Transaction Failed.',
                            });
                        }
                    } else {
                        next({
                            message: 'Invalid transaction details.',
                        });
                    }
                }).catch((_) => {
                    console.log(_);
                    next({
                        message: 'Error occurred while fetching transaction details.',
                    });
                });
            } else {
                next(null, txHash);
            }
        },
    ], cb);
};

module.exports = {
    enableFeeGrant,
};
