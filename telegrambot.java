const TelegramBot = require('node-telegram-bot-api');
const TOKEN = 'YOUR_BOT_TOKEN_HERE';

// Initialize bot with polling
const bot = new TelegramBot(TOKEN, { polling: true });

// Store user subscriptions
const userSubscriptions = new Map();

// Create keyboard markup for main menu
const mainMenuKeyboard = {
    reply_markup: {
        keyboard: [
            ['📊 Follow Trader', '❌ Unfollow Trader'],
            ['📈 View Subscriptions', 'ℹ️ Help']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    }
};

// Start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        "Welcome to the CopyTrading Bot! 🚀\n\n" +
        "Use the menu below to:\n" +
        "- Follow traders\n" +
        "- Manage your subscriptions\n" +
        "- View trading activities",
        mainMenuKeyboard
    );
});

// Handle menu buttons and messages
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const messageText = msg.text;

    switch (messageText) {
        case '📊 Follow Trader':
            bot.sendMessage(chatId, 
                "Please send the wallet address of the trader you want to follow in this format:\n" +
                "/follow <wallet_address>",
                mainMenuKeyboard
            );
            break;

        case '❌ Unfollow Trader':
            if (userSubscriptions.has(chatId)) {
                const wallet = userSubscriptions.get(chatId);
                userSubscriptions.delete(chatId);
                bot.sendMessage(chatId, `Successfully unfollowed wallet: ${wallet}`, mainMenuKeyboard);
            } else {
                bot.sendMessage(chatId, "You are not following any traders.", mainMenuKeyboard);
            }
            break;

        case '📈 View Subscriptions':
            if (userSubscriptions.has(chatId)) {
                bot.sendMessage(chatId, 
                    `Currently following wallet:\n${userSubscriptions.get(chatId)}`,
                    mainMenuKeyboard
                );
            } else {
                bot.sendMessage(chatId, "You are not following any traders.", mainMenuKeyboard);
            }
            break;

        case 'ℹ️ Help':
            bot.sendMessage(chatId,
                "CopyTrading Bot Help:\n\n" +
                "1. To follow a trader: Click 'Follow Trader' and enter their wallet address\n" +
                "2. To stop following: Click 'Unfollow Trader'\n" +
                "3. To view your subscriptions: Click 'View Subscriptions'\n\n" +
                "You'll receive notifications whenever your followed traders make transactions!",
                mainMenuKeyboard
            );
            break;
    }
});

// Handle follow command
bot.onText(/\/follow (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const walletAddress = match[1];

    try {
        // Here you would typically validate the wallet address
        userSubscriptions.set(chatId, walletAddress);
        bot.sendMessage(chatId, 
            `Successfully following wallet: ${walletAddress}`,
            mainMenuKeyboard
        );
    } catch (error) {
        bot.sendMessage(chatId, 
            "Invalid wallet address. Please try again.",
            mainMenuKeyboard
        );
    }
});

// Error handling
bot.on('polling_error', (error) => {
    console.log(error);
});

console.log('CopyTrading Bot is running...');


