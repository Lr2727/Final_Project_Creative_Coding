// Main variables and settings
let audio;
let fft;
let audioStarted = false;
let theShader;

function preload() {
  // Load audio file
  audio = loadSound('audio1.mp3');
}

// Vertex shader (unchanged from Commit 1)
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
  vec3 pos = aPosition;
  vPos = pos;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(pos,1.0);
}
`;

// Fragment shader with kaleidoscope & patterns
const fragShader = `
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_avgAmp;

varying vec3 vPos;

// hsl2rgb and kaleido functions as in final version

vec3 hsl2rgb(vec3 hsl){
  float h=hsl.x; float s=hsl.y; float l=hsl.z;
  float c=(1.0-abs(2.0*l-1.0))*s;
  float x=c*(1.0-abs(mod(h*6.0,2.0)-1.0));
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

vec2 kaleido(vec2 st, float segments) {
  float angle = atan(st.y, st.x);
  float r = length(st);
  float slice = 2.0*3.14159/segments;
  angle = mod(angle, slice);
  angle = abs(angle - slice*0.5);
  return vec2(cos(angle), sin(angle))*r;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 st = uv*2.0 -1.0;
  st.x *= u_resolution.x/u_resolution.y;

  float t = u_time;
  float bass = u_bass;
  float mid = u_mid;
  float treble = u_treble;

  // Apply kaleidoscopic pattern
  st = kaleido(st, 6.0);

  // Hue cycling with audio influences
  float hueSpeed = 0.2 + bass*0.5;
  float hue = fract(t*hueSpeed + length(vPos)*0.3 + mid*0.3);
  float saturation = 0.9;
  float lightness = 0.4 + 0.1*sin(t+mid*3.0);
  vec3 baseColor = hsl2rgb(vec3(hue,saturation,lightness));

  // Swirl pattern
  float swirlRadius = length(st);
  float swirlAngle = atan(st.y, st.x) + t*(0.5+treble);
  float swirl = sin(swirlAngle*20.0 + swirlRadius*20.0)*treble;
  vec3 swirlColor = hsl2rgb(vec3(fract(hue+0.3+treble*0.2),1.0,0.4+0.3*swirl));
  swirlColor *= smoothstep(0.5,1.0,swirlRadius)*treble;

  // Mix swirl color and baseColor
  vec3 color = mix(baseColor, swirlColor, swirl*0.5);

  // Additional pattern overlay
  float sp = sin((st.x+st.y)*100.0+t*30.0);
  sp = smoothstep(0.7,0.95,sp+treble*0.8)*treble*0.7;
  color += sp*vec3(1.0,0.9,1.0);

  // Brighten based on avgAmp
  color *= (1.0+u_avgAmp*0.3);

  gl_FragColor = vec4(color,1.0);
}
`;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();
  
  fft = new p5.FFT(0.9,1024);
  theShader = createShader(vertShader, fragShader);
  userStartAudio();
}

let angleMain = 0;

function draw() {
  background(0);

  if(!audioStarted && !audio.isPlaying()){
    return;
  }

  let bass = fft.getEnergy('bass')/255.0;
  let mid = fft.getEnergy('mid')/255.0;
  let treble = fft.getEnergy('treble')/255.0;

  let waveArr = fft.waveform();
  let avgAmp=0.0;
  for (let i=0; i<waveArr.length; i++){
    avgAmp += abs(waveArr[i]);
  }
  avgAmp/=waveArr.length;

  shader(theShader);
  theShader.setUniform('u_time', millis()/1000.0);
  theShader.setUniform('u_bass', bass);
  theShader.setUniform('u_mid', mid);
  theShader.setUniform('u_treble', treble);
  theShader.setUniform('u_avgAmp', avgAmp);
  theShader.setUniform('u_resolution',[width, height]);

  angleMain += 0.002;
  rotateY(angleMain);
  rotateX(angleMain*0.7);

  // Still just one shape
  sphere(100,80,80);
}

function mousePressed(){
  if(!audioStarted){
    userStartAudio().then(()=>{
      audio.loop();
      fft.setInput(audio);
      audioStarted = true;
    });
  }
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
}
