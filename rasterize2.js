/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const INPUT_TRIANGLES_URL = "http://https://shreshth-malik.github.io/Frogger-3D/triangles2.json"; // triangles file loc
var defaultEye = vec3.fromValues(0.5,0.3,-0.5); // default eye position in world space
var defaultCenter = vec3.fromValues(0.5,0.5,0.5); // default view direction in world space
var defaultUp = vec3.fromValues(0,1,0); // default view up vector
var lightAmbient = vec3.fromValues(1,1,1); // default light ambient emission
var lightDiffuse = vec3.fromValues(1,1,1); // default light diffuse emission
var lightSpecular = vec3.fromValues(1,1,1); // default light specular emission
var lightPosition = vec3.fromValues(-0.5,1.5,-0.5); // default light position
var rotateTheta = Math.PI/50; // how much to rotate models by with each key press

/* webgl and geometry data */
var gl = null; // the all powerful gl object. It's all here folks!
var inputTriangles = []; // the triangle data as loaded from input files
var numTriangleSets = 0; // how many triangle sets in input scene
var inputEllipsoids = []; // the ellipsoid data as loaded from input files
var numEllipsoids = 0; // how many ellipsoids in the input scene
var vertexBuffers = []; // this contains vertex coordinate lists by set, in triples
var normalBuffers = []; // this contains normal component lists by set, in triples
var triSetSizes = []; // this contains the size of each triangle set
var triangleBuffers = []; // lists of indices into vertexBuffers by set, in triples
var viewDelta = 0.2; // how much to displace view with each key press

/* shader parameter locations */
var vPosAttribLoc; // where to put position for vertex shader
var vNormAttribLoc;
var u_alpha;
var mMatrixULoc; // where to put model matrix for vertex shader
var pvmMatrixULoc; // where to put project model view matrix for vertex shader
var ambientULoc; // where to put ambient reflecivity for fragment shader
var diffuseULoc; // where to put diffuse reflecivity for fragment shader
var specularULoc; // where to put specular reflecivity for fragment shader
var shininessULoc; // where to put specular exponent for fragment shader

/* interaction variables */
var Eye = vec3.clone(defaultEye); // eye position in world space
var Center = vec3.clone(defaultCenter); // view direction in world space
var Up = vec3.clone(defaultUp); // view up vector in world space

var frogs;
var homes;
var turtles;
var frogcount = 0;
var currFrog;
var lives = 3;
var score = 0;
var speedMultiplier = 1;
var frogJump = new Audio('frog_jump.mp3');
var win = new Audio('win.mp3');
var lose = new Audio('lose.mp3');
var under = [false, false, false, false, false, false, false, false];
var scoreDiv;
document.addEventListener("DOMContentLoaded", function() {
    scoreDiv = document.getElementById("scoreDiv");
    // Other initialization code can go here
});
var livesDiv;
document.addEventListener("DOMContentLoaded", function() {
    livesDiv = document.getElementById("livesDiv");
    // Other initialization code can go here
});
const newHomeColor = {
    "ambient": [0.0, 1.0, 0.0],
    "diffuse": [0.0, 1.0, 0.0],
    "specular": [0.0, 1.0, 0.0]
};
const initialHomeColor = {
    "ambient": [1.0, 0.5, 0.0], 
    "diffuse": [1.0, 0.6, 0.0], 
    "specular": [1.0, 0.3, 0.0]
};

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input json file

