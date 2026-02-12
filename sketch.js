// ─── Constants ──────────────────────────────────────────────────────
const W = 800, H = 600;
const GAME_DURATION = 60;
const FIRE_RATE = 10;
const MAX_PARTICLES = 300;

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
let earthAngle = 0;
let shakeAmount = 0;
let spawnCounter = 0;
let winFrame = 0;

// Pause button
const pauseBtnX = W - 55, pauseBtnY = 10, pauseBtnW = 45, pauseBtnH = 35;

// ─── Ship pixel art (top-down view) ────────────────────────────────
const SHIP_MAP = [
  "......WW......",
  ".....WCWC.....",
  "....WWCCWW....",
  "....WCCCCW....",
  "...WCCCCCCW...",
  "..WWCCCCCCWW..",
  ".WGGCCCCCCGGW.",
  "WGGGWCCCCWGGGW",
  "WGGWWCCCCWWGGW",
  ".WW.WCCCCW.WW.",
  "....WWWWWW....",
  ".....WEEW.....",
  ".....WEEW.....",
  "......EE......",
];
const SHIP_COLORS = {
  'W': [200, 210, 230],
  'C': [160, 180, 210],
  'G': [80, 95, 120],
  'E': [255, 140, 30],
};
const PX = 3;
const SHIP_PX_W = 14 * PX;
const SHIP_PX_H = 14 * PX;
let shipGfx;

