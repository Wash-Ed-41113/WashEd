const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Canvas size
canvas.width = 400;
canvas.height = 600;

// Player (hands placeholder)
const player = {
    x: canvas.width / 2 - 40,
    y: canvas.height - 50,
    width: 80,
    height: 20,
    color: "brown"
};

// Falling water drops
let drops = [];
function createDrop() {
    const x = Math.random() * (canvas.width - 20) + 10;
    drops.push({ x: x, y: 0, radius: 10, speed: 2 });
}

// Mouse drag support
let isDragging = false;
canvas.addEventListener("mousedown", () => isDragging = true);
canvas.addEventListener("mouseup", () => isDragging = false);
canvas.addEventListener("mousemove", (e) => {
    if (isDragging) {
        const rect = canvas.getBoundingClientRect();
        player.x = e.clientX - rect.left - player.width / 2;
    }
});

// Touch drag support
canvas.addEventListener("touchmove", (e) => {
    const rect = canvas.getBoundingClientRect();
    player.x = e.touches[0].clientX - rect.left - player.width / 2;
});

// Collision check
function checkCollision(drop, player) {
    return (
        drop.x > player.x &&
        drop.x < player.x + player.width &&
        drop.y + drop.radius > player.y
    );
}

// Game loop
function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw player
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Draw and move drops
    for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        d.y += d.speed;

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.fillStyle = "blue";
        ctx.fill();

        // Check catch
        if (checkCollision(d, player)) {
            drops.splice(i, 1);
            i--;
        } else if (d.y > canvas.height) {
            drops.splice(i, 1); // remove if it falls off screen
            i--;
        }
    }

    requestAnimationFrame(update);
}

// Spawn drops every 1 second
setInterval(createDrop, 1000);

update();