// does stuff when keys are pressed
function handleKeyDown(event) {

    function translateModel(offset) {
            vec3.add(currFrog.translation,currFrog.translation,offset);
    } // end translate model
    
    // set up needed view params
    var lookAt = vec3.create(), viewRight = vec3.create(), temp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt,vec3.subtract(temp,Center,Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight,vec3.cross(temp,lookAt,Up)); // get view right vector

    switch (event.code) {
        // view change
        case "ArrowRight": // translate left
            frogJump.play();
            translateModel(vec3.scale(temp,viewRight,viewDelta));
            break;
        case "ArrowLeft": // translate right
            frogJump.play();
            translateModel(vec3.scale(temp,viewRight,-viewDelta));
            break;
        case "ArrowUp": // translate up
            frogJump.play();
            translateModel(vec3.scale(temp,Up,viewDelta));
            score += 10;
            scoreDiv.innerHTML = "<h3>Score: " + score + "</h3>";
            break;
        case "ArrowDown": // translate down
            frogJump.play();
            translateModel(vec3.scale(temp,Up,-viewDelta));
            break;
        case "ShiftRight" && "Digit1": // Make you own - Speed Multiplier
            toggleSpeedInput(true);
            break;
    } // end switch
} // end handleKeyDown

function toggleSpeedInput(show) {
    var speedInputDiv = document.getElementById("speedInputDiv");
    speedInputDiv.style.display = show ? "block" : "none";
}

function setSpeedMultiplier() {
    speedMultiplier = document.getElementById("speedMultiplier").value;
    if (speedMultiplier > 1) {
      console.log("Speed Multiplier set to:", speedMultiplier);
    }
    toggleSpeedInput(false); // Hide the input field after setting the speed
}

function updateAndDisplayCoordinates(modelNumber) {

    var model = inputTriangles[modelNumber];

    // Assuming the model's center is the point of interest
    var modelCenter = vec3.clone(model.center); 
    vec3.add(modelCenter, modelCenter, model.translation); // Apply translation

    // Display the X and Y coordinates
    return[modelCenter[0],modelCenter[1]];
}

function moveObjects() {
    const startPosition = {
        forward: vec3.fromValues(-0.8, 0.0, -0.0),
        reverse: vec3.fromValues(0.8, 0.0, 0.0)
    };
    const cars = [
        { model: 6, speed: 0.02, bounds: 2.3, startPosition: startPosition.forward },
        { model: 7, speed: -0.01, bounds: -1.3, startPosition: startPosition.reverse },
        { model: 8, speed: 0.015, bounds: 2.3, startPosition: startPosition.forward },
        { model: 9, speed: 0.02, bounds: 2.3, startPosition: startPosition.forward },
        { model: 10, speed: -0.03, bounds: -1.5, startPosition: startPosition.reverse },
    ];

    cars.forEach(car => moveAndCheckBounds(car));

    function moveAndCheckBounds(car) {
        const viewRight = getViewRightDirection();
        translateCar(car.model, car.speed, viewRight);
        checkAndResetBounds(car.model, car.bounds, car.startPosition);
    }

    function translateCar(carModel, speed, direction){
        vec3.add(inputTriangles[carModel].translation, inputTriangles[carModel].translation, vec3.scale(vec3.create(), direction, -speed*speedMultiplier));
    }

    function checkAndResetBounds(carModel, bounds, startPosition){
        const position = updateAndDisplayCoordinates(carModel)[0];
        const isOutOfBounds = bounds < 0 ? position < bounds : position > bounds;
        if (isOutOfBounds) {
            vec3.copy(inputTriangles[carModel].translation, startPosition);
        }
    }

    function getViewRightDirection() {
        const lookAt = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), Center, Eye));
        return vec3.normalize(vec3.create(), vec3.cross(vec3.create(), lookAt, Up));
    }
}

function logMovement_waterCollision() {

    var onLog = false;
    const logs = [inputTriangles[9], inputTriangles[10]];
    for (let log of logs) {
        if (CheckCollision(currFrog, log, 0.2, 0.5)) {
            // Assuming logs move only in the x-direction
            onLog = true;
            currFrog.translation[0] += (log === inputTriangles[9]) ? 0.02*speedMultiplier : -0.03*speedMultiplier;
        }
    }
    if(CheckCollision(currFrog, inputTriangles[4], 1.1, 5))
    {
        //console.log("on water");
        //console.log(checkTurtleCollision());
        if (!onLog && !checkTurtleCollision()){
            frogDie();
            //console.log("Die");
        }
    }
}

