//spa.js


console.log(window.location.href);
var app = angular.module("kanban", ['ngRoute', 'ui.bootstrap','nvd3']);


app.filter("days", function () {
    return function (input) {
        return Math.round(input / timeUtil.MILLISECONDS_DAY);
    };
});


app.directive('ngEnter', function () {
    return function (scope, element, attrs) {
        element.bind("keydown keypress", function (event) {
            if (event.which === 13) {
                scope.$apply(function () {
                    scope.$eval(attrs.ngEnter);
                });

                event.preventDefault();
            }
        });
    };
});



app.factory("boardDataFactory", function () {
    var factory = {};
    var data;

    factory.getBoardData = function (url) {
         return new Promise(function (resolve, reject) {
             if(data){
                 resolve(data);
             }else{
                sendRestRequest(url).then(function(response){
                    data = CfdApiResponceParser().parse(response);
                    resolve(data);
                },function(error){
                    reject();
                });
             }
        });
    };
         
    return factory;
});

app.factory("sharedState",function(){
    var state = {
        "startTime": new Date().getTime()-365*timeUtil.MILLISECONDS_DAY,
    }
    return state;
});

app.controller("SpectralController", 
                ['$scope', '$route', '$window', '$routeParams', 'boardDataFactory', 'throughputFactory',"sharedState"
                , function ($scope, $route, $window, $routeParams, boardDataFactory, throughput,state) {
      console.log ("ThroughputController");
     var downloadData,sum;
     $scope.data ;
     $scope.today = new Date();
     $scope.hasData = true;
     $scope.options = {
            
            chart: {
                type: 'multiChart',
                height: 450,
                margin : {
                    top: 30,
                    right: 60,
                    bottom: 50,
                    left: 70
                },
                color: d3.scale.category10().range(),
                useInteractiveGuideline: true,
                duration: 500,
                xAxis: {
                    tickFormat: function(d){
                        return d3.format(',f')(d);
                    }
                },
                yAxis1: {
                    tickFormat: function(d){
                        return d3.format(',.0f')(d);
                    }
                },
                yAxis2: {
                    tickFormat: function(d){
                        return d3.format(',.0f')(d/sum*100);
                    }
                },

                forceX:[0, 900]
                
            }
        };

        $scope.dt = state.startTime;

        $scope.config = {
            refreshDataOnly: false, // default: true
        };

        $scope.board = decodeUrl($routeParams.board);

    
    function updateReport(){
        
        boardDataFactory.getBoardData($scope.board).then(function(boardData){
            $scope.start = $scope.start || boardData.boardCreated
            $scope.startTime = $scope.startTime || state.startTime
            let filter = {
                "starttime": $scope.startTime,
                "resolution": $scope.resolution.value*timeUtil.MILLISECONDS_DAY
            }
            var throughputData = boardData.getSpectralAnalysisReport(filter);
            $scope.options.chart.forceX[1] = _.last(throughputData)[0];
            $scope.data = [];
            $scope.data.push(throughput.generateDataStream("Done tickets"
                                                          ,"bar"
                                                          ,1
                                                          ,throughputData,throughput.transformToStream));
            $scope.data.push(throughput.generateDataStream("Percent"
                                                          ,"line"
                                                          ,2,throughputData
                                                          ,[
                                                             throughput.transformToAccSum
                                                            ,throughput.transformAccSumToAccPercentage
                                                          ]));
            sum = _.last($scope.data[1].values).y;
            downloadData = throughputData;
            $scope.hasData = true;
            $scope.dt = $scope.startTime;
             
            $scope.$apply();
        },function(reject){});
    }

    $scope.startDateChanged = function () {
        if(!new Date($scope.dt)){
            return;
        }
        state.startTime = new Date($scope.dt).getTime();
        $scope.startTime = state.startTime
        updateReport();
    };



    $scope.downloadAsJson = function () {
        downloadAsJson(downloadData, "Throughput_Data");
    };

    $scope.downloadAsCSV = function () {
        downloadAsCSV(downloadData, "Throughput_Data");
    };

    $scope.resolutions = [
        {value:1, label:"1 day"},
        {value:7, label:"1 week"},
        {value:14, label:"2 weeks"},
        {value:21, label:"3 weeks"},
        {value:30, label:"1 month"}
    ]

    $scope.resolution =  $scope.resolutions[state.resolution||0];
    
    $scope.updateResolution = function() {
        if($scope.resolution){
            updateReport();
            state.resolution =_.indexOf($scope.resolutions,$scope.resolution);
        } 
    };

    $scope.open = function ($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.opened = true;
    };

    updateReport();
}]);





