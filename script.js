/*
TO DO: 
- cursor img fill
- OS X cursors
- Chrome canvas security error: http://stackoverflow.com/questions/20424279/canvas-todataurl-securityerror
- IE/Safari support
- other browser 'error'
- canvas on single line (html/css)
- file name


Three stages:
Stage 1: Paste image onto page
Stage 2: Click approx pointer position
Stage 3: Adjust pointer position, size and type
Stage 4: Download screenshot (button)
*/
var downloadLink = document.getElementById("downloadLink");
var cursorButtons = document.getElementById("tools");
var instructionText = document.getElementById("instructions");
var canvas = document.getElementById("paste_canvas");
var ctx = canvas.getContext("2d");
var canvasScale; // <= 1 (pasted image size)
var minCanvasScale;
var canvasX, canvasY, canvasZoomed, canvasDragX, canvasDragY;
var canvasDragging = false;
// global canvas images
var pastedImage = new Image();
var cursorImage = new Image();
// hidden canvas for full resolution download
var canvasHidden = document.createElement('canvas');
var ctxHidden = canvasHidden.getContext("2d");
// global cursor
var cursor;

function setup() {
  canvas.width = window.innerWidth * .95; // use full width of page
  canvas.height = window.innerHeight * .95 - 110; // use full height of page, plus space for link

  setInstructionStage(1); // UI
  pasteHandler(); // init pasting / dragging onto page
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
		canvasZoomed = false;
		canvasX = 0;
		canvasY = 0;

		pastedImage.onload = function () {
			canvasHidden.width = pastedImage.width;
			canvasHidden.height = pastedImage.height;

			// set canvas scale to pasted image and canvas size ratio
			canvasScale = Math.min(1, canvas.height/pastedImage.height, canvas.width/pastedImage.width);
			minCanvasScale = canvasScale;

			// scale back canvas if too big for pasted image
			canvas.width = Math.min(canvas.width, pastedImage.width*canvasScale);
			canvas.height = Math.min(canvas.height, pastedImage.height*canvasScale);

			// draw onto canvas for first time
			drawCanvas();

			setInstructionStage(2);
			cursorHandler(); // init cursor clicking on image
		};
		//pastedImage.setAttribute('crossOrigin', 'anonymous');
		pastedImage.src = source;
	};
}

