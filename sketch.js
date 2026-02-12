// ─── Constants ──────────────────────────────────────────────────────
const W = 800, H = 600;
const GAME_DURATION = 60;
const FIRE_RATE = 10;
const MAX_PARTICLES = 300;
const SHIP_W = 30, SHIP_H = 36;

// ─── Sound (Web Audio API) ──────────────────────────────────────────
let audioCtx;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq, dur, type, vol, slide) {
  ensureAudio();
  let o = audioCtx.createOscillator();
  let g = audioCtx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, audioCtx.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.15, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + dur);
}

function sfxShoot() { playTone(880, 0.08, 'square', 0.1, 440); }
function sfxExplode() { playTone(120, 0.25, 'sawtooth', 0.18, 40); }
function sfxStart() {
  playTone(330, 0.12, 'square', 0.12);
  setTimeout(() => playTone(440, 0.12, 'square', 0.12), 100);
  setTimeout(() => playTone(660, 0.2, 'square', 0.12), 200);
}
function sfxWin() {
  playTone(523, 0.15, 'square', 0.12);
  setTimeout(() => playTone(659, 0.15, 'square', 0.12), 120);
  setTimeout(() => playTone(784, 0.15, 'square', 0.12), 240);
  setTimeout(() => playTone(1047, 0.3, 'triangle', 0.15), 360);
}
function sfxFail() {
  playTone(440, 0.2, 'sawtooth', 0.15, 200);
  setTimeout(() => playTone(200, 0.4, 'sawtooth', 0.12, 80), 200);
}

// ─── Game State ─────────────────────────────────────────────────────
let state = 'start';
let score = 0;
let highScore = 0;
let stars = [];
let asteroids = [];
let missiles = [];
let particles = [];
let ship;
let lastFireFrame = -FIRE_RATE;
let playStartFrame = 0;
let pauseOffset = 0;
let pauseStartFrame = 0;
let gameProgress = 0;
let shakeAmount = 0;
let spawnCounter = 0;
let winFrame = 0;

// ─── Classes ────────────────────────────────────────────────────────

class Star {
  constructor() {
    this.x = random(W);
    this.y = random(H);
    this.speed = random(0.5, 3);
    this.sz = map(this.speed, 0.5, 3, 1, 2.5);
    this.alpha = map(this.speed, 0.5, 3, 80, 255);
  }
  update(speedMult) {
    this.y += this.speed * speedMult;
    if (this.y > H + 5) {
      this.y = random(-20, -5);
      this.x = random(W);
    }
  }
  draw() {
    noStroke();
    fill(255, 255, 255, this.alpha);
    rect(this.x, this.y, max(this.sz, 1), max(this.sz + this.sz * 0.5, 1));
  }
}

class Ship {
  constructor() {
    this.x = W / 2;
    this.y = H - 90;
    this.speed = 5;
    this.radius = 16;
    this.tilt = 0;
  }
  update() {
    let mx = 0, my = 0;
    if (keyIsDown(LEFT_ARROW) || keyIsDown(65))  mx = -1;
    if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) mx = 1;
    if (keyIsDown(UP_ARROW) || keyIsDown(87))    my = -1;
    if (keyIsDown(DOWN_ARROW) || keyIsDown(83))  my = 1;

    if (mx !== 0 && my !== 0) { mx *= 0.707; my *= 0.707; }

    this.x += mx * this.speed;
    this.y += my * this.speed;
    this.x = constrain(this.x, SHIP_W / 2 + 5, W - SHIP_W / 2 - 5);
    this.y = constrain(this.y, H * 0.15, H - SHIP_H / 2 - 5);
    this.tilt = lerp(this.tilt, mx * -3, 0.15);

