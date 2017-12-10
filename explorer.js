/**
 * Izzzio Blockchain explorer
 * @author Andrey Nedobylsky
 */

const maxBlocksOnPage = 15;

var nodes = ["ws://localhost:6013","ws://node1.bitcoen.io:6013", "ws://node2.bitcoen.io:6013", "ws://node3.bitcoen.io:6013", "ws://node4.bitcoen.io:6013", "wss://bitcoen.io/blockchain" ];
var candy = null;
var lastestBlocks = [];
var parsers = {};

$(document).ready(function () {
    $('#loadingModal').modal('show');
    /*$.get('nodes.json', function (data) {
        nodes = data;
    });*/

    startCandyConnection(nodes);

    $('.returnButton').click(function () {
        $('#lastestBlocksPage').fadeIn();
        $('#blockDetailPage').hide();
    });

    $('.searchForm').on('submit', function (event) {
        event.preventDefault();
        var search = $('#search').val();
        if(!isNaN(search)) {
            loadBlockPreview(search);
        } else {
            if(confirm('Search by hash may take a long time. Are you sure?')) {
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
            }
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

    };
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
        var blockType = detectBlockType(rawBlock);
        $('#lastestBlocksPage').hide();
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
                    lastBlocksTableFormat();
                }
            });
        }
    }
}