//******************************************************************************************
// Throughput
//******************************************************************************************

app.factory("throughputFactory", function () {
    var factory= {};
    factory.generateChartData = function (data){
        return [{
            "key" : "Troughput" ,
            "bar": true,
            "values" : _.drop(data)
        }];
    };

    factory.generateDataStream = function (key,type,yAxis, data, transform){
        let result = _.drop(data);
        if(!_.isArray(transform)){
            transform = [transform];
        }
        
        transform.forEach( function(trans){
            result = result.map(trans);
        });

        return {
            "key" : key ,
            "type": type,
            "yAxis":yAxis,
            "values" :result
        };
    };

    factory.transformToStream = function(pair){
        return{x:parseInt(pair[0]),y:pair[1]};
    }

    var sum;

    factory.transformToAccSum = function(pair,index){
        if(index === 0){
            sum = 0
        }
        sum += pair[1];
        return{x:parseInt(pair[0]),y:sum};
    }

    factory.transformAccSumToAccPercentage = function(value,index,arr){
        if(index === 0){
            sum = _.last(arr).y;
        }
        return{x:value.x,y:Math.floor(value.y/sum*100)};
    }



     
    return factory;
});


// ThroughputController ----------------------------------------------------------------------

app.controller("ThroughputController", 
                ['$scope', '$route', '$window', '$routeParams', 'boardDataFactory', 'throughputFactory','sharedState'
                , function ($scope, $route, $window, $routeParams, boardDataFactory, throughput,state) {
      console.log ("ThroughputController");
      var downloadData;
     $scope.data ;
     $scope.today = new Date();
     $scope.hasData = false;
     $scope.state = state;
     $scope.dt = $scope.state.startTime;
     $scope.options = {
            chart: {
                type: 'historicalBarChart',
                height: 500,
                margin : {
                    top: 20,
                    right: 30,
                    bottom: 65,
                    left: 50
                },
                x: function(d){return d[0];},
                y: function(d){return d[1];},
                showValues: true,
                valueFormat: function(d){
                    return d3.format(',.1f')(d);
                },
                duration: 100,
                xAxis: {
                    axisLabel: '',
                    tickFormat: function(d) {
                        return d3.time.format('%Y-%m-%d')(new Date(d))
                    },
                    rotateLabels: 45,
                    showMaxMin: false
                },
                yAxis: {
                    axisLabel: 'Done items',
                    axisLabelDistance: -10,
                    tickFormat: function(d){
                        return d3.format(',.0f')(d);
                    }
                },
                tooltip: {
                    keyFormatter: function(d) {
                        return d3.time.format('%Y-%m-%d')(new Date(d)) +" - "+
                               d3.time.format('%Y-%m-%d')(new Date(d+($scope.sprintLength*7-1)*timeUtil.MILLISECONDS_DAY));
                    }
                },
                zoom: {
                    enabled: true,
                    scaleExtent: [1, 10],
                    useFixedDomain: false,
                    useNiceScale: true,
                    horizontalOff: true,
                    verticalOff: true,
                    unzoomEventType: 'dblclick.zoom'
                }
            }
        };

        $scope.config = {
            refreshDataOnly: false, // default: true
        };

        $scope.board = decodeUrl($routeParams.board);

    
    function updateReport(){
        
        boardDataFactory.getBoardData($scope.board).then(function(boardData){
            $scope.start = $scope.start || boardData.boardCreated;
            var filter = {
                sampleTimes: cfdUtil.generateSampleTimes( $scope.state.startTime,$scope.sprintLength.value)//(boardData.boardCreated,1)
            };
            var throughputData = boardData.getThroughputReport(filter);
            $scope.data = throughput.generateChartData(throughputData);
            downloadData = cfdUtil.readableDatesOnCfdData(throughputData)
            $scope.hasData = true;
            $scope.dt = $scope.data[0].values[0][0];
             
            $scope.$apply();
        },function(reject){});
    }

    $scope.startDateChanged = function () {
        if(!new Date($scope.dt)){
            return;
        }
        $scope.state.startTime = new Date($scope.dt).getTime();
        updateReport();
    };



    $scope.downloadAsJson = function () {
        downloadAsJson(downloadData, "Throughput_Data");
    };

    $scope.downloadAsCSV = function () {
        downloadAsCSV(downloadData, "Throughput_Data");
    };

    $scope.sprintLengths = [
        {"value":1,"label":"1 week"},
        {"value":2,"label":"2 weeks"},
        {"value":3,"label":"3 weeks"},
        {"value":4,"label":"4 weeks"},
    ]

    $scope.state.sprintLength = $scope.state.sprintLength || 0; 
    $scope.sprintLength = $scope.sprintLengths[$scope.state.sprintLength];
    
    $scope.updateSprintLength = function() {
        if($scope.sprintLength){
            $scope.state.sprintLength = _.indexOf($scope.sprintLengths,scope.sprintLengths)
            updateReport();
        } 
    };

    $scope.open = function ($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.opened = true;
    };

    updateReport();
}]);



