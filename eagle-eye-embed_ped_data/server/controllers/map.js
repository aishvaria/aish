'use strict'

var locations = new Array();
//var assetLocation = require('./controllers/assetLocations_rest');
module.exports = {
    mappingData: mappingData
};

function mappingData(JSONObject){

    console.log('assetuid in map',JSONObject)
    // locations = getLocations(JSONObject);
    // console.log(locations);
}

// function getLocations(JSONObject){
//   assetLocation.getAssetLocations(token, '522de83f-e524-4f76-80f0-463d3815b7a4', function(output){
//     console.log(output);
//    });
// }
