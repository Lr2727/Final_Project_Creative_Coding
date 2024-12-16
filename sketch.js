// Main variables and settings
let audio;          // p5.Sound object for audio playback
let fft;            // p5.FFT object for analyzing audio frequencies
let audioStarted = false; // Flag to track if audio is started
let theShader;      // p5.Shader object for rendering

function preload() {
  // Load the audio file before setup
  // Replace 'audio1.mp3' with your own audio file if desired
  audio = loadSound('audio1.mp3'); 
}

// Vertex Shader
// - Still a simple pass-through from commit 2
// - No object-specific transforms yet
const vertShader = `
precision mediump float;

attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uProjectionMatrix;
uniform mat4 uModelViewMatrix;

uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_avgAmp;

varying vec3 vPos;

void main() {
  // Basic vertex position output, unchanged
  vec3 pos = aPosition;
  vPos = pos; 
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(pos, 1.0);
}
`;

// Fragment Shader
// - Introduce kaleidoscopic pattern, hue cycling, and swirl effects
// - Audio influences hue shift, swirl intensity, etc.
const fragShader = `
precision mediump float;

uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_avgAmp;
uniform vec2 u_resolution;

varying vec3 vPos;

// Convert HSL to RGB for smooth color cycling
vec3 hsl2rgb(vec3 hsl){
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

// Function to create a kaleidoscopic effect
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
  float lightness = 0.4 + 0.1*sin(t + mid*3.0);
  vec3 baseColor = hsl2rgb(vec3(hue,saturation,lightness));

  // Create a swirl effect influenced by treble
  float swirlRadius = length(st);
  float swirlAngle = atan(st.y, st.x) + t*(0.5+treble);
  float swirl = sin(swirlAngle*20.0 + swirlRadius*20.0)*treble;
  vec3 swirlColor = hsl2rgb(vec3(fract(hue+0.3+treble*0.2),1.0,0.4+0.3*swirl));
  // Use smoothstep to fade swirl color at edges
  swirlColor *= smoothstep(0.5,1.0,swirlRadius)*treble;

  // Mix the swirl color into the base color
  vec3 color = mix(baseColor, swirlColor, swirl*0.5);

  // Add a subtle pattern overlay based on position and time
  float sp = sin((st.x+st.y)*100.0 + t*30.0);
  sp = smoothstep(0.7,0.95,sp+treble*0.8)*treble*0.7;
  color += sp*vec3(1.0,0.9,1.0);

  // Slightly boost brightness based on avgAmp
  color *= (1.0 + u_avgAmp*0.3);

  gl_FragColor = vec4(color,1.0);
}
`;

function setup() {
  // Create a full window WebGL canvas
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke(); // No outlines for shapes
  
  // Initialize FFT for audio analysis
  fft = new p5.FFT(0.9, 1024);
  
  // Create the shader program from the provided vertex & fragment shaders
  theShader = createShader(vertShader, fragShader);
  
  // userStartAudio will prompt user gesture to allow audio playback
  userStartAudio();
}

// Global variable for rotating the sphere
let angleMain = 0;

function draw() {
  background(0); // Clear screen with black
  
  // If audio not started yet, don't attempt to render audio visuals
  if(!audioStarted && !audio.isPlaying()){
    return;
  }

  // Analyze frequencies: bass, mid, treble
  let bass = fft.getEnergy('bass')/255.0;
  let mid = fft.getEnergy('mid')/255.0;
  let treble = fft.getEnergy('treble')/255.0;

  // Compute average amplitude from waveform
  let waveArr = fft.waveform();
  let avgAmp = 0.0;
  for (let i=0; i<waveArr.length; i++){
    avgAmp += abs(waveArr[i]);
  }
  avgAmp /= waveArr.length;

  // Use the shader
  shader(theShader);
  // Pass uniforms to the shader
  theShader.setUniform('u_time', millis()/1000.0);
  theShader.setUniform('u_bass', bass);
  theShader.setUniform('u_mid', mid);
  theShader.setUniform('u_treble', treble);
  theShader.setUniform('u_avgAmp', avgAmp);
  theShader.setUniform('u_resolution', [width, height]);

  // Slowly rotate the sphere
  angleMain += 0.002;
  rotateY(angleMain);
  rotateX(angleMain * 0.7);

  // Draw a single sphere
  sphere(100, 50, 50);
}

function mousePressed(){
  // On mouse click, start the audio if not started yet
  if(!audioStarted){
    userStartAudio().then(()=>{
      audio.loop();
      fft.setInput(audio);
      audioStarted = true;
    });
  }
}

function windowResized(){
  // Adjust the canvas if window is resized
  resizeCanvas(windowWidth, windowHeight);
}
