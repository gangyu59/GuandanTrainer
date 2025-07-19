function Player(index, isHuman) {
    this.index = index;
    this.isHuman = isHuman;
    this.cards = [];
    
    // 精确查找牌的方法
    this.findCard = function(suit, value) {
        return this.cards.find(function(card) {
            return card.suit === suit && card.value === value;
        });
    };
    
    // 添加牌（确保不重复）
    this.addCards = function(newCards) {
        newCards.forEach(function(card) {
            if (!this.findCard(card.suit, card.value)) {
                this.cards.push(card);
            }
        }, this);
    };
    
    // 移除牌（精确匹配）
    this.removeCards = function(cardsToRemove) {
		  cardsToRemove.forEach(toRemove => {
		    const index = this.cards.findIndex(card =>
		      card.suit === toRemove.suit && card.value === toRemove.value
		    );
		    if (index !== -1) {
		      this.cards.splice(index, 1);
		    }
		  });
		};
}