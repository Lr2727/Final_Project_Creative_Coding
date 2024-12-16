// Main variables and settings
let audio;            // p5.Sound object for audio playback
let fft;              // p5.FFT object for audio frequency analysis
let audioStarted = false; // Flag to track if audio has started playing
let theShader;        // p5.Shader object for rendering the scene

// Arrays to store objects triggered by audio events
let shapes = [];      // Child shapes spawned on bass spikes (sphere objects)
let sparkOrbs = [];   // Spark orbs spawned on treble spikes (torus objects)

// Scene transformation variables for interactivity
let angleX = 0;       // Rotation around X-axis
let angleY = 0;       // Rotation around Y-axis
let zoomFactor = 1.0; // Zoom level, 1.0 = normal zoom

// Variables to track mouse interaction
let isDragging = false;    // Whether user is dragging with left mouse button
let lastMouseX, lastMouseY; // Previous mouse positions for dragging calculation

function preload() {
  // Load the audio file before setup
  // Replace 'audio1.mp3' with your own audio file if desired
  audio = loadSound('audio1.mp3'); 
}

// Vertex Shader
// - Applies per-object transformations and audio-based distortions on vertices
// - Uses u_seed and u_offset for unique transformations per object
const vertShader = `
precision mediump float;

attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uProjectionMatrix;
uniform mat4 uModelViewMatrix;

uniform float u_time;    // Current time
uniform float u_bass;    // Normalized bass energy (0.0-1.0)
uniform float u_mid;     // Normalized mid frequency energy
uniform float u_treble;  // Normalized treble frequency energy
uniform float u_avgAmp;  // Average amplitude from waveform
uniform float u_seed;    // Seed for per-object variation
uniform vec3 u_offset;   // Position offset for each object

float phaseFactor(float t) {
    // Produces a factor that oscillates between 0 and 1 slowly
    return 0.5 + 0.5*sin(t*0.2);
}

varying vec3 vPos; // Pass modified position to fragment shader

void main() {
  // Start from original position plus object-specific offset
  vec3 pos = aPosition + u_offset; 

  // Compute a "breathing" factor influenced by bass and avgAmp,
  // making the geometry subtly expand and contract
  float phase = phaseFactor(u_time);
  float breathe = (u_bass * 0.3 + u_avgAmp * 0.5) * sin(u_time * 2.5) * 0.5;

  // complexity factor adjusts distortion complexity based on mid, seed, and time phase
  float complexity = 3.0 + (u_mid * 20.0 + 20.0 * phase + u_seed * 10.0);
  float trebleFactor = (u_treble + phase) * 0.8;

  // distFactor is used to distort the vertices in complex ways based on audio and position
  float distFactor = sin(dot(aNormal, pos)*complexity + u_time*3.0)*(u_avgAmp + u_bass*0.5);
  distFactor += cos((pos.x+pos.y+pos.z)*30.0 + u_time*5.0)*trebleFactor;
  distFactor += sin((pos.x*pos.y*pos.z)*50.0 + u_time*10.0)*u_mid*0.5;

  // Apply breathing scale to the position
  float scale = 1.0 + breathe;
  pos *= scale;

  // Angular distortion: twist the object based on angle and audio
  float angle = atan(pos.y, pos.x);
  float radius = length(pos.xy);
  float angularDistort = sin(angle*5.0 + u_time)*0.3*phase*trebleFactor;
  pos += normalize(pos)*angularDistort*radius*0.5;

  // Additional distortion along the vertex normal using distFactor
  pos += aNormal * distFactor * (0.4 + phase);

  // Pass final vertex position to fragment shader
  vPos = pos;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(pos,1.0);
}
`;