    if (keyIsDown(32) && frameCount - lastFireFrame >= FIRE_RATE) {
      missiles.push(new Missile(this.x, this.y - SHIP_H / 2));
      lastFireFrame = frameCount;
      sfxShoot();
    }
  }
  draw() {
    push();
    translate(this.x, this.y);
    noStroke();

    // Wing shift based on tilt (no rotation — just slides wings)
    let wingShift = this.tilt * 0.6;

    // Body triangle
    fill(200, 210, 230);
    triangle(0, -SHIP_H / 2, -SHIP_W / 2 + wingShift, SHIP_H / 2,
             SHIP_W / 2 + wingShift, SHIP_H / 2);
    // Cockpit
    fill(100, 180, 255);
    ellipse(0, -2, 8, 12);
    // Wings
    fill(80, 95, 120);
    rect(-SHIP_W / 2 + wingShift, SHIP_H / 4, 8, 10);
    rect(SHIP_W / 2 - 8 + wingShift, SHIP_H / 4, 8, 10);

    // Engine flames
    let flameH = random(8, 18);
    fill(255, 180, 40, 220);
    rect(-7, SHIP_H / 2, 5, flameH);
    rect(2, SHIP_H / 2, 5, flameH);

    pop();
  }
}

class Missile {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = 10;
    this.radius = 4;
  }
  update() { this.y -= this.speed; }
  offscreen() { return this.y < -20; }
  draw() {
    noStroke();
    fill(255, 200, 80, 80);
    rect(this.x - 4, this.y - 6, 8, 12);
    fill(255, 255, 200);
    rect(this.x - 2, this.y - 4, 4, 8);
    fill(255, 180, 60, 120);
    rect(this.x - 1, this.y + 4, 2, random(4, 10));
  }
}

class Asteroid {
  constructor(speedMult) {
    this.radius = random(12, 36);
    this.x = random(this.radius + 10, W - this.radius - 10);
    this.y = -this.radius * 2 - random(10, 100);
    this.speed = random(1.5, 3.5) * speedMult;
    this.vx = random(-0.5, 0.5);
    this.rot = random(TWO_PI);
    this.rotSpeed = random(-0.02, 0.02);
    this.alive = true;
    this.col = [floor(random(100, 155)), floor(random(85, 130)), floor(random(65, 105))];
    // Wobble — gentle sine drift
    this.wobbleAmp = random(0.3, 1.2);
    this.wobbleSpeed = random(0.02, 0.06);
    this.wobblePhase = random(TWO_PI);
    // Jagged shape vertices (8-11 points around a circle with random radii)
    this.verts = [];
    let numVerts = floor(random(8, 12));
    for (let i = 0; i < numVerts; i++) {
      let a = (TWO_PI / numVerts) * i;
      let r = this.radius * random(0.7, 1.0);
      this.verts.push({ a, r });
    }
  }
  update() {
    this.y += this.speed;
    this.x += this.vx + sin(frameCount * this.wobbleSpeed + this.wobblePhase) * this.wobbleAmp;
    this.rot += this.rotSpeed;
    if (this.x < -this.radius) this.x = W + this.radius;
    if (this.x > W + this.radius) this.x = -this.radius;
  }
  passed() { return this.y > H + this.radius * 2 + 20; }
  draw() {
    push();
    translate(this.x, this.y);
    rotate(this.rot);
    noStroke();
    // Main jagged body
    fill(this.col[0], this.col[1], this.col[2]);
    beginShape();
    for (let v of this.verts) vertex(cos(v.a) * v.r, sin(v.a) * v.r);
    endShape(CLOSE);
    // Highlight crater
    fill(this.col[0] + 40, this.col[1] + 35, this.col[2] + 25);
    ellipse(-this.radius * 0.2, -this.radius * 0.15, this.radius * 0.45, this.radius * 0.4);
    // Shadow crater
    fill(this.col[0] - 30, this.col[1] - 25, this.col[2] - 20);
    ellipse(this.radius * 0.25, this.radius * 0.2, this.radius * 0.35, this.radius * 0.3);
    pop();
  }
  get points() {
    if (this.radius < 20) return 30;
    if (this.radius < 30) return 20;
    return 10;
  }
}

