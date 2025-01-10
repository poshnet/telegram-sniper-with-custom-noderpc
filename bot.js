require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { getRpcData, sendRpcTransaction } = require('./rpcHandler');
const sessionManager = require('./sessionManager');
const walletMonitor = require('./walletMonitor');
const bs58 = require('bs58'); // Import base58 library for validation

const bot = new TelegramBot('7884032263:AAG2I9Uuef4b_xKc4ANM-GYMfXv6dEzLOCg', { polling: true });

// Function to get the current balance of the user's wallet
async function getWalletBalance(chatId) {
    const userState = sessionManager.getUserState(chatId);
    if (!userState?.tradingKey) {
        return null; // No trading key set
    }
    try {
        const balance = await getRpcData('getBalance', userState.tradingKey);
        return balance;
    } catch (error) {
        console.error('Error fetching wallet balance:', error);
        return null; // Return null if there's an error
    }
}

// Simple start command with just copy trade
bot.onText(/\/start|\/refresh/, async (msg) => {
    const chatId = msg.chat.id;
    
    const userState = sessionManager.getUserState(chatId);
    const copySellButtonText = userState?.copySellEnabled ? '🔴 Disable Copy Sell' : '🟢 Enable Copy Sell';

    // Fetch the current wallet balance
    const balance = await getWalletBalance(chatId);
    const balanceText = balance !== null ? `Current Balance: ${balance} SOL` : '⚠️ Wallet not set up.';

    const menuOptions = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🎯 Copy Trade', callback_data: 'menu_copytrade' }
                ],
                [
                    { text: '💸 Sell', callback_data: 'menu_sell' }
                ],
                [
                    { text: '💰 Withdraw', callback_data: 'withdraw' }
                ]
            ]
        }
    };
    
    bot.sendMessage(
        chatId, 
        `🤖 *Trading Bot*\n\n${balanceText}`,
        { ...menuOptions, parse_mode: 'Markdown' }
    );
});

// Handle button clicks
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userState = sessionManager.getUserState(chatId);

    try {
        if (query.data.startsWith('menu_')) {
            const menuAction = query.data.split('_')[1];
            switch(menuAction) {
                case 'copytrade':
                    const copyTradeOptions = {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '🎯 Set Target Address', callback_data: 'copy_target' }
                                ],
                                [
                                    { text: '💰 Fixed Buy', callback_data: 'fixed_buy' }
                                ],
                                [
                                    { text: '⚙️ Set Gas Price', callback_data: 'set_gas_price' }
                                ],
                                [
                                    { text: '💵 Set Tip Amount', callback_data: 'set_tip_amount' }
                                ],
                                [
                                    { text: '🔄 Copy Sell: ' + (userState?.copySellEnabled ? '🟢 Enabled' : '🔴 Disabled'), callback_data: 'copy_sell' }
                                ],
                                [
                                    { text: '🔙 Back', callback_data: 'menu_back' }
                                ]
                            ]
                        }
                    };
                    
                    bot.editMessageText(
                        `🎯 *Copy Trade*\n\n` +
                        `Target: ${userState?.targetWallet || 'Not Set'}`,
                        {
                            chat_id: chatId,
                            message_id: query.message.message_id,
                            ...copyTradeOptions,
                            parse_mode: 'Markdown'
                        }
                    );
                    break;

                case 'set_gas_price':
                    bot.sendMessage(chatId, 'Please enter the gas price (must be >= 0.001 SOL):');
                    sessionManager.setUserState(chatId, { ...userState, step: 'AWAITING_GAS_PRICE' });
                    break;

                case 'set_tip_amount':
                    bot.sendMessage(chatId, 'Please enter the tip amount (must be >= 0.001 SOL):');
                    sessionManager.setUserState(chatId, { ...userState, step: 'AWAITING_TIP_AMOUNT' });
                    break;

                case 'fixed_buy':
                    bot.sendMessage(chatId, 'Please enter the fixed buy amount (must be >= 0.001 SOL):');
                    sessionManager.setUserState(chatId, { ...userState, step: 'AWAITING_FIXED_BUY' });
                    break;

                case 'withdraw':
                    bot.sendMessage(chatId, 'Please enter your wallet address to withdraw to:');
                    sessionManager.setUserState(chatId, { ...userState, step: 'AWAITING_WALLET_ADDRESS' });
                    break;

                default:
                    bot.answerCallbackQuery(query.id, { text: 'Unknown command', show_alert: true });
                    break;
            }
        }
    } catch (error) {
        console.error('Error handling callback query:', error);
        bot.sendMessage(chatId, '❌ An error occurred while processing your request. Please try again.');
    }
});

