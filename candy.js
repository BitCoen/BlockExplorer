/**
 * Candy
 * Blockchain driven Web Applications
 * @Author: Andrey Nedobylsky
 */

'use strict';

const MessageType = {
    QUERY_LATEST: 0,
    QUERY_ALL: 1,
    RESPONSE_BLOCKCHAIN: 2,
    MY_PEERS: 3,
    BROADCAST: 4
};

const BlockchainRequestors = {
    queryAllMsg: function (fromIndex, limit) {
        limit = typeof limit === 'undefined' ? 1 : limit;
        return {'type': MessageType.QUERY_ALL, data: typeof fromIndex === 'undefined' ? 0 : fromIndex, limit: limit}
    }
};

function Candy(nodeList) {
    'use strict';
    let that = this;
    this.maxConnections = 30;
    this.nodeList = nodeList;
    this.connections = 0;
    this.sockets = [];
    this.blockHeight = 0;
    this._resourceQueue = {};
    this._lastMsgTimestamp = 0;
    this._lastMsgIndex = 0;
    this._requestQueue = {};
    this._autoloader = undefined;

    this.getid = () => (Math.random() * (new Date().getTime())).toString(36).replace(/[^a-z]+/g, '');

    /**
     * Current reciever address. Override allowed
     * @type {string}
     */
    this.recieverAddress = this.getid() + this.getid();

    /**
     * On data recived callback
     * @param {String} data
     */
    this.ondata = function (data) {
        return false;
    };

    /**
     * On blockchain connection ready
     */
    this.onready = function () {

    };

    /**
     * If message recived
     * @param {object} message
     */
    this.onmessage = function (message) {

    };


    /**
     * Internal data handler
     * @param {WebSocket} source
     * @param {Object} data
     */
    this._dataRecieved = function (source, data) {
        if(typeof that.ondata === 'function') {
            if(that.ondata(data)) {
                return;
            }
        }

        //Data block recived
        if(data.type === MessageType.RESPONSE_BLOCKCHAIN) {
            try {
                /**
                 * @var {Block} block
                 */
                let blocks = JSON.parse(data.data);
                for (let a in blocks) {
                    let block = blocks[a];
                    if(that.blockHeight < block.index) {
                        that.blockHeight = block.index
                    }
                    //Loading requested resource
                    if(typeof that._resourceQueue[block.index] !== 'undefined') {
                        that._resourceQueue[block.index](block.data, block);
                        that._resourceQueue[block.index] = undefined;
                    }
                }

            } catch (e) {
            }
        }

        //New peers recived
        if(data.type === MessageType.MY_PEERS) {
            for (let a in data.data) {
                if(data.data.hasOwnProperty(a)) {
                    if(that.nodeList.indexOf(data.data[a]) == -1) {
                        that.nodeList.push(data.data[a]);
                        if(that.getActiveConnections().length < that.maxConnections - 1) {
                            that.connectPeer(data.data[a]);
                        }
                    }
                }
            }
            that.nodeList = Array.from(new Set(that.nodeList));
        }

        if(data.type === MessageType.BROADCAST) {
            /*if(that._lastMsgIndex < data.index) {*/
            if(data.reciver === that.recieverAddress) {

                if(data.id === 'CANDY_APP_RESPONSE') {
                    if(typeof that._candyAppResponse === 'function') {
                        that._candyAppResponse(data);
                    }
                } else {
                    if(typeof that.onmessage === 'function') {
                        that.onmessage(data);
                    }
                }
            } else {
                if(data.recepient !== that.recieverAddress) {
                    data.TTL++;
                    that.broadcast(data);
                }
            }
            /*}*/
            that._lastMsgIndex = data.index;
            that._lastMsgTimestamp = data.timestamp;
        }
    };


    /**
     * Returns array of connected sockets
     * @return {Array}
     */
    that.getActiveConnections = function () {
        let activeSockets = [];
        for (let a in that.sockets) {
            if(that.sockets[a]) {
                if(that.sockets[a].readyState === WebSocket.OPEN) {
                    activeSockets.push(that.sockets[a]);
                }
            }
        }

        return activeSockets;
    };

    /**
     * Inits peer connection
     * @param {String} peer
     */
    this.connectPeer = function (peer) {
        let socket = null;
        try {
            socket = new WebSocket(peer);
        } catch (e) {
            return;
        }
        socket.onopen = function () {
            setTimeout(function () {
                if(typeof that.onready !== 'undefined') {
                    if(typeof  that._autoloader !== 'undefined') {
                        that._autoloader.onready();
                    }
                    that.onready();
                    that.onready = undefined;
                }
            }, 10);
        };

        socket.onclose = function (event) {
            that.sockets[that.sockets.indexOf(socket)] = null;
            delete that.sockets[that.sockets.indexOf(socket)];
        };

        socket.onmessage = function (event) {
            try {
                let data = JSON.parse(event.data);
                that._dataRecieved(socket, data);
            } catch (e) {
            }
        };

        socket.onerror = function (error) {
            //console.log("Ошибка " + error.message);
        };
        that.sockets.push(socket);
    };

    /**
     * Broadcast message to peers
     * @param message
     * @return {boolean} sending status
     */
    this.broadcast = function (message) {
        let sended = false;
        if(typeof message !== 'string') {
            message = JSON.stringify(message);
        }
        for (let a in that.sockets) {
            if(that.sockets.hasOwnProperty(a) && that.sockets[a] !== null) {
                try {
                    that.sockets[a].send(message);
                    sended = true;
                } catch (e) {
                }
            }
        }

        return sended;
    };


    /**
     * Broadcast global message
     * @param {object} messageData содержание сообщения
     * @param {string} id идентефикатор сообщения
     * @param {string} reciver получатель сообщения
     * @param {string} recepient отправитель сообщения
     */
    this.broadcastMessage = function (messageData, id, reciver, recepient) {
        that._lastMsgIndex++;
        let message = {
            type: MessageType.BROADCAST,
            data: messageData,
            reciver: reciver,
            recepient: recepient,
            id: id,
            timestamp: (new Date().getTime()),
            TTL: 0,
            index: that._lastMsgIndex,
            mutex: this.getid() + this.getid() + this.getid()
        };
        if(!that.broadcast(message)) {
            that.autoconnect(true);
            return false;
        }

        return true;
    };

    /**
     * Reconnecting peers if fully disconnected
     * @param {boolean} force reconnection
     */
    this.autoconnect = function (force) {
        if(that.getActiveConnections().length < 1 || force) {
            for (let a in that.nodeList) {
                if(that.nodeList.hasOwnProperty(a)) {
                    if(that.getActiveConnections().length < that.maxConnections - 1) {
                        that.connectPeer(that.nodeList[a]);
                    }
                }
            }
        } else {
            that.sockets = Array.from(new Set(that.sockets));
            that.connections = that.getActiveConnections().length;
        }
    };

    /**
     * Starts connection to blockchain
     */
    this.start = function () {
        for (let a in that.nodeList) {
            if(that.nodeList.hasOwnProperty(a)) {
                if(that.getActiveConnections().length < that.maxConnections - 1) {
                    that.connectPeer(that.nodeList[a]);
                }
            }
        }
        setInterval(function () {
            that.autoconnect();
        }, 5000);

        return this;
    };

    /**
     * Makes RAW Candy Server Application request
     * @param reciver
     * @param uri
     * @param requestData
     * @param {string} backId
     * @param {int} timeout
     */
    this._candyAppRequest = function (uri, requestData, backId, timeout) {
        let url = document.createElement('a');
        url.href = uri.replace('candy:', 'http:');
        let data = {
            uri: uri,
            data: requestData,
            backId: backId,
            timeout: timeout
        };
        this.broadcastMessage(data, 'CANDY_APP', url.host, that.recieverAddress);
    };

    /**
     * Response from Candy Server App
     * @param message
     */
    this._candyAppResponse = function (message) {
        if(typeof that._requestQueue[message.data.backId] !== 'undefined') {
            let request = that._requestQueue[message.data.backId];
            clearTimeout(request.timer);
            request.callback(message.err, typeof message.data.data.body !== 'undefined' ? message.data.data.body : message.data.data, message);
            that._requestQueue[message.data.backId] = undefined;
            delete that._requestQueue[message.data.backId];
        }
    };


    /**
     * Creates request to app like $.ajax request
     * @param {string} uri
     * @param {object} data
     * @param {function} callback
     * @param {int} timeout
     */
    this.requestApp = function (uri, data, callback, timeout) {
        if(typeof timeout === 'undefined') {
            timeout = 10000;
        }
        let requestId = that.getid();

        let timer = setTimeout(function () {
            that._requestQueue[requestId].callback({error: 'Timeout', request: that._requestQueue[requestId]});
            that._requestQueue[requestId] = undefined;
        }, timeout);

        that._requestQueue[requestId] = {
            id: requestId,
            uri: uri,
            data: data,
            timeout: timeout,
            callback: callback,
            timer: timer
        };

        that._candyAppRequest(uri, data, requestId, timeout);

        return that._requestQueue[requestId];
    };

    /**
     * Universal request function.
     * For request data from vitamin chain use "block" as host name and bock id as path. Ex: candy://block/14
     * For application request use candy://hostname/filepath?get=query
     * Data and timeout ignored in block request
     * @param {string} uri
     * @param {object} data
     * @param {function} callback
     * @param {int} timeout
     */
    this.request = function (uri, data, callback, timeout) {
        let url = document.createElement('a');
        url.href = uri.replace('candy:', 'http:');
        if(url.hostname === 'block') {
            that.loadResource(url.pathname.replace('/', ''), function (err, data) {
                callback(err, data.candyData, data);
            });
        } else {
            that.requestApp(uri, data, callback, timeout);
        }
    };


    /**
     * Load resource from blockchain
     * @param {Number} blockId
     * @param {Function} callback
     */
    this.loadResource = function (blockId, callback) {
        if(blockId > that.blockHeigth && blockId < 1) {
            callback(404);
        }
        that._resourceQueue[blockId] = function (data, rawBlock) {
            callback(null, JSON.parse(data), rawBlock);
        };
        let message = BlockchainRequestors.queryAllMsg(blockId);
        that.broadcast(JSON.stringify(message));
    };

    return this;
}