class Particle {
  constructor(x, y, col) {
    this.x = x;
    this.y = y;
    let angle = random(TWO_PI);
    let spd = random(1, 6);
    this.vx = cos(angle) * spd;
    this.vy = sin(angle) * spd;
    this.life = 1.0;
    this.decay = random(0.02, 0.06);
    this.sz = random(2, 5);
    this.col = col;
    this.friction = 0.95;
  }
  update() {
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
  }
  dead() { return this.life <= 0; }
  draw() {
    noStroke();
    fill(this.col[0], this.col[1], this.col[2], this.life * 255);
    let s = this.sz * this.life;
    rect(this.x - s / 2, this.y - s / 2, s, s);
  }
}

const EXPLOSION_COLORS = [
  [200, 200, 200], [255, 160, 50], [255, 240, 60],
  [255, 255, 255], [255, 100, 30], [140, 120, 90],
];

function spawnExplosion(x, y, count) {
  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX_PARTICLES) break;
    particles.push(new Particle(x, y, random(EXPLOSION_COLORS)));
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function getPlaySeconds() {
  return (frameCount - playStartFrame - pauseOffset) / 60;
}

function getDifficulty() {
  let secs = getPlaySeconds();
  let t = secs / GAME_DURATION;
  // Ease-out curve: ramps fast early, flattens in the last 15s
  let curve = 1 - pow(1 - t, 2);
  let spawnInterval = max(12, floor(35 - curve * 20));
  let speedMult = 1.0 + curve * 1.5;
  return { spawnInterval, speedMult, t };
}

function circlesOverlap(x1, y1, r1, x2, y2, r2) {
  let dx = x1 - x2, dy = y1 - y2;
  let dist = r1 + r2;
  return dx * dx + dy * dy < dist * dist;
}

function drawEarth(cx, cy, sz) {
  noStroke();
  fill(30, 80, 180);
  ellipse(cx, cy, sz, sz);
  fill(80, 160, 90, 160);
  ellipse(cx - sz * 0.12, cy - sz * 0.1, sz * 0.45, sz * 0.35);
  ellipse(cx + sz * 0.2, cy + sz * 0.2, sz * 0.3, sz * 0.25);
  noFill();
  stroke(100, 160, 255, 50);
  strokeWeight(3);
  ellipse(cx, cy, sz + 8, sz + 8);
}

// ─── p5.js Setup & Draw ─────────────────────────────────────────────

function setup() {
  createCanvas(W, H);
  frameRate(60);
  noSmooth();
  textFont('monospace');

  let stored = localStorage.getItem('asteroidDestroyerHS2');
  if (stored) highScore = parseInt(stored);

  for (let i = 0; i < 200; i++) stars.push(new Star());
  ship = new Ship();
}

function draw() {
  push();
  if (shakeAmount > 0) {
    translate(random(-shakeAmount, shakeAmount), random(-shakeAmount, shakeAmount));
    shakeAmount *= 0.85;
    if (shakeAmount < 0.5) shakeAmount = 0;
  }

  background(5, 5, 15);

  switch (state) {
    case 'start':    drawStars(1); drawStartScreen(); break;
    case 'playing':  updatePlaying(); drawPlayingScene(); break;
    case 'paused':   drawPlayingScene(); drawPauseOverlay(); break;
    case 'gameover': drawPlayingScene(); drawGameOverScreen(); break;
    case 'win':      drawWinScene(); break;
  }

  pop();
}

function drawStars(speedMult) {
  for (let s of stars) {
    if (state === 'playing') s.update(speedMult);
    s.draw();
  }
}

// ─── Start Screen ───────────────────────────────────────────────────

function drawStartScreen() {
  textStyle(BOLD);
  textSize(40);
  textAlign(CENTER, CENTER);
  fill(255, 80, 80);
  text("ASTEROID DESTROYER", W / 2, H * 0.22);

  textStyle(NORMAL);
  textSize(18);
  fill(140, 180, 255);
  text("JOURNEY HOME", W / 2, H * 0.32);

  textSize(15);
  fill(180, 180, 200);
  text("Navigate through the asteroid belt", W / 2, H * 0.44);
  text("and reach Earth to survive!", W / 2, H * 0.49);

  textSize(14);
  fill(150, 160, 180);
  text("WASD / Arrow Keys  --  Move", W / 2, H * 0.60);
  text("SPACE  --  Fire Missiles", W / 2, H * 0.65);
  text("P  --  Pause", W / 2, H * 0.70);

  if (frameCount % 60 < 40) {
    textSize(20);
    fill(255, 255, 100);
    text("Press ENTER to Launch", W / 2, H * 0.82);
  }

  if (highScore > 0) {
    textSize(13);
    fill(140, 140, 170);
    text("High Score: " + highScore, W / 2, H * 0.91);
  }
}