// Handle text input for gas price, tip amount, fixed buy amount, and wallet address
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userState = sessionManager.getUserState(chatId);

    try {
        if (userState?.step === 'AWAITING_GAS_PRICE') {
            const gasPrice = parseFloat(msg.text.trim());
            if (!isNaN(gasPrice) && gasPrice >= 0.001) {
                sessionManager.setUserState(chatId, { ...userState, gasPrice });
                bot.sendMessage(chatId, `✅ Gas price set to: ${gasPrice} SOL`);
            } else {
                bot.sendMessage(chatId, '❌ Invalid gas price. Please enter a valid number (must be >= 0.001 SOL).');
            }
            sessionManager.setUserState(chatId, { ...userState, step: null }); // Reset step

        } else if (userState?.step === 'AWAITING_TIP_AMOUNT') {
            const tipAmount = parseFloat(msg.text.trim());
            if (!isNaN(tipAmount) && tipAmount >= 0.001) {
                sessionManager.setUserState(chatId, { ...userState, tipAmount });
                bot.sendMessage(chatId, `✅ Tip amount set to: ${tipAmount} SOL`);
            } else {
                bot.sendMessage(chatId, '❌ Invalid tip amount. Please enter a valid number (must be >= 0.001 SOL).');
            }
            sessionManager.setUserState(chatId, { ...userState, step: null }); // Reset step

        } else if (userState?.step === 'AWAITING_FIXED_BUY') {
            const fixedBuyAmount = parseFloat(msg.text.trim());
            if (!isNaN(fixedBuyAmount) && fixedBuyAmount >= 0.001) {
                sessionManager.setUserState(chatId, { ...userState, fixedBuyAmount });
                bot.sendMessage(chatId, `✅ Fixed buy amount set to: ${fixedBuyAmount} SOL`);
            } else {
                bot.sendMessage(chatId, '❌ Invalid fixed buy amount. Please enter a valid number (must be >= 0.001 SOL).');
            }
            sessionManager.setUserState(chatId, { ...userState, step: null }); // Reset step

        } else if (userState?.step === 'AWAITING_WALLET_ADDRESS') {
            const walletAddress = msg.text.trim();
            if (isValidSolanaAddress(walletAddress)) {
                sessionManager.setUserState(chatId, { ...userState, walletAddress });
                bot.sendMessage(chatId, 'You can withdraw all SOL or specify an amount. Please enter the amount you want to withdraw (or type "all" to withdraw all available SOL).');
                sessionManager.setUserState(chatId, { ...userState, step: 'AWAITING_WITHDRAW_AMOUNT' });
            } else {
                bot.sendMessage(chatId, '❌ Invalid wallet address format. Please enter a valid Solana address.');
            }
        } else if (userState?.step === 'AWAITING_WITHDRAW_AMOUNT') {
            const withdrawInput = msg.text.trim();
            const balance = await getWalletBalance(chatId);

            if (withdrawInput.toLowerCase() === 'all') {
                if (balance !== null && balance > 0) {
                    const walletAddress = userState.walletAddress; // Get the stored wallet address
                    // Logic to handle withdrawal of all SOL
                    await sendRpcTransaction({
                        to: walletAddress,
                        amount: balance
                    });
                    bot.sendMessage(chatId, `✅ Withdrawal of all ${balance} SOL to ${walletAddress} processed.`);
                } else {
                    bot.sendMessage(chatId, '❌ Insufficient balance to withdraw.');
                }
            } else {
                const withdrawAmount = parseFloat(withdrawInput);
                if (balance !== null && withdrawAmount > 0 && withdrawAmount <= balance) {
                    const walletAddress = userState.walletAddress; // Get the stored wallet address
                    // Logic to handle withdrawal
                    await sendRpcTransaction({
                        to: walletAddress,
                        amount: withdrawAmount
                    });
                    bot.sendMessage(chatId, `✅ Withdrawal of ${withdrawAmount} SOL to ${walletAddress} processed.`);
                } else {
                    bot.sendMessage(chatId, '❌ Invalid withdrawal amount. Please enter a valid number (must be <= your current balance).');
                }
            }
            sessionManager.setUserState(chatId, { ...userState, step: null, walletAddress: null }); // Reset step and clear wallet address
        }
    } catch (error) {
        console.error('Error handling message:', error);
        bot.sendMessage(chatId, '❌ An error occurred while processing your input. Please try again.');
    }
});

// Function to validate Solana wallet address
function isValidSolanaAddress(address) {
    try {
        const decoded = bs58.decode(address);
        return decoded.length === 32; // Solana addresses are 32 bytes
    } catch (error) {
        return false; // If decoding fails, it's not a valid address
    }
}

// Function to handle selling all tokens
async function handleSellAll(chatId) {
    const userState = sessionManager.getUserState(chatId);
    
    if (!userState?.tradingKey) {
        bot.sendMessage(chatId, '⚠️ Please set up your trading wallet first!');
        return;
    }

    try {
        // Logic to sell all tokens held
        const balance = await getRpcData('getBalance', userState.tradingKey);
        
        if (balance > 0) {
            // Assuming you have a function to send the transaction
            const result = await sendRpcTransaction({
                to: 'YOUR_RECEIVE_WALLET_ADDRESS', // Replace with your receive wallet address
                amount: balance
            });

            bot.sendMessage(chatId, `✅ Successfully sold all tokens!\n\nAmount: ${balance} SOL\nTransaction: ${result.signature}`);
        } else {
            bot.sendMessage(chatId, '❌ No tokens to sell.');
        }
    } catch (error) {
        bot.sendMessage(chatId, `❌ Error during sell all: ${error.message}`);
    }
}

// Handle text input for token address
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userState = sessionManager.getUserState(chatId);

    if (userState?.step === 'AWAITING_TOKEN_ADDRESS') {
        const tokenAddress = msg.text.trim();
        if (isValidSolanaAddress(tokenAddress)) {
            // Logic to sell the specified token
            await handleSellToken(chatId, tokenAddress);
        } else {
            bot.sendMessage(chatId, '❌ Invalid token address format. Please enter a valid Solana address.');
        }
    }
});

// Function to handle selling a specific token
async function handleSellToken(chatId, tokenAddress) {
    // Implement the logic to sell the specified token
    // This will depend on your specific requirements and how you handle token sales
    bot.sendMessage(chatId, `🔄 Selling token at address: ${tokenAddress}...`);
    // Add your token selling logic here
}

