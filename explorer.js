/**
 * Izzzio Blockchain explorer
 * @author Andrey Nedobylsky
 */

const maxBlocksOnPage = 15;
const RESPONSE_SUFFIX = '_RESP';

var nodes = ["wss://bitcoen.io/blockchain/", "ws://localhost:6013", "ws://node1.bitcoen.io:6013", "ws://node2.bitcoen.io:6013", "ws://node3.bitcoen.io:6013", "ws://node4.bitcoen.io:6013"];
var candy = null;
var lastestBlocks = [];
var parsers = {};

var waitingMessages = [];

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


$(document).ready(function () {
    $('#loadingModal').modal('show');
    /*$.get('nodes.json', function (data) {
        nodes = data;
    });*/

    startCandyConnection(nodes);

    $('.returnButton').click(function () {
        $('#lastestBlocksPage').fadeIn();
        $('#blockDetailPage').hide();
        $('#walletDetailPage').hide();
    });

    $('.searchForm').on('submit', function (event) {
        event.preventDefault();
        var search = $('#search').val();
        if(!isNaN(search)) {

            loadBlockPreview(search);
        } else {

            getTransactionByHash(search, function (tx) {
                if(tx) {
                    loadBlockPreview(tx.block);
                } else {
                    getWalletInfo(search, function (wallet) {
                        if(wallet) {
                            //loadBlockPreview(wallet.block);
                            loadWalletPreview(wallet.id);
                        } else {
                            alert('Tx hash or wallet not found');
                        }
                    });
                }
            });

            /*if(confirm('Search by hash may take a long time. Are you sure?')) {
                var blockId = 1;

                function checkBlock() {
                    candy.loadResource(blockId, function (err, block, rawBlock) {
                        if(rawBlock.hash.indexOf(search) !== -1) {
                            //alert('Block found: ' + blockId);
                            setTimeout(function () {
                                loadBlockPreview(blockId);
                            }, 500);
                            return;
                        }
                        blockId++;
                        $('#height').text(blockId + '/' + candy.blockHeight);

                        if(blockId > candy.blockHeight) {
                            alert('Block hash not found');
                            return;
                        }

                        checkBlock();
                    });
                }

                checkBlock();
            }*/
        }
    });


});

/**
 * Initiats candy connection
 * @param nodes
 */
function startCandyConnection(nodes) {
    function hideModal() {
        $('#loadingModal').fadeOut(1000);
        $('.modal-backdrop').fadeOut(1000);
        $('.modal-open').removeClass('modal-open');
    }

    candy = new Candy(nodes).start();

    candy.onready = function () {


        setInterval(function () {
            $('#height').text(candy.blockHeight);
            $('#connections').text(candy.getActiveConnections().length);
            if(candy.getActiveConnections().length === 0) {
                $('#loadingModal').modal('show').show();
                $('.modal-backdrop').show();
            } else {
                hideModal();
            }
        }, 1000);

        setInterval(function () {
            updateLatestBlocks();
        }, 5000);
        updateLatestBlocks();

        setTimeout(function () {
            if(window.location.hash.length !== 0) {
                $('#search').val(window.location.hash.replace('#', ''));
                $('.searchForm').submit();
            }
        }, 1000);

    };

    candy.onmessage = function (messageBody) {
        for (var a in waitingMessages) {
            if(waitingMessages.hasOwnProperty(a)) {
                if(waitingMessages[a].id === messageBody.id) {
                    if(waitingMessages[a].handle(messageBody)) {
                        delete  waitingMessages[a];
                    }
                    return;
                }
            }
        }
    }
}


/**
 * Detect block type by params
 * @param rawBlock
 * @return {*}
 */
function detectBlockType(rawBlock) {
    try {
        var data = JSON.parse(rawBlock.data);
        if(typeof data.type !== 'undefined') {
            return data.type;
        }

        return "Unknown";
    } catch (e) {
        return "Unknown without data";
    }
}

/**
 * Block view href event
 */
