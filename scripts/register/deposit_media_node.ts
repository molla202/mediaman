import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { SigningStargateClient } from "@cosmjs/stargate";
import { MsgDepositMediaNode, MsgRegisterMediaNode, MsgRegisterMediaNode_HardwareSpecs, MsgRegisterMediaNode_Info } from './src/proto/media_node';
import { GasPrice } from '@cosmjs/stargate';
import { Coin } from './src/proto/cosmos/base/v1beta1/coin';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

const config = {
    'DEVNET': {
        RPC_URL: 'https://rpc.devnet-alpha.omniflix.network',
        CHAIN_ID: 'devnet-alpha-3',
        PREFIX: 'omniflix',
        GAS_PRICE: '0.0025uflix',
        DENOM: 'uflix',
    },
    'TESTNET': {
        RPC_URL: 'https://rpc.testnet.omniflix.network',
        CHAIN_ID: 'flixnet-4',
        PREFIX: 'omniflix',
        GAS_PRICE: '0.0025uflix',
        DENOM: 'uflix',
    },
    'MAINNET': {
        RPC_URL: 'https://rpc.omniflix.network',
        CHAIN_ID: 'omniflixhub-1',
        PREFIX: 'omniflix',
        GAS_PRICE: '0.0025uflix',
        DENOM: 'uflix',
    },
    'FRAMEFEST': {
        RPC_URL: 'https://rpc.framefest-testnet.omniflix.network',
        CHAIN_ID: 'framefest-1',
        PREFIX: 'omniflix',
        GAS_PRICE: '0.0025uframe',
        DENOM: 'uframe',
    }
}

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option('env', {
            alias: 'e',
            description: 'Environment (DEVNET, TESTNET, MAINNET, FRAMEFEST)',
            type: 'string',
            default: 'DEVNET'
        })
        .option('mnemonic', {
            alias: 'm',
            description: 'Wallet mnemonic',
            type: 'string',
            demandOption: true
        })
        .option('id', {
            alias: 'i',
            description: 'Media Node ID',
            type: 'string',
            demandOption: true
        })
        .option('deposit', {
            alias: 'd',
            description: 'Deposit amount in FLIX/FRAME',
            type: 'string',
            demandOption: true
        })
        .help()
        .alias('help', 'h')
        .parse();

    const devnet = config[argv.env as keyof typeof config];
    console.log(devnet);
    if (!argv.mnemonic) {
        console.error('\n\nMnemonic is required\n\n');
        process.exit(1);
    }
    if (!argv.id) {
        console.error('\n\nMedia Node ID is required\n\n');
        process.exit(1);
    }
    if (!argv.deposit) {
        console.error('\n\nDeposit amount is required\n\n');
        process.exit(1);
    }

    // Convert price per hour and deposit to uflix (1 FLIX = 1000000 uflix)
    const deposit = parseInt(argv.deposit) * 1000000;

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(argv.mnemonic, { prefix: devnet.PREFIX });
    const client = await SigningStargateClient.connectWithSigner(devnet.RPC_URL, wallet, {
        gasPrice: GasPrice.fromString(devnet.GAS_PRICE),
    });
    const address = await wallet.getAccounts();
    const balance = await client.getBalance(address[0].address, devnet.DENOM);
    console.log(`Current balance: ${balance.amount} ${devnet.DENOM}`);
    if (parseInt(balance.amount) < deposit) {
        console.error('\n\nInsufficient balance to cover the deposit. Please deposit FLIX to your wallet and try again.\n\n');
        process.exit(1);
    }

    client.registry.register('/OmniFlix.medianode.v1beta1.MsgDepositMediaNode', MsgDepositMediaNode);
    const msg = MsgDepositMediaNode.fromPartial({
        id: argv.id,
        amount: Coin.fromPartial({
            denom: devnet.DENOM,
            amount: deposit.toString(),
        }),
        sender: address[0].address,
    });
    console.log(msg);

    const tx = await client.signAndBroadcast(address[0].address, 
        [{
            typeUrl: '/OmniFlix.medianode.v1beta1.MsgDepositMediaNode',
            value: msg 
        }], 'auto');
    console.log(tx);
    console.log('\n\nMedia Node deposit successfully\n\n');
}

main();