// ─── Asteroid pixel templates ──────────────────────────────────────
const AST_TEMPLATES = [
  [
    "...####...",
    "..#OO##D..",
    ".#OO####D.",
    "##O######D",
    "##########",
    "#D########",
    ".D######D.",
    "..D####D..",
    "...D##D...",
  ],
  [
    "..D####D..",
    ".D#OO###D.",
    "D#OO#####D",
    "###O######",
    "##########",
    "##########",
    "D########D",
    ".D######D.",
    "..DD##DD..",
  ],
  [
    "....##....",
    "..D####...",
    ".D#OO##D..",
    "D##O####D.",
    "##########",
    "D########D",
    ".D#####D..",
    "..D###D...",
    "...DDD....",
  ],
];

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
    let streak = this.sz * 0.5;
    rect(this.x, this.y, max(this.sz, 1), max(this.sz + streak, 1));
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

    // Normalize diagonal
    if (mx !== 0 && my !== 0) {
      mx *= 0.707;
      my *= 0.707;
    }

    this.x += mx * this.speed;
    this.y += my * this.speed;

    this.x = constrain(this.x, SHIP_PX_W / 2 + 5, W - SHIP_PX_W / 2 - 5);
    this.y = constrain(this.y, H * 0.15, H - SHIP_PX_H / 2 - 5);

    // Visual tilt
    this.tilt = lerp(this.tilt, mx * -0.18, 0.15);

    // Fire missiles
    if (keyIsDown(32) && frameCount - lastFireFrame >= FIRE_RATE) {
      missiles.push(new Missile(this.x, this.y - SHIP_PX_H / 2));
      lastFireFrame = frameCount;
    }
  }
  draw() {
    push();
    translate(this.x, this.y);
    rotate(this.tilt);

    image(shipGfx, -SHIP_PX_W / 2, -SHIP_PX_H / 2);

    // Dynamic engine flames
    noStroke();
    let flameH = random(8, 18);
    let flameBot = SHIP_PX_H / 2;

    // Left engine
    fill(frameCount % 3 < 2 ? color(255, 180, 40, 230) : color(255, 100, 20, 200));
    rect(-7, flameBot, 4, flameH);
    fill(frameCount % 4 < 2 ? color(255, 240, 80, 180) : color(255, 160, 40, 160));
    rect(-6, flameBot + 2, 2, flameH + random(2, 8));

    // Right engine
    fill(frameCount % 3 < 2 ? color(255, 180, 40, 230) : color(255, 100, 20, 200));
    rect(3, flameBot, 4, flameH);
    fill(frameCount % 4 < 2 ? color(255, 240, 80, 180) : color(255, 160, 40, 160));
    rect(4, flameBot + 2, 2, flameH + random(2, 8));

    // Center engine (blue)
    fill(frameCount % 2 === 0 ? color(100, 180, 255, 200) : color(150, 210, 255, 180));
    rect(-2, flameBot, 4, flameH * 0.6);

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
  update() {
    this.y -= this.speed;
  }
  offscreen() {
    return this.y < -20;
  }
  draw() {
    noStroke();
    // Glow
    fill(255, 200, 80, 80);
    rect(this.x - 4, this.y - 6, 8, 12);
    // Core
    fill(255, 255, 200);
    rect(this.x - 2, this.y - 4, 4, 8);
    // Trail
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
    // Slight horizontal drift
    this.vx = random(-0.5, 0.5);
    this.rot = random(TWO_PI);
    this.rotSpeed = random(-0.02, 0.02);
    this.alive = true;

    // Build pixel sprite
    let tmpl = random(AST_TEMPLATES);
    let br = floor(random(100, 155));
    let bg = floor(random(85, 130));
    let bb = floor(random(65, 105));
    let colors = {
      '#': [br, bg, bb],
      'O': [br + 45, bg + 40, bb + 30],
      'D': [br - 35, bg - 30, bb - 25],
    };
    let tmplW = tmpl[0].length;
    let tmplH = tmpl.length;
    let px = max(2, floor((this.radius * 2) / max(tmplW, tmplH)));
    this.spriteW = tmplW * px;
    this.spriteH = tmplH * px;
    this.gfx = createGraphics(this.spriteW, this.spriteH);
    this.gfx.noStroke();
    this.gfx.noSmooth();
    for (let r = 0; r < tmpl.length; r++) {
      for (let c = 0; c < tmpl[r].length; c++) {
        let ch = tmpl[r][c];
        if (ch === '.' || ch === ' ') continue;
        let col = colors[ch];
        this.gfx.fill(col[0], col[1], col[2]);
        this.gfx.rect(c * px, r * px, px, px);
      }
    }
  }
  update() {
    this.y += this.speed;
    this.x += this.vx;
    this.rot += this.rotSpeed;
    // Wrap horizontally
    if (this.x < -this.radius) this.x = W + this.radius;
    if (this.x > W + this.radius) this.x = -this.radius;
  }
  passed() {
    return this.y > H + this.radius * 2 + 20;
  }
  draw() {
    push();
    translate(this.x, this.y);
    rotate(this.rot);
    image(this.gfx, -this.spriteW / 2, -this.spriteH / 2);
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

// ─── Difficulty ─────────────────────────────────────────────────────
function getPlaySeconds() {
  return (frameCount - playStartFrame - pauseOffset) / 60;
}

function getDifficulty() {
  let secs = getPlaySeconds();
  let t = secs / GAME_DURATION;
  let spawnInterval = max(8, floor(35 - t * 25));
  let speedMult = 1.0 + t * 2.0;
  return { spawnInterval, speedMult, t };
}

// ─── Collision ──────────────────────────────────────────────────────
function circlesOverlap(x1, y1, r1, x2, y2, r2) {
  let dx = x1 - x2, dy = y1 - y2;
  let dist = r1 + r2;
  return dx * dx + dy * dy < dist * dist;
}

// ─── Glowing Text ───────────────────────────────────────────────────
function drawGlowText(txt, x, y, sz, baseCol) {
  textSize(sz);
  textAlign(CENTER, CENTER);
  fill(baseCol[0], baseCol[1], baseCol[2], 50);
  text(txt, x, y + 2);
  fill(baseCol[0], baseCol[1], baseCol[2], 140);
  text(txt, x, y);
  fill(255, 255, 255);
  text(txt, x, y);
}

// ─── Earth ──────────────────────────────────────────────────────────
let earthGfx;
function buildEarth() {
  let sz = 200;
  earthGfx = createGraphics(sz, sz);
  earthGfx.noStroke();
  earthGfx.noSmooth();
  let px = 4;
  let grid = sz / px;
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      let cx = c - grid / 2, cy = r - grid / 2;
      let d = sqrt(cx * cx + cy * cy);
      if (d > grid / 2) continue;
      let n = noise(c * 0.15, r * 0.15);
      let col;
      if (n > 0.52) {
        col = n > 0.65 ? [140, 180, 100] : [120, 150, 80];
      } else if (n > 0.48) {
        col = [180, 170, 130];
      } else {
        let depth = map(n, 0, 0.48, 0.6, 1);
        col = [30 * depth, 80 * depth, 200 * depth];
      }
      let edgeFactor = map(d, grid / 2 - 4, grid / 2, 1, 0);
      if (edgeFactor < 1) {
        col = [
          lerp(100, col[0], max(0, edgeFactor)),
          lerp(160, col[1], max(0, edgeFactor)),
          lerp(255, col[2], max(0, edgeFactor))
        ];
      }
      earthGfx.fill(col[0], col[1], col[2]);
      earthGfx.rect(c * px, r * px, px, px);
    }
  }
}