function loadBlockPreview(index) {
    index = (isNaN(index) ? $(this).text() : index);
    candy.loadResource(index, function (err, block, rawBlock) {
        window.location.hash = index;
        var blockType = detectBlockType(rawBlock);
        $('#lastestBlocksPage').hide();
        $('#walletDetailPage').hide();
        $('#blockDetailPage').fadeIn();

        $('.blockIndex').text(rawBlock.index);
        $('.blockSize').text(rawBlock.data.length);
        $('.blockHash').text(rawBlock.hash);
        $('.blockPrevHash').text(rawBlock.previousHash);
        $('.blockPrevious').text(rawBlock.index - 1);
        $('.blockNext').text(rawBlock.index + 1);
        $('.blockType').text(blockType);
        $('.blockTimestamp').text(moment(rawBlock.timestamp).format('LLLL'));
        $('.blockStartTimestamp').text(moment(rawBlock.startTimestamp).format('LLLL'));
        $('.blockData').text(rawBlock.data);
        $('.blockSign').text(rawBlock.sign);

        if(typeof parsers[blockType] !== 'undefined') {
            $('.blockParserOutput').html(parsers[blockType](rawBlock));
        } else {
            $('.blockParserOutput').text('No parser for this block type');
        }


    });
}

function loadWalletPreview(wallet) {

    function openWallet(wallet) {
        getWalletTransactions(wallet.id, function (txs) {

            window.location.hash = 'BL_' + wallet.block;

            $('#lastestBlocksPage').hide();
            $('#blockDetailPage').hide();
            $('#walletDetailPage').fadeIn();

            $('.walletId').text('BL_' + wallet.block);
            $('.walletBlock').text(wallet.block);
            $('.fullAddress').text(wallet.id);
            $('.public').text(wallet.keysPair.public);
            $('.totalTx').text(txs.income.length + txs.outcome.length);
            $('.walletBalance').text(formatToken(wallet.balance));

            var transactions = [];

            for (var a in txs.income) {
                if(txs.income.hasOwnProperty(a)) {
                    transactions.push(txs.income[a]);
                }
            }

            for (a in txs.outcome) {
                if(txs.outcome.hasOwnProperty(a)) {
                    transactions.push(txs.outcome[a]);
                }
            }

            transactions = transactions.sort(function (b1, b2) {
                return (b2.timestamp - b1.timestamp)
            });

            var html = "<table class='transactionsTable' style=\"width:100%\">\n" +
                "  <tr>\n" +
                "    <th>Block #</th>\n" +
                "    <th>Timestamp</th>\n" +
                "    <th>Activate from</th>\n" +
                "    <th>Operation</th> \n" +
                "    <th>Amount</th>\n" +
                "    <th>From</th>\n" +
                "    <th>To</th>\n" +
                "  </tr>\n";


            for (a in transactions) {
                var tx = transactions[a];

                if(candy.blockHeight - tx.block < 20) {
                    html += "<tr style='background: #f9ffb1'>";
                    html += "<td title='Not active' title='Unaccepted'> 🕐 <a href='#' class='blockHref' >" + tx.block + "</a></td>";
                } else {
                    html += "<tr>";
                    html += "<td> <a href='#' class='blockHref' >" + tx.block + "</a></td>";
                }


                html += "<td>" + moment(Number(tx.timestamp)).format('LLLL') + "</td>";

                if(moment().utc().valueOf() < Number(tx.from_timestamp)) {
                    html += "<td style='color: #959500'> 🕐 " + moment(Number(tx.from_timestamp)).format('LLLL') + "</td>";
                }
                else {
                    html += "<td>" + moment(Number(tx.from_timestamp)).format('LLLL') + "</td>";
                }


                if(tx.from_address == tx.to_address) {
                    html += "<td style='font-size: 60px; color: red; padding-bottom: 10px'><img src='http://www.kolobok.us/smiles/standart/dance2.gif'></td>";
                } else if((tx.from_address) === (wallet.id)) { //outcome
                    html += "<td style='font-size: 60px; color: red; padding-bottom: 10px'>-</td>";
                } else {
                    html += "<td style='font-size: 60px; color: green; padding-bottom: 10px'>+</td>";
                }

                html += "<td>" + formatToken(tx.amount) + "</td>";

                html += "<td><a href='#' data-wallet='" + tx.from_address + "' class='walletHref'>" + tx.from_address.substr(0, 10) + "...</a></td>";
                html += "<td><a href='#' data-wallet='" + tx.to_address + "' class='walletHref'>" + tx.to_address.substr(0, 10) + "...</a></td>";


                html += "</tr>";
            }

            html += "</table>";


            $('.txs').html(html);

            $('.walletHref').click(function () {
                loadWalletPreview($(this).data('wallet'));
            });

        });
    }

    if(typeof wallet === 'string') {
        getWalletInfo(wallet, function (wallet) {
            if(wallet) {
                openWallet(wallet);
            }
        })
    } else {
        openWallet(wallet);
    }
}


