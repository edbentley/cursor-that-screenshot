// html elements
var downloadLink = document.getElementById("downloadLink");
var cursorButtons = document.getElementById("tools");

// canvases
var canvas = document.getElementById("paste_canvas");
var ctx = canvas.getContext("2d");
var canvasHidden = document.createElement('canvas'); // hidden canvas for full resolution download
var ctxHidden = canvasHidden.getContext("2d");

// global canvas images
var pastedImage = new Image();
var cursorImage = new Image();

// global cursor & zoom buttons
var cursor, minusZoom, plusZoom;

// global canvas objects
var canvasObjects = [];

// browser (feature) detection, see https://jsfiddle.net/9atsffau/
var isFirefox = typeof InstallTrigger !== 'undefined';
var isChrome = !!window.chrome && !!window.chrome.webstore;

function setup() {
	canvas.width = window.innerWidth * .95; // use full width of page
	canvas.height = window.innerHeight * .95 - 110; // use full height of page, plus space for link

	if (isFirefox || isChrome) {
		setInstructionStage(1); // UI
		pasteHandler(); // init pasting / dragging onto page
	} else {
		document.getElementById("initInstruction").innerHTML = "Sorry not supported by your browser (yet!)";
	}
}
setup();


// stage 1, paste image
function pasteHandler() {
	var pasteCatcher;
	var paste_mode;
	var ctrl_pressed = false;	

	// drag image from desktop
	document.addEventListener("drop", function( event ) {
		event.preventDefault(); // stop leaving page

		var screenshotFile = event.dataTransfer.files[0];
		if (screenshotFile) {			
			if (screenshotFile.type.match('image.*')) {
				var URLObj = window.URL || window.webkitURL;
				var source = URLObj.createObjectURL(screenshotFile);
				pasteImage(source);
			}
		}
    }, false);
    document.addEventListener("dragover", function( event ) {
		event.preventDefault();
    }, false);
    
	// paste catch
	pasteCatcher = document.createElement("div");
	pasteCatcher.setAttribute("id", "paste_ff");
	pasteCatcher.setAttribute("contenteditable", "");
	pasteCatcher.style.cssText = 'opacity:0;position:fixed;top:0px;left:0px;';
	pasteCatcher.style.marginLeft = "-20px";
	pasteCatcher.style.width = "10px";
	document.body.appendChild(pasteCatcher);
	document.getElementById('paste_ff').addEventListener('DOMSubtreeModified', function () {
		if (paste_mode == 'auto' || ctrl_pressed == false)
			return true;
		//if paste handle failed - capture pasted object manually
		if (pasteCatcher.children.length == 1) {
			if (pasteCatcher.firstElementChild.src != undefined) {
				pasteImage(pasteCatcher.firstElementChild.src);
			}
		}
		//register cleanup after some time.
		setTimeout(function () {
			pasteCatcher.innerHTML = '';
		}, 20);
	}, false);

	document.addEventListener('keydown', function (e) {
		on_keyboard_action(e);
	}, false); //firefox fix
	document.addEventListener('keyup', function (e) {
		on_keyboardup_action(e);
	}, false); //firefox fix
	on_keyboard_action = function (event) {
		var k = event.keyCode;
		//ctrl
		if (k == 17 || event.metaKey || event.ctrlKey) {
			if (ctrl_pressed == false)
				ctrl_pressed = true;
		}
		//c
		if (k == 86) {
			if (document.activeElement != undefined && document.activeElement.type == 'text')
				return false;
			if (ctrl_pressed == true && !window.Clipboard)
				pasteCatcher.focus();
		}
	};
	//on kaybord release
	on_keyboardup_action = function (event) {
		var k = event.keyCode;
		//ctrl
		if (k == 17 || event.metaKey || event.ctrlKey || event.key == 'Meta')
			ctrl_pressed = false;
	};
	document.addEventListener('paste', function(e){
		paste_mode = '';
		pasteCatcher.innerHTML = '';
		if (e.clipboardData) {
			var items = e.clipboardData.items;
			if (items) {
				paste_mode = 'auto';
				for (var i = 0; i < items.length; i++) {
					if (items[i].type.indexOf("image") !== -1) {
						var screenshotFile = items[i].getAsFile();
						var URLObj = window.URL || window.webkitURL;
						var source = URLObj.createObjectURL(screenshotFile);
						pasteImage(source);
					}
				}
				e.preventDefault();
			} // else wait for DOMSubtreeModified event
		}
	});

	//draw image on canvas
	function pasteImage(source) {
		// reset
		cursor = null;
		canvas.zoomed = false;
		canvas.x = 0;
		canvas.y = 0;

		pastedImage.onload = function () {
			canvasHidden.width = pastedImage.width;
			canvasHidden.height = pastedImage.height;

			// set canvas scale to pasted image and canvas size ratio
			canvas.scale = Math.min(1, canvas.height/pastedImage.height, canvas.width/pastedImage.width);
			canvas.minScale = canvas.scale;

			// scale back canvas if too big for pasted image
			canvas.width = Math.min(canvas.width, pastedImage.width*canvas.scale);
			canvas.height = Math.min(canvas.height, pastedImage.height*canvas.scale);

			// draw onto canvas for first time
			drawCanvas();

			setInstructionStage(2);
			cursorHandler(); // init cursor clicking on image
		};
		pastedImage.src = source;
	};
}