//******************************************************************************************
// CFD
//******************************************************************************************

app.factory("cfdFactory", function () {
    var factory = {};


    factory.filterCfdChartData = function (cfdRawChartData, start) {
        var filteredCfdData = [];
        _.forEach(cfdRawChartData, function (laneData) {
            var filteredLane = {};
            filteredLane.key = laneData.key;
            filteredLane.values = filterArray(laneData.values, function (value) {
                return value[0] >= start;
            });
            filteredCfdData.push(filteredLane);
        });
        return filteredCfdData;
    };

    factory.buildCfdChartData = function (cfdData) {
        var chartData = [];
        var lane, day;
        var laneData;
        console.log("buildCfdChartData");
        if (cfdData.length === 0) {
            return cfdData;
        }
        for (lane = 1; lane < cfdData[0].length; lane++) {
            laneData = {};
            laneData.key = cfdData[0][lane];
            laneData.values = [];
            for (day = 1; day < cfdData.length; day++) {
                laneData.values.push([cfdData[day][0], cfdData[day][lane]]);
            }
            chartData.push(laneData);
        }
        return chartData;
    };

    factory.readableDatesOnCfdData = cfdUtil.readableDatesOnCfdData;

    factory.doneStartsFrom0 = function (cfdChartData) {
        cfdChartData = _.cloneDeep(cfdChartData);
        var doneAccumulated = cfdChartData[0].values[0][1];
        _.forEach(cfdChartData[0].values, function (value) {
            value[1] = value[1] - doneAccumulated;
        });
        return cfdChartData;
    };

    return factory;
});


