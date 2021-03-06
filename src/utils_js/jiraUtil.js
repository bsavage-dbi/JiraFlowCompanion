function Url(location){
    //console.log("Url("+JSON.stringify(location) + ")");
    var self = {};
    self.host = location.hostname||location.host;
    self.protocol = location.protocol||location.protocol;
    self.port = location.port;
    self.query = location.query||parseUrlQueryString(location.search);

    function parseUrlQueryString(queryString) {
        var query = queryString.substr(1);
        var result = {};
        query.split("&").forEach(function(part) {
            var item = part.split("=");
            if(!result[item[0]]){
                result[item[0]] = [];
            }
            result[item[0]].push( item[1]);//decodeURIComponent(item[1]);
        });
        return result;
    }

    return self;
}



function JiraUrl(location){
    
    let url  = (location)? new Url(location):{};   

    url.cfdApiUrl = function(){
       return urlBuilder("/rest/greenhopper/1.0/rapid/charts/cumulativeflowdiagram.json", url.cfdQueryString);
    }

    url.boardConfigApiUrl = function(){
        return urlBuilder("/rest/greenhopper/1.0/rapidviewconfig/editmodel.json",
                          function(query){
                              return "?rapidViewId="+query.rapidView[0];
                          });
    }

    url.issueDetailsRestApiGetUrl = function (issues, fields){
        "use strict";
        //http://jira1.srv.volvo.com/rest/api/2/search?jql=issueKey%20in%20(TECH-38596)&fields=key,summary,issuetype,labels,status,customfield_11200,customfield_11306
        return url.rootUrl() + "/rest/api/2/search?jql=" +
            encodeURIComponent(jql.findIssuesInArray(issues))+
            "&fields=" + fields ;
    }

    url.issueDetailsRestApiPostRequest = function (issues, fields){
        "use strict";
        return {
            method:"POST",
            url:url.rootUrl() + "/rest/api/2/search",
            data:{
                "jql":jql.findIssuesInArray(issues),
                fields: fields,
                "startAt":0,
                "maxResults":issues.length
            }
        }
    };

    url.hostWithPort= ()=>{
        var port = (url.port)?":"+url.port:"";
        return url.host + port;
    }
    
    url.rootUrl = function (){
        return url.protocol +"//"
                    + url.hostWithPort()
    }

    url.issueUrl = (issueKey)=>{
         return url.rootUrl()
                    + "/browse/"
                    + issueKey;
    }

    
    url.findIssuesByIssueKeys = function(issues,index){
        let query = jql.findIssuesInArray(issues,index);
        return url.rootUrl()
                +"/issues/?jql="
                +encodeURIComponent(query);
    }

    function urlBuilder(path,queryBuilder){
        var result = url.rootUrl() 
                    + path
                    + queryBuilder(url.query);
        return result;
    }
    
    url.cfdQueryString = (query)=>{
        var result = "";
        if(query === undefined){
            query = url.query;
        }
        _.forEach(query, function(values,key){
            if(key != "view" & key != "chart" & key != "days" & key != "projectKey"  ){
                values.forEach(function(value){
                    result += key + "Id=" +value + "&" ;
                });
            }
        });
        result = "?" + result;
        return result;
    }


    url.angularUrl = ()=>{
        return url.protocol +"/"
        + url.uriFriendlyHostWithPort() +"/"
        + url.angularQueryString()
    };

    url.angularQueryString = ()=>{
        let result = "";
        _.forEach(url.query,(value,key)=>{
            if(value.toString!="" & ["view","chart","days","projectKey"].indexOf(key)===-1){
                 result += key + "=" + value.toString() +"&"
            }
        });
        return result.slice(0, -1);
    }

    url.parseAngularQueryString = (queryString)=>{
        let query ={};
        let components = queryString.split("&");
        // console.log("url.parseAngularQueryString("+JSON.stringify(queryString) + ")");
        components.forEach(component=>{
            let parts = component.split("=");
            try {
                query[_.first(parts)] = JSON.parse("["+_.last(parts)+"]");
            }catch (e){
                console.log("Failed to parse query parameter :"+ JSON.stringify(parts));
            }
        });
        url.query = query;
        return query;
    }

    url.getBoardId = function(){
        return url.query.rapidView
    }


    url.uriFriendlyHostWithPort =()=>{
        return encodeURIComponent(url.hostWithPort());
    }

    return url;

}


const jql = {
    findIssuesInArray:function(arr,index){
        let issues;
        if(Array.isArray(arr[0]) && _.isUndefined(index)){
            index = 0;
        }else if(!Array.isArray(arr[0]) & _.isUndefined(index)){
            index = 'id';
        }
        issues = arr.map( issue => {
           if(Array.isArray(issue)|| issue instanceof Object){
             return issue[index]
           }


           return issue; 
            
        });

        return "issueKey in ("+issues.toString()+")"
    },
    issueInfoRequest:function (arr,index){
        let data = {};
        data.jql = this.findIssuesInArray(arr,index);
        data.fields = [
            "key",
            "customfield_10701",//serviceArea", 
            "customfield_11200" //epicLink
        ];
        //curl -D- -u admin:admin -X POST -H "Content-Type: application/json" --data '{"jql":"project = QA","startAt":0,"maxResults":2,"fields":["id","key"]}' "http://kelpie9:8081/rest/api/2/search"
    }
}



