'use strict'

// https service
var https = require('https');

module.exports = {
    getPedestrianData: getPedestrianData
};

/*
* getPedestrianData
*   retrieves pedestrian data given a uaa token, bounded box of locations,
*   and start and end time
* @return - uses a callback called next
*/
function getPedestrianData(uaaToken, boundedBox, t1, t2, next)
{
    var token = 'Bearer ' + uaaToken;
    var eventURL = 'ic-event-service-sdhack.run.aws-usw02-pr.ice.predix.io'
    var reqPath = '/v2/locations/events?eventType=PEDEVT&bbox=' + boundedBox +
        '&locationType=WALKWAY&startTime=' + t1 + '&endTime=' + t2

    var options = {
        host: eventURL,
        path: reqPath,
        headers: {
            'authorization': token,
            'predix-zone-id': 'SD-IE-PEDESTRIAN'
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
            let data = JSON.parse(rawData)
            next(data)
        });

    });


}
