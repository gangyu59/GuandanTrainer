// 牌堆类 (两副牌)
function Deck() {
    this.cards = [];
    
    // 初始化两副牌
    this.init = function() {
        var suits = ['c', 'd', 'h', 's'];
        var values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        
        // 添加两副标准牌
        for (var i = 0; i < 2; i++) {
            for (var s = 0; s < suits.length; s++) {
                for (var v = 0; v < values.length; v++) {
                    this.cards.push(new Card(suits[s], values[v]));
                }
            }
            // 添加大小王
            this.cards.push(new Card('joker', 'small'));
            this.cards.push(new Card('joker', 'big'));
        }
    };
    
    // 洗牌
    this.shuffle = function() {
        for (var i = this.cards.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = this.cards[i];
            this.cards[i] = this.cards[j];
            this.cards[j] = temp;
        }
    };
    
    // 发牌 (返回指定数量的牌)
    this.deal = function(num) {
        return this.cards.splice(0, num);
    };
    
    // 初始化构造
    this.init();
}