// Fragment Shader
// - Produces a trippy kaleidoscopic fractal pattern influenced by audio
// - Uses hue cycling, swirl patterns, and subtle overlays
const fragShader = `
precision mediump float;

uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_avgAmp;
uniform vec2 u_resolution;

varying vec3 vPos; // Vertex position from vertex shader

// Convert HSL to RGB for smooth, continuous color cycling
vec3 hsl2rgb(vec3 hsl) {
  float h=hsl.x; float s=hsl.y; float l=hsl.z;
  float c=(1.0 - abs(2.0*l - 1.0))*s;
  float x=c*(1.0 - abs(mod(h*6.0,2.0)-1.0));
  float m=l-c/2.0;
  vec3 rgb=vec3(0.0);
  if(h<1.0/6.0) rgb=vec3(c,x,0);
  else if(h<2.0/6.0) rgb=vec3(x,c,0);
  else if(h<3.0/6.0) rgb=vec3(0,c,x);
  else if(h<4.0/6.0) rgb=vec3(0,x,c);
  else if(h<5.0/6.0) rgb=vec3(x,0,c);
  else rgb=vec3(c,0,x);
  return rgb+m;
}

// Kaleidoscope function to create symmetrical patterns
vec2 kaleido(vec2 st, float segments) {
  float angle = atan(st.y, st.x);
  float r = length(st);
  float slice = 2.0*3.14159/segments;
  angle = mod(angle, slice);
  angle = abs(angle - slice*0.5);
  return vec2(cos(angle), sin(angle))*r;
}

void main() {
  // Normalize coordinates to [-1,1]
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 st = uv*2.0 -1.0;
  st.x *= u_resolution.x/u_resolution.y;

  float t = u_time;
  float bass = u_bass;
  float mid = u_mid;
  float treble = u_treble;

  // Apply kaleidoscopic tiling
  st = kaleido(st, 6.0);

  // Compute hue based on time, position, and audio
  float hueSpeed = 0.2 + bass*0.5;
  float hue = fract(t*hueSpeed + length(vPos)*0.3 + mid*0.3);
  float saturation = 0.9;
  float lightness = 0.4 + 0.1*sin(t+mid*3.0);
  vec3 baseColor = hsl2rgb(vec3(hue,saturation,lightness));

  // Create swirl patterns influenced by treble
  float swirlRadius = length(st);
  float swirlAngle = atan(st.y,st.x) + t*(0.5+treble);
  float swirl = sin(swirlAngle*20.0 + swirlRadius*20.0)*treble;
  vec3 swirlColor = hsl2rgb(vec3(fract(hue+0.3+treble*0.2),1.0,0.4+0.3*swirl));
  swirlColor *= smoothstep(0.5,1.0,swirlRadius)*treble;

  // Mix swirl color into base color
  vec3 color = mix(baseColor, swirlColor, swirl*0.5);

  // Additional subtle pattern overlay
  float sp = sin((st.x+st.y)*100.0+u_time*30.0);
  sp = smoothstep(0.7,0.95,sp+treble*0.8)*treble*0.7;
  color += sp*vec3(1.0,0.9,1.0);

  // Slightly boost brightness based on avgAmp
  color *= (1.0+u_avgAmp*0.3);

  gl_FragColor = vec4(color,1.0);
}
`;

// Shape class
// Grow and shrink over time, rotate around center, triggered by bass
class Shape {
  constructor() {
    this.seed = random(1);             // Unique seed for variation in shader
    this.spawnTime = millis();         // Time of creation
    this.lifeSpan = random(5000,10000);// Lifespan in ms
    this.angle = random(TWO_PI);       // Angle around center
    this.dist = random(50,200);        // Distance from center
    this.yrot = random(TWO_PI);        // Extra rotation factor
  }
  
  update() {
    let t = (millis()-this.spawnTime)/this.lifeSpan;
    // Scale: sine wave 0->1->0 over lifespan
    this.scale = sin(t*PI); 
    if(this.scale<0)this.scale=0;
    // Slowly rotate around center
    this.angle += 0.01;
  }
  
  isDead() {
    return (millis()-this.spawnTime)>this.lifeSpan;
  }
  
  getOffset() {
    // Position offset based on angle and scale
    let x = cos(this.angle)*this.dist*this.scale;
    let y = 0;
    let z = sin(this.angle)*this.dist*this.scale;
    return createVector(x,y,z);
  }
}

// SparkOrb class
// Similar to Shape but triggered by treble and slightly different motion (torus)
class SparkOrb {
  constructor() {
    this.seed = random(1);
    this.spawnTime = millis();
    this.lifeSpan = random(3000,6000); 
    this.angle = random(TWO_PI);
    this.dist = random(100,250);
  }
  
  update() {
    let t = (millis()-this.spawnTime)/this.lifeSpan;
    // Spark orbs scale also follows a sine wave but smaller amplitude (0.5)
    this.scale = sin(t*PI)*0.5; 
    if(this.scale<0)this.scale=0;
    this.angle += 0.02;
  }
  
  isDead() {
    return (millis()-this.spawnTime)>this.lifeSpan;
  }
  
  getOffset() {
    let x = cos(this.angle)*this.dist*this.scale;
    let y = sin(this.angle*2.0)*50*this.scale; 
    let z = sin(this.angle)*this.dist*this.scale;
    return createVector(x,y,z);
  }
}

function setup(){
  // Create a full-window WebGL canvas
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();
  
  // Initialize FFT for audio
  fft = new p5.FFT(0.9,1024);

  theShader = createShader(vertShader, fragShader);
  
  userStartAudio();
}