function CheckCollision(currFrog, objectModel, objectHeight, objectWidth) {

    // This is a simple bounding box check
    var frogPosition = vec3.create();
    vec3.add(frogPosition, currFrog.center, currFrog.translation);
    var logXMin = objectModel.center[0] - objectWidth/2 + objectModel.translation[0];
    var logXMax = objectModel.center[0] + objectWidth/2 + objectModel.translation[0];
    var logYMin = objectModel.center[1] - objectHeight/2 + objectModel.translation[1];
    var logYMax = objectModel.center[1] + objectHeight/2 + objectModel.translation[1];
    if (frogPosition[0] >= logXMin && frogPosition[0] <= logXMax &&
        frogPosition[1] >= logYMin && frogPosition[1] <= logYMax) {
        return true; // Frog is on the log
    } else {
        return false; // Frog is not on the log
    }
}

function Respawn()
{
    //alert("True");
    vec3.copy(currFrog.translation, vec3.fromValues(0.0, 0.0, 0.0));
}

function checkCarCrash(){

    const cars = [inputTriangles[6], inputTriangles[7], inputTriangles[8]];
    cars.forEach(car => {
        if(CheckCollision(currFrog, car, 0.2, 0.5))
        {
            frogDie();
        }
    })
}

function checkTurtleCollision(){
    
    for(var i = 0; i < turtles.length; i++){
        //if(under[i])
        //{
            if(!under[i] && CheckCollision(currFrog, turtles[i], 0.20, 0.35))
                return true; 
        //}
    }
    return false;
}

function frogDie(){
    lose.play();
    lives--;
    livesDiv.innerHTML = "<h3>Lives: " + lives + "</h3>";
    Respawn();
}

function winConditions(){
    const newHomeColor = {
        "ambient": [0.0, 1.0, 0.0],
        "diffuse": [0.0, 1.0, 0.0],
        "specular": [0.0, 1.0, 0.0]
    };
    homes.forEach(home =>{
        //console.log(homes);
        if(CheckCollision(currFrog, home, 0.2, 0.2))
        {
            //console.log("inside")
            win.play();
            frogcount ++;
            home.material.ambient = newHomeColor.ambient;
            home.material.diffuse = newHomeColor.diffuse;
            home.material.specular = newHomeColor.specular;
            homes = homes.filter(function(item) {
                return item !== home;
            });
            console.log(frogcount);
            Respawn();
        }

    })
    if(homes.length == 0){
        showModal("You win!");
        newGame();
    }
    else if(lives == 0){
        showModal("You lose!");
        newGame();
    }
}

function closeModal() {
    document.getElementById("gameModal").classList.add("hidden");
}

function showModal(message) {
    //console.log("here");
    document.getElementById("gameMessage").textContent = message;
    document.getElementById("gameModal").classList.remove("hidden");
}

function newGame(){
    score = 0;
    scoreDiv.innerHTML = "<h3>Score: " + score + "</h3>";
    lives = 3;
    livesDiv.innerHTML = "<h3>Lives: " + lives + "</h3>";
    frogcount = 0;
    inputTriangles.forEach(triangle => {
        triangle.translation = vec3.fromValues(0.0,0.0,0.0);
    });
    // Set initial game objects
    homes = [inputTriangles[15], inputTriangles[16], inputTriangles[17], inputTriangles[18], inputTriangles[19]];
    currFrog = inputTriangles[0];
    homes.forEach(home =>{
        home.material.ambient = initialHomeColor.ambient;
        home.material.diffuse = initialHomeColor.diffuse;
        home.material.specular = initialHomeColor.specular;
    })
}

