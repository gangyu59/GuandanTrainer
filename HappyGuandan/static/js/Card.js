function Card(suit, value) {
    this.suit = suit;
    this.value = value;
    this.selected = false;

    // 绘制坐标（由 CanvasManager 赋值）
    this.x = 0;
    this.y = 0;
    this.width = 125;
    this.height = 140;

    this.getImagePath = function() {
        if (this.suit === 'joker') {
            return this.value === 'small' ? 
                'assets/cards/small_joker.jpeg' : 
                'assets/cards/big_joker.jpeg';
        }
        return 'assets/cards/' + this.suit + '_' + this.value + '.jpeg';
    };

    this.getId = function() {
        return this.suit + '_' + this.value;
    };

    this.contains = function(clickX, clickY) {
        return (
            clickX >= this.x &&
            clickX <= this.x + this.width &&
            clickY >= this.y &&
            clickY <= this.y + this.height
        );
    };
}