// ─── Playing Update ─────────────────────────────────────────────────

function updatePlaying() {
  let secs = getPlaySeconds();
  gameProgress = constrain(secs / GAME_DURATION, 0, 1);

  if (secs >= GAME_DURATION) {
    sfxWin();
    state = 'win';
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('asteroidDestroyerHS2', highScore);
    }
    return;
  }

  ship.update();

  let starSpeed = 1 + gameProgress * 3;
  for (let s of stars) s.update(starSpeed);

  // Spawn asteroids
  let diff = getDifficulty();
  spawnCounter++;
  if (spawnCounter >= diff.spawnInterval) {
    let count = (diff.t > 0.7 && random() < 0.2) ? 2 : 1;
    for (let i = 0; i < count; i++) asteroids.push(new Asteroid(diff.speedMult));
    spawnCounter = 0;
  }

  for (let m of missiles) m.update();
  missiles = missiles.filter(m => !m.offscreen());

  for (let a of asteroids) a.update();

  // Missile-asteroid collision
  for (let i = asteroids.length - 1; i >= 0; i--) {
    let a = asteroids[i];
    if (!a.alive) continue;
    for (let j = missiles.length - 1; j >= 0; j--) {
      let m = missiles[j];
      if (circlesOverlap(m.x, m.y, m.radius, a.x, a.y, a.radius)) {
        score += a.points;
        spawnExplosion(a.x, a.y, floor(map(a.radius, 12, 36, 12, 28)));
        shakeAmount = 3;
        sfxExplode();
        a.alive = false;
        asteroids.splice(i, 1);
        missiles.splice(j, 1);
        break;
      }
    }
  }

  // Asteroid-ship collision
  for (let a of asteroids) {
    if (!a.alive) continue;
    if (circlesOverlap(a.x, a.y, a.radius * 0.7, ship.x, ship.y, ship.radius)) {
      spawnExplosion(a.x, a.y, 25);
      spawnExplosion(ship.x, ship.y, 30);
      shakeAmount = 12;
      sfxFail();
      state = 'gameover';
      if (score > highScore) {
        highScore = score;
        localStorage.setItem('asteroidDestroyerHS2', highScore);
      }
      return;
    }
  }

  // Dodge bonus
  for (let i = asteroids.length - 1; i >= 0; i--) {
    if (asteroids[i].passed()) {
      score += 5;
      asteroids.splice(i, 1);
    }
  }

  for (let p of particles) p.update();
  particles = particles.filter(p => !p.dead());
}

// ─── Playing Scene Draw ─────────────────────────────────────────────

function drawPlayingScene() {
  if (state !== 'playing') {
    for (let s of stars) s.draw();
  } else {
    drawStars(1 + gameProgress * 3);
  }

  // Earth in the distance
  if (gameProgress > 0.4) {
    let earthScale = map(gameProgress, 0.4, 1.0, 0.03, 0.35);
    let earthY = map(gameProgress, 0.4, 1.0, -20, 60);
    drawEarth(W / 2, earthY, 200 * earthScale);
  }

  noStroke();
  for (let m of missiles) m.draw();
  for (let a of asteroids) a.draw();
  for (let p of particles) p.draw();
  ship.draw();

  drawHUD();
}

