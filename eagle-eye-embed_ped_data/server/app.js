/*******************************************************
The predix-webapp-starter Express web application includes these features:
  * routes to mock data files to demonstrate the UI
  * passport-predix-oauth for authentication, and a sample secure route
  * a proxy module for calling Predix services such as asset and time series
*******************************************************/
var http = require('http'); // needed to integrate with ws package for mock web socket server.
var express = require('express');
var jsonServer = require('json-server'); // used for mock api responses
var path = require('path');
var cookieParser = require('cookie-parser'); // used for session cookie
var bodyParser = require('body-parser');
var passport;  // only used if you have configured properties for UAA
var session = require('express-session');
var proxy = require('./routes/proxy'); // used when requesting data from real services.
// get config settings from local file or VCAPS env var in the cloud
var config = require('./predix-config');
// configure passport for authentication with UAA
var passportConfig = require('./passport-config');
// getting user information from UAA
var userInfo = require('./routes/user-info');
var app = express();
var httpServer = http.createServer(app);
var dataExchange = require('./routes/data-exchange');
// var fs = require("fs");
// var assettemplatefile = "sample-data/predix-asset/compressor-2017-clone.json";

var assetLocation = require('./controllers/assetLocations_rest');
var cityIQRest = require('./controllers/cityIQ_rest');
var webToken = require('./controllers/webToken')
var cityIQWs = require('./controllers/cityIQ_wss');
var map = require('./controllers/map')
var getAssets = require('./controllers/getAllAssets')
var sendObj = require('./pedData')
/**********************************************************************
       SETTING UP EXRESS SERVER
***********************************************************************/
app.set('trust proxy', 1);

// if running locally, we need to set up the proxy from local config file:
var node_env = process.env.node_env || 'development';
console.log('************ Environment: '+node_env+'******************');

if (node_env === 'development') {
  var devConfig = require('./localConfig.json')[node_env];
  proxy.setServiceConfig(config.buildVcapObjectFromLocalConfig(devConfig));
  proxy.setUaaConfig(devConfig);
} else {
  app.use(require('compression')()) // gzip compression
}

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
// Session Storage Configuration:
// *** Use this in-memory session store for development only. Use redis for prod. **
var sessionOptions = {
  secret: 'predixsample',
  name: 'cookie_name', // give a custom name for your cookie here
  maxAge: 30 * 60 * 1000,  // expire token after 30 min.
  proxy: true,
  resave: true,
  saveUninitialized: true
  // cookie: {secure: true} // secure cookie is preferred, but not possible in some clouds.
};
var redisCreds = config.getRedisCredentials();
if (redisCreds) {
  console.log('Using predix-cache for session store.');
  var RedisStore = require('connect-redis')(session);
  sessionOptions.store = new RedisStore({
    host: redisCreds.host,
    port: redisCreds.port,
    pass: redisCreds.password,
    ttl: 1800 // seconds = 30 min
  });
}
app.use(cookieParser('predixsample'));
app.use(session(sessionOptions));