// ─── p5.js Setup & Draw ─────────────────────────────────────────────
function setup() {
  createCanvas(W, H);
  frameRate(60);
  noSmooth();
  textFont('monospace');

  // Pre-render ship sprite
  shipGfx = createGraphics(SHIP_PX_W, SHIP_PX_H);
  shipGfx.noStroke();
  shipGfx.noSmooth();
  for (let r = 0; r < SHIP_MAP.length; r++) {
    for (let c = 0; c < SHIP_MAP[r].length; c++) {
      let ch = SHIP_MAP[r][c];
      if (ch === '.') continue;
      let col = SHIP_COLORS[ch];
      shipGfx.fill(col[0], col[1], col[2]);
      shipGfx.rect(c * PX, r * PX, PX, PX);
    }
  }

  buildEarth();

  let stored = localStorage.getItem('asteroidDestroyerHS2');
  if (stored) highScore = parseInt(stored);

  for (let i = 0; i < 200; i++) {
    stars.push(new Star());
  }

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
  drawGlowText("ASTEROID DESTROYER", W / 2, H * 0.22, 40, [255, 80, 80]);

  textStyle(NORMAL);
  textSize(18);
  fill(140, 180, 255);
  textAlign(CENTER, CENTER);
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

  // Win condition
  if (secs >= GAME_DURATION) {
    state = 'win';
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('asteroidDestroyerHS2', highScore);
    }
    return;
  }

  ship.update();

  // Star scroll speed increases with progress
  let starSpeed = 1 + gameProgress * 3;
  for (let s of stars) s.update(starSpeed);

  // Spawn asteroids
  let diff = getDifficulty();
  spawnCounter++;
  if (spawnCounter >= diff.spawnInterval) {
    let count = (diff.t > 0.5 && random() < 0.3) ? 3 : (diff.t > 0.3 ? 2 : 1);
    for (let i = 0; i < count; i++) {
      asteroids.push(new Asteroid(diff.speedMult));
    }
    spawnCounter = 0;
  }

  // Update missiles
  for (let m of missiles) m.update();
  missiles = missiles.filter(m => !m.offscreen());

  // Update asteroids
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
      state = 'gameover';
      if (score > highScore) {
        highScore = score;
        localStorage.setItem('asteroidDestroyerHS2', highScore);
      }
      return;
    }
  }

  // Remove passed asteroids (dodge bonus)
  for (let i = asteroids.length - 1; i >= 0; i--) {
    if (asteroids[i].passed()) {
      score += 5;
      asteroids.splice(i, 1);
    }
  }

  // Update particles
  for (let p of particles) p.update();
  particles = particles.filter(p => !p.dead());

  earthAngle += 0.005;
}

// ─── Playing Scene Draw ─────────────────────────────────────────────
function drawPlayingScene() {
  // Stars
  if (state !== 'playing') {
    for (let s of stars) s.draw();
  } else {
    let starSpeed = 1 + gameProgress * 3;
    drawStars(starSpeed);
  }

  // Earth in the distance (grows as you approach)
  if (gameProgress > 0.4) {
    let earthScale = map(gameProgress, 0.4, 1.0, 0.03, 0.35);
    let earthY = map(gameProgress, 0.4, 1.0, -20, 60);
    push();
    translate(W / 2, earthY);
    rotate(earthAngle);
    let esz = 200 * earthScale;
    image(earthGfx, -esz / 2, -esz / 2, esz, esz);
    noFill();
    stroke(100, 160, 255, 40 * earthScale);
    strokeWeight(3);
    ellipse(0, 0, esz + 8, esz + 8);
    pop();
  }

  // Draw missiles
  noStroke();
  for (let m of missiles) m.draw();

  // Draw asteroids
  for (let a of asteroids) a.draw();

  // Draw particles
  for (let p of particles) p.draw();

  // Draw ship
  ship.draw();

  // HUD
  drawHUD();
}