function draw(){
  background(0);
  if(!audioStarted){
    // If audio not started, skip drawing
    return;
  }

  // Analyze audio frequencies each frame
  let bass = fft.getEnergy('bass')/255.0;
  let mid = fft.getEnergy('mid')/255.0;
  let treble = fft.getEnergy('treble')/255.0;

  let waveArr = fft.waveform();
  let avgAmp=0.0;
  for (let i=0; i<waveArr.length; i++){
    avgAmp += abs(waveArr[i]);
  }
  avgAmp/=waveArr.length;

  // Spawn shapes on bass spikes
  if(bass > 0.8 && frameCount % 15 == 0) {
    shapes.push(new Shape());
  }

  // Spawn spark orbs on treble spikes
  if(treble > 0.7 && frameCount % 20 == 0){
    sparkOrbs.push(new SparkOrb());
  }

  // Update shapes and remove dead ones
  for (let i=shapes.length-1; i>=0; i--){
    shapes[i].update();
    if(shapes[i].isDead()){
      shapes.splice(i,1);
    }
  }

  // Update sparkOrbs and remove dead ones
  for (let i=sparkOrbs.length-1; i>=0; i--){
    sparkOrbs[i].update();
    if(sparkOrbs[i].isDead()){
      sparkOrbs.splice(i,1);
    }
  }

  shader(theShader);
  theShader.setUniform('u_time', millis()/1000.0);
  theShader.setUniform('u_bass', bass);
  theShader.setUniform('u_mid', mid);
  theShader.setUniform('u_treble', treble);
  theShader.setUniform('u_avgAmp', avgAmp);
  theShader.setUniform('u_resolution',[width, height]);

  // Apply zoom by translating along the z-axis
  // zoomFactor < 1 means we move closer (zoom in), >1 means move farther (zoom out)
  translate(0,0,-300*(1.0/zoomFactor)); 

  // Apply rotations from user drag interaction
  rotateX(angleX);
  rotateY(angleY);

  // Main shape at center (seed=0, offset=0)
  theShader.setUniform('u_seed', 0.0);
  theShader.setUniform('u_offset', [0,0,0]);
  sphere(200,80,80);

  // Child shapes (from bass)
  for (let s of shapes){
    let off = s.getOffset();
    theShader.setUniform('u_seed', s.seed);
    theShader.setUniform('u_offset',[off.x, off.y, off.z]);
    push();
    // Additional rotation per shape if desired:
    // rotateY(s.angle*2.0); rotateZ(s.angle*0.5);
    sphere(50*s.scale, 50,50); 
    pop();
  }

  // Spark orbs (from treble)
  for (let o of sparkOrbs){
    let off = o.getOffset();
    theShader.setUniform('u_seed', o.seed+0.5);
    theShader.setUniform('u_offset', [off.x, off.y, off.z]);
    push();
    // Additional rotation per orb:
    // rotateY(o.angle*3.0); rotateZ(o.angle*0.3);
    torus(30*o.scale,10*o.scale, 30,30);
    pop();
  }
}

function mousePressed() {
  // Start audio on mouse press if not started
  if(!audioStarted){
    userStartAudio().then(()=>{
      audio.loop();
      fft.setInput(audio);
      audioStarted = true;
    });
  }

  if (mouseButton === LEFT) {
    // Begin dragging to rotate scene
    isDragging = true;
    lastMouseX = mouseX;
    lastMouseY = mouseY;
  }
}

function mouseReleased() {
  // Stop dragging when mouse is released
  if (mouseButton === LEFT) {
    isDragging = false;
  }
}

function mouseDragged() {
  // If left mouse button is held down, rotate scene based on mouse movement
  if (isDragging && mouseButton === LEFT) {
    let dx = mouseX - lastMouseX;
    let dy = mouseY - lastMouseY;

    // Rotate around Y-axis by dx, around X-axis by dy
    angleY += dx * 0.01; 
    angleX += dy * 0.01;

    // Update last mouse position
    lastMouseX = mouseX;
    lastMouseY = mouseY;
  }
}

function mouseWheel(event) {
  // Zoom in/out based on scroll direction
  // event.delta < 0 means scroll up (zoom in), event.delta > 0 means scroll down (zoom out)
  if (event.delta < 0) {
    // Zoom in
    zoomFactor *= 0.95;
  } else {
    // Zoom out
    zoomFactor *= 1.05;
  }
  // Prevent default scrolling behavior
  return false;
}

function windowResized(){
  // Adjust the canvas if window is resized
  resizeCanvas(windowWidth, windowHeight);
}
