import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { SigningStargateClient } from "@cosmjs/stargate";
import { MsgRegisterMediaNode, MsgRegisterMediaNode_HardwareSpecs, MsgRegisterMediaNode_Info } from './src/proto/media_node';
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
        GAS_PRICE: '0.0025utflix',
        DENOM: 'utflix',
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
        .option('url', {
            alias: 'u',
            description: 'Media Node URL',
            type: 'string',
            demandOption: true
        })
        .option('hardware-specs', {
            alias: 's',
            description: 'Hardware specs (format: cpus,ram,storage)',
            type: 'string',
            demandOption: true,
            coerce: (arg: string) => {
                if (typeof arg !== 'string') {
                    throw new Error('Hardware specs must be a string');
                }
                const specs = arg.split(',').map(Number);
                if (specs.length !== 3 || specs.some(isNaN)) {
                    throw new Error('Hardware specs must be in format: cpus,ram,storage (numbers only)');
                }
                return specs;
            }
        })
        .option('info', {
            alias: 'n',
            description: 'Node info',
            type: 'string',
            demandOption: true
        })
        .option('description', {
            alias: 'dn',
            description: 'Node description',
            type: 'string',
            demandOption: true
        })
        .option('price-per-hour', {
            alias: 'p',
            description: 'Price per hour in FLIX/FRAME',
            type: 'string',
            demandOption: true
        })
        .option('deposit', {
            alias: 'd',
            description: 'Deposit amount in FLIX/FRAME',
            type: 'string',
            demandOption: true
        })
        .option('contact', {
            alias: 'c',
            description: 'Contact email',
            type: 'string',
            demandOption: true
        })
        .help()
        .alias('help', 'h')
        .parse();

    const devnet = config[argv.env as keyof typeof config];
    console.log(devnet);
    const hardwareSpecs = argv['hardware-specs'] as number[];
    if (!Array.isArray(hardwareSpecs) || hardwareSpecs.length !== 3) {
        console.error('\n\nInvalid hardware specs format\n\n');
        process.exit(1);
    }
    const [cpus, ramInGb, storageInGb] = hardwareSpecs;
    if (!argv.mnemonic) {
        console.error('\n\nMnemonic is required\n\n');
        process.exit(1);
    }
    if (!argv.id) {
        console.error('\n\nMedia Node ID is required\n\n');
        process.exit(1);
    }
    if (!argv.url) {
        console.error('\n\nMedia Node URL is required\n\n');
        process.exit(1);
    }
    if (!argv.info) {
        console.error('\n\nNode info is required\n\n');
        process.exit(1);
    }
    if (!argv.description) {
        console.error('\n\nNode description is required\n\n');
        process.exit(1);
    }
    if (!argv.pricePerHour) {
        console.error('\n\nPrice per hour is required\n\n');
        process.exit(1);
    }
    if (!argv.deposit) {
        console.error('\n\nDeposit amount is required\n\n');
        process.exit(1);
    }

    // Convert price per hour and deposit to uflix (1 FLIX = 1000000 uflix)
    const pricePerHour = parseInt(argv.pricePerHour) * 1000000;
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

    client.registry.register('/OmniFlix.medianode.v1beta1.MsgRegisterMediaNode', MsgRegisterMediaNode);
    const msg = MsgRegisterMediaNode.fromPartial({
        id: argv.id,
        url: argv.url,
        hardwareSpecs: MsgRegisterMediaNode_HardwareSpecs.fromPartial({
            cpus,
            ramInGb,
            storageInGb,
        }),
        info: MsgRegisterMediaNode_Info.fromPartial({
            moniker: argv.info,
            description: argv.info,
            contact: argv.contact,
        }),
        pricePerHour: Coin.fromPartial({
            denom: devnet.DENOM,
            amount: pricePerHour.toString(),
        }),
        deposit: Coin.fromPartial({
            denom: devnet.DENOM,
            amount: deposit.toString(),
        }),
        sender: address[0].address,
    });
    console.log(msg);

    const tx = await client.signAndBroadcast(address[0].address, 
        [{
            typeUrl: '/OmniFlix.medianode.v1beta1.MsgRegisterMediaNode',
            value: msg 
        }], 'auto');
    console.log(tx);
    console.log('\n\nMedia Node registered successfully\n\n');
}

main();
