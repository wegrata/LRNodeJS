/*

    Small list of relevant objects:

        previewObject: An array used to preview topics to follow. Requires topic name
        and an array of resource objects belonging to that topic. Please note that topics
        should be unique. previewObjects can also support user names (i.e. you are also able to follow a user).
        previewObjects contains an array of resourceObjects.



        resourceObject: The unit resource. These would be unique metadata entries from the LR. resourceObjects also
        have paradata arranged in a timeline array.

        self.followers should contain an array of previewObjects
        self.organizations needs only to contain an array of strings that can be used to search against a node
*/

var currentObjectMetadata = [];
var lastContentFrameSource = "";
var saveFrameState = "";

var urlTransform = {

    "3dr.adlnet.gov" : function(urlObj){

        //After splitting, this is the index of the most important part of the URL (the id)
        var idIndex = 2;

        var temp = (urlObj.pathname[0] == "/") ? urlObj.pathname.substr(1, urlObj.pathname.length - 1) : urlObj.pathname;
        var id = temp.split("/")[idIndex];
        //console.log(urlObj.pathname);

        return "http://3dr.adlnet.gov/Public/Model.aspx?ContentObjectID=" + id;
    }
};

var reverseTransform = {

    "3dr.adlnet.gov" : function(urlObj){

        //After splitting, this is the index of the most important part of the URL (the id)
        var idIndex = 1;
        var id = urlObj.href.split("=")[idIndex];

        //console.log(urlObj.href.split("="));

        return "http://3dr.adlnet.gov/api/rest/"+id+"/Format/dae?ID=00-00-00";
    }
};

//This may need to be refactored for memory efficiency. Not sure how createElement handles memory.
var getLocation = function(href) {
    var l = document.createElement("a");
    l.href = href;
    return l;
};

var opts = {
  lines: 7, // The number of lines to draw
  length: 3, // The length of each line
  width: 3, // The line thickness
  radius: 7, // The radius of the inner circle
  corners: 1, // Corner roundness (0..1)
  rotate: 18, // The rotation offset
  color: '#000', // #rgb or #rrggbb
  speed: 0.7, // Rounds per second
  trail: 60, // Afterglow percentage
  shadow: false, // Whether to render a shadow
  hwaccel: true, // Whether to use hardware acceleration
  className: 'spinner', // The CSS class to assign to the spinner
  zIndex: 2e9, // The z-index (defaults to 2000000000)
  top: 'auto', // Top position relative to parent in px
  left: 'auto' // Left position relative to parent in px
};

var self, numOfPreviewElements = 3, spinner = null;

var enableDrag = function(){
    $( ".draggable" ).draggable({
        revert: "invalid",
        cursor: "move",
        containment: "document",
        opacity: 0.8,
        start: function(){
                    $(this).addClass("lr_border").removeClass("lr_border_trans");
                    if($(this).attr("name").indexOf("followers") != -1)
                       $(this).parent().parent().css({overflow:"visible"});
                },
        stop: function(){
                    $(this).removeClass("lr_border").addClass("lr_border_trans");
                    if($(this).attr("name").indexOf("followers") != -1)
                       $(this).parent().parent().css({overflow:"hidden"});
                }
    });
};

var generateContentFrame = function(src, alreadyAppended){
	
	if(alreadyAppended !== true){
		
		//This is definitely not a trivial workaround. However, this does disable adding to the browser's history
		var frameCode = '<iframe id="modalFrame" style="visibility: hidden;" src="about:blank" frameborder="0"></iframe>';
		$("#mBody").append(frameCode);
	}

	var frame = $('#modalFrame')[0];
	frame.contentWindow.location.replace(src);
	
	if(alreadyAppended !== true){
		$("#spinnerDiv").show();
		$("#modalFrame").load(function(){

			spinner.stop();
			$("#spinnerDiv").hide("slow", function(){
				$("#modalFrame").css("visibility", "visible");
			});
		});
	}
};