// stage 2, click cursor position
function cursorHandler() {
	
	var initClickListener = function(event) {
		var coords = Cursor.prototype.getMousePosition('image', event);

		// create new cursor & zoom buttons (global)
		cursor = new Cursor(cursorImage,coords.x,coords.y);
		minusZoom = new ZoomButton('-', canvas.width-50, canvas.height-95);
		plusZoom = new ZoomButton('+', canvas.width-50, canvas.height-140);
		minusZoom.zoom = zoom;
		plusZoom.zoom = zoom;

		canvasObjects = [cursor, minusZoom, plusZoom];

		drawCanvas();

		setInstructionStage(3, coords);

		canvas.onmousemove = mouseMove;
		canvas.onmousedown = mouseDown;
		document.onmouseup = mouseUp;

		canvas.onmouseleave=function(){document.body.style.cursor = "default";};  // reset cursor style if leave canvas

		document.addEventListener("wheel", zoom);
		document.addEventListener('keydown', zoom);

		// zoom functionality
		function zoom(event, symbol) {
			var canvasMidX = canvas.width/2+canvas.x; // scale from center
			var canvasMidY = canvas.height/2+canvas.y;
			var prevCanvasScale = canvas.scale;

			canvas.zoomed = true;

			if (event == null) { // button call
				if (symbol == '+') canvas.scale += 0.05;
				else canvas.scale -= 0.05;
			} else if (event.deltaY != null) { // using mouse scroll wheel
				canvas.scale -= event.deltaY / 5000;
				var coords = cursor.getMousePosition('image', event); // scale from cursor point
				canvasMidX = coords.x;
				canvasMidY = coords.y;
			} else if (event.key != null) { // keys				
				if (event.key == '=') {
					canvas.scale += 0.05;
				} else if (event.key == '-') {
					canvas.scale -= 0.05;
				}
			}
			canvas.scale = Math.min(Math.max(canvas.scale, canvas.minScale), 1);
			canvas.x -= canvasMidX*(canvas.scale/prevCanvasScale-1); 
			canvas.y -= canvasMidY*(canvas.scale/prevCanvasScale-1);
			canvas.x = Math.min(Math.max(canvas.x, (canvas.minScale-canvas.scale)*pastedImage.width), 0);
			canvas.y = Math.min(Math.max(canvas.y, (canvas.minScale-canvas.scale)*pastedImage.height), 0);
			drawCanvas();

			if (canvas.scale != canvas.minScale && event != null) {
				document.body.style.cursor = "-webkit-grab"; // update cursor if not pressing buttons
				document.body.style.cursor = "grab";
			}

			return false;
		}; 
	}  

	// load image
	cursorImage.onload = function() {
		// TO DO: indicate loading  
		canvas.onmousedown = initClickListener;
	};
	cursorImage.crossOrigin = "Anonymous";
	cursorImage.src = 'cursors/aero_arrow.png';
}
// canvas mouse moves
function mouseMove(event) {
	for (let obj of canvasObjects) obj.mouseMove.call(obj,event); // bind 'this'
}
function mouseUp(event) {
	for (let obj of canvasObjects) obj.mouseUp.call(obj, event); 
}
function mouseDown(event) {
	for (let obj of canvasObjects) obj.mouseDown.call(obj, event); 
}