app.controller("CfdController", ['$scope', '$route', '$window', '$routeParams', 'boardDataFactory', 'cfdFactory', function ($scope, $route, $window, $routeParams, boardDataFactory, cfd) {

    $scope.cfdData = [{"key" : "No data" , "values" : [ [ 0 , 0]]}];
    $scope.dt = 0;
    $scope.hasData = false;
    $scope.startTime = 0;
    $scope.zeroDone = false;
    $scope.filter = "";
    var cfdDownloadData = [];
    var cfdRawChartData = [];
    
    $scope.options = {
            chart: {
                type: 'stackedAreaChart',
                height: 450,
                margin : {
                    top: 20,
                    right: 20,
                    bottom: 30,
                    left: 40
                },
                x: function(d){return d[0];},
                y: function(d){return d[1];},
                useVoronoi: false,
                clipEdge: true,
                duration: 100,
                useInteractiveGuideline: true,
                xAxis: {
                    showMaxMin: false,
                    tickFormat: function(d) {
                        return d3.time.format('%Y-%m-%d')(new Date(d))
                    }
                },
                yAxis: {
                    rotateLabels: 45,
                    tickFormat: function(d){
                        return d3.format(',.0f')(d);
                    }
                },
                zoom: {
                    enabled: true,
                    scaleExtent: [1, 10],
                    useFixedDomain: false,
                    useNiceScale: false,
                    horizontalOff: false,
                    verticalOff: true,
                    unzoomEventType: 'dblclick.zoom'
                }
            }
        };
    
    $scope.config = {
        refreshDataOnly: false, // default: true
    };
    
    console.log("cfdController");

    function updateCfd(cfdTableData) {
        var cfdChartData;
        if (cfdTableData.length === 0) {
            return;
        }
        cfdDownloadData = cfdTableData;
        cfdRawChartData = cfd.buildCfdChartData(cfdDownloadData);
        cfdChartData = cfd.filterCfdChartData(cfdRawChartData, $scope.startTime);
        if ($scope.zeroDone) {
            cfdChartData = cfd.doneStartsFrom0(cfdChartData);
        }
        $scope.cfdData = cfdChartData;
        $scope.hasData = true;
        $scope.dt = $scope.cfdData[0].values[0][0];
    }

    $scope.toggleMin = function () {
        $scope.start = $scope.start ? null : new Date();
    };
    $scope.toggleMin();

    $scope.open = function ($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.opened = true;
    };


    $scope.board = decodeUrl($routeParams.board);


    boardDataFactory.getBoardData( $scope.board).then(function (response) {
        var data ;
        $scope.boardData = response;
        data = $scope.boardData.getCfdData();
        updateCfd(data);
        $scope.start = data[1][0];
        $scope.today = new Date();
        $scope.$apply();
    }, function (error) {
        console.log("send message failed");
    });

    function getFilterParameters(){
        var parameters = {};
        if(new Date($scope.dt).getTime() !== $scope.start){
            parameters.startMilliseconds = new Date($scope.dt).getTime();
        }if($scope.filter !== ""){
            parameters.text = $scope.filter;
        }
        return parameters;
    }

    $scope.startDateChanged = function () {
        $scope.startTime = new Date($scope.dt).getTime();
        var filter = getFilterParameters();
        cfdDownloadData = $scope.boardData.getCfdData(filter);
        updateCfd(cfdDownloadData);
    };

    $scope.filterChanged = function () {
        var parameter = {"text": $scope.filter};
        cfdDownloadData = $scope.boardData.getCfdData(parameter);
        updateCfd(cfdDownloadData);
    };

    $scope.downloadAsJson = function () {
        var download = cfd.readableDatesOnCfdData(cfdDownloadData);
        downloadAsJson(download, "CFD_Data");
    };

    $scope.downloadAsCSV = function () {
        var download = cfd.readableDatesOnCfdData(cfdDownloadData);
        downloadAsCSV(download, "CFD_Data");
    };

    $scope.$on('$viewContentLoaded', function (event) {
        $window._gaq.push(['_trackPageview', "CFD"]);
    });

}]);


app.controller("TabController", [
        '$scope',
        '$location',
        function ($scope, $location) {
            $scope.tabs = [];
            $scope.tabs.push({"caption": "CFD", "active": false, "route": "/cfd/"});
            $scope.tabs.push({"caption": "Throughput", "active": false, "route": "/throughput/"});
            $scope.tabs.push({"caption": "Spectral", "active": false, "route": "/spectral/"});

            $scope.boardUrl = _.last($location.url().split("/"));

            $scope.setActiveTab = function (url) {
                _.forEach($scope.tabs, function (tab) {
                    if (url.indexOf(tab.route) > -1) {
                        tab.active = true;
                        return;
                    }
                    tab.active = false;
                });
            };

            $scope.goTo = function (route) {
                $location.url(route + $scope.boardUrl);
                $scope.setActiveTab($location.url())
                $scope.boardUrl = _.last($location.url().split("/"));
            };

            $scope.setActiveTab($location.url());
        }
    ]
);



app.config(['$routeProvider',
    function ($routeProvider) {
        $routeProvider.
            when('/cfd/:board', {
               templateUrl: 'templates/cumulative-flow-diagram.html',
               controller: 'CfdController'
            }).when('/throughput/:board', {
                templateUrl: 'templates/throughput.html',
                controller: 'ThroughputController'
            }).when('/spectral/:board', {
                templateUrl: 'templates/spectral.html',
                controller: 'SpectralController'
            })/*.when('/flowreport/:board', {
                templateUrl: 'templates/flowreport.html',
                controller: 'FlowReportController'
            }).when('/cycletime/:board', {
                templateUrl: 'templates/cycletime.html',
                controller: 'CycletimeController'
            })*/.otherwise({
                redirectTo: '/cfd/:board'
            });
    }
]);
