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

var urlTransform = {
	
	"3dr.adlnet.gov" : function(urlObj){
		
		//After splitting, this is the index of the most important part of the URL (the id)
		var idIndex = 2;
		
		var temp = (urlObj.pathname[0] == "/") ? urlObj.pathname.substr(1, urlObj.pathname.length - 1) : urlObj.pathname; 
		var id = temp.split("/")[idIndex];
		
		return "http://3dr.adlnet.gov/Public/Model.aspx?ContentObjectID=" + id;
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
	})
};

var handleMainResourceModal = function(src, direct){
	
	self.currentObject(new resourceObject("Item", src));
	console.log(self.currentObject());
	
	
	//if we're not accessing directly, back should lead to visual browser
	if(direct !== true) lastModalLocation = "visual";
	
	else lastModalLocation = "home";
	
	var tempUpdateTest = false;
	if(typeof src == "string")
		tempUpdateTest = true;
		
	var target = document.getElementById('spinnerDiv');	
	
	if(!tempUpdateTest){
		self.currentResourceName($(this).attr("name"));
		tempModalName = self.currentResourceName().split("_");
		var temp;
		
		//-1 means that the element isn't nested
		if(tempModalName[0] == '-1'){
			
			temp = self.bookmarks()[tempModalName[1]];
			tempUrl = (temp.url == undefined) ? "about:blank": temp.url;
		}

		else{
		
			var properArray = getProperArray(tempModalName[2]);
			temp = properArray()[tempModalName[0]].content()[tempModalName[1]];
			
			tempUrl = (temp.url == undefined) ? "about:blank" : temp.url;		
		}
		
		self.currentObject(temp);
	}
	
	else tempUrl = src;
	
	//This is definitely not a trivial workaround. However, this does disable adding to the browser's history
	var frameCode = '<iframe id="modalFrame" style="visibility: hidden;" src="about:blank" frameborder="0"></iframe>';
	$("#mBody").append(frameCode);
	
	var frame = $('#modalFrame')[0];  
	frame.contentWindow.location.replace(tempUrl);

	$("#spinnerDiv").show();
	
	$("#modalFrame").load(function(){
	
		spinner.stop();
		
		$("#spinnerDiv").hide();
		$("#modalFrame").css("visibility", "visible");
	});
	
	
	$("#modal").modal();
	
	

	
	/*
		While the modal content is loading, load the timeline. Need jQuery/socket.io here. Need to do ordering.
		
		self.currentObject().timeline.push(NEW ENTRIES);
	*/
	
	
	//console.log(self.currentObject().timeline());
	
	
	if(spinner != null){
		
		//Checks to see if there are enough rows in the timeline to warrant showing the scroll bars
		//Should be checked whenever an element is added to or removed from the timeline
		if($("#timeline-table").height() > 640)
			$(".modal-timeline").getNiceScroll().show();
			
		spinner.spin(target);
	}
	else {
		
		$(".modal-timeline").niceScroll({"cursoropacitymax": .7, "cursorborderradius": 0} );
		spinner = new Spinner(opts).spin(target);
	}
	
};
				
				
var enableModal = function(name){
	
	$(".draggable").click(handleMainResourceModal);
	
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
	if(arr()[swapIndex] == undefined)
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
			break;
			
		case "followers":
			return self.followers;
			break;
		
		case "bookmarks":
			return "bookmarks";
			break;
			
		default: 
			return self.data;
			break;
	}
};

var generateAuthorSpan = function(str, author){
	
	//Check for any potential XSS attacks
	
	var title = author + '<button type="button" onclick="hidePopover()" class="close closeTimeline" aria-hidden="true">&times;</button>';
	
	var bottomBar = '<div class="bottomBar">'+
						'<i name="'+author+'" rel="tooltip" title="Follow User" onclick="handleOnclickUserBar(this)" class="icon-star"></i>'+
						'<i name="'+author+'" rel="tooltip" title="View User Profile" onclick="handleOnclickUserBar(this)" class="icon-user"></i>'+
						'<i name="'+author+'" rel="tooltip" title="View Raw Paradata" onclick="handleOnclickUserBar(this)" class="icon-file"></i>'+
					'</div>';
	
	var content = '<div>TESTING POPOVER .. hi there buddy.. how are you?</div>' + bottomBar;
	
	return "<br/><span data-content='"+content+"' data-title='"+title+"' data-trigger='manual' class='author-timeline'>" + str + "</span>";
};

