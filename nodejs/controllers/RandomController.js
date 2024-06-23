const { Random } = require('random-js');

class MyRandom extends Random {
    constructor(options) {
        super(); // �θ� Ŭ������ ������ ȣ��
        this.options = options;
        this.totalWeight = Object.values(options).reduce((total, weight) => total + weight, 0);
    }

    customMethod() {
        let threshold = this.real(0, this.totalWeight);
        for (const option in this.options) {
            threshold -= this.options[option];
            if (threshold <= 0) {
                return option.toString();  // ���ڿ��� ��ȯ�Ͽ� ��ȯ
            }
        }
    }
}

module.exports = MyRandom;