function drawHUD() {
  let secs = getPlaySeconds();
  let remaining = max(0, ceil(GAME_DURATION - secs));
  let pct = floor(gameProgress * 100);

  textStyle(BOLD);
  textSize(16);
  textAlign(LEFT, TOP);
  fill(255, 220, 80);
  text("Score: " + score, 10, 10);

  textStyle(NORMAL);
  textSize(14);
  fill(140, 200, 255);
  textAlign(CENTER, TOP);
  text("Earth: " + pct + "%", W / 2, 10);

  fill(180, 180, 200);
  textAlign(RIGHT, TOP);
  text(remaining + "s  |  P = Pause", W - 10, 10);
}

// ─── Pause ──────────────────────────────────────────────────────────

function drawPauseOverlay() {
  fill(0, 0, 20, 150);
  rect(0, 0, W, H);
  textStyle(BOLD);
  textSize(48);
  textAlign(CENTER, CENTER);
  fill(150, 180, 255);
  text("PAUSED", W / 2, H / 2 - 20);
  textStyle(NORMAL);
  textSize(18);
  fill(180, 180, 200);
  text("Press P to Resume", W / 2, H / 2 + 30);
}

// ─── Game Over ──────────────────────────────────────────────────────

function drawGameOverScreen() {
  fill(0, 0, 10, 170);
  rect(0, 0, W, H);

  textStyle(BOLD);
  textSize(42);
  textAlign(CENTER, CENTER);
  fill(255, 60, 60);
  text("SHIP DESTROYED", W / 2, H / 3);

  textStyle(NORMAL);
  textSize(14);
  fill(180, 180, 200);
  text("Distance to Earth: " + floor(gameProgress * 100) + "% complete", W / 2, H / 2 - 20);

  textSize(24);
  fill(255, 220, 80);
  text("Score: " + score, W / 2, H / 2 + 20);

  textSize(16);
  fill(150, 150, 180);
  text("High Score: " + highScore, W / 2, H / 2 + 55);

  if (frameCount % 60 < 40) {
    textSize(18);
    fill(255, 255, 100);
    text("Press ENTER to Retry", W / 2, H * 0.78);
  }
}

// ─── Win Scene ──────────────────────────────────────────────────────

function drawWinScene() {
  if (winFrame === 0) winFrame = frameCount;
  let t = (frameCount - winFrame) / 60;

  background(5, 5, 15);
  noStroke();
  for (let s of stars) s.draw();

  let earthSz = min(500, 80 + t * 100);
  drawEarth(W / 2, H / 2 + t * 15, earthSz);

  textStyle(BOLD);
  textSize(44);
  textAlign(CENTER, CENTER);
  fill(100, 255, 150, min(255, t * 100));
  text("EARTH REACHED!", W / 2, H * 0.15);

  if (t > 1.5) {
    textStyle(NORMAL);
    textSize(22);
    fill(255, 220, 80);
    text("Final Score: " + score, W / 2, H * 0.78);

    textSize(16);
    fill(150, 150, 180);
    text("High Score: " + highScore, W / 2, H * 0.84);
  }

  if (t > 3 && frameCount % 60 < 40) {
    textSize(18);
    fill(255, 255, 100);
    text("Press ENTER to Play Again", W / 2, H * 0.92);
  }
}

// ─── Input ──────────────────────────────────────────────────────────

function keyPressed() {
  if (keyCode === ENTER || keyCode === RETURN) {
    if (state === 'start' || state === 'gameover' || state === 'win') startGame();
  }
  if (key === 'p' || key === 'P') {
    if (state === 'playing') {
      state = 'paused';
      pauseStartFrame = frameCount;
    } else if (state === 'paused') {
      resumeGame();
    }
  }
  if (keyCode === 32) return false;
}

function startGame() {
  sfxStart();
  state = 'playing';
  score = 0;
  missiles = [];
  asteroids = [];
  particles = [];
  spawnCounter = 0;
  gameProgress = 0;
  shakeAmount = 0;
  winFrame = 0;
  ship = new Ship();
  playStartFrame = frameCount;
  pauseOffset = 0;
  lastFireFrame = frameCount - FIRE_RATE;
}

function resumeGame() {
  pauseOffset += frameCount - pauseStartFrame;
  state = 'playing';
}