/* The main View Model used by Knockout.js */
var mainViewModel = function(resources){

	self = this;
	self.numOfPreviewElements = numOfPreviewElements;
	
	self.data = ko.observableArray(resources);
	self.bookmarks = ko.observableArray();
	self.followers = ko.observableArray(followingList);
	self.visualBrowserResults = ko.observableArray();
	
	self.getShorterStr = function(str, length, url){
		
		if(typeof str == "string"){
			
			var temp = getLocation(str);
			
			//Check to see if we should transform the url
			if(urlTransform[temp.hostname] !== undefined && typeof url == "boolean")
				str = urlTransform[temp.hostname](temp);
			
			else str = (str.length > length)? str.substr(0, length) + "..." : str;
				
			return str;
		}
		
		else
			return (str.length > length)? str.splice(0, length) : str;
	};
	
	self.currentObject = ko.observable({});	
	self.currentResourceName = ko.observable("");
	
	
	//allOrganizations is defined outside of this script
	self.allOrganizations = allOrganizations;
	self.allTerms = allTerms;
	
	self.checkTimelineLength = function(obj){
	
		if(obj == undefined) return 0;
		else return obj().length;
	};
	
	self.generateName = function(a, b, c){
	
		return a + "_" + b + "_" + c;
	};
	
	self.generateParadataText = function(e, i){
	
		//console.log(e.activity);
		var actor = e.activity.actor.description[0];
		var verb = e.activity.verb.action;
		var date = (e.activity.verb.date == undefined) ? "" : e.activity.verb.date;
		var detail = (e.activity.verb.detail == undefined) ? "" : e.activity.verb.detail;
		
		//Handle each verb differently
		switch(verb){
			
			case "rated": 
				return actor + " " + verb + " this " + generateAuthorSpan(date, actor);
				break;
				
			case "commented":
				return detail + " " + generateAuthorSpan(actor + " on " + date, actor);
				break;
		}
	};
	
	self.followOrganization = function(e){
		
		console.log(e);
		//return;
		
		/* Add jQuery/socket.io call here */
		/*$.post('/follow',JSON.stringify(e)).success(function(data){
			console.log(data);
		}).error(function(error){
			console.error(error);
		});*/
		self.followers.push({name:e, content:[]});
		
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
		
		//Doing this kind of check is a workaround for not being able to pass
		//currentResourceName directly. Not sure what that's about..
		if(typeof index != "string")
			index = self.currentResourceName();
		
		var arr = index.split("_");
		var switchArr;
		
		
		//Element is already in bookmarks.. remove from bookmarks
		switchArr = getProperArray(arr[2]);
		if(switchArr === "bookmarks"){
			
			
			//Removing element from bookmarks
			if(arr[0] == "-1"){
				var currentName = "-2_0_bookmarks";
				self.currentResourceName(currentName);

				self.currentObject(self.bookmarks()[arr[1]]);
				self.bookmarks.remove(self.bookmarks()[arr[1]]);
			}
			
			//Re-adding removed element back to bookmarks
			else{
				
				
				self.bookmarks.push(self.currentObject());
				
				var currentName = "-1_" + (self.bookmarks().length-1) + "_" + "bookmarks";
				self.currentResourceName(currentName);
			}
			
			console.log(self.bookmarks());
			console.log(currentName);
		}
		
		else{
			
			console.log(arr);
			//return;
			
			tempArr = switchArr()[arr[0]].content;
			
			/* Insert socket.io call here to add element to bookmarks, then check if successful */		
			
			//Assign this resource a publisher, add it to bookmarks, and update currentResourceName to reflect that
			tempArr()[arr[1]].publisher = switchArr()[arr[0]].name;
			self.bookmarks.push(tempArr()[arr[1]]);	
			self.currentResourceName("-1_" + (self.bookmarks().length-1) + "_" + "bookmarks");
			
			console.log(self.bookmarks().length);
			
			//If this is the last element, swap whole publisher element instead of simply removing sub-element resource
			if(tempArr().length == 1){
			
				swapResourceElement(switchArr, arr[0], numOfPreviewElements);
			}
			
			else tempArr.remove(tempArr()[arr[1]]);
		
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
		
		if(self.currentResourceName() == null)
			return false;
		
		var nameArr = self.currentResourceName().split("_");
		
		if(nameArr[0] == "-1" && nameArr[2] == "bookmarks")
			return true;
			
		return false;
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
	}
	
	/*
		Returns an array of resourceObjects
	*/
	self.getResourcesByUserName = function(user, resources){
		
		if(resources == undefined)
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
		if(poundSign == undefined)
			poundSign = "";
			
		return (poundSign + name).replace(/\s/g, "");
	};
};
