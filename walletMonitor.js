const { Connection, PublicKey, Transaction, Keypair, SystemProgram } = require('@solana/web3.js');

class WalletMonitor {
    constructor() {
        this.connection = new Connection('https://api.mainnet-beta.solana.com');
        this.watchedWallets = new Map();
    }

    async startWatching(chatId, targetWallet, tradingKey) {
        if (this.watchedWallets.has(chatId)) {
            await this.stopWatching(chatId);
        }

        // Convert private key to Keypair
        const keypair = Keypair.fromSecretKey(
            Uint8Array.from(tradingKey.split(',').map(Number))
        );

        const subscription = this.connection.onAccountChange(
            new PublicKey(targetWallet),
            async (accountInfo, context) => {
                // Get recent transactions
                const signatures = await this.connection.getSignaturesForAddress(
                    new PublicKey(targetWallet),
                    { limit: 1 }
                );

                if (signatures.length > 0) {
                    const txInfo = await this.connection.getTransaction(signatures[0].signature);
                    await this.copyTransaction(chatId, txInfo, keypair);
                }
            },
            'confirmed'
        );

        this.watchedWallets.set(chatId, {
            targetWallet,
            keypair,
            subscription,
            lastTx: null
        });

        return true;
    }

    async copyTransaction(chatId, txInfo, keypair) {
        try {
            // Create a new transaction
            const transaction = new Transaction();

            // Get recent blockhash
            const { blockhash } = await this.connection.getRecentBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = keypair.publicKey;

            // Add transfer instruction
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: keypair.publicKey,
                    toPubkey: new PublicKey(txInfo.transaction.message.accountKeys[1]),
                    lamports: txInfo.meta.postBalances[1] - txInfo.meta.preBalances[1]
                })
            );

            // Sign and send transaction
            const signedTx = await keypair.sign(transaction);
            const signature = await this.connection.sendRawTransaction(
                signedTx.serialize(),
                { maxRetries: 5 }
            );

            await this.connection.confirmTransaction(signature);
            
            return {
                success: true,
                signature,
                amount: (txInfo.meta.postBalances[1] - txInfo.meta.preBalances[1]) / 1e9
            };

        } catch (error) {
            console.error('Copy trade error:', error);
            throw error;
        }
    }

    async stopWatching(chatId) {
        const walletData = this.watchedWallets.get(chatId);
        if (walletData) {
            await this.connection.removeAccountChangeListener(walletData.subscription);
            this.watchedWallets.delete(chatId);
        }
    }
}

module.exports = new WalletMonitor(); 