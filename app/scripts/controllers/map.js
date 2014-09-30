'use strict';

/* global $ */

var DEFAULT_COUNTY = 'TPE-4';

var MAP_DEFAULT_VIEW = {
  'TPE-4':{lat: 25.0666313, lng: 121.5943403, zoom: 13},
  'TPQ-1':{lat: 25.1752044, lng: 121.4813232, zoom: 12},
  'TPQ-6':{lat: 25.0260396, lng: 121.4654445, zoom: 14},
};


/**
 * @ngdoc function
 * @name projectVApp.controller:MapCtrl
 * @description
 * # MapCtrl
 * Controller of the projectVApp
 */
angular.module('projectVApp')
  .controller('MapCtrl',
  ['$scope', '$routeParams','$http', '$q', '$filter', '$modal', 'leafletData', 'voteInfoService',
  function ($scope, $routeParams, $http, $q, $filter, $modal, leafletData, voteInfoService ) {
    $scope.myscope = {};
    $scope.voteInfos = {};
    var county = $routeParams.county;
    var voteStatData = null;
    var lastClickLayer = null; 
    var lastClickMarker = null;
    $scope.myscope.showVS = null;
    $scope.myscope.currentVsTab = {}; //local
    $scope.myscope.currentTownTab = ''; //local
    $scope.myscope.vsInfo = {};

    $scope.leafletData = leafletData;
    $scope.taiwan = MAP_DEFAULT_VIEW[county];

    $scope.defaults = {
      zoomControlPosition: 'bottomright',
      minZoom: 11,
      //maxZoom: 10,
    };

    var myiconArray = (function genIcon(){
      var iconSize = [45, 50];
      var iconAnchor = [iconSize[0]/2, iconSize[1]];
      var icon_count = ['1','2','3'];
      var icon_type = ['x','c','d'];
      var icon_result_temp = {};
      angular.forEach(icon_count, function(count){
        icon_result_temp[count] = {};
        angular.forEach(icon_type, function(type){
          icon_result_temp[count][type] = {
            iconSize: iconSize,
            iconUrl: 'images/map'+type+count+'.png',
            iconAnchor: iconAnchor 
          };
        }); 
      });
      //console.log('icon_result_temp',icon_result_temp);
      return icon_result_temp;
    })();

    if(!(county in MAP_DEFAULT_VIEW)) {
      county = DEFAULT_COUNTY;
    }

    function getColor(feature) {
      var area = [];

      if (feature.properties.TOWNNAME) {
        area.push(feature.properties.TOWNNAME);
      }
      if (feature.properties.VILLAGENAM) {
        area.push(feature.properties.VILLAGENAM);
      }
      var defaultColor = '#aaaaaa';
          return defaultColor;
    }

    function animate() {
      setTimeout(function() {
        $('.county').each(function(i, el) {
          if (el.classList) {
            el.classList.remove('transparent');
          } else if (el.getAttribute && el.getAttribute('class')) {
            // workaround for IE 10
            el.setAttribute('class',
              el.getAttribute('class').replace('transparent', ''));
          }
        });
      }, 100);
    }


    function applyGeojson(json) {
      if (!$scope.geojson) {
        $scope.geojson = {
          data: json,
          style: style,
          resetStyleOnMouseout: false 
        };
      } else {
        $scope.leafletData.getGeoJSON().then(function(localGeojson) {
          localGeojson.addData(json);
        });
      }
    }


    function style(feature) {
      return {
        opacity: 1,
        weight: 2,
        color: 'black',
        dashArray: '5',
        fillOpacity: 0.7,
        fillColor: feature.properties.mycolor,
        className: 'county transparent'
      };
    }

    var mouse_over_style = {
        weight: 5,
        color: 'white',
    };

    var mouse_leave_style = {
        weight: 2,
        color: 'black',
    };

    function gen_area_color(color){
        return { fillColor: color };//getColor(feature),
    }

    function set_unclick_style(layer){
       var mycolor = layer.feature.properties.mycolor;
       return gen_area_color(mycolor);
    }
    
    function set_click_style(){
       return gen_area_color("#ffff00");
    }

    
    // Mouse over function, called from the Leaflet Map Events
    function areaMouseover(ev, leafletEvent) {
      var layer = leafletEvent.target;
      layer.setStyle(mouse_over_style);
      layer.bringToFront();
    }

    function areaMouseout(ev, leafletEvent) {
      var layer = leafletEvent.target;
      layer.setStyle(mouse_leave_style);
      layer.bringToFront();
    }


    function areaClick(ev, featureSelected, leafletEvent) {
      var townName = leafletEvent.target.feature.properties.TOWNNAME;
      var villageName = leafletEvent.target.feature.properties.VILLAGENAM;
      var layer = leafletEvent.target;
      areaClickSub(townName,villageName,layer);
      showCurrentVillageVotestat(townName,villageName);
    }

    function areaClickSub(townName,villageName,layer){
      if(lastClickLayer){
        lastClickLayer.setStyle(set_unclick_style(lastClickLayer));
      }
      layer.setStyle(set_click_style());
      layer.bringToFront();
      lastClickLayer = layer; 
    }

    $scope.myscope.setCurrentAreaClick = function(townName, villageName){
      $scope.leafletData.getGeoJSON().then(function(localGeojson) {
        //console.log(localGeojson);
        var geoLayers = localGeojson.getLayers(); 
        angular.forEach(geoLayers,function(layer) {
          var lTownName = layer.feature.properties.TOWNNAME;
          var lVillageName = layer.feature.properties.VILLAGENAM;
          //console.log('layer',lTownName,lVillageName);
          //console.log('target',townName,villageName);
          if(townName == lTownName  && villageName == lVillageName){
            areaClickSub(townName,villageName,layer);
          }
        });
      });
      showCurrentVillageVotestat(townName,villageName)
    };

    function showCurrentVillageVotestat(townName, villageName){
      $scope.myscope.showVS = {};
      $scope.myscope.showVS.townName = townName;
      $scope.myscope.showVS.villageName = villageName;
      $scope.myscope.showVS.vsArray = [];
      $scope.markers = {};
      var markerArray = [];
      var currentVsId = 0;

      var query0 = 'json/votestatInfo/' + county + '.json';
      $http.get(query0).then(function(res0) {
        $scope.myscope.vsInfo = res0.data;

        angular.forEach(voteStatData[townName],function(votestat) {
          var vsIndex = votestat.neighborhood.indexOf(villageName);
          if(vsIndex != -1){
            $scope.myscope.showVS.vsArray.push({
              'name':votestat.name,
              'id':votestat.id,
            });
            if(markerArray.length ==0){
              currentVsId = votestat.id;
            }
        
            markerArray.push({
              'vsid':votestat.id,
              'townName': townName,
              'villageName': villageName,
              'vspos': markerArray.length,
              'vscount': ($scope.myscope.vsInfo[votestat.id].volunteer+$scope.myscope.vsInfo[votestat.id].supplement)*0.5,
              'vsobj': {
                lat: votestat.location.lat,
                lng: votestat.location.lng,
              },
            });
          }
        });
        drawVoteStation(markerArray);
        $scope.myscope.setCurrentMarkerClick(currentVsId);

      },
      function(err) {
        console.log('err',err);
      });
    }
  

    $scope.myscope.setCurrentMarkerClick = function(markerName){
      
      var thisMarker = $scope.markers[markerName];
      setVotestatTab(markerName);
      if(lastClickMarker){
         lastClickMarker.icon = lastClickMarker.myicons['x']
      }
      thisMarker.icon = thisMarker.myicons['c'];
      lastClickMarker = thisMarker;
    };

    $scope.myscope.setTownTab = function(townName){
      $scope.myscope.currentTownTab = townName;
    };


    $scope.myscope.isCurrentTownTab = function(townName){
      if($scope.myscope.currentTownTab == townName){
        return "bg-primary";
      }
      else{
        return "";
      }
    };

    $scope.myscope.isCurrentVsTab = function(vsId){
      if($scope.myscope.currentVsTab.vsId == vsId){
        return "bg-primary";
      }
      else{
        return "";
      }
    };

    function setVotestatTab(vsId){
      $scope.myscope.currentVsTab.vsId = vsId;
      $scope.myscope.currentVsTab.vsName = (function(){ 
        for( var i =0; i < $scope.myscope.showVS.vsArray.length; i++){
          var vsobj = $scope.myscope.showVS.vsArray[i];
          if(vsobj.id == vsId){
            return vsobj.name;
          }};
      })();
    }

    $scope.debug = function() {
      // debugger;
    };

    $scope.myscope.back = function() {
      $scope.myscope.showVS = null;
      $scope.markers = {};
      if(lastClickLayer){
        lastClickLayer.setStyle(set_unclick_style(lastClickLayer));
        lastClickLayer = null;
      }
    };

    function drawVoteStation(markerArray) {
      var mymarkers = {};
      lastClickMarker = null;
      angular.forEach(markerArray, function(marker) {
        var mycount = (function(){
          if( marker.vscount > 0.66){
            return 3;
          }
          else if(marker.vscount > 0.33){
            return 2;
          }
          else{
            return 1;
          }
        })();
  
        mymarkers[marker.vsid] = {
          lat: marker.vsobj.lat,
          lng: marker.vsobj.lng,
          icon: myiconArray[mycount]['x'],
          myicons: myiconArray[mycount],    
          mycount: mycount,
          myloc: marker.townName + '-' + marker.villageName,
          myid: marker.vsid
        };
      });
      angular.extend($scope, {
        markers: mymarkers,
      });
      //$scope.markerNs = {};
      //$scope.markerNs.click = false;

      $scope.$on('leafletDirectiveMarker.click', function(e, args) {
        $scope.myscope.setCurrentMarkerClick(args.markerName);
      });

      $scope.$on('leafletDirectiveMarker.mouseover', function(e, args) {
        var thisMarker = $scope.markers[args.markerName];
        thisMarker.icon = thisMarker.myicons['d'];
        //console.log("Leaflet Click",args);
      });

      $scope.$on('leafletDirectiveMarker.mouseout', function(e, args) {
         //$scope.markerNs.click = false;
        var thisName = args.markerName;
        var thisMarker = $scope.markers[args.markerName];
        if(thisMarker != lastClickMarker){
          thisMarker.icon = thisMarker.myicons['x'];
        }
        else{
          thisMarker.icon = thisMarker.myicons['c'];
        }
      });

    }

    $scope.$on('leafletDirectiveMap.geojsonMouseover', areaMouseover);
    $scope.$on('leafletDirectiveMap.geojsonMouseout', areaMouseout);
    $scope.$on('leafletDirectiveMap.geojsonClick', areaClick);
    
    $scope.myscope.registerDialog = function(type) {
      var modalInstance = $modal.open({
        templateUrl:'views/register.html',
        controller: 'registerDialogController',
        size: 'md',
        resolve: {
          data: function() {
            return {
              type: type,
              vsId: $scope.myscope.currentVsTab.vsId,
              vsName: $scope.myscope.currentVsTab.vsName, 
            };
          }   
        }   
      }); 
      modalInstance.result.then(function(result){
        console.log('send',result);
      }); 
    };  

    voteInfoService.getStaticVillageData(county).then(
      function(){},
      function() {}, 
      function(data){ 
        //console.log(data.villageArea , data.villageSum)
        var mycolor = (function(){
          if( data.villageSum == 1){
            return '#00ff00';
          }
          else if(data.villageSum > 0.75){
            return '#22ee22';
          }
          else if(data.villageSum > 0.5){
            return '#55dd55';
          }
          else if(data.villageSum > 0.25){
            return '#88cc88';
          }
          else{
            return '#aaaaaa';
          }
        })();
        data.villageArea.features[0].properties.mycolor = mycolor;
        applyGeojson(data.villageArea);
        console.log(data.villageArea);
      }
    );

    voteInfoService.getAllVotestatData(county).then(
      function(data) {
        voteStatData = data;
    });

    voteInfoService.getAllVillageSum(county).then(
      function(villageSum){ 
        $scope.myscope.villageSum = villageSum;
        $scope.myscope.currentTownTab = Object.keys(villageSum)[0];
    }); 


}])

