class SessionManager {
    constructor() {
        this.sessions = new Map();
    }

    setUserState(chatId, state) {
        this.sessions.set(chatId, state);
    }

    getUserState(chatId) {
        return this.sessions.get(chatId);
    }

    clearUserState(chatId) {
        this.sessions.delete(chatId);
    }
}

module.exports = new SessionManager(); 