// stage 3, adjust cursor
function button_click(image_name) {
	swapCursor(image_name);
}
function swapCursor(image_name) {
	cursor.imageName = image_name;
	cursorImage = new Image();
	cursorImage.onload = function() {
		cursor.image = cursorImage;
		cursor.width = cursorImage.width*cursor.scale;
		cursor.height = cursorImage.height*cursor.scale;

		drawCanvas();
	};
	cursorImage.src = 'cursors/'+image_name+'.png'; // change cursor image
}
function highlight(button) {
	button.style.borderColor="red";
}
function unhighlight(button) {
	button.style.borderColor="#000000";
}

// stage 4, download
function downloadHandler(){
	function download() {
		// download hidden canvas
		var dataURL = canvasHidden.toDataURL('image/jpeg');
		this.href = dataURL;
	};
	downloadLink.addEventListener('click', download, false);
}

function drawCanvas() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctxHidden.clearRect(0, 0, canvasHidden.width, canvasHidden.height);

	// scale dimensions, draw image
	ctx.drawImage(pastedImage, canvas.x, canvas.y, pastedImage.width * canvas.scale, pastedImage.height * canvas.scale);  
	ctxHidden.drawImage(pastedImage, 0, 0, pastedImage.width, pastedImage.height);

	if (cursor != null) { // if drawing canvas objects
		for (let obj of canvasObjects) obj.draw.call(obj); 

		drawHelp("Zoom: "+Math.round(canvas.scale*100)+"%", canvas.width-160, canvas.height-50, 150, 40);
	}
}

// handle instruction UI
function setInstructionStage(stage, coords) {
	if (stage == 1) {
		downloadLink.style.visibility = "hidden";
		cursorButtons.style.visibility = "hidden";
	} else if (stage == 2) {
		downloadLink.style.visibility = "hidden";
		cursorButtons.style.visibility = "hidden";
		document.getElementById("title").style.visibility = "hidden";
		document.getElementById("initInstruction").style.visibility = "hidden";
		drawHelp("Click to place cursor", canvas.width/2-100, canvas.height/2, 200, 40);
	} else if (stage == 3) {
		downloadLink.style.visibility = "visible";
		cursorButtons.style.visibility = "visible";
		downloadHandler(); // init download button

		// make sure canvas help is within canvas
		var helpX = Math.min(975, Math.max(10,coords.x*canvas.scale-200));
		var helpY = coords.y*canvas.scale+40;
		if (helpY > 650) {
			helpY -= 90;
			helpX = Math.min(770,helpX); // avoid collision
		}
		drawHelp("Adjust position, scale and type of cursor", helpX, helpY, 400, 40);
	}
}
function drawHelp(text, x, y, width, height) {
	ctx.font = "20px Arial";
	ctx.textAlign="center"; 
	ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
	ctx.fillRect(x,y,width,height); 
	ctx.fillStyle = "white";
	ctx.fillText(text,x+width/2,y+5+height/2,width-10);
}