function sinkTurtles() {
    var temp = vec3.fromValues(0.0, 0.0, 1.5);
    //console.log(turtles);
    for(var i = 0; i < turtles.length; i++) {
        //console.log("here");
        if(!under[i]) {
            vec3.add(turtles[i].translation,turtles[i].translation,temp);
            under[i] = true;
        }
    }
    setTimeout(raiseTurtles, 700);
}

function raiseTurtles() {
    var temp = vec3.fromValues(0.0, 0.0, -1.5);
    for(var i = 0; i < turtles.length; i++) {
        if(under[i]) {
            vec3.add(turtles[i].translation,turtles[i].translation,temp);
            under[i] = false;
        }
    }
}

// set up the webGL environment
function setupWebGL() {
    // Set up keys
    document.onkeydown = handleKeyDown; // call this when key pressed
     // create a webgl canvas and set it up
     var webGLCanvas = document.getElementById("myWebGLCanvas"); // create a webgl canvas
     gl = webGLCanvas.getContext("webgl"); // get a webgl object from it
     try {
       if (gl == null) {
         throw "unable to create gl context -- is your browser gl ready?";
       } else {
        gl.clearColor(1.0, 1.0, 1.0, 1.0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
       }
     } // end try
     
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read models in
function loadModels() {
    
    inputTriangles =  getJSONFile(INPUT_TRIANGLES_URL,"triangles"); // read in the triangle data

    try {
        if (inputTriangles == String.null)
            throw "Unable to load triangles file!";
        else {
            var whichSetVert; // index of vertex in current triangle set
            var whichSetTri; // index of triangle in current triangle set
            var vtxToAdd; // vtx coords to add to the coord array
            var normToAdd; // vtx normal to add to the coord array
            var triToAdd; // tri indices to add to the index array
            var maxCorner = vec3.fromValues(Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE); // bbox corner
            var minCorner = vec3.fromValues(Number.MAX_VALUE,Number.MAX_VALUE,Number.MAX_VALUE); // other corner
        
            numTriangleSets = inputTriangles.length; // num of triangle sets
            for (var whichSet=0; whichSet<numTriangleSets; whichSet++) { // for each tri set
                
                inputTriangles[whichSet].center = vec3.fromValues(0,0,0);  // center point of tri set
                inputTriangles[whichSet].translation = vec3.fromValues(0,0,0); // no translation
                inputTriangles[whichSet].xAxis = vec3.fromValues(1,0,0); // model X axis
                inputTriangles[whichSet].yAxis = vec3.fromValues(0,1,0); // model Y axis

                inputTriangles[whichSet].glVertices = []; // flat coord list for webgl
                inputTriangles[whichSet].glNormals = []; // flat normal list for webgl

                var numVerts = inputTriangles[whichSet].vertices.length; // num vertices in tri set
                for (whichSetVert=0; whichSetVert<numVerts; whichSetVert++) { // verts in set
                    vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert]; // get vertex to add
                    normToAdd = inputTriangles[whichSet].normals[whichSetVert]; // get normal to add
                    inputTriangles[whichSet].glVertices.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]); // put coords in set coord list
                    inputTriangles[whichSet].glNormals.push(normToAdd[0],normToAdd[1],normToAdd[2]); // put normal in set coord list
                    vec3.max(maxCorner,maxCorner,vtxToAdd); // update world bounding box corner maxima
                    vec3.min(minCorner,minCorner,vtxToAdd); // update world bounding box corner minima
                    vec3.add(inputTriangles[whichSet].center,inputTriangles[whichSet].center,vtxToAdd); // add to ctr sum
                } // end for vertices in set
                vec3.scale(inputTriangles[whichSet].center,inputTriangles[whichSet].center,1/numVerts); // avg ctr sum

                // send the vertex coords and normals to webGL
                vertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glVertices),gl.STATIC_DRAW); // data in
                
                normalBuffers[whichSet] = gl.createBuffer(); // init empty webgl set normal component buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glNormals),gl.STATIC_DRAW); // data in

                // set up the triangle index array, adjusting indices across sets
                inputTriangles[whichSet].glTriangles = []; // flat index list for webgl
                triSetSizes[whichSet] = inputTriangles[whichSet].triangles.length; // number of tris in this set
                for (whichSetTri=0; whichSetTri<triSetSizes[whichSet]; whichSetTri++) {
                    triToAdd = inputTriangles[whichSet].triangles[whichSetTri]; // get tri to add
                    inputTriangles[whichSet].glTriangles.push(triToAdd[0],triToAdd[1],triToAdd[2]); // put indices in set list
                } // end for triangles in set

                // send the triangle indices to webGL
                triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(inputTriangles[whichSet].glTriangles),gl.STATIC_DRAW); // data in

            } // end for each triangle set 
        	var temp = vec3.create();
        } // end if triangle file loaded
            frogs = [inputTriangles[0], inputTriangles[11], inputTriangles[12], inputTriangles[13], inputTriangles[14]];
            homes = [inputTriangles[15], inputTriangles[16], inputTriangles[17], inputTriangles[18], inputTriangles[19]];
            turtles = [inputTriangles[20], inputTriangles[21], inputTriangles[22], inputTriangles[23], inputTriangles[24], inputTriangles[25], inputTriangles[26], inputTriangles[27]];
            currFrog = inputTriangles[frogcount];
    } // end try 
    	
    catch(e) {
        console.log(e);
    } // end catch
} // end load model

