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
// - Simple pass-through: just positions the vertex
// - No object-specific transforms yet
const vertShader = `
precision mediump float;

attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uProjectionMatrix;
uniform mat4 uModelViewMatrix;

// Audio uniforms for future use (not heavily used here)
uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_avgAmp;

varying vec3 vPos;

void main() {
  // Basic vertex position output
  vec3 pos = aPosition;
  vPos = pos; 
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(pos, 1.0);
}
`;

// Fragment Shader
// - Basic gradient influenced by avgAmp
const fragShader = `
precision mediump float;

uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_avgAmp;
uniform vec2 u_resolution;

varying vec3 vPos;

void main() {
  // Compute normalized coordinates
  vec2 uv = gl_FragCoord.xy / u_resolution;
  
  // Create a simple brightness factor based on avgAmp
  float brightness = 0.5 + u_avgAmp * 0.5;
  
  // Use uv.x, uv.y, and brightness to form a gradient color
  vec3 baseColor = vec3(uv.x, uv.y, brightness);
  
  // Output the final color
  gl_FragColor = vec4(baseColor, 1.0);
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
