// Main variables and settings
let audio;          // p5.Sound object for audio playback
let fft;            // p5.FFT for analyzing audio frequencies
let audioStarted = false; // Flag to track if audio has started playing
let theShader;      // p5.Shader object for rendering

// Arrays to store objects triggered by audio events
let shapes = [];    // Child shapes spawned on bass spikes
let sparkOrbs = []; // Spark orbs spawned on treble spikes

function preload(){
  // Load the audio file before setup
  audio = loadSound('audio1.mp3');
}

// Vertex Shader
// - Now includes u_seed, u_offset for per-object transformations
// - Similar to final snippet logic
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
uniform float u_seed;
uniform vec3 u_offset;

float phaseFactor(float t) {
    return 0.5 + 0.5*sin(t*0.2);
}

varying vec3 vPos;

void main() {
  vec3 pos = aPosition + u_offset; 

  float phase = phaseFactor(u_time);
  float breathe = (u_bass*0.3 + u_avgAmp*0.5)*sin(u_time*2.5)*0.5;

  float complexity = 3.0 + (u_mid*20.0 + 20.0*phase + u_seed*10.0);
  float trebleFactor = (u_treble + phase)*0.8;

  float distFactor = sin(dot(aNormal, pos)*complexity + u_time*3.0)*(u_avgAmp+u_bass*0.5);
  distFactor += cos((pos.x+pos.y+pos.z)*30.0 + u_time*5.0)*trebleFactor;
  distFactor += sin((pos.x*pos.y*pos.z)*50.0 + u_time*10.0)*u_mid*0.5;

  float scale = 1.0 + breathe;
  pos *= scale;

  float angle = atan(pos.y, pos.x);
  float radius = length(pos.xy);
  float angularDistort = sin(angle*5.0 + u_time)*0.3*phase*trebleFactor;
  pos += normalize(pos)*angularDistort*radius*0.5;

  pos += aNormal * distFactor * (0.4 + phase);

  vPos = pos;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(pos,1.0);
}
`;

// Fragment Shader
// - Same kaleidoscopic fractal pattern, swirl, and hue cycling as final snippet
const fragShader = `
precision mediump float;

uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_avgAmp;
uniform vec2 u_resolution;

varying vec3 vPos;

vec3 hsl2rgb(vec3 hsl){
  float h=hsl.x; float s=hsl.y; float l=hsl.z;
  float c=(1.0-abs(2.0*l - 1.0))*s;
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
  vec2 st = uv*2.0-1.0;
  st.x *= u_resolution.x/u_resolution.y;

  st = kaleido(st, 6.0);

  float hueSpeed = 0.2 + u_bass*0.5;
  float hue = fract(u_time*hueSpeed + length(vPos)*0.3 + u_mid*0.3);
  float saturation = 0.9;
  float lightness = 0.4 + 0.1*sin(u_time+u_mid*3.0);

  vec3 baseColor = hsl2rgb(vec3(hue,saturation,lightness));

  float swirlRadius = length(st);
  float swirlAngle = atan(st.y,st.x) + u_time*(0.5+u_treble);
  float swirl = sin(swirlAngle*20.0 + swirlRadius*20.0)*u_treble;

  vec3 swirlColor = hsl2rgb(vec3(fract(hue+0.3+u_treble*0.2),1.0,0.4+0.3*swirl));
  swirlColor *= smoothstep(0.5,1.0,swirlRadius)*u_treble;

  vec3 color = mix(baseColor, swirlColor, swirl*0.5);

  float sp = sin((st.x+st.y)*100.0+u_time*30.0);
  sp = smoothstep(0.7,0.95,sp+u_treble*0.8)*u_treble*0.7;
  color += sp*vec3(1.0,0.9,1.0);

  color *= (1.0+u_avgAmp*0.3);

  gl_FragColor = vec4(color,1.0);
}
`;

// Shape class (same logic as final snippet)
class Shape {
  constructor() {
    this.seed = random(1);
    this.spawnTime = millis();
    this.lifeSpan = random(5000,10000); 
    this.angle = random(TWO_PI);
    this.dist = random(50,200);
    this.yrot = random(TWO_PI);
  }
  
  update() {
    let t = (millis()-this.spawnTime)/this.lifeSpan;
    this.scale = sin(t*PI); 
    if(this.scale<0) this.scale=0;
    this.angle += 0.01;
  }
  
  isDead() {
    return (millis()-this.spawnTime)>this.lifeSpan;
  }
  
  getOffset() {
    let x = cos(this.angle)*this.dist*this.scale;
    let y = 0;
    let z = sin(this.angle)*this.dist*this.scale;
    return createVector(x,y,z);
  }
}

// SparkOrb class (same logic as final snippet)
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
  // Create full window WebGL canvas
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();
  fft = new p5.FFT(0.9,1024);

  theShader = createShader(vertShader, fragShader);
  userStartAudio();
}

// Global angle for scene rotation
let angleMain = 0;

function draw(){
  background(0);
  if(!audioStarted){
    // If audio not started, skip drawing visuals
    return;
  }

  // Analyze frequencies each frame
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

  // Update shapes
  for (let i=shapes.length-1; i>=0; i--){
    shapes[i].update();
    if(shapes[i].isDead()){
      shapes.splice(i,1);
    }
  }

  // Update sparkOrbs
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

  angleMain += 0.002;
  rotateY(angleMain);
  rotateX(angleMain*0.7);

  // Draw main shape at center with seed=0, offset=[0,0,0]
  theShader.setUniform('u_seed', 0.0);
  theShader.setUniform('u_offset', [0,0,0]);
  sphere(200,80,80);

  // Draw shapes using per-object uniforms now
  for (let s of shapes){
    let off = s.getOffset();
    theShader.setUniform('u_seed', s.seed);
    theShader.setUniform('u_offset',[off.x, off.y, off.z]);
    push();
    rotateY(s.angle*2.0);
    rotateZ(s.angle*0.5);
    sphere(50*s.scale, 50,50); 
    pop();
  }

  // Draw sparkOrbs similarly
  for (let o of sparkOrbs){
    let off = o.getOffset();
    theShader.setUniform('u_seed', o.seed+0.5);
    theShader.setUniform('u_offset', [off.x, off.y, off.z]);
    push();
    rotateY(o.angle*3.0);
    rotateZ(o.angle*0.3);
    torus(30*o.scale,10*o.scale, 30,30);
    pop();
  }
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