function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const shaderType = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
        throw `Error during ${shaderType} shader compile: ${gl.getShaderInfoLog(shader)}`;
    }

    return shader;
}

function linkShaderProgram(vertexShader, fragmentShader) {
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        throw `Error during shader program linking: ${gl.getProgramInfoLog(shaderProgram)}`;
    }

    return shaderProgram;
}

function setupAttributePointers(shaderProgram) {
    vPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(vPosAttribLoc);

    vNormAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(vNormAttribLoc);
}

function setLocations(shaderProgram) {
    mMatrixULoc = gl.getUniformLocation(shaderProgram, "umMatrix");
    pvmMatrixULoc = gl.getUniformLocation(shaderProgram, "upvmMatrix");

    ambientULoc = gl.getUniformLocation(shaderProgram, "uAmbient");
    diffuseULoc = gl.getUniformLocation(shaderProgram, "uDiffuse");
    specularULoc = gl.getUniformLocation(shaderProgram, "uSpecular");
    shininessULoc = gl.getUniformLocation(shaderProgram, "uShininess");

    u_alpha = gl.getUniformLocation(shaderProgram, "alpha_val");
    var eyePositionULoc = gl.getUniformLocation(shaderProgram, "uEyePosition"); // ptr to eye position
    var lightAmbientULoc = gl.getUniformLocation(shaderProgram, "uLightAmbient"); // ptr to light ambient
    var lightDiffuseULoc = gl.getUniformLocation(shaderProgram, "uLightDiffuse"); // ptr to light diffuse
    var lightSpecularULoc = gl.getUniformLocation(shaderProgram, "uLightSpecular"); // ptr to light specular
    var lightPositionULoc = gl.getUniformLocation(shaderProgram, "uLightPosition"); // ptr to light position

    gl.uniform3fv(eyePositionULoc, Eye);
    gl.uniform3fv(lightAmbientULoc, lightAmbient);
    gl.uniform3fv(lightDiffuseULoc, lightDiffuse);
    gl.uniform3fv(lightSpecularULoc, lightSpecular);
    gl.uniform3fv(lightPositionULoc, lightPosition);
}