// CANVAS OBJECTS (clickable)
var CanvasObject = function(x, y, width, height, padding) {
	this.x = x; // coords relative to image - in IMAGE SPACE
	this.y = y;
	this.width = width;
	this.height = height;
	this.padding = padding;
}
CanvasObject.prototype.getMousePosition = function(space, event) { // relative to canvas origin
	var rect = canvas.getBoundingClientRect();
	var canvasCornerX = event.clientX - rect.left;
	var canvasCornerY = event.clientY - rect.top;
	if (space == 'image') {
		canvasCornerX /= canvas.scale; // scale up to full image coordinates (IMAGE SPACE)
		canvasCornerY /= canvas.scale;
	} // else space == 'canvas'
	return {x:canvasCornerX, y:canvasCornerY}
}
CanvasObject.prototype.contains = function(coords, canvasOffset) {
    // returns if coords on object (square), does check in IMAGE SPACE
    var c_x = canvasOffset*canvas.x/canvas.scale + this.x;
    var c_y = canvasOffset*canvas.y/canvas.scale + this.y;
	if (coords.x > c_x-this.padding/canvas.scale && coords.x < c_x+this.width+this.padding/canvas.scale && 
		coords.y > c_y-this.padding/canvas.scale && coords.y < c_y+this.height+this.padding/canvas.scale) {

		return true;
	}
	return false;
};

// zoom buttons
var ZoomButton = function(symbol, x, y) {
	CanvasObject.call(this, x, y, 40, 40, 0);

	this.symbol = symbol;
	this.clicked = false;

	this.hovered = false;
	this.pressed = false;
}
ZoomButton.prototype = Object.create(CanvasObject.prototype); // inheritance
ZoomButton.prototype.draw = function() {
	ctx.font = "20px Arial";
	ctx.textAlign="center"; 
	ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
	if (this.pressed) ctx.fillStyle = "rgba(150, 150, 150, 0.5)";
	else if (this.hovered) ctx.fillStyle = "rgba(50, 50, 50, 0.5)";
	ctx.fillRect(this.x, this.y, this.width, this.height); 
	ctx.fillStyle = "white";
	ctx.fillText(this.symbol, this.x+this.width/2, this.y+5+this.height/2, this.width-10);
	// border
	ctx.lineWidth = 0.8;
	ctx.strokeStyle="#ffffff";
	ctx.strokeRect(this.x, this.y, this.width, this.height); 
}
ZoomButton.prototype.mouseMove = function(event) {
	var coords = this.getMousePosition('canvas', event);

	if (this.contains(coords, 0) && !cursor.dragging && !cursor.scaling) {
		document.body.style.cursor = "default";
		this.hovered = true;
		drawCanvas();
	} else if (this.hovered) {
		this.hovered = false;
		drawCanvas();
	}
};
ZoomButton.prototype.mouseUp = function(event) {
	if (this.hovered && this.pressed) {
		this.zoom(null, this.symbol);
		drawCanvas();
	}
	if (this.pressed) {
		this.pressed = false;
		drawCanvas();
	}
};
ZoomButton.prototype.mouseDown = function(event) {
	var coords = this.getMousePosition('canvas', event);

	if (this.contains(coords, 0)) {
		this.pressed = true;
		drawCanvas();
	}
};