// stage 2, click cursor position
function cursorHandler() {
	
	var initClickListener = function(event) {
		var coords = Cursor.prototype.getMousePosition('image', event);

		// create new cursor (global)
		cursor = new Cursor(cursorImage,coords.x,coords.y);

		drawCanvas();

		setInstructionStage(3, coords);

		canvas.onmousemove = cursor.mouseMove.bind(cursor); // bind 'this'
		canvas.onmousedown = cursor.mouseDown.bind(cursor);
		document.onmouseup = cursor.mouseUp.bind(cursor);
		canvas.onmouseleave=function(){document.body.style.cursor = "default";};  // reset cursor style if leave canvas

		document.addEventListener("wheel", zoom);
		document.addEventListener('keydown', zoom);

		// zoom functionality
		function zoom(event) {
			var canvasMidX = canvas.width/2+canvasX; // scale from center
			var canvasMidY = canvas.height/2+canvasY;
			var prevCanvasScale = canvasScale;

			canvasZoomed = true;

			if (event.deltaY != null) { // using mouse scroll wheel
				canvasScale -= event.deltaY / 5000;
				var coords = cursor.getMousePosition('image', event); // scale from cursor point
				canvasMidX = coords.x;
				canvasMidY = coords.y;
			} else { // keys				
				if (event.key == 'm') {
					canvasScale += 0.05;
				} else if (event.key == 'n') {
					canvasScale -= 0.05;
				}
			}
			canvasScale = Math.min(Math.max(canvasScale, minCanvasScale), 1);
			canvasX -= canvasMidX*(canvasScale/prevCanvasScale-1); 
			canvasY -= canvasMidY*(canvasScale/prevCanvasScale-1);
			canvasX = Math.min(Math.max(canvasX, (minCanvasScale-canvasScale)*pastedImage.width), 0);
			canvasY = Math.min(Math.max(canvasY, (minCanvasScale-canvasScale)*pastedImage.height), 0);
			drawCanvas();

			if (canvasScale != minCanvasScale) {
				document.body.style.cursor = "-webkit-grab"; // update cursor
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

// stage 3, adjust cursor
function button_click(image) {
	cursorImage = new Image();
	cursorImage.onload = function() {
		cursor.image = cursorImage;
		cursor.width = cursorImage.width*cursor.scale;
		cursor.height = cursorImage.height*cursor.scale;

		drawCanvas();
	};
	cursorImage.src = 'cursors/'+image; // change cursor image
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
	ctx.drawImage(pastedImage, canvasX, canvasY, pastedImage.width * canvasScale, pastedImage.height * canvasScale);  
	ctxHidden.drawImage(pastedImage, 0, 0, pastedImage.width, pastedImage.height);

	if (cursor != null) { // if drawing cursor
		cursor.draw();
		drawHelp("Zoom: "+Math.round(canvasScale*100)+"%", canvas.width-160, canvas.height-50, 150, 40);
		if (!canvasZoomed) {
			drawHelp("M: zoom in, N: zoom out", canvas.width-260, canvas.height-100, 250, 40);
		}
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
		var helpX = Math.min(975, Math.max(10,coords.x*canvasScale-200));
		var helpY = coords.y*canvasScale+40;
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

// canvas dragging
function canvasMouseMove(cursor, coords) {
	canvasX = Math.min(Math.max(coords.x-canvasDragX, (minCanvasScale-canvasScale)*pastedImage.width), 0);
	canvasY = Math.min(Math.max(coords.y-canvasDragY, (minCanvasScale-canvasScale)*pastedImage.height), 0);
	drawCanvas();
}

// cursor object 
function Cursor(cursorImage, x, y) {
	this.x = x; // coords relative to image - in IMAGE SPACE
	this.y = y;
	this.image = cursorImage;
	this.scale = Math.min(1, 20/cursorImage.width); // 20px is default width for cursor
	this.width = cursorImage.width*this.scale;
	this.height = cursorImage.height*this.scale;

	this.scaling = false;
	this.dragging = false;
	this.dragX;
	this.dragY;
	this.dragWidth;
	this.dragHeight;

	this.r = 5; // radius of drag circle
}
Cursor.prototype.draw = function() {
	ctx.drawImage(this.image, canvasX+this.x*canvasScale, canvasY+this.y*canvasScale, this.width*canvasScale, this.height*canvasScale); // draw scaled to canvas window
	// scale box
	ctx.lineWidth = 2;
	ctx.setLineDash([5, 5]);
	ctx.strokeStyle="#ffffff";
	ctx.strokeRect(canvasX+this.x*canvasScale-5,canvasY+this.y*canvasScale-5,this.width*canvasScale+10,this.height*canvasScale+10); 
	var lineArray = Array(100).fill(5); // alternate dash line
	lineArray[0] = 0;
	ctx.setLineDash(lineArray);
	ctx.strokeStyle="#000000";
	ctx.strokeRect(canvasX+this.x*canvasScale-5,canvasY+this.y*canvasScale-5,this.width*canvasScale+10,this.height*canvasScale+10); 
	// drag point
	ctx.setLineDash([]);
	ctx.beginPath();
	ctx.arc(canvasX+this.x*canvasScale+this.width*canvasScale+5, canvasY+this.y*canvasScale+this.height*canvasScale+5, this.r, 0, 2*Math.PI);
	ctx.fillStyle = '#3399ff';
	ctx.fill();
	ctx.strokeStyle = '#003366';
	ctx.stroke();

	ctxHidden.drawImage(this.image, this.x, this.y, this.width, this.height); // draw full size
}
Cursor.prototype.getMousePosition = function(space, event) { // relative to canvas origin
	var rect = canvas.getBoundingClientRect();
	var canvasCornerX = event.clientX - rect.left;
	var canvasCornerY = event.clientY - rect.top;
	if (space == 'image') {
		canvasCornerX /= canvasScale; // scale up to full image coordinates (IMAGE SPACE)
		canvasCornerY /= canvasScale;
	} // else space == 'canvas'
	return {x:canvasCornerX, y:canvasCornerY}
}
Cursor.prototype.contains = function(coords, offset) {
	// returns if coords on player, does check in IMAGE SPACE
	if (coords.x > canvasX/canvasScale+this.x-offset && coords.x < canvasX/canvasScale+this.x+this.width+offset*2 && 
		coords.y > canvasY/canvasScale+this.y-offset && coords.y < canvasY/canvasScale+this.y+this.height+offset*2) {
		return true;
	}
	return false;
}
Cursor.prototype.containsDrag = function(coords) {
	// returns if coords on player's drag point,
	var cursorX = canvasX/canvasScale+this.x+this.width+ 7.5/canvasScale; // scale up point radius/offset. should be 5, but 7.5 works better (?)
	var cursorY = canvasY/canvasScale+this.y+this.height+ 7.5/canvasScale;
	var radius = this.r/canvasScale;
	if (coords.x > cursorX-radius && coords.x < cursorX+radius && coords.y > cursorY-radius && coords.y < cursorY+radius) { 
		return true;
	}
	return false;
}
Cursor.prototype.mouseMove = function(event) {
	var coords = this.getMousePosition('image', event);

	if (this.containsDrag(coords) || this.scaling) {
		document.body.style.cursor = "nwse-resize";
	} else if (this.contains(coords,5) && !this.dragging) {
		document.body.style.cursor = "move";
	} else if (!this.dragging) {
		if (canvasScale != minCanvasScale) {
			if (canvasDragging) {
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

	if (this.scaling) {
		this.scale = Math.min(1, (coords.x-this.dragX+this.dragWidth) / this.image.width, (coords.y-this.dragY+this.dragHeight) / this.image.height);
		this.scale = Math.max(0.1,this.scale); // min size 0.1
		this.width = this.image.width*this.scale;
		this.height = this.image.height*this.scale;
		drawCanvas(this);
	} else if (this.dragging) {
		this.x = coords.x-this.dragX;
		this.y = coords.y-this.dragY;
		drawCanvas(this);
	} else if (canvasDragging) { // drag canvas
		canvasMouseMove(this, coords);
	}
}
Cursor.prototype.mouseDown = function(event) {
	var coords = this.getMousePosition('image', event);

	if (this.containsDrag(coords)) {
		this.scaling = true;
		this.dragX = coords.x; // drag origin
		this.dragY = coords.y;
		this.dragWidth = this.width;
		this.dragHeight = this.height;
	} else if (this.contains(coords,5)) {
		this.dragging = true;
		this.dragX = coords.x-this.x; // drag offset
		this.dragY = coords.y-this.y;
	} else if (canvasScale > minCanvasScale) { // drag canvas
		canvasDragging = true;
		canvasDragX = coords.x-canvasX; // drag origin
		canvasDragY = coords.y-canvasY;
	}
}
Cursor.prototype.mouseUp = function(event) {
	this.dragging = false;
	this.scaling = false;
	canvasDragging = false;
}