var express = require('express')
, routes = require('./routes')
, http = require('http');

var app = express();

var intervals = {};
var iterations = 10;

app.configure(function(){
  app.set('port', process.env.PORT || 4000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', function(req, res) {
  console.log("someone hit index");
  res.send("yes this api is up");
});

app.post('/transcode', function(req, res) {
  console.log("transcode upload "+req.body.id);
  var i = 0;
  if(intervals[req.body.id] === undefined){
    intervals[req.body.id] = setInterval(function() {
      console.log("job ping", req.body.id, i);
      if(i++ == iterations){
        clearInterval(intervals[req.body.id]);
      }
    }, 3000);
    res.send("started an interval for "+req.body.id);
  }else{
    res.send("interval for "+req.body.id+" defined");
  }
});

app.del('/transcode/:id', function(req, res) {
  clearInterval(intervals[req.params.id]);
  delete intervals[req.params.id];
  res.send("deleting that job with the id "+req.params.id);
});

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