// cursor object 
function Cursor(cursorImage, x, y) {
	this.image = cursorImage;
	this.scale = Math.min(1, 20/cursorImage.width); // 20px is default width for cursor

	CanvasObject.call(this, x, y, cursorImage.width*this.scale, cursorImage.height*this.scale, 5); // call super

	this.scaling = false;
	this.dragging = false;
	this.dragX;
	this.dragY;
	this.dragWidth;
	this.dragHeight;
	this.smallImage = false;
	this.imageName = "aero_arrow"; // default name

	this.r = 5; // radius of drag circle
}
Cursor.prototype = Object.create(CanvasObject.prototype); // inheritance
Cursor.prototype.draw = function() {
	var x_c = this.x*canvas.scale; // map to canvas domain
	var y_c = this.y*canvas.scale;
	var w_c = this.width*canvas.scale;
	var h_c = this.height*canvas.scale;

	ctx.drawImage(this.image, canvas.x+x_c, canvas.y+y_c, w_c, h_c); // draw scaled to canvas window
	// scale box
	ctx.lineWidth = 2;
	ctx.setLineDash([5, 5]);
	ctx.strokeStyle="#ffffff";
	ctx.strokeRect(canvas.x+x_c-this.padding,canvas.y+y_c-this.padding,w_c+this.padding*2,h_c+this.padding*2); 
	var lineArray = Array(1000).fill(5); // alternate dash line
	lineArray[0] = 0;
	ctx.setLineDash(lineArray);
	ctx.strokeStyle="#000000";
	ctx.strokeRect(canvas.x+x_c-this.padding,canvas.y+y_c-this.padding,w_c+this.padding*2,h_c+this.padding*2); 
	// drag point
	ctx.setLineDash([]);
	ctx.beginPath();
	ctx.arc(canvas.x+x_c+w_c+this.padding, canvas.y+y_c+h_c+this.padding, this.r, 0, 2*Math.PI);
	ctx.fillStyle = '#3399ff';
	ctx.fill();
	ctx.strokeStyle = '#003366';
	ctx.stroke();

	ctxHidden.drawImage(this.image, this.x, this.y, this.width, this.height); // draw full size
}
Cursor.prototype.dragContains = function(coords, radius) { // note, padding same in CANVAS scale so needs scaling
    // returns if coords on drag point, does check in IMAGE SPACE
	var cursorX = canvas.x/canvas.scale+this.x+this.width+this.padding/canvas.scale;
	var cursorY = canvas.y/canvas.scale+this.y+this.height+this.padding/canvas.scale;

	radius = this.r/canvas.scale; 
	if (coords.x > cursorX-radius && coords.x < cursorX+radius && coords.y > cursorY-radius && coords.y < cursorY+radius) { 
		return true;
	}
	return false;
};
Cursor.prototype.mouseMove = function(event) {
	var coords = this.getMousePosition('image', event);

	if (this.dragContains(coords) || this.scaling) {
		document.body.style.cursor = "nwse-resize";
	} else if (this.contains(coords, 1) && !this.dragging) {
		document.body.style.cursor = "move";
	} else if (!this.dragging) {
		if (canvas.scale != canvas.minScale) {
			if (canvas.dragging) {
				document.body.style.cursor = "-webkit-grabbing";
				document.body.style.cursor = "grabbing";
			} else {
				document.body.style.cursor = "-webkit-grab"; // add -moz-?
				document.body.style.cursor = "grab";
			}
		} else {
			document.body.style.cursor = "default";
		}
	}

	if (this.scaling) { // min size 0.3
		this.scale = Math.max(0.3, (coords.x-this.dragX+this.dragWidth) / this.image.width, (coords.y-this.dragY+this.dragHeight) / this.image.height);
		this.width = this.image.width*this.scale;
		this.height = this.image.height*this.scale;

		drawCanvas();
	} else if (this.dragging) {
		this.x = coords.x-this.dragX;
		this.y = coords.y-this.dragY;
		drawCanvas();
	} else if (canvas.dragging) { // drag canvas
		canvas.x = Math.min(Math.max(coords.x-canvas.dragX, (canvas.minScale-canvas.scale)*pastedImage.width), 0);
		canvas.y = Math.min(Math.max(coords.y-canvas.dragY, (canvas.minScale-canvas.scale)*pastedImage.height), 0);
		drawCanvas();
	}
}
Cursor.prototype.mouseDown = function(event) {
	var coords = this.getMousePosition('image', event);

	if (this.dragContains(coords)) {
		this.scaling = true;
		this.dragX = coords.x; // drag origin
		this.dragY = coords.y;
		this.dragWidth = this.width;
		this.dragHeight = this.height;
	} else if (this.contains(coords, 1)) {
		this.dragging = true;
		this.dragX = coords.x-this.x; // drag offset
		this.dragY = coords.y-this.y;
	} else if (canvas.scale > canvas.minScale) { // drag canvas
		canvas.dragging = true;
		canvas.dragX = coords.x-canvas.x; // drag origin
		canvas.dragY = coords.y-canvas.y;
	}
}
Cursor.prototype.mouseUp = function(event) {
	this.dragging = false;
	this.scaling = false;
	canvas.dragging = false;
}