// setup the webGL shaders
function setupShaders() {
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 aVertexPosition; // vertex position
        attribute vec3 aVertexNormal; // vertex normal
        
        uniform mat4 umMatrix; // the model matrix
        uniform mat4 upvmMatrix; // the project view model matrix
        
        varying vec3 vWorldPos; // interpolated world position of vertex
        varying vec3 vVertexNormal; // interpolated normal for frag shader

        void main(void) {
            
            // vertex position
            vec4 vWorldPos4 = umMatrix * vec4(aVertexPosition, 1.0);
            vWorldPos = vec3(vWorldPos4.x,vWorldPos4.y,vWorldPos4.z);
            gl_Position = upvmMatrix * vec4(aVertexPosition, 1.0);

            // vertex normal (assume no non-uniform scale)
            vec4 vWorldNormal4 = umMatrix * vec4(aVertexNormal, 0.0);
            vVertexNormal = normalize(vec3(vWorldNormal4.x,vWorldNormal4.y,vWorldNormal4.z)); 
        }
    `;
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float; // set float to medium precision

        // eye location
        uniform vec3 uEyePosition; // the eye's position in world
        
        // light properties
        uniform vec3 uLightAmbient; // the light's ambient color
        uniform vec3 uLightDiffuse; // the light's diffuse color
        uniform vec3 uLightSpecular; // the light's specular color
        uniform vec3 uLightPosition; // the light's position
        
        // material properties
        uniform vec3 uAmbient; // the ambient reflectivity
        uniform vec3 uDiffuse; // the diffuse reflectivity
        uniform vec3 uSpecular; // the specular reflectivity
        uniform float uShininess; // the specular exponent

        // geometry properties
        varying vec3 vWorldPos; // world xyz of fragment
        varying vec3 vVertexNormal; // normal of fragment
    
        void main(void) {
        
            // ambient term
            vec3 ambient = uAmbient*uLightAmbient; 
            
            // diffuse term
            vec3 normal = normalize(vVertexNormal); 
            vec3 light = normalize(uLightPosition - vWorldPos);
            float lambert = max(0.0,dot(normal,light));
            vec3 diffuse = uDiffuse*uLightDiffuse*lambert; // diffuse term
            
            // specular term
            vec3 eye = normalize(uEyePosition - vWorldPos);
            vec3 halfVec = normalize(light+eye);
            float ndotLight = 2.0*dot(normal, light);
            vec3 reflectVec = normalize(ndotLight*normal - light);
            float highlight = 0.0;
            highlight = pow(max(0.0,dot(normal,halfVec)),uShininess);

            vec3 specular = uSpecular*uLightSpecular*highlight; // specular term
            
            // combine to output color
            vec3 colorOut = ambient + diffuse + specular; // no specular yet
            gl_FragColor = vec4(colorOut, 1.0);

        }
    `;
    
    try {
        const vertexShader = compileShader(gl.VERTEX_SHADER, vShaderCode);
        const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fShaderCode);

        const shaderProgram = linkShaderProgram(vertexShader, fragmentShader);

        gl.useProgram(shaderProgram);

        setupAttributePointers(shaderProgram);
        setLocations(shaderProgram);
        setGlobalUniforms();

        gl.useProgram(null);

    } catch (error) {
        console.log(error);
    }
}
// render the loaded model
function renderModels() {
    
    // construct the model transform matrix, based on model state
    function makeModelTransform(currModel) {
        var zAxis = vec3.create(), sumRotation = mat4.create(), temp = mat4.create(), negCtr = vec3.create();

        // move the model to the origin
        mat4.fromTranslation(mMatrix,vec3.negate(negCtr,currModel.center)); 
        
        // scale for highlighting if needed
        if (currModel.on)
            mat4.multiply(mMatrix,mat4.fromScaling(temp,vec3.fromValues(1.2,1.2,1.2)),mMatrix); // S(1.2) * T(-ctr)
        
        // rotate the model to current interactive orientation
        vec3.normalize(zAxis,vec3.cross(zAxis,currModel.xAxis,currModel.yAxis)); // get the new model z axis
        mat4.set(sumRotation, // get the composite rotation
            currModel.xAxis[0], currModel.yAxis[0], zAxis[0], 0,
            currModel.xAxis[1], currModel.yAxis[1], zAxis[1], 0,
            currModel.xAxis[2], currModel.yAxis[2], zAxis[2], 0,
            0, 0,  0, 1);
        mat4.multiply(mMatrix,sumRotation,mMatrix); // R(ax) * S(1.2) * T(-ctr)
        
        // translate back to model center
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.center),mMatrix); // T(ctr) * R(ax) * S(1.2) * T(-ctr)

        // translate model to current interactive orientation
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.translation),mMatrix); // T(pos)*T(ctr)*R(ax)*S(1.2)*T(-ctr)
        
    } // end make model transform
    var currSet; // the tri set and its material properties
    function draw_tri (whichTriSet) {
		// make model transform, add to view project
		currSet = inputTriangles[whichTriSet];
		makeModelTransform(currSet);
        mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // project * view * model
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix
        
        // reflectivity: feed to the fragment shader
        gl.uniform3fv(ambientULoc,currSet.material.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc,currSet.material.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc,currSet.material.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc,currSet.material.n); // pass in the specular exponent

        // vertex buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
        
        gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed

        gl.uniform1f(u_alpha, inputTriangles[whichTriSet].material.alpha);

		// Activate and render buffer
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[whichTriSet]); // activate
	    gl.drawElements(gl.TRIANGLES,3*triSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
	}
    
    var pMatrix = mat4.create(); // projection matrix
    var vMatrix = mat4.create(); // view matrix
    var mMatrix = mat4.create(); // model matrix
    var pvMatrix = mat4.create(); // hand * proj * view matrices
    var pvmMatrix = mat4.create(); // hand * proj * view * model matrices(
    
    moveObjects();
    logMovement_waterCollision();
    checkCarCrash();
    winConditions();
    checkTurtleCollision();

    window.requestAnimationFrame(renderModels); // set up frame render callback
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear buffers
    
    mat4.perspective(pMatrix,0.5*Math.PI,1,0.1,10); // create projection matrix
    mat4.lookAt(vMatrix,Eye,Center,Up); // create view matrix
    mat4.multiply(pvMatrix,pvMatrix,pMatrix); // projection
    mat4.multiply(pvMatrix,pvMatrix,vMatrix); // projection * view
    
    var transparent_triangles = [];
    for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
        if(inputTriangles[whichTriSet].material.alpha == 1){
        	gl.depthMask(true);
        	gl.disable(gl.BLEND);
        	draw_tri(whichTriSet);
        }
        else{
        	transparent_triangles.push(whichTriSet);
        }
    } // end for each triangle set

    //Improve transparency correctness with a partial sort (Extra Credit)
    var tri_depth_whichset = new Map();
    var tri_depths = [];


    for(let i = 0, length1 = transparent_triangles.length; i < length1; i++){

        tri_center = inputTriangles[transparent_triangles[i]].center[2];
        trans = inputTriangles[transparent_triangles[i]].translation[2];
    	z_val = tri_center + trans;
    	if (tri_depth_whichset.has(z_val))
    		tri_depth_whichset[z_val].push(transparent_triangles[i]);
    	
    	else{
    		tri_depth_whichset[z_val] = [];
    		tri_depth_whichset[z_val].push(transparent_triangles[i]);
    	}
    	tri_depths.push(z_val);
    }

    tri_depths.sort();
    tri_depths.reverse();
    
    for(let i = 0, length1 = tri_depths.length; i < length1; i++){
    	gl.depthMask(false);
    	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND);
        depth = tri_depths[i]
        for (tri_set in tri_depth_whichset[depth]) {
        	draw_tri(transparent_triangles[i]);
        }
    }  
} // end render model

/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  loadModels(); // load in the models from tri file
  setupShaders(); // setup the webGL shaders
  setInterval(sinkTurtles, 4000);
  renderModels(); // draw the triangles using webGL
  
}