console.log('UAA is configured?', config.isUaaConfigured());
if (config.isUaaConfigured()) {
  passport = passportConfig.configurePassportStrategy(config);
  app.use(passport.initialize());
  // Also use passport.session() middleware, to support persistent login sessions (recommended).
  app.use(passport.session());
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

/****************************************************************************
  SET UP EXPRESS ROUTES
*****************************************************************************/

app.get('/docs', require('./routes/docs')(config));

if (!config.isUaaConfigured()) {
  // no restrictions
  app.use(express.static(path.join(__dirname, process.env['base-dir'] ? process.env['base-dir'] : '../public')));

  // mock UAA routes
  app.get(['/login', '/logout'], function(req, res) {
    res.redirect('/');
  })
  app.get('/userinfo', function(req, res) {
      res.send({user_name: 'Sample User'});
  });
} else {
  //login route redirect to predix uaa login page
  app.get('/login',passport.authenticate('predix', {'scope': ''}), function(req, res) {
    // The request will be redirected to Predix for authentication, so this
    // function will not be called.
  });

  // route to fetch user info from UAA for use in the browser
  app.get('/userinfo', userInfo(config.uaaURL), function(req, res) {
    res.send(req.user.details);
  });

  // access real Predix services using this route.
  // the proxy will add UAA token and Predix Zone ID.
  app.use(['/predix-api', '/api'],
    passport.authenticate('main', {
      noredirect: true
    }),
    proxy.router);

  //callback route redirects to secure route after login
  app.get('/callback', passport.authenticate('predix', {
    failureRedirect: '/'
  }), function(req, res) {
    console.log('Redirecting to secure route...');
    res.redirect('/');
    });

  // example of calling a custom microservice.
  // if (windServiceURL && windServiceURL.indexOf('https') === 0) {
  //   app.get('/windy/*', passport.authenticate('main', { noredirect: true}),
  //     // if calling a secure microservice, you can use this middleware to add a client token.
  //     // proxy.addClientTokenMiddleware,
  //     // or you can use this middleware to add a user access token.
  //     // proxy.addAccessTokenMiddleware,
  //     proxy.customProxyMiddleware('/windy', windServiceURL)
  //   );
  // }

  var router = express.Router();

// middleware that logs all requests
router.use(function(req, res, next){
  console.log('Something is happening.');

  //Allow Cross Origin Resource Sharing
  res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header('Access-Control-Allow-Methods', "GET, PUT, POST, DELETE");

  // go to the next route!
  next();
});

router.get('/', function(req, res) {
    res.json({ message: 'Getting data from server!' });
});

router.post('/', function(req, res){
  res.json({message: 'post'});
});

router.put('/', function(req, res){
  res.json({message: 'put'});
})

router.delete('/', function(req, res){
  res.json({message: 'delete'});
})

// REGISTER OUR ROUTES
// ==============================================
app.use('/api', router);

/*
* Get a web token and establish web socket support for live data streaming
*/
var assetUIds = new Array();
var location = new Array();
var JSONObject = new Array();
var jObject =
                {
                 "coordinates": "coordinates",
                 "pedestrianCount": "pedestrianCount",
                 "assetUid":"assetUid",
                 "content":"content"

                }
//var json = { }



app.use('/map',function(req, res){

  webToken.getToken(function(token){
    cityIQRest.getPedestrianData(token, '333.077762:-117.663817,32.559574:-116.584410', 1524248219525, 1524766619525, function(result){
     //console.log(result);
     //var tk = token;
     var parsedJSON = JSON.parse(JSON.stringify(result.content));
     console.log(parsedJSON[0].measures.pedestrianCount);
     for(var i=0; i<parsedJSON.length; i++){

       //assetUIds[i] = parsedJSON[i].assetUid;
        if(assetUIds.indexOf(parsedJSON[i].assetUid)==-1){
          assetUIds.push(parsedJSON[i].assetUid);
        }
     }


    getAssets.getAssetLocations(token, '333.077762:-117.663817,32.559574:-116.584410', function(output){
        console.log('output is --->',output);
        var assUD = JSON.parse(JSON.stringify(output.content));

         for(i in assUD){
           if( assUD[i] == assetUIds[0] ){
             jObject.coordinates = JSON.parse(JSON.stringify(output)).coordinates;
             jObject.pedestrianCount = parsedJSON[i].measures.pedestrianCount;
             jObject.assetUid = assetUIds;
             // console.log('parsed uid',assetUIds);
              //console.log('true');
              //JSONObject.coordinates =
            }

          else {
            jObject.coordinates ='';
            jObject.pedestrianCount = parsedJSON[i].measures.pedestrianCount;
            jObject.assetUid = assetUIds;
            jObject.content = JSON.parse(JSON.stringify(output.content));

            //console.log('pedestrianCount', jObject.pedestrianCount);
          }

         }
         sendObj.getPData(jObject);
         //console.log('elses uid',jObject);


    });

     //res.send(map.mappingData(assetUIds));
    });

  });
});




// webToken.getToken(function(token){
//   cityIQRest.getPedestrianData(token, '33.077762:-117.663817,32.559574:-116.584410', 1524248219525, 1524766619525, function(result){
//    //console.log(result);
//    //var tk = token;
//    var parsedJSON = JSON.parse(JSON.stringify(result.content));
//    console.log(parsedJSON[0].measures.pedestrianCount);
//    for(var i=0; i<parsedJSON.length; i++){
//
//      //assetUIds[i] = parsedJSON[i].assetUid;
//       if(assetUIds.indexOf(parsedJSON[i].assetUid)==-1){
//         assetUIds.push(parsedJSON[i].assetUid);
//       }
//    }
//    //console.log(assetUIds);
//    //console.log(token);
//    // console.log(token);
//    // console.log(assetUIds);
//       // assetLocation.getAssetLocations(token, '522de83f-e524-4f76-80f0-463d3815b7a4', function(output){
//       //   console.log(output);
//       // });
//       //var location  = new Array();
//    //  for(var j in assetUIds){
//    //    assetLocation.getAssetLocations(token, assetUIds[j], function(output){
//    //      //console.log(output.coordinates);
//    //      var parsedOutput = JSON.parse(JSON.stringify(output));
//    //      console.log(parsedOutput);
//    //      location.push(parsedOutput.coordinates);
//    //      console.log(location);
//    //    });
//    // //
//    // }
//    //console.log(location);
//   });
//
//
// });

//console.log(assetUIds);
  if (config.rmdDatasourceURL && config.rmdDatasourceURL.indexOf('https') === 0) {
    app.get('/api/datagrid/*',
        proxy.addClientTokenMiddleware,
        proxy.customProxyMiddleware('/api/datagrid', config.rmdDatasourceURL, '/services/experience/datasource/datagrid'));
  }

  if (config.dataExchangeURL && config.dataExchangeURL.indexOf('https') === 0) {
    app.post('/api/cloneasset', proxy.addClientTokenMiddleware, dataExchange.cloneAsset);

    app.post('/api/updateasset', proxy.addClientTokenMiddleware,
        proxy.customProxyMiddleware('/api/updateasset', config.dataExchangeURL, '/services/fdhrouter/fielddatahandler/putfielddata'));
  }

  //Use this route to make the entire app secure.  This forces login for any path in the entire app.
  app.use('/', passport.authenticate('main', {
      noredirect: false // Redirect the user to the authentication page
    }),
    express.static(path.join(__dirname, process.env['base-dir'] ? process.env['base-dir'] : '../public'))
  );

  //Or you can follow this pattern to create secure routes,
  // if only some portions of the app are secure.
  app.get('/secure', passport.authenticate('main', {
    noredirect: true //Don't redirect the user to the authentication page, just show an error
    }), function(req, res) {
    console.log('Accessing the secure route');
    // modify this to send a secure.html file if desired.
    res.send('<h2>This is a sample secure route.</h2>');
  });

}

/*******************************************************
SET UP MOCK API ROUTES
*******************************************************/
// NOTE: these routes are added after the real API routes.
//  So, if you have configured asset, the real asset API will be used, not the mock API.
// Import route modules
var mockAssetRoutes = require('./routes/mock-asset.js')();
var mockTimeSeriesRouter = require('./routes/mock-time-series.js');
var mockRmdDatasourceRoutes = require('./routes/mock-rmd-datasource.js')();
// add mock API routes.  (Remove these before deploying to production.)
app.use(['/mock-api/predix-asset', '/api/predix-asset'], jsonServer.router(mockAssetRoutes));
app.use(['/mock-api/predix-timeseries', '/api/predix-timeseries'], mockTimeSeriesRouter);
app.use(['/mock-api/datagrid', '/api/datagrid'], jsonServer.router(mockRmdDatasourceRoutes));
require('./routes/mock-live-data.js')(httpServer);
// ***** END MOCK ROUTES *****

// route to return info for path-guide component.
app.use('/learningpaths', require('./routes/learning-paths')(config));

//logout route
app.get('/logout', function(req, res) {
  req.session.destroy();
  req.logout();
  passportConfig.reset(); //reset auth tokens
  res.redirect(config.uaaURL + '/logout?redirect=' + config.appURL);
});

app.get('/favicon.ico', function (req, res) {
  res.send('favicon.ico');
});

app.get('/config', function(req, res) {
  let title = "Predix WebApp Starter";
  if (config.isAssetConfigured()) {
    title = "RMD Reference App";
  }
  res.send({wsUrl: config.websocketServerURL, appHeader: title, dataExchangeEnabled: config.isDataExchangeConfigured()});
});

// Sample route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
//currently not being used as we are using passport-oauth2-middleware to check if
//token has expired
/*
function ensureAuthenticated(req, res, next) {
    if(req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
}
*/

////// error handlers //////
// catch 404 and forward to error handler
app.use(function(err, req, res, next) {
  console.error(err.stack);
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// development error handler - prints stacktrace
if (node_env === 'development') {
  app.use(function(err, req, res, next) {
    if (!res.headersSent) {
      res.status(err.status || 500);
      res.send({
        message: err.message,
        error: err
      });
    }
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  if (!res.headersSent) {
    res.status(err.status || 500);
    res.send({
      message: err.message,
      error: {}
    });
  }
});

httpServer.listen(process.env.VCAP_APP_PORT || 5000, function () {
  console.log ('Server started on port: ' + httpServer.address().port);
});

module.exports = app;