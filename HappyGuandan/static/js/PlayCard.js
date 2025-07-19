// PlayCard.js

class PlayCard {
    constructor(cardRules, cardPower) {
        this.cardRules = cardRules;
        this.cardPower = cardPower;
    }

    // 主入口：尝试出牌（或pass）
    decidePlay(player, lastPlayed) {
        const hand = player.cards;
        const allGroups = this._generateValidGroups(hand);

        if (!lastPlayed || lastPlayed.player === player.name || lastPlayed.type === 'pass') {
            // 起始出牌或其他人都pass，可自由出牌
            return this._chooseOpeningPlay(allGroups);
        } else {
            // 必须出比 lastPlayed 更大的牌
            const strongerGroups = allGroups.filter(group =>
                this._canBeat(group, lastPlayed.cards, lastPlayed.type)
            );

            if (strongerGroups.length > 0) {
                return this._chooseResponsePlay(strongerGroups);
            } else {
                return { type: 'pass', cards: [] };
            }
        }
    }

    // 获取所有合法牌型组合
    _generateValidGroups(hand) {
        const grouper = new CardGrouper();
        return grouper.groupByMinHands(hand);
    }

    // 起始出牌策略（可定制）
    _chooseOpeningPlay(groups) {
        return {
            type: this.cardRules.getCardType(groups[0]),
            cards: groups[0]
        };
    }

    // 应对出牌策略（可定制）
    _chooseResponsePlay(groups) {
        return {
            type: this.cardRules.getCardType(groups[0]),
            cards: groups[0]
        };
    }

    // 比较是否能压住上一手
    _canBeat(myCards, theirCards, theirType) {
        const myType = this.cardRules.getCardType(myCards);

        // 炸弹可压一切（除非对方更强炸弹）
        if (this.cardRules.isBomb(myCards)) {
            if (!this.cardRules.isBomb(theirCards)) return true;
            return this.cardPower.compareSameType(myCards, theirCards, myType, this.cardRules) > 0;
        }

        if (myType !== theirType) return false;

        return this.cardPower.compareSameType(myCards, theirCards, myType, this.cardRules) > 0;
    }
}