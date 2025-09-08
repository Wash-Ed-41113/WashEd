const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Set landscape size
canvas.width = 800;
canvas.height = 500;

// Background image
const background = new Image();
background.src = "assets/images/washed_mod_2/SINK3.png"

// Word arrays
const goodWords = ["Soap", "Water", "Clean"];
const badWords = ["Germs", "Dirty", "Virus"];

// Player (hand)
const player = {
    x: canvas.width / 2 - 40,
    y: canvas.height - 60,
    width: 80,
    height: 30,
    dx: 0
};

// Items (water & germs)
let items = [];
let score = 0;
let lives = 3;
let timeLeft = 30; // seconds
let gameOver = false;

// Germ image
const germImg = new Image();
germImg.src = "assets/images/washed_mod_2/washed_mod_2_disease_water-AERO__TRANS.png";

// Spawn items
function spawnItem() {
    const isWater = Math.random() > 0.4; // 60% water, 40% germ
    const word = isWater
        ? goodWords[Math.floor(Math.random() * goodWords.length)]
        : badWords[Math.floor(Math.random() * badWords.length)];

    items.push({
        x: Math.random() * (canvas.width - 60),
        y: 0,
        width: 60,
        height: 30,
        type: isWater ? "water" : "germ",
        word: word,
        speed: 2 + Math.random() * 2
    });
}

// Draw player hand
function drawPlayer() {
    ctx.fillStyle = "blue";
    ctx.fillRect(player.x, player.y, player.width, player.height);
}

// Draw items
function drawItems() {
    items.forEach(item => {
        if (item.type === "water") {
            ctx.fillStyle = "aqua";
            ctx.fillRect(item.x, item.y, item.width, item.height);
        } else if (item.type === "germ" && germImg.complete && germImg.naturalWidth !== 0) {
            ctx.drawImage(germImg, item.x, item.y, item.width, item.height);
        } else {
            ctx.fillStyle = "red";
            ctx.fillRect(item.x, item.y, item.width, item.height);
        }

        // Draw text (word)
        ctx.fillStyle = "black";
        ctx.font = "12px Arial";
        ctx.fillText(item.word, item.x + 5, item.y + item.height / 1.5);
    });
}

// Draw UI
function drawUI() {
    ctx.fillStyle = "black";
    ctx.font = "16px Arial";
    ctx.fillText("Score: " + score, 10, 20);
    ctx.fillText("Lives: " + lives, 10, 40);
    ctx.fillText("Time: " + timeLeft, canvas.width - 100, 20);
}

// Update items
function updateItems() {
    items.forEach((item, index) => {
        item.y += item.speed;

        // Collision detection
        if (
            item.x < player.x + player.width &&
            item.x + item.width > player.x &&
            item.y < player.y + player.height &&
            item.y + item.height > player.y
        ) {
            if (item.type === "water") {
                score += 10;
            } else {
                lives -= 1;
                if (lives <= 0) gameOver = true;
            }
            items.splice(index, 1);
        }

        // Remove if off screen
        if (item.y > canvas.height) items.splice(index, 1);
    });
}

// Game loop
function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    // Draw background (with fallback if image not loaded)
    if (background.complete && background.naturalWidth !== 0) {
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = "#add8e6"; // light blue fallback
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }


    if (gameOver) {
        ctx.fillStyle = "black";
        ctx.font = "30px Arial";
        ctx.fillText("Game Over!", canvas.width / 2 - 80, canvas.height / 2);
        ctx.fillText("Score: " + score, canvas.width / 2 - 60, canvas.height / 2 + 40);
        return;
    }

    drawPlayer();
    drawItems();
    drawUI();
    updateItems();

    requestAnimationFrame(update);
}

// Controls - Keyboard
document.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") player.dx = -5;
    if (e.key === "ArrowRight") player.dx = 5;
});
document.addEventListener("keyup", e => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") player.dx = 0;
});

// Controls - Mouse
canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    player.x = mouseX - player.width / 2;
});

// Move player
function movePlayer() {
    player.x += player.dx;
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
}
setInterval(movePlayer, 16);

// Spawn items
setInterval(spawnItem, 1000);

// Timer
setInterval(() => {
    if (!gameOver) {
        timeLeft--;
        if (timeLeft <= 0) gameOver = true;
    }
}, 1000);

// Start game
update();




