const TelegramBot = require('node-telegram-bot-api');
const { getRpcData, sendRpcTransaction } = require('./rpcHandler');
const sessionManager = require('./sessionManager');
const walletMonitor = require('./walletMonitor');

const bot = new TelegramBot('7884032263:AAG2I9Uuef4b_xKc4ANM-GYMfXv6dEzLOCg', { polling: true });

// Initialize user states
const userStates = {};

// Function to get status message
function getStatusMessage(chatId) {
    const userState = userStates[chatId] || {};
    const fixedBuyAmount = userState.fixedBuyAmount ? `💰 Fixed Buy Amount: ${userState.fixedBuyAmount} SOL` : '💰 Fixed Buy Amount: Not Set';
    const tipAmount = userState.tipAmount ? `💵 Tip Amount: ${userState.tipAmount} SOL` : '💵 Tip Amount: Not Set';

    return `${fixedBuyAmount}\n${tipAmount}\n`;
} 

// Simple start command with just copy trade
bot.onText(/\/start|\/refresh/, async (msg) => {
    const chatId = msg.chat.id;
    
    const menuOptions = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🎯 Copy Trade', callback_data: 'menu_copytrade' },
                    { text: '💸 Withdraw', callback_data: 'menu_withdraw' },
                    { text: '💼 Wallet', callback_data: 'menu_wallet' }
                ]
            ]
        }
    };
    
    bot.sendMessage(
        chatId, 
        '🤖 *Trading Bot*',
        { ...menuOptions, parse_mode: 'Markdown' }
    );
});

// Handle button clicks
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userState = sessionManager.getUserState(chatId);

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
                                { text: '💰 Fixed Buy', callback_data: 'copy_fixedbuy' }
                            ],
                            [
                                { text: '💵 Tip', callback_data: 'copy_tip' }
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

            case 'back':
                const mainOptions = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '🎯 Copy Trade', callback_data: 'menu_copytrade' },
                                { text: '💸 Withdraw', callback_data: 'menu_withdraw' },
                                { text: '💼 Wallet', callback_data: 'menu_wallet' }
                            ]
                        ]
                    }
                };
                
                bot.editMessageText(
                    '🤖 *Trading Bot*',
                    {
                        chat_id: chatId,
                        message_id: query.message.message_id,
                        ...mainOptions,
                        parse_mode: 'Markdown'
                    }
                );
                break;

            case 'withdraw':
                const withdrawOptions = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '💸 Enter Withdraw Amount', callback_data: 'withdraw_amount' },
                                { text: '💼 Withdraw Wallet', callback_data: 'withdraw_wallet' }
                            ],
                            [
                                { text: '💰 Sell X SOL Amount', callback_data: 'sell_sol' },
                                { text: '🔙 Back', callback_data: 'menu_back' }
                            ]
                        ]
                    }
                };
                
                bot.editMessageText(
                    '💸 *Withdraw*\n\n' +
                    'Please select an option.',
                    {
                        chat_id: chatId,
                        message_id: query.message.message_id,
                        ...withdrawOptions,
                        parse_mode: 'Markdown'
                    }
                );
                break;

            case 'withdraw_wallet':
                sessionManager.setUserState(chatId, { 
                    ...userState, 
                    step: 'AWAITING_WITHDRAW_WALLET' 
                });
                bot.sendMessage(
                    chatId,
                    '💼 *Enter Withdraw Wallet*\n\n' +
                    'Please enter the wallet address you want to withdraw to.',
                    { parse_mode: 'Markdown' }
                );
                break;

            case 'sell_sol':
                sessionManager.setUserState(chatId, { 
                    ...userState, 
                    step: 'AWAITING_SELL_AMOUNT' 
                });
                bot.sendMessage(
                    chatId,
                    '💰 *Enter Amount to Sell*\n\n' +
                    'Please enter the amount of SOL you want to sell.',
                    { parse_mode: 'Markdown' }
                );
                break;

            case 'wallet':
                const walletOptions = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '💼 View Wallet Balance', callback_data: 'wallet_balance' }
                            ],
                            [
                                { text: '🔙 Back', callback_data: 'menu_back' }
                            ]
                        ]
                    }
                };
                
                bot.editMessageText(
                    '💼 *Wallet*\n\n' +
                    'Please select an option.',
                    {
                        chat_id: chatId,
                        message_id: query.message.message_id,
                        ...walletOptions,
                        parse_mode: 'Markdown'
                    }
                );
                break;
        }
    }

    if (query.data.startsWith('copy_')) {
        const copyAction = query.data.split('_')[1];
        switch(copyAction) {
            case 'target':
                sessionManager.setUserState(chatId, { 
                    ...userState, 
                    step: 'AWAITING_TARGET' 
                });
                bot.sendMessage(
                    chatId,
                    '🎯 *Enter Target Address*\n\n' +
                    'Send the wallet address you want to copy trades from.',
                    { parse_mode: 'Markdown' }
                );
                break;

            case 'fixedbuy':
                // Logic for setting fixed buy amount
                bot.sendMessage(chatId, '💰 *Set Fixed Buy Amount*\n\nPlease enter the amount you want to set for fixed buys.');
                sessionManager.setUserState(chatId, { ...userState, step: 'AWAITING_FIXED_BUY' });
                break;

            case 'tip':
                // Logic for setting a tip
                bot.sendMessage(chatId, '💵 *Set Tip Amount*\n\nPlease enter the tip amount you want to set.');
                sessionManager.setUserState(chatId, { ...userState, step: 'AWAITING_TIP' });
                break;
        }
    }
});

// Handle text input for fixed buy and tip amounts
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userState = sessionManager.getUserState(chatId);

    if (userState?.step === 'AWAITING_FIXED_BUY') {
        // Logic to handle fixed buy amount input
        const fixedBuyAmount = parseFloat(msg.text);
        if (!isNaN(fixedBuyAmount) && fixedBuyAmount >= 0) {
            sessionManager.setUserState(chatId, {
                ...userState,
                step: 'READY',
                fixedBuyAmount: fixedBuyAmount
            });
            bot.sendMessage(chatId, `✓ *Fixed Buy Amount Set*\n\nAmount: ${fixedBuyAmount} SOL`);
        } else {
            bot.sendMessage(chatId, 'x Invalid amount. Please enter a valid number.');
        }
    }

    if (userState?.step === 'AWAITING_TIP') {
        // Logic to handle tip amount input
        const tipAmount = parseFloat(msg.text);
        if (!isNaN(tipAmount) && tipAmount >= 0) {
            sessionManager.setUserState(chatId, {
                ...userState,
                step: 'READY',
                tipAmount: tipAmount
            });
            bot.sendMessage(chatId, `✓ *Tip Amount Set*\n\nAmount: ${tipAmount} SOL`);
        } else {
            bot.sendMessage(chatId, 'x Invalid amount. Please enter a valid number.');
        }
    }

    if (userState?.step === 'AWAITING_TARGET') {
        // Logic to handle target address input
        try {
            if (msg.text.length === 44) {
                sessionManager.setUserState(chatId, {
                    ...userState,
                    step: 'READY',
                    targetWallet: msg.text
                });
                
                bot.sendMessage(chatId, `✅ *Target Address Set*\n\nAddress: \`${msg.text}\``, { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, '❌ Invalid address format. Please try again.');
            }
        } catch (error) {
            bot.sendMessage(chatId, '❌ Error setting target address. Please try again.');
        }
    }
});