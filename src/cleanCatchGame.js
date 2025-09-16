// src/cleanCatchGame.js
// Turn the previous IIFE-style script into a reusable module function.

export function createCleanCatch(canvas) {
    const ctx = canvas.getContext("2d");

    // Size (landscape)
    canvas.width = 1080;
    canvas.height = 920;

    // Assets
    const background = new Image();
    background.src = "assets/images/washed_mod_2/SINK3.png";

    const germImg = new Image();
    germImg.src = "assets/images/washed_mod_2/washed_mod_2_disease_water-ATHRO-VECT-ex__MALA.png";

    // Word arrays
    const goodWords = ["Soap","Bath","Wash","Cup","Tap","Well","Pure","Safe","Care","Flow","Clean","Fresh","Water","Rinse","Towel","Health","Filter","Toilet","Health","Filter","Toilet","Shower","Dry"];
    const badWords  = ["Germ","Dirt","Sick","Mud","Virus","Waste","Leak","Rust","Mold","Scum","Slime","Crud","Filth","Ooze","Rot","Odor","Pest",""];

    // State
    const player = { x: canvas.width/2 - 40, y: canvas.height - 60, width: 80, height: 30, dx: 0 };
    let items = [];
    let score = 0;
    let lives = 3;
    let timeLeft = 30;
    let gameOver = false;

    // Helpers
    function spawnItem() {
        const isWater = Math.random() > 0.4;
        const word = isWater
            ? goodWords[Math.floor(Math.random() * goodWords.length)]
            : badWords[Math.floor(Math.random() * badWords.length)];

        items.push({
            x: Math.random() * (canvas.width - 60),
            y: 0,
            width: 60,
            height: 30,
            type: isWater ? "water" : "germ",
            word,
            speed: 2 + Math.random() * 2
        });
    }

    function drawPlayer() {
        ctx.fillStyle = "blue";
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }

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
            ctx.fillStyle = "black";
            ctx.font = "12px Arial";
            ctx.fillText(item.word, item.x + 5, item.y + item.height / 1.5);
        });
    }

    function drawUI() {
        ctx.fillStyle = "black";
        ctx.font = "16px Arial";
        ctx.fillText("Score: " + score, 10, 20);
        ctx.fillText("Lives: " + lives, 10, 40);
        ctx.fillText("Time: " + timeLeft, canvas.width - 100, 20);
    }

    function updateItems() {
        items.forEach((item, index) => {
            item.y += item.speed;
            // collision
            if (item.x < player.x + player.width &&
                item.x + item.width > player.x &&
                item.y < player.y + player.height &&
                item.y + item.height > player.y) {
                if (item.type === "water") {
                    score += 10;
                } else {
                    lives -= 1;
                    if (lives <= 0) gameOver = true;
                }
                items.splice(index, 1);
            }
            // off screen
            if (item.y > canvas.height) items.splice(index, 1);
        });
    }

    // Input
    const onKeyDown = (e) => {
        if (e.key === "ArrowLeft") player.dx = -5;
        if (e.key === "ArrowRight") player.dx = 5;
    };
    const onKeyUp = (e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") player.dx = 0;
    };
    const onPointerMove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        player.x = mouseX - player.width / 2;
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointermove", onPointerMove);

    function movePlayer() {
        player.x += player.dx;
        if (player.x < 0) player.x = 0;
        if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
    }

    // Loops/timers
    let rafId = null;
    const moveInterval = setInterval(movePlayer, 16);
    const spawnInterval = setInterval(spawnItem, 1000);
    const timerInterval = setInterval(() => {
        if (!gameOver) {
            timeLeft--;
            if (timeLeft <= 0) gameOver = true;
        }
    }, 1000);

    function frame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (background.complete && background.naturalWidth !== 0) {
            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = "#add8e6";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        if (gameOver) {
            ctx.fillStyle = "black";
            ctx.font = "30px Arial";
            ctx.fillText("Game Over!", canvas.width / 2 - 80, canvas.height / 2);
            ctx.fillText("Score: " + score, canvas.width / 2 - 60, canvas.height / 2 + 40);
            return; // stop redrawing once over; destroy() will cancel raf
        }

        drawPlayer();
        drawItems();
        drawUI();
        updateItems();

        rafId = requestAnimationFrame(frame);
    }

    // Start
    frame();

    // Cleanup for scene shutdown
    function destroy() {
        if (rafId) cancelAnimationFrame(rafId);
        clearInterval(moveInterval);
        clearInterval(spawnInterval);
        clearInterval(timerInterval);
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("keyup", onKeyUp);
        canvas.removeEventListener("pointermove", onPointerMove);
    }

    return { destroy };
}