function drawHUD() {
  // Score
  textStyle(BOLD);
  drawGlowText("" + score, 55, 28, 22, [255, 220, 80]);

  textStyle(NORMAL);
  textSize(10);
  fill(180, 180, 200);
  textAlign(CENTER, CENTER);
  text("SCORE", 55, 10);

  // Progress bar
  let barW = 200, barH = 12;
  let barX = W / 2 - barW / 2;
  let barY = 16;

  noStroke();
  fill(40, 40, 60);
  rect(barX, barY, barW, barH, 6);

  let fillW = barW * gameProgress;
  if (gameProgress < 0.5) fill(100, 180, 255);
  else if (gameProgress < 0.8) fill(100, 255, 150);
  else fill(255, 220, 80);
  rect(barX, barY, fillW, barH, 6);

  textSize(9);
  fill(255);
  textAlign(CENTER, CENTER);
  text("EARTH", barX + barW / 2, barY + barH / 2 - 1);

  // Ship marker on progress bar
  fill(255, 100, 80);
  let dotX = barX + fillW;
  rect(dotX - 3, barY - 2, 6, barH + 4, 2);

  // Time remaining
  let secs = getPlaySeconds();
  let remaining = max(0, ceil(GAME_DURATION - secs));
  textSize(12);
  fill(180, 180, 200);
  textAlign(LEFT, CENTER);
  text(remaining + "s", barX + barW + 10, barY + barH / 2);

  drawPauseButton();
}

function drawPauseButton() {
  let hover = mouseX > pauseBtnX && mouseX < pauseBtnX + pauseBtnW &&
              mouseY > pauseBtnY && mouseY < pauseBtnY + pauseBtnH;
  noStroke();
  fill(255, 255, 255, hover ? 50 : 25);
  rect(pauseBtnX, pauseBtnY, pauseBtnW, pauseBtnH, 6);
  fill(255, 255, 255, hover ? 200 : 120);
  rect(pauseBtnX + 15, pauseBtnY + 8, 5, 19);
  rect(pauseBtnX + 25, pauseBtnY + 8, 5, 19);
}

// ─── Pause ──────────────────────────────────────────────────────────
function drawPauseOverlay() {
  fill(0, 0, 20, 150);
  rect(0, 0, W, H);
  textStyle(BOLD);
  drawGlowText("PAUSED", W / 2, H / 2 - 20, 48, [150, 180, 255]);
  textStyle(NORMAL);
  textSize(18);
  fill(180, 180, 200);
  textAlign(CENTER, CENTER);
  text("Press P to Resume", W / 2, H / 2 + 30);
}

// ─── Game Over ──────────────────────────────────────────────────────
function drawGameOverScreen() {
  fill(0, 0, 10, 170);
  rect(0, 0, W, H);
  textStyle(BOLD);
  drawGlowText("SHIP DESTROYED", W / 2, H / 3, 42, [255, 60, 60]);

  textStyle(NORMAL);
  textSize(14);
  fill(180, 180, 200);
  textAlign(CENTER, CENTER);
  let pct = floor(gameProgress * 100);
  text("Distance to Earth: " + pct + "% complete", W / 2, H / 2 - 20);

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

  // Earth grows to fill view
  let earthScale = min(2.5, 0.4 + t * 0.5);
  push();
  translate(W / 2, H / 2 + t * 15);
  rotate(earthAngle + t * 0.01);
  let esz = 200 * earthScale;
  image(earthGfx, -esz / 2, -esz / 2, esz, esz);
  noFill();
  stroke(100, 160, 255, 60);
  strokeWeight(4);
  ellipse(0, 0, esz + 12, esz + 12);
  pop();

  textStyle(BOLD);
  let titleAlpha = min(255, t * 100);
  fill(100, 255, 150, titleAlpha);
  textSize(44);
  textAlign(CENTER, CENTER);
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

  earthAngle += 0.005;
}

// ─── Input ──────────────────────────────────────────────────────────
function keyPressed() {
  if (keyCode === ENTER || keyCode === RETURN) {
    if (state === 'start' || state === 'gameover' || state === 'win') {
      startGame();
    }
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

function mousePressed() {
  if (state === 'playing' || state === 'paused') {
    if (mouseX > pauseBtnX && mouseX < pauseBtnX + pauseBtnW &&
        mouseY > pauseBtnY && mouseY < pauseBtnY + pauseBtnH) {
      if (state === 'playing') {
        state = 'paused';
        pauseStartFrame = frameCount;
      } else if (state === 'paused') {
        resumeGame();
      }
    }
  }
}

function startGame() {
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
  earthAngle = random(TWO_PI);
}

function resumeGame() {
  pauseOffset += frameCount - pauseStartFrame;
  state = 'playing';
}