.controller('registerDialogController',
  ['$scope', '$modalInstance','data', function($scope, $modalInstance, data) {
  $scope.title = 'title';
  $scope.type = data.type;
  $scope.errors = '';
  //console.log(data);
  $scope.content = {
    type: data.type,
    votestat: data.vsName, 
    vsid: data.vsId,
    name: '',
    phone: '',
    email: '',
    supplement: {},
  };

  var selectItems = { 
    'chair1':'椅子#1', 
    'chair2':'椅子#2', 
    'desk':'桌子', 
    'umbrella':'大傘', 
    'pens':'筆（若干）', 
    'board':'連署板',
  };

  var textItem = {
    'name':'名字',
    'phone':'手機',
    'email':'E-Mail',
  };

  var verifySupplement = function(){
    var supplement = $scope.content.supplement;
    for(var item in selectItems){
      if(supplement[item]){
        return true;
      }
    }
    if(supplement["others_select"] && supplement["others"] && supplement["others"].length > 0 ){
      return true;
    }
    return false;
  };

  $scope.send = function () {
    //console.log('scope.content',$scope.content);
    var errors = []; 

    if($scope.content.register.$invalid){
      var register = $scope.content.register;
      for(var item in textItem){
        if(register[item].$error.required){
          errors.push('請填寫您的'+textItem[item]);
          //$scope.content.register 
        }
        if(register[item].$error.email){
          errors.push('您的'+textItem[item]+'格式不符');
          //$scope.content.register 
        }
      }
    }
    if($scope.content.type == 'supplement' && !verifySupplement() ){
      errors.push('請勾選您要提供的物資');
    }
    if(errors.length == 0){
      $modalInstance.close($scope.content);
    }
    else{
      console.log('errors',errors);
      $scope.errors = errors.join('，');
    }
  };

  $scope.cancel = function () {
     $modalInstance.dismiss('cancel');
  };

}]);
