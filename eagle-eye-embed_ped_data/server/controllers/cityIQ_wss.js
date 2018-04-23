'use strict'

// import the websocket library
var WebSocketClient = require('websocket').client;
var client = new WebSocketClient();
var webToken = require('./webToken');

module.exports = {
    getRealtimePedData: getRealtimePedData
}


client.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
});

client.on('connect', function(connection) {
    console.log('WebSocket Client Connected');
    connection.on('error', function(error) {
        console.log("Connection Error: " + error.toString());
    });
    connection.on('close', function() {
        console.log('Connection Closed');
    });
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            console.log("Received: '" + message.utf8Data + "'");
        }
    });
});


webToken.getToken(function(authToken){
    var token = 'Bearer ' + authToken;
    console.log(token);
    client.connect("wss://ic-websocket-server.run.aws-usw02-pr.ice.predix.io/events", {
        headers: {
            'authorization' : token,
            'predix-zone-id' : 'SDSIM-IE-PEDESTRIAN'
        }
    });
})


/*
* getRealtimePedData
*   sends a websocket request for near real-time pedestrian data
* @return - uses callback called next
*/
function getRealtimePedData(ws, boundedBox, next)
{
    // the request parameters
    var reqParams = {
        bbox: boundedBox,
        eventTypes: 'PEDEVT'
    };

    ws.send(reqParams, function(error){
        if(error){
            console.log("There was a problem sending the websocket request: ")
            console.log(error)
        }
        else{
            console.log("Websocket request sent.")
        }
    });

}
