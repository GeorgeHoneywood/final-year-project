const canvas = document.getElementById("map");

const ctx = canvas.getContext("2d");

function drawBasicBox(ctx) {
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#FFF';

    ctx.fillRect(0, 0, 600, 10);
    ctx.strokeRect(0, 0, 600, 10);
}

drawBasicBox(ctx);

