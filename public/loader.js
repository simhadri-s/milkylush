
// Simple Infinite Loading Screen
class InfiniteLoader {
    constructor(options = {}) {
        this.options = {
            containerId: options.containerId || 'infiniteLoader',
            message: options.message || 'Loading...',
            spinnerSize: options.spinnerSize || 60,
            backgroundColor: options.backgroundColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            textColor: options.textColor || 'white',
            redirectUrl: options.redirectUrl || null,
            redirectDelay: options.redirectDelay || null
        };
        
        this.create();
        this.setupRedirect();
    }

    create() {
        const html = `
            <div id="${this.options.containerId}" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: ${this.options.backgroundColor};
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                font-family: Arial, sans-serif;
                color: ${this.options.textColor};
            ">
                <div class="infinite-spinner" style="
                    width: ${this.options.spinnerSize}px;
                    height: ${this.options.spinnerSize}px;
                    border: 3px solid rgba(255,255,255,0.3);
                    border-top: 3px solid white;
                    border-radius: 50%;
                    animation: infiniteSpin 1s linear infinite;
                    margin-bottom: 30px;
                "></div>
                
                <div style="
                    font-size: 20px;
                    opacity: 0.9;
                ">${this.options.message}</div>
            </div>
            
            <style>
                @keyframes infiniteSpin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        
        document.body.insertAdjacentHTML('beforeend', html);
    }

    setupRedirect() {
        if (this.options.redirectUrl && this.options.redirectDelay) {
            setTimeout(() => {
                this.redirect(this.options.redirectUrl);
            }, this.options.redirectDelay);
        }
    }

    redirect(url) {
        window.location.href = url;
    }

    hide() {
        const container = document.getElementById(this.options.containerId);
        if (container) {
            container.style.opacity = '0';
            setTimeout(() => container.remove(), 500);
        }
    }

    updateMessage(message) {
        const container = document.getElementById(this.options.containerId);
        const messageEl = container ? container.querySelector('div:last-child') : null;
        if (messageEl) {
            messageEl.textContent = message;
        }
    }
}

// Simple function to show infinite loader
function showInfiniteLoader(message = 'Loading...', redirectUrl = null, delay = null) {
    return new InfiniteLoader({
        message: message,
        redirectUrl: redirectUrl,
        redirectDelay: delay
    });
}

// Redirect after specified time
function loadAndRedirect(url, delay = 3000, message = 'Redirecting...') {
    const loader = new InfiniteLoader({
        message: message,
        redirectUrl: url,
        redirectDelay: delay
    });
    return loader;
}

// Manual redirect function
function redirectTo(url, delay = 0) {
    if (delay > 0) {
        setTimeout(() => {
            window.location.href = url;
        }, delay);
    } else {
        window.location.href = url;
    }
}