/**
 * Update latest blocks list
 */
function updateLatestBlocks() {

    function lastBlocksTableFormat() {

        function insertBlock(rawBlock) {
            return $('#lastTransactions tbody > tr:last').after(
                "                    <tr>\n" +
                "                        <td> <a href='#' class='blockHref'>" + rawBlock.index + "</a></td>\n" +
                "                        <td>" + detectBlockType(rawBlock) + "</td>\n" +
                "                        <td>" + moment().from(moment(rawBlock.timestamp)) + "</td>\n" +
                "                        <td>" + rawBlock.data.length + "</td>\n" +
                "                    </tr>"
            );
        }

        var old = $('#lastTransactions  tbody > tr').fadeOut(500);
        setTimeout(function () {
            lastestBlocks.forEach(function (block) {
                insertBlock(block.raw).hide().fadeIn(100);
            });
            old.remove();

            $('.blockHref').click(loadBlockPreview);

        }, 500);

    }

    lastestBlocks = [];
    if(candy.blockHeight !== 0) {
        for (var i = candy.blockHeight; i > candy.blockHeight - maxBlocksOnPage; i--) {
            candy.loadResource(i, function (err, block, rawBlock) {
                lastestBlocks.push({id: rawBlock.index, raw: rawBlock, data: block});
                if(lastestBlocks.length >= maxBlocksOnPage || lastestBlocks.length >= candy.blockHeight) {
                    lastestBlocks = lastestBlocks.sort(function (b1, b2) {
                        return (b2.id - b1.id)
                    });
                    lastBlocksTableFormat();
                }
            });
        }
    }
}

/**
 * Get transactions for full wallet address
 * @param id
 * @param cb
 */
function getWalletTransactions(id, cb) {
    waitingMessages.push({
        id: 'getWalletTransactions' + RESPONSE_SUFFIX, handle: function (message) {
            message = message.data;
            if(message.wallet === id) {
                cb(message.txs);
                return true;
            }

            return false;
        }
    });

    candy.broadcastMessage({id: id}, 'getWalletTransactions', candy.recieverAddress, candy.recieverAddress);
}

/**
 * Get transaction by hash
 * @param id
 * @param cb
 */
function getTransactionByHash(id, cb) {
    waitingMessages.push({
        id: 'getTransactionByHash' + RESPONSE_SUFFIX, handle: function (message) {
            message = message.data;
            if(message.hash === id) {
                cb(message.txs);
                return true;
            }

            return false;
        }
    });

    candy.broadcastMessage({id: id}, 'getTransactionByHash', candy.recieverAddress, candy.recieverAddress);
}


/**
 * Get wallet info by address
 * @param id
 * @param cb
 */
function getWalletInfo(id, cb) {
    waitingMessages.push({
        id: 'getWalletInfo' + RESPONSE_SUFFIX, handle: function (message) {
            message = message.data;
            if(message.wallet === id) {
                cb(message.walletInfo);
                return true;
            }

            return false;
        }
    });

    candy.broadcastMessage({id: id}, 'getWalletInfo', candy.recieverAddress, candy.recieverAddress);
}