var handleMainResourceModal = function(src, direct){

	//if we're not accessing directly, back should lead to visual browser
	lastModalLocation = (direct !== true)?  "visual" : "home";

	//src should either be the URL, or a jQuery object whose name attribute is the URL
	src = (typeof src == "string")? src : $(this).attr("name");
	lastContentFrameSource = src;

	var target = document.getElementById('spinnerDiv');
	self.currentObject(new resourceObject("Item", src));
	
	//Remove any residual JSON prettyprinted documents
	$(".prettyprint").remove();
	generateContentFrame(src);

	$("#modal").modal();

	/*
		While the modal content is loading, load the timeline. Need jQuery/socket.io here. Need to do ordering.

		self.currentObject().timeline.push(NEW ENTRIES);
	*/
	var tempUrl = getLocation(src);
	if(reverseTransform[tempUrl.hostname] !== undefined)
		src = reverseTransform[tempUrl.hostname](tempUrl);

	console.log("This is the src we will be using to search: ", src);
	$.ajax("https://node02.public.learningregistry.net/obtain?request_id="+src,{
		dataType : 'jsonp',
		jsonp : 'callback'
	}).success(function(data){

		//For each document found in data
		var jsonData;
		currentObjectMetadata = [];
		for(var i = 0; i < data.documents[0].document.length; i++){

			if(data.documents[0].document[i].resource_data_type == "paradata"){
				
				jsonData = (typeof data.documents[0].document[i].resource_data == "string") ? 
							$.parseJSON( data.documents[0].document[i].resource_data ) : data.documents[0].document[i].resource_data;
							
				self.currentObject().timeline.push(jsonData);
			}
			
			else if(data.documents[0].document[i].resource_data_type == "metadata"){
				
				currentObjectMetadata.push(data.documents[0].document[i]);
			}
		}
		console.log(self.currentObject().timeline());
		console.log(data);
	});

	if(spinner !== null){

		//Checks to see if there are enough rows in the timeline to warrant showing the scroll bars
		//Should be checked whenever an element is added to or removed from the timeline
		if($("#timeline-table").height() > 640)
			$(".modal-timeline").getNiceScroll().show();

		spinner.spin(target);
	}
	else {

		$(".modal-timeline").niceScroll({"cursoropacitymax": 0.7, "cursorborderradius": 0} );
		spinner = new Spinner(opts).spin(target);
	}
};


var enableModal = function(name){

    $(".draggable span").click(handleMainResourceModal);

    $("#modal").on("hidden", function(){

        //Destroy tooltips
        $(".bottomBar i").tooltip('destroy');

        $(".scrollbar").scrollTop(0);
        $(".modal-timeline").getNiceScroll().hide();
        $("#modalFrame").attr({src:"about:blank"});
        $(".author-timeline").popover('hide');

        //console.log("");
        //self.currentObject({});
        //self.timeline.removeAll();
    });
};

var previewObject = function(name, content){
    this.name = name;
    this.content = ko.observableArray(content);
    this.isUser = false;
};

var resourceObject = function(name, url, timeline){

    this.title = name;
    this.url = (url !== undefined) ? url : null;

    //The timeline should be an observable array of paradata objects
    this.timeline = (timeline !== undefined) ? ko.observableArray(timeline) : ko.observableArray();

    /*if(obj.img !== undefined)
        this.img = obj.img;

    if(obj.publisher !== undefined)
        this.publisher = obj.publisher;*/

    //todo
};

var user = function(obj){

    this.isFollower = false;
    this.isFollowing = false;

    this.name = obj.name;
};

var followingList = [];

/*

    These arrays and objects are made to portray actual data and will not be included in any final releases

    Begin dummy data:

*/
var siteList = [ "http://solarsystem.nasa.gov/images/Moon.jpg", "http://en.wikipedia.org/wiki/Space_Shuttle", "http://www.tooter4kids.com/classroom/math4kids.htm" ];

//Timelines are not automatically loaded. tempTimeLine will be used to emulate the loading of timelines
var mockParadata = {
    "activity": {
        "actor": {
            "objectType": "teacher",
            "description": [
            "Optional Username",
            "high school",
            "english"
            ]
        },
        "verb": {
            "action": "rated",
            "measure": {
                "sampleSize": 1,
                "scaleMin": 0,
                "scaleMax": 3,
                "value": 2
            },
            "date": "2012-09-27"
        },
        "object": siteList[1]
    }
};

var tempTimeline = [];
for(var i = 0; i < 8; i++){

    mockParadata.activity.actor.description[0] = "User " + (i + 1);
    tempTimeline[i] = jQuery.extend(true, {}, mockParadata);
}

//"Preview resources" makes it esay to group resources by publisher
var previewResources = [

    new previewObject("NASA", [new resourceObject("Moon Image", siteList[0]), new resourceObject("Shuttle Launch", siteList[1], tempTimeline)]),
    new previewObject("PBS", [new resourceObject("Lizard Flash Game"), new resourceObject("ABC Learning")]),
    new previewObject("Learning Corp", [new resourceObject("Math4Kids", siteList[2])]),
    new previewObject("Extra Object", [new resourceObject("For Testing")]),
    new previewObject("Extra Object 2", [new resourceObject("For Testing"), new resourceObject("Testing 2")])
];

/*

    End dummy data

*/

//Swaps an element with an element that's not currently being displayed, if it exists
var swapResourceElement = function(arr, removeIndex, swapIndex){

    //arr must be a ko observable array
    if(arr()[swapIndex] === undefined)
        arr.splice(removeIndex, 1);

    else{
        arr()[removeIndex] = arr()[swapIndex];
        arr.splice(swapIndex, 1);
    }
};

