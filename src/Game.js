const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Player (hand)
const player = {
    x: canvas.width / 2 - 30,
    y: canvas.height - 60,
    width: 60,
    height: 30,
    dx: 0
};

// Items (water & germs)
let items = [];
let score = 0;
let lives = 3;
let timeLeft = 30; // seconds
let gameOver = false;

// Load images
const germImg = new Image();
germImg.src = "washed_mod_2__ICON.png"; // make sure file is in same folder

const waterImg = new Image();
waterImg.src = "water.png"; // optional (use aqua square if missing)

// Spawn items
function spawnItem() {
    const isWater = Math.random() > 0.4; // 60% water, 40% germ
    items.push({
        x: Math.random() * (canvas.width - 30),
        y: 0,
        width: 30,
        height: 30,
        type: isWater ? "water" : "germ",
        speed: 2 + Math.random() * 2
    });
}

// Draw player hand
function drawPlayer() {
    ctx.fillStyle = "blue"; // replace with hand image if needed
    ctx.fillRect(player.x, player.y, player.width, player.height);
}

// Draw items
function drawItems() {
    items.forEach(item => {
        if (item.type === "water" && waterImg.complete) {
            ctx.drawImage(waterImg, item.x, item.y, item.width, item.height);
        } else if (item.type === "germ" && germImg.complete) {
            ctx.drawImage(germImg, item.x, item.y, item.width, item.height);
        } else {
            ctx.fillStyle = item.type === "water" ? "aqua" : "red";
            ctx.fillRect(item.x, item.y, item.width, item.height);
        }
    });
}

// Draw UI
function drawUI() {
    ctx.fillStyle = "black";
    ctx.font = "16px Arial";
    ctx.fillText("Score: " + score, 10, 20);
    ctx.fillText("Lives: " + lives, 10, 40);
    ctx.fillText("Time: " + timeLeft, canvas.width - 80, 20);
}

// Update items
function updateItems() {
    items.forEach((item, index) => {
        item.y += item.speed;

        // Collision check
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
    if (gameOver) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "black";
        ctx.font = "30px Arial";
        ctx.fillText("Game Over!", 120, 300);
        ctx.fillText("Score: " + score, 140, 340);
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPlayer();
    drawItems();
    drawUI();
    updateItems();

    requestAnimationFrame(update);
}

// Controls
document.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") player.dx = -5;
    if (e.key === "ArrowRight") player.dx = 5;
});
document.addEventListener("keyup", e => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") player.dx = 0;
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




