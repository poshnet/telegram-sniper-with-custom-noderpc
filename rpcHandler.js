const { Connection, PublicKey } = require('@solana/web3.js');

class RpcHandler {
    constructor() {
        // Choose one of these endpoints:
        this.connection = new Connection(
            // Mainnet
            'https://api.mainnet-beta.solana.com',
            // OR Devnet
            // 'https://api.devnet.solana.com',
            // OR Testnet
            // 'https://api.testnet.solana.com',
            'confirmed'
        );
    }

    async getRpcData(method, params) {
        try {
            switch(method) {
                case 'getBalance':
                    const balance = await this.connection.getBalance(new PublicKey(params));
                    return balance / 1e9; // Convert lamports to SOL
                case 'getRecentBlockhash':
                    return await this.connection.getRecentBlockhash();
                // Add more methods as needed
                default:
                    throw new Error('Method not supported');
            }
        } catch (error) {
            console.error('RPC Error:', error);
            throw error;
        }
    }

    async sendRpcTransaction(txData) {
        try {
            // Implement your Solana transaction logic here
            const signature = await this.connection.sendTransaction(txData);
            return signature;
        } catch (error) {
            console.error('Transaction Error:', error);
            throw error;
        }
    }
}

module.exports = new RpcHandler(); 