var express = require('express')
, http = require('http')
, request = require('request')

/* hashmap used for Job lookup */
, jobs = {}


/* instatiate application */
, app = express()


/* configure express */

  app.configure(function() {
    app.use(express.favicon())
    app.use(express.logger('dev'))
    app.use(express.bodyParser())
    app.use(express.methodOverride())
    app.use(app.router)
    
    /* app defaults to running on 400 */
    app.set('port', process.env.PORT || 4000)
    
    /* speed is the average interval between updates */
    app.set('speed', 3000)
  })
  
  /* configure express for development environment */
  app.configure('development', function() {
    app.use(express.errorHandler())
    app.set('zipreel_url', "http://localhost:3000")
  })
  
  /* configure express for production environment */
  app.configure('production', function() {
    app.use(express.errorHandler())
    app.set('zipreel_url', "http://tranquil-atoll-9763.herokuapp.com")
  })


/* define the Job class constructor */

var Job = function(jobId, size) {
    this.jobId = jobId
    this.status = 'start'
    this.stage = 'pull'
    this.error = ''
    this.totalBytes = size
    this.processed = 80000
  }

/* define the Job class public methods */

Job.prototype = {
    
  /* starts the Job */ 
    start: function(time, cb) {
      console.log("Starting a new transcode job for ID: "+this.jobId)
      this.cron = setInterval(cb, time)
    }

  /* destroys the job */
  , destroy: function() {
      console.log("Destroying transcode job for ID: "+this.jobId)
      clearInterval(this.cron)
    }

  /* used for posting state back to Rails */
  , sendStatus: function() {
      var jsonData = {
          status: this.status
        , stage: this.stage
        , error: this.error
      }
      , postUrl = app.get('zipreel_url') + '/jobs/'+this.jobId+'/progression' 
      if(this.stage == 'pull' && this.status == 'finish') {
        jsonData.metrics = {
          bytes: this.processed
        , speed: Math.floor(Math.random()*500)
        , input_codec: 'mpeg2video'
        , input_width: 1280
        , input_height: 720
        , input_duration: 300.0
        , input_bitrate : 21979
        , input_frames_per_sec: 61.58
        }
      } else if(this.stage == 'transcode' && this.status == 'update') {
        this.error = 'Error in transcoding'
        console.log('#########################')
        jsonData.metrics = {
          bytes: this.processed
        , speed: Math.floor(Math.random()*500) 
        }

      } else if(this.stage === "chunk") {
        jsonData.metrics = {
          chunk_count: Math.floor(Math.random()*100)
        }
      } else if(this.stage === "merger") {
        jsonData.metrics = {
          output_size: 9000
        , output_url: "http://placekitten.com/600/420"
        }
      } else if(this.stage === 'cleanup') {
        jsonData.metrics = {}
      } else {
        jsonData.metrics = {
          bytes: this.processed
        , speed: Math.floor(Math.random()*500) 
        }
      }
      request.put(postUrl
        , {json: jsonData}
        , function(err){
          console.log('attemping to PUT to ' + postUrl )
          if(err){
            //sadness
            console.log(err)
          }
        }
      )
      console.log(jsonData)
      console.log(this.processed, this.totalBytes)
  }

  /* used for updating the job state */
  , update: function() {
      if(this.status === 'finish') {
        this.status = 'start'
        this.processed = 0
        this.nextStage()
      } else {
        if(this.status === 'start'){
          if(this.stage === 'chunk' || this.stage === 'merger'){
            this.status = 'finish'
          } else {
            this.status = 'update'
          }
        }
        /* increase processed by a value between 0 and 20000 */
        this.processed += Math.floor(Math.random()*20000)
        if(this.processed >= this.totalBytes){
          this.status = 'finish'
        }
      }
    }

  /* used for incrementing stage */
  , nextStage: function() {
      var stages = ['pull', 'chunk', 'transcode', 'merger', 'cleanup']
      this.stage = stages[stages.indexOf(this.stage) + 1]
      if(this.stage == 'cleanup') {
        this.status = 'finish'
      }
    }
}


/* define app routes */

/* check alive | GET / */
app.get('/', function(req, res) {
  var t = app.settings.env
  res.send("yes this api is up. PUT-ting request to " + app.get('zipreel_url'))
})

/* create job | POST /transcode */
app.post('/transcode', function(req, res) {
  console.log("POST /transcode")
  console.log(req.body)
  var jobId = req.body.id
  , size = req.body.video.size || Math.floor(Math.random()*2000)
  
  /* error if job already exists in jobs hashmap */
  if(jobs.hasOwnProperty(jobId)) {
    console.log("ERR: interval for "+jobId+" defined")
    res.send("ERR: interval for "+jobId+" defined")
  
  /* create job */
  } else {
    var newJob = new Job(jobId, size)
    newJob.sendStatus()
    res.send("Created a JOB in clusterMock for "+jobId)

    
    /* generate repeating event updating and sending state */
    newJob.start(app.get('speed')*2*Math.random(), function() {
      newJob.update()
      newJob.sendStatus()
      if(newJob.stage === 'cleanup'){
        jobs[jobId].destroy()
        delete jobs[jobId]
      }
    })
    
    /* store the state of the new job for retrieval */
    jobs[jobId] = newJob
  }
})

/* delete job | DEL /transcode/:id */
app.del('/transcode/:id', function(req, res) {
  var jobId = req.param('id')
  console.log(jobs)
  jobs[jobId].destroy()
  delete jobs[jobId]
})


/* start the server */

http.createServer(app).listen(app.get('port'), function() {
  console.log("Express server listening on port " + app.get('port'))
})
