'use strict'

// https service
var https = require('https');

module.exports = {
    getToken: getToken
}

// simulated token info
var baseURL = '624eff02-dbb1-4c6c-90bc-fa85a29e5fa8.predix-uaa.run.aws-usw02-pr.ice.predix.io'
var accessTokenURI = '/oauth/token?grant_type=client_credentials'
var publicKey = 'c2QuaGFja2F0aG9uOkVRUEBFQGk0djY='
var clientID = 'sd.hackathon'
var clientSecret = 'EQP@E@i4v6'

/*
* getToken
*   obtains a token from cityIQ and passes it to the callback function
* @return - uses a callback called next
*/
function getToken(next){
    var authString = 'Basic ' + publicKey

    var options = {
        host: baseURL,
        method: 'GET',
        path: accessTokenURI,
        headers: {
            'authorization': authString
        }
    };
    https.get(options, (res) => {

        let error;
        if (res.statusCode !== 200) {
            error = new Error(`Request Failed.\n` +
                              `Status Code: ${statusCode}`);
        }

        var rawData = ''
        res.on('data', function (chunk) {
            rawData += chunk
        });
        res.on('end', function(){
            let parsedData = JSON.parse(rawData);
            next(parsedData.access_token);

        });
    });
}
