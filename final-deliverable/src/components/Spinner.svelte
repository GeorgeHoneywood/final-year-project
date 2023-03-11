<!-- spinner from https://loading.io/css/ -->

<div class="spinner">
    <div />
    <div />
    <div />
    <div />
</div>

<style>
    .spinner {
        display: block;
        position: relative;
        width: 25px;
        height: 25px;
    }

    .spinner div {
        box-sizing: border-box;
        display: block;
        position: absolute;
        width: 25px;
        height: 25px;
        border: 3px solid #111;
        border-radius: 50%;
        animation: spinner 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        border-color: #111 transparent transparent transparent;
    }

    .spinner div:nth-child(1) {
        animation-delay: -0.45s;
    }

    .spinner div:nth-child(2) {
        animation-delay: -0.3s;
    }

    .spinner div:nth-child(3) {
        animation-delay: -0.15s;
    }

    @keyframes spinner {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }
</style>
