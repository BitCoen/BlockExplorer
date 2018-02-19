/**
 * Transaction parser for Vitamin block explorer
 */

if(typeof parsers === 'undefined') {
    console.log("Can't detect Vitamin block explorer script");
} else {

    var precision = 10000000000;
    
    /**
     * Форматирует отображение числа согласно precision
     * @param {Number} number
     */
    function formatToken(number) {
        if(precision === 1) {
            return String(number);
        }
        var nulls = String(precision).replace(/[1-9]*/, '').length;
        var result = String(Math.round(number));
        var right = result.slice(-nulls);
        if(nulls - right.length > 0) {
            for (var i = 1; nulls - right.length; i++) {
                right = '0' + right;
            }
        }
        return (result.length <= nulls ? '0' : result.slice(0, -nulls)) + '.' + right;
    }

    parsers['Transaction'] = function (rawBlock) {
        try {
            var data = JSON.parse(rawBlock.data);
        } catch (e) {
            return 'Data parsing error';
        }

        return 'Transaction: <br><b>From wallet id:</b><br>' + data.from + '<br><b>To wallet id:</b><br>' + data.to + '<br><b>Amount:</b><br>' + formatToken(data.amount);

    };
}