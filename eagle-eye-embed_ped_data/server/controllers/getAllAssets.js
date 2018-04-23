'use strict'

// https service
var https = require('https');

module.exports = {
    getAssetLocations: getAssetLocations
};

var output;
/*
* getPedestrianData
*   retrieves pedestrian data given a uaa token, bounded box of locations,
*   and start and end time
* @return - uses a callback called next
*/
function getAssetLocations(uaaToken, bbox, next)
{
    var token = 'Bearer ' + uaaToken;
    var eventURL = 'ic-metadata-service-sdhack.run.aws-usw02-pr.ice.predix.io'
    var reqPath = '/v2/metadata/assets/search?bbox=' + bbox

    var options = {
        host: eventURL,
        path: reqPath,
        headers: {
            'authorization': token,
            'predix-zone-id': 'SD-IE-TRAFFIC'
        }
    };

    https.get(options, (res) => {

        let error;
        if (res.statusCode !== 200){
            error = new Error(`Request Failed.\n` +
                              `Status Code: ${res.statusCode}`);
        }

        var rawData = ''
        res.on('data', function(chunk){
            rawData += chunk
        });
        res.on('end', function(){
            //console.log(rawData);
            let data = JSON.parse(rawData)
            //next(data);
            next(data);
        });
    });

}
