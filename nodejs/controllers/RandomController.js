const { Random } = require('random-js');

class MyRandom extends Random {
    constructor(options) {
        super(); // 부모 클래스의 생성자 호출
        this.options = options;
        this.totalWeight = Object.values(options).reduce((total, weight) => total + weight, 0);
    }

    customMethod() {
        let threshold = this.real(0, this.totalWeight);
        for (const option in this.options) {
            threshold -= this.options[option];
            if (threshold <= 0) {
                return option.toString();  // 문자열로 변환하여 반환
            }
        }
    }
}

module.exports = MyRandom;