var getProperArray = function(str){

    switch(str){

        case "data":
            return self.data;
        case "followers":
            return self.followers;
        case "bookmarks":
            return "bookmarks";
        default:
            return self.data;
    }
};



var generateAuthorSpan = function(str, author, content, i){

    //Check for any potential XSS attacks
	
	content = (content == undefined)? "" : content.replace(/"/g, "&quot;").replace(/'/g, "&apos;");
	author = author.replace(/"/g, "&quot;").replace(/'/g, "&apos;");
	str = str.replace(/"/g, "&quot;").replace(/'/g, "&apos;");
	
	console.log("Debug span ", content + " " + author + " " + str);
	
    var title = author + '<button type="button" onclick="hidePopover()" class="close closeTimeline" aria-hidden="true">&times;</button>';

    var bottomBar = '<div class="bottomBar">'+
                        '<i name="'+author+'" rel="tooltip" title="Follow User" onclick="handleOnclickUserBar(this)" class="icon-star"></i>'+
                        '<i name="'+author+'" rel="tooltip" title="View User Profile" onclick="handleOnclickUserBar(this)" class="icon-user"></i>'+
                        '<i rel="tooltip" title="View Raw Paradata" onclick="handleOnclickUserBar(this)" class="icon-file" name="paradata'+i+'"></i>'+
                    '</div>';

    var localContent = '<div>'+content+'</div>' + bottomBar;

    return "<br/><span data-content='"+localContent+"' data-title='"+title+"' data-trigger='manual' class='author-timeline'>" + str + "</span>";
};

var createJSON = function(obj, type){

	return JSON.stringify({action: type, subject: obj});
};

var displayObjectData = function(pmdata){
	
		lastModalLocation = "frame";
		$(".prettyprint").remove();

		//Watch out for XSS attacks
		console.log("metadata: ", pmdata);
		var metadata = '<pre class="prettyprint">';
		
		if($.isArray(pmdata)){
			for(var i = 0; i < pmdata.length; i++){
				metadata += JSON.stringify(pmdata[i], null, 4);
			}
			
			metadata = (pmdata.length == 0)? "<center class='prettyprint' style='margin-top: 20%;'>No metadata found</center>" : metadata;
		}
		
		else {
			
			metadata += JSON.stringify(pmdata, null, 4);
		}
		
		
		if($("#modalFrame").length > 0){
			saveFrameState = $("#mBody").html();
			$("#modalFrame").remove();
		}
		
		$(".modal-body").append(metadata + "</pre>");
		prettyPrint();
};

/* The main View Model used by Knockout.js */
var mainViewModel = function(resources){

    self = this;
    self.numOfPreviewElements = numOfPreviewElements;

    self.data = ko.observableArray(resources);
    self.bookmarks = ko.observableArray();
    self.followers = ko.observableArray(followingList);
    self.visualBrowserResults = ko.observableArray();
	
	
	self.handleDataClick = function(e){
		
		displayObjectData(currentObjectMetadata);
	};
	
    self.getShorterArr = function(str, length, url){

        if(typeof str == "string"){

            var temp = getLocation(str);

            //Check to see if we should transform the url
            if(urlTransform[temp.hostname] !== undefined && url == undefined && length == undefined)
                str = urlTransform[temp.hostname](temp);

            else str = (str.length > length)? str.substr(0, length) + "..." : str;

            return str;
        }

        else if(str !== undefined){
			
            return (str.length > length)? str.splice(0, length) : str;
		}
    };

    self.currentObject = ko.observable({});
    self.currentResourceName = ko.observable("");


    //allOrganizations is defined outside of this script
    console.log(allOrganizations);
    self.allOrganizations = ko.observableArray(allOrganizations);
    self.allTerms = allTerms;

    self.checkTimelineLength = function(obj){

        if(obj === undefined) return 0;
        else return obj().length;
    };

    self.generateName = function(a, b, c){

        return a + "_" + b + "_" + c;
    };

    self.generateParadataText = function(e, i){

		/*
		 * TO-DO: Finish coming up with a generalized solution for most paradata documents
		 */		
	
		var verb = e.activity.verb.action.toLowerCase();
		var dateStr = (e.activity.verb.date === undefined) ? "" : e.activity.verb.date;
		
		//These three don't exist for viewed verb
		var detail = (e.activity.verb.detail === undefined)? "hi" : e.activity.verb.detail;
		var content = (e.activity.content === undefined)? "hi" : e.activity.content;
		
		var actor = (e.activity.actor === undefined)? "hi" : (e.activity.actor.description == undefined && e.activity.actor.displayName !== undefined) ? 
					e.activity.actor.displayName : e.activity.actor.description[0];
		
		var date = new Date(dateStr);
		
		//Not a valid date object
		if(isNaN(date.getTime())){
			
			if(self.currentObject().url.indexOf("3dr.adlnet.gov") > -1){
				
				//This gets the timestamp within "/Date(x)/"
				date = new Date(parseInt(dateStr.substr(6, dateStr.length - 8)));
			}
			
			else if(false){
				
				
			}
			
			else
				console.log("may not be working");
				
				
		}
		
		console.log(date.toDateString(), " ", date.getTime());
		dateStr = moment(date.getTime()).fromNow();
		
        //Handle each verb differently
        switch(verb){

            case "rated":
                return actor + " " + verb + " this " + generateAuthorSpan(dateStr, actor, undefined, i);

            case "commented":
                return detail + " " + generateAuthorSpan(actor + ", " + dateStr, actor, undefined, i);

            case "downloaded":
				return generateAuthorSpan(dateStr, actor, content, i);
			
			//published = uploaded for 3DR
			case "published":
				return generateAuthorSpan(dateStr, actor, content, i);

			case "viewed":
				return content + " " + generateAuthorSpan(dateStr, actor, undefined, i);
				
			case "matched":
				return actor + " has a match " + generateAuthorSpan(dateStr, actor, content, i);
        }
        
        
        return "Unable to display paradata document.";
    };

    self.followOrganization = function(e){

        //return;

        /* Add jQuery/socket.io call here */
        $.ajax({
            type: "POST",
            url: "/main",
            dataType: "json",
            jsonp: false,
            contentType: 'application/json',
            data: createJSON(e, "follow"),
            success: function(data){
				
				console.log("added");
                self.allOrganizations.remove(e);
                self.followers.push({name:data.subject, content:[]});
            //console.log(data);
            },
            error: function(error){
                console.error(error);
            }
        });
        //$.post('/main',createJSON(e, "follow"), success, "json").error(error);


        //self.getResourcesByFollowers();

        //removeIndex = $.inArray(e, self.data());
        //swapResourceElement(self.data, removeIndex, numOfPreviewElements);

        //Notify listeners since we manually changed the value
        //self.data.valueHasMutated();

        //enableDrag();
        //enableModal();
    };

    self.followUser = function(name){

        var obj = new previewObject(name, []);
        obj.isUser = true;

        self.followers.push(obj);
        enableDrag();
        enableModal();
    };

    self.moveResourceToBookmark = function(index){

		console.log(self.currentObject());

        //Doing this kind of check is a workaround for not being able to pass
        //currentResourceName directly. Not sure what that's about..

		//Element was found in bookmarks
        if(self.bookmarks.indexOf(self.currentObject().url) !== -1){

            var currentName;
			currentName = "-2_0_bookmarks";
			self.currentResourceName(currentName);
			self.bookmarks.remove(self.currentObject().url);

			console.log(self.bookmarks().length);
        }

        else{

            /* Insert socket.io call here to add element to bookmarks, then check if successful */

            //Assign this resource a publisher, add it to bookmarks, and update currentResourceName to reflect that
            //self.currentObject().publisher = self.currentObject().url;
            self.bookmarks.push(self.currentObject().url);
            self.currentResourceName("-1_" + (self.bookmarks().length-1) + "_" + "bookmarks");

            console.log(self.bookmarks().length);
        }

        enableDrag();
        enableModal();
    };

    self.deleteResource = function(){

        /* Add jQuery/socket.io call here*/

        self.data.remove(this);
    };

    self.addResource = function(){

        self.data.push(new previewObject("Organization", [new resourceObject("New Resource")]));
        enableDrag();
    };

    self.isCurrentBookmarked = function(){


		console.log("Is in bookmarks? ", self.bookmarks.indexOf(self.currentObject().url));
        return (self.bookmarks.indexOf(self.currentObject().url) !== -1);
    };

    self.getResourcesByFollowers = function(){

        var tempFollowersArr = [];
        var g = 0;

        for(var i = 0; i < self.followers().length; i++){

            //This allows us to call the function only once per iteration
            tempHoldingArr = self.getResourcesByUserName(self.followers()[i].name);

            if(tempHoldingArr.length > 0){

                tempFollowersArr[g] = tempHoldingArr;
                g++;
            }
        }

        return tempFollowersArr;
    };

    /*
        Returns an array of resourceObjects
    */
    self.getResourcesByUserName = function(user, resources){

        if(resources === undefined)
            resources = self.data();

        tempResourcesArr = [];

        for(var i = 0; i < resources.length; i++){

            if(resources[i].name == user){

                tempResourcesArr = resources[i].content();
                break;
            }
        }
        return tempResourcesArr;
    };

    self.getOrganizationAccordionId = function(index, str){

        return str + "org" + index();
    };

    self.getCollapseId = function(name, poundSign){
        if(poundSign === undefined)
            poundSign = "";
        return poundSign + name.replace(/\W/g, "");
    };
};
