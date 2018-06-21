/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

(function () {

    var candy;
    var readyCallback = false;
    var nodes = ["wss://bitcoen.io/blockchain/", "ws://localhost:6013", "ws://node1.bitcoen.io:6013", "ws://node2.bitcoen.io:6013", "ws://node3.bitcoen.io:6013", "ws://node4.bitcoen.io:6013"];

    function startProvider() {
        if(Candy) {
            candy = new Candy(nodes).start();
            candy.onready = function () {
                if(readyCallback) {
                    readyCallback();
                }
            }
        } else {
            throw 'Candy not loaded';
        }
    }

    var script = document.createElement('script');
    script.onload = function () {
        startProvider();
    };
    script.src = '//explorer.bitcoen.io/candy.js';

    document.head.appendChild(script);

    window.bitcoen = {
        ready: function (cb) {
            if(typeof cb !== 'undefined') {
                readyCallback = cb;
            }
        },
        getHeight: function () {
            if(candy) {
                return candy.blockHeight;
            }

            return 0;
        },
        getNodes: function () {
            if(candy) {
                return candy.getActiveConnections();
            }

            return [];
        },
        candy: candy
    };

})();